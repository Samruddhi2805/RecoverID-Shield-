# RecoverID Shield — Step-by-Step Local Demonstration Guide

This guide walks through the complete end-to-end recovery demonstration using local Foundry/Anvil, the Express backend, and the React Web3 security dashboard.

---

## 1. Prerequisites & Environment Setup

Ensure you have:
- Node.js `v20+` or `v24+` installed
- `pnpm` (`v9+` or `v12+`)
- Foundry (`forge` and `anvil`) in your PATH (`$env:USERPROFILE\.foundry\bin`)

---

## 2. Launch Local Environment

Open 3 terminal windows or run the automated startup scripts:

### Terminal 1: Start Anvil Blockchain Node
```powershell
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
# Or: .\scripts\start-anvil.ps1
```

### Terminal 2: Deploy Contracts
```powershell
pnpm deploy:local
# Or: .\scripts\deploy-local.ps1
```
*This deploys `RecoveryModule`, `WalletFactory`, `MockERC20 (rUSD)`, sets a 60-second recovery delay for local testing, funds the demo wallet with 10 ETH and 1,000 rUSD, and saves the addresses to `.env`.*

### Terminal 3: Start Backend API
```powershell
pnpm dev:api
```
*API runs on `http://localhost:4000` with SQLite persistence and mock notification inbox.*

### Terminal 4: Start Frontend Web Dashboard
```powershell
pnpm dev:web
```
*Open `http://localhost:5173` in your browser.*

---

## 3. Interactive Demonstration Walkthrough

### Step 1: Create a Wallet Without MetaMask
1. Navigate to **Create Wallet** from the top navbar.
2. Click **Generate Owner Keypair** — the keypair is derived locally in memory.
3. Enter a master passphrase (minimum 8 characters) to encrypt your local vault with PBKDF2 + AES-256-GCM.
4. Download your encrypted JSON keystore backup and copy your private key.
5. Check the confirmation checkbox and click **Deploy Smart Contract Wallet**.
6. The contract is deployed to Anvil! Click **Open Wallet Dashboard**.

### Step 2: Explore Wallet Dashboard & Asset Management
1. Note the **Smart Contract Wallet** address at the top.
2. Notice the **Authorized Owner** indicator:
   - Green badge: `Active Key is Authorized Owner`
3. Notice your real on-chain balance (e.g. 10.00 ETH and 1,000 rUSD).
4. Click **Local Faucet** if you wish to top up additional test funds.
5. Click **Send ETH** or **Send rUSD** to execute an owner-authorized transfer.
   - Confirm that the transaction executes on-chain and updates your balance.

### Step 3: Register 3 Guardians
1. Navigate to the **Guardians** tab.
2. Under "Presets" above the form, click **Alice** to autofill Guardian #1 details. Click **Send Cryptographic Guardian Invitation**.
3. Repeat for **Bob** (Guardian #2) and **Charlie** (Guardian #3).
4. Click the **Simulated Notification Inbox** icon (mail icon in the navbar) to view the dispatched mock emails.
5. In the inbox, click **Accept Invitation** for Alice:
   - Switch active signer in the top-right to `Guardian 1 - Alice (Anvil #1)`.
   - Click **Sign & Verify Consent** to sign the domain-separated consent message.
6. Return to Guardians tab and click **Register Guardians On-Chain** using your Owner key.
7. Notice the on-chain badge updates to `ON-CHAIN ACTIVE (3 / 3)`.

### Step 4: Initiate Social Recovery
1. Imagine the owner lost their private key and created a new address:
   `New Owner Candidate (Anvil #4): 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`
2. Navigate to **Initiate Recovery**.
3. Click **Use Dev New Owner (Anvil #4)**.
4. Switch to `Guardian 1 - Alice` in the top-right switcher.
5. Click **Broadcast Recovery Request**.
   - Request #1 is initiated on-chain with Alice's initial approval (1 / 2).

### Step 5: Test Threshold (1 Approval is Insufficient)
1. Notice the **Active Recovery Banner** at the top of the dashboard.
2. Current approval count is `1 / 2 Approvals Satisfied`.
3. The **Complete Recovery** button is disabled because the 2-of-3 threshold is not yet met.

### Step 6: Second Guardian Approves
1. Switch active signer to `Guardian 2 - Bob (Anvil #2)`.
2. Navigate to **Initiate Recovery**.
3. Under the Guardian Approval Matrix, click **Approve Recovery On-Chain**.
4. Bob's approval is submitted on-chain! Approval count now displays `2 / 2 Approvals Satisfied`.

### Step 7: Observe Timelock Delay Countdown
1. The timelock security countdown timer begins (configured to 60 seconds).
2. During this period, if the original owner switches back, they have a **Cancel Request (Owner)** button to abort any fraudulent recovery.
3. Wait for the 60-second delay to elapse (or warp Anvil time).
4. Once the countdown expires, the status changes to:
   `Ready for Final Execution` with an active green button.

### Step 8: Execute Ownership Recovery
1. Click **Complete Recovery**.
2. The transaction calls `executeRecovery` on-chain.
3. The `RecoveryModule` calls `SmartWallet.changeOwner(...)`.

### Step 9: Verify Key Rotation & Asset Preservation
1. Switch signer to the **Old Owner (Anvil #0)**:
   - Notice the badge turns red: `Active Key is NOT Owner (Read-Only)`.
   - Try to send ETH: The smart contract **strictly reverts** with `UnauthorizedCaller`!
2. Switch signer to the **New Owner Candidate (Anvil #4)**:
   - The badge turns green: `Active Key is Authorized Owner`!
   - Send 1.0 ETH to any recipient — the transaction succeeds!
3. Check the Smart Wallet contract address:
   - **It remains 100% identical!**
4. Check balances:
   - **All existing ETH and token balances remained in the wallet throughout recovery!**

---

## 4. Running the Automated E2E Test Script

You can verify the entire 9-step sequence automatically in under 5 seconds with zero manual clicks:

```powershell
pnpm --filter @recoverid/api exec tsx ../../scripts/run-e2e.ts
# Or: .\scripts\run-e2e.ps1
```
