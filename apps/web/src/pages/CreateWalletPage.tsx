import React, { useState } from "react";
import {
  Key,
  ShieldCheck,
  Lock,
  Download,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Sparkles
} from "lucide-react";
import {
  generateLocalKey,
  encryptPrivateKey,
  type EncryptedKeystore,
  WalletFactoryABI
} from "@recoverid/shared";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";

interface CreateWalletPageProps {
  onWalletCreated: (walletAddress: string) => void;
}

export const CreateWalletPage: React.FC<CreateWalletPageProps> = ({ onWalletCreated }) => {
  const { currentSigner, contractAddresses, setSmartWalletAddress, setLocalKeystore } = useWallet();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [localKey, setLocalKey] = useState<{ address: string; privateKey: string; mnemonic?: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [keystore, setKeystore] = useState<EncryptedKeystore | null>(null);
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Deployment states
  const [deploying, setDeploying] = useState(false);
  const [deployedWallet, setDeployedWallet] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Step 1: Generate key
  const handleGenerate = () => {
    const generated = generateLocalKey();
    setLocalKey(generated);
    setStep(2);
  };

  // Step 2: Encrypt key
  const handleEncrypt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localKey) return;
    if (password.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    const encrypted = await encryptPrivateKey(localKey.privateKey, password);
    setKeystore(encrypted);
    setLocalKeystore(encrypted);
    setStep(3);
  };

  // Download encrypted keystore JSON
  const handleDownloadKeystore = () => {
    if (!keystore) return;
    const blob = new Blob([JSON.stringify(keystore, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recoverid-keystore-${keystore.address.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Step 4: Deploy smart contract wallet
  const handleDeploy = async () => {
    if (!localKey || !currentSigner) return;
    setDeploying(true);
    setDeployError(null);

    try {
      const factory = new ethers.Contract(
        contractAddresses.factoryAddress,
        WalletFactoryABI,
        currentSigner
      );

      // Deploy with empty guardians initially (guardians can be registered in setup)
      const emptyGuardians = [ethers.ZeroAddress, ethers.ZeroAddress, ethers.ZeroAddress] as [string, string, string];
      const tx = await factory.deployWallet(localKey.address, emptyGuardians);
      const receipt = await tx.wait(1);

      // Find WalletCreated event
      let newWalletAddress = "";
      for (const log of receipt.logs) {
        try {
          const parsed = factory.interface.parseLog(log);
          if (parsed && parsed.name === "WalletCreated") {
            newWalletAddress = parsed.args.wallet;
            break;
          }
        } catch {
          // not this event
        }
      }

      if (!newWalletAddress) {
        // Fallback: query getWalletsByOwner
        const wallets = await factory.getWalletsByOwner(localKey.address);
        newWalletAddress = wallets[wallets.length - 1];
      }

      setDeployedWallet(newWalletAddress);
      setSmartWalletAddress(newWalletAddress);

      // Post creation activity to backend API
      try {
        await fetch("http://localhost:4000/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: newWalletAddress,
            type: "CREATED",
            title: "Smart Contract Wallet Deployed",
            description: `Owner key initialized to ${localKey.address.substring(0, 8)}...`,
            actor: currentSigner.address,
            txHash: receipt.hash
          })
        });
      } catch {
        // ignore
      }

      setStep(4);
    } catch (err: any) {
      console.error("Deployment failed:", err);
      setDeployError(err.reason || err.message || "Failed to deploy smart contract wallet");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-10 px-4">
        {[
          { num: 1, label: "Generate Key" },
          { num: 2, label: "Encrypt Storage" },
          { num: 3, label: "Backup Vault" },
          { num: 4, label: "Deploy on Chain" }
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition ${
                step === s.num
                  ? "bg-emerald-500 text-navy-950 shadow-glow-emerald"
                  : step > s.num
                  ? "bg-navy-800 text-emerald-400 border border-emerald-500/30"
                  : "bg-navy-900 text-slate-500 border border-navy-800"
              }`}
            >
              {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
            <span
              className={`text-xs font-semibold hidden sm:inline ${
                step === s.num ? "text-white" : "text-slate-500"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Generate */}
      {step === 1 && (
        <div className="glass-panel p-8 rounded-3xl border border-navy-800 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Generate Owner Private Key</h2>
          <p className="text-sm text-slate-300 mt-2 max-w-lg mx-auto">
            Your owner key authorizes day-to-day transactions. It will be generated purely in your browser using cryptographic entropy.
          </p>

          <div className="mt-8 p-4 rounded-2xl bg-navy-900/80 border border-navy-800 text-left max-w-lg mx-auto text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" /> Client-Side Key Privacy Guarantee
            </div>
            <p>
              • Private keys and seed phrases are <strong>NEVER</strong> transmitted to our API or server.
            </p>
            <p>
              • Storage will be authenticated and encrypted with AES-256-GCM.
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={handleGenerate}
              className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-extrabold text-sm flex items-center gap-2 mx-auto shadow-glow-emerald transition"
            >
              <Sparkles className="w-4 h-4" /> Generate Owner Keypair
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Encrypt */}
      {step === 2 && localKey && (
        <form onSubmit={handleEncrypt} className="glass-panel p-8 rounded-3xl border border-navy-800 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Protect with Local Passphrase</h2>
              <p className="text-xs text-slate-400">
                Derived via PBKDF2 with 100,000 iterations to encrypt your private key
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-navy-900/80 border border-navy-800 font-mono text-xs mb-6">
            <span className="text-slate-400 block text-[11px] mb-1 font-sans">Derived Owner Address:</span>
            <span className="text-emerald-400 font-bold">{localKey.address}</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Master Passphrase
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-3 rounded-xl glass-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm Master Passphrase
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter passphrase"
                className="w-full px-4 py-3 rounded-xl glass-input text-sm"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-sm flex items-center gap-2 shadow-glow-emerald transition"
            >
              Encrypt & Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Backup Vault */}
      {step === 3 && localKey && (
        <div className="glass-panel p-8 rounded-3xl border border-navy-800 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Secure Backup & Warnings</h2>
              <p className="text-xs text-slate-400">
                Crucial security instructions before deploying your smart contract
              </p>
            </div>
          </div>

          {/* Explicit Warnings Required by Prompt */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-4 h-4" /> Important Security Disclaimers:
            </div>
            <p>
              • <strong>Browser storage is NOT perfectly secure:</strong> Clearing your cache or malware could delete local keys. Always save an encrypted backup.
            </p>
            <p>
              • <strong>Email login NEVER grants wallet control:</strong> Emails are solely used for notifications and guardian invites. Only cryptographic signatures control the wallet.
            </p>
          </div>

          {/* Raw Private Key Display */}
          <div className="p-4 rounded-2xl bg-navy-900 border border-navy-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">Plaintext Private Key:</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(localKey.privateKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="font-mono text-xs text-slate-300 break-all p-3 rounded-xl bg-navy-950 border border-navy-850">
              {localKey.privateKey}
            </div>
          </div>

          {/* Download JSON keystore */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-navy-900/60 border border-navy-800">
            <div>
              <span className="text-sm font-bold text-white block">Encrypted Keystore (JSON)</span>
              <span className="text-xs text-slate-400 font-sans">
                Standard AES-256-GCM encrypted format (requires your password to unlock)
              </span>
            </div>
            <button
              onClick={handleDownloadKeystore}
              className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-emerald-400 border border-navy-700 text-xs font-bold flex items-center gap-2 transition"
            >
              <Download className="w-4 h-4" /> Download Keystore
            </button>
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-4 rounded-xl bg-navy-900/30 border border-navy-800 cursor-pointer">
            <input
              type="checkbox"
              checked={backupConfirmed}
              onChange={(e) => setBackupConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-emerald-500 bg-navy-950 border-navy-700 focus:ring-emerald-500"
            />
            <span className="text-xs text-slate-300 leading-relaxed">
              I have securely backed up my private key / encrypted keystore file. I understand that RecoverID Shield cannot recover my wallet without my 2-of-3 guardians.
            </span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleDeploy}
              disabled={!backupConfirmed || deploying}
              className={`px-7 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition ${
                backupConfirmed && !deploying
                  ? "bg-emerald-500 hover:bg-emerald-400 text-navy-950 shadow-glow-emerald cursor-pointer"
                  : "bg-navy-800 text-slate-500 cursor-not-allowed border border-navy-700"
              }`}
            >
              {deploying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Deploying on-chain...
                </>
              ) : (
                <>
                  Deploy Smart Contract Wallet <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {deployError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-mono">
              {deployError}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 4 && deployedWallet && (
        <div className="glass-panel p-8 rounded-3xl border border-navy-800 text-center animate-fade-in space-y-6">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-extrabold text-white">Smart Contract Wallet Deployed!</h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Your self-custodial smart wallet is live on the blockchain with your newly generated owner key.
          </p>

          <div className="p-4 rounded-2xl bg-navy-900 border border-navy-800 max-w-md mx-auto text-left font-mono text-xs">
            <span className="text-slate-400 text-[11px] block mb-1 font-sans">Smart Contract Address:</span>
            <span className="text-emerald-400 font-bold break-all">{deployedWallet}</span>
          </div>

          <div className="pt-4 flex justify-center gap-4">
            <button
              onClick={() => onWalletCreated(deployedWallet)}
              className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-sm shadow-glow-emerald transition flex items-center gap-2"
            >
              Open Wallet Dashboard <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
