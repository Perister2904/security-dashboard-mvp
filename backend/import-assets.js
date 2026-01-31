const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function importAssets() {
  console.log('📦 Loading asset data from real_assets.json...');
  const assetsPath = path.join(__dirname, '..', 'asset-population', 'real_assets.json');
  
  if (!fs.existsSync(assetsPath)) {
    console.error('❌ real_assets.json not found at:', assetsPath);
    process.exit(1);
  }

  const assetsData = JSON.parse(fs.readFileSync(assetsPath, 'utf8'));
  const assets = Array.isArray(assetsData) ? assetsData : (assetsData.value || []);
  
  console.log(`✅ Loaded ${assets.length} assets from file`);
  
  try {
    console.log('\n🔗 Connecting to database...');
    await pool.connect();
    console.log('✅ Connected to database');
    
    // Check if assets table exists (it should, from schema.sql)
    console.log('\n📋 Verifying assets table...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'assets'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.error('❌ Assets table does not exist. Run schema.sql first!');
      process.exit(1);
    }
    console.log('✅ Table exists');
    
    // Clear existing assets
    console.log('\n🗑️  Clearing existing assets...');
    await pool.query('DELETE FROM assets');
    console.log('✅ Cleared existing data');
    
    // Insert new assets
    console.log('\n📥 Importing assets...');
    for (const asset of assets) {
      const complianceStatus = asset.compliance_status?.toLowerCase() || 'unknown';
      const avInstalled = asset.details?.antivirus === true;
      
      await pool.query(`
        INSERT INTO assets (
          hostname,
          asset_type,
          department,
          criticality,
          ip_address,
          os_version,
          owner_name,
          last_seen,
          vulnerability_count,
          antivirus_status,
          compliance_status
        ) VALUES ($1, $2, $3, $4, $5::inet, $6, $7, NOW(), $8, $9, $10)
      `, [
        asset.asset_name || 'Unknown Asset',
        'workstation',
        'IT',
        'medium',
        asset.ip_address || null,
        asset.details?.operating_system || 'Unknown',
        'Admin',
        0, // vulnerability_count
        avInstalled ? 'protected' : 'not_installed',
        complianceStatus
      ]);
      
      console.log(`  ✓ Imported: ${asset.asset_name} (${asset.ip_address})`);
    }
    
    console.log(`\n✅ Successfully imported ${assets.length} assets!`);
    
    // Display summary
    const result = await pool.query('SELECT COUNT(*) as count FROM assets');
    console.log(`\n📊 Total assets in database: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importAssets();
