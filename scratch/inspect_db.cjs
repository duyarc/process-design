const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT id, title, steps, "workflowFormsData" FROM processes');
    console.log('--- Database Audit ---');
    res.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`Title: ${row.title}`);
      
      const formsInSteps = (row.steps || [])
        .filter(s => s.producesForm && s.formName)
        .map(s => s.formName);
      
      console.log(`Forms declared in steps: ${formsInSteps.join(', ')}`);
      console.log(`Forms in workflowFormsData:`, JSON.stringify(row.workflowFormsData));
      console.log('------------------------------------');
    });
  } catch (err) {
    console.error('Error querying database:', err);
  } finally {
    await pool.end();
  }
}

main();
