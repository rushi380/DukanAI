import express from "express";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// ✅ FIX: Key from env, updated model
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("फक्त इमेज फाइल पाठवा"));
  },
});

// POST /api/bill/scan
router.post("/scan", upload.single("bill"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "बिलाचा फोटो आवश्यक आहे" });
    }

    const imageData = fs.readFileSync(req.file.path);
    const base64 = imageData.toString("base64");
    const mimeType = req.file.mimetype;

    // ✅ FIX: Use gemini-1.5-flash (gemini-pro-vision is deprecated)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `This is a bill/invoice from an Indian supplier or kirana shop.
Extract all items and their quantities from this bill.

Return ONLY a JSON array like this:
[
  { "name": "item name in English", "nameHindi": "मराठी/Hindi name if visible", "quantity": number, "unit": "kg/litre/pcs/packet/dozen/gram", "buyPrice": number_or_null },
  ...
]

Rules:
- Use the item name exactly as written on the bill
- If Hindi/Marathi name is visible, include it in nameHindi
- If price per unit is shown, put it in buyPrice, otherwise null
- If unit is not clear, use "pcs"
- quantity should be a number only
- Return ONLY the JSON array, nothing else, no explanation`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType } },
    ]);

    // Cleanup temp file
    fs.unlinkSync(req.file.path);

    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return res.status(422).json({
        success: false,
        message: "बिल वाचता आले नाही. स्पष्ट फोटो पाठवा."
      });
    }

    const items = JSON.parse(jsonMatch[0]);

    res.json({
      success: true,
      data: items,
      count: items.length,
      message: `${items.length} वस्तू सापडल्या`
    });

  } catch (err) {
    // Cleanup on error
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error("Bill scan error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;