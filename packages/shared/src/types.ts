export interface EncryptedKeystore {
  version: 1;
  id: string;
  address: string;
  crypto: {
    cipher: "aes-256-gcm";
    ciphertext: string;
    cipherparams: {
      iv: string;
    };
    kdf: "pbkdf2";
    kdfparams: {
      iterations: number;
      salt: string;
      digest: "sha256";
      keyLength: number;
    };
    mac: string;
  };
  meta: {
    createdAt: number;
    description: string;
    backupConfirmed: boolean;
  };
}

export interface GuardianConsentPayload {
  wallet: string;
  guardian: string;
  chainId: number;
  message: string;
}

export interface GuardianApprovalPayload {
  requestId: number;
  wallet: string;
  proposedOwner: string;
  nonce: number;
  chainId: number;
  verifyingContract: string;
}

export type GuardianStatus = "invited" | "registered" | "revoked";

export interface GuardianRecord {
  id: string;
  walletAddress: string;
  guardianAddress: string;
  guardianName: string;
  email: string;
  status: GuardianStatus;
  invitationTokenHash?: string;
  invitationExpiresAt?: number;
  consentSignature?: string;
  registeredOnChain: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RecoveryRequestView {
  id: number;
  wallet: string;
  proposedOwner: string;
  createdAt: number;
  executionDelay: number;
  unlockTime: number;
  expirationTime: number;
  approvalCount: number;
  executed: boolean;
  canceled: boolean;
  initiator: string;
  approvals: { [guardianAddress: string]: boolean };
  canExecute: boolean;
  isExpired: boolean;
  remainingDelaySeconds: number;
}

export interface WalletState {
  address: string;
  owner: string;
  recoveryModule: string;
  ethBalance: string;
  tokenBalance: string;
  guardians: string[];
  guardiansConfigured: boolean;
  activeRequestId: number;
  nonce: number;
  delaySeconds: number;
}

export interface ActivityLogItem {
  id: string;
  wallet: string;
  type: "CREATED" | "GUARDIAN_INVITED" | "GUARDIAN_REGISTERED" | "RECOVERY_INITIATED" | "RECOVERY_APPROVED" | "RECOVERY_CANCELED" | "RECOVERY_EXECUTED" | "TRANSACTION_SENT";
  title: string;
  description: string;
  actor: string;
  txHash?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface CreateInvitationRequest {
  walletAddress: string;
  guardianAddress: string;
  guardianName: string;
  email: string;
}

export interface VerifyInvitationResponse {
  valid: boolean;
  walletAddress: string;
  guardianAddress: string;
  guardianName: string;
  email: string;
  messageToSign: string;
  reason?: string;
}

export interface SubmitConsentRequest {
  invitationToken: string;
  walletAddress: string;
  guardianAddress: string;
  signature: string;
}
