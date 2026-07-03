const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const DEFAULT_RADIO_OPTIONS = [
  { label: 'Đạt',       value: 'PASS', isPass: true  },
  { label: 'Không Đạt', value: 'FAIL', isPass: false }
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT id, title, "workflowFormsData" FROM processes');
    console.log(`Found ${res.rows.length} processes.`);

    let totalConverted = 0;

    for (const row of res.rows) {
      if (!row.workflowFormsData) continue;

      let updated = false;
      const formsData = { ...row.workflowFormsData };

      for (const formKey of Object.keys(formsData)) {
        const form = formsData[formKey];
        if (!form.layoutBlocks) continue;

        for (const block of form.layoutBlocks) {
          if (!block.fields) continue;

          for (const field of block.fields) {
            if (field.type === 'checkbox') {
              // Migrate: checkbox → radio with default options
              field.type = 'radio';
              if (!field.options) {
                field.options = [...DEFAULT_RADIO_OPTIONS];
              }
              updated = true;
              totalConverted++;
              console.log(`  [${row.title}] form "${formKey}" field "${field.checkItem}": checkbox → radio`);
            }
          }
        }
      }

      if (updated) {
        await pool.query(
          'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
          [formsData, new Date().toISOString(), row.id]
        );
        console.log(`  Saved process ID: ${row.id}`);
      }
    }

    console.log(`\nMigration complete. Converted ${totalConverted} checkbox field(s) to radio.`);
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await pool.end();
  }
}

main();
