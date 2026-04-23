import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameHindi: { type: String, trim: true },         // Marathi name e.g. "गहू"
    category: { type: String, default: "सामान्य" },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "pcs" },
    buyPrice: { type: Number, default: 0 },
    sellPrice: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    imageUrl: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

itemSchema.virtual("profitPerUnit").get(function () {
  return this.sellPrice - this.buyPrice;
});

itemSchema.virtual("status").get(function () {
  if (this.quantity === 0) return "संपले";
  if (this.quantity <= this.lowStockThreshold) return "कमी";
  return "उपलब्ध";
});

export default mongoose.model("Item", itemSchema);
