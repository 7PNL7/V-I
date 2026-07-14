const mysql = require('mysql2/promise');
async function check() {
  const c = await mysql.createConnection({
    host: '46.250.231.129', port: 3306, user: 'root',
    password: 'CaoBao2211', database: 'garment_production'
  });
  const [cols] = await c.query("SHOW COLUMNS FROM pipeline LIKE 'daily_capacity'");
  if (cols.length === 0) {
    await c.query("ALTER TABLE pipeline ADD COLUMN daily_capacity INT UNSIGNED DEFAULT 500 AFTER estimatedEndTime");
    console.log('Added daily_capacity');
  } else {
    console.log('Column exists');
  }
  await c.end();
}
check().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
