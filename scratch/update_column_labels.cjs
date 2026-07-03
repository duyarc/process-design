const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the project .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing in environment variables.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT id, title, "workflowFormsData" FROM processes');
    console.log(`Found ${res.rows.length} processes to inspect.`);

    for (const row of res.rows) {
      if (!row.workflowFormsData) continue;

      let updated = false;
      const formsData = { ...row.workflowFormsData };

      for (const formKey of Object.keys(formsData)) {
        const form = formsData[formKey];
        if (!form.layoutBlocks) continue;

        for (const block of form.layoutBlocks) {
          if (block.type === 'CHECKLIST_TABLE') {
            if (block.columnLabels) {
              if (block.columnLabels.target === 'Đạt (v) / Không (x)') {
                block.columnLabels.target = 'Đạt / Không Đạt';
                updated = true;
                console.log(`Updating form "${formKey}" in process "${row.title}" (ID: ${row.id}): columnLabels.target set to "Đạt / Không Đạt"`);
              }
            }
          }
        }
      }

      if (updated) {
        await pool.query(
          'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
          [formsData, new Date().toISOString(), row.id]
        );
        console.log(`Saved changes for process ID: ${row.id}`);
      }
    }

    console.log('Database migration completed successfully.');
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await pool.end();
  }
}

main();
