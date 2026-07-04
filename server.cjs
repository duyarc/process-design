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

  CREATE TABLE IF NOT EXISTS process_forms (
    id SERIAL PRIMARY KEY,
    process_id TEXT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    form_name TEXT NOT NULL,
    pdf_name TEXT,
    pdf_key TEXT,
    pdf_size INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_process_form UNIQUE (process_id, form_name)
  );

  CREATE INDEX IF NOT EXISTS idx_process_forms_name ON process_forms(form_name);

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    process_id TEXT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
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
`;

async function initDatabase() {
  if (!dbPool) return;
  try {
    const client = await dbPool.connect();
    console.log('Connected to Supabase database successfully!');
    await client.query(INITIALIZE_SCHEMA_QUERY);
    
    // Add columns dynamically for existing databases, and drop old onlineUrl functionality
    await client.query(`
      ALTER TABLE process_forms ADD COLUMN IF NOT EXISTS pdf_key TEXT;
      ALTER TABLE process_forms ADD COLUMN IF NOT EXISTS pdf_size INTEGER DEFAULT 0;
      ALTER TABLE process_forms DROP COLUMN IF EXISTS online_url;
    `);
    
    console.log('Database schema verified/created.');

    const usersCountRes = await client.query('SELECT COUNT(*) FROM users');
    const usersCount = parseInt(usersCountRes.rows[0].count, 10);
    if (usersCount === 0) {
      console.log('Seeding default users...');
      await client.query(`
        INSERT INTO users (id, email, username, password, full_name, title, role_id, status)
        VALUES 
          ('u1', 'admin@wolver.vn', 'admin', 'admin123', 'Tran Duy Anh', 'Admin CNTT', 'admin', 'active'),
          ('u2', 'supervisor@wolver.vn', 'supervisor01', 'sup123', 'Nguyen Van Binh', 'Truong ca san xuat', 'supervisor', 'active'),
          ('u3', 'operator@wolver.vn', 'operator01', 'op123', 'Le Thi Cam', 'Cong nhan van hanh', 'operator', 'active'),
          ('google_admin_seed', 'tranducduy@gmail.com', 'tranducduy', 'dev123', 'Tran Duc Duy', 'Admin Google', 'admin', 'active')
      `);
      console.log('Seeding default users completed.');
    }

    const res = await client.query('SELECT COUNT(*) FROM processes');
    const dbCount = parseInt(res.rows[0].count, 10);
    if (dbCount === 0) {
      console.log('Database is empty. Checking for local CSV data to migrate...');
      if (fs.existsSync(CSV_PATH)) {
        const processes = await readProcessesFromCSV();
        if (processes.length > 0) {
          console.log(`Found ${processes.length} local processes in CSV. Starting migration...`);
          for (const proc of processes) {
            await client.query(`
              INSERT INTO processes (
                id, title, description, version, "lastUpdated", roles, steps, "formFields", "sopSignoffs", "workflowFormsData", "parentProcessId", status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
              proc.id,
              proc.title,
              proc.description || '',
              proc.version || '1',
              proc.lastUpdated,
              JSON.stringify(proc.roles || []),
              JSON.stringify(proc.steps || []),
              JSON.stringify(proc.formFields || []),
              JSON.stringify(proc.sopSignoffs || {}),
              JSON.stringify(proc.workflowFormsData || {}),
              proc.parentProcessId || proc.id,
              proc.status || 'Active'
            ]);
          }
          console.log('Migration completed successfully!');
        }
      }
    }

    // Auto-migration: check if there are records in processes with workflowFormsData, 
    // and populate process_forms if it is empty.
    const formCountRes = await client.query('SELECT COUNT(*) FROM process_forms');
    const formCount = parseInt(formCountRes.rows[0].count, 10);
    if (formCount === 0) {
      console.log('process_forms table is empty. Attempting migration of existing forms from JSONB fields...');
      const processesRes = await client.query('SELECT id, "workflowFormsData" FROM processes');
      for (const row of processesRes.rows) {
        const workflowFormsData = row.workflowFormsData || {};
        for (const [formName, formData] of Object.entries(workflowFormsData)) {
          if (formData && (formData.pdfName || formData.pdfKey)) {
            await client.query(`
              INSERT INTO process_forms (process_id, form_name, pdf_name, pdf_key, pdf_size)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (process_id, form_name) DO NOTHING
            `, [row.id, formName, formData.pdfName || null, formData.pdfKey || null, formData.pdfSize || 0]);
          }
        }
      }
      console.log('Relational forms migration completed.');
    }

    // Database Keep-Alive: Ping database every 1 hour to prevent sleep
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

    client.release();
  } catch (err) {
    console.error('Failed to initialize Supabase database:', err);
  }
}

// Sync process forms to the relational table
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
    if (formData && (formData.pdfName || formData.pdfKey)) {
      await clientOrPool.query(`
        INSERT INTO process_forms (process_id, form_name, pdf_name, pdf_key, pdf_size, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (process_id, form_name) DO UPDATE SET
          pdf_name = EXCLUDED.pdf_name,
          pdf_key = EXCLUDED.pdf_key,
          pdf_size = EXCLUDED.pdf_size,
          updated_at = EXCLUDED.updated_at
      `, [
        processId,
        formName,
        formData.pdfName || null,
        formData.pdfKey || null,
        formData.pdfSize || 0
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

// GET /api/processes - List all processes
app.get('/api/processes', async (req, res) => {
  try {
    if (dbPool) {
      const result = await dbPool.query('SELECT * FROM processes');
      const formsRes = await dbPool.query('SELECT * FROM process_forms');
      
      const formsByProcess = {};
      for (const formRow of formsRes.rows) {
        if (!formsByProcess[formRow.process_id]) {
          formsByProcess[formRow.process_id] = {};
        }
        formsByProcess[formRow.process_id][formRow.form_name] = {
          pdfName: formRow.pdf_name || '',
          pdfKey: formRow.pdf_key || '',
          pdfSize: formRow.pdf_size || 0
        };
      }
      
      const processes = result.rows.map(proc => {
        const dbFormsData = proc.workflowFormsData || {};
        const relFormsData = formsByProcess[proc.id] || {};
        
        // Merge the relational PDF metadata with the digital templates stored in processes table
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
      const newId = `proc_${parentId}_v${nextVer}`;

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
        }
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
      const newId = `proc_${parentId}_v${nextVer}`;

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
        }
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
    const res = await dbPool.query('SELECT COALESCE(SUM(pdf_size), 0) AS total_size FROM process_forms');
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
  initDatabase();
}

module.exports = app;


