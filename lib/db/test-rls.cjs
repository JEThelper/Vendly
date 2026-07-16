const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://vendly_app:VendlyAppSecure123!@db.dwodcbhzolgvvuzybexx.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT 1 as result');
    console.log("Connected successfully! Result:", res.rows[0].result);
  } catch (err) {
    console.error("Connection failed:", err.message);
  } finally {
    await pool.end();
  }
}

test();
