# Form Operations — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Form Operations |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Verified At Commit** | `6c916fe` (2026-08-03) — Implemented Admin Edit Mode in FormFiller and FormManager with PUT overwrite support. |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/FormFiller.tsx`](src/components/FormFiller.tsx) | Digital form fill-out UI for operators |
| [`src/components/FormManager.tsx`](src/components/FormManager.tsx) | Per-form submission log + supervisor sign-off |
| [`src/components/SubmissionManager.tsx`](src/components/SubmissionManager.tsx) | Cross-form global submission log (embedded in Dashboard) |
| [`src/components/print/PrintRecord.tsx`](src/components/print/PrintRecord.tsx) | Completed submission print renderer (React Portal) |
| [`src/types.ts`](src/types.ts) | Shared types: `Submission`, `SubmissionFieldSnapshot` (owned by this doc) |

> **Update rule:** Whenever any of the above files is modified in a session, update
> the "Verified At Commit" field and add an entry to the [Change Log](#8-change-log) at the
> bottom of this document. Cite symbol names, never line numbers.

---

## 1. Purpose & Scope

### What This Module Does
Form Operations is the **execution and tracking layer** for operational form records. Once a form template has been published by the Form Designer module, operators use this module to:

- **Fill** and **submit** a completed form check record digitally.
- Upload **photo evidence** for any out-of-specification abnormalities (required by QMS protocol).
- Generate a **shareable URL** to distribute a form link to operators without app navigation.
- **View**, **filter**, and **audit** submitted records in a per-form or cross-form log.
- **Supervisor sign-off**: add a verified supervisor signature to a submitted record.
- **Print** a completed submission record as a formatted A4 document.

### What This Module Does NOT Do
- **Does not design form templates** — that is the Form Designer module (`FormBuilder.tsx`).
- **Does not route processes or workflow steps** — that is the Process Designer module (`ProcessEditor.tsx`).
- **Does not manage user accounts** — that is the Platform shell (`UserManagement.tsx`).
- **Does not store the form template layout** — it reads form layout from the process's `workflowFormsData` at fill time; the canonical layout lives in the `forms` DB table.

---

## 2. User-Facing Features

### FormFiller (Operator View)

| Feature | Detail |
|---|---|
| **Form header** | Shows form ID, title, version, and status badge |
| **Fill fields by block type** | Renders each `LayoutBlockISO` type: number inputs with min/max validation, radio buttons, checkboxes, text, date, time, signature, photo |
| **Inline FAIL detection** | Number fields out of `minSpec`/`maxSpec` range are highlighted; radio/checkbox fields with `isPass: false` options are flagged |
| **Corrective action log** | When a field fails, a required text input appears: "Containment/Corrective Action" — submission is blocked until filled |
| **Photo evidence upload** | Camera icon per field; required if any field is FAIL (QMS protocol) |
| **Operator ID sign-off** | Text field at the bottom — required for submission (attributability) |
| **Share link** | "Copy Form Link" button — copies a deep URL `/?page=fill&processId=...&formName=...` to clipboard |
| **Success screen** | After submit: shows submission ID, offers "Fill Another Record" or "Back to Form Manager" |
| **Unlinked form mode** | If `processId === 'unlinked'`, loads the form template directly from `GET /api/forms/:formId` and creates a virtual process object |

### FormManager (Per-Form Supervisor View)

| Feature | Detail |
|---|---|
| **Submission list** | Filtered list of all submissions for the specific `formId` linked to this process step |
| **Filter bar** | Search by operator ID or submission ID; filter by status (ALL / PASS / ABNORMALITY); filter by sign-off (ALL / PENDING / VERIFIED) |
| **Submission detail panel** | Click a record to expand: shows all field values, PASS/FAIL status per field, photo evidence previews |
| **Supervisor sign-off** | Name + notes fields; "Verify & Sign Off" button calls `POST /api/submissions/:id/signoff` |
| **Print record** | "Print" button mounts `PrintRecord` with the full submission data |
| **Fill new form** | "+ Fill New Record" button navigates to `FormFiller` via `onOpenFormFiller` callback |

### SubmissionManager (Global Dashboard View)

| Feature | Detail |
|---|---|
| **All submissions across all forms** | Fetches the entire `submissions` table; enriches with process titles |
| **Filter bar** | Search by process title, operator ID, submission ID, or form ID; filter by status and sign-off |
| **Cross-form sign-off** | Same supervisor sign-off flow as FormManager, but accessible from the global log |
| **Print record** | Same `PrintRecord` portal as FormManager |
| **Embedded mode** | `isEmbedded=true` prop renders without a Back button (used inside Dashboard tab) |
| **Photo evidence preview** | Resolves R2 object keys to pre-signed download URLs for inline display |

---

## 3. Component Map

```
Form Operations Module
│
├── FormFiller.tsx          Operator fill-out form UI — standalone page (page='fill-form')
│
├── FormManager.tsx         Per-form submission log — standalone page (page='form-manager')
│   └── PrintRecord         Print renderer — mounted as React Portal on print trigger
│
├── SubmissionManager.tsx   Global submission log — embedded inside Dashboard
│   └── PrintRecord         Print renderer — mounted as React Portal on print trigger
│
└── print/PrintRecord.tsx   A4 filled-record print renderer; fetches photo pre-signed URLs
```

### Routing in App.tsx

| Route | Component | Launched From |
|---|---|---|
| `page='fill-form'` | `FormFiller` | `Dashboard` → form row "Fill" button; deep link URL |
| `page='form-manager'` | `FormManager` | `Dashboard` → form row "Manage" button; `ProcessReader` form section |
| Dashboard `Submissions` tab | `SubmissionManager` (embedded) | Dashboard tab switch |

### Component Responsibilities

- **FormFiller** — Renders the live form template; manages `formValues`, `fieldReactions`, and `uploadedPhotos` state; validates fields against specs; builds and submits a `Submission` payload to the API.
- **FormManager** — Loads submissions filtered by a specific `formId`; allows supervisors to sign off; triggers print for a selected record.
- **SubmissionManager** — Loads all submissions across all forms/processes; enriches records with process metadata; supports cross-form filtering, sign-off, and print.
- **PrintRecord** — A pure renderer mounted via `ReactDOM.createPortal`; resolves R2 keys to pre-signed URLs for logo and photo evidence; renders a complete A4-formatted record.

---

## 4. Data Model

All types are defined in [`src/types.ts`](src/types.ts).

### `Submission` (`interface Submission`)

```typescript
interface Submission {
  id: string;                          // e.g. "sub_1749123456789_abc12"
  processId: string;                   // ID of the process version the form belongs to
  formId: string;                      // ID of the form template (e.g. "FM-QC-F01")
  formVersion: string;                 // Version of the form at fill time (e.g. "v1.2 (2026-07-01)")
  operatorId: string;                  // Free-text operator sign-off name
  submittedAt: string;                 // ISO timestamp
  status: 'PASS' | 'FAIL' | 'ABNORMALITY';
  formData: SubmissionFieldSnapshot[]; // One snapshot per field filled
  mediaUrls?: string[];                // Cloudflare R2 object keys for photo evidence
  supervisorSignoff?: {
    signedBy: string;
    signedAt: string;
    notes?: string;
  } | null;
}
```

### `SubmissionFieldSnapshot` (`interface SubmissionFieldSnapshot`)

```typescript
interface SubmissionFieldSnapshot {
  id: string;               // Field ID from the form template
  checkItem: string;        // Field label (copied from template at submit time)
  locationCode: string;     // Physical location code (e.g. "PG-02")
  targetRange: string;      // Computed target description (e.g. "15 - 18 °C")
  reactionProtocol: string; // Reaction text from the template
  value: string;            // Filled value — if FAIL, appended with " (Action: ...)"
  status: 'PASS' | 'FAIL';
}
```

### Submission Status Logic

| Status | Condition |
|---|---|
| `PASS` | All fields pass their spec checks |
| `ABNORMALITY` | At least one field fails (`isOverallPass = false`). Note: stored as `ABNORMALITY` not `FAIL`. `FAIL` is a legacy/unused value in the `Submission.status` field (it is used only in `SubmissionFieldSnapshot.status`) |

### Field Value Key Formats (for TABLE and MATRIX blocks)

TABLE and MATRIX block values are not tied to a `FormFieldISO.id`. They use composite key strings:

| Block Type | Key Format |
|---|---|
| `TABLE` | `{blockId}_{rowId}_{colId}` |
| `MATRIX_TABLE` | `{blockId}_row_{rowIndex}_col_{colIndex}` |
| `MATRIX_TABLE` notes | `{blockId}_row_{rowIndex}_note` |

These keys appear as `SubmissionFieldSnapshot.id` values inside `formData`.

---

## 5. Key Flows

### Flow A: Open FormFiller (Standard — from Dashboard or FormManager)

```
App.tsx: page='fill-form', processId='QC-PROC-001', formName='FM-QC-F01'
  └─ FormFiller mounts
       └─ fetchProcess() fires
            ├─ fetch('/api/processes')         → finds process by ID
            └─ process.workflowFormsData[formName] → resolves to FormTemplateISO
                 └─ Renders all layoutBlocks as interactive fill fields
```

### Flow B: Open FormFiller (Unlinked — via deep URL or direct formId)

```
URL: /?page=fill&processId=unlinked&formName=FM-QC-F01
  └─ App.tsx detects query params → sets page='fill-form', processId='unlinked', formName='FM-QC-F01'
       └─ FormFiller mounts
            └─ fetchProcess() detects processId === 'unlinked'
                 ├─ fetch('/api/forms/FM-QC-F01')  → loads form template directly from DB
                 └─ Creates a virtual Process object wrapping the form template
                      └─ Renders normally
```

### Flow C: Fill and Submit a Form Record

```
Operator fills in all fields in the canvas
  └─ formValues[fieldId] = value  (local state, no API calls during fill)

Operator clicks Submit
  └─ handleSubmitForm() runs
       ├─ Validates: operatorId or mandatory signature not empty
       ├─ Runs validateFormSubmission(formTemplate, formValues) in formUtils.ts (modular validation entry point)
       ├─ Evaluates filled fields against spec:
       │    ├─ number: compares value vs minSpec/maxSpec → PASS or FAIL
       │    ├─ radio/checkbox: checks isPass flag on selected option → PASS or FAIL
       │    └─ text/date/time: always PASS
       ├─ For each FAIL field: validates fieldReactions[fieldId] is not empty (blocks submit if missing)
       ├─ Builds SubmissionFieldSnapshot[] including TABLE and MATRIX_TABLE composite keys
       ├─ Validates: if any FAIL field, at least one photo must be uploaded (QMS protocol)
       ├─ Branch on Edit Mode:
       │    ├─ YES: PUT /api/submissions/:editSubmissionId  { id, processId, formId, formVersion, operatorId, status, formData, mediaUrls }
       │    └─ NO: POST /api/submissions  { id, processId, formId, formVersion, operatorId, status, formData, mediaUrls }
       └─ On success: shows success screen with submissionId; resets all form state
```

### Flow D: Upload Photo Evidence

```
Operator clicks camera icon on a field
  └─ handlePhotoUpload(fieldId, file) runs
       ├─ POST /api/storage/presign-upload  { processId, formName, fileName, fileSize, fileType }
       │    → returns { uploadUrl, pdfKey }
       ├─ PUT (presigned R2 URL)  file bytes  → direct R2 upload
       └─ uploadedPhotos[fieldId] = [..., pdfKey]  (local state only)
            Note: media keys are included in the POST /api/submissions payload as mediaUrls[]
```

### Flow E: Generate and Share a Form Link

```
User (typically supervisor/admin) clicks "Copy Form Link" in FormFiller
  └─ handleCopyShareLink() runs
       └─ Constructs URL: {origin}/?page=fill&processId={processId}&formName={formName}
            └─ Copies to clipboard via navigator.clipboard.writeText()
                 └─ Operator can open this URL directly without navigating the app
```

### Flow F: View Submissions in FormManager

```
App.tsx: page='form-manager', processId='QC-PROC-001', formName='FM-QC-F01'
  └─ FormManager mounts
       └─ fetchData() fires
            ├─ fetch('/api/processes')      → loads process to get workflowFormsData[formName]
            └─ fetch('/api/submissions')    → loads ALL submissions (filtered client-side by formId)
                 └─ Filters to formSubmissions where sub.formId === formTemplate.formId
                      └─ Applies search + status + signoff filters in the UI
```

### Flow G: Supervisor Sign-Off

```
Supervisor opens a submission record in FormManager or SubmissionManager
  └─ Enters name in "Supervisor Verification" panel (pre-filled if role is admin/supervisor)
  └─ Clicks "Verify & Sign Off"
       └─ handleSignOffSubmit(subId) runs
            ├─ Validates supervisorName not empty
            └─ POST /api/submissions/:id/signoff  { signedBy, notes }
                 └─ On success:
                      ├─ Updates local submissions[] state with returned signoffData
                      └─ Clears verificationNotes
```

### Flow H: Print a Completed Record

```
User clicks "Print" on a submission row
  └─ setPrintSubmission(submission) → component renders <PrintRecord ... />
       ├─ Mounted via ReactDOM.createPortal into document.body
       ├─ useEffect: resolves photo evidence R2 keys → GET /api/storage/download-url for each
       ├─ useEffect: resolves logo R2 key → GET /api/storage/download-url
       └─ User triggers browser print dialog (window.print())
            └─ onClose → setPrintSubmission(null) → list view re-renders
```

**Print layout contract.** The portal root carries `print-container print-doc`. Vertical rhythm comes
from the shared token scale in `print.css` — see [`DESIGN_UI_UX.md`](DESIGN_UI_UX.md) §4.2 — not from
this component. Two consequences when editing `PrintRecord.tsx`:

- A `.print-block` wrapper must not set its own outer `margin-top` / `margin-bottom`. Inline style
  beats the `.print-block + .print-block` selector and reintroduces uneven gaps. `SECTION_LABEL`
  wrappers get `.print-block--section`; inner (non-`.print-block`) wrappers are unaffected.
- The INFO_GRID renders as `.print-info-grid`, a row-major grid whose column count is read from the
  matching `INFO_GRID` block (`block.columns`) rather than hardcoded to 2, so a printed record matches
  the FormBuilder canvas and the blank form.

**Known limitation.** `PrintRecord` flattens every INFO_GRID field into one grid and takes its column
count from the *first* `INFO_GRID` block found. A form with several INFO_GRID blocks at different
column counts will render them all at the first block's count. Reconstructing per-block grids means
reworking the snapshot-to-layout mapping, which is wider than the print layer.

**Propagation.** Per [`AGENTS.md`](AGENTS.md), any print layout change here must be mirrored in
`PrintBlankForm.tsx` (Form Designer module) and vice versa.

---

## 6. Module Interface (Boundary Contracts)

### 6.1 Props Accepted by Each Component

**FormFiller** (`interface FormFillerProps` in [`src/components/FormFiller.tsx`](src/components/FormFiller.tsx))

| Prop | Type | Description |
|---|---|---|
| `processId` | `string` | ID of the process version. Pass `'unlinked'` to load the form directly by `formName` from the forms DB table |
| `formName` | `string` | The `formId` of the form template to fill (e.g. `"FM-QC-F01"`) |
| `onBack` | `() => void` | Called when user clicks Back or after a successful submission chooses to return |

**FormManager** (`interface FormManagerProps` in [`src/components/FormManager.tsx`](src/components/FormManager.tsx))

| Prop | Type | Description |
|---|---|---|
| `processId` | `string` | Used to load the process and resolve `workflowFormsData[formName]` |
| `formName` | `string` | The `formId` key to look up in `workflowFormsData` |
| `onOpenFormFiller` | `(processId, formName) => void` | Called when user clicks "+ Fill New Record"; App navigates to `FormFiller` |
| `onBack` | `() => void` | Called when user clicks Back |

**SubmissionManager** (`interface SubmissionManagerProps` in [`src/components/SubmissionManager.tsx`](src/components/SubmissionManager.tsx))

| Prop | Type | Description |
|---|---|---|
| `onBack` | `() => void` (optional) | Back button callback; omitted when embedded |
| `initialFormFilter` | `string \| null` (optional) | Pre-populates the search bar (used when launched from Dashboard with a specific form context) |
| `isEmbedded` | `boolean` (optional, default `false`) | When `true`, hides the Back button — used when rendered inside Dashboard's Submissions tab |

**PrintRecord** (`interface PrintRecordProps` in [`src/components/print/PrintRecord.tsx`](src/components/print/PrintRecord.tsx))

| Prop | Type | Description |
|---|---|---|
| `submission` | `Submission` | The completed submission record to render |
| `processTitle` | `string` | Display title for the process (shown in the print header) |
| `logoText` | `string` (optional) | R2 object key (`"uploads/..."`) or inline URL for the form logo |
| `descriptionText` | `string` (optional) | Description text from the form's TITLE block |
| `columnLabels` | `object` (optional) | Custom column header labels from the form's CHECKLIST_TABLE block |
| `onClose` | `() => void` | Called to dismount the print view |

### 6.2 API Endpoints Consumed

| Method | Endpoint | Used By | Purpose |
|---|---|---|---|
| `GET` | `/api/processes` | FormFiller, FormManager, SubmissionManager | Load process record to resolve form template |
| `GET` | `/api/forms/*formId` | FormFiller | Load form template in unlinked mode (`processId === 'unlinked'`). Wildcard route — form IDs contain `/` (e.g. `3S-QC/F1.1`) |
| `GET` | `/api/submissions` | FormManager, SubmissionManager | Load all submission records (filtered client-side) |
| `POST` | `/api/submissions` | FormFiller | Save a completed form submission |
| `POST` | `/api/submissions/:id/signoff` | FormManager, SubmissionManager | Add supervisor sign-off to a submission |
| `POST` | `/api/storage/presign-upload` | FormFiller | Get a pre-signed R2 URL for photo evidence upload |
| `PUT` | `(presigned R2 URL)` | FormFiller | Direct upload of photo evidence to Cloudflare R2 |
| `GET` | `/api/storage/download-url?key=...` | PrintRecord, SubmissionManager | Resolve R2 keys to pre-signed download URLs for photo evidence and logo display |

> Full endpoint reference, including request/response shapes and DB schema, lives in [DESIGN_BACKEND.md](DESIGN_BACKEND.md).

### 6.3 URL Deep-Link Schema

FormFiller supports direct URL access for operator distribution:

```
{origin}/?page=fill&processId={processId}&formName={formId}
```

`App.tsx` reads `window.location.search` on mount and routes to `page='fill-form'` if these params are present. This is the only deep-linking mechanism in the entire application.

### 6.4 Modular Form Validation (`validateFormSubmission`)

Form submission validation logic is modularized in `src/utils/formUtils.ts` under the exported function `validateFormSubmission()`.
- **Arbitrary rule removal:** The legacy hardcoded mandatory fill check (`Please fill out all check items`) was removed to prevent blocking form submissions when operators leave optional or non-applicable fields blank. Unfilled fields record empty strings without throwing corrective action errors.
- **Single Source of Truth for Validation:** `validateFormSubmission` accepts `(formTemplate, formValues)` and returns `{ isValid: boolean, errors: string[] }`. Future domain validation rules (e.g., field-level required flags, step-based criteria, or custom specification boundaries) must be added inside `validateFormSubmission()` rather than scattering ad-hoc alerts inside `FormFiller.tsx`.

---

## 7. Known Design Constraints & Technical Debt

| Issue | Impact | Notes |
|---|---|---|
| **`GET /api/submissions` loads ALL records** | Poor scalability as submission volume grows | Both `FormManager` and `SubmissionManager` fetch the entire submissions table and filter client-side. No pagination or server-side filter by `formId`. |
| **`GET /api/processes` loaded to resolve template** | Extra network round-trip | FormFiller and FormManager load the full process list just to find `workflowFormsData[formName]`. The form template should be fetched directly from `GET /api/forms/:formId` instead |
| **`status: 'FAIL'` is a dead value on `Submission`** | Confusion between `Submission.status` and `SubmissionFieldSnapshot.status` | `Submission.status` is stored as `ABNORMALITY` when any field fails; `FAIL` is used only on individual field snapshots. The type definition includes `FAIL` on both but it is never written to `Submission.status` |
| **`window.alert()` used extensively** | Blocking dialogs disrupt UX | Error handling, success confirmations, and photo upload feedback all use native browser `alert()` |
| **Photo evidence keys not tracked by submission ID** | Storage management is difficult | Photos are uploaded to R2 using the `processId` and `formName` as path prefix — not scoped to the submission ID. Orphaned photos cannot easily be detected or cleaned up |
| **Operator ID is free-text, not authenticated** | Attributability is not verified | The `operatorId` field accepts any string. There is no tie to the authenticated `currentUser` — an operator can enter any name |
| **Supervisor name pre-fill is role-based but unverified** | Supervisor sign-off can be made by anyone who types a name | `supervisorName` is pre-filled from `currentUser.full_name` if role is `admin` or `supervisor`, but the field is editable and there is no server-side permission check on the signoff endpoint |
| **Form template resolved from `workflowFormsData`** | Stale template risk | FormFiller and FormManager read the form layout from `process.workflowFormsData[formName]`, which may be an older snapshot if the form was updated after the process version was saved. The live template from `GET /api/forms/:formId` is only used in `unlinked` mode |

---

## 8. Change Log

Architectural changes only — data model, contracts, invariants, new block types.
UI/styling history lives in `git log`. Capped at ~15 entries; older rows are dropped.

| Date | Commit | Change |
|---|---|---|
| 2026-07-09 | `8df2f3c` | Document created. Initial full write based on codebase review. |
| 2026-07-14 | `cce673b` | Multi-option checkbox table columns: values stored as comma-separated strings in the field snapshot. Affects FormFiller and PrintRecord. |
| 2026-07-14 | `7a0890c` | Column-scoped table footer summary rows (Auto Sum, Manual, Percentage, Sum Rows). |
| 2026-07-24 | `395767b` | SIGN block gains an interactive 3-state Click-to-Sign UI in FormFiller; SIGN values are now collected into the submission snapshot dynamically. |
| 2026-07-24 | `4a81811` | **Subtable support across the operations path.** Dynamic row input in FormFiller/ProcessReader with add/delete row; values serialized as JSON in the snapshot. PrintRecord renders the subtable grid with column headers resolved from the form layout. `static_text` column type renders `subtableStaticData` row labels. |
| 2026-07-24 | `536e08a` | `static_text` label alignment strictly follows the configured `col.align`. |
| 2026-07-24 | `f9b190e` | Subtable rows support editable custom static-text labels. |
| 2026-07-24 | `446b552` | Removed `print-block-avoid` on `INFO_GRID` (was producing a blank page 1); Subtable titles bound to their tables during page splits via `breakAfter: 'avoid'`. |
| 2026-07-27 | `001af74` | Table headers across FormFiller use the Executive Slate Header Bar treatment to separate headers from fillable input cells. |
| 2026-07-27 | `cbace2b` | Added "In form trắng" (Print Blank Form) button in FormFiller header toolbar, triggering PrintBlankForm overlay for instant A4 paper template printing. |
| 2026-07-28 | `62b1a98` | **Print whitespace normalization propagated to `PrintRecord`.** INFO_GRID renders row-major via `.print-info-grid` and reads its column count from the layout's `INFO_GRID` block instead of hardcoding 2. Subtables span the grid through `.print-field-full`. All per-block inline margins removed so `.print-block + .print-block` in `print.css` is the sole owner of inter-block spacing; the portal root carries `.print-doc`. Also fixed a latent type error: static-text subtable cells read `subtableStaticData` from the form-layout field, not from `SubmissionFieldSnapshot`, which never carried it. See Flow H and [DESIGN_UI_UX.md](DESIGN_UI_UX.md) §4.2. |
| 2026-07-29 | `f952e66` | **A5 Landscape Print Support in Record Printout:** Updated `PrintRecord.tsx` to read `pageSize` from process forms data / form template API and dynamically output `@page { size: A5 landscape; margin: 8mm 10mm 8mm 10mm; }` for short form submissions. |
| 2026-07-29 | `9a6bb9aa` | **Fix Print Footer Overlap on A4 Paper:** Fixed `.print-footer` colliding with bottom table rows on A4 by setting negative bottom offset (`bottom: -10mm` for A4, `-5mm` for A5) to position footer into `@page` bottom margin zone, and adding `padding-bottom: 20px !important` to `.print-doc`. |
| 2026-07-29 | `9a6bb9aa` | **Refactor Table Total Row Best Practices:** (1) Removed hardcoded `VND` suffix in `FormFiller` and `PrintRecord`. (2) Merged all preceding non-numeric columns (`colSpan = firstSumColIdx`) placing right-aligned `"Cộng:"` label directly adjacent to the first sum column. (3) Grouped all sum values on a single horizontal `<tr>` row and preserved vertical grid borders. |
| 2026-08-03 | `CURRENT` | **Modular Form Validation & Arbitrary Rule Removal:** Removed hardcoded `missingFields` check from `FormFiller`; created modular `validateFormSubmission` in `formUtils.ts` as entry point for future custom validation rules. |
| 2026-08-03 | `CURRENT` | **Admin Edit & Overwrite Mode:** Added Edit button for admin in FormManager and wired to FormFiller with PUT route support. |
