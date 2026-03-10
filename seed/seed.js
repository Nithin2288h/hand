require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function runSchema() {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'models', 'schema.sql'), 'utf-8');
    db.exec(schema);
    console.log('✅ Schema created/verified');
}

async function seed() {
    console.log('🌱 Starting database seed...');

    runSchema();

    // Clear existing data in dependency order
    db.exec('DELETE FROM volunteer_assignments');
    db.exec('DELETE FROM notifications');
    db.exec('DELETE FROM requests');
    db.exec('DELETE FROM resources');
    db.exec('DELETE FROM disasters');
    db.exec('DELETE FROM users');
    console.log('🧹 Cleared existing data');

    const hashPw = async (pw) => bcrypt.hash(pw, 12);

    // ─── Seed Users ───────────────────────────────────────────────────────────
    const insert = db.prepare(
        `INSERT INTO users (name, email, password, role, latitude, longitude, phone, organization, is_available)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const adminResult = insert.run('Admin Authority', 'admin@reliefsync.com', await hashPw('admin123'), 'admin', 13.0827, 80.2707, '+91-9000000001', null, 1);
    const ngoResult = insert.run('Chennai Relief NGO', 'ngo@reliefsync.com', await hashPw('ngo123'), 'ngo', 13.0500, 80.2100, '+91-9000000002', 'Chennai Relief Foundation', 1);
    const vol1Result = insert.run('Volunteer Ravi', 'bunnynithin2288h@gmail.com', await hashPw('vol123'), 'volunteer', 13.1000, 80.3000, '7406738896', null, 1);
    const vol2Result = insert.run('Volunteer Priya', 'priya@reliefsync.com', await hashPw('vol123'), 'volunteer', 13.0600, 80.2500, '+91-9000000004', null, 1);
    const citizen1Result = insert.run('Citizen Arjun', 'arjun@reliefsync.com', await hashPw('citizen123'), 'citizen', 13.0900, 80.2800, '+91-9000000005', null, 1);
    const citizen2Result = insert.run('Citizen Meena', 'meena@reliefsync.com', await hashPw('citizen123'), 'citizen', 13.0700, 80.2600, '+91-9000000006', null, 1);

    const adminId = Number(adminResult.lastInsertRowid);
    const ngoId = Number(ngoResult.lastInsertRowid);
    const vol1Id = Number(vol1Result.lastInsertRowid);
    const citizen1Id = Number(citizen1Result.lastInsertRowid);
    const citizen2Id = Number(citizen2Result.lastInsertRowid);

    console.log('👥 Users seeded');

    // ─── Seed Disasters ───────────────────────────────────────────────────────
    const insertDisaster = db.prepare(
        `INSERT INTO disasters (name, type, severity, description, latitude, longitude, radius_km, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const cycloneResult = insertDisaster.run('Cyclone Fani', 'Cyclone', 'Critical', 'Category 4 cyclone making landfall near Chennai coast with sustained winds of 185 km/h.', 13.0827, 80.2707, 100, 'Active', adminId);
    const floodResult = insertDisaster.run('Chennai Floods 2024', 'Flood', 'High', 'Heavy monsoon rains causing severe flooding in low-lying areas. Multiple localities inundated.', 13.0500, 80.2500, 50, 'Active', adminId);
    insertDisaster.run('Kanchipuram Fire', 'Fire', 'Medium', 'Industrial fire reported at chemical plant. Evacuation advisory issued.', 12.8342, 79.7036, 30, 'Closed', adminId);

    const cycloneId = Number(cycloneResult.lastInsertRowid);
    const floodId = Number(floodResult.lastInsertRowid);
    console.log('🌊 Disasters seeded');

    // ─── Seed Resources ───────────────────────────────────────────────────────
    const insertResource = db.prepare(
        `INSERT INTO resources (ngo_id, type, name, quantity, unit, latitude, longitude, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertResource.run(ngoId, 'Food', 'Emergency Food Packets', 500, 'packets', 13.0450, 80.2050, 'Available');
    insertResource.run(ngoId, 'Water', 'Drinking Water Bottles', 1000, 'bottles', 13.0450, 80.2050, 'Available');
    insertResource.run(ngoId, 'Medical', 'First Aid Kits', 100, 'kits', 13.0450, 80.2050, 'Available');
    insertResource.run(ngoId, 'Shelter', 'Emergency Tents', 50, 'tents', 13.0450, 80.2050, 'Available');
    console.log('📦 Resources seeded');

    // ─── Seed Help Requests ───────────────────────────────────────────────────
    const insertRequest = db.prepare(
        `INSERT INTO requests (citizen_id, disaster_id, need_type, description, urgency, latitude, longitude, status, people_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertRequest.run(citizen1Id, cycloneId, 'Rescue', 'Family of 5 trapped on rooftop, floodwater at 2nd floor level. Need immediate rescue.', 'Critical', 13.0920, 80.2820, 'Pending', 5);
    insertRequest.run(citizen2Id, floodId, 'Food', 'Community of 30 people at local school shelter without food for 2 days.', 'High', 13.0720, 80.2620, 'Pending', 30);
    insertRequest.run(citizen1Id, floodId, 'Medical', 'Elderly patient needs insulin medication urgently.', 'Critical', 13.0850, 80.2750, 'Pending', 1);
    console.log('🆘 Help requests seeded');

    // ─── Seed Notifications ───────────────────────────────────────────────────
    const insertNotif = db.prepare(
        `INSERT INTO notifications (user_id, disaster_id, type, message)
     VALUES (?, ?, ?, ?)`
    );

    insertNotif.run(citizen1Id, cycloneId, 'disaster_alert', '⚠️ DISASTER ALERT: Cyclone Fani (Cyclone) - Severity: Critical. You are within 5 km of the affected area.');
    insertNotif.run(citizen2Id, floodId, 'disaster_alert', '⚠️ DISASTER ALERT: Chennai Floods 2024 (Flood) - Severity: High. You are within 8 km of the affected area.');
    console.log('🔔 Notifications seeded');

    console.log('\n✅ Seed complete! Test accounts:');
    console.log('  Admin:     admin@reliefsync.com     / admin123');
    console.log('  NGO:       ngo@reliefsync.com       / ngo123');
    console.log('  Volunteer: ravi@reliefsync.com      / vol123');
    console.log('  Volunteer: priya@reliefsync.com     / vol123');
    console.log('  Citizen:   arjun@reliefsync.com     / citizen123');
    console.log('  Citizen:   meena@reliefsync.com     / citizen123');

    db.close();
}

seed().catch((err) => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
