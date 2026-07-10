require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const express = require('express');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');


const app = express();
const PORT = process.env.PORT || 3001;
const CSV_PATH = path.join(__dirname, 'data', 'processes.csv');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'process_optimization_secure_jwt_secret_key_2026';

app.use(express.json());


const DATABASE_URL = process.env.DATABASE_URL;
let dbPool = null;

if (DATABASE_URL) {
  console.log('Connecting to database...');
  dbPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  dbPool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message || err);
  });
} else {
  console.log('No DATABASE_URL found. Operating in local CSV file-based mode.');
}

// Cloudflare R2 Client configuration
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

let r2Client = null;
if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT && R2_BUCKET_NAME) {
  console.log('Initializing Cloudflare R2 client...');
  r2Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
} else {
  console.log('Cloudflare R2 credentials missing. File upload endpoints will be disabled.');
}


const INITIALIZE_SCHEMA_QUERY = `
  CREATE TABLE IF NOT EXISTS processes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    version TEXT,
    "lastUpdated" TEXT,
    roles JSONB,
    steps JSONB,
    "formFields" JSONB,
    "sopSignoffs" JSONB,
    "workflowFormsData" JSONB,
    "parentProcessId" TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS forms (
    form_id TEXT NOT NULL,
    form_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    version TEXT NOT NULL DEFAULT 'v0.1',
    effective_date DATE,
    form_title TEXT,
    layout_blocks JSONB NOT NULL DEFAULT '[]',
    revision_history JSONB NOT NULL DEFAULT '[]',
    pdf_name TEXT,
    pdf_key TEXT,
    pdf_size INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (form_id, version)
  );

  CREATE TABLE IF NOT EXISTS process_forms (
    id SERIAL PRIMARY KEY,
    process_id TEXT NOT NULL REFERENCES processes(id) ON UPDATE CASCADE ON DELETE CASCADE,
    form_name TEXT NOT NULL,
    form_id TEXT,
    form_version TEXT NOT NULL DEFAULT 'v0.1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_process_form UNIQUE (process_id, form_name)
  );

  CREATE INDEX IF NOT EXISTS idx_process_forms_name ON process_forms(form_name);
  CREATE INDEX IF NOT EXISTS idx_process_forms_form_id ON process_forms(form_id);

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    process_id TEXT NOT NULL REFERENCES processes(id) ON UPDATE CASCADE ON DELETE CASCADE,
    form_id TEXT NOT NULL,
    form_version TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    form_data JSONB NOT NULL,
    media_urls JSONB DEFAULT '[]'::jsonb,
    supervisor_signoff JSONB DEFAULT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_process_id ON submissions(process_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_form_id ON submissions(form_id);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password TEXT,
    full_name TEXT NOT NULL,
    title TEXT,
    role_id TEXT NOT NULL DEFAULT 'operator',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE processes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
  ALTER TABLE process_forms ENABLE ROW LEVEL SECURITY;
  ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
`;

// ─── Sample Data for Fresh Seed ──────────────────────────────────────────────
const F01_BLOCKS = [
  { id: 'b_title', type: 'TITLE', title: 'PHIẾU KIỂM TRA CONTAINER RỖNG', columns: 1,
    fields: [{ id: 'f_title_desc', type: 'text', checkItem: '(kiểm tra trước khi thực hiện)', locationCode: 'TITLE-DESC', frequency: 'Once/Shift', reactionProtocol: '' }] },
  { id: 'b_info', type: 'INFO_GRID', title: 'Thông tin chung', columns: 2,
    fields: [
      { id: 'f_info_date', type: 'date', checkItem: 'Ngày', locationCode: 'INFO-DATE', frequency: 'Once/Shift', reactionProtocol: '' },
      { id: 'f_info_cont', type: 'text', checkItem: 'Số Container', locationCode: 'INFO-CONT', frequency: 'Once/Shift', reactionProtocol: '' }
    ]},
  { id: 'b_checklist', type: 'CHECKLIST_TABLE', title: 'Chi tiết kiểm tra chất lượng', columns: 1, fields: [],
    columnLabels: { stt: 'STT', item: 'Chi tiết kiểm tra', target: 'Đạt / Không', reaction: 'Mô tả cụ thể nếu Không đạt' } },
  { id: 'b_sign', type: 'SIGN', title: 'Ký xác nhận', columns: 2,
    fields: [
      { id: 'f_sign_op', type: 'signature', checkItem: 'Người kiểm tra (ký và ghi rõ họ tên)', locationCode: 'SIGN-OP', frequency: 'Once/Shift', reactionProtocol: '' },
      { id: 'f_sign_sup', type: 'signature', checkItem: 'Người thẩm tra (ký và ghi rõ họ tên)', locationCode: 'SIGN-SUP', frequency: 'Once/Shift', reactionProtocol: '' }
    ]}
];

const F02_BLOCKS = [
  { id: 'b_title', type: 'TITLE', title: 'PHIẾU KIỂM ĐẾM', columns: 1,
    fields: [{ id: 'f_title_desc', type: 'text', checkItem: '(kiểm tra trước khi thực hiện)', locationCode: 'TITLE-DESC', frequency: 'Once/Shift', reactionProtocol: '' }] },
  { id: 'b_info', type: 'INFO_GRID', title: 'Thông tin chung', columns: 2,
    fields: [
      { id: 'f_info_date', type: 'date', checkItem: 'Ngày', locationCode: 'INFO-DATE', frequency: 'Once/Shift', reactionProtocol: '' },
      { id: 'f_info_cont', type: 'text', checkItem: 'Số Container', locationCode: 'INFO-CONT', frequency: 'Once/Shift', reactionProtocol: '' }
    ]},
  { id: 'b_checklist', type: 'CHECKLIST_TABLE', title: 'Chi tiết kiểm tra chất lượng', columns: 1, fields: [],
    columnLabels: { stt: 'STT', item: 'Chi tiết kiểm tra', target: 'Đạt / Không Đạt', reaction: 'Mô tả cụ thể nếu Không đạt' } },
  { id: 'b_sign', type: 'SIGN', title: 'Ký xác nhận', columns: 2,
    fields: [
      { id: 'f_sign_op', type: 'signature', checkItem: 'Người kiểm tra (ký và ghi rõ họ tên)', locationCode: 'SIGN-OP', frequency: 'Once/Shift', reactionProtocol: '' },
      { id: 'f_sign_sup', type: 'signature', checkItem: 'Người thẩm tra (ký và ghi rõ họ tên)', locationCode: 'SIGN-SUP', frequency: 'Once/Shift', reactionProtocol: '' }
    ]}
];

const SAMPLE_FORMS = [
  {
    form_id: 'FM-QC-F01',
    form_name: 'Phiếu kiểm tra container rỗng',
    form_title: 'PHIẾU KIỂM TRA CONTAINER RỖNG',
    status: 'ACTIVE',
    version: 'v0.2',
    layout_blocks: JSON.stringify(F01_BLOCKS),
    revision_history: JSON.stringify([
      { version: 'v0.2', date: '2026-07-06', author: 'QA Administrator', change: 'Cập nhật tiêu đề cột kiểm tra', layoutBlocks: F01_BLOCKS },
      { version: 'v0.1', date: '2026-06-01', author: 'QA Administrator', change: 'Phiên bản đầu tiên', layoutBlocks: F01_BLOCKS }
    ])
  },
  {
    form_id: 'FM-QC-F02',
    form_name: 'Phiếu kiểm đếm',
    form_title: 'PHIẾU KIỂM ĐẾM',
    status: 'ACTIVE',
    version: 'v0.1',
    layout_blocks: JSON.stringify(F02_BLOCKS),
    revision_history: JSON.stringify([
      { version: 'v0.1', date: '2026-07-06', author: 'QA Administrator', change: 'Phiên bản đầu tiên', layoutBlocks: F02_BLOCKS }
    ])
  }
];

const SAMPLE_PROCESSES = [
  {
    id: 'container_inspection',
    title: 'Quy trình đóng hàng',
    description: 'Quy trình chuẩn hóa hoạt động đóng hàng.',
    version: 'v0.1',
    lastUpdated: new Date().toISOString(),
    parentProcessId: 'container_inspection',
    status: 'Active',
    roles: JSON.stringify(['QC', 'Supervisor']),
    steps: JSON.stringify([
      { id: 'step_start', role: 'QC', action: 'Nhận yêu cầu kiểm tra vỏ Container từ bộ phận Logistics', bpmnShape: 'start-event', nextStepId: 'step_inspect' },
      { id: 'step_inspect', role: 'QC', action: 'Thực hiện kiểm tra chất lượng vỏ container rỗng tại bãi', formName: 'Phiếu kiểm tra container rỗng', bpmnShape: 'task', nextStepId: 'step_tally', producesForm: true },
      { id: 'step_tally', role: 'QC', action: 'Thực hiện kiểm đếm hàng hóa xếp lên container xuất khẩu', formName: 'Phiếu kiểm đếm', bpmnShape: 'task', nextStepId: 'step_signoff', producesForm: true },
      { id: 'step_signoff', role: 'Supervisor', action: 'Giám sát chất lượng thẩm tra và ký xác nhận biên bản đóng gói', bpmnShape: 'task', nextStepId: 'step_end' },
      { id: 'step_end', role: 'QC', action: 'Hoàn tất bàn giao container đủ tiêu chuẩn cho đóng hàng', bpmnShape: 'end-event' }
    ]),
    formFields: JSON.stringify([]),
    sopSignoffs: JSON.stringify({
      author: { name: 'Nguyễn Văn A', title: 'QC Manager' },
      reviewers: [{ name: 'Trần Văn B', title: 'QA Leader' }],
      authorisers: [{ name: 'Lê Văn C', title: 'Factory Director' }],
      effectiveDate: '2026-07-03'
    }),
    workflowFormsData: JSON.stringify({
      'Phiếu kiểm tra container rỗng': { formId: 'FM-QC-F01' },
      'Phiếu kiểm đếm': { formId: 'FM-QC-F02' }
    })
  }
];

async function seedFreshData(client) {
  console.log('Seeding fresh sample data...');
  // Clear existing process & form data (keep users)
  await client.query('DELETE FROM submissions');
  await client.query('DELETE FROM process_forms');
  await client.query('DELETE FROM processes');
  await client.query('DELETE FROM forms');

  // Insert sample forms
  for (const form of SAMPLE_FORMS) {
    await client.query(`
      INSERT INTO forms (form_id, form_name, form_title, status, version, layout_blocks, revision_history)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (form_id) DO UPDATE SET
        form_name = EXCLUDED.form_name,
        form_title = EXCLUDED.form_title,
        status = EXCLUDED.status,
        version = EXCLUDED.version,
        layout_blocks = EXCLUDED.layout_blocks,
        revision_history = EXCLUDED.revision_history,
        updated_at = NOW()
    `, [form.form_id, form.form_name, form.form_title, form.status, form.version, form.layout_blocks, form.revision_history]);
  }

  // Insert sample processes
  for (const proc of SAMPLE_PROCESSES) {
    await client.query(`
      INSERT INTO processes (id, title, description, version, "lastUpdated", roles, steps, "formFields", "sopSignoffs", "workflowFormsData", "parentProcessId", status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [proc.id, proc.title, proc.description, proc.version, proc.lastUpdated,
        proc.roles, proc.steps, proc.formFields, proc.sopSignoffs, proc.workflowFormsData,
        proc.parentProcessId, proc.status]);

    // Insert process_forms links
    const wfd = JSON.parse(proc.workflowFormsData);
    for (const [formName, ref] of Object.entries(wfd)) {
      if (ref.formId) {
        await client.query(`
          INSERT INTO process_forms (process_id, form_name, form_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (process_id, form_name) DO UPDATE SET form_id = EXCLUDED.form_id, updated_at = NOW()
        `, [proc.id, formName, ref.formId]);
      }
    }
  }

  console.log('Fresh sample data seeded successfully.');
}

async function initDatabase() {
  if (!dbPool) return;
  let client;
  try {
    client = await dbPool.connect();
    console.log('Connected to Supabase database successfully!');
    await client.query(INITIALIZE_SCHEMA_QUERY);

    // Migrate process_forms: add form_id column if it doesn't exist yet (legacy)
    await client.query(`
      ALTER TABLE process_forms ADD COLUMN IF NOT EXISTS form_id TEXT;
    `).catch(() => {});

    // Migrate process_forms: add form_version column for multi-version support
    await client.query(`
      ALTER TABLE process_forms ADD COLUMN IF NOT EXISTS form_version TEXT NOT NULL DEFAULT 'v0.1';
    `).catch(() => {});

    // Migrate forms table: drop old single-column PK and add composite PK (form_id, version)
    // This runs safely — if composite PK already exists, the catch suppresses the error
    await client.query(`
      ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_pkey;
    `).catch(() => {});
    await client.query(`
      ALTER TABLE forms ADD PRIMARY KEY (form_id, version);
    `).catch(() => {});

    // Drop old FK constraint on form_id in process_forms (no longer valid with composite PK)
    await client.query(`
      ALTER TABLE process_forms DROP CONSTRAINT IF EXISTS process_forms_form_id_fkey;
    `).catch(() => {});

    // Remove old PDF columns from process_forms if they exist (no longer needed there)
    await client.query(`
      ALTER TABLE process_forms DROP COLUMN IF EXISTS pdf_key;
      ALTER TABLE process_forms DROP COLUMN IF EXISTS pdf_size;
      ALTER TABLE process_forms DROP COLUMN IF EXISTS pdf_name;
      ALTER TABLE process_forms DROP COLUMN IF EXISTS online_url;
    `).catch(() => {});
    
    console.log('Database schema verified/created.');

    // MIGRATION: Add effective_date column if it doesn't exist
    await client.query(`
      ALTER TABLE forms ADD COLUMN IF NOT EXISTS effective_date DATE;
    `).catch(() => {});

    // MIGRATION: Backfill effective_date from embedded date in version string
    // Handles rows like: "v0.1 (2026-07-04)" -> version="v0.1", effective_date="2026-07-04"
    await client.query(`
      UPDATE forms
      SET
        effective_date = (regexp_match(version, '\\((\\d{4}-\\d{2}-\\d{2})'))[1]::DATE,
        version = regexp_replace(version, '\\s*\\([^)]*\\)', '', 'g')
      WHERE version ~ '\\(';
    `).catch((err) => { console.error('Version migration warning:', err.message); });

    // Ensure system default process for unlinked forms exists in Supabase DB
    await client.query(`
      INSERT INTO processes (id, title, description, version, status)
      VALUES ('unlinked', 'Biểu mẫu tự do', 'Quy trình chứa các biểu mẫu chưa liên kết', '1', 'Active')
      ON CONFLICT (id) DO NOTHING
    `);

    // Seed default users if missing
    const usersCountRes = await client.query('SELECT COUNT(*) FROM users');
    const usersCount = parseInt(usersCountRes.rows[0].count, 10);
    if (usersCount === 0) {
      console.log('Seeding default users...');
      await client.query(`
        INSERT INTO users (id, email, username, password, full_name, title, role_id, status)
        VALUES 
          ('u1', 'admin@wolver.vn', 'admin', 'admin123', 'Tran Duc Duy', 'Admin CNTT', 'admin', 'active'),
          ('u2', 'supervisor@wolver.vn', 'supervisor01', 'sup123', 'Nguyen Van Binh', 'Truong ca san xuat', 'supervisor', 'active'),
          ('u3', 'operator@wolver.vn', 'operator01', 'op123', 'Le Thi Cam', 'Cong nhan van hanh', 'operator', 'active'),
          ('google_admin_seed', 'tranducduy@gmail.com', 'tranducduy', 'dev123', 'Tran Duc Duy', 'Admin Google', 'admin', 'active')
      `);
      console.log('Seeding default users completed.');
    } else {
      await client.query("UPDATE users SET full_name = 'Tran Duc Duy' WHERE full_name = 'Tran Duy Anh'");
    }

    // Reset and reseed if RESET_DB=true OR if processes table is empty
    const procCountRes = await client.query('SELECT COUNT(*) FROM processes');
    const procCount = parseInt(procCountRes.rows[0].count, 10);
    const shouldReset = process.env.RESET_DB === 'true' || procCount === 0;

    if (shouldReset) {
      await seedFreshData(client);
    } else {
      // Check if forms table is empty but processes exist (existing DB before this change)
      const formsCountRes = await client.query('SELECT COUNT(*) FROM forms');
      const formsCount = parseInt(formsCountRes.rows[0].count, 10);
      if (formsCount === 0) {
        console.log('forms table is empty with existing processes — seeding forms only...');
        for (const form of SAMPLE_FORMS) {
          await client.query(`
            INSERT INTO forms (form_id, form_name, form_title, status, version, layout_blocks, revision_history)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (form_id) DO NOTHING
          `, [form.form_id, form.form_name, form.form_title, form.status, form.version, form.layout_blocks, form.revision_history]);
        }
        console.log('Forms seeded.');
      }
    }

    // Database Keep-Alive: Ping every 1 hour (Skip in Vercel Serverless)
    if (!process.env.VERCEL) {
      setInterval(async () => {
        try {
          if (dbPool) {
            await dbPool.query('SELECT 1');
            console.log('Database keep-alive ping sent.');
          }
        } catch (err) {
          console.error('Database keep-alive ping failed:', err);
        }
      }, 1000 * 60 * 60);
    }

  } catch (err) {
    console.error('Failed to initialize Supabase database:', err);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Helper: bump a version string — e.g. 'v0.3' → 'v0.4', 'v1' → 'v1.1'
function bumpVersion(versionStr) {
  if (!versionStr) return 'v0.2';
  const clean = versionStr.replace(/^v/i, '').split('(')[0].trim(); // strip prefix and any suffix like "(draft)"
  const parts = clean.split('.');
  if (parts.length === 1) {
    return `v${clean}.1`;
  }
  const major = parts.slice(0, -1).join('.');
  const minor = parseInt(parts[parts.length - 1], 10);
  return `v${major}.${isNaN(minor) ? 1 : minor + 1}`;
}

// Sync process forms to the relational table (mapping process_id + form_name to form_id + form_version)
async function syncProcessForms(clientOrPool, processId, workflowFormsData) {
  const activeFormNames = Object.keys(workflowFormsData || {});
  
  if (activeFormNames.length > 0) {
    await clientOrPool.query(
      'DELETE FROM process_forms WHERE process_id = $1 AND form_name NOT IN (SELECT unnest($2::text[]))',
      [processId, activeFormNames]
    );
  } else {
    await clientOrPool.query(
      'DELETE FROM process_forms WHERE process_id = $1',
      [processId]
    );
  }
  
  for (const [formName, formData] of Object.entries(workflowFormsData || {})) {
    if (formData && formData.formId) {
      const formVersion = formData.formVersion || formData.version || 'v0.1';
      await clientOrPool.query(`
        INSERT INTO process_forms (process_id, form_name, form_id, form_version, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (process_id, form_name) DO UPDATE SET
          form_id = EXCLUDED.form_id,
          form_version = EXCLUDED.form_version,
          updated_at = EXCLUDED.updated_at
      `, [
        processId,
        formName,
        formData.formId,
        formVersion
      ]);
    }
  }
}


// Helper function to escape CSV fields
function escapeCSVField(val) {
  if (val === undefined || val === null) return '';
  let str = String(val);
  // If value contains double quotes, commas, or newlines, we must escape it
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Read processes from CSV
function readProcessesFromCSV() {
  return new Promise((resolve, reject) => {
    const results = [];
    if (!fs.existsSync(CSV_PATH)) {
      return resolve([]);
    }
    fs.createReadStream(CSV_PATH)
      .pipe(csvParser())
      .on('data', (data) => {
        try {
          // Deserialize JSON strings back into arrays/objects
          if (data.roles) {
            data.roles = JSON.parse(data.roles);
          } else {
            data.roles = [];
          }
          if (data.steps) {
            data.steps = JSON.parse(data.steps);
          } else {
            data.steps = [];
          }
          if (data.formFields) {
            data.formFields = JSON.parse(data.formFields);
          } else {
            data.formFields = [];
          }
          if (data.workflowFormsData) {
            data.workflowFormsData = JSON.parse(data.workflowFormsData);
          } else {
            data.workflowFormsData = {};
          }
          if (data.sopSignoffs) {
            const parsed = JSON.parse(data.sopSignoffs);
            data.sopSignoffs = {
              author: parsed.author || { name: '', title: '' },
              reviewers: parsed.reviewers || (parsed.reviewer ? [parsed.reviewer] : [{ name: '', title: '' }]),
              authorisers: parsed.authorisers || (parsed.authoriser ? [parsed.authoriser] : [{ name: '', title: '' }]),
              effectiveDate: parsed.effectiveDate || ''
            };
          } else {
            // Migrates old columns gracefully
            data.sopSignoffs = {
              author: { name: data.authorName || '', title: data.authorTitle || '' },
              reviewers: [{ name: data.reviewerName || '', title: data.reviewerTitle || '' }],
              authorisers: [{ name: data.authoriserName || '', title: data.authoriserTitle || '' }],
              effectiveDate: data.effectiveDate || ''
            };
          }
          
          // Backward compatibility defaults
          data.parentProcessId = data.parentProcessId || data.id;
          data.status = data.status || 'Active';
          data.version = data.version || '1';

          results.push(data);
        } catch (err) {
          console.error('Error parsing row:', err, data);
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// Write processes to CSV
function writeProcessesToCSV(processes) {
  return new Promise((resolve, reject) => {
    const headers = ['id', 'title', 'description', 'version', 'lastUpdated', 'roles', 'steps', 'formFields', 'sopSignoffs', 'workflowFormsData', 'parentProcessId', 'status'];
    const rows = [headers.join(',')];

    processes.forEach(proc => {
      const row = [
        escapeCSVField(proc.id),
        escapeCSVField(proc.title),
        escapeCSVField(proc.description),
        escapeCSVField(proc.version),
        escapeCSVField(proc.lastUpdated),
        escapeCSVField(JSON.stringify(proc.roles || [])),
        escapeCSVField(JSON.stringify(proc.steps || [])),
        escapeCSVField(JSON.stringify(proc.formFields || [])),
        escapeCSVField(JSON.stringify(proc.sopSignoffs || {})),
        escapeCSVField(JSON.stringify(proc.workflowFormsData || {})),
        escapeCSVField(proc.parentProcessId || proc.id),
        escapeCSVField(proc.status || 'Active')
      ];
      rows.push(row.join(','));
    });

    fs.writeFile(CSV_PATH, rows.join('\n'), 'utf8', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Helper path for offline form JSON
const FORMS_JSON_PATH = path.join(__dirname, 'data', 'forms.json');

function readFormsOffline() {
  if (!fs.existsSync(FORMS_JSON_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(FORMS_JSON_PATH, 'utf8'));
  } catch (err) {
    console.error('Error reading offline forms:', err);
    return [];
  }
}

function writeFormsOffline(forms) {
  try {
    fs.writeFileSync(FORMS_JSON_PATH, JSON.stringify(forms, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing offline forms:', err);
  }
}

// ─── API FORMS (INDEPENDENT LIFE CYCLE) ──────────────────────────────────────

// GET /api/forms - List all form versions (each row is a distinct (form_id, version) snapshot)
app.get('/api/forms', async (req, res) => {
  try {
    if (dbPool) {
      // Returns all rows — frontend groups by form_id and picks the latest version as needed
      const result = await dbPool.query('SELECT * FROM forms ORDER BY form_id ASC, version ASC');
      res.json(result.rows);
    } else {
      res.json(readFormsOffline());
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch forms' });
  }
});

// GET /api/forms/:formId/history - Get the merged, de-duplicated revision timeline of a specific form_id
// NOTE: This route MUST be defined BEFORE the wildcard GET /api/forms/*formId route
app.get('/api/forms/*formId/history', async (req, res) => {
  try {
    const formId = Array.isArray(req.params.formId) ? req.params.formId[0] : req.params.formId;
    let allFormRows = [];

    if (dbPool) {
      const result = await dbPool.query(
        'SELECT * FROM forms WHERE form_id = $1 ORDER BY updated_at DESC',
        [formId]
      );
      allFormRows = result.rows;
    } else {
      const forms = readFormsOffline();
      allFormRows = forms.filter(f => f.form_id === formId).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    }

    const mergedHistoryMap = new Map();
    allFormRows.forEach(row => {
      const cleanVer = row.version ? row.version.replace(/\s*\([^)]*\)/g, '').trim() : 'v0.1';
      mergedHistoryMap.set(cleanVer, {
        version: cleanVer,
        date: row.updated_at ? new Date(row.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        author: 'System Generated',
        change: row.status === 'ACTIVE' ? 'Published version' : `Draft snapshot (Status: ${row.status})`,
        layoutBlocks: typeof row.layout_blocks === 'string' ? JSON.parse(row.layout_blocks) : (row.layout_blocks || []),
        status: row.status,
        rawVersion: row.version
      });
    });
    allFormRows.forEach(row => {
      if (row.revision_history) {
        let historyArray = [];
        try {
          historyArray = typeof row.revision_history === 'string' ? JSON.parse(row.revision_history) : row.revision_history;
        } catch (e) { console.error('Error parsing revision_history column:', e); }
        if (Array.isArray(historyArray)) {
          historyArray.forEach(entry => {
            if (entry && entry.version) {
              const cleanVer = entry.version.replace(/\s*\([^)]*\)/g, '').trim();
              const existing = mergedHistoryMap.get(cleanVer);
              const hasLayout = entry.layoutBlocks && entry.layoutBlocks.length > 0;
              const existingHasLayout = existing && existing.layoutBlocks && existing.layoutBlocks.length > 0;
              if (!existing || (hasLayout && !existingHasLayout)) {
                mergedHistoryMap.set(cleanVer, {
                  version: cleanVer,
                  date: entry.date || new Date().toISOString().split('T')[0],
                  author: entry.author || 'QA Administrator',
                  change: entry.change || 'Published version',
                  layoutBlocks: entry.layoutBlocks || [],
                  status: 'ACTIVE',
                  rawVersion: entry.version
                });
              }
            }
          });
        }
      }
    });
    const sortedHistory = Array.from(mergedHistoryMap.values()).sort((a, b) => {
      const parseVer = (v) => {
        const match = v.match(/v(\d+)\.(\d+)/);
        if (match) return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
        return { major: 0, minor: 0 };
      };
      const va = parseVer(a.version);
      const vb = parseVer(b.version);
      if (va.major !== vb.major) return vb.major - va.major;
      return vb.minor - va.minor;
    });
    res.json(sortedHistory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch unified form history' });
  }
});

// GET /api/forms/:formId - Get a specific form version (pass ?version=v0.3 or omit for latest)
app.get('/api/forms/*formId', async (req, res) => {
  try {
    const formId = Array.isArray(req.params.formId) ? req.params.formId[0] : req.params.formId;
    const { version } = req.query;
    if (dbPool) {
      let result;
      if (version) {
        // Fetch exact version snapshot
        result = await dbPool.query(
          'SELECT * FROM forms WHERE form_id = $1 AND version = $2',
          [formId, version]
        );
      } else {
        // Fetch the most recently updated version (latest snapshot)
        result = await dbPool.query(
          'SELECT * FROM forms WHERE form_id = $1 ORDER BY updated_at DESC LIMIT 1',
          [formId]
        );
      }
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form not found' });
      }
      res.json(result.rows[0]);
    } else {
      const forms = readFormsOffline();
      const form = version
        ? forms.find(f => f.form_id === formId && f.version === version)
        : forms.filter(f => f.form_id === formId).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
      if (!form) return res.status(404).json({ error: 'Form not found' });
      res.json(form);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch form details' });
  }
});


// DELETE /api/forms/:formId - Delete a specific form version (requires ?version=v0.2)
app.delete('/api/forms/*formId', async (req, res) => {
  try {
    const formId = Array.isArray(req.params.formId) ? req.params.formId[0] : req.params.formId;
    const { version } = req.query;
    if (!version) {
      return res.status(400).json({ error: 'Missing required version parameter.' });
    }
    
    if (dbPool) {
      const result = await dbPool.query(
        'DELETE FROM forms WHERE form_id = $1 AND version = $2',
        [formId, version]
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ 
          error: `Không tìm thấy bản ghi. Form ID: "${formId}", Version: "${version}". Phiên bản trong database có thể khác với phiên bản đang xem.`
        });
      }
    } else {
      const forms = readFormsOffline();
      const filtered = forms.filter(f => !(f.form_id === formId && f.version === version));
      if (filtered.length === forms.length) {
        return res.status(404).json({
          error: `Không tìm thấy bản ghi. Form ID: "${formId}", Version: "${version}".`
        });
      }
      writeFormsOffline(filtered);
    }
    
    res.json({ success: true, message: `Version ${version} of form ${formId} deleted successfully.` });
  } catch (err) {
    console.error('Error deleting form version:', err);
    res.status(500).json({ error: 'Failed to delete form version.' });
  }
});



// POST /api/forms - Save or Update form template (upsert by form_id + version composite key)
app.post('/api/forms', async (req, res) => {
  try {
    const { formId, formName, formTitle, status, version, effectiveDate, layoutBlocks, revisionHistory, pdfName, pdfKey, pdfSize, oldFormId } = req.body;
    
    if (!formId || !formName) {
      return res.status(400).json({ error: 'formId and formName are required' });
    }

    const blocks = Array.isArray(layoutBlocks) ? JSON.stringify(layoutBlocks) : (layoutBlocks || '[]');
    const history = Array.isArray(revisionHistory) ? JSON.stringify(revisionHistory) : (revisionHistory || '[]');
    const ver = version || 'v0.1';

    if (dbPool) {
      // If Form ID changed and it was a draft, delete the old draft record
      if (oldFormId && oldFormId !== formId) {
        await dbPool.query(
          "DELETE FROM forms WHERE form_id = $1 AND version = $2 AND status = 'DRAFT'",
          [oldFormId, ver]
        );
      }

      // Check safety: Ensure we are not overwriting an existing ACTIVE version in database
      const safetyCheck = await dbPool.query(
        'SELECT status FROM forms WHERE form_id = $1 AND version = $2',
        [formId, ver]
      );
      if (safetyCheck.rows.length > 0 && safetyCheck.rows[0].status === 'ACTIVE') {
        return res.status(400).json({ error: `Version ${ver} is already ACTIVE and locked. You must increment the version number to save your changes.` });
      }

      // Upsert using composite PK (form_id, version) — each version is an independent snapshot
      const query = `
        INSERT INTO forms (
          form_id, form_name, form_title, status, version, effective_date, layout_blocks, revision_history, pdf_name, pdf_key, pdf_size, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (form_id, version) DO UPDATE SET
          form_name = EXCLUDED.form_name,
          form_title = EXCLUDED.form_title,
          status = EXCLUDED.status,
          effective_date = EXCLUDED.effective_date,
          layout_blocks = EXCLUDED.layout_blocks,
          revision_history = EXCLUDED.revision_history,
          pdf_name = EXCLUDED.pdf_name,
          pdf_key = EXCLUDED.pdf_key,
          pdf_size = EXCLUDED.pdf_size,
          updated_at = NOW()
        RETURNING *
      `;
      const values = [formId, formName, formTitle || formName, status || 'DRAFT', ver, effectiveDate || null, blocks, history, pdfName || null, pdfKey || null, pdfSize || 0];
      const result = await dbPool.query(query, values);
      res.status(200).json(result.rows[0]);
    } else {
      let forms = readFormsOffline();
      if (oldFormId && oldFormId !== formId) {
        forms = forms.filter(f => !(f.form_id === oldFormId && f.version === ver && f.status === 'DRAFT'));
      }
      const existingIdx = forms.findIndex(f => f.form_id === formId && f.version === ver);
      const newForm = {
        form_id: formId,
        form_name: formName,
        form_title: formTitle || formName,
        status: status || 'DRAFT',
        version: ver,
        layout_blocks: Array.isArray(layoutBlocks) ? layoutBlocks : JSON.parse(layoutBlocks || '[]'),
        revision_history: Array.isArray(revisionHistory) ? revisionHistory : JSON.parse(revisionHistory || '[]'),
        pdf_name: pdfName || null,
        pdf_key: pdfKey || null,
        pdf_size: pdfSize || 0,
        updated_at: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        forms[existingIdx] = newForm;
      } else {
        forms.push(newForm);
      }
      writeFormsOffline(forms);
      res.status(200).json(newForm);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save form template' });
  }
});

// POST /api/forms/:formId/activate - Transition a specific form version to ACTIVE status
app.post('/api/forms/:formId/activate', async (req, res) => {
  try {
    const { formId } = req.params;
    const { version, revisionHistory } = req.body;
    
    const history = Array.isArray(revisionHistory) ? JSON.stringify(revisionHistory) : (revisionHistory || '[]');

    if (dbPool) {
      // Update the specific (form_id, version) row
      const result = await dbPool.query(
        `UPDATE forms 
         SET status = 'ACTIVE', revision_history = $1, updated_at = NOW() 
         WHERE form_id = $2 AND version = $3 RETURNING *`,
        [history, formId, version]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
      res.json(result.rows[0]);
    } else {
      const forms = readFormsOffline();
      const form = forms.find(f => f.form_id === formId && f.version === version);
      if (!form) return res.status(404).json({ error: 'Form not found' });
      form.status = 'ACTIVE';
      form.revision_history = Array.isArray(revisionHistory) ? revisionHistory : JSON.parse(revisionHistory || '[]');
      form.updated_at = new Date().toISOString();
      writeFormsOffline(forms);
      res.json(form);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to activate form' });
  }
});

// POST /api/forms/:formId/archive - Archive a specific form version
app.post('/api/forms/:formId/archive', async (req, res) => {
  try {
    const { formId } = req.params;
    const { version } = req.body;
    if (dbPool) {
      let result;
      if (version) {
        result = await dbPool.query(
          `UPDATE forms SET status = 'ARCHIVED', updated_at = NOW() WHERE form_id = $1 AND version = $2 RETURNING *`,
          [formId, version]
        );
      } else {
        // Fallback: archive all versions of this form_id
        result = await dbPool.query(
          `UPDATE forms SET status = 'ARCHIVED', updated_at = NOW() WHERE form_id = $1 RETURNING *`,
          [formId]
        );
      }
      if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
      res.json(result.rows);
    } else {
      const forms = readFormsOffline();
      const targets = version
        ? forms.filter(f => f.form_id === formId && f.version === version)
        : forms.filter(f => f.form_id === formId);
      if (!targets.length) return res.status(404).json({ error: 'Form not found' });
      targets.forEach(f => { f.status = 'ARCHIVED'; f.updated_at = new Date().toISOString(); });
      writeFormsOffline(forms);
      res.json(targets);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to archive form' });
  }
});

// GET /api/processes/check-id - Check process ID uniqueness
app.get('/api/processes/check-id', async (req, res) => {
  try {
    const { id, exclude } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'ID parameter is required' });
    }
    if (dbPool) {
      let queryStr = 'SELECT id FROM processes WHERE (id = $1 OR "parentProcessId" = $1)';
      const params = [id];
      if (exclude) {
        queryStr += ' AND ("parentProcessId" <> $2 AND id <> $2)';
        params.push(exclude);
      }
      const result = await dbPool.query(queryStr, params);
      return res.json({ available: result.rows.length === 0 });
    }
    return res.json({ available: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error check process ID' });
  }
});

// GET /api/processes - List all processes
app.get('/api/processes', async (req, res) => {
  try {
    if (dbPool) {
      const result = await dbPool.query('SELECT * FROM processes');
      const formsRes = await dbPool.query('SELECT * FROM process_forms');
      
      // Build a map: process_id → { formName → { formId, formVersion } }
      const formsByProcess = {};
      for (const formRow of formsRes.rows) {
        if (!formsByProcess[formRow.process_id]) {
          formsByProcess[formRow.process_id] = {};
        }
        formsByProcess[formRow.process_id][formRow.form_name] = {
          formId: formRow.form_id || undefined,
          formVersion: formRow.form_version || 'v0.1'
        };
      }
      
      const processes = result.rows.map(proc => {
        const dbFormsData = proc.workflowFormsData || {};
        const relFormsData = formsByProcess[proc.id] || {};
        
        // Merge: relational table wins for formId/formVersion (authoritative link)
        const mergedFormsData = { ...dbFormsData };
        for (const [formName, relData] of Object.entries(relFormsData)) {
          mergedFormsData[formName] = {
            ...(mergedFormsData[formName] || {}),
            ...relData
          };
        }
        
        return {
          ...proc,
          workflowFormsData: mergedFormsData
        };
      });
      
      res.json(processes);
    } else {
      const processes = await readProcessesFromCSV();
      res.json(processes);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to read processes database' });
  }
});

// POST /api/processes - Save/Update a process
app.post('/api/processes', async (req, res) => {
  try {
    const processData = req.body;
    if (!processData.title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const now = new Date().toISOString();

    if (dbPool) {
      if (processData.id) {
        // Handle process family ID rename first
        if (processData.oldParentProcessId && processData.newParentProcessId && processData.oldParentProcessId !== processData.newParentProcessId) {
          const client = await dbPool.connect();
          try {
            await client.query('BEGIN');
            
            // Verify if new ID is already in use by another process
            const conflictCheck = await client.query(
              'SELECT id FROM processes WHERE (id = $1 OR "parentProcessId" = $1) AND "parentProcessId" <> $2 AND id <> $2',
              [processData.newParentProcessId, processData.oldParentProcessId]
            );
            if (conflictCheck.rows.length > 0) {
              await client.query('ROLLBACK');
              return res.status(400).json({ error: 'Process ID already in use.' });
            }

            // Fetch all versions belonging to the old family
            const versionsRes = await client.query(
              'SELECT id, "parentProcessId" FROM processes WHERE "parentProcessId" = $1 OR id = $1',
              [processData.oldParentProcessId]
            );

            // Update each version ID and parent ID (this will cascade update process_forms and submissions)
            for (const procRow of versionsRes.rows) {
              let newVersionId;
              if (procRow.id === processData.oldParentProcessId) {
                newVersionId = processData.newParentProcessId;
              } else if (procRow.id.startsWith(processData.oldParentProcessId)) {
                const suffix = procRow.id.substring(processData.oldParentProcessId.length);
                newVersionId = processData.newParentProcessId + suffix;
              } else {
                newVersionId = procRow.id;
              }

              await client.query(
                'UPDATE processes SET id = $1, "parentProcessId" = $2 WHERE id = $3',
                [newVersionId, processData.newParentProcessId, procRow.id]
              );

              // If this is the version we are currently saving/updating, update its ID in memory
              if (procRow.id === processData.id) {
                processData.id = newVersionId;
              }
            }

            // Update parentProcessId of the payload in memory
            processData.parentProcessId = processData.newParentProcessId;
            
            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          } finally {
            client.release();
          }
        }

        // Update existing
        const checkRes = await dbPool.query('SELECT * FROM processes WHERE id = $1', [processData.id]);
        if (checkRes.rows.length > 0) {
          const existing = checkRes.rows[0];
          const previousStatus = existing.status || 'Active';
          const currentStatus = processData.status || 'Draft';
          const parentId = processData.parentProcessId || existing.parentProcessId || processData.id;

          const oldLogoKeys = getLogoKeysFromForms(existing.workflowFormsData);
          const newLogoKeys = getLogoKeysFromForms(processData.workflowFormsData);
          const deReferencedKeys = [...oldLogoKeys].filter(k => !newLogoKeys.has(k));

          const updatedProcess = {
            ...existing,
            ...processData,
            parentProcessId: parentId,
            lastUpdated: now
          };

          await dbPool.query(`
            UPDATE processes SET 
              title = $1, 
              description = $2, 
              version = $3, 
              "lastUpdated" = $4, 
              roles = $5, 
              steps = $6, 
              "formFields" = $7, 
              "sopSignoffs" = $8, 
              "workflowFormsData" = $9, 
              "parentProcessId" = $10, 
              status = $11 
            WHERE id = $12
          `, [
            updatedProcess.title,
            updatedProcess.description || '',
            updatedProcess.version || '1',
            updatedProcess.lastUpdated,
            JSON.stringify(updatedProcess.roles || []),
            JSON.stringify(updatedProcess.steps || []),
            JSON.stringify(updatedProcess.formFields || []),
            JSON.stringify(updatedProcess.sopSignoffs || {}),
            JSON.stringify(updatedProcess.workflowFormsData || {}),
            updatedProcess.parentProcessId,
            updatedProcess.status,
            updatedProcess.id
          ]);

          await syncProcessForms(dbPool, updatedProcess.id, updatedProcess.workflowFormsData || {});

          // Automatically trigger clean up for de-referenced logo files
          for (const key of deReferencedKeys) {
            await deleteLogoFromR2IfUnused(key);
          }

          if (currentStatus === 'Active' && previousStatus !== 'Active') {
            await dbPool.query(`
              UPDATE processes SET status = 'Superseded'
              WHERE ("parentProcessId" = $1 OR id = $1) AND id <> $2 AND status = 'Active'
            `, [parentId, updatedProcess.id]);
          }

          return res.json(updatedProcess);
        }
      }

      // Create new
      const newId = processData.id || ('proc_' + Date.now());
      // Check if newId already exists (just to be safe)
      const conflictCheck = await dbPool.query('SELECT id FROM processes WHERE id = $1', [newId]);
      if (conflictCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Process ID already in use.' });
      }
      const newProcess = {
        id: newId,
        parentProcessId: processData.parentProcessId || newId,
        status: processData.status || 'Draft',
        title: processData.title,
        description: processData.description || '',
        version: processData.version || '1',
        lastUpdated: now,
        roles: processData.roles || [],
        steps: processData.steps || [],
        formFields: processData.formFields || [],
        sopSignoffs: processData.sopSignoffs || {},
        workflowFormsData: processData.workflowFormsData || {}
      };

      await dbPool.query(`
        INSERT INTO processes (
          id, title, description, version, "lastUpdated", roles, steps, "formFields", "sopSignoffs", "workflowFormsData", "parentProcessId", status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        newProcess.id,
        newProcess.title,
        newProcess.description || '',
        newProcess.version || '1',
        newProcess.lastUpdated,
        JSON.stringify(newProcess.roles),
        JSON.stringify(newProcess.steps),
        JSON.stringify(newProcess.formFields),
        JSON.stringify(newProcess.sopSignoffs),
        JSON.stringify(newProcess.workflowFormsData),
        newProcess.parentProcessId,
        newProcess.status
      ]);

      await syncProcessForms(dbPool, newProcess.id, newProcess.workflowFormsData || {});

      if (newProcess.status === 'Active') {
        await dbPool.query(`
          UPDATE processes SET status = 'Superseded'
          WHERE ("parentProcessId" = $1 OR id = $1) AND id <> $2 AND status = 'Active'
        `, [newProcess.parentProcessId, newProcess.id]);
      }

      return res.status(201).json(newProcess);
    } else {
      // Local CSV mode
      const processes = await readProcessesFromCSV();
      if (processData.id) {
        // Update existing
        const index = processes.findIndex(p => p.id === processData.id);
        if (index !== -1) {
          const existing = processes[index];
          const previousStatus = existing.status || 'Active';
          const currentStatus = processData.status || 'Draft';
          const parentId = processData.parentProcessId || existing.parentProcessId || processData.id;

          const oldLogoKeys = getLogoKeysFromForms(existing.workflowFormsData);
          const newLogoKeys = getLogoKeysFromForms(processData.workflowFormsData);
          const deReferencedKeys = [...oldLogoKeys].filter(k => !newLogoKeys.has(k));

          processes[index] = {
            ...existing,
            ...processData,
            parentProcessId: parentId,
            lastUpdated: now
          };

          if (currentStatus === 'Active' && previousStatus !== 'Active') {
            processes.forEach(p => {
              if ((p.parentProcessId === parentId || p.id === parentId) && p.id !== processData.id && p.status === 'Active') {
                p.status = 'Superseded';
              }
            });
          }

          await writeProcessesToCSV(processes);

          // Automatically trigger clean up for de-referenced logo files
          for (const key of deReferencedKeys) {
            await deleteLogoFromR2IfUnused(key);
          }
          return res.json(processes[index]);
        }
      }

      // Create new
      const newId = 'proc_' + Date.now();
      const newProcess = {
        id: newId,
        parentProcessId: processData.parentProcessId || newId,
        status: processData.status || 'Draft',
        title: processData.title,
        description: processData.description || '',
        version: processData.version || '1',
        lastUpdated: now,
        roles: processData.roles || [],
        steps: processData.steps || [],
        formFields: processData.formFields || [],
        sopSignoffs: processData.sopSignoffs || {},
        workflowFormsData: processData.workflowFormsData || {}
      };

      if (newProcess.status === 'Active') {
        const parentId = newProcess.parentProcessId;
        processes.forEach(p => {
          if ((p.parentProcessId === parentId || p.id === parentId) && p.id !== newProcess.id && p.status === 'Active') {
            p.status = 'Superseded';
          }
        });
      }

      processes.push(newProcess);
      await writeProcessesToCSV(processes);
      res.status(201).json(newProcess);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save process' });
  }
});

// POST /api/processes/:id/new-version - Create a new draft version from an existing process version
app.post('/api/processes/:id/new-version', async (req, res) => {
  try {
    const id = req.params.id;

    if (dbPool) {
      const checkRes = await dbPool.query('SELECT * FROM processes WHERE id = $1', [id]);
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ error: 'Source process not found' });
      }
      const source = checkRes.rows[0];
      const parentId = source.parentProcessId || source.id;

      const siblingRes = await dbPool.query(
        'SELECT * FROM processes WHERE "parentProcessId" = $1 OR id = $1',
        [parentId]
      );
      const siblings = siblingRes.rows;

      const existingDraft = siblings.find(p => p.status === 'Draft');
      if (existingDraft) {
        return res.json(existingDraft);
      }

      let maxVer = 0;
      siblings.forEach(p => {
        const verNum = parseInt(p.version, 10);
        if (!isNaN(verNum) && verNum > maxVer) {
          maxVer = verNum;
        }
      });

      const nextVer = maxVer + 1;
      const now = new Date().toISOString();
      const newId = `${parentId}_v${nextVer}`;

      // New process version simply inherits the same form references.
      // Form versioning is independent — each form manages its own lifecycle.
      // The process links to form_id only; ProcessEditor will always show the latest ACTIVE version.
      const cleanWorkflowFormsData = {};
      if (source.workflowFormsData) {
        for (const [formName, formData] of Object.entries(source.workflowFormsData)) {
          if (formData && formData.formId) {
            cleanWorkflowFormsData[formName] = { formId: formData.formId };
          }
        }
      }


      const newProcess = {
        ...source,
        id: newId,
        parentProcessId: parentId,
        version: String(nextVer),
        status: 'Draft',
        lastUpdated: now,
        sopSignoffs: {
          author: source.sopSignoffs?.author || { name: '', title: '' },
          reviewers: (source.sopSignoffs?.reviewers || []).map(r => ({ name: r.name, title: r.title })),
          authorisers: (source.sopSignoffs?.authorisers || []).map(a => ({ name: a.name, title: a.title })),
          effectiveDate: ''
        },
        workflowFormsData: cleanWorkflowFormsData
      };

      await dbPool.query(`
        INSERT INTO processes (
          id, title, description, version, "lastUpdated", roles, steps, "formFields", "sopSignoffs", "workflowFormsData", "parentProcessId", status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        newProcess.id,
        newProcess.title,
        newProcess.description || '',
        newProcess.version || '1',
        newProcess.lastUpdated,
        JSON.stringify(newProcess.roles || []),
        JSON.stringify(newProcess.steps || []),
        JSON.stringify(newProcess.formFields || []),
        JSON.stringify(newProcess.sopSignoffs || {}),
        JSON.stringify(newProcess.workflowFormsData || {}),
        newProcess.parentProcessId,
        newProcess.status
      ]);

      await syncProcessForms(dbPool, newProcess.id, newProcess.workflowFormsData || {});

      res.status(201).json(newProcess);
    } else {
      // Local CSV mode
      const processes = await readProcessesFromCSV();
      const source = processes.find(p => p.id === id);
      if (!source) {
        return res.status(404).json({ error: 'Source process not found' });
      }

      const parentId = source.parentProcessId || source.id;
      const siblingVersions = processes.filter(p => p.parentProcessId === parentId || p.id === parentId);
      
      const existingDraft = siblingVersions.find(p => p.status === 'Draft');
      if (existingDraft) {
        return res.json(existingDraft);
      }
      
      let maxVer = 0;
      siblingVersions.forEach(p => {
        const verNum = parseInt(p.version, 10);
        if (!isNaN(verNum) && verNum > maxVer) {
          maxVer = verNum;
        }
      });

      const nextVer = maxVer + 1;
      const now = new Date().toISOString();
      const newId = `${parentId}_v${nextVer}`;

      const cleanWorkflowFormsData = {};
      if (source.workflowFormsData) {
        for (const [formName, formData] of Object.entries(source.workflowFormsData)) {
          if (formData && formData.formId) {
            cleanWorkflowFormsData[formName] = { formId: formData.formId };
          }
        }
      }

      const newProcess = {
        ...source,
        id: newId,
        parentProcessId: parentId,
        version: String(nextVer),
        status: 'Draft',
        lastUpdated: now,
        sopSignoffs: {
          author: source.sopSignoffs?.author || { name: '', title: '' },
          reviewers: (source.sopSignoffs?.reviewers || []).map(r => ({ name: r.name, title: r.title })),
          authorisers: (source.sopSignoffs?.authorisers || []).map(a => ({ name: a.name, title: a.title })),
          effectiveDate: ''
        },
        workflowFormsData: cleanWorkflowFormsData
      };

      processes.push(newProcess);
      await writeProcessesToCSV(processes);
      res.status(201).json(newProcess);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create new version draft' });
  }
});

// DELETE /api/processes/:id - Delete a process
app.delete('/api/processes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let existingProcess = null;

    if (dbPool) {
      const resSelect = await dbPool.query('SELECT "workflowFormsData" FROM processes WHERE id = $1', [id]);
      if (resSelect.rows.length > 0) {
        existingProcess = resSelect.rows[0];
      }

      const deleteRes = await dbPool.query('DELETE FROM processes WHERE id = $1', [id]);
      if (deleteRes.rowCount === 0) {
        return res.status(404).json({ error: 'Process not found' });
      }

      if (existingProcess) {
        const logoKeys = getLogoKeysFromForms(existingProcess.workflowFormsData);
        for (const key of logoKeys) {
          await deleteLogoFromR2IfUnused(key);
        }
      }
      res.json({ success: true });
    } else {
      // Local CSV mode
      const processes = await readProcessesFromCSV();
      existingProcess = processes.find(p => p.id === id);
      const filtered = processes.filter(p => p.id !== id);
      
      if (processes.length === filtered.length) {
        return res.status(404).json({ error: 'Process not found' });
      }

      await writeProcessesToCSV(filtered);

      if (existingProcess) {
        const logoKeys = getLogoKeysFromForms(existingProcess.workflowFormsData);
        for (const key of logoKeys) {
          await deleteLogoFromR2IfUnused(key);
        }
      }
      res.json({ success: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete process' });
  }
});


// Storage Quota Constant: 2 GB (1/5 of Cloudflare R2's 10 GB free tier)
const STORAGE_QUOTA_LIMIT = 2 * 1024 * 1024 * 1024; // 2,147,483,648 bytes

// Helper to get total storage usage
async function getTotalStorageUsage() {
  if (dbPool) {
    const res = await dbPool.query('SELECT COALESCE(SUM(pdf_size), 0) AS total_size FROM forms');
    return parseInt(res.rows[0].total_size, 10) || 0;
  } else {
    const processes = await readProcessesFromCSV();
    let totalSize = 0;
    processes.forEach(proc => {
      const forms = proc.workflowFormsData || {};
      Object.values(forms).forEach(form => {
        if (form && form.pdfSize) {
          totalSize += parseInt(form.pdfSize, 10) || 0;
        }
      });
    });
    return totalSize;
  }
}

// GET /api/storage/quota-status - Retrieve current storage usage and limit info
app.get('/api/storage/quota-status', async (req, res) => {
  try {
    const totalSize = await getTotalStorageUsage();
    res.json({
      totalSize,
      quotaLimit: STORAGE_QUOTA_LIMIT,
      percentage: ((totalSize / STORAGE_QUOTA_LIMIT) * 100).toFixed(2),
      isConfigured: r2Client !== null
    });
  } catch (err) {
    console.error('Error fetching quota status:', err);
    res.status(500).json({ error: 'Failed to fetch storage quota status' });
  }
});

// Helper: extract all logo keys from a workflowFormsData object
function getLogoKeysFromForms(workflowFormsData) {
  const keys = new Set();
  if (!workflowFormsData) return keys;
  let formsData = workflowFormsData;
  if (typeof formsData === 'string') {
    try { formsData = JSON.parse(formsData); } catch (e) { formsData = {}; }
  }
  for (const form of Object.values(formsData)) {
    if (form && form.layoutBlocks) {
      for (const block of form.layoutBlocks) {
        if (block.logo && block.logo.startsWith('uploads/logo_')) {
          keys.add(block.logo);
        }
      }
    }
  }
  return keys;
}

// Helper: check if a logo key is still used in any form
async function isLogoKeyUsed(logoKey) {
  let allProcesses = [];
  if (dbPool) {
    const res = await dbPool.query('SELECT "workflowFormsData" FROM processes');
    allProcesses = res.rows;
  } else {
    allProcesses = await readProcessesFromCSV();
  }

  for (const proc of allProcesses) {
    let formsData = proc.workflowFormsData;
    if (typeof formsData === 'string') {
      try { formsData = JSON.parse(formsData); } catch (e) { formsData = {}; }
    }
    if (!formsData) continue;
    for (const form of Object.values(formsData)) {
      if (form && form.layoutBlocks) {
        for (const block of form.layoutBlocks) {
          if (block.logo === logoKey) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Helper: Delete logo from R2 if not used anywhere
async function deleteLogoFromR2IfUnused(logoKey) {
  if (!logoKey || !logoKey.startsWith('uploads/logo_') || !r2Client) return;
  try {
    const isUsed = await isLogoKeyUsed(logoKey);
    if (!isUsed) {
      console.log(`Logo key ${logoKey} is no longer used. Deleting from R2...`);
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: logoKey,
      });
      await r2Client.send(command);
      console.log(`Successfully deleted orphaned logo ${logoKey} from R2.`);
    } else {
      console.log(`Logo key ${logoKey} is still in use. Keeping in R2.`);
    }
  } catch (err) {
    console.error(`Failed to cleanup logo ${logoKey} from R2:`, err);
  }
}

// GET /api/storage/logos - List all logo files in R2 storage with usage metadata
app.get('/api/storage/logos', async (req, res) => {
  try {
    if (!r2Client) {
      return res.json({ logos: [] });
    }
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: 'uploads/logo_',
    });
    const s3Res = await r2Client.send(command);
    const keys = (s3Res.Contents || []).map(item => item.Key);
    
    // Check usage of each logo key
    const logos = await Promise.all(keys.map(async (key) => {
      const isUsed = await isLogoKeyUsed(key);
      return { key, isUsed };
    }));
    
    res.json({ logos });
  } catch (err) {
    console.error('Error listing logos:', err);
    res.status(500).json({ error: 'Failed to list logo files' });
  }
});

// DELETE /api/storage/logos - Delete an unused logo from R2 storage
app.delete('/api/storage/logos', async (req, res) => {
  try {
    if (!r2Client) {
      return res.status(503).json({ error: 'Cloudflare R2 is not configured.' });
    }
    const { logoKey } = req.body;
    if (!logoKey) {
      return res.status(400).json({ error: 'Missing logoKey.' });
    }
    const isUsed = await isLogoKeyUsed(logoKey);
    if (isUsed) {
      return res.status(400).json({ error: 'This logo is currently in use by a form and cannot be deleted.' });
    }
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: logoKey,
    });
    await r2Client.send(command);
    console.log(`Successfully deleted unused logo ${logoKey} from R2 via gallery.`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting logo:', err);
    res.status(500).json({ error: 'Failed to delete logo file' });
  }
});

// POST /api/storage/presign-upload - Generate secure R2 upload URL with quota checks
app.post('/api/storage/presign-upload', async (req, res) => {
  try {
    if (!r2Client) {
      return res.status(503).json({ error: 'Cloudflare R2 is not configured on this server.' });
    }

    const { processId, formName, fileName, fileSize, fileType, isLogo, logoName } = req.body;
    
    if (!isLogo && (!processId || !formName || !fileName || !fileSize)) {
      return res.status(400).json({ error: 'Missing required upload parameters (processId, formName, fileName, fileSize).' });
    }
    if (isLogo && (!fileName || !fileSize || !logoName)) {
      return res.status(400).json({ error: 'Missing required upload parameters (fileName, fileSize, logoName).' });
    }

    // 1. Enforce individual file size limit (50 MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File size is too large. Maximum allowed size is 50 MB.` });
    }

    // 2. Check total storage quota (2 GB)
    const totalUsage = await getTotalStorageUsage();
    if (totalUsage + fileSize > STORAGE_QUOTA_LIMIT) {
      return res.status(400).json({
        error: `Storage quota exceeded. Uploading this file will exceed the 2 GB storage limit (1/5 of Cloudflare R2's free tier).`
      });
    }

    // 3. Generate secure path in bucket
    let pdfKey;
    if (isLogo && logoName) {
      const extension = fileName.split('.').pop().toLowerCase();
      pdfKey = `uploads/logo_${logoName.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`;
    } else {
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      pdfKey = `uploads/${processId}/${formName.replace(/[^a-zA-Z0-9-]/g, '_')}_${Date.now()}_${sanitizedFileName}`;
    }

    // 4. Generate presigned URL for PUT request
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: pdfKey,
      ContentType: fileType || 'application/pdf',
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 }); // 5 minutes expiration

    res.json({ uploadUrl, pdfKey });
  } catch (err) {
    console.error('Error generating presigned upload URL:', err);
    res.status(500).json({ error: 'Failed to generate secure upload URL' });
  }
});

// POST /api/storage/confirm-upload - Confirm file has been uploaded and update DB/CSV
app.post('/api/storage/confirm-upload', async (req, res) => {
  try {
    const { processId, formName, pdfName, pdfKey, pdfSize } = req.body;
    if (!processId || !formName || !pdfName || !pdfKey || !pdfSize) {
      return res.status(400).json({ error: 'Missing required confirmation parameters.' });
    }

    if (dbPool) {
      // 1. Update relational table
      await dbPool.query(`
        INSERT INTO process_forms (process_id, form_name, pdf_name, pdf_key, pdf_size, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (process_id, form_name) DO UPDATE SET
          pdf_name = EXCLUDED.pdf_name,
          pdf_key = EXCLUDED.pdf_key,
          pdf_size = EXCLUDED.pdf_size,
          updated_at = EXCLUDED.updated_at
      `, [processId, formName, pdfName, pdfKey, pdfSize]);

      // 2. Load processes row to get workflowFormsData JSONB
      const processRes = await dbPool.query('SELECT "workflowFormsData" FROM processes WHERE id = $1', [processId]);
      if (processRes.rows.length > 0) {
        const workflowFormsData = processRes.rows[0].workflowFormsData || {};
        workflowFormsData[formName] = {
          ...workflowFormsData[formName],
          pdfName,
          pdfKey,
          pdfSize
        };
        await dbPool.query(
          'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
          [JSON.stringify(workflowFormsData), new Date().toISOString(), processId]
        );
      }
    } else {
      // Local CSV mode
      const processes = await readProcessesFromCSV();
      const idx = processes.findIndex(p => p.id === processId);
      if (idx !== -1) {
        const workflowFormsData = processes[idx].workflowFormsData || {};
        workflowFormsData[formName] = {
          ...workflowFormsData[formName],
          pdfName,
          pdfKey,
          pdfSize
        };
        processes[idx].workflowFormsData = workflowFormsData;
        processes[idx].lastUpdated = new Date().toISOString();
        await writeProcessesToCSV(processes);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error confirming upload:', err);
    res.status(500).json({ error: 'Failed to confirm file upload' });
  }
});

// DELETE /api/storage/delete-file - Remove file from R2 bucket and update DB/CSV
app.delete('/api/storage/delete-file', async (req, res) => {
  try {
    const { processId, formName, pdfKey } = req.body;
    if (!processId || !formName) {
      return res.status(400).json({ error: 'Missing processId or formName.' });
    }

    // 1. Delete object from R2 (only if key exists)
    if (r2Client && pdfKey) {
      try {
        await r2Client.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: pdfKey
        }));
        console.log(`Successfully deleted key ${pdfKey} from R2 bucket.`);
      } catch (s3Err) {
        console.error('Error deleting object from S3 storage:', s3Err);
        // Continue database updates even if R2 delete fails, to keep database consistent
      }
    }

    // 2. Update database
    if (dbPool) {
      // Set columns to NULL in process_forms
      await dbPool.query(`
        UPDATE process_forms 
        SET pdf_name = NULL, pdf_key = NULL, pdf_size = 0, updated_at = NOW()
        WHERE process_id = $1 AND form_name = $2
      `, [processId, formName]);

      // Update processes JSONB column
      const processRes = await dbPool.query('SELECT "workflowFormsData" FROM processes WHERE id = $1', [processId]);
      if (processRes.rows.length > 0) {
        const workflowFormsData = processRes.rows[0].workflowFormsData || {};
        if (workflowFormsData[formName]) {
          delete workflowFormsData[formName].pdfName;
          delete workflowFormsData[formName].pdfKey;
          delete workflowFormsData[formName].pdfSize;
        }
        await dbPool.query(
          'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
          [JSON.stringify(workflowFormsData), new Date().toISOString(), processId]
        );
      }
    } else {
      // Local CSV mode
      const processes = await readProcessesFromCSV();
      const idx = processes.findIndex(p => p.id === processId);
      if (idx !== -1) {
        const workflowFormsData = processes[idx].workflowFormsData || {};
        if (workflowFormsData[formName]) {
          delete workflowFormsData[formName].pdfName;
          delete workflowFormsData[formName].pdfKey;
          delete workflowFormsData[formName].pdfSize;
        }
        processes[idx].workflowFormsData = workflowFormsData;
        processes[idx].lastUpdated = new Date().toISOString();
        await writeProcessesToCSV(processes);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// GET /api/storage/download-url - Retrieve secure presigned GET URL for reading file
app.get('/api/storage/download-url', async (req, res) => {
  try {
    if (!r2Client) {
      return res.status(503).json({ error: 'Cloudflare R2 is not configured on this server.' });
    }

    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ error: 'Missing required query parameter "key".' });
    }

    // Generate presigned URL for GET request (valid for 15 minutes)
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const downloadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });

    res.json({ downloadUrl });
  } catch (err) {
    console.error('Error generating presigned download URL:', err);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});


// GET /api/submissions - Retrieve all submissions from Supabase
app.get('/api/submissions', async (req, res) => {
  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }
    const result = await dbPool.query('SELECT * FROM submissions ORDER BY submitted_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ error: 'Failed to retrieve submission records.' });
  }
});

// POST /api/submissions - Save a completed form submission
app.post('/api/submissions', async (req, res) => {
  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }
    const { id, processId, formId, formVersion, operatorId, status, formData, mediaUrls } = req.body;
    if (!id || !processId || !formId || !operatorId || !status || !formData) {
      return res.status(400).json({ error: 'Missing required submission fields.' });
    }

    await dbPool.query(`
      INSERT INTO submissions (
        id, process_id, form_id, form_version, operator_id, status, form_data, media_urls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      id,
      processId,
      formId,
      formVersion,
      operatorId,
      status,
      JSON.stringify(formData),
      JSON.stringify(mediaUrls || [])
    ]);

    res.json({ success: true, id });
  } catch (err) {
    console.error('Error saving submission:', err);
    res.status(500).json({ error: 'Failed to save submission record.' });
  }
});

// POST /api/submissions/:id/signoff - Add supervisor sign-off to a submission
app.post('/api/submissions/:id/signoff', async (req, res) => {
  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }
    const { id } = req.params;
    const { signedBy, notes } = req.body;
    if (!signedBy) {
      return res.status(400).json({ error: 'Missing supervisor signature name.' });
    }

    const signoffData = {
      signedBy,
      signedAt: new Date().toISOString(),
      notes: notes || ''
    };

    await dbPool.query(`
      UPDATE submissions 
      SET supervisor_signoff = $1
      WHERE id = $2
    `, [JSON.stringify(signoffData), id]);

    res.json({ success: true, signoffData });
  } catch (err) {
    console.error('Error signing off submission:', err);
    res.status(500).json({ error: 'Failed to save supervisor sign-off.' });
  }
});


// ─────────────────────────────────────────────────────────────
// AUTHENTICATION & USER MANAGEMENT ENDPOINTS
// ─────────────────────────────────────────────────────────────

// POST /api/auth/google - Authenticate using Google ID Token
app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Missing ID Token' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, sub } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google Account has no email associated' });
    }

    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }

    // Check if user exists in database
    let userRes = await dbPool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user = null;

    if (userRes.rows.length === 0) {
      // If user does not exist, insert them with default role 'operator'
      // Unless they are the developer email (tranducduy@gmail.com) who should be admin
      const roleId = (email === 'tranducduy@gmail.com') ? 'admin' : 'operator';
      const insertRes = await dbPool.query(`
        INSERT INTO users (id, email, username, full_name, role_id, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *
      `, [sub, email, email.split('@')[0], name || 'Google User', roleId]);
      user = insertRes.rows[0];
      console.log(`Created new Google user in DB: ${email} with role ${roleId}`);
    } else {
      user = userRes.rows[0];
      // If the user's ID was the seed ID, update it to their actual Google sub ID
      if (user.id === 'google_admin_seed' || user.id.startsWith('google_')) {
        await dbPool.query('UPDATE users SET id = $1 WHERE email = $2', [sub, email]);
        user.id = sub;
      }
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa.' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        title: user.title,
        role_id: user.role_id,
        status: user.status
      }
    });

  } catch (err) {
    console.error('Error verifying Google ID Token:', err);
    res.status(401).json({ error: 'Xác thực tài khoản Google thất bại.' });
  }
});

// POST /api/auth/login - Traditional username/password fallback login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials.' });
  }

  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }

    const result = await dbPool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username.trim(), password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    const user = result.rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa.' });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        title: user.title,
        role_id: user.role_id,
        status: user.status
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to process login.' });
  }
});

// GET /api/users - Get all users
app.get('/api/users', async (req, res) => {
  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }
    const result = await dbPool.query('SELECT id, email, username, full_name, title, role_id, status FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// POST /api/users - Create or update user
app.post('/api/users', async (req, res) => {
  const { id, email, username, password, full_name, title, role_id, status } = req.body;
  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }

    if (id) {
      // Update
      const result = await dbPool.query(`
        UPDATE users 
        SET email = $1, username = $2, password = COALESCE($3, password), full_name = $4, title = $5, role_id = $6, status = $7
        WHERE id = $8
        RETURNING id, email, username, full_name, title, role_id, status
      `, [email, username, password || null, full_name, title, role_id, status, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.json(result.rows[0]);
    } else {
      // Create
      const newId = 'u_' + Date.now();
      const result = await dbPool.query(`
        INSERT INTO users (id, email, username, password, full_name, title, role_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, username, full_name, title, role_id, status
      `, [newId, email, username, password || null, full_name, title, role_id, status || 'active']);
      res.json(result.rows[0]);
    }
  } catch (err) {
    console.error('Error saving user:', err);
    res.status(500).json({ error: 'Failed to save user.' });
  }
});

// DELETE /api/users/:id - Delete user
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!dbPool) {
      return res.status(503).json({ error: 'Database connection not available.' });
    }
    const result = await dbPool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ success: true, id });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});



// Serve static assets from Vite's build directory in production
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback all non-API calls to the React App's index.html (supporting SPA routing)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server after initializing database (if configured)
if (require.main === module) {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  });
} else {
  // In serverless environments, initialize database but export the app
  if (!process.env.VERCEL) {
    initDatabase();
  }
}

module.exports = app;

// Trigger database re-seed on restart for independent versioning schema.


