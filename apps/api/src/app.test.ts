import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "./index";
import { initDatabase } from "./db";
import { ethers } from "ethers";
import { createGuardianConsentMessage } from "@recoverid/shared";
import path from "path";

describe("RecoverID API Automated Test Suite", () => {
  beforeAll(async () => {
    // Use in-memory / temp test database
    const testDbPath = path.join(__dirname, "../data/test_recoverid.sqlite");
    await initDatabase(testDbPath);
  });

  const wallet = ethers.Wallet.createRandom();
  const guardianWallet = ethers.Wallet.createRandom();
  let invitationToken = "";

  it("GET /api/health should return 200 and ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toContain("RecoverID Shield");
  });

  it("POST /api/guardians/invite should validate input addresses", async () => {
    const res = await request(app)
      .post("/api/guardians/invite")
      .send({
        walletAddress: "0xInvalidWallet",
        guardianAddress: guardianWallet.address,
        guardianName: "Alice",
        email: "alice@example.com"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid smart wallet address");
  });

  it("POST /api/guardians/invite should dispatch invitation and save token hash", async () => {
    const res = await request(app)
      .post("/api/guardians/invite")
      .send({
        walletAddress: wallet.address,
        guardianAddress: guardianWallet.address,
        guardianName: "Alice Guardian",
        email: "alice@example.com"
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.guardian.guardianName).toBe("Alice Guardian");
    expect(res.body.guardian.status).toBe("invited");
    expect(res.body.invitationToken).toBeDefined();

    invitationToken = res.body.invitationToken;
  });

  it("GET /api/guardians/invite/:token should validate token and return message to sign", async () => {
    const res = await request(app).get(`/api/guardians/invite/${invitationToken}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.guardianAddress.toLowerCase()).toBe(guardianWallet.address.toLowerCase());
    expect(res.body.messageToSign).toContain("RECOVERID SHIELD GUARDIAN CONSENT");
  });

  it("POST /api/guardians/consent should reject invalid cryptographic signature", async () => {
    const attackerWallet = ethers.Wallet.createRandom();
    const message = createGuardianConsentMessage(wallet.address, guardianWallet.address, 31337);
    const fakeSignature = await attackerWallet.signMessage(message);

    const res = await request(app)
      .post("/api/guardians/consent")
      .send({
        invitationToken,
        signature: fakeSignature,
        chainId: 31337
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Signature verification failed");
  });

  it("POST /api/guardians/consent should accept valid cryptographic signature and mark registered", async () => {
    const message = createGuardianConsentMessage(wallet.address, guardianWallet.address, 31337);
    const validSignature = await guardianWallet.signMessage(message);

    const res = await request(app)
      .post("/api/guardians/consent")
      .send({
        invitationToken,
        signature: validSignature,
        chainId: 31337
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify guardian status changed in list
    const listRes = await request(app).get(`/api/guardians/${wallet.address}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.guardians.length).toBe(1);
    expect(listRes.body.guardians[0].status).toBe("registered");
    expect(listRes.body.guardians[0].consentSignature).toBe(validSignature);
  });

  it("GET /api/notifications/mock-inbox should return dispatched mock emails", async () => {
    const res = await request(app).get("/api/notifications/mock-inbox");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.emails[0].to_email).toBe("alice@example.com");
  });

  it("POST and GET /api/activity should track wallet audit trail", async () => {
    const actRes = await request(app)
      .post("/api/activity")
      .send({
        wallet: wallet.address,
        type: "TRANSACTION_SENT",
        title: "Test Native Transfer",
        description: "Sent 0.5 ETH to test recipient",
        actor: wallet.address
      });

    expect(actRes.status).toBe(201);
    expect(actRes.body.success).toBe(true);

    const getRes = await request(app).get(`/api/activity/${wallet.address}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.activities.length).toBeGreaterThan(0);
  });
});
