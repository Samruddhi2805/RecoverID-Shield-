import initSqlJs, { Database } from "sql.js";
import fs from "fs";
import path from "path";
import type { GuardianRecord, ActivityLogItem } from "@recoverid/shared";

let dbInstance: Database | null = null;
let dbPath = process.env.DATABASE_PATH || path.join(__dirname, "../data/recoverid.sqlite");

export async function initDatabase(customPath?: string): Promise<Database> {
  if (customPath) {
    dbPath = customPath;
  }

  const SQL = await initSqlJs();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Initialize schema
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS guardians (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      guardian_address TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      invitation_token_hash TEXT,
      invitation_expires_at INTEGER,
      consent_signature TEXT,
      registered_on_chain INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      actor TEXT NOT NULL,
      tx_hash TEXT,
      metadata TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mock_emails (
      id TEXT PRIMARY KEY,
      to_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      action_url TEXT,
      sent_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_guardians_wallet ON guardians(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_guardians_token ON guardians(invitation_token_hash);
    CREATE INDEX IF NOT EXISTS idx_activities_wallet ON activities(wallet_address);
  `);

  persistDatabase();
  return dbInstance;
}

export function getDatabase(): Database {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbInstance;
}

export function persistDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error("Failed to persist SQLite database to disk:", err);
  }
}

export function saveGuardian(guardian: GuardianRecord): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO guardians (
      id, wallet_address, guardian_address, guardian_name, email,
      status, invitation_token_hash, invitation_expires_at,
      consent_signature, registered_on_chain, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      guardian_name = excluded.guardian_name,
      email = excluded.email,
      status = excluded.status,
      invitation_token_hash = excluded.invitation_token_hash,
      invitation_expires_at = excluded.invitation_expires_at,
      consent_signature = excluded.consent_signature,
      registered_on_chain = excluded.registered_on_chain,
      updated_at = excluded.updated_at
  `);

  stmt.run([
    guardian.id,
    guardian.walletAddress.toLowerCase(),
    guardian.guardianAddress.toLowerCase(),
    guardian.guardianName,
    guardian.email.toLowerCase(),
    guardian.status,
    guardian.invitationTokenHash || null,
    guardian.invitationExpiresAt || null,
    guardian.consentSignature || null,
    guardian.registeredOnChain ? 1 : 0,
    guardian.createdAt,
    guardian.updatedAt
  ]);
  stmt.free();
  persistDatabase();
}

export function getGuardianByTokenHash(tokenHash: string): GuardianRecord | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM guardians WHERE invitation_token_hash = ? LIMIT 1
  `);
  stmt.bind([tokenHash]);

  if (stmt.step()) {
    const row = stmt.getAsObject() as any;
    stmt.free();
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      guardianAddress: row.guardian_address,
      guardianName: row.guardian_name,
      email: row.email,
      status: row.status,
      invitationTokenHash: row.invitation_token_hash,
      invitationExpiresAt: row.invitation_expires_at,
      consentSignature: row.consent_signature,
      registeredOnChain: Boolean(row.registered_on_chain),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  stmt.free();
  return null;
}

export function getGuardiansByWallet(walletAddress: string): GuardianRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM guardians WHERE wallet_address = ? ORDER BY created_at ASC
  `);
  stmt.bind([walletAddress.toLowerCase()]);

  const results: GuardianRecord[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    results.push({
      id: row.id,
      walletAddress: row.wallet_address,
      guardianAddress: row.guardian_address,
      guardianName: row.guardian_name,
      email: row.email,
      status: row.status,
      invitationTokenHash: row.invitation_token_hash,
      invitationExpiresAt: row.invitation_expires_at,
      consentSignature: row.consent_signature,
      registeredOnChain: Boolean(row.registered_on_chain),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }
  stmt.free();
  return results;
}

export function updateGuardianStatus(
  id: string,
  status: "invited" | "registered" | "revoked",
  consentSignature?: string,
  registeredOnChain?: boolean
): void {
  const db = getDatabase();
  let query = `UPDATE guardians SET status = ?, updated_at = ?`;
  const params: any[] = [status, Date.now()];

  if (consentSignature !== undefined) {
    query += `, consent_signature = ?`;
    params.push(consentSignature);
  }
  if (registeredOnChain !== undefined) {
    query += `, registered_on_chain = ?`;
    params.push(registeredOnChain ? 1 : 0);
  }
  query += ` WHERE id = ?`;
  params.push(id);

  db.run(query, params);
  persistDatabase();
}

export function addActivity(item: ActivityLogItem): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO activities (id, wallet_address, type, title, description, actor, tx_hash, metadata, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    item.id,
    item.wallet.toLowerCase(),
    item.type,
    item.title,
    item.description,
    item.actor.toLowerCase(),
    item.txHash || null,
    item.metadata ? JSON.stringify(item.metadata) : null,
    item.timestamp
  ]);
  stmt.free();
  persistDatabase();
}

export function getActivities(walletAddress: string): ActivityLogItem[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM activities WHERE wallet_address = ? ORDER BY timestamp DESC
  `);
  stmt.bind([walletAddress.toLowerCase()]);

  const items: ActivityLogItem[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as any;
    items.push({
      id: row.id,
      wallet: row.wallet_address,
      type: row.type,
      title: row.title,
      description: row.description,
      actor: row.actor,
      txHash: row.tx_hash,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      timestamp: row.timestamp
    });
  }
  stmt.free();
  return items;
}

export function saveMockEmail(to: string, subject: string, content: string, actionUrl?: string): void {
  const db = getDatabase();
  const id = "email_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const stmt = db.prepare(`
    INSERT INTO mock_emails (id, to_email, subject, content, action_url, sent_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run([id, to.toLowerCase(), subject, content, actionUrl || null, Date.now()]);
  stmt.free();
  persistDatabase();
}

export function getMockEmails(): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM mock_emails ORDER BY sent_at DESC LIMIT 50
  `);
  const list: any[] = [];
  while (stmt.step()) {
    list.push(stmt.getAsObject());
  }
  stmt.free();
  return list;
}

export function clearMockEmails(): void {
  const db = getDatabase();
  db.run(`DELETE FROM mock_emails`);
  persistDatabase();
}
