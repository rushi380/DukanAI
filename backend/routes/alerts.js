import express from "express";
import Item from "../models/Item.js";
import { sendWhatsApp, sendDailySummary } from "../services/whatsapp.js";

const router = express.Router();

// 📦 GET — कमी / संपलेला साठा
router.get("/", async (req, res) => {
  try {
    const items = await Item.find({ isActive: true });

    const alerts = items
      .filter(i => i.quantity <= i.lowStockThreshold)
      .map(i => ({
        _id: i._id,
        name: i.name,
        nameHindi: i.nameHindi,
        quantity: i.quantity,
        unit: i.unit,
        lowStockThreshold: i.lowStockThreshold,

        // ✅ Marathi status
        status:
          i.quantity === 0
            ? "संपला"        // Out of stock
            : "कमी आहे",     // Low stock
      }))
      .sort((a, b) => a.quantity - b.quantity);

    res.json({
      success: true,
      message: "कमी आणि संपलेला साठा",
      data: alerts,
      count: alerts.length,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "सर्व्हर एरर",
      error: err.message
    });
  }
});

// 📊 POST — WhatsApp daily summary
router.post("/daily-summary", async (req, res) => {
  try {
    const items = await Item.find({ isActive: true });

    const stats = {
      total: items.length,
      inStock: items.filter(i => i.quantity > i.lowStockThreshold).length,
      lowStock: items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length,
      outOfStock: items.filter(i => i.quantity === 0).length,
      todaySales: req.body.todaySales || 0,
    };

    const result = await sendDailySummary(stats);

    res.json({
      success: true,
      message: "दैनिक सारांश WhatsApp वर पाठवला",
      result,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "सारांश पाठवताना त्रुटी आली",
      error: err.message
    });
  }
});

// 💬 POST — custom WhatsApp message
router.post("/send", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "मेसेज आवश्यक आहे"
      });
    }

    const result = await sendWhatsApp(message);

    res.json({
      success: true,
      message: "मेसेज यशस्वीरित्या पाठवला",
      result,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "मेसेज पाठवताना त्रुटी आली",
      error: err.message
    });
  }
});

export default router;