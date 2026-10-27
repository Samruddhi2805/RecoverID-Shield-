import { ethers } from "ethers";
import {
  RecoveryModuleABI,
  WalletFactoryABI,
  SmartWalletABI
} from "@recoverid/shared";
import { addActivity, updateGuardianStatus } from "../db";

export class ChainMonitorService {
  private provider: ethers.JsonRpcProvider | null = null;
  private isPolling = false;

  constructor() {
    const rpcUrl = process.env.ANVIL_RPC_URL || process.env.VITE_RPC_URL || "http://127.0.0.1:8545";
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
    } catch (e) {
      console.warn("Could not connect to JSON-RPC provider at:", rpcUrl);
    }
  }

  public getProvider(): ethers.JsonRpcProvider | null {
    return this.provider;
  }

  public async getWalletState(walletAddress: string, recoveryModuleAddress?: string) {
    if (!this.provider) throw new Error("Provider not connected");
    const wallet = new ethers.Contract(walletAddress, SmartWalletABI, this.provider);
    const owner = await wallet.owner();
    const recoveryModule = await wallet.recoveryModule();
    const nonce = await wallet.nonce();
    const balance = await this.provider.getBalance(walletAddress);

    let guardians: string[] = [];
    let guardiansConfigured = false;
    let activeRequestId = 0;
    let delaySeconds = 86400;

    const moduleAddress = recoveryModuleAddress || recoveryModule;
    if (moduleAddress && moduleAddress !== ethers.ZeroAddress) {
      try {
        const module = new ethers.Contract(moduleAddress, RecoveryModuleABI, this.provider);
        guardiansConfigured = await module.guardiansConfigured(walletAddress);
        if (guardiansConfigured) {
          const rawGuardians = await module.getGuardians(walletAddress);
          guardians = [...rawGuardians];
        }
        activeRequestId = Number(await module.activeRequestId(walletAddress));
        delaySeconds = Number(await module.getEffectiveDelay(walletAddress));
      } catch (err) {
        // Module might not have custom view or uninitialized
      }
    }

    return {
      address: walletAddress,
      owner,
      recoveryModule,
      ethBalance: ethers.formatEther(balance),
      nonce: Number(nonce),
      guardians,
      guardiansConfigured,
      activeRequestId,
      delaySeconds
    };
  }
}

export const chainMonitor = new ChainMonitorService();
