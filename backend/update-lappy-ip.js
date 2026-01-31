const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function updateLappyIP() {
  try {
    const result = await pool.query(
      `UPDATE assets SET ip_address = '192.168.18.6', updated_at = NOW() 
       WHERE hostname = 'LAPPY' 
       RETURNING hostname, ip_address, os_type`
    );
    
    console.log('\n✅ LAPPY IP UPDATED!');
    console.log('   Hostname:', result.rows[0].hostname);
    console.log('   New IP:', result.rows[0].ip_address);
    console.log('   OS:', result.rows[0].os_type);
    
    // Show all current assets
    const assets = await pool.query('SELECT hostname, ip_address, os_type FROM assets ORDER BY hostname');
    console.log('\n📋 All Assets in Database:');
    assets.rows.forEach(a => {
      console.log(`   ${a.hostname.padEnd(20)} ${a.ip_address.padEnd(18)} ${a.os_type || 'N/A'}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

updateLappyIP();
