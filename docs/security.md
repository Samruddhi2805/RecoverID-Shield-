# RecoverID Shield — Security & Invariant Specifications

This document outlines the security architecture, authorization controls, cryptographic mechanisms, and operational invariants implemented across the RecoverID Shield protocol.

---

## 1. Smart Contract Authorization Controls

### 1.1 Owner-Restricted Operations
- All state-altering user operations on `SmartWallet.sol` (`execute`, `transferNative`, `transferERC20`, `executeSigned`) enforce `msg.sender == owner` or cryptographic signature verification against `owner`.
- Replay protection on signed executions is guaranteed by incremental nonces and EIP-712 domain separation containing `chainId` and contract address.

### 1.2 Recovery-Restricted Operations
- `SmartWallet.sol` strictly limits the `changeOwner` function:
  ```solidity
  modifier onlyRecoveryModule() {
      if (msg.sender != recoveryModule) {
          revert OnlyRecoveryModule(msg.sender, recoveryModule);
      }
      _;
  }
  ```
- No user, including the current owner, can directly invoke `changeOwner`. Only the verified `RecoveryModule` contract address can update the owner state.

### 1.3 Guardian Configuration Invariants
- Exactly three distinct guardian addresses must be registered for a wallet.
- The following constraints are enforced:
  - `guardian != address(0)`
  - `guardian != wallet`
  - `guardian != currentOwner`
  - `guardian[i] != guardian[j]` for all `i != j`

---

## 2. Social Recovery State Machine Invariants

### 2.1 Two-of-Three Threshold Enforcement
- Recovery execution strictly requires `approvalCount >= 2`.
- A single rogue guardian cannot authorize recovery.
- An attacker with a single compromised guardian cannot bypass the threshold.

### 2.2 Duplicate Approval Prevention
- The mapping `requestApprovals[requestId][guardian]` tracks guardian votes.
- Any attempt to submit a duplicate approval reverts with `GuardianAlreadyApproved`.

### 2.3 Timelock Delay
- Every recovery request enforces an execution delay: `unlockTime = createdAt + executionDelay`.
- Calls to `executeRecovery` prior to `block.timestamp >= unlockTime` revert with `DelayNotElapsed`.
- The timelock provides an irrevocable window for the legitimate owner to detect and neutralize fraudulent attempts.

### 2.4 Cancellation Policy
- The active wallet owner (`msg.sender == SmartWallet(wallet).owner()`) can cancel any pending recovery request at **any time** prior to execution.
- Once canceled, a request cannot be approved or executed (`RequestCanceled`).
- If an initiator realizes an error before threshold is reached, they may also cancel their request.

### 2.5 Request Expiration & Replay Defense
- Every request has a hard expiration: `expirationTime = unlockTime + EXPIRY_WINDOW` (7 days).
- Expired requests revert with `RequestExpired`.
- Executed requests set `req.executed = true` and cannot be replayed (`RequestAlreadyExecuted`).
- Only one active pending request is allowed per wallet at a time (`ActiveRecoveryPending`).

---

## 3. Cryptographic Storage & Key Safety

### 3.1 Local Key Derivation
- Private keys and mnemonics are generated using client-side cryptographic randomness (`crypto.getRandomValues`).
- Private keys are never exposed in URL parameters, sent over WebSocket, or stored in backend databases.

### 3.2 Authenticated Storage Scheme
- Keystores are encrypted with PBKDF2 key derivation (100,000 rounds of SHA-256) and AES-256-GCM.
- AES-GCM provides authenticated ciphertext integrity: any tampering with ciphertext, IV, or salt causes decryption to fail.

### 3.3 Hashed Invitation Tokens
- Raw invitation tokens are sent via mock/live email.
- The backend stores ONLY the SHA-256 hash: `hashInvitationToken(token)`.
- Database exposure does not yield valid invitation tokens.

---

## 4. Operational Limitations & Honest Disclosures

### 4.1 Two-of-Three Collusion Risk
- If an attacker compromises or colludes with **two out of the three guardians**, they can meet the threshold.
- The primary defense against this scenario is the **Timelock Delay Window**, which alerts the owner and provides time to cancel the request.
- Users are advised to select guardians from distinct, non-overlapping social or institutional domains (e.g., family member, hardware wallet backup, trusted friend/attorney).

### 4.2 Browser Storage Boundaries
- Storing keys in browser storage (localStorage) is vulnerable to malware with local process access or malicious browser extensions.
- Users must always maintain an offline backup of their encrypted keystore JSON and master passphrase.
- Email login must never grant wallet control.
