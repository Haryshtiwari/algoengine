#!/usr/bin/env node
/**
 * Database Setup Script
 * Imports algo_trading_db.sql and runs migrations
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

console.log('🚀 Starting database setup...\n');

// Step 1: Check if SQL file exists
const sqlFile = path.join(__dirname, '../algo_trading_db.sql');
if (!fs.existsSync(sqlFile)) {
  console.error('❌ algo_trading_db.sql not found in project root!');
  console.log('   Expected location:', sqlFile);
  process.exit(1);
}

// Step 2: Import base schema
console.log('📥 Importing base schema from algo_trading_db.sql...');
try {
  const importCmd = `mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < ${sqlFile}`;
  execSync(importCmd, { stdio: 'inherit' });
  console.log('✅ Base schema imported successfully\n');
} catch (error) {
  console.error('❌ Failed to import base schema:', error.message);
  process.exit(1);
}

// Step 3: Run migrations
console.log('🔄 Running migrations...');
try {
  const migrateScript = path.join(__dirname, 'migrate.js');
  execSync(`node ${migrateScript}`, { stdio: 'inherit' });
  console.log('✅ Migrations completed\n');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}

console.log('✨ Database setup completed successfully!');
console.log('\nNext steps:');
console.log('  1. npm start          - Start the algoengine server');
console.log('  2. npm run dev        - Start in development mode with nodemon');
