/**
 * Migration: Emergency Support System Tables
 * Run with: node migrate_emergency_system.js
 */
const db = require('./config/db');

console.log('🔄 Running Emergency System migration...');

db.exec(`
  CREATE TABLE IF NOT EXISTS citizen_emergency_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    alert_type TEXT NOT NULL DEFAULT 'General',
    message TEXT,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS citizen_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    is_sharing INTEGER DEFAULT 1,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citizen_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS safe_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    type TEXT DEFAULT 'Safe Zone',
    capacity INTEGER DEFAULT 0,
    contact TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed some safe zones for demo
const count = db.prepare('SELECT COUNT(*) as c FROM safe_zones').get();
if (count.c === 0) {
    const insertZone = db.prepare(
        `INSERT INTO safe_zones (name, latitude, longitude, type, capacity, contact) VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertZone.run('Government Relief Camp - East', 13.0950, 80.2707, 'Relief Camp', 500, '1800-123-456');
    insertZone.run('St. Thomas Hospital', 13.0827, 80.2707, 'Hospital', 300, '044-28512121');
    insertZone.run('Central Food Distribution Center', 13.0780, 80.2521, 'Food Center', 200, '044-25220000');
    insertZone.run('NGO Shelter - Helping Hands', 13.0604, 80.2496, 'NGO Shelter', 150, '9876543210');
    console.log('✅ Seeded 4 safe zones');
}

console.log('✅ Emergency System migration complete!');
process.exit(0);
