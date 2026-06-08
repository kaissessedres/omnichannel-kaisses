const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'kaichat.db');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS ChannelAccount (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_type          TEXT    NOT NULL CHECK(channel_type IN ('whatsapp','instagram','mercadolivre','shopee')),
      account_label         TEXT    NOT NULL,
      credentials           TEXT,
      evolution_instance_id TEXT,
      libredesk_inbox_id    INTEGER NOT NULL,
      status                TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','disconnected','error')),
      last_synced_at        DATETIME,
      created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ConversationMapping (
      id                         INTEGER PRIMARY KEY AUTOINCREMENT,
      libredesk_conversation_id  INTEGER NOT NULL,
      channel_account_id         INTEGER NOT NULL REFERENCES ChannelAccount(id),
      external_conversation_id   TEXT    NOT NULL,
      external_contact_id        TEXT    NOT NULL,
      created_at                 DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel_account_id, external_conversation_id)
    );

    CREATE TABLE IF NOT EXISTS SyncState (
      id                       INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_account_id       INTEGER NOT NULL UNIQUE REFERENCES ChannelAccount(id),
      last_external_message_id TEXT,
      last_polled_at           DATETIME,
      error_count              INTEGER DEFAULT 0,
      last_error               TEXT
    );
  `);

  console.log(`[db] Initialized: ${DB_PATH}`);
  return db;
}

module.exports = { getDb, initDb };
