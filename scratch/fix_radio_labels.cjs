const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

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
    console.log(`Found ${res.rows.length} processes.\n`);

    let totalUpdated = 0;

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

            // ─── Fix 1: CHECKLIST_TABLE radio fields ───────────────────────
            // Shorten label "Đạt" → "Đ" and "Không Đạt" → "KĐ"
            if (block.type === 'CHECKLIST_TABLE' && field.type === 'radio') {
              if (!field.options) {
                field.options = [
                  { label: 'Đ', value: 'PASS', isPass: true  },
                  { label: 'KĐ', value: 'FAIL', isPass: false }
                ];
                updated = true;
                console.log(`  [Fix 1 - add options] "${field.checkItem}": added Đ/KĐ options`);
              } else {
                let changed = false;
                field.options = field.options.map(opt => {
                  if (opt.value === 'PASS' && opt.label !== 'Đ') {
                    console.log(`  [Fix 1] "${field.checkItem}": label PASS "${opt.label}" → "Đ"`);
                    changed = true;
                    return { ...opt, label: 'Đ' };
                  }
                  if (opt.value === 'FAIL' && opt.label !== 'KĐ') {
                    console.log(`  [Fix 1] "${field.checkItem}": label FAIL "${opt.label}" → "KĐ"`);
                    changed = true;
                    return { ...opt, label: 'KĐ' };
                  }
                  return opt;
                });
                if (changed) { updated = true; totalUpdated++; }
              }
            }

            // ─── Fix 2: INFO_GRID checkbox → radio (Có/Không) ──────────────
            // Any field still typed as 'checkbox' in INFO_GRID blocks
            if (block.type === 'INFO_GRID' && field.type === 'checkbox') {
              console.log(`  [Fix 2] "${field.checkItem}": checkbox → radio (Có/Không)`);
              field.type = 'radio';
              field.options = [
                { label: 'Có',   value: 'PASS', isPass: true  },
                { label: 'Không', value: 'FAIL', isPass: false }
              ];
              delete field.targetRange;
              updated = true;
              totalUpdated++;
            }

          }
        }
      }

      if (updated) {
        await pool.query(
          'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
          [formsData, new Date().toISOString(), row.id]
        );
        console.log(`\n  ✓ Saved process "${row.title}" (ID: ${row.id})\n`);
      }
    }

    console.log(`\nDone. ${totalUpdated} field(s) updated.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
