# Cloudflare R2 Secure File Storage Setup Guide

A complete blueprint to integrate secure PDF/file uploads & downloads using **Cloudflare R2** and **AWS SDK v3 (S3 Client)** with client-side presigned URLs and database-tracked storage quotas.

---

## 1. Cloudflare R2 Setup & Credentials

### Step A: Create Bucket
1. Log in to the Cloudflare Dashboard, select **R2** from the sidebar, and click **Create Bucket**.
2. Name the bucket (e.g., `my-app-storage`).

### Step B: Configure CORS (Crucial for Direct Frontend Uploads)
1. Go to the bucket's **Settings** tab.
2. Under **CORS Policy**, click **Add CORS Policy** and paste:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://my-app.onrender.com",
         "http://localhost:3000",
         "http://localhost:5173"
       ],
       "AllowedMethods": ["PUT", "GET", "HEAD", "POST", "DELETE"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

### Step C: Generate API Credentials
1. Back on the R2 homepage, click **Manage R2 API Tokens** on the right.
2. Click **Create API Token**.
3. Select **Edit** permissions (Read & Write) and scope it to your specific bucket or all buckets.
4. Click **Create Token**.
5. Copy the following keys immediately (they won't be shown again):
   * **Access Key ID**
   * **Secret Access Key**
   * **Jurisdiction-specific Endpoint** (looks like `https://<account_id>.r2.cloudflarestorage.com`)

---

## 2. Environment Variables (`.env`)

Add these to your local `.env` and host provider config:

```bash
R2_ACCESS_KEY_ID="your_access_key_id"
R2_SECRET_ACCESS_KEY="your_secret_access_key"
R2_ENDPOINT="https://your_account_id.r2.cloudflarestorage.com"
R2_BUCKET_NAME="my-app-storage"

# Storage Quotas (e.g. Free Tier is 10 GB. 1/5 threshold = 2 GB)
# 2 GB = 2 * 1024 * 1024 * 1024 = 2147483648 bytes
# Max single file size = 50 MB = 52428800 bytes
STORAGE_QUOTA_LIMIT=2147483648
MAX_FILE_SIZE_LIMIT=52428800
```

---

## 3. Backend Implementation (Node.js/Express)

### Step A: Install Dependencies
```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner express pg dotenv
```

### Step B: Database Schema (Supabase / PostgreSQL)
Track file metadata in the relational database to calculate quota usage instantly:
```sql
CREATE TABLE IF NOT EXISTS process_forms (
  id SERIAL PRIMARY KEY,
  process_id TEXT NOT NULL,
  form_name TEXT NOT NULL,
  pdf_name TEXT,
  pdf_key TEXT,
  pdf_size INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_process_form UNIQUE (process_id, form_name)
);
```

### Step C: Express Server Code (`server.js`)
Ensure `requestChecksumCalculation` and `responseChecksumValidation` are set to `'WHEN_REQUIRED'` so Cloudflare R2 doesn't reject PUT requests with signature/checksum errors.

```javascript
require('dotenv').config();
const express = require('express');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const dbPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// 1. Initialize S3 Client with Cloudflare R2 Checksum Bypass
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED', // Crucial for R2 uploads
  responseChecksumValidation: 'WHEN_REQUIRED'
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const STORAGE_QUOTA_LIMIT = parseInt(process.env.STORAGE_QUOTA_LIMIT) || 2 * 1024 * 1024 * 1024;
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_LIMIT) || 50 * 1024 * 1024;

// Quota Helper
async function getStorageUsage() {
  const res = await dbPool.query('SELECT COALESCE(SUM(pdf_size), 0) AS total_size FROM process_forms');
  return parseInt(res.rows[0].total_size, 10) || 0;
}

// 2. GET Quota Status
app.get('/api/storage/quota-status', async (req, res) => {
  try {
    const totalSize = await getStorageUsage();
    res.json({
      totalSize,
      quotaLimit: STORAGE_QUOTA_LIMIT,
      percentage: ((totalSize / STORAGE_QUOTA_LIMIT) * 100).toFixed(2),
      isConfigured: !!process.env.R2_ACCESS_KEY_ID
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. POST Generate Presigned Upload URL
app.post('/api/storage/presign-upload', async (req, res) => {
  try {
    const { processId, formName, fileName, fileSize, fileType } = req.body;
    if (!processId || !formName || !fileName || !fileSize) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    // Enforce individual limit
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB.` });
    }

    // Enforce total quota
    const totalUsage = await getStorageUsage();
    if (totalUsage + fileSize > STORAGE_QUOTA_LIMIT) {
      return res.status(400).json({ error: 'Storage quota limit exceeded. Please delete unused attachments.' });
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const pdfKey = `uploads/${processId}/${formName.replace(/[^a-zA-Z0-9-]/g, '_')}_${Date.now()}_${sanitizedName}`;

    // Create Presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: pdfKey,
      ContentType: fileType || 'application/pdf'
    });
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 300 }); // Valid for 5 mins

    res.json({ uploadUrl, pdfKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST Confirm Upload
app.post('/api/storage/confirm-upload', async (req, res) => {
  try {
    const { processId, formName, pdfName, pdfKey, pdfSize } = req.body;
    await dbPool.query(`
      INSERT INTO process_forms (process_id, form_name, pdf_name, pdf_key, pdf_size, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (process_id, form_name) DO UPDATE SET
        pdf_name = EXCLUDED.pdf_name,
        pdf_key = EXCLUDED.pdf_key,
        pdf_size = EXCLUDED.pdf_size,
        updated_at = EXCLUDED.updated_at
    `, [processId, formName, pdfName, pdfKey, pdfSize]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE Remove File
app.delete('/api/storage/delete-file', async (req, res) => {
  try {
    const { processId, formName, pdfKey } = req.body;
    if (pdfKey) {
      await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: pdfKey }));
    }
    await dbPool.query(`
      UPDATE process_forms 
      SET pdf_name = NULL, pdf_key = NULL, pdf_size = 0, updated_at = NOW()
      WHERE process_id = $1 AND form_name = $2
    `, [processId, formName]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. GET Download URL
app.get('/api/storage/download-url', async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: 'Missing key parameter.' });

    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const downloadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 }); // Valid for 15 mins
    res.json({ downloadUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## 4. Frontend Integration (React)

### Direct Upload Handler
```javascript
const handlePdfUpload = async (formName, file) => {
  try {
    // 1. Ask backend for permission and presigned PUT URL
    const presignRes = await fetch('/api/storage/presign-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processId: "my_process_id",
        formName,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })
    });
    
    if (!presignRes.ok) {
      const err = await presignRes.json();
      throw new Error(err.error || 'Upload authorization denied.');
    }
    
    const { uploadUrl, pdfKey } = await presignRes.json();

    // 2. Direct PUT upload streaming binary to Cloudflare R2
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/pdf' },
      body: file
    });

    if (!uploadRes.ok) throw new Error('Binary upload failed to R2 bucket.');

    // 3. Confirm upload metadata with database
    const confirmRes = await fetch('/api/storage/confirm-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        processId: "my_process_id",
        formName,
        pdfName: file.name,
        pdfKey,
        pdfSize: file.size
      })
    });

    if (!confirmRes.ok) throw new Error('Database metadata sync failed.');

    alert('Upload complete!');
  } catch (err) {
    alert(err.message);
  }
};
```

### Download Handler
```javascript
const handleDownloadPdf = async (pdfKey) => {
  try {
    const res = await fetch(`/api/storage/download-url?key=${encodeURIComponent(pdfKey)}`);
    if (!res.ok) throw new Error('Failed to resolve secure download link.');
    const { downloadUrl } = await res.json();
    window.open(downloadUrl, '_blank');
  } catch (err) {
    alert(err.message);
  }
};
```
