const fs = require('fs');
const path = require('path');
const db = require('./config/db');

console.log('🔄 Initializing base database schema...');
try {
  const schema = fs.readFileSync(path.join(__dirname, 'models', 'schema.sql'), 'utf-8');
  db.exec(schema);
  console.log('✅ Base DB Schema initialized');
} catch (err) {
  console.error('❌ Failed to initialize base schema:', err.message);
  process.exit(1);
}
