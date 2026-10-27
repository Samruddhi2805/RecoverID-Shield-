import { Router, Request, Response } from "express";
import { getMockEmails, clearMockEmails } from "../db";

export const notificationRouter = Router();

// GET /api/notifications/mock-inbox
notificationRouter.get("/mock-inbox", (_req: Request, res: Response) => {
  try {
    const emails = getMockEmails();
    return res.status(200).json({
      success: true,
      count: emails.length,
      emails
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to retrieve mock inbox" });
  }
});

// DELETE /api/notifications/mock-inbox
notificationRouter.delete("/mock-inbox", (_req: Request, res: Response) => {
  try {
    clearMockEmails();
    return res.status(200).json({ success: true, message: "Mock inbox cleared" });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to clear mock inbox" });
  }
});
