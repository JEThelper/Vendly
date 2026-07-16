import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
async function run() {
  await pool.query(`
    DROP POLICY IF EXISTS vendor_isolation ON vendors;
    CREATE POLICY vendor_select ON vendors FOR SELECT TO vendly_app USING (true);
    CREATE POLICY vendor_modify ON vendors FOR ALL TO vendly_app USING (id = current_setting('app.current_vendor_id', true)::uuid);
  `);
  console.log("Fixed.");
  process.exit(0);
}
run();
