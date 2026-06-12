require('dotenv').config();
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const express = require('express');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const CSV_PATH = path.join(__dirname, 'data', 'processes.csv');

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
    online_url TEXT,
    pdf_name TEXT,
    pdf_key TEXT,
    pdf_size INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_process_form UNIQUE (process_id, form_name)
  );

  CREATE INDEX IF NOT EXISTS idx_process_forms_name ON process_forms(form_name);
  CREATE INDEX IF NOT EXISTS idx_process_forms_url ON process_forms(online_url);
`;

async function initDatabase() {
  if (!dbPool) return;
  try {
    const client = await dbPool.connect();
    console.log('Connected to CockroachDB database successfully!');
    await client.query(INITIALIZE_SCHEMA_QUERY);
    
    // Add columns dynamically for existing databases
    await client.query(`
      ALTER TABLE process_forms ADD COLUMN IF NOT EXISTS pdf_key TEXT;
      ALTER TABLE process_forms ADD COLUMN IF NOT EXISTS pdf_size INTEGER DEFAULT 0;
    `);
    
    console.log('Database schema verified/created.');

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
          if (formData && (formData.onlineUrl || formData.pdfName)) {
            await client.query(`
              INSERT INTO process_forms (process_id, form_name, online_url, pdf_name)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (process_id, form_name) DO NOTHING
            `, [row.id, formName, formData.onlineUrl || null, formData.pdfName || null]);
          }
        }
      }
      console.log('Relational forms migration completed.');
    }

    client.release();
  } catch (err) {
    console.error('Failed to initialize CockroachDB database:', err);
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
    if (formData && (formData.onlineUrl || formData.pdfName)) {
      await clientOrPool.query(`
        INSERT INTO process_forms (process_id, form_name, online_url, pdf_name, pdf_key, pdf_size, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (process_id, form_name) DO UPDATE SET
          online_url = EXCLUDED.online_url,
          pdf_name = EXCLUDED.pdf_name,
          pdf_key = EXCLUDED.pdf_key,
          pdf_size = EXCLUDED.pdf_size,
          updated_at = EXCLUDED.updated_at
      `, [
        processId,
        formName,
        formData.onlineUrl || null,
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
          onlineUrl: formRow.online_url || '',
          pdfName: formRow.pdf_name || '',
          pdfKey: formRow.pdf_key || '',
          pdfSize: formRow.pdf_size || 0
        };
      }
      
      const processes = result.rows.map(proc => ({
        ...proc,
        workflowFormsData: formsByProcess[proc.id] || {}
      }));
      
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
          const previousStatus = processes[index].status || 'Active';
          const currentStatus = processData.status || 'Draft';
          const parentId = processData.parentProcessId || processes[index].parentProcessId || processData.id;

          processes[index] = {
            ...processes[index],
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
    if (dbPool) {
      const deleteRes = await dbPool.query('DELETE FROM processes WHERE id = $1', [id]);
      if (deleteRes.rowCount === 0) {
        return res.status(404).json({ error: 'Process not found' });
      }
      res.json({ success: true });
    } else {
      // Local CSV mode
      const processes = await readProcessesFromCSV();
      const filtered = processes.filter(p => p.id !== id);
      
      if (processes.length === filtered.length) {
        return res.status(404).json({ error: 'Process not found' });
      }

      await writeProcessesToCSV(filtered);
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

// POST /api/storage/presign-upload - Generate secure R2 upload URL with quota checks
app.post('/api/storage/presign-upload', async (req, res) => {
  try {
    if (!r2Client) {
      return res.status(503).json({ error: 'Cloudflare R2 is not configured on this server.' });
    }

    const { processId, formName, fileName, fileSize, fileType } = req.body;
    if (!processId || !formName || !fileName || !fileSize) {
      return res.status(400).json({ error: 'Missing required upload parameters (processId, formName, fileName, fileSize).' });
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
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const pdfKey = `uploads/${processId}/${formName.replace(/[^a-zA-Z0-9-]/g, '_')}_${Date.now()}_${sanitizedFileName}`;

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
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
});

