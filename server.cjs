require('dotenv').config();
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
`;

async function initDatabase() {
  if (!dbPool) return;
  try {
    const client = await dbPool.connect();
    console.log('Connected to CockroachDB database successfully!');
    await client.query(INITIALIZE_SCHEMA_QUERY);
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
    client.release();
  } catch (err) {
    console.error('Failed to initialize CockroachDB database:', err);
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
      res.json(result.rows);
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

