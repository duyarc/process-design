const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query('SELECT id, "workflowFormsData" FROM processes WHERE id = $1', ['proc_container_inspection']);
    const row = res.rows[0];
    const formsData = { ...row.workflowFormsData };
    const form = formsData['Phiếu kiểm tra container rỗng'];

    let updated = false;

    for (const block of form.layoutBlocks) {
      for (const field of block.fields) {
        // Fix EIR field: options Đạt/Không Đạt → Có/Không (stays in INFO_GRID, semantic mismatch)
        if (field.id === 'f_info_eir') {
          console.log('Before:', JSON.stringify(field.options));
          field.options = [
            { label: 'Có',    value: 'PASS', isPass: true  },
            { label: 'Không', value: 'FAIL', isPass: false }
          ];
          console.log('After:', JSON.stringify(field.options));
          updated = true;
        }
      }
    }

    if (updated) {
      await pool.query(
        'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
        [formsData, new Date().toISOString(), row.id]
      );
      console.log('\n✓ Saved successfully.');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
main();
