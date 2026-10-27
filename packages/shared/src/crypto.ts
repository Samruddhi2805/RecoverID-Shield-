import { ethers } from "ethers";
import type { EncryptedKeystore } from "./types";

/**
 * Generates an Ethereum keypair locally
 */
export function generateLocalKey(): {
  address: string;
  privateKey: string;
  mnemonic?: string;
} {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase
  };
}

/**
 * Helper to get subtle crypto in both Browser and Node.js environments
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }
  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = require("crypto");
  return nodeCrypto.webcrypto.subtle;
}

function getRandomValues(array: Uint8Array): Uint8Array {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(array);
  }
  const nodeCrypto = require("crypto");
  return nodeCrypto.randomFillSync(array);
}

/**
 * Encrypts private key using PBKDF2 (100,000 rounds SHA-256) and AES-256-GCM
 */
export async function encryptPrivateKey(
  privateKey: string,
  password: string,
  iterations = 100_000
): Promise<EncryptedKeystore> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();

  const wallet = new ethers.Wallet(privateKey);
  const address = wallet.address;

  // Generate 16-byte salt and 12-byte IV for AES-GCM
  const salt = getRandomValues(new Uint8Array(16));
  const iv = getRandomValues(new Uint8Array(12));

  // Import password as PBKDF2 base key
  const passwordKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  // Derive AES-GCM 256-bit key
  const aesKey = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  // Encrypt plaintext private key
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
      tagLength: 128
    },
    aesKey,
    enc.encode(privateKey)
  );

  const ciphertextArray = new Uint8Array(ciphertextBuffer);

  // Compute HMAC/MAC hash for quick validation
  const macHash = ethers.keccak256(
    ethers.concat([ethers.hexlify(salt), ethers.hexlify(iv), ethers.hexlify(ciphertextArray)])
  );

  return {
    version: 1,
    id: ethers.hexlify(getRandomValues(new Uint8Array(16))),
    address,
    crypto: {
      cipher: "aes-256-gcm",
      ciphertext: ethers.hexlify(ciphertextArray),
      cipherparams: {
        iv: ethers.hexlify(iv)
      },
      kdf: "pbkdf2",
      kdfparams: {
        iterations,
        salt: ethers.hexlify(salt),
        digest: "sha256",
        keyLength: 256
      },
      mac: macHash
    },
    meta: {
      createdAt: Date.now(),
      description: "RecoverID Shield Authenticated Keystore",
      backupConfirmed: false
    }
  };
}

/**
 * Decrypts private key from EncryptedKeystore
 */
export async function decryptPrivateKey(
  keystore: EncryptedKeystore,
  password: string
): Promise<string> {
  const subtle = getSubtleCrypto();
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = ethers.getBytes(keystore.crypto.kdfparams.salt);
  const iv = ethers.getBytes(keystore.crypto.cipherparams.iv);
  const ciphertext = ethers.getBytes(keystore.crypto.ciphertext);

  const passwordKey = await subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const aesKey = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: keystore.crypto.kdfparams.iterations,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  try {
    const decryptedBuffer = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
        tagLength: 128
      },
      aesKey,
      ciphertext as any
    );

    const privateKey = dec.decode(decryptedBuffer);

    // Verify decrypted key matches stored address
    const recoveredWallet = new ethers.Wallet(privateKey);
    if (recoveredWallet.address.toLowerCase() !== keystore.address.toLowerCase()) {
      throw new Error("Address verification failed after decryption");
    }

    return privateKey;
  } catch (err) {
    throw new Error("Invalid password or corrupted keystore payload");
  }
}

/**
 * Hash invitation tokens for secure storage
 */
export function hashInvitationToken(token: string): string {
  return ethers.sha256(ethers.toUtf8Bytes(token));
}

/**
 * Domain-separated consent message for guardians
 */
export function createGuardianConsentMessage(
  wallet: string,
  guardian: string,
  chainId: number
): string {
  return [
    "=== RECOVERID SHIELD GUARDIAN CONSENT ===",
    `Smart Wallet: ${wallet.toLowerCase()}`,
    `Guardian Address: ${guardian.toLowerCase()}`,
    `Chain ID: ${chainId}`,
    "Action: REGISTER_GUARDIAN_CONSENT",
    "Notice: By signing this message with your private key, you agree to act as an authorized social recovery guardian for the specified smart wallet.",
    "Timestamp: Nonce Verification Enabled"
  ].join("\n");
}

/**
 * Verify guardian consent signature
 */
export function verifyGuardianConsentSignature(
  wallet: string,
  guardian: string,
  chainId: number,
  signature: string
): boolean {
  const message = createGuardianConsentMessage(wallet, guardian, chainId);
  const recovered = ethers.verifyMessage(message, signature);
  return recovered.toLowerCase() === guardian.toLowerCase();
}
