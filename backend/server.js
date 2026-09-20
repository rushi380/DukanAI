import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import itemRoutes from "./routes/items.js";
import voiceRoutes from "./routes/voice.js";
import billRoutes from "./routes/bill.js";
import alertRoutes from "./routes/alerts.js";
import creditRoutes from "./routes/credit.js";
import forecastRoutes from "./routes/forecast.js";
import webhookRoutes from "./routes/webhook.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Twilio webhook posts form-encoded

// Routes (with /api prefix for local dev)
app.use("/api/items", itemRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/bill", billRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/credit", creditRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/webhook", webhookRoutes);

// Routes (without /api prefix for Vercel experimentalServices routing)
app.use("/items", itemRoutes);
app.use("/voice", voiceRoutes);
app.use("/bill", billRoutes);
app.use("/alerts", alertRoutes);
app.use("/credit", creditRoutes);
app.use("/forecast", forecastRoutes);
app.use("/webhook", webhookRoutes);

// Health check
app.get(["/", "/api"], (req, res) => res.json({ status: "DukanAI backend running" }));

// Connect DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    if (process.env.NODE_ENV !== "production") {
      app.listen(process.env.PORT || 5000, () =>
        console.log(`Server running on port ${process.env.PORT || 5000}`)
      );  
    }
  })
  .catch((err) => console.error("DB connection failed:", err));
  
export default app;