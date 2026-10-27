# RecoverID Shield

> **Lose Your Keys, Not Your Assets.**

RecoverID Shield is a self-custodial smart contract wallet featuring an on-chain **2-of-3 social recovery system**. It provides an institutional-grade defense against key loss without requiring third-party browser extensions or custodial intermediaries.

---

## Key Highlights

- **Zero Browser Extension Requirement:** Generate owner keypairs locally in the browser with client-side entropy.
- **Client-Side Key Vault:** Protected using PBKDF2 (100,000 rounds of SHA-256) and AES-256-GCM authenticated encryption. Private keys are never transmitted to any backend.
- **2-of-3 Social Guardian Threshold:** Register 3 distinct guardians. Exactly 2 distinct cryptographic approvals are strictly enforced by the smart contract.
- **Asset & Address Preservation:** Ownership rotates on the existing smart contract; the wallet address, native ETH, and ERC-20 token balances remain 100% intact.
- **Timelock Security Delay:** A configurable execution delay (default 24h, 60s for local testing) gives the genuine owner time to cancel unauthorized attempts.
- **Emergency Owner Cancellation:** The legitimate owner retains an irrevocable right to abort pending recoveries at any moment prior to execution.
- **Real Blockchain State:** Zero fabricated data. All balances, nonces, timelocks, and recovery approvals are verified directly against live smart contract events.

---

## Technology Stack

- **Smart Contracts:** Solidity `0.8.24`, OpenZeppelin Contracts v5.0.2, Foundry / Anvil
- **Frontend Dashboard:** React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, ethers.js v6
- **Backend Service:** Node.js, Express, TypeScript, SQLite (WebAssembly `sql.js`)
- **Cryptography & Security:** WebCrypto API, PBKDF2, AES-256-GCM, EIP-712 Structured Data Hashes
- **Testing Suites:** Foundry (`forge test`), Vitest, React Testing Library, Supertest

---

## Project Structure

```
recoverid-shield/
├── apps/
│   ├── web/                     # React 18 / Vite / Tailwind security dashboard
│   └── api/                     # Express / TypeScript backend & SQLite indexer
├── contracts/
│   ├── src/
│   │   ├── SmartWallet.sol      # Self-custodial wallet with restricted ownership rotation
│   │   ├── WalletFactory.sol    # Factory with atomic guardian registration
│   │   ├── RecoveryModule.sol   # 2-of-3 social recovery, timelock & cancellation
│   │   └── MockERC20.sol        # Mock token for testing asset custody
│   ├── test/
│   │   ├── SmartWallet.t.sol    # 10 Foundry unit & authorization tests
│   │   └── RecoveryModule.t.sol # 14 Foundry recovery & invariant tests
│   ├── script/
│   │   └── Deploy.s.sol         # Foundry deployment script
│   └── foundry.toml             # Foundry configuration & remappings
├── packages/
│   └── shared/                  # Typed contract ABIs, crypto utilities, and types
├── docs/
│   ├── architecture.md          # Comprehensive architecture & state machine diagrams
│   ├── security.md              # Invariants & authorization controls
│   ├── threat-model.md          # Adversary models & mitigations matrix
│   └── demo-guide.md            # Step-by-step local walkthrough
├── scripts/
│   ├── deploy-local.ts          # Automated local deployment & manifest generation
│   ├── run-e2e.ts               # 9-step automated end-to-end verification
│   ├── start-anvil.ps1 / .sh    # Anvil node launcher
│   ├── test-all.ps1 / .sh       # Universal test runner
│   └── run-demo.ps1 / .sh       # Concurrent service launcher
├── .env.example                 # Environment variables template
├── package.json                 # Monorepo workspaces configuration
└── pnpm-workspace.yaml          # pnpm workspace definition
```

---

## Quickstart & Local Setup

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run All Automated Test Suites
Run smart contract, crypto, backend, and frontend tests in one command:
```powershell
.\scripts\test-all.ps1
# Or: ./scripts/test-all.sh
```

### 3. Launch the Application Locally

#### Terminal 1: Start Anvil Blockchain Node
```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
```

#### Terminal 2: Deploy Contracts
```bash
pnpm deploy:local
```

#### Terminal 3: Start Backend API
```bash
pnpm dev:api
```
*API runs on `http://localhost:4000`*

#### Terminal 4: Start Frontend Web Dashboard
```bash
pnpm dev:web
```
*Web dashboard available at `http://localhost:5173`*

---

## Automated End-to-End Recovery Verification

With Anvil running, run the automated verification script to test the complete recovery cycle:

```bash
pnpm --filter @recoverid/api exec tsx ../../scripts/run-e2e.ts
```

This tests and proves:
1. SmartWallet has exactly 3 registered guardians on-chain.
2. Legitimate owner can cancel a pending recovery at any time.
3. Recovery request is created with an on-chain ID.
4. One guardian approval is strictly rejected by the contract.
5. Two distinct guardians satisfy the 2-of-3 threshold.
6. Execution before the timelock delay is rejected.
7. Final recovery replaces the owner key on-chain.
8. The SmartWallet address and all asset balances remain 100% intact.
9. The old owner key is permanently blocked from authorizing transactions.
10. The new owner key successfully authorizes transfers.

---

## Documentation Links

- [System Architecture Specification](docs/architecture.md)
- [Security Controls & Invariants](docs/security.md)
- [Threat Model & Adversary Analysis](docs/threat-model.md)
- [Interactive Local Demo Guide](docs/demo-guide.md)

---

## License

MIT License. Designed and engineered for self-custodial security.
