import { describe, it, expect } from "vitest";
import {
  generateLocalKey,
  encryptPrivateKey,
  decryptPrivateKey,
  hashInvitationToken,
  createGuardianConsentMessage,
  verifyGuardianConsentSignature
} from "./crypto";
import { ethers } from "ethers";

describe("Crypto and Key Security", () => {
  it("should generate a valid Ethereum keypair locally", () => {
    const keypair = generateLocalKey();
    expect(ethers.isAddress(keypair.address)).toBe(true);
    expect(keypair.privateKey.startsWith("0x")).toBe(true);
    expect(keypair.privateKey.length).toBe(66);
  });

  it("should encrypt and decrypt a private key with strong password", async () => {
    const keypair = generateLocalKey();
    const password = "SuperSecretPassword123!@#";

    const keystore = await encryptPrivateKey(keypair.privateKey, password, 1000); // 1000 for fast unit test
    expect(keystore.address.toLowerCase()).toBe(keypair.address.toLowerCase());
    expect(keystore.crypto.cipher).toBe("aes-256-gcm");
    expect(keystore.crypto.kdf).toBe("pbkdf2");

    const recoveredKey = await decryptPrivateKey(keystore, password);
    expect(recoveredKey.toLowerCase()).toBe(keypair.privateKey.toLowerCase());
  });

  it("should reject decryption with incorrect password", async () => {
    const keypair = generateLocalKey();
    const password = "CorrectPassword123";
    const wrongPassword = "WrongPassword456";

    const keystore = await encryptPrivateKey(keypair.privateKey, password, 1000);

    await expect(decryptPrivateKey(keystore, wrongPassword)).rejects.toThrow();
  });

  it("should hash invitation tokens consistently with SHA-256", () => {
    const token = "invitation-token-uuid-12345";
    const hash1 = hashInvitationToken(token);
    const hash2 = hashInvitationToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1.startsWith("0x")).toBe(true);
    expect(hash1.length).toBe(66);
  });

  it("should sign and verify guardian consent message correctly", async () => {
    const guardianWallet = ethers.Wallet.createRandom();
    const walletAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const chainId = 31337;

    const message = createGuardianConsentMessage(walletAddress, guardianWallet.address, chainId);
    const signature = await guardianWallet.signMessage(message);

    const isValid = verifyGuardianConsentSignature(
      walletAddress,
      guardianWallet.address,
      chainId,
      signature
    );
    expect(isValid).toBe(true);

    const otherWallet = ethers.Wallet.createRandom();
    const isInvalid = verifyGuardianConsentSignature(
      walletAddress,
      otherWallet.address,
      chainId,
      signature
    );
    expect(isInvalid).toBe(false);
  });
});
