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

// --- MongoDB connection (serverless-friendly: cached across warm invocations) ---
const READY_STATE = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
  99: "uninitialized",
};

function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!globalThis.__dukanaiMongoosePromise) {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error(
        "MONGO_URI is not set. On Vercel add it under Settings → Environment Variables, then redeploy."
      );
      return Promise.resolve(null);
    }
    globalThis.__dukanaiMongoosePromise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 8000 })
      .then(() => {
        console.log("MongoDB connected");
        return mongoose.connection;
      })
      .catch((err) => {
        console.error("DB connection failed:", err.message);
        // Clear the cached promise so the next invocation can retry
        globalThis.__dukanaiMongoosePromise = null;
        return null;
      });
  }
  return globalThis.__dukanaiMongoosePromise;
}
connectDB();

// Fail fast with an actionable message instead of a silent 10s mongoose buffering hang
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/api") return next(); // health check always answers
  if (mongoose.connection.readyState === 0) {
    return res.status(503).json({
      success: false,
      message:
        "Database not connected. Set MONGO_URI in Vercel → Settings → Environment Variables, allow 0.0.0.0/0 in MongoDB Atlas → Network Access, then redeploy.",
    });
  }
  next();
});

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

// Health check — reports DB state so deployment issues are visible from the browser
app.get(["/", "/api"], (req, res) =>
  res.json({
    status: "DukanAI backend running",
    db: READY_STATE[mongoose.connection.readyState] || "unknown",
    env: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
  })
);

// JSON 404 for unknown routes
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.originalUrl}` })
);

// JSON error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ success: false, message: err.message });
});

// Local dev server (Vercel serverless handles production invocations)
if (process.env.NODE_ENV !== "production") {
  app.listen(process.env.PORT || 5000, () =>
    console.log(`Server running on port ${process.env.PORT || 5000}`)
  );
}

export default app;
