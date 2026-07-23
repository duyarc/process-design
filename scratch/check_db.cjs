const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query('SELECT id, title, steps FROM processes');
    console.log('--- Processes in DB ---');
    res.rows.forEach(row => {
      console.log(`Process ID: ${row.id}, Title: ${row.title}`);
      console.log(`Steps:`, JSON.stringify(row.steps, null, 2));
      console.log('------------------------');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
