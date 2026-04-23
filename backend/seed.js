import mongoose from "mongoose";
import dotenv from "dotenv";
import Item from "./models/Item.js";
dotenv.config();

const sampleItems = [
  { name: "Gehun Peeth", nameHindi: "गव्हाचे पीठ", category: "धान्य",   quantity: 50, unit: "kg",     buyPrice: 38,  sellPrice: 45,  lowStockThreshold: 10 },
  { name: "Tandul",      nameHindi: "तांदूळ",       category: "धान्य",   quantity: 40, unit: "kg",     buyPrice: 55,  sellPrice: 65,  lowStockThreshold: 10 },
  { name: "Tur Dal",     nameHindi: "तूर डाळ",      category: "डाळी",    quantity: 8,  unit: "kg",     buyPrice: 100, sellPrice: 120, lowStockThreshold: 10 },
  { name: "Shengdana Tel",nameHindi: "शेंगदाणा तेल",category: "तेल",     quantity: 0,  unit: "litre",  buyPrice: 150, sellPrice: 175, lowStockThreshold: 5  },
  { name: "Maggi",       nameHindi: "मॅगी",          category: "नाश्ता",  quantity: 45, unit: "packet", buyPrice: 12,  sellPrice: 14,  lowStockThreshold: 20 },
  { name: "Meeth",       nameHindi: "मीठ",           category: "मसाले",   quantity: 5,  unit: "kg",     buyPrice: 18,  sellPrice: 22,  lowStockThreshold: 8  },
  { name: "Halad",       nameHindi: "हळद",           category: "मसाले",   quantity: 3,  unit: "kg",     buyPrice: 80,  sellPrice: 100, lowStockThreshold: 5  },
  { name: "Sakhar",      nameHindi: "साखर",          category: "धान्य",   quantity: 25, unit: "kg",     buyPrice: 42,  sellPrice: 50,  lowStockThreshold: 10 },
  { name: "Chaha Patti", nameHindi: "चहा पत्ती",    category: "पेय",     quantity: 12, unit: "packet", buyPrice: 85,  sellPrice: 100, lowStockThreshold: 5  },
  { name: "Parle G",     nameHindi: "पार्ले जी",     category: "नाश्ता",  quantity: 60, unit: "packet", buyPrice: 5,   sellPrice: 6,   lowStockThreshold: 20 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await Item.deleteMany({});
  await Item.insertMany(sampleItems);
  console.log("✅ Demo माल जोडला! 10 वस्तू तयार आहेत.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
