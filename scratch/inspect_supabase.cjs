const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  console.log('Connecting to Supabase...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT id, title, "workflowFormsData" FROM processes LIMIT 5');
    console.log('--- Supabase Results ---');
    if (res.rows.length > 0) {
      res.rows.forEach((row, i) => {
        console.log(`[${i+1}] Title: ${row.title} (ID: ${row.id})`);
      });
    } else {
      console.log('No processes found in Supabase');
    }
  } catch (err) {
    console.error('Error connecting/querying Supabase:', err);
  } finally {
    await pool.end();
  }
}

main();
