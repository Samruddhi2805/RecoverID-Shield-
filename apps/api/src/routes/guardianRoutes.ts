import { Router, Request, Response } from "express";
import crypto from "crypto";
import { ethers } from "ethers";
import {
  hashInvitationToken,
  createGuardianConsentMessage,
  verifyGuardianConsentSignature,
  type GuardianRecord
} from "@recoverid/shared";
import {
  saveGuardian,
  getGuardianByTokenHash,
  getGuardiansByWallet,
  updateGuardianStatus,
  addActivity
} from "../db";
import { emailService } from "../services/emailService";

export const guardianRouter = Router();

// 1. Invite a guardian
guardianRouter.post("/invite", async (req: Request, res: Response) => {
  try {
    const { walletAddress, guardianAddress, guardianName, email } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid smart wallet address" });
    }
    if (!guardianAddress || !ethers.isAddress(guardianAddress)) {
      return res.status(400).json({ error: "Invalid guardian Ethereum address" });
    }
    if (!guardianName || typeof guardianName !== "string" || guardianName.trim().length === 0) {
      return res.status(400).json({ error: "Guardian name is required" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    if (walletAddress.toLowerCase() === guardianAddress.toLowerCase()) {
      return res.status(400).json({ error: "Guardian address cannot be the smart wallet itself" });
    }

    const existing = getGuardiansByWallet(walletAddress);
    const activeGuardians = existing.filter((g) => g.status !== "revoked");
    if (activeGuardians.length >= 3) {
      return res.status(400).json({ error: "Smart wallet already has 3 active guardians" });
    }

    const duplicateAddress = activeGuardians.find(
      (g) => g.guardianAddress.toLowerCase() === guardianAddress.toLowerCase()
    );
    if (duplicateAddress) {
      return res.status(400).json({ error: "Guardian address already invited or registered" });
    }

    // Generate single-use invitation token and its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashInvitationToken(rawToken);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const record: GuardianRecord = {
      id: "guard_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      walletAddress: walletAddress.toLowerCase(),
      guardianAddress: guardianAddress.toLowerCase(),
      guardianName: guardianName.trim(),
      email: email.trim().toLowerCase(),
      status: "invited",
      invitationTokenHash: tokenHash,
      invitationExpiresAt: expiresAt,
      registeredOnChain: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    saveGuardian(record);

    // Send invitation email
    await emailService.sendGuardianInvitation(
      record.email,
      record.guardianName,
      record.walletAddress,
      rawToken
    );

    addActivity({
      id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      wallet: walletAddress.toLowerCase(),
      type: "GUARDIAN_INVITED",
      title: "Guardian Invitation Dispatched",
      description: `Invited ${record.guardianName} (${record.guardianAddress.substring(0, 8)}...) via email`,
      actor: walletAddress.toLowerCase(),
      timestamp: Date.now()
    });

    return res.status(201).json({
      success: true,
      message: "Invitation sent successfully",
      guardian: record,
      invitationToken: rawToken // Returned for local dev / automated testing convenience
    });
  } catch (err: any) {
    console.error("Error in /invite:", err);
    return res.status(500).json({ error: "Internal server error inviting guardian" });
  }
});

// 2. Validate invitation token
guardianRouter.get("/invite/:token", async (req: Request, res: Response) => {
  try {
    const rawToken = req.params.token;
    if (!rawToken || rawToken.length < 16) {
      return res.status(400).json({ valid: false, reason: "Malformed invitation token" });
    }

    const tokenHash = hashInvitationToken(rawToken);
    const guardian = getGuardianByTokenHash(tokenHash);

    if (!guardian) {
      return res.status(404).json({ valid: false, reason: "Invitation not found or revoked" });
    }

    if (guardian.invitationExpiresAt && Date.now() > guardian.invitationExpiresAt) {
      return res.status(410).json({ valid: false, reason: "Invitation token has expired" });
    }

    if (guardian.status === "registered") {
      return res.status(200).json({
        valid: false,
        reason: "Invitation already accepted",
        guardian
      });
    }

    const chainId = parseInt(process.env.CHAIN_ID || "31337", 10);
    const messageToSign = createGuardianConsentMessage(
      guardian.walletAddress,
      guardian.guardianAddress,
      chainId
    );

    return res.status(200).json({
      valid: true,
      walletAddress: guardian.walletAddress,
      guardianAddress: guardian.guardianAddress,
      guardianName: guardian.guardianName,
      email: guardian.email,
      messageToSign,
      chainId
    });
  } catch (err: any) {
    console.error("Error in /invite/:token:", err);
    return res.status(500).json({ error: "Error verifying invitation token" });
  }
});

// 3. Submit cryptographic consent signature
guardianRouter.post("/consent", async (req: Request, res: Response) => {
  try {
    const { invitationToken, signature, chainId } = req.body;

    if (!invitationToken || !signature) {
      return res.status(400).json({ error: "Token and signature are required" });
    }

    const tokenHash = hashInvitationToken(invitationToken);
    const guardian = getGuardianByTokenHash(tokenHash);

    if (!guardian) {
      return res.status(404).json({ error: "Invalid invitation token" });
    }

    if (guardian.invitationExpiresAt && Date.now() > guardian.invitationExpiresAt) {
      return res.status(410).json({ error: "Invitation has expired" });
    }

    const targetChainId = Number(chainId) || parseInt(process.env.CHAIN_ID || "31337", 10);
    const isValid = verifyGuardianConsentSignature(
      guardian.walletAddress,
      guardian.guardianAddress,
      targetChainId,
      signature
    );

    if (!isValid) {
      return res.status(401).json({
        error: "Signature verification failed. Signer does not match invited guardian address."
      });
    }

    // Update status to registered
    updateGuardianStatus(guardian.id, "registered", signature);

    addActivity({
      id: "act_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      wallet: guardian.walletAddress,
      type: "GUARDIAN_REGISTERED",
      title: "Guardian Consent Verified",
      description: `${guardian.guardianName} successfully verified cryptographic consent`,
      actor: guardian.guardianAddress,
      timestamp: Date.now()
    });

    return res.status(200).json({
      success: true,
      message: "Consent verified and registered successfully",
      guardianAddress: guardian.guardianAddress
    });
  } catch (err: any) {
    console.error("Error in /consent:", err);
    return res.status(500).json({ error: "Error processing consent signature" });
  }
});

// 4. List guardians for a wallet
guardianRouter.get("/:walletAddress", (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const list = getGuardiansByWallet(walletAddress);
    return res.status(200).json({
      walletAddress: walletAddress.toLowerCase(),
      guardians: list
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Error retrieving guardians" });
  }
});

// 5. Revoke a guardian
guardianRouter.post("/revoke", (req: Request, res: Response) => {
  try {
    const { guardianId } = req.body;
    if (!guardianId) {
      return res.status(400).json({ error: "Guardian ID is required" });
    }

    updateGuardianStatus(guardianId, "revoked");
    return res.status(200).json({ success: true, message: "Guardian invitation revoked" });
  } catch (err: any) {
    return res.status(500).json({ error: "Error revoking guardian" });
  }
});
