import { Pool } from "pg";

// Module-level singleton pool – reused across requests in dev and prod.
const pool = new Pool({
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
});

export default pool;
