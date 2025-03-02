import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ✅ Use DATABASE_URL instead of individual credentials
  ssl: {
    rejectUnauthorized: false, // ✅ Required for Supabase to work on Railway
  },
});

pool.connect()
  .then(() => console.log("Connected to PostgreSQL ✅"))
  .catch((err) => console.error("Database connection failed ❌", err));

export default pool;
