# Backend & Persistence — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Backend & Persistence |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Verified At Commit** | `28c684b` (2026-08-03) — Updated GET /api/submissions to map DB snake_case columns to camelCase Submission properties. |

### Quick File Index

| File | Role |
|---|---|
| [`server.cjs`](server.cjs) | The entire backend — Express app, schema init, all 30 endpoints, R2 storage helpers, auth |
| [`api/index.js`](api/index.js) | Vercel serverless entry point; re-exports the Express app from `server.cjs` |
| [`vite.config.ts`](vite.config.ts) | Dev proxy: `/api` → `http://localhost:3001` |

> **Update rule:** Whenever `server.cjs` is modified, update the "Verified At Commit" field
> and add an entry to the [Change Log](#8-change-log) at the bottom of this document.

---

## 1. Purpose & Scope

### What This Module Does
`server.cjs` is a single-file Express application that serves as the **only** backend for
the platform. It provides:

- **Schema management**: creates all five tables on boot via `INITIALIZE_SCHEMA_QUERY`, plus idempotent `ALTER TABLE` migrations in `initDatabase()`.
- **REST API**: 30 endpoints covering processes, forms, submissions, users, auth, and storage.
- **Authentication**: credential and Google OAuth login, issuing JWTs.
- **Object storage**: presigned Cloudflare R2 upload/download URLs, quota enforcement, orphaned-logo cleanup.
- **Static hosting**: serves the built `dist/` bundle with SPA fallback routing.

### What This Module Does NOT Do
- **No authorization enforcement** — see the invariant in Section 5. RBAC is UI-only.
- **No pagination or server-side filtering** — list endpoints return whole tables.
- **No file proxying for uploads** — clients `PUT` directly to R2 using presigned URLs.

---

## 2. Runtime Topology

```
Browser
  │
  ├─ dev:  Vite (5173) ──proxy /api──> Express (3001)
  └─ prod: Vercel ──> api/index.js ──> module.exports = app  (server.cjs)
                                          │
                                          ├─ Postgres (Supabase) via `pg` Pool
                                          └─ Cloudflare R2 via @aws-sdk/client-s3
```

`PORT` defaults to `3001`. When `require.main === module`, the server calls
`initDatabase()` then `listen()`. Under Vercel it exports the app instead and skips
`initDatabase()` (guarded by `process.env.VERCEL`).

### Environment Variables

| Variable | Purpose | Fallback behaviour if absent |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `dbPool` stays `null`; **offline CSV mode** activates |
| `JWT_SECRET` | JWT signing key | Falls back to a **hardcoded literal** in source — see Technical Debt |
| `GOOGLE_CLIENT_ID` | Google OAuth audience for ID token verification | Google login fails |
| R2 credentials | Bucket access | `r2Client` stays `null`; upload endpoints disabled |
| `RESET_DB` | Triggers `seedFreshData()` on boot | No reseed |
| `VERCEL` | Detected to skip `initDatabase()` | Assumes local |

### Offline CSV Mode
Every persistence path is dual-implemented: `if (dbPool) { …SQL… } else { …CSV/JSON… }`.
The offline path uses `readProcessesFromCSV()` / `writeProcessesToCSV()` against
`data/processes.csv`, and `readFormsOffline()` / `writeFormsOffline()` for forms. This
doubles the surface area of every write endpoint and is a frequent source of drift
between the two branches.

---

## 3. Database Schema

Defined in `INITIALIZE_SCHEMA_QUERY`. Column names in `processes` are quoted camelCase;
all other tables use snake_case.

### `processes`
`id` (PK, TEXT) · `title` · `description` · `version` · `"lastUpdated"` ·
`roles` JSONB · `steps` JSONB · `"formFields"` JSONB · `"sopSignoffs"` JSONB ·
`"workflowFormsData"` JSONB · `"parentProcessId"` · `status`

Version families are modelled by `parentProcessId` pointing at the root process id.

### `forms`
**Composite primary key `(form_id, version)`** — one row per form *version*, not per form.

`form_id` · `form_name` · `status` (default `DRAFT`) · `version` (default `v0.1`) ·
`effective_date` DATE · `form_title` · `layout_blocks` JSONB · `revision_history` JSONB ·
`pdf_name` · `pdf_key` · `pdf_size` · `created_at` · `updated_at`

### `process_forms`
Junction table linking a process to the form versions it uses.

`id` SERIAL PK · `process_id` → `processes(id)` ON DELETE CASCADE · `form_name` ·
`form_id` · `form_version` (default `v0.1`) · timestamps ·
`UNIQUE (process_id, form_name)`

Indexed on `form_name` and `form_id`. Maintained exclusively by `syncProcessForms()`,
which deletes rows whose `form_name` is absent from the incoming `workflowFormsData`
and upserts the rest.

### `submissions`
`id` (PK, TEXT) · `process_id` → `processes(id)` ON DELETE CASCADE · `form_id` ·
`form_version` · `operator_id` · `submitted_at` · `status` · `form_data` JSONB ·
`media_urls` JSONB · `supervisor_signoff` JSONB

Indexed on `process_id` and `form_id` — though no endpoint currently filters by them.

### `users`
`id` (PK, TEXT) · `email` UNIQUE NOT NULL · `username` UNIQUE · `password` ·
`full_name` NOT NULL · `title` · `role_id` (default `operator`) · `status` (default
`active`) · `created_at`

### Row Level Security
All five tables run `ENABLE ROW LEVEL SECURITY`, but **no `CREATE POLICY` statement
exists anywhere in the codebase**. The server connects with a privileged Supabase
credential that bypasses RLS, so this currently provides no protection — it only means
any future least-privilege client would be denied everything by default.

---

## 4. Storage Architecture (Cloudflare R2)

### Key Naming

| Kind | Key format |
|---|---|
| Logo | `uploads/logo_{sanitizedLogoName}.{ext}` |
| PDF / evidence | `uploads/{processId}/{sanitizedFormName}_{Date.now()}_{sanitizedFileName}` |

Logo keys are deterministic from the logo name, so re-uploading the same name overwrites.

### Limits
- Per-file cap: **50 MB** (`MAX_FILE_SIZE`).
- Total quota: **2 GB** (`STORAGE_QUOTA_LIMIT`, described in source as 1/5 of R2's free tier). Checked in `presign-upload` via `getTotalStorageUsage()`, which lists the bucket and sums sizes.
- Presigned upload URLs expire after **300 seconds**.

### ⚠️ Invariant: `forms.layout_blocks` is the authority for logo usage

Logo R2 keys live in **`forms.layout_blocks`**. They are *not* reliably present in
`processes."workflowFormsData"`, because process records store only
`{ formId, formTitle, version, status }` per form — never `layoutBlocks`.

`isLogoKeyUsed()` must therefore query the `forms` table:

```sql
SELECT COUNT(*) FROM forms WHERE layout_blocks::text LIKE '%' || $1 || '%'
```

**Why this matters:** an earlier implementation scanned `workflowFormsData` (via
`getLogoKeysFromForms()`), so it always returned `false`. Since
`deleteLogoFromR2IfUnused()` deletes any key it believes is unused, **every logo was
deleted from R2 on the next process save**. Fixed in `5bea009`.

Two consequences for anyone touching this area:
1. `getLogoKeysFromForms()` still exists and still reads `workflowFormsData`. It is the buggy shape. Do not reintroduce it as the basis for a usage check.
2. `handleLogoUpload()` in [FormBuilder.tsx](src/components/FormBuilder.tsx) persists the key to `forms.layout_blocks` immediately after upload via `saveFormToBackend({ layoutBlocksOverride })`, bypassing React state batching, so the row exists before any cleanup can run. Preserve that ordering.

---

## 5. Authentication & Authorization

### Token Issuance
Three endpoints sign JWTs with payload `{ id, email, role_id }` and `expiresIn: '7d'`:
`/api/auth/login`, `/api/auth/google`, `/api/auth/register`.

### Email-First Login Flow
`POST /api/auth/check-email` reports whether an email exists, letting the UI decide
between a password prompt and self-service registration. `POST /api/auth/login` accepts
either identifier: `WHERE (LOWER(email) = $1 OR LOWER(username) = $1)`. Inactive
accounts are rejected with 403.

### ⚠️ Invariant: no endpoint verifies a JWT

`jwt.sign` appears three times; **`jwt.verify` appears zero times**. There is no auth
middleware. Every endpoint — including `GET /api/users`, `POST /api/users`, and
`DELETE /api/users/:id` — is reachable unauthenticated by anyone who can reach the
server. All role gating lives in the React UI (`AuthContext`), which an attacker does
not have to use.

Passwords are also stored and compared as **plaintext** (`AND password = $2`); no
hashing library is imported.

Treat both as known, documented gaps rather than bugs to be surprised by. Any change
that appears to rely on server-side identity or permissions does not currently work —
the middleware would have to be written first.

---

## 6. API Surface

30 endpoints. Auth column omitted deliberately: **none are authenticated** (Section 5).

### Auth
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/check-email` | Report whether an email is registered (drives email-first UI) |
| `POST` | `/api/auth/login` | Credential login; accepts email *or* username |
| `POST` | `/api/auth/register` | Self-service registration |
| `POST` | `/api/auth/google` | Verify a Google ID token and issue a JWT |

### Users
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/users` | List all users |
| `POST` | `/api/users` | **Upsert** — updates when `id` is present in the body, inserts otherwise. There is no `PUT` route |
| `DELETE` | `/api/users/:id` | Delete a user |

### Processes
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/processes` | List all processes (no filtering) |
| `POST` | `/api/processes` | Upsert a process; calls `syncProcessForms()` |
| `DELETE` | `/api/processes/:id` | Delete a process version |
| `POST` | `/api/processes/:id/new-version` | Clone a version into a new Draft |
| `GET` | `/api/processes/check-id` | Validate process-ID uniqueness before save |

### Forms
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/forms` | List all form records |
| `GET` | `/api/forms/*formId` | Fetch one form; optional `?version=` selects a specific version row |
| `GET` | `/api/forms/*formId/history` | Merged revision timeline across versions |
| `POST` | `/api/forms` | Upsert a form version row |
| `DELETE` | `/api/forms/*formId` | Delete a version (`?version=`) |
| `POST` | `/api/forms/:formId/activate` | Set a specific `(form_id, version)` row to `ACTIVE` |
| `POST` | `/api/forms/:formId/archive` | Set a version to `ARCHIVED` |

> Note the route shape: read/delete use the wildcard `*formId` because form ids contain
> slashes (e.g. `3S-QC/F1.1`); the lifecycle routes use plain `:formId`.

### Submissions
| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/submissions` | Return **all** submissions; clients filter locally |
| `POST` | `/api/submissions` | Save a completed submission |
| `POST` | `/api/submissions/:id/signoff` | Attach supervisor sign-off (no permission check) |

### Storage
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/storage/presign-upload` | Issue a presigned `PUT` URL; enforces 50 MB and 2 GB limits |
| `POST` | `/api/storage/confirm-upload` | Record the R2 key and metadata in the DB |
| `GET` | `/api/storage/download-url` | Presigned download URL for a key |
| `GET` | `/api/storage/download-inline` | Proxy an object inline as a base64 data URL (used to avoid cross-origin issues when printing logos) |
| `DELETE` | `/api/storage/delete-file` | Delete a PDF attachment from R2 and the DB |
| `GET` | `/api/storage/logos` | List logo objects with usage metadata |
| `DELETE` | `/api/storage/logos` | Delete an unused logo |
| `GET` | `/api/storage/quota-status` | Current usage, limit, and percentage |

---

## 7. Known Design Constraints & Technical Debt

| Issue | Impact | Notes |
|---|---|---|
| **No JWT verification middleware** | Every endpoint is open, including user CRUD | `jwt.verify` is never called. RBAC exists only in the React UI |
| **Plaintext passwords** | Full credential compromise if the DB leaks | `WHERE … AND password = $2`; no bcrypt/argon2 import |
| **`JWT_SECRET` has a hardcoded fallback** | Tokens are forgeable in any deployment missing the env var | Literal string is committed in [server.cjs](server.cjs) |
| **RLS enabled with zero policies** | Provides no protection today | Server bypasses it with a privileged credential |
| **Single 2,283-line file** | Hard to navigate; no route/handler separation | Schema, helpers, and all 30 handlers are co-located |
| **Every endpoint dual-implemented (DB + CSV)** | Doubles edit surface; branches drift | The `if (dbPool) … else …` pattern appears in every write path |
| **List endpoints return whole tables** | Scales poorly | `/api/submissions` and `/api/processes` have no pagination or filter, despite indexes existing |
| **`getLogoKeysFromForms()` reads the wrong source** | Landmine | Retained in source but reads `workflowFormsData`, which never contains `layoutBlocks`. See Section 4 |
| **Logo keys derived from logo name** | Silent overwrite | Two forms using the same logo name share one R2 object |
| **Evidence keys not scoped to submission id** | Orphan detection is hard | Keyed by `processId`/`formName` only |
| **Schema migrations are inline `ALTER TABLE`** | No migration history or rollback | `initDatabase()` runs idempotent DDL on every boot |

---

## 8. Change Log

Architectural changes only — schema, endpoints, invariants. UI polish lives in
`git log`; run `git show <sha>` for the full diff of any entry below.

| Date | Commit | Change |
|---|---|---|
| 2026-07-27 | `001af74` | Document created. Initial write based on `server.cjs` review. Backfilled entries below from git history. |
| 2026-07-10 | `294e5bb` | **Schema change:** added `forms.effective_date`; standardized form version strings across server and client. |
| 2026-07-13 | `143bec7` | Added `/api/storage/download-inline` to proxy logos as base64 data URLs, fixing cross-origin print rendering. |
| 2026-07-20 | `5bea009` | **Critical fix + invariant:** `isLogoKeyUsed()` rewritten to query `forms.layout_blocks` instead of `processes.workflowFormsData`. The old version always returned `false`, deleting every logo from R2 on the next process save. See Section 4. |
| 2026-07-09 | `c9a5696` | Fixed Supabase connection leaks and Vercel serverless cold-start timeouts. |
| 2026-07-09 | `11902a5` | **Schema change:** dropped the `online_url` column from `process_forms` along with the online form link feature. |
| 2026-07-27 | `9a555cb` | **New endpoints:** `POST /api/auth/check-email` and `POST /api/auth/register` for email-first progressive disclosure login; `/api/auth/login` now matches either email or username. |
