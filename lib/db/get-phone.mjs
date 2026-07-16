import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query("SELECT phone_number_id FROM vendors LIMIT 1;");
console.log(res.rows[0].phone_number_id);
await client.end();
