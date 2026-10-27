import { saveMockEmail } from "../db";

export interface EmailOptions {
  to: string;
  subject: string;
  bodyText: string;
  actionUrl?: string;
}

export class EmailService {
  private provider: string;

  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || "mock";
  }

  public async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId: string }> {
    const { to, subject, bodyText, actionUrl } = options;
    const messageId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

    if (this.provider === "mock") {
      console.log(`\n======================================================`);
      console.log(`[MOCK EMAIL DISPATCHED] To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Action Link: ${actionUrl || "N/A"}`);
      console.log(`Content:\n${bodyText}`);
      console.log(`======================================================\n`);

      saveMockEmail(to, subject, bodyText, actionUrl);
      return { success: true, messageId };
    }

    // Extensible for production SMTP or Resend
    console.warn(`Provider ${this.provider} not fully configured; falling back to mock record`);
    saveMockEmail(to, subject, bodyText, actionUrl);
    return { success: true, messageId };
  }

  public async sendGuardianInvitation(
    to: string,
    guardianName: string,
    walletAddress: string,
    invitationToken: string
  ): Promise<void> {
    const origin = process.env.CORS_ORIGIN || "http://localhost:5173";
    const actionUrl = `${origin}/guardian/accept?token=${encodeURIComponent(invitationToken)}`;

    const bodyText = `
Hello ${guardianName},

You have been invited to serve as an official Security Guardian for a RecoverID Shield Smart Contract Wallet.

Smart Wallet Address: ${walletAddress}

As a guardian, you will help protect this wallet against key loss. You will NEVER have access to the user's funds or private keys. If the owner ever loses access, you will be requested to verify and authorize a social recovery.

To accept this invitation and securely link your guardian address via cryptographic signature, click below:
${actionUrl}

Note: Accepting this invitation requires signing a domain-separated consent message with your Ethereum wallet. Never share this link.
`.trim();

    await this.sendEmail({
      to,
      subject: `[RecoverID Shield] Guardian Invitation for Wallet ${walletAddress.substring(0, 8)}...`,
      bodyText,
      actionUrl
    });
  }

  public async sendRecoveryAlert(
    to: string,
    walletAddress: string,
    proposedOwner: string,
    unlockTimestamp: number
  ): Promise<void> {
    const unlockDate = new Date(unlockTimestamp * 1000).toUTCString();
    const origin = process.env.CORS_ORIGIN || "http://localhost:5173";
    const dashboardUrl = `${origin}/dashboard`;

    const bodyText = `
SECURITY WARNING: SOCIAL RECOVERY INITIATED

Smart Wallet: ${walletAddress}
Proposed New Owner: ${proposedOwner}
Timelock Execution Unlock: ${unlockDate}

A social recovery procedure has been initiated for your Smart Wallet. If this was NOT requested by you, CANCEL IMMEDIATELY using your current owner key from the dashboard:
${dashboardUrl}

If you did request this recovery, ensure your guardians review and approve the request.
`.trim();

    await this.sendEmail({
      to,
      subject: `URGENT: Social Recovery Initiated for Smart Wallet ${walletAddress.substring(0, 8)}...`,
      bodyText,
      actionUrl: dashboardUrl
    });
  }
}

export const emailService = new EmailService();
