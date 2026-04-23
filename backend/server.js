import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import itemRoutes from "./routes/items.js";
import voiceRoutes from "./routes/voice.js";
import billRoutes from "./routes/bill.js";
import alertRoutes from "./routes/alerts.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/items", itemRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/bill", billRoutes);
app.use("/api/alerts", alertRoutes);

// Health check
app.get("/", (req, res) => res.json({ status: "DukanAI backend running" }));

// Connect DB + start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );  
  })
  .catch((err) => console.error("DB connection failed:", err));
  