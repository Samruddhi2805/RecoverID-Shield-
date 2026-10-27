import React, { useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, XCircle, ArrowRight, ShieldAlert, Loader2 } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { ethers } from "ethers";
import { RecoveryModuleABI } from "@recoverid/shared";

export const ActiveRecoveryBanner: React.FC = () => {
  const {
    activeRecovery,
    currentSigner,
    isCurrentOwner,
    contractAddresses,
    refreshState
  } = useWallet();

  const [executing, setExecuting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!activeRecovery || activeRecovery.executed || activeRecovery.canceled) {
    return null;
  }

  const formatRemainingTime = (seconds: number) => {
    if (seconds <= 0) return "Timelock Expired (Unlocked)";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 60) {
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m remaining`;
    }
    return `${m}m ${s}s remaining`;
  };

  const handleExecute = async () => {
    if (!currentSigner) return;
    setExecuting(true);
    setActionMessage(null);

    try {
      const module = new ethers.Contract(
        contractAddresses.recoveryModuleAddress,
        RecoveryModuleABI,
        currentSigner
      );
      const tx = await module.executeRecovery(activeRecovery.id);
      setActionMessage("Transaction broadcasted... waiting for block confirmation.");
      await tx.wait(1);
      setActionMessage("Ownership recovery successfully executed on-chain!");
      await refreshState();
    } catch (err: any) {
      console.error("Execution failed:", err);
      setActionMessage(err.reason || err.message || "Failed to execute recovery");
    } finally {
      setExecuting(false);
    }
  };

  const handleCancel = async () => {
    if (!currentSigner) return;
    setCanceling(true);
    setActionMessage(null);

    try {
      const module = new ethers.Contract(
        contractAddresses.recoveryModuleAddress,
        RecoveryModuleABI,
        currentSigner
      );
      const tx = await module.cancelRecovery(activeRecovery.id, "Owner canceled from dashboard");
      setActionMessage("Cancellation transaction broadcasted... waiting for confirmation.");
      await tx.wait(1);
      setActionMessage("Recovery request canceled successfully!");
      await refreshState();
    } catch (err: any) {
      console.error("Cancellation failed:", err);
      setActionMessage(err.reason || err.message || "Failed to cancel recovery");
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-navy-900/80 to-navy-950/90 p-5 shadow-glow-emerald backdrop-blur-md mb-8 animate-fade-in">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Info */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-semibold border border-amber-500/30">
                ACTIVE RECOVERY #{activeRecovery.id}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {formatRemainingTime(activeRecovery.remainingDelaySeconds)}
              </span>
            </div>

            <h4 className="text-base font-bold text-white mt-1">
              Social Recovery Request Pending
            </h4>
            <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2 font-mono">
              <span>Proposed New Owner:</span>
              <span className="px-2 py-0.5 rounded bg-navy-950 text-emerald-400 border border-navy-700">
                {activeRecovery.proposedOwner}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-slate-200">
                <span className="font-mono text-emerald-400 font-bold">{activeRecovery.approvalCount} / 2</span>
                <span>Guardian Approvals Satisfied</span>
              </div>
              {activeRecovery.canExecute ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Final Execution
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  {activeRecovery.approvalCount < 2 ? "Awaiting Guardian Approvals" : "Security Delay Timelock Active"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto shrink-0">
          {isCurrentOwner && (
            <button
              onClick={handleCancel}
              disabled={canceling}
              className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold flex items-center gap-2 transition"
            >
              {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Cancel Request (Owner)
            </button>
          )}

          <button
            onClick={handleExecute}
            disabled={!activeRecovery.canExecute || executing}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition ${
              activeRecovery.canExecute
                ? "bg-emerald-500 hover:bg-emerald-400 text-navy-950 shadow-emerald-500/30 cursor-pointer"
                : "bg-navy-800 text-slate-500 cursor-not-allowed border border-navy-700"
            }`}
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Executing on-chain...
              </>
            ) : (
              <>
                Complete Recovery <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs text-amber-200 font-mono flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}
    </div>
  );
};
