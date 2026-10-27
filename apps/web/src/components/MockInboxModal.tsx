import React, { useState, useEffect } from "react";
import { Mail, RefreshCw, Trash2, ExternalLink, X, CheckCircle2, Clock } from "lucide-react";

interface MockInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToToken: (token: string) => void;
}

export const MockInboxModal: React.FC<MockInboxModalProps> = ({ isOpen, onClose, onNavigateToToken }) => {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/notifications/mock-inbox");
      const data = await res.json();
      if (data.success) {
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.warn("Could not fetch mock emails:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearInbox = async () => {
    try {
      await fetch("http://localhost:4000/api/notifications/mock-inbox", { method: "DELETE" });
      setEmails([]);
    } catch (err) {
      console.warn("Could not clear inbox:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInbox();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-3xl rounded-2xl border border-navy-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-800 bg-navy-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Simulated Notification Inbox
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  {emails.length} Messages
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Mock email delivery inspector for guardian invitations and recovery warnings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInbox}
              disabled={loading}
              className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition"
              title="Refresh inbox"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={clearInbox}
              className="p-2 rounded-lg bg-navy-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
              title="Clear all messages"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white transition ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {emails.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Mail className="w-12 h-12 mx-auto text-slate-600 mb-3 opacity-50" />
              <p className="text-sm font-medium">No simulated emails delivered yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Invite a guardian or initiate a social recovery to view dispatches here
              </p>
            </div>
          ) : (
            emails.map((email) => {
              const dateStr = new Date(email.sent_at).toLocaleTimeString();
              const isInvitation = email.subject.includes("Invitation");

              // Extract token if url is present
              let token = "";
              if (email.action_url) {
                try {
                  const url = new URL(email.action_url);
                  token = url.searchParams.get("token") || "";
                } catch {
                  // ignore
                }
              }

              return (
                <div
                  key={email.id}
                  className="p-4 rounded-xl bg-navy-900/90 border border-navy-800 hover:border-emerald-500/30 transition flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                            isInvitation
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {isInvitation ? "GUARDIAN INVITE" : "RECOVERY WARNING"}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {dateStr}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white mt-1.5">{email.subject}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">To: {email.to_email}</p>
                    </div>

                    {token && (
                      <button
                        onClick={() => {
                          onNavigateToToken(token);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-emerald-900/40"
                      >
                        Accept Invitation <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-navy-950/70 border border-navy-850 text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {email.content}
                  </div>

                  {email.action_url && (
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-navy-800/60">
                      <span className="truncate max-w-md font-mono text-[11px] text-slate-500">
                        {email.action_url}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(email.action_url);
                          setCopiedId(email.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-sans font-medium text-xs flex items-center gap-1 ml-2"
                      >
                        {copiedId === email.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                          </>
                        ) : (
                          "Copy Link"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
