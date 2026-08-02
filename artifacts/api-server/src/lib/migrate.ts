import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        active BOOLEAN NOT NULL DEFAULT true,
        link TEXT,
        link_label TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tg_sessions (
        session_id TEXT PRIMARY KEY,
        code TEXT,
        user_id BIGINT,
        user_name TEXT,
        verified BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        code_issued_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
    `);
    logger.info("DB tables verified/created");
  } catch (err) {
    logger.error({ err }, "Failed to ensure DB tables");
  } finally {
    client.release();
  }
}
