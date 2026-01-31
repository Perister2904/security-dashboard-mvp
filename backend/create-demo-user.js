const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function createTestUser() {
  console.log('📦 Creating test user for demo...');
  
  try {
    console.log('\n🔗 Connecting to database...');
    await pool.connect();
    console.log('✅ Connected to database');
    
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.error('❌ Users table does not exist. Run schema.sql first!');
      process.exit(1);
    }
    
    // Hash password
    const password = 'demo123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Delete existing demo user if exists
    await pool.query(`DELETE FROM users WHERE email = 'demo@security.local'`);
    
    // Create demo user
    await pool.query(`
      INSERT INTO users (
        email,
        username,
        password_hash,
        full_name,
        department,
        role,
        is_active,
        is_ad_user
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      'demo@security.local',
      'demo',
      hashedPassword,
      'Demo User',
      'IT Security',
      'admin',
      true,
      false
    ]);
    
    console.log('\n✅ Test user created successfully!');
    console.log('\n📊 Login Credentials:');
    console.log('   Email/Username: demo');
    console.log('   Password: demo123');
    console.log('\n🌐 Use these to login at http://localhost:3000');
    
  } catch (error) {
    console.error('\n❌ Failed to create user:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createTestUser();
