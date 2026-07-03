const { Pool } = require('pg');

const cockroachUrl = 'postgresql://tranducduy_gmail_com:j5wNsZgnAYopeuMFPAAiKw@cotton-quagga-16825.jxf.gcp-asia-southeast1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

async function main() {
  console.log('Connecting to original CockroachDB...');
  const pool = new Pool({
    connectionString: cockroachUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT id, title, "workflowFormsData" FROM processes WHERE id = $1', ['proc_1781170202946']);
    console.log('--- CockroachDB Results ---');
    if (res.rows.length > 0) {
      console.log(`Title: ${res.rows[0].title}`);
      console.log(`workflowFormsData:`, JSON.stringify(res.rows[0].workflowFormsData));
    } else {
      console.log('Process not found in CockroachDB');
    }
  } catch (err) {
    console.error('Error connecting/querying CockroachDB:', err);
  } finally {
    await pool.end();
  }
}

main();
