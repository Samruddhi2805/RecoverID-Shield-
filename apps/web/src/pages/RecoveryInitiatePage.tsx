import React, { useState } from "react";
import {
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  Clock,
  KeyRound,
  AlertTriangle,
  Loader2,
  UserCheck,
  Send
} from "lucide-react";
import { useWallet, PRESET_DEV_ACCOUNTS } from "../context/WalletContext";
import { RecoveryModuleABI } from "@recoverid/shared";
import { ethers } from "ethers";

interface RecoveryInitiatePageProps {
  onGoToDashboard: () => void;
}

export const RecoveryInitiatePage: React.FC<RecoveryInitiatePageProps> = ({ onGoToDashboard }) => {
  const {
    smartWalletAddress,
    activeRecovery,
    guardians,
    guardiansConfigured,
    currentSigner,
    currentAddress,
    contractAddresses,
    refreshState
  } = useWallet();

  const [walletInput, setWalletInput] = useState(smartWalletAddress || "");
  const [proposedOwner, setProposedOwner] = useState(PRESET_DEV_ACCOUNTS[4].address);
  const [initiating, setInitiating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Quick preset helper
  const handleSelectNewOwnerPreset = () => {
    setProposedOwner(PRESET_DEV_ACCOUNTS[4].address);
  };

  // Submit on-chain initiateRecovery
  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSigner || !walletInput) return;
    setInitiating(true);
    setStatusMsg(null);

    try {
      if (!ethers.isAddress(walletInput)) throw new Error("Invalid smart wallet address");
      if (!ethers.isAddress(proposedOwner)) throw new Error("Invalid proposed owner address");

      const module = new ethers.Contract(
        contractAddresses.recoveryModuleAddress,
        RecoveryModuleABI,
        currentSigner
      );

      const tx = await module.initiateRecovery(walletInput, proposedOwner);
      setStatusMsg({ type: "success", text: "Submitting recovery request to blockchain..." });
      const receipt = await tx.wait(1);

      // Find RecoveryInitiated event to retrieve requestId
      let requestId = 0;
      for (const log of receipt.logs) {
        try {
          const parsed = module.interface.parseLog(log);
          if (parsed && parsed.name === "RecoveryInitiated") {
            requestId = Number(parsed.args.requestId);
            break;
          }
        } catch {
          // ignore
        }
      }

      // Record activity and trigger security warning email
      await fetch("http://localhost:4000/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletInput,
          type: "RECOVERY_INITIATED",
          title: `Recovery Request #${requestId || 1} Initiated`,
          description: `Proposed new owner: ${proposedOwner}`,
          actor: currentSigner.address,
          txHash: receipt.hash
        })
      });

      setStatusMsg({
        type: "success",
        text: `Recovery #${requestId || 1} initiated on-chain! Guardians may now approve.`
      });
      await refreshState();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: err.reason || err.message || "Failed to initiate recovery" });
    } finally {
      setInitiating(false);
    }
  };

  // Approve active recovery request as guardian
  const handleApprove = async () => {
    if (!currentSigner || !activeRecovery) return;
    setApproving(true);
    setStatusMsg(null);

    try {
      const module = new ethers.Contract(
        contractAddresses.recoveryModuleAddress,
        RecoveryModuleABI,
        currentSigner
      );

      const tx = await module.approveRecovery(activeRecovery.id);
      setStatusMsg({ type: "success", text: "Submitting guardian approval to blockchain..." });
      const receipt = await tx.wait(1);

      // Record activity
      await fetch("http://localhost:4000/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: activeRecovery.wallet,
          type: "RECOVERY_APPROVED",
          title: `Guardian Approved Request #${activeRecovery.id}`,
          description: `Approval submitted by guardian ${currentSigner.address.substring(0, 8)}...`,
          actor: currentSigner.address,
          txHash: receipt.hash
        })
      });

      setStatusMsg({ type: "success", text: "Guardian approval confirmed on-chain!" });
      await refreshState();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: err.reason || err.message || "Approval failed" });
    } finally {
      setApproving(false);
    }
  };

  const isCurrentSignerGuardian = guardians.some(
    (g) => g.toLowerCase() === currentAddress.toLowerCase()
  );

  const hasCurrentSignerApproved = Boolean(
    activeRecovery && activeRecovery.approvals[currentAddress.toLowerCase()]
  );

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
          <ShieldAlert className="w-3.5 h-3.5" /> Emergency Social Recovery
        </div>
        <h2 className="text-2xl font-black text-white mt-2">Ownership Recovery Portal</h2>
        <p className="text-xs text-slate-400 mt-1">
          Initiate key rotation, review pending requests, and collect 2-of-3 guardian approvals.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl text-xs font-mono flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
              : "bg-red-500/10 text-red-300 border border-red-500/20"
          }`}
        >
          {statusMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Active Recovery Status Card (if exists) */}
      {activeRecovery && !activeRecovery.executed && !activeRecovery.canceled && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-950/20 to-navy-950 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                ACTIVE RECOVERY REQUEST #{activeRecovery.id}
              </span>
              <h3 className="text-lg font-bold text-white mt-2">
                Recovery Request Pending Guardian Approvals
              </h3>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black text-emerald-400 font-mono">
                {activeRecovery.approvalCount} / 2
              </span>
              <span className="block text-[11px] text-slate-400">Approvals Satisfied</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-navy-900 border border-navy-850 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-400 block font-sans text-[11px]">Proposed Owner:</span>
              <span className="text-emerald-400 font-bold break-all">{activeRecovery.proposedOwner}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-sans text-[11px]">Initiated By:</span>
              <span className="text-slate-300 break-all">{activeRecovery.initiator}</span>
            </div>
          </div>

          {/* Guardian Approval Matrix */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
              Guardian Approval Matrix
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {guardians.map((g, idx) => {
                const approved = Boolean(activeRecovery.approvals[g.toLowerCase()]);
                const isSignerThisGuardian = g.toLowerCase() === currentAddress.toLowerCase();
                return (
                  <div
                    key={g}
                    className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                      approved
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-navy-900/60 border-navy-800 text-slate-400"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>Guardian #{idx + 1}</span>
                        {isSignerThisGuardian && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-navy-800 text-emerald-400">YOU</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                        {g}
                      </span>
                    </div>
                    {approved ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[11px]">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guardian Action Button */}
          {isCurrentSignerGuardian && !hasCurrentSignerApproved && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  Your Guardian Approval is Requested
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Your active signer key is registered as an authorized guardian for this wallet.
                </p>
              </div>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs shadow-glow-emerald flex items-center gap-2 transition shrink-0 cursor-pointer"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve Recovery On-Chain
              </button>
            </div>
          )}

          {hasCurrentSignerApproved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> You have already approved this recovery request.
            </div>
          )}
        </div>
      )}

      {/* Initiate New Recovery Form */}
      <form onSubmit={handleInitiate} className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-400" />
            Initiate Social Recovery Request
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Propose a new owner address. Exactly 2 of 3 guardians must approve to initiate ownership rotation.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Smart Wallet Address to Recover
            </label>
            <input
              type="text"
              required
              placeholder="0x..."
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass-input text-xs font-mono"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Proposed New Owner Address
              </label>
              <button
                type="button"
                onClick={handleSelectNewOwnerPreset}
                className="text-emerald-400 hover:text-emerald-300 text-[11px] font-mono flex items-center gap-1"
              >
                Use Dev New Owner (Anvil #4)
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="0x..."
              value={proposedOwner}
              onChange={(e) => setProposedOwner(e.target.value)}
              className="w-full px-4 py-3 rounded-xl glass-input text-xs font-mono"
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-navy-900/60 border border-navy-850 text-xs text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-emerald-400" /> On-Chain Validation Rules:
          </div>
          <p>• Proposed owner address cannot be zero or equal to the current owner key.</p>
          <p>• Proposed owner address cannot be one of the registered guardians.</p>
          <p>• Only 1 active pending recovery request can exist per wallet at a time.</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onGoToDashboard}
            className="px-5 py-2.5 rounded-xl bg-navy-800 text-slate-300 hover:text-white text-xs font-semibold"
          >
            Dashboard
          </button>
          <button
            type="submit"
            disabled={initiating}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs flex items-center gap-2 shadow-glow-emerald transition cursor-pointer"
          >
            {initiating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            Broadcast Recovery Request
          </button>
        </div>
      </form>
    </div>
  );
};
