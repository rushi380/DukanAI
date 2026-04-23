import express from "express";
import Item from "../models/Item.js";
import SaleLog from "../models/SaleLog.js";
import { checkLowStock } from "../services/whatsapp.js";

const router = express.Router();

// 📦 GET all items
router.get("/", async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { nameHindi: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const items = await Item.find(query).sort({ updatedAt: -1 });

    let result = items;
    if (status === "कमी आहे") result = items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold);
    if (status === "संपला") result = items.filter(i => i.quantity === 0);
    if (status === "उपलब्ध") result = items.filter(i => i.quantity > i.lowStockThreshold);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 📊 GET dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const items = await Item.find({ isActive: true });

    const total = items.length;
    const inStock = items.filter(i => i.quantity > i.lowStockThreshold).length;
    const lowStock = items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
    const outOfStock = items.filter(i => i.quantity === 0).length;
    const totalValue = items.reduce((sum, i) => sum + i.quantity * i.sellPrice, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = await SaleLog.find({ createdAt: { $gte: today } });
    const todaySales = todayLogs
      .filter(l => l.action === "sale")
      .reduce((sum, l) => sum + Math.abs(l.quantityChanged), 0);

    res.json({ success: true, data: { total, inStock, lowStock, outOfStock, totalValue, todaySales } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ➕ POST add new item
router.post("/", async (req, res) => {
  try {
    // ✅ Basic validation
    if (!req.body.name || req.body.name.trim().length < 1) {
      return res.status(400).json({ success: false, message: "मालाचे नाव आवश्यक आहे" });
    }
    if (req.body.quantity === undefined || isNaN(req.body.quantity)) {
      return res.status(400).json({ success: false, message: "प्रमाण आवश्यक आहे" });
    }

    const item = new Item(req.body);
    await item.save();

    res.status(201).json({ success: true, message: "नवीन माल जोडला", data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ✏️ PUT update item
router.put("/:id", async (req, res) => {
  try {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

    if (!item) return res.status(404).json({ success: false, message: "माल सापडला नाही" });

    res.json({ success: true, message: "माल अपडेट झाला", data: item });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 🔄 PATCH update stock + log
router.patch("/:id/stock", async (req, res) => {
  try {
    const { quantityChanged, action, source, rawVoiceText, note } = req.body;

    // ✅ FIX: Validate quantityChanged — this was missing before!
    if (quantityChanged === undefined || quantityChanged === null || isNaN(quantityChanged)) {
      return res.status(400).json({ success: false, message: "quantityChanged आवश्यक आहे" });
    }

    const change = parseFloat(quantityChanged);

    // Prevent absurd values (no one sells 99999 items at once)
    if (Math.abs(change) > 99999) {
      return res.status(400).json({ success: false, message: "प्रमाण खूप जास्त आहे" });
    }

    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "माल सापडला नाही" });

    const before = item.quantity;
    const after = Math.max(0, before + change); // never go below 0

    item.quantity = after;
    await item.save();

    // Log the change
    await SaleLog.create({
      itemId: item._id,
      itemName: item.name,
      action: action || (change < 0 ? "sale" : "restock"),
      quantityChanged: change,
      quantityBefore: before,
      quantityAfter: after,
      source: source || "manual",
      rawVoiceText: rawVoiceText || "",
      note: note || "",
    });

    // WhatsApp alert if low/out
    await checkLowStock(item);

    res.json({ success: true, message: "साठा अपडेट झाला", data: item, before, after });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ❌ DELETE (soft delete)
router.delete("/:id", async (req, res) => {
  try {
    await Item.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: "माल हटवला" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 📜 GET recent logs
router.get("/logs/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const logs = await SaleLog.find().sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;