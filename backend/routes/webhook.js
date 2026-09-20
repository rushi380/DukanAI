import express from "express";
import Item from "../models/Item.js";
import SaleLog from "../models/SaleLog.js";
import Customer from "../models/Customer.js";
import CreditLog from "../models/CreditLog.js";
import { sendWhatsApp, checkLowStock } from "../services/whatsapp.js";
import { computeForecast } from "./forecast.js";
import { extractNumber, extractUnit, findBestMatch, guessNameFromText, CREDIT_WORDS, PAYMENT_WORDS } from "../utils/nlp.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ════════════════════════════════════════════════════════════
// Conversation memory (per WhatsApp sender). In-memory is fine
// for a single-shop demo; survives per warm serverless instance.
// ════════════════════════════════════════════════════════════
const conversations = new Map();
const CONV_TTL = 30 * 60 * 1000;

function getConversation(from) {
  const now = Date.now();
  const conv = conversations.get(from);
  if (conv && now - conv.ts < CONV_TTL) return conv;
  if (conv) conversations.delete(from);
  return null;
}
function setConversation(from, pending) {
  conversations.set(from, { pending, ts: Date.now() });
}
function clearConversation(from) {
  conversations.delete(from);
}

// Note: \b doesn't work with Devanagari (JS \b is ASCII-only) — use end/punctuation anchors
const YES_RE = /^(हो|हाँ|हां|yes|ok|okay|बरोबर|confirm|पाठव|करा|सेंड|ho|ha)([\s,.!?]|$)/i;
const NO_RE  = /^(नाही|नको|no|cancel|रद्द|ना|nahi)([\s,.!?]|$)/i;

// ════════════════════════════════════════════════════════════
// Voice note → text (Gemini handles Marathi/Hindi/English mix)
// ════════════════════════════════════════════════════════════
async function transcribeAudio(mediaUrl, mimeType) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("Twilio credentials नाहीत");

  const resp = await fetch(mediaUrl, {
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
  });
  if (!resp.ok) throw new Error(`मीडिया डाउनलोड अयशस्वी (${resp.status})`);
  const buf = Buffer.from(await resp.arrayBuffer());

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const result = await model.generateContent([
    `Transcribe this voice note. The speaker is an Indian kirana shop owner speaking Marathi, Hindi or English (often mixed).
Write Marathi/Hindi words in Devanagari, keep English/brand names in English (e.g. "मॅगी", "atta").
Return ONLY the transcription text, nothing else.`,
    { inlineData: { data: buf.toString("base64"), mimeType: mimeType || "audio/ogg" } },
  ]);
  return result.response.text().trim();
}

// ════════════════════════════════════════════════════════════
// Intent router: one message → { intent, fields }
// ════════════════════════════════════════════════════════════
async function parseIntent(clean) {
  let parsed = null;
  try {
    const [items, customers] = await Promise.all([
      Item.find({ isActive: true }, "name nameHindi").limit(100),
      Customer.find({ isActive: true }, "name").limit(100),
    ]);
    const itemList = items.map(i => i.name).join(", ") || "none";
    const customerList = customers.map(c => c.name).join(", ") || "none";

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(`
You are DukanAI, the WhatsApp assistant of a Marathi kirana shop. The shop owner messaged:
"${clean}"

Shop items: ${itemList}
Known customers: ${customerList}

Classify the message into ONE intent:
• "stock_update" — goods came in or were sold ("दहा किलो गहू आला", "पाच मॅगी गेल्या", "fifty maggi sold")
• "udhaar" — a customer took goods on credit / owes money ("शर्मा काकांनी 500 चा माल घेतला")
• "payment" — a customer paid money back ("शर्मा काकांनी 200 पैसे दिले", "जमा 500")
• "order_request" — owner wants to place or see a supplier order ("ऑर्डर कर", "order पाठव", "काय ऑर्डर करायचे")
• "summary" — asking for today's status ("आजचा हिशोब सांग", "summary", "स्थिती काय")
• "other" — greeting or anything else

Return ONLY valid JSON:
{
  "intent": "stock_update" | "udhaar" | "payment" | "order_request" | "summary" | "other",
  "itemName": "item name for stock_update else null",
  "action": "sale" or "restock" or null,
  "quantity": number or null,
  "unit": "kg|litre|packet|pcs|bottle|dozen|gram" or null,
  "customerName": "customer name for udhaar/payment else null",
  "amount": number or null,
  "note": "what was taken on credit, if mentioned, else null",
  "marathiSummary": "1 line Marathi: what you understood"
}`);
    const txt = result.response.text().trim();
    const m = txt.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) { console.log("Intent AI fail:", e.message); }

  if (parsed) return parsed;

  // ─── Local fallback (no AI): regex priority order matters ───
  const lower = clean.toLowerCase();
  if (/ऑर्डर|order|पुरवठा/.test(lower)) return { intent: "order_request" };
  if (/हिशोब|सारांश|summary|स्थिती|status|आजचा/.test(lower)) return { intent: "summary" };

  const amount = extractNumber(clean);
  if (PAYMENT_WORDS.test(lower) && amount) return { intent: "payment", customerName: guessNameFromText(clean), amount };
  if (CREDIT_WORDS.test(lower) && amount) return { intent: "udhaar", customerName: guessNameFromText(clean), amount, note: "" };

  // default: stock update
  let action = null;
  if (/आला|आली|आले|मिळाला|आणला|भरला|aaya|added/.test(lower)) action = "restock";
  else if (/विकला|विकली|विकले|गेला|गेली|दिला|sold|gaya|bika/.test(lower)) action = "sale";
  return {
    intent: "stock_update",
    itemName: clean.replace(/\d+(?:\.\d+)?/g, "").trim(),
    action,
    quantity: amount,
    unit: extractUnit(clean),
  };
}

// ════════════════════════════════════════════════════════════
// Executors
// ════════════════════════════════════════════════════════════
async function applyStockChange(item, change, meta = {}) {
  const before = item.quantity;
  const after = Math.max(0, before + change);
  item.quantity = after;
  await item.save();

  await SaleLog.create({
    itemId: item._id,
    itemName: item.name,
    action: change < 0 ? "sale" : "restock",
    quantityChanged: change,
    quantityBefore: before,
    quantityAfter: after,
    source: meta.source || "whatsapp",
    rawVoiceText: meta.rawVoiceText || "",
  });
  await checkLowStock(item);
  return { before, after };
}

async function applyCredit(customerName, type, amount, note, rawVoiceText) {
  let customer = await Customer.findOne({ name: new RegExp(`^${customerName.trim()}$`, "i"), isActive: true });
  if (!customer) {
    customer = new Customer({ name: customerName.trim() });
    await customer.save();
  }
  customer.balance = type === "udhaar" ? customer.balance + amount : customer.balance - amount;
  await customer.save();

  await CreditLog.create({
    customerId: customer._id,
    customerName: customer.name,
    type,
    amount,
    balanceAfter: customer.balance,
    note: note || "",
    source: "whatsapp",
    rawVoiceText: rawVoiceText || "",
  });
  return customer;
}

async function buildOrderDraft() {
  const forecast = await computeForecast();
  const toOrder = forecast.filter(f => f.shouldOrder && f.suggestedQty > 0);
  if (!toOrder.length) return null;

  const lines = toOrder.map(f => `• ${f.name} — ${f.suggestedQty} ${f.unit}`);
  const message =
    `🛒 *DukanAI — पुरवठादार ऑर्डर*\n` +
    `📅 ${new Date().toLocaleDateString("en-IN")}\n\n` +
    `${lines.join("\n")}\n\n` +
    `एकूण वस्तू: ${lines.length}\n` +
    `_DukanAI द्वारे तयार_`;
  return { message, items: toOrder };
}

async function buildSummary() {
  const items = await Item.find({ isActive: true });
  const customers = await Customer.find({ isActive: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLogs = await SaleLog.find({ createdAt: { $gte: today } });
  const todaySales = todayLogs.filter(l => l.action === "sale").reduce((s, l) => s + Math.abs(l.quantityChanged), 0);

  const lowStock = items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const outOfStock = items.filter(i => i.quantity === 0).length;
  const totalUdhaar = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);

  return (
    `📊 *DukanAI — आजचा हिशोब*\n\n` +
    `एकूण माल: ${items.length} वस्तू\n` +
    `आजची विक्री: ${todaySales} वस्तू\n` +
    `कमी साठा: ${lowStock} ⚠️\n` +
    `संपलेले: ${outOfStock} ❌\n` +
    `एकूण उधार: ₹${Math.round(totalUdhaar)} 💰\n\n` +
    `_ऑर्डर करण्यासाठी लिहा: "ऑर्डर कर"_`
  );
}

const HELP_TEXT =
  `🤖 *DukanAI बॉट*\n\nमी हे समजतो:\n` +
  `📦 साठा: "दहा किलो गहू आला" / "पाच मॅगी गेल्या"\n` +
  `💰 उधार: "शर्मा काकांनी 500 चा माल घेतला"\n` +
  `✅ जमा: "शर्मा काकांनी 200 पैसे दिले"\n` +
  `🛒 ऑर्डर: "ऑर्डर कर"\n` +
  `📊 हिशोब: "आजचा हिशोब सांग"\n\n` +
  `🎤 आवाजाचा मेसेज पण पाठवू शकता!`;

// ════════════════════════════════════════════════════════════
// Core handler — shared by the Twilio webhook and the simulator
// ════════════════════════════════════════════════════════════
export async function handleIncoming({ from, body, mediaUrl, mediaType }) {
  let text = (body || "").trim();

  try {
    // Voice note → transcription
    if (!text && mediaUrl && (mediaType || "").startsWith("audio/")) {
      text = await transcribeAudio(mediaUrl, mediaType);
    }
    if (!text) return { reply: HELP_TEXT };

    const conv = getConversation(from);

    // ─── 1. Awaiting a quantity answer ("किती प्रमाण?") ───
    if (conv?.pending?.type === "stock_qty") {
      const qty = extractNumber(text);
      if (qty !== null) {
        const { itemName, action, raw } = conv.pending.data;
        clearConversation(from);
        return await resolveStockUpdate(from, itemName, action, qty, raw);
      }
      clearConversation(from); // unclear — fall through to a fresh parse
    }

    // ─── 2. Awaiting an item choice (1/2/3) ───
    if (conv?.pending?.type === "choose_item") {
      const pick = text.match(/[1-4]/);
      const cand = pick ? conv.pending.data.candidates[parseInt(pick[0]) - 1] : null;
      if (cand) {
        const { action, quantity, raw } = conv.pending.data;
        clearConversation(from);
        return await resolveStockUpdate(from, cand.name, action, quantity, raw);
      }
      // not a number — treat as a fresh message
    }

    // ─── 2b. Awaiting a customer choice (1/2/3) ───
    if (conv?.pending?.type === "choose_customer") {
      const pick = text.match(/[1-4]/);
      const cand = pick ? conv.pending.data.candidates[parseInt(pick[0]) - 1] : null;
      if (cand) {
        const { parsed, raw } = conv.pending.data;
        clearConversation(from);
        const word = parsed.intent === "udhaar" ? "उधार" : "जमा";
        setConversation(from, { type: "confirm", data: { kind: parsed.intent, data: { customerName: cand.name, type: parsed.intent, amount: parsed.amount, note: parsed.note, raw } } });
        return { reply: `*${cand.name}* — ${word} *₹${parsed.amount}* नोंदवायचा? (हो / नाही)` };
      }
      // not a number — treat as a fresh message
    }

    // ─── 3. Awaiting yes/no confirmation (money & orders always confirm) ───
    if (conv?.pending?.type === "confirm") {
      const { kind, data } = conv.pending.data;
      if (YES_RE.test(text)) {
        clearConversation(from);
        if (kind === "udhaar" || kind === "payment") {
          const customer = await applyCredit(data.customerName, data.type, data.amount, data.note, data.raw);
          const word = data.type === "udhaar" ? "उधार" : "जमा";
          const balLine = customer.balance > 0
            ? `एकूण उधार: ₹${Math.round(customer.balance)}`
            : customer.balance < 0 ? `आडवणूक: ₹${Math.abs(Math.round(customer.balance))}` : "हिशोब पूर्ण बरोबर ✅";
          return { reply: `✅ *${customer.name}* — ${word} ₹${data.amount} नोंदवला\n${balLine}` };
        }
        if (kind === "order") {
          const to = process.env.SUPPLIER_WHATSAPP || process.env.OWNER_WHATSAPP;
          const result = await sendWhatsApp(data.message, to);
          return { reply: result.error ? `❌ ऑर्डर पाठवता आला नाही: ${result.error}` : "🛒 ऑर्डर पुरवठादाराला पाठवला!" };
        }
      }
      if (NO_RE.test(text)) {
        clearConversation(from);
        return { reply: "ठीक, रद्द केले." };
      }
      // neither yes nor no — fall through to a fresh parse
    }

    // ─── 4. Fresh message → intent ───
    // Reaching here with a pending state means the reply wasn't the expected
    // answer — the user moved on, so drop the stale pending (a later "हो"
    // must never execute a forgotten udhaar/order).
    if (conv) clearConversation(from);
    const parsed = await parseIntent(text);

    switch (parsed.intent) {
      case "stock_update":
        return await resolveStockUpdate(from, parsed.itemName, parsed.action, parsed.quantity, text, parsed.unit);

      case "udhaar":
      case "payment": {
        if (!parsed.amount) return { reply: "रक्कम समजली नाही. पुन्हा सांगा — उदा: *शर्मा काकांनी 500 चा माल घेतला*" };
        const type = parsed.intent;
        const name = parsed.customerName?.trim();
        if (!name) return { reply: "ग्राहकाचे नाव समजले नाही. नावासह पुन्हा पाठवा." };

        const customers = await Customer.find({ isActive: true });
        const { match, candidates } = findBestMatch(name, customers);
        if (candidates.length) {
          setConversation(from, { type: "choose_customer", data: { candidates, parsed, raw: text } });
          return { reply: `${match ? "" : "हा ग्राहक कोण?"}\n` + candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n") + "\nक्रमांक पाठवा." };
        }
        const who = match ? match.name : name;
        const word = type === "udhaar" ? "उधार" : "जमा";
        setConversation(from, { type: "confirm", data: { kind: type, data: { customerName: who, type, amount: parsed.amount, note: parsed.note, raw: text } } });
        return { reply: `*${who}* — ${word} *₹${parsed.amount}* नोंदवायचा? (हो / नाही)` };
      }

      case "order_request": {
        const draft = await buildOrderDraft();
        if (!draft) return { reply: "सध्या काही ऑर्डर करण्याची गरज नाही 👍" };
        setConversation(from, { type: "confirm", data: { kind: "order", data: { message: draft.message } } });
        return { reply: draft.message + "\n\n👉 पुरवठादाराला पाठवायचा? (हो / नाही)" };
      }

      case "summary":
        return { reply: await buildSummary() };

      default:
        return { reply: HELP_TEXT };
    }
  } catch (err) {
    console.error("Bot error:", err);
    return { reply: "माफ करा, काहीतरी चुकले. पुन्हा प्रयत्न करा." };
  }
}

// stock_update shared path (used directly + from pending answers)
async function resolveStockUpdate(from, itemName, action, quantity, rawText, unitHint) {
  const items = await Item.find({ isActive: true });
  const { match, candidates } = findBestMatch(itemName, items);

  if (candidates.length) {
    setConversation(from, { type: "choose_item", data: { candidates, action, quantity, raw: rawText } });
    return {
      reply: "कोणता माल?\n" +
        candidates.map((c, i) => `${i + 1}. ${c.name} (साठा: ${c.quantity}${c.unit})`).join("\n") +
        "\nक्रमांक पाठवा.",
    };
  }
  if (!match) {
    return { reply: `"${itemName || rawText}" हा माल यादीत नाही 🤔\nApp मध्ये जोडा किंवा यादीतल्या नावाने पाठवा.` };
  }
  if (quantity === undefined || quantity === null || isNaN(quantity)) {
    setConversation(from, { type: "stock_qty", data: { itemName: match.name, action: action || "restock", raw: rawText } });
    return { reply: `*${match.name}* किती प्रमाण? (उदा: 10 किलो)` };
  }

  const change = action === "sale" ? -Math.abs(quantity) : Math.abs(quantity);
  const { before, after } = await applyStockChange(match, change, { source: "whatsapp", rawVoiceText: rawText });
  const verb = action === "sale" ? "विकले" : "आले";
  return {
    reply:
      `✅ *${match.name}* — ${action === "sale" ? "" : "+"}${quantity} ${unitHint || match.unit} ${verb}\n` +
      `साठा: ${before} → *${after} ${match.unit}*`,
  };
}

// ════════════════════════════════════════════════════════════
// Twilio webhook — ack immediately, reply via REST (15s limit)
// ════════════════════════════════════════════════════════════
router.post("/", async (req, res) => {
  const from = req.body?.From;
  if (!from) return res.status(400).send("Missing From");

  res.status(200).send(""); // Twilio needs a fast 200

  try {
    const { reply } = await handleIncoming({
      from,
      body: req.body.Body,
      mediaUrl: req.body.MediaUrl0,
      mediaType: req.body.MediaContentType0,
    });
    await sendWhatsApp(reply, from);
  } catch (err) {
    console.error("Webhook error:", err);
  }
});

// ─── GET / — health/info ───────────────────────────────────
router.get("/", (req, res) => {
  res.json({
    status: "DukanAI WhatsApp bot webhook",
    setup: "Twilio sandbox → POST messages to /api/webhook",
    activeConversations: conversations.size,
  });
});

// ─── POST /simulate — test the bot without Twilio ──────────
router.post("/simulate", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: "मेसेज लिहा" });
    const { reply } = await handleIncoming({ from: "whatsapp:simulator", body: text });
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
