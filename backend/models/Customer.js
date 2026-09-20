import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },    // optional WhatsApp number for reminders
    balance: { type: Number, default: 0 },   // +ve = customer owes the shop (उधार)
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.virtual("status").get(function () {
  if (this.balance > 0) return "उधार बाकी";
  if (this.balance < 0) return "आडवणूक";  // paid in advance
  return "हिशोब बरोबर";
});

export default mongoose.model("Customer", customerSchema);
