import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  SmartWalletABI,
  RecoveryModuleABI,
  MockERC20ABI,
  WalletFactoryABI,
  type EncryptedKeystore,
  type RecoveryRequestView
} from "@recoverid/shared";
import { getContractAddresses } from "../contracts/addresses";

export interface DevAccount {
  label: string;
  role: "deployer" | "owner" | "guardian1" | "guardian2" | "guardian3" | "new_owner" | "custom";
  address: string;
  privateKey: string;
}

export const PRESET_DEV_ACCOUNTS: DevAccount[] = [
  {
    label: "Local Owner (Anvil #0)",
    role: "owner",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  },
  {
    label: "Guardian 1 - Alice (Anvil #1)",
    role: "guardian1",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  },
  {
    label: "Guardian 2 - Bob (Anvil #2)",
    role: "guardian2",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
  },
  {
    label: "Guardian 3 - Charlie (Anvil #3)",
    role: "guardian3",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
  },
  {
    label: "New Owner Candidate (Anvil #4)",
    role: "new_owner",
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
  }
];

interface WalletContextType {
  provider: ethers.JsonRpcProvider;
  currentSigner: ethers.Wallet | null;
  currentAddress: string;
  smartWalletAddress: string | null;
  setSmartWalletAddress: (addr: string | null) => void;
  ownerAddress: string | null;
  isCurrentOwner: boolean;
  ethBalance: string;
  tokenBalance: string;
  guardians: string[];
  guardiansConfigured: boolean;
  activeRequestId: number;
  activeRecovery: RecoveryRequestView | null;
  recoveryDelay: number;
  loading: boolean;
  error: string | null;
  switchSigner: (privateKey: string) => void;
  setLocalKeystore: (keystore: EncryptedKeystore) => void;
  activeKeystore: EncryptedKeystore | null;
  refreshState: () => Promise<void>;
  contractAddresses: ReturnType<typeof getContractAddresses>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const contractAddresses = getContractAddresses();
  const [provider] = useState(() => new ethers.JsonRpcProvider(contractAddresses.rpcUrl));

  // Default to Owner dev account for convenience, or saved private key
  const [currentPrivateKey, setCurrentPrivateKey] = useState<string>(() => {
    return localStorage.getItem("recoverid_active_key") || PRESET_DEV_ACCOUNTS[0].privateKey;
  });

  const [currentSigner, setCurrentSigner] = useState<ethers.Wallet | null>(null);
  const [activeKeystore, setActiveKeystore] = useState<EncryptedKeystore | null>(() => {
    const raw = localStorage.getItem("recoverid_keystore");
    return raw ? JSON.parse(raw) : null;
  });

  const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(() => {
    return localStorage.getItem("recoverid_smart_wallet") || null;
  });

  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string>("0.00");
  const [tokenBalance, setTokenBalance] = useState<string>("0.00");
  const [guardians, setGuardians] = useState<string[]>([]);
  const [guardiansConfigured, setGuardiansConfigured] = useState<boolean>(false);
  const [activeRequestId, setActiveRequestId] = useState<number>(0);
  const [activeRecovery, setActiveRecovery] = useState<RecoveryRequestView | null>(null);
  const [recoveryDelay, setRecoveryDelay] = useState<number>(60);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync signer with current private key
  useEffect(() => {
    try {
      const wallet = new ethers.Wallet(currentPrivateKey, provider);
      setCurrentSigner(wallet);
      localStorage.setItem("recoverid_active_key", currentPrivateKey);
    } catch (e: any) {
      console.error("Failed to initialize signer from private key:", e);
    }
  }, [currentPrivateKey, provider]);

  const switchSigner = useCallback((pk: string) => {
    setCurrentPrivateKey(pk);
  }, []);

  const setLocalKeystore = useCallback((ks: EncryptedKeystore) => {
    setActiveKeystore(ks);
    localStorage.setItem("recoverid_keystore", JSON.stringify(ks));
  }, []);

  const refreshState = useCallback(async () => {
    if (!smartWalletAddress || !ethers.isAddress(smartWalletAddress)) {
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const walletContract = new ethers.Contract(smartWalletAddress, SmartWalletABI, provider);
      const onChainOwner = await walletContract.owner();
      setOwnerAddress(onChainOwner);

      // Balances
      const balanceWei = await provider.getBalance(smartWalletAddress);
      setEthBalance(ethers.formatEther(balanceWei));

      if (ethers.isAddress(contractAddresses.mockTokenAddress)) {
        try {
          const tokenContract = new ethers.Contract(contractAddresses.mockTokenAddress, MockERC20ABI, provider);
          const tBal = await tokenContract.balanceOf(smartWalletAddress);
          setTokenBalance(ethers.formatEther(tBal));
        } catch {
          setTokenBalance("0.00");
        }
      }

      // Recovery module state
      if (ethers.isAddress(contractAddresses.recoveryModuleAddress)) {
        const recoveryModule = new ethers.Contract(
          contractAddresses.recoveryModuleAddress,
          RecoveryModuleABI,
          provider
        );

        const configured = await recoveryModule.guardiansConfigured(smartWalletAddress);
        setGuardiansConfigured(configured);

        if (configured) {
          const rawGuardians = await recoveryModule.getGuardians(smartWalletAddress);
          setGuardians([...rawGuardians]);
        }

        const delay = await recoveryModule.getEffectiveDelay(smartWalletAddress);
        setRecoveryDelay(Number(delay));

        const activeId = Number(await recoveryModule.activeRequestId(smartWalletAddress));
        setActiveRequestId(activeId);

        if (activeId > 0) {
          const req = await recoveryModule.getRequest(activeId);
          const currentBlock = await provider.getBlock("latest");
          const now = currentBlock ? currentBlock.timestamp : Math.floor(Date.now() / 1000);

          const unlockTime = Number(req.createdAt) + Number(req.executionDelay);
          const expirationTime = Number(req.expirationTime);
          const remaining = Math.max(0, unlockTime - now);
          const approvalCount = Number(req.approvalCount);
          const canExecute = approvalCount >= 2 && remaining === 0 && !req.executed && !req.canceled && now <= expirationTime;

          const approvals: Record<string, boolean> = {};
          if (configured) {
            const rawG = await recoveryModule.getGuardians(smartWalletAddress);
            for (const g of rawG) {
              approvals[g.toLowerCase()] = await recoveryModule.hasApproved(activeId, g);
            }
          }

          setActiveRecovery({
            id: activeId,
            wallet: req.wallet,
            proposedOwner: req.proposedOwner,
            createdAt: Number(req.createdAt),
            executionDelay: Number(req.executionDelay),
            unlockTime,
            expirationTime,
            approvalCount,
            executed: req.executed,
            canceled: req.canceled,
            initiator: req.initiator,
            approvals,
            canExecute,
            isExpired: now > expirationTime,
            remainingDelaySeconds: remaining
          });
        } else {
          setActiveRecovery(null);
        }
      }
    } catch (err: any) {
      console.warn("Could not load on-chain wallet state:", err);
      setError(err.message || "Failed to load smart wallet state");
    } finally {
      setLoading(false);
    }
  }, [smartWalletAddress, provider, contractAddresses]);

  // Save selected smart wallet
  useEffect(() => {
    if (smartWalletAddress) {
      localStorage.setItem("recoverid_smart_wallet", smartWalletAddress);
      refreshState();
    }
  }, [smartWalletAddress, refreshState]);

  // Periodic poll every 5 seconds for live on-chain updates
  useEffect(() => {
    const timer = setInterval(() => {
      refreshState();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshState]);

  const currentAddress = currentSigner ? currentSigner.address : "";
  const isCurrentOwner = Boolean(
    ownerAddress && currentAddress && ownerAddress.toLowerCase() === currentAddress.toLowerCase()
  );

  return (
    <WalletContext.Provider
      value={{
        provider,
        currentSigner,
        currentAddress,
        smartWalletAddress,
        setSmartWalletAddress,
        ownerAddress,
        isCurrentOwner,
        ethBalance,
        tokenBalance,
        guardians,
        guardiansConfigured,
        activeRequestId,
        activeRecovery,
        recoveryDelay,
        loading,
        error,
        switchSigner,
        setLocalKeystore,
        activeKeystore,
        refreshState,
        contractAddresses
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
