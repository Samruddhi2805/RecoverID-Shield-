import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { initDatabase } from "./db";
import { guardianRouter } from "./routes/guardianRoutes";
import { activityRouter } from "./routes/activityRoutes";
import { notificationRouter } from "./routes/notificationRoutes";
import { chainMonitor } from "./services/chainService";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const app = express();
const PORT = process.env.PORT || 4000;

// Security & Middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "1mb" }));

// Rate limiter
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 mins
  max: parseInt(process.env.RATE_LIMIT_MAX || "200", 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Please try again later." }
});
app.use("/api", limiter);

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "RecoverID Shield API",
    version: "1.0.0",
    network: {
      chainId: process.env.CHAIN_ID || "31337",
      rpcUrl: process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545"
    },
    timestamp: new Date().toISOString()
  });
});

// Chain state view route
app.get("/api/wallet-state/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const moduleAddress = req.query.module as string | undefined;
    const state = await chainMonitor.getWalletState(address, moduleAddress);
    return res.status(200).json({ success: true, state });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Failed to query wallet state" });
  }
});

// Mount Routes
app.use("/api/guardians", guardianRouter);
app.use("/api/activity", activityRouter);
app.use("/api/notifications", notificationRouter);

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server if executed directly
if (process.env.NODE_ENV !== "test") {
  initDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`RecoverID Shield API running on http://localhost:${PORT}`);
        console.log(`Database connected & initialized with SQLite`);
      });
    })
    .catch((err) => {
      console.error("Failed to start API server:", err);
      process.exit(1);
    });
}
