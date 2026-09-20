import mongoose from "mongoose";

const creditLogSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerName: { type: String, required: true },
    type: { type: String, enum: ["udhaar", "payment"], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, default: 0 },
    note: { type: String, default: "" },
    source: { type: String, default: "manual" },   // manual | voice | whatsapp
    rawVoiceText: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("CreditLog", creditLogSchema);
