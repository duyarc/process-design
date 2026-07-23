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
    console.log('Enabling Row-Level Security (RLS) on tables...');
    
    await pool.query('ALTER TABLE processes ENABLE ROW LEVEL SECURITY');
    console.log('Enabled RLS on processes');
    
    await pool.query('ALTER TABLE forms ENABLE ROW LEVEL SECURITY');
    console.log('Enabled RLS on forms');
    
    await pool.query('ALTER TABLE process_forms ENABLE ROW LEVEL SECURITY');
    console.log('Enabled RLS on process_forms');
    
    await pool.query('ALTER TABLE submissions ENABLE ROW LEVEL SECURITY');
    console.log('Enabled RLS on submissions');
    
    await pool.query('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
    console.log('Enabled RLS on users');

    console.log('RLS enabling completed successfully!');
  } catch (err) {
    console.error('Error enabling RLS:', err);
  } finally {
    await pool.end();
  }
}

main();
