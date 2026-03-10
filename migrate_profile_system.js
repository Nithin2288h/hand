const db = require('./config/db');

const columns = [
    ['emergency_contact', 'TEXT'],
    ['city', 'TEXT'],
    ['blood_group', 'TEXT'],
    ['fitness_level', 'TEXT'],
    ['can_lift_heavy', 'INTEGER DEFAULT 0'],
    ['is_first_aid_trained', 'INTEGER DEFAULT 0'],
    ['available_emergency', 'INTEGER DEFAULT 0'],
    ['medical_conditions', 'INTEGER DEFAULT 0'],
    ['medical_description', 'TEXT'],
    ['has_completed_test', 'INTEGER DEFAULT 0']
];

columns.forEach(([name, type]) => {
    try {
        db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${type}`).run();
        console.log(`Added column: ${name}`);
    } catch (e) {
        console.log(`Column ${name} might already exist: ${e.message}`);
    }
});

console.log('Detailed Profile DB Migration Complete');
process.exit(0);
