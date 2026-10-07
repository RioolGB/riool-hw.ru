import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

import { initDb } from "./db";
import { requestLogger, errorHandler, notFoundHandler } from "./middleware/middleware";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import cycleRoutes from "./routes/cycle";
import articleRoutes from "./routes/articles";
import notificationRoutes from "./routes/notifications";
import adminRoutes from "./routes/admin";
import { startReminderJob } from "./jobs/emailReminder";

const app = express();
const PORT = Number(process.env.PORT || 3000);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

/* Ensure folders */
const logsDir = path.join(__dirname, "..", "logs");
const uploadsDir = path.join(__dirname, "..", "..", "uploads");
fs.mkdirSync(logsDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

initDb();

app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.use(requestLogger());

app.use("/uploads", express.static(uploadsDir, { maxAge: "7d" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api/cycle", cycleRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

/* Serve built frontend if present (production) */
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(notFoundHandler());
app.use(errorHandler());

startReminderJob();

app.listen(PORT, () => {
  console.log(`[server] CycleTracker API запущен на http://localhost:${PORT}`);
  const adminPort = fs.existsSync(frontendDist) ? PORT : 5173;
  console.log(`[server] Админка: http://localhost:${adminPort}/admin`);
});