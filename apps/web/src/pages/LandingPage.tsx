import React from "react";
import { Shield, Key, Users, Lock, ArrowRight, CheckCircle, Zap, RefreshCw, FileText } from "lucide-react";

interface LandingPageProps {
  onStartCreate: () => void;
  onGoToDashboard: () => void;
  onGoToRecovery: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartCreate,
  onGoToDashboard,
  onGoToRecovery
}) => {
  return (
    <div className="space-y-20 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden text-center max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6 animate-fade-in">
          <Zap className="w-3.5 h-3.5" /> Next-Generation Self-Custodial Security
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          Lose Your Keys, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
            Not Your Assets.
          </span>
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto">
          RecoverID Shield is a self-custodial smart contract wallet with an on-chain 2-of-3 social recovery system. Never fear losing your private key again.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onStartCreate}
            className="px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-navy-950 font-extrabold text-base flex items-center gap-2.5 shadow-glow-emerald hover:shadow-glow-emerald-lg transition transform hover:-translate-y-0.5"
          >
            Create Smart Wallet <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={onGoToDashboard}
            className="px-7 py-4 rounded-2xl bg-navy-900 hover:bg-navy-850 text-white font-bold text-base border border-navy-700 hover:border-emerald-500/30 transition"
          >
            Open Dashboard
          </button>
          <button
            onClick={onGoToRecovery}
            className="px-7 py-4 rounded-2xl bg-navy-900/60 hover:bg-navy-850 text-amber-400 font-bold text-base border border-amber-500/20 hover:border-amber-500/40 transition"
          >
            Initiate Recovery
          </button>
        </div>

        {/* Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>No Browser Extension Required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>EIP-712 Cryptographic Approvals</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Zero Asset Relocation on Recovery</span>
          </div>
        </div>
      </section>

      {/* 3 Core Architecture Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <div className="glass-panel glass-panel-hover p-8 rounded-3xl border border-navy-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-6">
            <Key className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Local Key Generation</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Keys are generated locally using cryptographic entropy. Encrypted with PBKDF2 (100,000 rounds) and AES-256-GCM. Private keys are never transmitted to our backend.
          </p>
        </div>

        <div className="glass-panel glass-panel-hover p-8 rounded-3xl border border-navy-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-6">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">2-of-3 Social Guardians</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            Register 3 distinct trusted guardians. A single guardian cannot recover alone. Two distinct cryptographic approvals are strictly required by the smart contract.
          </p>
        </div>

        <div className="glass-panel glass-panel-hover p-8 rounded-3xl border border-navy-800">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-6">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Timelock & Asset Preservation</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            A security delay window provides ample opportunity for the legitimate owner to cancel unauthorized requests. After recovery, wallet address and all assets remain untouched.
          </p>
        </div>
      </section>

      {/* Recovery State Machine Interactive Breakdown */}
      <section className="glass-panel p-8 sm:p-12 rounded-3xl border border-navy-800 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">How Social Recovery Works</h2>
          <p className="text-sm text-slate-400 mt-2">
            The on-chain recovery state machine enforces rigorous safety checks at every phase
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-navy-900/80 border border-navy-800 relative">
            <div className="text-xs font-mono text-emerald-400 font-bold mb-2">STEP 1</div>
            <h4 className="text-base font-bold text-white mb-1.5">Initiate Request</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              New owner address is proposed. Guardian or proposed owner submits request with unique on-chain ID.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-900/80 border border-navy-800 relative">
            <div className="text-xs font-mono text-emerald-400 font-bold mb-2">STEP 2</div>
            <h4 className="text-base font-bold text-white mb-1.5">Guardian Approval</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Guardians review request details and submit cryptographic on-chain approvals (2-of-3 threshold).
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-900/80 border border-navy-800 relative">
            <div className="text-xs font-mono text-emerald-400 font-bold mb-2">STEP 3</div>
            <h4 className="text-base font-bold text-white mb-1.5">Security Timelock</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configured security delay begins. The legitimate owner can instantly cancel any malicious attempt.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-900/80 border border-navy-800 relative">
            <div className="text-xs font-mono text-emerald-400 font-bold mb-2">STEP 4</div>
            <h4 className="text-base font-bold text-white mb-1.5">Execution & Control</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recovery is finalized. Owner key is rotated; the wallet address and all existing token balances remain intact.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
