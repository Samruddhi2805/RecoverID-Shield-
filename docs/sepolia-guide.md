# Sepolia Testnet Deployment Guide

This guide details the procedure for deploying RecoverID Shield to Ethereum's Sepolia testnet.

> **CRITICAL SECURITY DIRECTIVE:**
> - Never deploy to Ethereum Mainnet without third-party security audits.
> - Never invent contract addresses or claim an unverified testnet deployment succeeded.
> - Only deploy with disposable testnet funds.

---

## 1. Prerequisites

1. **Sepolia ETH:** Ensure your deployer account has at least `0.05 Sepolia ETH` for gas from an official faucet.
2. **Sepolia RPC URL:** Obtain an endpoint from Infura, Alchemy, or public node.
3. **Etherscan API Key (Optional):** For verifying contract bytecode on Sepolia Etherscan.

---

## 2. Configuration

Set the environment variables in your `.env` file:

```bash
# Sepolia Testnet Configuration
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
SEPOLIA_CHAIN_ID=11155111
SEPOLIA_DEPLOYER_PRIVATE_KEY=0x<YOUR_DISPOSABLE_TESTNET_PRIVATE_KEY>
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
```

---

## 3. Deploy Contracts Using Foundry

Run the Foundry deployment script against Sepolia:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $SEPOLIA_DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

---

## 4. Verification and Frontend Update

Upon successful broadcast:
1. Copy the emitted contract addresses for `RecoveryModule`, `WalletFactory`, and `MockERC20`.
2. Update your `.env` or paste the deployed addresses into the **Security Settings** page inside the Web dashboard:
   ```bash
   VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
   VITE_CHAIN_ID=11155111
   VITE_FACTORY_ADDRESS=0x...
   VITE_RECOVERY_MODULE_ADDRESS=0x...
   VITE_MOCK_ERC20_ADDRESS=0x...
   ```
3. Test a testnet recovery request using your Sepolia accounts.
