const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'data', 'reliefsync.db');

// Ensure /data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory. Using in-memory fallback or expecting persistent disk:', err.message);
  }
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Migrations ──────────────────────────────────────────────────────────────
// Add fcm_token column if it doesn't exist (for push notifications)
try {
  db.prepare('ALTER TABLE users ADD COLUMN fcm_token TEXT').run();
  console.log('✅ DB Migration: added fcm_token column to users');
} catch (_) {
  // Column already exists — safe to ignore
}

console.log('✅ Connected to SQLite database');

module.exports = db;
