// db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Uncomment the next line if your database requires SSL:
  // ssl: { rejectUnauthorized: false },
});

export default pool;
