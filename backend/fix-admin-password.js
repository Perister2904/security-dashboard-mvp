const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function resetPassword() {
  const username = 'admin';
  const newPassword = 'Admin@123';
  
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING username, email, role',
      [hashedPassword, username]
    );
    
    if (result.rows.length > 0) {
      console.log('\n✅ Password reset successful!');
      console.log('Username:', result.rows[0].username);
      console.log('Email:', result.rows[0].email);
      console.log('Role:', result.rows[0].role);
      console.log('\nNew password: Admin@123');
    } else {
      console.log('❌ User not found');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

resetPassword();
