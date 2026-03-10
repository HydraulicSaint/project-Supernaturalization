import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

export const db = connectionString
  ? new Pool({ connectionString })
  : null;
