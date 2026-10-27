import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const rpcUrl = process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545";
  const deployerKey =
    process.env.DEPLOYER_PRIVATE_KEY ||
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  console.log("Connecting to local blockchain at:", rpcUrl);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(deployerKey, provider);

  const balance = await provider.getBalance(deployer.address);
  console.log(`Deployer Address: ${deployer.address} (${ethers.formatEther(balance)} ETH)`);

  // Read compiled contract artifacts
  const recoveryModuleArtifact = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../contracts/out/RecoveryModule.sol/RecoveryModule.json"),
      "utf8"
    )
  );
  const walletFactoryArtifact = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../contracts/out/WalletFactory.sol/WalletFactory.json"),
      "utf8"
    )
  );
  const mockTokenArtifact = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../contracts/out/MockERC20.sol/MockERC20.json"),
      "utf8"
    )
  );
  const smartWalletArtifact = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../contracts/out/SmartWallet.sol/SmartWallet.json"),
      "utf8"
    )
  );

  let currentNonce = await provider.getTransactionCount(deployer.address, "latest");
  console.log("Starting nonce:", currentNonce);

  console.log("\n1. Deploying RecoveryModule...");
  const RecoveryModuleFactory = new ethers.ContractFactory(
    recoveryModuleArtifact.abi,
    recoveryModuleArtifact.bytecode.object,
    deployer
  );
  const recoveryModule = await RecoveryModuleFactory.deploy(ethers.ZeroAddress, {
    nonce: currentNonce++
  });
  await recoveryModule.waitForDeployment();
  const recoveryModuleAddress = await recoveryModule.getAddress();
  console.log("✓ RecoveryModule deployed at:", recoveryModuleAddress);

  console.log("\n2. Deploying WalletFactory...");
  const WalletFactoryFactory = new ethers.ContractFactory(
    walletFactoryArtifact.abi,
    walletFactoryArtifact.bytecode.object,
    deployer
  );
  const walletFactory = await WalletFactoryFactory.deploy(recoveryModuleAddress, {
    nonce: currentNonce++
  });
  await walletFactory.waitForDeployment();
  const factoryAddress = await walletFactory.getAddress();
  console.log("✓ WalletFactory deployed at:", factoryAddress);

  console.log("\n3. Linking WalletFactory to RecoveryModule...");
  const linkTx = await (recoveryModule as any).setWalletFactory(factoryAddress, {
    nonce: currentNonce++
  });
  await linkTx.wait(1);
  console.log("✓ Linked WalletFactory successfully");

  console.log("\n4. Deploying MockERC20 (rUSD)...");
  const MockTokenFactory = new ethers.ContractFactory(
    mockTokenArtifact.abi,
    mockTokenArtifact.bytecode.object,
    deployer
  );
  const mockToken = await MockTokenFactory.deploy("RecoverID USD", "rUSD", {
    nonce: currentNonce++
  });
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();
  console.log("✓ MockERC20 (rUSD) deployed at:", mockTokenAddress);

  // Preset Guardians for demonstration
  const guardianAlice = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Anvil #1
  const guardianBob = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";   // Anvil #2
  const guardianCharlie = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // Anvil #3

  console.log("\n5. Deploying Initial Demo SmartWallet...");
  const deployWalletTx = await (walletFactory as any).deployWallet(
    deployer.address,
    [guardianAlice, guardianBob, guardianCharlie],
    { nonce: currentNonce++ }
  );
  const receipt = await deployWalletTx.wait(1);

  let smartWalletAddress = "";
  for (const log of receipt.logs) {
    try {
      const parsed = walletFactory.interface.parseLog(log);
      if (parsed && parsed.name === "WalletCreated") {
        smartWalletAddress = parsed.args.wallet;
        break;
      }
    } catch {
      // ignore
    }
  }

  console.log("✓ Demo SmartWallet deployed at:", smartWalletAddress);

  // Configure quick 60-second recovery delay for local testing
  console.log("\n6. Setting demo security delay (60 seconds)...");
  const setDelayTx = await (recoveryModule as any).setWalletRecoveryDelay(smartWalletAddress, 60, {
    nonce: currentNonce++
  });
  await setDelayTx.wait(1);
  console.log("✓ Set security delay to 60s");

  // Fund demo wallet with 10 ETH and 1,000 rUSD
  console.log("\n7. Funding SmartWallet with 10 ETH and 1,000 rUSD tokens...");
  const fundEthTx = await deployer.sendTransaction({
    to: smartWalletAddress,
    value: ethers.parseEther("10.0"),
    nonce: currentNonce++
  });
  await fundEthTx.wait(1);

  const mintTokensTx = await (mockToken as any).mint(
    smartWalletAddress,
    ethers.parseEther("1000.0"),
    { nonce: currentNonce++ }
  );
  await mintTokensTx.wait(1);
  console.log("✓ SmartWallet successfully funded");

  // Save deployed addresses to JSON and .env
  const deployedAddresses = {
    network: "anvil",
    chainId: 31337,
    recoveryModule: recoveryModuleAddress,
    walletFactory: factoryAddress,
    mockToken: mockTokenAddress,
    demoSmartWallet: smartWalletAddress,
    guardians: [guardianAlice, guardianBob, guardianCharlie],
    deployedAt: new Date().toISOString()
  };

  const outputPath = path.resolve(__dirname, "../contracts/deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedAddresses, null, 2));
  console.log(`\n✓ Saved deployment manifest to: ${outputPath}`);

  // Update or create .env file
  const envContent = `# Auto-generated RecoverID Shield deployment configuration
ANVIL_RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
DEPLOYER_PRIVATE_KEY=${deployerKey}

VITE_RPC_URL=http://127.0.0.1:8545
VITE_CHAIN_ID=31337
VITE_FACTORY_ADDRESS=${factoryAddress}
VITE_RECOVERY_MODULE_ADDRESS=${recoveryModuleAddress}
VITE_MOCK_ERC20_ADDRESS=${mockTokenAddress}
VITE_API_BASE_URL=http://localhost:4000

PORT=4000
DATABASE_PATH=./data/recoverid.sqlite
CORS_ORIGIN=http://localhost:5173
EMAIL_PROVIDER=mock
`;

  fs.writeFileSync(path.resolve(__dirname, "../.env"), envContent);
  console.log("✓ Updated root .env file with active contract addresses");

  console.log("\n=======================================================");
  console.log(" RECOVERID SHIELD LOCAL DEPLOYMENT COMPLETE");
  console.log("=======================================================");
  console.log(`RecoveryModule: ${recoveryModuleAddress}`);
  console.log(`WalletFactory:  ${factoryAddress}`);
  console.log(`Mock Token:     ${mockTokenAddress}`);
  console.log(`SmartWallet:    ${smartWalletAddress}`);
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
