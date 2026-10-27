import React, { useState, useEffect } from "react";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { Navbar } from "./components/Navbar";
import { MockInboxModal } from "./components/MockInboxModal";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CreateWalletPage } from "./pages/CreateWalletPage";
import { GuardianManagementPage } from "./pages/GuardianManagementPage";
import { GuardianAcceptPage } from "./pages/GuardianAcceptPage";
import { RecoveryInitiatePage } from "./pages/RecoveryInitiatePage";
import { SecuritySettingsPage } from "./pages/SecuritySettingsPage";

const MainApp: React.FC = () => {
  const { smartWalletAddress } = useWallet();

  // Determine initial tab from URL params (e.g. ?token=... for guardian acceptance)
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("token")) {
      return "accept";
    }
    return smartWalletAddress ? "dashboard" : "landing";
  });

  const [invitationToken, setInvitationToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  });

  const [inboxOpen, setInboxOpen] = useState(false);

  const handleNavigateToToken = (token: string) => {
    setInvitationToken(token);
    setCurrentTab("accept");
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col font-sans selection:bg-emerald-500 selection:text-navy-950">
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenInbox={() => setInboxOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === "landing" && (
          <LandingPage
            onStartCreate={() => setCurrentTab("create")}
            onGoToDashboard={() => setCurrentTab("dashboard")}
            onGoToRecovery={() => setCurrentTab("recovery")}
          />
        )}

        {currentTab === "dashboard" && (
          <DashboardPage
            onGoToGuardians={() => setCurrentTab("guardians")}
            onGoToRecovery={() => setCurrentTab("recovery")}
            onGoToCreate={() => setCurrentTab("create")}
          />
        )}

        {currentTab === "create" && (
          <CreateWalletPage
            onWalletCreated={() => setCurrentTab("dashboard")}
          />
        )}

        {currentTab === "guardians" && <GuardianManagementPage />}

        {currentTab === "recovery" && (
          <RecoveryInitiatePage onGoToDashboard={() => setCurrentTab("dashboard")} />
        )}

        {currentTab === "security" && <SecuritySettingsPage />}

        {currentTab === "accept" && (
          <GuardianAcceptPage
            token={invitationToken}
            onDone={() => setCurrentTab("dashboard")}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-navy-900 bg-navy-950/60 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>RecoverID Shield • Self-Custodial Social Recovery Smart Wallet</span>
          <span>EIP-712 Cryptographic Signatures • 2-of-3 Threshold Protection</span>
        </div>
      </footer>

      {/* Mock Inbox Modal Drawer */}
      <MockInboxModal
        isOpen={inboxOpen}
        onClose={() => setInboxOpen(false)}
        onNavigateToToken={handleNavigateToToken}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <MainApp />
    </WalletProvider>
  );
};

export default App;
