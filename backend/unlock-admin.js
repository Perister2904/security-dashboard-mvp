const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(
  "UPDATE users SET login_attempts = 0, locked_until = NULL WHERE username = 'admin' RETURNING username, login_attempts, locked_until"
).then(result => {
  console.log('\n✅ Admin account unlocked!');
  console.log('Username:', result.rows[0].username);
  console.log('Login attempts:', result.rows[0].login_attempts);
  console.log('Locked until:', result.rows[0].locked_until);
  pool.end();
}).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
