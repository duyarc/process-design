const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query('SELECT "workflowFormsData" FROM processes WHERE id = $1', ['proc_container_inspection']);
    const form = res.rows[0].workflowFormsData['Phiếu kiểm tra container rỗng'];
    for (const block of form.layoutBlocks) {
      for (const field of block.fields) {
        if (field.checkItem.includes('EIR') || field.checkItem.includes('Phiếu')) {
          console.log('Found field:', JSON.stringify(field, null, 2));
        }
      }
    }
  } finally {
    await pool.end();
  }
}
main();
