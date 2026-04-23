import mongoose from "mongoose";

const saleLogSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
    itemName: { type: String, required: true },
    action: {
      type: String,
      enum: ["sale", "restock", "manual_update", "bill_scan"],
      required: true,
    },
    quantityChanged: { type: Number, required: true }, // negative = sold, positive = added
    quantityBefore: { type: Number, required: true },
    quantityAfter: { type: Number, required: true },
    source: { type: String, enum: ["voice", "manual", "bill", "whatsapp"], default: "manual" },
    rawVoiceText: { type: String, default: "" },       // original Hindi spoken text
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("SaleLog", saleLogSchema);
