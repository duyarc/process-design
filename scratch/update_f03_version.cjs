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
    const res = await pool.query('SELECT "workflowFormsData" FROM processes WHERE id = $1', ['proc_container_inspection']);
    if (res.rows.length === 0) {
      console.log('Process not found');
      return;
    }
    
    let formsData = res.rows[0].workflowFormsData || {};
    const formName = "Phiếu kiểm tra container rỗng";
    if (formsData[formName]) {
      console.log('Existing form data found. Updating...');
      formsData[formName].version = "V1-25.08.2025";
      formsData[formName].status = "DRAFT";
      
      // Update revision history if it exists
      if (formsData[formName].revisionHistory) {
        formsData[formName].revisionHistory = [
          {
            version: "V1",
            date: "2025-08-25",
            author: "System Agent",
            change: "Update version to V1-25.08.2025"
          },
          ...formsData[formName].revisionHistory
        ];
      } else {
        formsData[formName].revisionHistory = [
          {
            version: "V1",
            date: "2025-08-25",
            author: "System Agent",
            change: "Update version to V1-25.08.2025"
          }
        ];
      }
      
      await pool.query('UPDATE processes SET "workflowFormsData" = $1 WHERE id = $2', [formsData, 'proc_container_inspection']);
      console.log('Successfully updated form F03 version and status in database!');
    } else {
      console.log(`Form "${formName}" not found in process`);
    }
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await pool.end();
  }
}

main();
