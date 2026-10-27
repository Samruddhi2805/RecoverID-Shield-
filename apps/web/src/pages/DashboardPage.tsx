import React, { useState, useEffect } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Users,
  ShieldCheck,
  Send,
  Coins,
  History,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { ActiveRecoveryBanner } from "../components/ActiveRecoveryBanner";
import { SmartWalletABI, MockERC20ABI } from "@recoverid/shared";
import { ethers } from "ethers";

interface DashboardPageProps {
  onGoToGuardians: () => void;
  onGoToRecovery: () => void;
  onGoToCreate: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onGoToGuardians,
  onGoToRecovery,
  onGoToCreate
}) => {
  const {
    smartWalletAddress,
    ownerAddress,
    currentAddress,
    isCurrentOwner,
    ethBalance,
    tokenBalance,
    guardians,
    guardiansConfigured,
    currentSigner,
    contractAddresses,
    refreshState,
    loading
  } = useWallet();

  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedOwner, setCopiedOwner] = useState(false);

  // Send Transfer Modal State
  const [activeModal, setActiveModal] = useState<"sendEth" | "sendToken" | "faucet" | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [txPending, setTxPending] = useState(false);
  const [txMessage, setTxMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Activity list
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (smartWalletAddress) {
      fetch(`http://localhost:4000/api/activity/${smartWalletAddress}`)
        .then((res) => res.json())
        .then((data) => setActivities(data.activities || []))
        .catch(() => {});
    }
  }, [smartWalletAddress]);

  const handleSendEth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSigner || !smartWalletAddress) return;
    setTxPending(true);
    setTxMessage(null);

    try {
      const wallet = new ethers.Contract(smartWalletAddress, SmartWalletABI, currentSigner);
      const parsedAmount = ethers.parseEther(amount);
      const tx = await wallet.transferNative(recipient, parsedAmount);
      setTxMessage({ type: "success", text: "Transaction submitted... waiting for confirmation." });
      const receipt = await tx.wait(1);

      // Record activity
      await fetch("http://localhost:4000/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: smartWalletAddress,
          type: "TRANSACTION_SENT",
          title: "Native ETH Transferred",
          description: `Sent ${amount} ETH to ${recipient.substring(0, 8)}...`,
          actor: currentSigner.address,
          txHash: receipt.hash
        })
      });

      setTxMessage({ type: "success", text: `Sent ${amount} ETH successfully!` });
      setAmount("");
      setRecipient("");
      await refreshState();
    } catch (err: any) {
      console.error(err);
      setTxMessage({ type: "error", text: err.reason || err.message || "Transfer failed" });
    } finally {
      setTxPending(false);
    }
  };

  const handleSendToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSigner || !smartWalletAddress) return;
    setTxPending(true);
    setTxMessage(null);

    try {
      const wallet = new ethers.Contract(smartWalletAddress, SmartWalletABI, currentSigner);
      const parsedAmount = ethers.parseEther(amount);
      const tx = await wallet.transferERC20(contractAddresses.mockTokenAddress, recipient, parsedAmount);
      setTxMessage({ type: "success", text: "Transaction submitted... waiting for confirmation." });
      const receipt = await tx.wait(1);

      // Record activity
      await fetch("http://localhost:4000/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: smartWalletAddress,
          type: "TRANSACTION_SENT",
          title: "ERC-20 Tokens Transferred",
          description: `Sent ${amount} rUSD to ${recipient.substring(0, 8)}...`,
          actor: currentSigner.address,
          txHash: receipt.hash
        })
      });

      setTxMessage({ type: "success", text: `Sent ${amount} rUSD tokens successfully!` });
      setAmount("");
      setRecipient("");
      await refreshState();
    } catch (err: any) {
      console.error(err);
      setTxMessage({ type: "error", text: err.reason || err.message || "Token transfer failed" });
    } finally {
      setTxPending(false);
    }
  };

  // Local Faucet Helper: Fund smart wallet directly with ETH and rUSD
  const handleFundWallet = async () => {
    if (!currentSigner || !smartWalletAddress) return;
    setTxPending(true);
    setTxMessage(null);

    try {
      // Send 2 ETH to smart wallet
      const ethTx = await currentSigner.sendTransaction({
        to: smartWalletAddress,
        value: ethers.parseEther("2.0")
      });
      await ethTx.wait(1);

      // Mint 500 Mock tokens to smart wallet
      if (ethers.isAddress(contractAddresses.mockTokenAddress)) {
        try {
          const token = new ethers.Contract(contractAddresses.mockTokenAddress, MockERC20ABI, currentSigner);
          const mintTx = await token.mint(smartWalletAddress, ethers.parseEther("500"));
          await mintTx.wait(1);
        } catch {
          // ignore
        }
      }

      setTxMessage({ type: "success", text: "Successfully funded wallet with 2.0 ETH and 500 rUSD!" });
      await refreshState();
    } catch (err: any) {
      setTxMessage({ type: "error", text: err.message || "Funding failed" });
    } finally {
      setTxPending(false);
    }
  };

  if (!smartWalletAddress) {
    return (
      <div className="text-center py-20 max-w-xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <Wallet className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-white">No Smart Wallet Connected</h2>
        <p className="text-sm text-slate-300">
          Create a new self-custodial smart wallet or input an existing contract address to begin.
        </p>
        <button
          onClick={onGoToCreate}
          className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-extrabold text-sm shadow-glow-emerald transition inline-flex items-center gap-2"
        >
          Create Smart Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-4">
      {/* Active Recovery Notification */}
      <ActiveRecoveryBanner />

      {/* Wallet Overview Header Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                SMART CONTRACT WALLET
              </span>
              <span className="text-xs text-slate-400 font-mono">Chain ID: 31337 (Anvil)</span>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white font-mono break-all">
                {smartWalletAddress}
              </h2>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(smartWalletAddress);
                  setCopiedWallet(true);
                  setTimeout(() => setCopiedWallet(false), 2000);
                }}
                className="p-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 transition shrink-0"
              >
                {copiedWallet ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Owner key status */}
            <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-mono">
              <span className="text-slate-400">Authorized Owner:</span>
              <span className="text-slate-200 bg-navy-950/80 px-2 py-0.5 rounded border border-navy-800">
                {ownerAddress || "Loading..."}
              </span>

              {isCurrentOwner ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Active Key is Authorized Owner
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> Active Key is NOT Owner (Read-Only)
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={() => setActiveModal("sendEth")}
              disabled={!isCurrentOwner}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isCurrentOwner
                  ? "bg-emerald-500 hover:bg-emerald-400 text-navy-950 shadow-glow-emerald cursor-pointer"
                  : "bg-navy-800 text-slate-500 cursor-not-allowed border border-navy-700"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" /> Send ETH
            </button>
            <button
              onClick={() => setActiveModal("sendToken")}
              disabled={!isCurrentOwner}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                isCurrentOwner
                  ? "bg-navy-850 hover:bg-navy-800 text-white border border-navy-700 hover:border-emerald-500/40 cursor-pointer"
                  : "bg-navy-800 text-slate-500 cursor-not-allowed border border-navy-700"
              }`}
            >
              <Coins className="w-4 h-4 text-emerald-400" /> Send rUSD
            </button>
            <button
              onClick={handleFundWallet}
              disabled={txPending}
              className="px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-2 transition"
              title="Add 2.0 ETH and 500 rUSD for testing"
            >
              <Sparkles className="w-4 h-4" /> Local Faucet
            </button>
          </div>
        </div>
      </div>

      {/* Asset Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Native ETH Balance */}
        <div className="glass-panel p-6 rounded-3xl border border-navy-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Native Asset</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
              ETH
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white font-mono">{parseFloat(ethBalance).toFixed(4)}</span>
            <span className="text-sm font-semibold text-slate-400 ml-2 font-mono">ETH</span>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Preserved permanently across social recoveries
          </div>
        </div>

        {/* ERC-20 Tokens Balance */}
        <div className="glass-panel p-6 rounded-3xl border border-navy-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">ERC-20 Token</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
              rUSD
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-white font-mono">{parseFloat(tokenBalance).toFixed(2)}</span>
            <span className="text-sm font-semibold text-slate-400 ml-2 font-mono">rUSD</span>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            RecoverID USD Mock asset custody test
          </div>
        </div>

        {/* Guardian Security Status */}
        <div className="glass-panel p-6 rounded-3xl border border-navy-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Social Recovery</span>
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-3xl font-extrabold text-white font-mono">
                {guardiansConfigured ? "3 / 3" : `${guardians.length} / 3`}
              </span>
              <span className="text-xs text-slate-400 font-sans">Guardians Registered</span>
            </div>
            <div className="mt-2 text-xs text-emerald-400 font-medium">
              {guardiansConfigured ? "2-of-3 Recovery Protection Active" : "Guardians Not Fully Configured"}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-navy-800 flex justify-between items-center text-xs">
            <button
              onClick={onGoToGuardians}
              className="text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              Manage Guardians →
            </button>
            <button
              onClick={onGoToRecovery}
              className="text-amber-400 hover:text-amber-300 font-semibold"
            >
              Recovery Portal →
            </button>
          </div>
        </div>
      </div>

      {/* Send ETH / Token Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-navy-700 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1">
              {activeModal === "sendEth" ? "Send Native ETH" : "Send ERC-20 Tokens (rUSD)"}
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Authorized directly by your owner key through SmartWallet execution
            </p>

            <form onSubmit={activeModal === "sendEth" ? handleSendEth : handleSendToken} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Recipient Address</label>
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Amount</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm font-mono"
                />
              </div>

              {txMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-mono ${
                    txMessage.type === "success"
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-300 border border-red-500/20"
                  }`}
                >
                  {txMessage.text}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setTxMessage(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-navy-800 text-slate-300 hover:text-white text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={txPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs flex items-center gap-2 shadow-glow-emerald"
                >
                  {txPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail & Activity Feed */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-white">Wallet Activity & Security Audit Trail</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{activities.length} Recorded Events</span>
        </div>

        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No transactions recorded yet for this wallet
            </div>
          ) : (
            activities.map((act) => (
              <div
                key={act.id}
                className="p-4 rounded-2xl bg-navy-900/60 border border-navy-850 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-medium border border-emerald-500/20">
                      {act.type}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1">{act.title}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{act.description}</p>
                </div>
                {act.txHash && (
                  <span className="text-xs font-mono text-slate-500 truncate max-w-xs">
                    tx: {act.txHash.substring(0, 10)}...
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
