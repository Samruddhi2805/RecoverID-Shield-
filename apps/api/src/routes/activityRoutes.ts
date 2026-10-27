import { Router, Request, Response } from "express";
import { ethers } from "ethers";
import { getActivities, addActivity } from "../db";

export const activityRouter = Router();

// GET /api/activity/:walletAddress
activityRouter.get("/:walletAddress", (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const activities = getActivities(walletAddress);
    return res.status(200).json({ walletAddress, activities });
  } catch (err: any) {
    return res.status(500).json({ error: "Error retrieving activity log" });
  }
});

// POST /api/activity (record on-chain event or action from frontend)
activityRouter.post("/", (req: Request, res: Response) => {
  try {
    const { wallet, type, title, description, actor, txHash, metadata } = req.body;
    if (!wallet || !ethers.isAddress(wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description required" });
    }

    const item = {
      id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      wallet: wallet.toLowerCase(),
      type: type || "TRANSACTION_SENT",
      title,
      description,
      actor: actor ? actor.toLowerCase() : wallet.toLowerCase(),
      txHash,
      metadata,
      timestamp: Date.now()
    };

    addActivity(item);
    return res.status(201).json({ success: true, activity: item });
  } catch (err: any) {
    return res.status(500).json({ error: "Error recording activity" });
  }
});
