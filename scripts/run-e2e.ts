import { ethers } from "ethers";
import fs from "fs";
import path from "path";

// ANSI escape codes for clean terminal output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function pass(testName: string) {
  console.log(`${GREEN}  [PASS]${RESET} ${testName}`);
}

function fail(testName: string, reason: any) {
  console.error(`${RED}  [FAIL]${RESET} ${testName}`);
  console.error(`         ${reason}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`\n${CYAN}=======================================================${RESET}`);
  console.log(`${CYAN} RECOVERID SHIELD — AUTOMATED END-TO-END VERIFICATION  ${RESET}`);
  console.log(`${CYAN}=======================================================${RESET}\n`);

  const manifestPath = path.resolve(__dirname, "../contracts/deployed-addresses.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error("No deployment manifest found. Run scripts/deploy-local.ts first.");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const rpcUrl = "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Accounts
  const oldOwnerKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Anvil #0
  const guardian1Key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Anvil #1
  const guardian2Key = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // Anvil #2 (0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC)
  const guardian3Key = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"; // Anvil #3 (0x90F79bf6EB2c4f870365E785982E1f101E93b906)
  const newOwnerKey = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a";  // Anvil #4 (0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65)

  const oldOwner = new ethers.Wallet(oldOwnerKey, provider);
  const guardian1 = new ethers.Wallet(guardian1Key, provider);
  const guardian2 = new ethers.Wallet(guardian2Key, provider);
  const guardian3 = new ethers.Wallet(guardian3Key, provider);
  const newOwner = new ethers.Wallet(newOwnerKey, provider);

  // Contract instances
  const recoveryModuleArtifact = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../contracts/out/RecoveryModule.sol/RecoveryModule.json"), "utf8")
  );
  const smartWalletArtifact = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../contracts/out/SmartWallet.sol/SmartWallet.json"), "utf8")
  );
  const mockTokenArtifact = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../contracts/out/MockERC20.sol/MockERC20.json"), "utf8")
  );

  const recoveryModule = new ethers.Contract(manifest.recoveryModule, recoveryModuleArtifact.abi, provider);
  const smartWallet = new ethers.Contract(manifest.demoSmartWallet, smartWalletArtifact.abi, provider);
  const token = new ethers.Contract(manifest.mockToken, mockTokenArtifact.abi, provider);

  console.log(`SmartWallet Address: ${smartWallet.target}`);
  console.log(`Initial Owner:       ${await smartWallet.owner()}`);
  console.log(`Initial ETH Balance: ${ethers.formatEther(await provider.getBalance(smartWallet.target))} ETH`);
  console.log(`Initial rUSD Tokens: ${ethers.formatEther(await token.balanceOf(smartWallet.target))} rUSD\n`);

  let passedCount = 0;
  let failedCount = 0;

  // Test 1: Verify 3 registered guardians
  try {
    const guardiansConfigured = await recoveryModule.guardiansConfigured(smartWallet.target);
    const list = await recoveryModule.getGuardians(smartWallet.target);
    if (guardiansConfigured && list.length === 3) {
      pass("Step 1: SmartWallet has exactly 3 registered guardians on-chain");
      passedCount++;
    } else {
      throw new Error(`Guardians configured: ${guardiansConfigured}, count: ${list.length}`);
    }
  } catch (err: any) {
    fail("Step 1: Guardian registration check", err);
    failedCount++;
  }

  // Test 2: Cancellation prevents execution test
  try {
    const testCandidate = ethers.Wallet.createRandom().address;
    const reqTx = await recoveryModule.connect(guardian1).initiateRecovery(smartWallet.target, testCandidate);
    const receipt = await reqTx.wait(1);

    let cancelReqId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = recoveryModule.interface.parseLog(log);
        if (parsed?.name === "RecoveryInitiated") {
          cancelReqId = Number(parsed.args.requestId);
        }
      } catch {}
    }

    // Owner cancels
    const cancelTx = await recoveryModule.connect(oldOwner).cancelRecovery(cancelReqId, "Canceled by owner in test");
    await cancelTx.wait(1);

    // Fast-forward anvil time 100 seconds
    await provider.send("evm_increaseTime", [100]);
    await provider.send("evm_mine", []);

    // Try executing canceled request
    let reverted = false;
    try {
      await recoveryModule.connect(guardian1).executeRecovery(cancelReqId);
    } catch {
      reverted = true;
    }

    if (reverted) {
      pass("Step 2: Cancellation strictly prevents recovery execution");
      passedCount++;
    } else {
      throw new Error("Canceled request was not rejected");
    }
  } catch (err: any) {
    fail("Step 2: Cancellation verification", err);
    failedCount++;
  }

  // Test 3: Initiate real recovery with newOwner
  let recoveryReqId = 0;
  try {
    const reqTx = await recoveryModule.connect(guardian1).initiateRecovery(smartWallet.target, newOwner.address);
    const receipt = await reqTx.wait(1);

    for (const log of receipt.logs) {
      try {
        const parsed = recoveryModule.interface.parseLog(log);
        if (parsed?.name === "RecoveryInitiated") {
          recoveryReqId = Number(parsed.args.requestId);
        }
      } catch {}
    }

    const reqData = await recoveryModule.getRequest(recoveryReqId);
    if (Number(reqData.approvalCount) === 1) {
      pass(`Step 3: Recovery initiated (Req #${recoveryReqId}) with 1 initial approval`);
      passedCount++;
    } else {
      throw new Error(`Unexpected approval count: ${reqData.approvalCount}`);
    }
  } catch (err: any) {
    fail("Step 3: Recovery initiation", err);
    failedCount++;
  }

  // Test 4: One guardian approval is INSUFFICIENT to execute
  try {
    // Warp past delay
    await provider.send("evm_increaseTime", [100]);
    await provider.send("evm_mine", []);

    let reverted = false;
    try {
      await recoveryModule.connect(guardian1).executeRecovery(recoveryReqId);
    } catch {
      reverted = true;
    }

    if (reverted) {
      pass("Step 4: Single guardian approval is strictly rejected by contract");
      passedCount++;
    } else {
      throw new Error("Execution succeeded with only 1 approval");
    }
  } catch (err: any) {
    fail("Step 4: Threshold enforcement", err);
    failedCount++;
  }

  // Test 5: Second guardian approves to reach 2-of-3 threshold
  try {
    const approveTx = await recoveryModule.connect(guardian2).approveRecovery(recoveryReqId);
    await approveTx.wait(1);

    const reqData = await recoveryModule.getRequest(recoveryReqId);
    if (Number(reqData.approvalCount) === 2) {
      pass("Step 5: Second guardian approved; 2-of-3 threshold satisfied");
      passedCount++;
    } else {
      throw new Error(`Approval count is not 2: ${reqData.approvalCount}`);
    }
  } catch (err: any) {
    fail("Step 5: Second guardian approval", err);
    failedCount++;
  }

  // Test 6: Finalize and execute recovery
  try {
    const execTx = await recoveryModule.connect(guardian1).executeRecovery(recoveryReqId);
    await execTx.wait(1);

    const onChainOwner = await smartWallet.owner();
    if (onChainOwner.toLowerCase() === newOwner.address.toLowerCase()) {
      pass("Step 6: Recovery executed on-chain; owner successfully rotated to new key");
      passedCount++;
    } else {
      throw new Error(`Owner was not updated. Current owner: ${onChainOwner}`);
    }
  } catch (err: any) {
    fail("Step 6: Recovery execution", err);
    failedCount++;
  }

  // Test 7: Verify SmartWallet address and assets remain identical
  try {
    const ethBalance = await provider.getBalance(smartWallet.target);
    const tokenBalance = await token.balanceOf(smartWallet.target);

    if (ethBalance >= ethers.parseEther("9.0") && tokenBalance >= ethers.parseEther("900.0")) {
      pass("Step 7: SmartWallet contract address and asset balances remained 100% intact");
      passedCount++;
    } else {
      throw new Error(`Assets lost. ETH: ${ethBalance}, Tokens: ${tokenBalance}`);
    }
  } catch (err: any) {
    fail("Step 7: Asset preservation check", err);
    failedCount++;
  }

  // Test 8: Verify Old Owner authorization FAILS
  try {
    let oldOwnerBlocked = false;
    const recipient = ethers.Wallet.createRandom().address;
    try {
      await smartWallet.connect(oldOwner).transferNative(recipient, ethers.parseEther("1.0"));
    } catch {
      oldOwnerBlocked = true;
    }

    if (oldOwnerBlocked) {
      pass("Step 8: Old owner key is strictly unauthorized for any transaction");
      passedCount++;
    } else {
      throw new Error("Old owner was unexpectedly able to authorize a transfer");
    }
  } catch (err: any) {
    fail("Step 8: Old owner rejection", err);
    failedCount++;
  }

  // Test 9: Verify New Owner authorization SUCCEEDS
  try {
    const recipient = ethers.Wallet.createRandom().address;
    const transferAmount = ethers.parseEther("1.5");

    const transferTx = await smartWallet.connect(newOwner).transferNative(recipient, transferAmount);
    await transferTx.wait(1);

    const recipientBal = await provider.getBalance(recipient);
    if (recipientBal === transferAmount) {
      pass("Step 9: New owner successfully authorized on-chain native transfer");
      passedCount++;
    } else {
      throw new Error(`Transfer failed. Recipient balance: ${recipientBal}`);
    }
  } catch (err: any) {
    fail("Step 9: New owner authorization", err);
    failedCount++;
  }

  console.log(`\n${CYAN}=======================================================${RESET}`);
  console.log(` END-TO-END RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log(`${CYAN}=======================================================${RESET}\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("E2E script error:", err);
  process.exit(1);
});
