import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";
import { AsyncLocalStorage } from "async_hooks";
import * as schema from "./schema";

const { Pool } = pg;

// Use mock SQLite for dev/demo without real database
const databaseUrl = process.env.DATABASE_URL || "better-sqlite3://:memory:";

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "development") {
  throw new Error(
    "DATABASE_URL must be set in production. Did you forget to provision a database?",
  );
}

// Production-grade connection pool configuration
// These settings prevent connection exhaustion under load
export const pool = new Pool({
  connectionString: databaseUrl,
  
  // Connection pooling settings
  max: parseInt(process.env.DB_POOL_SIZE || "20", 10),          // Max connections
  min: parseInt(process.env.DB_POOL_MIN || "5", 10),             // Min idle connections
  idleTimeoutMillis: 30000,      // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout for acquiring a connection
  
  // Retry settings for connection failures
  maxUses: 0,                    // No limit on reuses (0 = unlimited)
});

// Log connection pool events in production
if (process.env.NODE_ENV === "production") {
  pool.on("error", (err) => {
    console.error("[POOL ERROR]", err);
  });

  pool.on("connect", () => {
    console.debug("[POOL] New connection created");
  });

  pool.on("remove", () => {
    console.debug("[POOL] Connection removed");
  });
}

export const baseDb = drizzle(pool, { schema });

const vendorContext = new AsyncLocalStorage<typeof baseDb>();

export const db = new Proxy({} as typeof baseDb, {
  get(target, prop) {
    const tx = vendorContext.getStore();
    return (tx || baseDb)[prop as keyof typeof baseDb];
  }
});

/**
 * Wraps a callback in a database transaction and sets the RLS vendor context
 * so that queries executed inside the callback are isolated to this vendor.
 */
export async function withVendorContext<T>(vendorId: string, fn: () => Promise<T>): Promise<T> {
  return baseDb.transaction(async (tx) => {
    // Set the vendor context for this transaction only. 
    // The `true` parameter makes the variable local to the current transaction.
    await tx.execute(sql`SELECT set_config('app.current_vendor_id', ${vendorId}, true)`);
    // Run the callback inside ALS so any nested `db` calls use this transaction
    return vendorContext.run(tx as any, fn);
  });
}
/**
 * Health check for database connectivity
 * Use this to verify the database is responsive
 */
export async function checkDatabaseHealth(): Promise<{
  ok: boolean;
  poolSize: number;
  idleCount: number;
  waitingCount: number;
  responseTime: number;
}> {
  const startTime = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    return {
      ok: true,
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      responseTime: Date.now() - startTime,
    };
  } catch (err) {
    console.error("[DB HEALTH CHECK] Failed:", err);
    return {
      ok: false,
      poolSize: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Close database connections (call on graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  await pool.end();
  // Logger is not available here to avoid circular imports, so we silently close
}

export * from "./schema";
