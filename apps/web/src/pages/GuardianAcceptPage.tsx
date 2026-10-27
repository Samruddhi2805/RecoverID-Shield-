import React, { useState, useEffect } from "react";
import { ShieldCheck, KeyRound, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useWallet } from "../context/WalletContext";

interface GuardianAcceptPageProps {
  token: string;
  onDone: () => void;
}

export const GuardianAcceptPage: React.FC<GuardianAcceptPageProps> = ({ token, onDone }) => {
  const { currentSigner, currentAddress } = useWallet();

  const [loading, setLoading] = useState(true);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [signing, setSigning] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided in URL");
      setLoading(false);
      return;
    }

    fetch(`http://localhost:4000/api/guardians/invite/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.valid) {
          setError(data.reason || "Invitation invalid or expired");
        } else {
          setInvitationData(data);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load invitation");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSignConsent = async () => {
    if (!currentSigner || !invitationData) return;
    setSigning(true);
    setError(null);

    try {
      // Check if current signer address matches invited guardian address
      if (currentSigner.address.toLowerCase() !== invitationData.guardianAddress.toLowerCase()) {
        throw new Error(
          `Current active signer (${currentSigner.address.substring(0, 8)}...) does not match invited guardian address (${invitationData.guardianAddress.substring(0, 8)}...). Please switch signer to the guardian's key using the key switcher in the top right.`
        );
      }

      // Sign domain-separated consent message
      const signature = await currentSigner.signMessage(invitationData.messageToSign);

      // Submit consent to API
      const res = await fetch("http://localhost:4000/api/guardians/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitationToken: token,
          signature,
          chainId: invitationData.chainId
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to verify consent signature");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to sign consent");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-400 mb-3" />
        <p className="text-sm font-medium">Verifying invitation token...</p>
      </div>
    );
  }

  if (error && !invitationData) {
    return (
      <div className="max-w-md mx-auto py-12 text-center glass-panel p-8 rounded-3xl border border-red-500/20">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white">Invalid Invitation</h3>
        <p className="text-xs text-red-300 mt-2 font-mono">{error}</p>
        <button
          onClick={onDone}
          className="mt-6 px-6 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto py-12 text-center glass-panel p-8 rounded-3xl border border-emerald-500/20 animate-fade-in space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-white">Guardian Consent Confirmed!</h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          Your cryptographic consent signature has been verified and registered. You are now officially recognized as an authorized social recovery guardian.
        </p>
        <div className="pt-4">
          <button
            onClick={onDone}
            className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs shadow-glow-emerald transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isSignerMatching =
    currentAddress &&
    invitationData &&
    currentAddress.toLowerCase() === invitationData.guardianAddress.toLowerCase();

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="glass-panel p-8 rounded-3xl border border-navy-800 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Accept Guardian Appointment</h2>
            <p className="text-xs text-slate-400">
              Sign domain-separated cryptographic consent with your Ethereum address
            </p>
          </div>
        </div>

        {/* Invitation Summary */}
        <div className="p-4 rounded-2xl bg-navy-900 border border-navy-850 space-y-3 font-mono text-xs">
          <div>
            <span className="text-slate-400 text-[11px] block font-sans">Smart Wallet Protected:</span>
            <span className="text-white font-bold break-all">{invitationData.walletAddress}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[11px] block font-sans">Invited Guardian:</span>
            <span className="text-emerald-400 font-bold">{invitationData.guardianName}</span>
            <span className="block text-slate-400 break-all">{invitationData.guardianAddress}</span>
          </div>
        </div>

        {/* Message to sign */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Domain-Separated Cryptographic Consent Message
          </label>
          <pre className="p-3 rounded-xl bg-navy-950 border border-navy-850 text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
            {invitationData.messageToSign}
          </pre>
        </div>

        {!isSignerMatching && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-300">Active Signer Key Mismatch</span>
              <span>
                Your current active signer is{" "}
                <span className="font-mono text-white">{currentAddress.substring(0, 8)}...</span>. Switch to the guardian's key ({invitationData.guardianAddress.substring(0, 8)}...) using the top-right switcher before signing.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-mono">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onDone}
            className="px-5 py-2.5 rounded-xl bg-navy-800 text-slate-300 hover:text-white text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSignConsent}
            disabled={signing}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-bold text-xs flex items-center gap-2 shadow-glow-emerald transition cursor-pointer"
          >
            {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Sign & Verify Consent
          </button>
        </div>
      </div>
    </div>
  );
};
