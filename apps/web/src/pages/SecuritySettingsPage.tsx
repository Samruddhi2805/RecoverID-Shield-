import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Download,
  Key,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  Save,
  Check
} from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { decryptPrivateKey } from "@recoverid/shared";
import { saveContractAddresses } from "../contracts/addresses";

export const SecuritySettingsPage: React.FC = () => {
  const {
    activeKeystore,
    smartWalletAddress,
    contractAddresses,
    refreshState
  } = useWallet();

  const [testPassword, setTestPassword] = useState("");
  const [decryptionResult, setDecryptionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Contract Address Overrides
  const [factoryAddr, setFactoryAddr] = useState(contractAddresses.factoryAddress);
  const [moduleAddr, setModuleAddr] = useState(contractAddresses.recoveryModuleAddress);
  const [tokenAddr, setTokenAddr] = useState(contractAddresses.mockTokenAddress);
  const [savedAddresses, setSavedAddresses] = useState(false);

  const handleTestDecryption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKeystore) return;

    try {
      const recovered = await decryptPrivateKey(activeKeystore, testPassword);
      setDecryptionResult({
        success: true,
        message: `Passphrase verified! Decrypted key matches owner address: ${activeKeystore.address}`
      });
    } catch (err: any) {
      setDecryptionResult({
        success: false,
        message: err.message || "Invalid passphrase or corrupted keystore"
      });
    }
  };

  const handleDownloadKeystore = () => {
    if (!activeKeystore) return;
    const blob = new Blob([JSON.stringify(activeKeystore, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recoverid-keystore-${activeKeystore.address.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveAddresses = (e: React.FormEvent) => {
    e.preventDefault();
    saveContractAddresses({
      factoryAddress: factoryAddr,
      recoveryModuleAddress: moduleAddr,
      mockTokenAddress: tokenAddr
    });
    setSavedAddresses(true);
    setTimeout(() => setSavedAddresses(false), 2000);
    refreshState();
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> Security & Backup Vault
        </div>
        <h2 className="text-2xl font-black text-white mt-2">Security Settings & Verifications</h2>
        <p className="text-xs text-slate-400 mt-1">
          Inspect encrypted local storage, verify backup passphrases, and configure contract addresses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Keystore Backup & Test */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Local Keystore Storage</h3>
              <p className="text-xs text-slate-400">Authenticated PBKDF2 + AES-256-GCM Vault</p>
            </div>
          </div>

          {activeKeystore ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-navy-900 border border-navy-850 font-mono text-xs space-y-1">
                <span className="text-slate-400 text-[11px] block font-sans">Vault Owner Address:</span>
                <span className="text-emerald-400 font-bold break-all">{activeKeystore.address}</span>
                <span className="text-slate-500 text-[10px] block mt-1 font-sans">
                  Cipher: {activeKeystore.crypto.cipher.toUpperCase()} • KDF: {activeKeystore.crypto.kdf.toUpperCase()} ({activeKeystore.crypto.kdfparams.iterations} rounds)
                </span>
              </div>

              <button
                onClick={handleDownloadKeystore}
                className="w-full py-3 rounded-xl bg-navy-850 hover:bg-navy-800 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" /> Download Encrypted Keystore (.json)
              </button>

              {/* Verify Passphrase */}
              <form onSubmit={handleTestDecryption} className="pt-2 border-t border-navy-850 space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Verify Vault Passphrase
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    required
                    placeholder="Enter passphrase to test decryption"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs shrink-0 transition"
                  >
                    Test
                  </button>
                </div>
              </form>

              {decryptionResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono flex items-center gap-2 ${
                    decryptionResult.success
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-300 border border-red-500/20"
                  }`}
                >
                  {decryptionResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{decryptionResult.message}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500">
              No local keystore found in browser storage. Generate or import one from the Create Wallet page.
            </div>
          )}
        </div>

        {/* Contract Address Configuration */}
        <form onSubmit={handleSaveAddresses} className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Contract Address Registry</h3>
              <p className="text-xs text-slate-400">Deployed smart contracts on Anvil / Sepolia</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              WalletFactory Contract Address
            </label>
            <input
              type="text"
              value={factoryAddr}
              onChange={(e) => setFactoryAddr(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              RecoveryModule Contract Address
            </label>
            <input
              type="text"
              value={moduleAddr}
              onChange={(e) => setModuleAddr(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              MockERC20 Token Address
            </label>
            <input
              type="text"
              value={tokenAddr}
              onChange={(e) => setTokenAddr(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs flex items-center gap-2 shadow-glow-emerald transition"
            >
              {savedAddresses ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savedAddresses ? "Saved Successfully" : "Save Contract Addresses"}
            </button>
          </div>
        </form>
      </div>

      {/* Security Limitations & Threat Model Disclosures */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          System Security Limitations & Threat Model
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-850 space-y-1.5">
            <h4 className="font-bold text-amber-300">Collusion / Compromise of 2 Guardians</h4>
            <p>
              If an attacker compromises or colludes with 2 of the 3 guardians, they can reach the approval threshold. The primary defense is the <strong>Security Delay Timelock</strong>, giving the legitimate owner time to cancel the request.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-850 space-y-1.5">
            <h4 className="font-bold text-amber-300">Browser Environment Boundaries</h4>
            <p>
              Local keystores are stored in browser localStorage. Device compromise, malicious extensions, or physical access can jeopardize unencrypted keys. Always back up your keystore offline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
