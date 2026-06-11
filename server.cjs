const express = require('express');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3001;
const CSV_PATH = path.join(__dirname, 'data', 'processes.csv');

app.use(express.json());

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
    const processes = await readProcessesFromCSV();
    res.json(processes);
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

    const processes = await readProcessesFromCSV();
    const now = new Date().toISOString();

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
          // Setting a draft or pending to Active!
          // Supersede all other active versions of this process family
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save process' });
  }
});

// POST /api/processes/:id/new-version - Create a new draft version from an existing process version
app.post('/api/processes/:id/new-version', async (req, res) => {
  try {
    const id = req.params.id;
    const processes = await readProcessesFromCSV();
    const source = processes.find(p => p.id === id);
    if (!source) {
      return res.status(404).json({ error: 'Source process not found' });
    }

    // Find the max version number for this parentProcessId
    const parentId = source.parentProcessId || source.id;
    const siblingVersions = processes.filter(p => p.parentProcessId === parentId || p.id === parentId);
    
    // If a draft already exists for this process family, return it instead of creating a new one
    const existingDraft = siblingVersions.find(p => p.status === 'Draft');
    if (existingDraft) {
      return res.json(existingDraft);
    }
    
    // Parse versions as integers to find max, progressive numbering
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
      // Clear signatures/dates for the new draft, keeping structure
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create new version draft' });
  }
});

// DELETE /api/processes/:id - Delete a process
app.delete('/api/processes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const processes = await readProcessesFromCSV();
    const filtered = processes.filter(p => p.id !== id);
    
    if (processes.length === filtered.length) {
      return res.status(404).json({ error: 'Process not found' });
    }

    await writeProcessesToCSV(filtered);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete process' });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
