import express from "express";
import Customer from "../models/Customer.js";
import CreditLog from "../models/CreditLog.js";
import { sendWhatsApp } from "../services/whatsapp.js";
import { extractNumber, findBestMatch, guessNameFromText, CREDIT_WORDS, PAYMENT_WORDS } from "../utils/nlp.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Parse helper: "शर्मा काकांनी 500 चा माल घेतला" → udhaar/500 ───
async function parseCreditText(clean) {
  let parsed = null;
  try {
    const customers = await Customer.find({ isActive: true }, "name");
    const names = customers.map(c => c.name).join(", ") || "none";
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(`
You are a Marathi kirana shop udhaar (credit ledger) assistant. The shop owner said:
"${clean}"

Known customers: ${names}

Patterns (LEARN THESE):
• "शर्मा काकांनी 500 चा माल घेतला" → udhaar, 500 (customer TOOK goods on credit, owes money)
• "पाटील यांचा उधार 300" → udhaar, 300
• "उधार खात्यावर 200 चा माल" → udhaar, 200
• "शर्मा काकांनी 200 पैसे दिले" → payment, 200 (customer PAID money back)
• "पाटील मॅडम जमा 500" → payment, 500
• "काकांनी हिशोब भरला 400" → payment, 400
• New customer names are fine — return the name as spoken
• English + Marathi mix is fine ("sharma ji took 500 ka maal" → udhaar, 500)

Return ONLY valid JSON:
{
  "customerName": "name as best understood",
  "type": "udhaar" or "payment" or null,
  "amount": number or null,
  "note": "what was taken, if mentioned, else empty string",
  "confidence": "high" or "medium" or "low",
  "marathiSummary": "1 line Marathi summary"
}`);
    const txt = result.response.text().trim();
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) { console.log("Credit AI fail:", e.message); }

  // Local fallback — no AI needed for the common patterns
  if (!parsed || (!parsed.type && !parsed.amount)) {
    const amount = extractNumber(clean);
    const type = PAYMENT_WORDS.test(clean.toLowerCase()) ? "payment"
      : CREDIT_WORDS.test(clean.toLowerCase()) ? "udhaar" : null;
    if (type || amount) {
      parsed = {
        customerName: guessNameFromText(clean),
        type,
        amount,
        note: "",
        confidence: "low",
        marathiSummary: "local parse",
      };
    }
  }
  return parsed;
}

// ─── GET / — customers with balances + summary ─────────────
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    const query = { isActive: true };
    if (search) query.name = { $regex: search, $options: "i" };

    const customers = await Customer.find(query).sort({ balance: -1, updatedAt: -1 });

    const totalUdhaar = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
    const withBalance = customers.filter(c => c.balance > 0).length;

    res.json({
      success: true,
      data: customers,
      stats: { totalUdhaar, withBalance, total: customers.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /customers — add a customer ──────────────────────
router.post("/customers", async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "ग्राहकाचे नाव आवश्यक" });

    const existing = await Customer.findOne({ name: new RegExp(`^${name.trim()}$`, "i"), isActive: true });
    if (existing) return res.json({ success: true, data: existing, existing: true });

    const customer = new Customer({ name: name.trim(), phone: phone || "" });
    await customer.save();
    res.status(201).json({ success: true, message: "ग्राहक जोडला", data: customer });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── POST /parse — voice/text → structured credit entry ────
router.post("/parse", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: "काहीतरी बोला" });

    const clean = text.trim();
    const parsed = await parseCreditText(clean);
    if (!parsed) return res.json({ success: true, parsed: null, message: "समजले नाही" });

    const customers = await Customer.find({ isActive: true });
    const { match, candidates } = findBestMatch(parsed.customerName, customers);

    res.json({
      success: true,
      parsed: { ...parsed, needsConfirmation: !parsed.amount || !parsed.type },
      matchedCustomer: match || null,
      candidates,
      rawText: clean,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /entry — record udhaar or payment ────────────────
router.post("/entry", async (req, res) => {
  try {
    const { customerId, customerName, type, amount, note, source, rawVoiceText } = req.body;

    if (!type || !["udhaar", "payment"].includes(type))
      return res.status(400).json({ success: false, message: "प्रकार आवश्यक (udhaar/payment)" });
    if (amount === undefined || amount === null || isNaN(amount) || amount <= 0)
      return res.status(400).json({ success: false, message: "रक्कम आवश्यक" });

    let customer = null;
    if (customerId) customer = await Customer.findById(customerId);
    if (!customer && customerName?.trim()) {
      const name = customerName.trim();
      customer = await Customer.findOne({ name: new RegExp(`^${name}$`, "i"), isActive: true });
      if (!customer) {
        customer = new Customer({ name });
        await customer.save();   // auto-create new customers from voice
      }
    }
    if (!customer) return res.status(404).json({ success: false, message: "ग्राहक सापडला नाही" });

    const before = customer.balance;
    customer.balance = type === "udhaar" ? before + amount : before - amount;
    await customer.save();

    await CreditLog.create({
      customerId: customer._id,
      customerName: customer.name,
      type,
      amount,
      balanceAfter: customer.balance,
      note: note || "",
      source: source || "manual",
      rawVoiceText: rawVoiceText || "",
    });

    res.json({
      success: true,
      message: type === "udhaar"
        ? `${customer.name} यांच्यावर उधार ₹${amount} नोंदवला`
        : `${customer.name} यांचे ₹${amount} जमा नोंदवले`,
      data: customer,
      balanceAfter: customer.balance,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── GET /logs/:customerId — recent entries ────────────────
router.get("/logs/:customerId", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 30;
    const logs = await CreditLog.find({ customerId: req.params.customerId })
      .sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /remind/:customerId — WhatsApp payment reminder ──
router.post("/remind/:customerId", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) return res.status(404).json({ success: false, message: "ग्राहक सापडला नाही" });
    if (customer.balance <= 0) return res.status(400).json({ success: false, message: "या ग्राहकाचा उधार नाही" });

    const msg =
      `🔔 *DukanAI उधार स्मरण*\n\n` +
      `नमस्कार *${customer.name}*!\n` +
      `दुकानावर तुमचा उधार *₹${Math.round(customer.balance)}* बाकी आहे.\n` +
      `सोयीच्या वेळी भरून द्या. धन्यवाद! 🙏\n\n` +
      `_DukanAI — तुमच्या दुकानाचा डिजिटल मुनीम_`;

    // To the customer's own number if known, else to the owner as a copy
    const result = await sendWhatsApp(msg, customer.phone ? `whatsapp:${customer.phone}` : process.env.OWNER_WHATSAPP);
    res.json({ success: true, message: "स्मरण पाठवले", result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /settle/:customerId — record full payment ────────
router.post("/settle/:customerId", async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.customerId);
    if (!customer) return res.status(404).json({ success: false, message: "ग्राहक सापडला नाही" });
    if (customer.balance <= 0) return res.status(400).json({ success: false, message: "या ग्राहकाचा उधार नाही" });

    const amount = customer.balance;
    customer.balance = 0;
    await customer.save();

    await CreditLog.create({
      customerId: customer._id,
      customerName: customer.name,
      type: "payment",
      amount,
      balanceAfter: 0,
      note: "पूर्ण हिशोब भरला",
      source: "manual",
    });

    res.json({ success: true, message: `${customer.name} यांचे ₹${amount} पूर्ण जमा झाले`, data: customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
