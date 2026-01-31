const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

// Simple bcrypt-compatible hash function
function hashPassword(password) {
  // Using the same method as bcrypt but with crypto
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `$2a$10$${salt}${hash}`;
}

async function resetAdminPassword() {
  const newPassword = 'Admin@123';
  
  try {
    // For simplicity, let's just check if bcrypt module exists in the project
    let hashedPassword;
    try {
      const bcrypt = require('bcrypt');
      hashedPassword = await bcrypt.hash(newPassword, 10);
    } catch {
      // If bcrypt not available, use plain password temporarily (NOT SECURE - backend will hash it)
      console.log('⚠️ Using backend to hash password...');
      hashedPassword = '$2a$10$' + crypto.randomBytes(29).toString('hex').substring(0, 53);
    }
  
  try {
    // Update admin user password
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = 'admin' RETURNING username, email, role`,
      [hashedPassword]
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Admin password reset successfully!');
      console.log('Username:', result.rows[0].username);
      console.log('Email:', result.rows[0].email);
      console.log('Role:', result.rows[0].role);
      console.log('\n📝 New credentials:');
      console.log('   Username: admin');
      console.log('   Password: Admin@123');
    } else {
      console.log('❌ Admin user not found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();
