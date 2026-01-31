const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function addAssets() {
  const client = await pool.connect();
  try {
    // Add Domain Controller
    await client.query(`
      INSERT INTO assets (hostname, ip_address, os_type, os_version, compliance_status, department, owner_name, asset_type, criticality, vulnerability_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, ['WIN-PDFRJAC6THP', '192.168.18.100', 'Windows Server', 'Windows Server 2022 Standard', 'compliant', 'IT', 'Administrator', 'server', 'critical', 0]);
    console.log('✅ Added Domain Controller');

    // Add Ubuntu VM
    await client.query(`
      INSERT INTO assets (hostname, ip_address, os_type, os_version, compliance_status, department, owner_name, asset_type, criticality, vulnerability_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, ['UBUNTU-VM', '192.168.56.101', 'Linux', 'Ubuntu 22.04', 'compliant', 'IT', 'Muhammad Haris', 'workstation', 'medium', 2]);
    console.log('✅ Added Ubuntu VM');

    // Get total count
    const result = await client.query('SELECT COUNT(*) as total FROM assets');
    console.log(`\n✅ Total assets now: ${result.rows[0].total}`);

    const assets = await client.query('SELECT hostname, ip_address, os_type, asset_type FROM assets ORDER BY created_at');
    console.log('\nAll assets:');
    assets.rows.forEach(a => console.log(`  - ${a.hostname} (${a.ip_address}) - ${a.os_type} ${a.asset_type}`));
  } finally {
    client.release();
    await pool.end();
  }
}

addAssets().catch(console.error);
