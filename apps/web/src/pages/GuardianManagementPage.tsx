import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Loader2,
  Trash2,
  Sparkles
} from "lucide-react";
import { useWallet, PRESET_DEV_ACCOUNTS } from "../context/WalletContext";
import { RecoveryModuleABI, type GuardianRecord } from "@recoverid/shared";
import { ethers } from "ethers";

export const GuardianManagementPage: React.FC = () => {
  const {
    smartWalletAddress,
    guardians,
    guardiansConfigured,
    currentSigner,
    isCurrentOwner,
    contractAddresses,
    recoveryDelay,
    refreshState
  } = useWallet();

  const [dbGuardians, setDbGuardians] = useState<GuardianRecord[]>([]);
  const [inviting, setInviting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [registeringOnChain, setRegisteringOnChain] = useState(false);
  const [delayInput, setDelayInput] = useState(recoveryDelay.toString());
  const [updatingDelay, setUpdatingDelay] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchGuardians = async () => {
    if (!smartWalletAddress) return;
    try {
      const res = await fetch(`http://localhost:4000/api/guardians/${smartWalletAddress}`);
      const data = await res.json();
      setDbGuardians(data.guardians || []);
    } catch (err) {
      console.warn("Could not fetch guardians:", err);
    }
  };

  useEffect(() => {
    fetchGuardians();
  }, [smartWalletAddress]);

  useEffect(() => {
    setDelayInput(recoveryDelay.toString());
  }, [recoveryDelay]);

  // Invite Guardian via API
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartWalletAddress) return;
    setInviting(true);
    setStatusMsg(null);

    try {
      const res = await fetch("http://localhost:4000/api/guardians/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: smartWalletAddress,
          guardianAddress: address,
          guardianName: name,
          email
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to invite guardian");
      }

      setStatusMsg({ type: "success", text: `Invitation dispatched to ${email}! View simulated email in Inbox.` });
      setName("");
      setEmail("");
      setAddress("");
      await fetchGuardians();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    } finally {
      setInviting(false);
    }
  };

  // Quick helper: Autofill preset guardian dev accounts
  const handleAutofillPreset = (presetIndex: number) => {
    const acc = PRESET_DEV_ACCOUNTS[presetIndex];
    if (acc) {
      setName(acc.label.split("-")[1]?.trim() || acc.label);
      setEmail(`${acc.role}@guardian.test`);
      setAddress(acc.address);
    }
  };

  // Register all 3 guardians on-chain
  const handleRegisterOnChain = async () => {
    if (!currentSigner || !smartWalletAddress) return;
    setRegisteringOnChain(true);
    setStatusMsg(null);

    try {
      // Collect 3 distinct guardian addresses
      const distinctAddresses: string[] = [];
      for (const g of dbGuardians) {
        if (!distinctAddresses.includes(g.guardianAddress.toLowerCase())) {
          distinctAddresses.push(g.guardianAddress.toLowerCase());
        }
      }

      if (distinctAddresses.length < 3) {
        // Pad with standard dev guardians if needed for rapid demonstration
        for (const preset of [PRESET_DEV_ACCOUNTS[1], PRESET_DEV_ACCOUNTS[2], PRESET_DEV_ACCOUNTS[3]]) {
          if (!distinctAddresses.includes(preset.address.toLowerCase()) && distinctAddresses.length < 3) {
            distinctAddresses.push(preset.address.toLowerCase());
          }
        }
      }

      if (distinctAddresses.length < 3) {
        throw new Error("Exactly 3 distinct guardian addresses are required.");
      }

      const guardianTuple = [distinctAddresses[0], distinctAddresses[1], distinctAddresses[2]] as [string, string, string];

      const module = new ethers.Contract(
        contractAddresses.recoveryModuleAddress,
        RecoveryModuleABI,
        currentSigner
      );

      const tx = guardiansConfigured
        ? await module.updateGuardians(smartWalletAddress, guardianTuple)
        : await module.registerGuardians(smartWalletAddress, guardianTuple);

      setStatusMsg({ type: "success", text: "Submitting on-chain guardian registration..." });
      const receipt = await tx.wait(1);

      // Record activity
      await fetch("http://localhost:4000/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: smartWalletAddress,
          type: "GUARDIAN_REGISTERED",
          title: "Guardians Registered On-Chain",
          description: `Active guardians: ${guardianTuple.map((g) => g.substring(0, 6) + "...").join(", ")}`,
          actor: currentSigner.address,
          txHash: receipt.hash
        })
      });

      setStatusMsg({ type: "success", text: "Guardians successfully registered on-chain!" });
      await refreshState();
      await fetchGuardians();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ type: "error", text: err.reason || err.message || "Registration failed" });
    } finally {
      setRegisteringOnChain(false);
    }
  };

  // Update timelock delay on-chain
  const handleUpdateDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSigner || !smartWalletAddress) return;
    setUpdatingDelay(true);
    setStatusMsg(null);

    try {
      const delayNum = parseInt(delayInput, 10);
      if (isNaN(delayNum) || delayNum < 60) {
        throw new Error("Security delay must be at least 60 seconds.");
      }

      const module = new ethers.Contract(
        contractAddresses.recoveryModuleAddress,
        RecoveryModuleABI,
        currentSigner
      );

      const tx = await module.setWalletRecoveryDelay(smartWalletAddress, delayNum);
      setStatusMsg({ type: "success", text: "Submitting security delay update..." });
      await tx.wait(1);

      setStatusMsg({ type: "success", text: `Security delay updated to ${delayNum} seconds!` });
      await refreshState();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.reason || err.message || "Delay update failed" });
    } finally {
      setUpdatingDelay(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
            <Users className="w-3.5 h-3.5" /> 2-of-3 Social Guardian Protection
          </div>
          <h2 className="text-2xl font-black text-white mt-2">Guardian Security Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Invite trusted contacts and register exactly 3 distinct guardians on the blockchain.
          </p>
        </div>

        {isCurrentOwner && (
          <button
            onClick={handleRegisterOnChain}
            disabled={registeringOnChain}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs shadow-glow-emerald flex items-center gap-2 transition"
          >
            {registeringOnChain ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {guardiansConfigured ? "Update Guardians On-Chain" : "Register Guardians On-Chain"}
          </button>
        )}
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

      {/* 3 Guardian Slots Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((idx) => {
          const onChainAddress = guardians[idx];
          const dbItem = dbGuardians[idx];
          const hasGuardian = Boolean(onChainAddress || dbItem);
          const addressToShow = onChainAddress || dbItem?.guardianAddress || "Unassigned Slot";
          const nameToShow = dbItem?.guardianName || `Guardian #${idx + 1}`;
          const isRegistered = Boolean(onChainAddress);

          return (
            <div
              key={idx}
              className="glass-panel p-6 rounded-3xl border border-navy-800 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold text-slate-400">SLOT #{idx + 1}</span>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-semibold ${
                      isRegistered
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : hasGuardian
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-navy-900 text-slate-500 border border-navy-800"
                    }`}
                  >
                    {isRegistered ? "ON-CHAIN ACTIVE" : hasGuardian ? "CONSENT PENDING" : "EMPTY"}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{nameToShow}</h3>
                {dbItem?.email && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{dbItem.email}</p>
                )}

                <div className="mt-4 p-3 rounded-xl bg-navy-900/80 border border-navy-850 font-mono text-xs text-slate-300 break-all">
                  {addressToShow}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-navy-850 flex items-center justify-between text-xs text-slate-400">
                <span>Threshold: 2 of 3 Required</span>
                {isRegistered ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite Guardian Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <form onSubmit={handleInvite} className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Invite New Guardian
            </h3>
            {/* Autofill Preset buttons */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Presets:</span>
              <button
                type="button"
                onClick={() => handleAutofillPreset(1)}
                className="px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-750 text-[10px] text-slate-300 font-mono"
              >
                Alice
              </button>
              <button
                type="button"
                onClick={() => handleAutofillPreset(2)}
                className="px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-750 text-[10px] text-slate-300 font-mono"
              >
                Bob
              </button>
              <button
                type="button"
                onClick={() => handleAutofillPreset(3)}
                className="px-2 py-0.5 rounded bg-navy-800 hover:bg-navy-750 text-[10px] text-slate-300 font-mono"
              >
                Charlie
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Guardian Display Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Alice Crypto Vault"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="guardian@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Guardian Ethereum Address</label>
            <input
              type="text"
              required
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={inviting || !isCurrentOwner}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
                isCurrentOwner
                  ? "bg-emerald-500 hover:bg-emerald-400 text-navy-950 shadow-glow-emerald cursor-pointer"
                  : "bg-navy-800 text-slate-500 cursor-not-allowed border border-navy-700"
              }`}
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Cryptographic Guardian Invitation
            </button>
          </div>
        </form>

        {/* Timelock Security Delay Setting */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-navy-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white">Configurable Security Timelock</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              When social recovery is approved by 2 guardians, a countdown timer is enforced before the owner key rotates. This grants the genuine owner time to cancel fraudulent requests.
            </p>

            <form onSubmit={handleUpdateDelay} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Delay Duration (Seconds)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="60"
                    max="2592000"
                    value={delayInput}
                    onChange={(e) => setDelayInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-mono"
                  />
                  <button
                    type="submit"
                    disabled={updatingDelay || !isCurrentOwner}
                    className="px-4 py-2.5 rounded-xl bg-navy-850 hover:bg-navy-800 text-emerald-400 border border-navy-750 text-xs font-bold shrink-0 transition"
                  >
                    {updatingDelay ? "Updating..." : "Update Delay"}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setDelayInput("60")}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 underline font-mono"
                  >
                    60s (Quick Demo)
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={() => setDelayInput("86400")}
                    className="text-[11px] text-slate-400 hover:text-emerald-400 underline font-mono"
                  >
                    86400s (24 Hours Standard)
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-navy-900/60 border border-navy-850 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">Current On-Chain Delay:</span>{" "}
            <span className="font-mono text-emerald-400 font-bold">{recoveryDelay} seconds</span>{" "}
            ({Math.floor(recoveryDelay / 60)} minutes)
          </div>
        </div>
      </div>
    </div>
  );
};
