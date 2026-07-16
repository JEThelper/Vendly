const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function apply() {
  const sql = fs.readFileSync('lib/db/drizzle/0001_setup_rls.sql', 'utf8');
  try {
    await pool.query(sql);
    console.log("Applied RLS successfully!");
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await pool.end();
  }
}
apply();
