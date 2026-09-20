/**
 * FormTranslator - Database Adapter Module
 * Connects to PostgreSQL (Supabase) to load and persist FormTemplateISO records.
 */

const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }

  let effectiveUrl = databaseUrl;
  try {
    const parsed = new URL(databaseUrl);
    if (parsed.hostname.includes('pooler.supabase.com') && (parsed.port === '5432' || !parsed.port)) {
      parsed.port = '6543';
      effectiveUrl = parsed.toString();
    }
  } catch (e) {}

  return new Pool({
    connectionString: effectiveUrl,
    ssl: { rejectUnauthorized: false }
  });
}

/**
 * Loads a form template row from the database.
 * 
 * @param {string} formId - e.g. "3S-QC/Q1.1e"
 * @param {string} [version] - optional specific version, defaults to latest/matching draft
 * @returns {Promise<Object>}
 */
async function loadForm(formId, version = null) {
  const pool = getPool();
  try {
    let query, params;
    if (version) {
      query = 'SELECT * FROM forms WHERE form_id = $1 AND version = $2 LIMIT 1';
      params = [formId, version];
    } else {
      query = 'SELECT * FROM forms WHERE form_id = $1 ORDER BY updated_at DESC LIMIT 1';
      params = [formId];
    }

    const res = await pool.query(query, params);
    if (res.rows.length === 0) {
      throw new Error(`Form '${formId}' ${version ? `(version ${version})` : ''} not found in database.`);
    }

    const row = res.rows[0];
    return {
      formId: row.form_id,
      formName: row.form_name,
      formTitle: row.form_title,
      status: row.status,
      version: row.version,
      effectiveDate: row.effective_date,
      layoutBlocks: typeof row.layout_blocks === 'string' ? JSON.parse(row.layout_blocks) : row.layout_blocks,
      revisionHistory: typeof row.revision_history === 'string' ? JSON.parse(row.revision_history) : row.revision_history,
      pageSize: row.page_size || 'A4',
      isPublic: row.is_public ?? false,
      defaultFocusMode: row.default_focus_mode ?? false
    };
  } finally {
    await pool.end();
  }
}

/**
 * Persists a FormTemplateISO record to the database via idempotent upsert.
 * 
 * @param {Object} form - FormTemplateISO object
 * @returns {Promise<Object>} The updated DB row
 */
async function saveForm(form) {
  const pool = getPool();
  try {
    const formId = form.formId || form.form_id;
    const formName = form.formName || form.form_name || formId;
    const formTitle = form.formTitle || form.form_title || formName;
    const status = form.status || 'DRAFT';
    const version = form.version || 'v0.1';
    const effectiveDate = form.effectiveDate || form.effective_date || null;
    const blocks = JSON.stringify(form.layoutBlocks || form.layout_blocks || []);
    const history = JSON.stringify(form.revisionHistory || form.revision_history || []);
    const pageSize = form.pageSize || form.page_size || 'A4';
    const isPublic = form.isPublic ?? form.is_public ?? false;
    const defaultFocusMode = form.defaultFocusMode ?? form.default_focus_mode ?? false;

    const query = `
      INSERT INTO forms (
        form_id, form_name, form_title, status, version, effective_date,
        layout_blocks, revision_history, page_size, is_public, default_focus_mode, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (form_id, version) DO UPDATE SET
        form_name = EXCLUDED.form_name,
        form_title = EXCLUDED.form_title,
        status = EXCLUDED.status,
        effective_date = EXCLUDED.effective_date,
        layout_blocks = EXCLUDED.layout_blocks,
        revision_history = EXCLUDED.revision_history,
        page_size = EXCLUDED.page_size,
        is_public = EXCLUDED.is_public,
        default_focus_mode = EXCLUDED.default_focus_mode,
        updated_at = NOW()
      RETURNING form_id, form_name, form_title, version, status, updated_at
    `;

    const values = [
      formId, formName, formTitle, status, version, effectiveDate,
      blocks, history, pageSize, isPublic, defaultFocusMode
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  } finally {
    await pool.end();
  }
}

module.exports = {
  loadForm,
  saveForm,
  getPool
};
