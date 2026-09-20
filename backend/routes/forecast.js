import express from "express";
import Item from "../models/Item.js";
import SaleLog from "../models/SaleLog.js";
import { sendWhatsApp } from "../services/whatsapp.js";

const router = express.Router();

// ─── Compute per-item consumption velocity & stock-out forecast ───
// velocity = units sold per day over the trailing window (default 14 days)
export async function computeForecast(horizonDays = 14) {
  const items = await Item.find({ isActive: true });
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const logs = await SaleLog.find({ createdAt: { $gte: since }, action: "sale" });

  // total units sold per item over the window
  const soldByItem = {};
  for (const log of logs) {
    const key = String(log.itemId);
    soldByItem[key] = (soldByItem[key] || 0) + Math.abs(log.quantityChanged);
  }

  const forecast = items.map(item => {
    const sold14 = soldByItem[String(item._id)] || 0;
    const velocity = sold14 / 14;                                  // units/day
    const daysLeft = velocity > 0 ? item.quantity / velocity : null;

    // order enough to cover the horizon + keep a threshold buffer
    const reorderQty = velocity > 0
      ? Math.ceil(velocity * horizonDays + item.lowStockThreshold - item.quantity)
      : item.quantity <= 0 ? item.lowStockThreshold : 0;

    let risk = "ठीक";
    if (velocity > 0 && daysLeft <= 3) risk = "आज-उद्या संपेल";
    else if (velocity > 0 && daysLeft <= 7) risk = "लवकर संपेल";
    else if (item.quantity <= 0) risk = "संपले";
    else if (item.quantity <= item.lowStockThreshold) risk = "कमी आहे";

    return {
      _id: item._id,
      name: item.name,
      nameHindi: item.nameHindi,
      unit: item.unit,
      quantity: item.quantity,
      lowStockThreshold: item.lowStockThreshold,
      soldLast14Days: sold14,
      velocityPerDay: Math.round(velocity * 100) / 100,
      daysLeft: daysLeft === null ? null : Math.max(0, Math.round(daysLeft * 10) / 10),
      suggestedQty: reorderQty > 0 ? reorderQty : 0,
      risk,
      shouldOrder: (velocity > 0 && daysLeft <= 7) || item.quantity <= item.lowStockThreshold,
    };
  });

  // most urgent first; items with no velocity sink to the bottom
  forecast.sort((a, b) => {
    if (a.daysLeft === null && b.daysLeft === null) return a.quantity - b.quantity;
    if (a.daysLeft === null) return 1;
    if (b.daysLeft === null) return -1;
    return a.daysLeft - b.daysLeft;
  });

  return forecast;
}

// ─── GET / — full forecast list ────────────────────────────
router.get("/", async (req, res) => {
  try {
    const forecast = await computeForecast();
    const toOrder = forecast.filter(f => f.shouldOrder);
    res.json({
      success: true,
      data: forecast,
      stats: {
        toOrderCount: toOrder.length,
        urgentCount: forecast.filter(f => f.risk === "आज-उद्या संपेल" || f.risk === "संपले").length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /draft — build a supplier order message ──────────
// body: { itemIds?: [], horizonDays?: 14 }  — no itemIds = auto-pick urgent items
router.post("/draft", async (req, res) => {
  try {
    const horizonDays = Math.min(60, parseInt(req.body.horizonDays) || 14);
    let forecast = await computeForecast(horizonDays);

    if (req.body.itemIds?.length) {
      const wanted = new Set(req.body.itemIds.map(String));
      forecast = forecast.filter(f => wanted.has(String(f._id)));
    } else {
      forecast = forecast.filter(f => f.shouldOrder && f.suggestedQty > 0);
    }

    const lines = forecast
      .filter(f => f.suggestedQty > 0)
      .map(f => `• ${f.name} — ${f.suggestedQty} ${f.unit}`);

    if (!lines.length) {
      return res.json({ success: true, message: "सध्या काही ऑर्डर करण्याची गरज नाही 👍", items: [], orderMessage: null });
    }

    const orderMessage =
      `🛒 *DukanAI — पुरवठादार ऑर्डर*\n` +
      `📅 ${new Date().toLocaleDateString("en-IN")}\n\n` +
      `${lines.join("\n")}\n\n` +
      `एकूण वस्तू: ${lines.length}\n` +
      `_DukanAI द्वारे तयार_`;

    res.json({ success: true, items: forecast.filter(f => f.suggestedQty > 0), orderMessage, horizonDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /send — send order message to supplier on WhatsApp ───
// body: { message, supplierNumber? } — supplierNumber like "919876543210"
router.post("/send", async (req, res) => {
  try {
    const { message, supplierNumber } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: "ऑर्डर मेसेज आवश्यक" });

    const to = supplierNumber
      ? `whatsapp:${supplierNumber}`
      : process.env.SUPPLIER_WHATSAPP || process.env.OWNER_WHATSAPP;

    const result = await sendWhatsApp(message, to);
    res.json({
      success: true,
      message: result.simulated
        ? "ऑर्डर तयार आहे (Twilio सेट नाही — simulation)"
        : "ऑर्डर WhatsApp वर पाठवला!",
      result,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
