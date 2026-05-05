import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Item from "../models/Item.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Number word → digit ─────────────────────────────────
function extractNumber(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  const digit = t.match(/(\d+(?:\.\d+)?)/);
  if (digit) return parseFloat(digit[1]);

  const map = {
    "एक":1,"दोन":2,"तीन":3,"चार":4,"पाच":5,"सहा":6,"सात":7,"आठ":8,"नऊ":9,"दहा":10,
    "अकरा":11,"बारा":12,"तेरा":13,"चौदा":14,"पंधरा":15,"सोळा":16,"सतरा":17,"अठरा":18,"एकोणीस":19,
    "वीस":20,"एकवीस":21,"बावीस":22,"तेवीस":23,"चोवीस":24,"पंचवीस":25,
    "तीस":30,"पस्तीस":35,"चाळीस":40,"पंचेचाळीस":45,"पन्नास":50,
    "साठ":60,"सत्तर":70,"ऐंशी":80,"नव्वद":90,
    "शंभर":100,"दीडशे":150,"दोनशे":200,"अडीचशे":250,"तीनशे":300,
    "चारशे":400,"पाचशे":500,"हजार":1000,
    // Hindi
    "ek":1,"do":2,"teen":3,"char":4,"paanch":5,"das":10,
    "bis":20,"pachas":50,"sau":100,"ek sau":100,
  };
  for (const [w, n] of Object.entries(map)) {
    if (t.includes(w)) return n;
  }
  return null;
}

// ─── Unit word → standard ────────────────────────────────
function extractUnit(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const units = [
    [["किलो","किलोग्राम"," kg ","kilo","kgs"], "kg"],
    [["लिटर","लीटर","litre","liter"," l ","ltr"], "litre"],
    [["पॅकेट","पैकेट","packet","pack","पैक","पाकीट"], "packet"],
    [["ग्राम","gram"," gm "," g ","grm"], "gram"],
    [["डझन","दर्जन","dozen","doz"], "dozen"],
    [["बॉटल","बोतल","bottle","बाटली"], "bottle"],
    [["पीस","नग","piece","pcs"," pc "], "pcs"],
  ];
  for (const [triggers, unit] of units) {
    if (triggers.some(t2 => t.includes(t2))) return unit;
  }
  return null;
}

// ─── Category auto-detect ────────────────────────────────
function guessCategory(name, nameHindi) {
  const t = (name + " " + (nameHindi || "")).toLowerCase();
  if (/गहू|wheat|तांदूळ|rice|ज्वारी|बाजरी|मका|corn|atta|आटा|मैदा|maida|रवा|suji/.test(t)) return "धान्य";
  if (/तेल|oil|घी|ghee/.test(t)) return "तेल";
  if (/हळद|turmeric|मिरची|chilli|जिरे|cumin|धने|coriander|मसाला|masala|गरम/.test(t)) return "मसाले";
  if (/डाळ|dal|चणा|chana|मूग|moong|उडीद|urad|तूर|toor/.test(t)) return "डाळी";
  if (/चहा|tea|कॉफी|coffee|juice|शरबत|cold drink|pepsi|cola/.test(t)) return "पेय";
  if (/maggi|मॅगी|बिस्किट|biscuit|chips|नमकीन|namkeen|snack/.test(t)) return "नाश्ता";
  if (/दूध|milk|दही|curd|ताक|butter|लोणी|cream/.test(t)) return "दुग्धजन्य";
  if (/साबण|soap|शॅम्पू|shampoo|तेल hair|oil hair|detergent|surf/.test(t)) return "साबण/तेल";
  return "सामान्य";
}

// ─── Smart fuzzy match ───────────────────────────────────
function findBestMatch(guess, items) {
  if (!guess || !items.length) return { match: null, candidates: [] };
  const g = guess.toLowerCase().trim();

  // Exact
  let m = items.find(i => i.name.toLowerCase() === g || (i.nameHindi && i.nameHindi.toLowerCase() === g));
  if (m) return { match: m, candidates: [] };

  // Substring both ways
  m = items.find(i =>
    i.name.toLowerCase().includes(g) || g.includes(i.name.toLowerCase()) ||
    (i.nameHindi && (i.nameHindi.toLowerCase().includes(g) || g.includes(i.nameHindi.toLowerCase())))
  );
  if (m) return { match: m, candidates: [] };

  // Word overlap scoring
  const gWords = g.split(/\s+/).filter(w => w.length > 1);
  const scored = items.map(item => {
    const iWords = [
      ...item.name.toLowerCase().split(/\s+/),
      ...(item.nameHindi ? item.nameHindi.toLowerCase().split(/\s+/) : [])
    ].filter(w => w.length > 1);
    const score = gWords.filter(gw => iWords.some(iw => iw.includes(gw) || gw.includes(iw))).length;
    return { item, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 1) return { match: scored[0].item, candidates: [] };
  if (scored.length > 1 && scored[0].score > scored[1].score) return { match: scored[0].item, candidates: [] };
  if (scored.length > 1) return { match: null, candidates: scored.slice(0, 4).map(s => s.item) };

  return { match: null, candidates: [] };
}

// ════════════════════════════════════════════════════════════
// POST /api/voice/parse — stock update (existing items)
// ════════════════════════════════════════════════════════════
router.post("/parse", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: "काहीतरी बोला" });

    const clean = text.trim();
    const allItems = await Item.find({ isActive: true }, "name nameHindi unit quantity");
    const itemList = allItems.map(i =>
      `"${i.name}"${i.nameHindi ? `/"${i.nameHindi}"` : ""} (${i.quantity}${i.unit})`
    ).join(", ");

    let parsed = null;
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const result = await model.generateContent(`
You are a Marathi kirana shop inventory assistant. The shop owner spoke:
"${clean}"

Shop items: ${itemList || "empty"}

Speech patterns (LEARN THESE):
• "दहा किलो गहू आला" → restock, Wheat, 10, kg
• "पाच मॅगी गेल्या" → sale, Maggi, 5, pcs  
• "तांदूळ वीस किलो आणला" → restock, Rice, 20, kg
• "साखर दोन किलो विकली" → sale, Sugar, 2, kg
• "तीन बिस्किट पॅकेट दिले" → sale, Biscuit, 3, packet
• "atta pachas kilo aaya" → restock, Atta, 50, kg
• "fifty maggi sold" → sale, Maggi, 50, pcs

Action words:
• RESTOCK: आला/आली/आले/मिळाला/आणला/आणले/भरला/stock/added/aaya/aaye/laya
• SALE: विकला/विकली/विकले/गेला/गेली/गेले/दिला/दिले/sold/gaya/gayi/bika/biki/nikhala

Return ONLY valid JSON:
{
  "action": "sale" or "restock" or "manual_update",
  "itemName": "best matching item name from shop list above",
  "quantity": number or null,
  "unit": "kg" or "litre" or "packet" or "pcs" or "bottle" or "dozen" or "gram" or null,
  "confidence": "high" or "medium" or "low",
  "needsClarification": true or false,
  "clarificationQuestion": "Marathi question if unclear else null",
  "marathiSummary": "1 line Marathi summary of what you understood"
}`);

      const txt = result.response.text().trim();
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (e) { console.log("AI fail:", e.message); }

    // Local fallback
    if (!parsed) {
      const lower = clean.toLowerCase();
      let action = "manual_update";
      if (/आला|आली|आले|मिळाला|आणला|भरला|aaya|added/.test(lower)) action = "restock";
      else if (/विकला|विकली|विकले|गेला|गेली|दिला|sold|gaya|bika/.test(lower)) action = "sale";
      parsed = { action, itemName: clean, quantity: extractNumber(clean), unit: extractUnit(clean) || "pcs", confidence: "low", needsClarification: !extractNumber(clean), clarificationQuestion: "किती प्रमाण?", marathiSummary: "local parse" };
    }

    // Fill missing from local parser
    if (!parsed.unit) parsed.unit = extractUnit(clean) || "pcs";
    if (!parsed.quantity) parsed.quantity = extractNumber(clean);

    const { match, candidates } = findBestMatch(parsed.itemName, allItems);

    res.json({
      success: true,
      parsed: { ...parsed, needsClarification: !parsed.quantity || (!match && !candidates.length) },
      matchedItem: match || null,
      candidates,
      rawText: clean,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ════════════════════════════════════════════════════════════
// POST /api/voice/understand-item
// The KEY new endpoint — understands ANY free-form voice about a NEW item
// Returns whatever it understood + exactly what's still missing
// ════════════════════════════════════════════════════════════
router.post("/understand-item", async (req, res) => {
  try {
    const { text, currentData = {} } = req.body;
    // currentData = what we already collected in previous turns

    if (!text?.trim()) return res.status(400).json({ success: false, message: "काहीतरी बोला" });

    const clean = text.trim();
    const existing = await Item.find({ isActive: true }, "name nameHindi").limit(100);
    const existingNames = existing.map(i => i.name).join(", ");

    // Build context of what we already know
    const alreadyKnow = Object.entries(currentData)
      .filter(([k, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    let understood = null;
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const result = await model.generateContent(`
You are helping add a NEW item to a Marathi kirana shop inventory.

What we already know about this item: ${alreadyKnow || "nothing yet"}
Existing items (for reference): ${existingNames || "none"}

The shop owner just said: "${clean}"

Extract ONLY what this sentence tells us. Do NOT guess or fill in values not mentioned.

Common patterns:
• "गहू" / "wheat" → name only
• "पन्नास किलो" / "50 kg" → quantity + unit only  
• "चाळीस रुपये" / "40 rupees" → price (if no context = sellPrice)
• "खरेदी चाळीस विक्री पन्नास" / "buy 40 sell 50" → buyPrice=40, sellPrice=50
• "गहू पन्नास किलो" → name + quantity + unit
• "गहू पन्नास किलो चाळीस रुपये" → name + qty + unit + price
• "धान्य category" / "धान्य मध्ये टाका" → category only
• "हो" / "yes" / "बरोबर" → confirmation (no new data)
• "नाही" / "no" → rejection
• English + Marathi mix is totally fine

For names: use English for "name" field, Devanagari for "nameHindi"
For category pick from: धान्य, तेल, मसाले, डाळी, पेय, नाश्ता, दुग्धजन्य, साबण/तेल, सामान्य
For unit pick from: kg, litre, packet, pcs, bottle, dozen, gram

Return ONLY this JSON (null = not mentioned in this sentence):
{
  "name": "English name" or null,
  "nameHindi": "मराठी नाव" or null,
  "category": "category" or null,
  "quantity": number or null,
  "unit": "unit" or null,
  "buyPrice": number or null,
  "sellPrice": number or null,
  "lowStockThreshold": number or null,
  "isConfirmation": true or false,
  "isRejection": true or false,
  "understood": "1 line Marathi: what did you extract from this sentence"
}`);

      const txt = result.response.text().trim();
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) understood = JSON.parse(m[0]);
    } catch (e) { console.log("AI understand fail:", e.message); }

    // Local fallback for understand
    if (!understood) {
      understood = {
        name: null, nameHindi: null, category: null,
        quantity: extractNumber(clean),
        unit: extractUnit(clean),
        buyPrice: null, sellPrice: null,
        lowStockThreshold: null,
        isConfirmation: /हो|yes|हाँ|बरोबर|correct|ok/.test(clean.toLowerCase()),
        isRejection: /नाही|no|नको|wrong/.test(clean.toLowerCase()),
        understood: "local parse",
      };
      // Try name from text if nothing else
      if (!understood.quantity && !understood.unit) understood.name = clean;
    }

    // Merge with existing data (new data overrides, nulls don't override)
    const merged = { ...currentData };
    for (const [key, val] of Object.entries(understood)) {
      if (val !== null && val !== undefined && !["isConfirmation","isRejection","understood"].includes(key)) {
        merged[key] = val;
      }
    }

    // Auto-detect category if name is now known but category isn't
    if (merged.name && !merged.category) {
      merged.category = guessCategory(merged.name, merged.nameHindi);
    }

    // Auto-detect nameHindi if we know the English name
    // (AI already does this but as backup)

    // Figure out what's still missing (required fields)
    const missing = [];
    if (!merged.name) missing.push("name");
    if (!merged.quantity) missing.push("quantity");
    if (!merged.unit) missing.push("unit");
    // sellPrice is important but optional — warn if missing

    // Build next question in Marathi
    const QUESTIONS = {
      name:     "मालाचे नाव काय आहे? (English किंवा मराठी मध्ये सांगा)",
      quantity: `${merged.name || "मालाचे"} किती प्रमाण आहे? (उदा: पन्नास किलो, शंभर पॅकेट)`,
      unit:     `एकक काय आहे? (किलो / लिटर / पॅकेट / पीस / बॉटल)`,
    };

    const nextQuestion = missing.length > 0 ? QUESTIONS[missing[0]] : null;
    const isComplete = missing.length === 0;

    res.json({
      success: true,
      extractedFromThisTurn: understood,
      mergedData: merged,
      missing,
      isComplete,
      nextQuestion,       // Ask this next
      rawText: clean,
    });

  } catch (err) {
    console.error("understand-item error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;