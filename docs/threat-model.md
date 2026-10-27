# RecoverID Shield — Threat Model & Adversary Analysis

This document identifies potential attack vectors, threat actors, security assumptions, and mitigations implemented across RecoverID Shield.

---

## 1. Adversary Personas & Threat Vectors

### Persona A: The Opportunistic Eavesdropper (Network / MITM)
- **Goal:** Intercept private keys, seed phrases, or sensitive recovery payloads in transit.
- **Attack Vector:** Snooping on HTTP/WebSocket traffic or compromised local networks.
- **Mitigation:**
  - Zero private keys or seed phrases are ever transmitted over the network.
  - All communication between client and backend uses TLS (or HTTPS in production).
  - Invitation tokens are transmitted in URLs with SHA-256 storage on the backend.
  - Consent and approvals use domain-separated cryptographic signatures.

### Persona B: Compromised Single Guardian
- **Goal:** Maliciously take over a user's smart wallet or veto recovery.
- **Attack Vector:** An attacker gains access to one guardian's private key and attempts to initiate or approve a recovery to an attacker-controlled address.
- **Mitigation:**
  - **Threshold Policy:** Exactly 2 distinct approvals are required. A single compromised guardian cannot authorize ownership transfer.
  - **Duplicate Rejection:** The compromised guardian cannot vote twice to bypass the threshold.

### Persona C: Rogue Backend / Database Leak
- **Goal:** Steal funds or authorize recoveries by compromising the backend server or SQLite database.
- **Attack Vector:** Full database dump or hostile backend code injection.
- **Mitigation:**
  - The backend possesses zero private keys, zero master passwords, and zero seed phrases.
  - Database stores ONLY SHA-256 hashes of invitation tokens.
  - The smart contract does not trust the backend database. Every recovery decision is verified directly on the Ethereum blockchain via guardian ECDSA signatures and on-chain state.

### Persona D: Two Colluding / Compromised Guardians
- **Goal:** Maliciously steal ownership of the smart wallet without owner consent.
- **Attack Vector:** Two guardians collude to approve a recovery request to an attacker address.
- **Mitigation:**
  - **Security Delay Timelock:** The contract mandates a delay (minimum 60s, default 24h) between threshold approval and execution.
  - **Emergency Owner Cancellation:** The legitimate owner receives real-time security warnings (via email and dashboard) and can cancel the pending recovery with their current owner key at any time before the timelock expires.
  - **Proposed Owner Exclusions:** Guardians cannot recover the wallet to their own guardian addresses.

### Persona E: Stale or Replay Attackers
- **Goal:** Re-execute an old recovery request or replay guardian signatures from a previous request.
- **Attack Vector:** Calling `executeRecovery` repeatedly or submitting an old approval signature to a new request.
- **Mitigation:**
  - Once executed, `req.executed = true` permanently blocks re-execution.
  - Canceled requests cannot execute.
  - Expired requests (`block.timestamp > expirationTime`) are rejected.
  - Signatures incorporate `requestId`, `wallet`, `proposedOwner`, and `guardianNonce`.

---

## 2. Threat Matrix

| Threat | Impact | Likelihood | Mitigating Contract / System Control | Status |
| :--- | :--- | :--- | :--- | :--- |
| Single Guardian Rogue Recovery | Critical | Moderate | Enforced 2-of-3 threshold in `RecoveryModule.sol` | **VERIFIED** |
| Double Approval by Single Guardian | Critical | Moderate | `requestApprovals[id][guardian]` mapping check | **VERIFIED** |
| Recovery Prior to Timelock Expiry | Critical | Low | `block.timestamp >= unlockTime` check | **VERIFIED** |
| Unauthorized Caller Modifies Owner | Critical | High | `SmartWallet.changeOwner` restricted to `recoveryModule` | **VERIFIED** |
| Replay of Executed Recovery Request | High | Moderate | `req.executed` check and nonce increment | **VERIFIED** |
| Stale Unfinished Recovery Abuse | Medium | Low | `expirationTime` check (7-day window) | **VERIFIED** |
| Plaintext Private Key Theft via Backend | Critical | Low | Keys generated locally; never transmitted to API | **VERIFIED** |
| Database Leak Exposing Guardian Tokens | Medium | Low | Single-use tokens stored as SHA-256 hashes | **VERIFIED** |
| Collusion of 2 Guardians | Critical | Low | Timelock delay window & owner cancellation | **VERIFIED** |
