import { pool } from "./src/index";

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT pid, state, wait_event_type, wait_event, query_start, query 
      FROM pg_stat_activity 
      WHERE state = 'idle in transaction' OR wait_event_type = 'Lock';
    `);
    console.log("Hanging transactions/locks:", res.rows);
    
    // Kill any queries running longer than 1 minute or idle in transaction
    const killRes = await client.query(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE (state = 'idle in transaction' OR wait_event_type = 'Lock')
        AND pid <> pg_backend_pid();
    `);
    console.log(`Killed ${killRes.rowCount} blocked/idle transactions.`);
  } finally {
    client.release();
  }
  process.exit(0);
}

main().catch(console.error);
