const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(`
  SELECT username, role, is_active, is_ad_user, password_hash IS NOT NULL as has_password 
  FROM users 
  WHERE username IN ('admin', 'analyst')
`).then(result => {
  console.log('\n=== User Details ===');
  result.rows.forEach(u => {
    console.log('\nUsername:', u.username);
    console.log('Role:', u.role);
    console.log('Active:', u.is_active);
    console.log('AD User:', u.is_ad_user);
    console.log('Has Password:', u.has_password);
  });
  pool.end();
}).catch(err => {
  console.error('Error:', err.message);
  pool.end();
});
