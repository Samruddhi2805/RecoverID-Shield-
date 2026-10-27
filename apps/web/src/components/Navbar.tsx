import React, { useState } from "react";
import { Shield, ChevronDown, KeyRound, Mail, RefreshCw, Check, Copy, ExternalLink } from "lucide-react";
import { useWallet, PRESET_DEV_ACCOUNTS } from "../context/WalletContext";

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenInbox: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenInbox }) => {
  const {
    currentAddress,
    switchSigner,
    smartWalletAddress,
    ownerAddress,
    isCurrentOwner,
    refreshState,
    loading
  } = useWallet();

  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeAccount = PRESET_DEV_ACCOUNTS.find(
    (acc) => acc.address.toLowerCase() === currentAddress.toLowerCase()
  ) || {
    label: "Custom Active Key",
    role: "custom" as const,
    address: currentAddress
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "guardians", label: "Guardians" },
    { id: "recovery", label: "Initiate Recovery" },
    { id: "create", label: "Create Wallet" },
    { id: "security", label: "Security & Backup" }
  ];

  const copySmartWallet = () => {
    if (smartWalletAddress) {
      navigator.clipboard.writeText(smartWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-navy-800 bg-navy-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => onSelectTab("dashboard")}
              className="flex items-center gap-3 group text-left"
            >
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-glow-emerald text-navy-950 transition-transform group-hover:scale-105">
                <Shield className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-xl font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  RecoverID <span className="text-emerald-400">Shield</span>
                </span>
                <span className="block text-[11px] text-slate-400 font-medium tracking-wide">
                  Lose Your Keys, Not Your Assets
                </span>
              </div>
            </button>

            {/* Navigation tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    currentTab === item.id
                      ? "bg-navy-800 text-emerald-400 shadow-sm border border-navy-700"
                      : "text-slate-300 hover:text-white hover:bg-navy-900/60"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right Header Elements */}
          <div className="flex items-center gap-3">
            {/* Smart Wallet badge */}
            {smartWalletAddress && (
              <div
                onClick={copySmartWallet}
                title="Click to copy Smart Contract Wallet address"
                className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-900 border border-navy-800 hover:border-emerald-500/40 cursor-pointer text-xs transition"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-400">Wallet:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {smartWalletAddress.substring(0, 6)}...{smartWalletAddress.substring(smartWalletAddress.length - 4)}
                </span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              </div>
            )}

            {/* Refresh Chain Button */}
            <button
              onClick={() => refreshState()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-navy-900 border border-navy-800 hover:bg-navy-800 text-slate-300 hover:text-white transition"
              title="Refresh on-chain state"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>

            {/* Mock Inbox Button */}
            <button
              onClick={onOpenInbox}
              className="relative p-2.5 rounded-xl bg-navy-900 border border-navy-800 hover:bg-navy-800 text-slate-300 hover:text-emerald-400 transition"
              title="Open simulated email inbox"
            >
              <Mail className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-navy-950" />
            </button>

            {/* Dev Account Switcher */}
            <div className="relative">
              <button
                onClick={() => setDevMenuOpen(!devMenuOpen)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-navy-900 hover:bg-navy-850 border border-navy-800 text-xs font-semibold transition"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <div className="text-left">
                  <div className="text-white flex items-center gap-1.5 font-sans">
                    {activeAccount.label}
                    {isCurrentOwner && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        OWNER
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {currentAddress ? `${currentAddress.substring(0, 6)}...${currentAddress.substring(currentAddress.length - 4)}` : "No Key Loaded"}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {devMenuOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl glass-panel shadow-2xl border border-navy-700 py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-navy-800/80">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Local Testing Key Switcher
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Switch between simulated roles without external extensions
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {PRESET_DEV_ACCOUNTS.map((acc) => {
                      const isActive = acc.address.toLowerCase() === currentAddress.toLowerCase();
                      const isOwner = ownerAddress && acc.address.toLowerCase() === ownerAddress.toLowerCase();
                      return (
                        <button
                          key={acc.address}
                          onClick={() => {
                            switchSigner(acc.privateKey);
                            setDevMenuOpen(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left text-xs flex items-center justify-between hover:bg-navy-800 transition ${
                            isActive ? "bg-navy-800/80 text-emerald-400 font-bold" : "text-slate-300"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span>{acc.label}</span>
                              {isOwner && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                  CONTRACT OWNER
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                              {acc.address.substring(0, 8)}...{acc.address.substring(acc.address.length - 6)}
                            </span>
                          </div>
                          {isActive && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
