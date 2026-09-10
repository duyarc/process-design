require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('No DATABASE_URL configured in .env. Exiting.');
  process.exit(0);
}

let effectiveDatabaseUrl = DATABASE_URL;
try {
  const parsedUrl = new URL(DATABASE_URL);
  if (parsedUrl.hostname.includes('pooler.supabase.com') && (parsedUrl.port === '5432' || !parsedUrl.port)) {
    parsedUrl.port = '6543';
    effectiveDatabaseUrl = parsedUrl.toString();
  }
} catch (e) {}

const pool = new Pool({
  connectionString: effectiveDatabaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 10000
});

async function cleanHistory(rows, tableName, idCol) {
  let updatedCount = 0;

  for (const row of rows) {
    let history = row.revision_history;
    if (typeof history === 'string') {
      try {
        history = JSON.parse(history);
      } catch (e) {
        history = [];
      }
    }

    if (!Array.isArray(history) || history.length === 0) continue;

    const originalLength = history.length;
    const cleanCurrentVersion = (row.version || '').replace(/\s*\([^)]*\)/g, '').trim();

    // 1. Filter out draft entries (drafts shouldn't be in permanent revision history)
    let filtered = history.filter(h => {
      if (!h || typeof h !== 'object') return false;
      const status = (h.status || '').toUpperCase();
      if (status === 'DRAFT') return false;
      if (h.author === 'System Generated' && status !== 'ACTIVE') return false;
      return true;
    });

    // 2. Normalize and deduplicate by clean version
    // If multiple entries exist for the same version, keep the authored/best one
    const versionMap = new Map();
    for (const h of filtered) {
      const v = (h.version || '').replace(/\s*\([^)]*\)/g, '').trim();
      if (!v) continue;

      const normalized = {
        ...h,
        version: v,
        author: h.author === 'QA Administrator' ? 'Admin' : (h.author || 'Admin')
      };

      if (!versionMap.has(v)) {
        versionMap.set(v, normalized);
      } else {
        const existing = versionMap.get(v);
        // If current candidate has real change summary or layout, replace existing system one
        if ((!existing.change || existing.change === 'Initial creation') && normalized.change && normalized.change !== 'Initial creation') {
          versionMap.set(v, normalized);
        } else if (existing.author === 'System Generated' && normalized.author !== 'System Generated') {
          versionMap.set(v, normalized);
        }
      }
    }

    // Convert back to array
    let cleanedList = Array.from(versionMap.values());

    // 3. Mark status: if form is ACTIVE, matching version is ACTIVE, others are RETIRED
    cleanedList = cleanedList.map(h => {
      const isTargetActive = row.status === 'ACTIVE' && h.version === cleanCurrentVersion;
      return {
        ...h,
        status: isTargetActive ? 'ACTIVE' : (h.status === 'ACTIVE' && !isTargetActive ? 'RETIRED' : (h.status || 'RETIRED'))
      };
    });

    // Compare if changed
    const isChanged = JSON.stringify(history) !== JSON.stringify(cleanedList);
    if (isChanged) {
      console.log(`[${tableName}] Cleaning ${idCol}=${row[idCol]}, ver=${row.version} (${originalLength} -> ${cleanedList.length} revisions)`);
      const updateQuery = `UPDATE ${tableName} SET revision_history = $1 WHERE ${idCol} = $2 AND version = $3`;
      await pool.query(updateQuery, [JSON.stringify(cleanedList), row[idCol], row.version]);
      updatedCount++;
    }
  }

  console.log(`[${tableName}] Updated ${updatedCount} / ${rows.length} rows.`);
}

async function run() {
  try {
    console.log('Connecting to database...');
    // 1. Process forms
    const formsRes = await pool.query('SELECT form_id, version, status, revision_history FROM forms');
    console.log(`Found ${formsRes.rows.length} forms in database.`);
    await cleanHistory(formsRes.rows, 'forms', 'form_id');

    // 2. Process report_templates if table exists
    try {
      const reportsRes = await pool.query('SELECT report_id, version, status, revision_history FROM report_templates');
      console.log(`Found ${reportsRes.rows.length} report templates in database.`);
      await cleanHistory(reportsRes.rows, 'report_templates', 'report_id');
    } catch (err) {
      console.log('report_templates table error or does not exist:', err.message);
    }

    console.log('Cleanup migration completed successfully!');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await pool.end();
  }
}

run();
