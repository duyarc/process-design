# Form Operations — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Form Operations |
| **Status** | Active Development |
| **Verified At Commit** | (2026-09-30) — Performance: SWR cache for submissions, light list endpoint (no form_data), cachedProcesses prop, O(1) processLookupMap |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/FormFiller.tsx`](src/components/FormFiller.tsx) | Digital form fill-out UI for operators |
| [`src/components/SubmissionViewer.tsx`](src/components/SubmissionViewer.tsx) | **NEW** — Public submission review & amendment container |
| [`src/components/FormManager.tsx`](src/components/FormManager.tsx) | Per-form submission log + supervisor sign-off |
| [`src/components/SubmissionManager.tsx`](src/components/SubmissionManager.tsx) | Cross-form global submission log (embedded in Dashboard) |
| [`src/components/print/PrintFilledForm.tsx`](src/components/print/PrintFilledForm.tsx) | **NEW** — Filled submission print renderer; layout mirrors blank form exactly; self-contained |
| [`src/components/common/ConfirmModal.tsx`](src/components/common/ConfirmModal.tsx) | **NEW** — Reusable confirmation dialog for critical actions across the project |
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
| **Print record** | "Print" button mounts `PrintFilledForm` with the full submission data and template |
| **Fill new form** | "+ Fill New Record" button navigates to `FormFiller` via `onOpenFormFiller` callback |

### SubmissionManager (Global Dashboard View)

| Feature | Detail |
|---|---|
| **All submissions across all forms** | Fetches the entire `submissions` table; enriches with process titles |
| **Filter bar** | Search by process title, operator ID, submission ID, or form ID; filter by status and sign-off |
| **Cross-form sign-off** | Same supervisor sign-off flow as FormManager, but accessible from the global log |
| **Print record** | Same `PrintFilledForm` portal as FormManager |
| **Embedded mode** | `isEmbedded=true` prop renders without a Back button (used inside Dashboard tab) |
| **Photo evidence preview** | Resolves R2 object keys to pre-signed download URLs for inline display |

---

## 3. Component Map

```
Form Operations Module
│
├── FormFiller.tsx              Operator fill-out form UI — standalone page (page='fill-form')
│
├── FormManager.tsx             Per-form submission log — standalone page (page='form-manager')
│   └── PrintFilledForm         Print renderer — mounted as React Portal on print trigger
│
├── SubmissionManager.tsx       Global submission log — embedded inside Dashboard
│   └── PrintFilledForm         Print renderer — mounted as React Portal on print trigger
│
└── print/PrintFilledForm.tsx   A4 filled-record print renderer; mirrors blank form layout
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
- **PrintFilledForm** — A pure renderer mounted via `ReactDOM.createPortal`; mirrors the exact layout of the blank form with filled values, handles dynamic table rows and photo evidence; renders a complete A4-formatted record.

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
  status: 'SUBMITTED' | 'PASS' | 'FAIL' | 'ABNORMALITY'; // 'SUBMITTED' is canonical; others retained for historical compatibility
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

### Submission Status & Verification Lifecycle

* **Pruned Legacy QMS Status:** The legacy binary evaluation (`isOverallPass ? 'PASS' : 'ABNORMALITY'`) was pruned on 2026-09-30. Forms are now submitted with canonical status `'SUBMITTED'`.
* **Single Lifecycle Source of Truth (`Verification`):** Management portals (`SubmissionManager`, `FormManager`) track submission lifecycle purely through `supervisorSignoff`:
  - `Pending Approval` (amber clock): `supervisorSignoff === null`
  - `Verified` (emerald checkmark): `supervisorSignoff !== null`
* **Formal Quality Evaluation:** Comprehensive compliance, scoring (0–5.0), knockout rules, and semantic thresholds are handled strictly by **Report Builder** (`DESIGN_REPORT_BUILDER.md`).

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
User clicks "Print" on a submission row or in FormFiller header
  └─ setPrintSubmission(submission) → component renders <PrintFilledForm ... />
       ├─ Mounted via ReactDOM.createPortal into document.body
       ├─ Self-fetches formTemplate if not provided (SubmissionManager path)
       ├─ Builds valueMap from submission.formData snapshots
       ├─ Reconstructs dynamic table rows via reconstructTableRows
       ├─ Resolves photo evidence and logo URLs
       └─ User triggers browser print dialog (window.print())
            └─ onClose → setPrintSubmission(null) → view re-renders
```

**Print layout contract.** The portal root carries `print-container print-doc`. Vertical rhythm comes
from the shared token scale in `print.css` — see [`DESIGN_UI_UX.md`](DESIGN_UI_UX.md) §4.2 — not from
this component. Two consequences when editing `PrintFilledForm.tsx`:

- A `.print-block` wrapper must not set its own outer `margin-top` / `margin-bottom`. Inline style
  beats the `.print-block + .print-block` selector and reintroduces uneven gaps. `SECTION_LABEL`
  wrappers get `.print-block--section`; inner (non-`.print-block`) wrappers are unaffected.
- The INFO_GRID renders as `.print-info-grid`, mirroring the FormBuilder canvas and blank form.

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
| `onBack` | `() => void` (optional) | Called when user clicks Back, Cancel, or returns from viewer |
| `onSubmitSuccess` | `(submissionId: string) => void` (optional) | Callback fired after submission or amendment succeeds |
| `onSubmitSuccessWithToken` | `(submissionId: string, token: string) => void` (optional) | Callback with submission ID and access token for guest flow |
| `onCopySubmission` | `(sub: Submission) => void` (optional) | Triggered when operator clones an existing submission record |
| `initialSubmission` | `Submission` (optional) | Preloaded submission data for read-only view or cloning/editing |
| `editSubmissionId` | `string` (optional) | ID of submission to overwrite on edit operations |
| `editToken` | `string` (optional) | Guest access token authorizing amendment via PUT endpoint |
| `canEditSubmission` | `boolean` (optional) | Whether token allows amendment on the current submission record |
| `initialEditMode` | `boolean` (optional) | Auto-open directly in edit mode instead of read-only view |
| `isPublicGuestMode` | `boolean` (optional) | When true, renders guest-friendly navigation controls |
| `readOnly` | `boolean` (optional) | Locks input fields into read-only mode; executive toolbar handles actions |
| `isShortLinkFlow` | `boolean` (optional) | Suppresses secondary loading indicator on short link redirects |

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
| `layoutMode` | `'grid' \| 'list'` (optional) | View layout mode for the submissions list |
| `onOpenReport` | `(submissionId: string) => void` (optional) | Callback to open report view for the submission |
| `onViewingChange` | `(isViewing: boolean) => void` (optional) | Callback fired when entering/exiting full-screen submission view or copy mode |

**PrintFilledForm** (`interface PrintFilledFormProps` in [`src/components/print/PrintFilledForm.tsx`](src/components/print/PrintFilledForm.tsx))

| Prop | Type | Description |
|---|---|---|
| `submission` | `Submission` | The completed submission record to render |
| `formTemplate` | `FormTemplateISO` (optional) | The form template definition; auto-fetched if omitted |
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
| `GET` | `/api/storage/download-url?key=...` | PrintFilledForm, SubmissionManager | Resolve R2 keys to pre-signed download URLs for photo evidence and logo display |

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

### 6.5 Custom "Khác" (Other) Option Value Storage & Progressive Disclosure

Fields with options (`checkbox`, `radio`, `select`) support an expandable "Khác" (free-text entry) option:
- **Zero-Migration Compound Storage:** Free-form user input is encoded directly within the string value using the prefix `__other__:<text>` via `encodeOtherValue()` in `formUtils.ts` (preserving space characters in real time; whitespace normalized during export/print via `formatOptionDisplay()`).
  - For single selection (`radio`, `select`): value is stored as `__other__:<text>` (or `__other__` when blank).
  - For multiple selection (`checkbox`): value is stored as a comma-separated list where the custom entry is included as `__other__:<text>` (e.g., `OPT_1,__other__:Chi tiết bổ sung`).
- **Progressive Disclosure:** `FormFiller.tsx` conditionally reveals an auto-focusing `<input type="text">` immediately below the option when "Khác" is checked or selected, seamlessly synchronizing compound values.
- **Print & View Rendering:** `PrintFilledForm.tsx` uses `isOtherValue()`, `extractOtherText()`, and `formatOptionDisplay()` to detect custom options and format them as `[Nhãn]: [Văn bản nhập]` with underlined text formatting.

### 6.6 Native Placeholder Formatting & Multi-Line Sizing

- **W3C Native Strategy (Zero DOM bloat):** Form templates may include markdown hints in placeholder definitions (e.g. `*( VD: Cung cấp giải pháp... )*`). Rather than creating heavy faux-placeholder overlay DOM elements, placeholders are kept native.
- **Pure Markdown Token Stripping:** `stripMarkdownTokens()` in `src/utils/textFormatter.tsx` cleanly strips syntax delimiters (`*`, `_`, `~`, `<u>`) while strictly preserving line breaks (`\n`) and punctuation.
- **Global Typography Styling:** Native CSS in `src/index.css` applies `font-style: italic`, `color: #94a3b8`, and `opacity: 0.9` to all `input::placeholder` and `textarea::placeholder`.
- **Dynamic Multi-Line Height Auto-Adjustment:** `AutoResizingTextarea` in `FormFiller.tsx` dynamically calculates `placeholderLines` and enforces `minPlaceholderHeight` and initial `rows` when the cell is empty (`!value`), ensuring multi-line instruction placeholders are never vertically truncated.

### 6.7 Unified Table Cell Custom Options Resolution (`getEffectiveCellOptions`)

- **Dual-Compatibility Lookup Invariant:** `block.cellOptionsMap` stores cell-scoped option overrides under the flat key `${rowId}_${colId}`. To prevent architectural drift, `getEffectiveCellOptions(cellOptionsMap, rowId, colId, columnOptions)` in `src/utils/formUtils.ts` handles lookup with automatic fallback to nested `[rowId]?.[colId]`.
- **System-Wide Single Source of Truth:** `PrintFilledForm.tsx`, `PrintBlankForm.tsx`, `FormFiller.tsx`, `ProcessReader.tsx`, and `FormBuilder.tsx` all delegate to this pure utility, eliminating regression risks where print or reader components fall back to column defaults while FormFiller displays custom options.
- **Enhanced Print Render Engine:** `PrintFilledForm.tsx` supports `col.checkboxLayout === '2-column'` grid formatting for radio/checkbox and renders individual boolean checkbox cells cleanly with `✓` indicators when no options array is configured.

### 6.8 Dropdown & Custom "Other" Option Resolution in Print (`formatOptionDisplay`)

- **Option Resolution Across Form Blocks:** Dropdown (`select`) fields across `INFO_GRID`, `CHECKLIST_TABLE`, and `TABLE` blocks resolve stored values via pure utility `formatOptionDisplay(val, options)`. Stored option values (e.g. `PASS`, `OPT_1`) are translated to their human-readable labels on the printed record.
- **Normalized "Other" Prefix Handling:** Compound values with the `__other__:<text>` prefix are formatted as `"[Label]: [Custom Text]"` with exactly one colon separator, eliminating technical prefix leakage (`__other__:`) and preventing duplicate colons (`Khác::`).
- **Defense-in-Depth Print Rendering:** Default field fallbacks in `PrintFilledForm.tsx` intercept `isOtherValue` values automatically, guaranteeing raw storage prefixes never appear on printed documents regardless of block type.

---

## 7. Known Design Constraints & Technical Debt

| Issue | Impact | Notes |
|---|---|---|
| **`GET /api/submissions` loads ALL records** | Poor scalability as submission volume grows | Both `FormManager` and `SubmissionManager` fetch the entire submissions table and filter client-side. No pagination or server-side filter by `formId`. |
| **`GET /api/processes` loaded to resolve template** | Extra network round-trip | FormFiller and FormManager load the full process list just to find `workflowFormsData[formName]`. The form template should be fetched directly from `GET /api/forms/:formId` instead |
| **`status: 'ABNORMALITY' / 'FAIL'` pruned** | Legacy technical debt resolved | Pruned binary `QMS Status` on 2026-09-30. Forms now submit with `SUBMITTED`. Management tables rely purely on `Verification` (`supervisorSignoff`). |
| **`window.alert()` legacy debt** | Blocking dialogs disrupt UX | Progressively replaced: `SubmissionManager` completely converted to non-blocking floating toasts. Remaining alerts in `FormFiller` / `FormManager` to follow. |
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
| 2026-09-14 | `CURRENT` | **FormFiller UI Streamlining — Pruning Manual Add Row Buttons in Favor of Pure Auto-Append:** Removed manual `+ Thêm dòng` buttons from both table footer and group headers in `FormFiller.tsx`. The interface now relies entirely on seamless `handleTableCellChangeWithAutoAppend` to dynamically generate new rows as users reach the end of data tables, while keeping fixed survey and Likert scale tables entirely clean and uncluttered. Trailing empty rows continue to be cleanly pruned upon submission. |
| 2026-09-14 | `CURRENT` | **Unified Print Selection Indicators & Exact Print Color Enforcement:** Standardized print rendering in `PrintFilledForm.tsx` under Option 1 (Semantics-Preserving Circle with Checkmark `(✓)` for Radio & Likert Scale, Square with Checkmark `[✓]` for Checkbox). Enforced text-based `#000000` black checkmarks on `#ffffff` white background to eliminate browser background graphics stripping. Added `print-color-adjust: exact !important` in global print CSS and added `isLikertSelected` helper with whitespace/case normalization. |
| 2026-09-14 | `CURRENT` | **Dead-Code Pruning — Pruned Orphaned PrintRecord.tsx:** Removed 1,636 lines of dead code in `PrintRecord.tsx` which had been fully superseded by `PrintFilledForm.tsx` since 2026-08-03. Unified Module Ownership Map in `AGENTS.md`, `DESIGN_FORM_OPERATIONS.md`, and `DESIGN_UI_UX.md` to designate `PrintFilledForm.tsx` as the sole authoritative filled-submission print renderer, permanently eliminating double maintenance overhead. |
| 2026-09-14 | `CURRENT` | **Native Placeholder Formatting & Dynamic Multi-Line Height:** (1) Implemented pure utility `stripMarkdownTokens` in `textFormatter.tsx` to strip raw markdown formatting symbols (`*`, `**`, `<u>`, `~`) from placeholder strings without faux DOM layers. (2) Standardized system-wide `::placeholder` styling in `index.css` with `font-style: italic`, color `#94a3b8`, and `opacity: 0.9`. (3) Upgraded `AutoResizingTextarea` in `FormFiller.tsx` to dynamically size initial height and `rows` based on newline counts in multi-line placeholders, eliminating text truncation in empty table cells. |
| 2026-09-14 | `CURRENT` | **Unified Table Cell Custom Options Resolution & Print Rendering:** (1) Implemented pure utility `getEffectiveCellOptions` in `formUtils.ts` with dual-compatibility lookup (`${rowId}_${colId}` and `[rowId][colId]`), eliminating hardcoded lookups across 5 components. (2) Fixed key resolution mismatch in `PrintFilledForm.tsx` where cell custom options were bypassed in favor of column defaults, accurately printing per-cell options and checkmarks. (3) Added 2-column grid layout support and single boolean checkbox rendering in filled form print. |
| 2026-09-17 | `CURRENT` | **Dropdown & Custom "Other" Option Resolution in Print:** (1) Standardized `formatOptionDisplay` in `formUtils.ts` to normalize custom other label with consistent colon separation and handle option value/label lookup. (2) Added dedicated select rendering branch and defense-in-depth fallback in `INFO_GRID` of `PrintFilledForm.tsx`, eliminating raw `__other__:<text>` technical prefix leakage. (3) Unified select decoding across `CHECKLIST_TABLE` and `TABLE`, and eliminated duplicate colons in radio/checkbox otherText labels. |
| 2026-09-17 | `CURRENT` | **Automated Form Duplication Utilities:** Added `generateNextFormId` (smart numeric suffix detection, auto-increment, and collision check) and `duplicateFormTemplate` (deep clone of layout blocks, UUID regeneration for blocks/fields/rows, cell map re-indexing, title update, and DRAFT v0.1 reset) in `formUtils.ts`. |
| 2026-09-28 | `CURRENT` | **Streamlined Submission View Toolbar & Dynamic Form/Report Segmented Tab UI:** (1) Streamlined submission viewing toolbar in `FormFiller.tsx`: removed visual clutter (`[ ABNORMALITY ]` badge, submitter name, `[📋 Sao chép]` button, simplified Back and Print labels). (2) Added segmented pill tab `[ Form | Report ]` matching `ReportBuilder.tsx` aesthetics, preserving the Focus mode toggle on the Form tab. (3) Replaced sharing popup/modal with an inline link sharing box: on the Form tab, displays and copies the Form Submission link (`/f/:slug/s/:subId?token=...`); on the Report tab, displays and copies the Report link (`/f/:slug/r/:subId?token=...`). (4) Standardized edit button to `[✏️ Chỉnh sửa]` across both tabs. (5) Embedded `FormReport.tsx` inside `FormFiller.tsx` in `isEmbedded` mode. (6) Updated `App.tsx` and `SubmissionViewer.tsx` to route both `/s/:id` and `/r/:id` paths with token support. |
| 2026-09-29 | `CURRENT` | **Action-Driven Submission Toolbar: Contextual View Switcher & 1-Click Share Button (`FormFiller`):** (1) Removed segmented pill tab `[ Form \| Report ]` from left header, keeping only clean identity label `Phiếu <id>`. (2) Added contextual View Switcher action button on the right toolbar: displays `[ 📊 Xem báo cáo ]` when viewing Form (switching to Report) and `[ 📋 Xem phiếu gốc ]` when viewing Report (switching to Form). (3) Replaced bulky 210px inline link input box with a minimalist `[ ↗ Chia sẻ ]` button (`Share2` icon) featuring 1-click clipboard copy of the context-aware URL with an instant 2-second visual feedback state `[ ✓ Đã chép! ]` (`Check` icon, `#dcfce7` green pill). Saves ~180px horizontal space, eliminating toolbar overflow. |
| 2026-09-29 | `CURRENT` | **Smart Success Screen & Seamless Direct /r/ Report Routing (`FormFiller`, `App`):** (1) Upgraded post-submit success screen in `FormFiller.tsx`: added prominent Primary CTA `[ 📊 Xem Báo cáo Đánh giá ]` (`/f/:slug/r/:id?token=...`), Secondary CTA `[ 📋 Xem phiếu vừa nộp ]` (`/f/:slug/s/:id?token=...`), and `[ + Điền phiếu mới ]` without unneeded preliminary score clutter. (2) Added `useEffect` in `FormFiller.tsx` synchronizing `initialSubmissionTab` prop into `submissionTab` state. (3) Upgraded `rawFormTemplate` resolution with multi-attribute fallback (formName, formTitle, formId, slugified title) to ensure pre-fetch and report rendering never fail when accessed via slug paths. (4) Fixed routing in `App.tsx` for `/f/:formName/[sr]/:subId` and `/([sr])/:subId`: cascading token fallback (URL param -> localStorage `submission_history` -> JWT session) eliminates false-positive redirects to blank forms when accessing report links. |
| 2026-09-29 | `CURRENT` | **Unified Post-Submit Screen for All Users (`FormFiller`):** Removed `isPublicGuestMode` guard on `setSubmitResult` so authenticated users (Admin/Supervisor) see the same Smart Success Screen as guests after new submission. Added `[ ⬅ Về Quản lý ]` navigation button (visible only for authenticated users with `onBack`). Prevents `App.tsx` `onSubmitSuccess` from force-redirecting to `FormManager` (which hung on "Loading form details..." for unlinked forms). |
| 2026-09-29 | `CURRENT` | **Architectural Transition to Clean URLs & Complete Removal of Access Token:** (1) Dropped `access_token` requirement from all view and update endpoints (`GET /api/submissions/view/:id`, `GET /api/reports/view/:id`, `PUT /api/submissions/:id`, `POST /api/submissions/batch-lookup`). (2) Streamlined routing in `App.tsx`: eliminated 3-layer token fallback logic; direct match `/s/:id`, `/r/:id`, `/f/:formName/[sr]/:subId` opens `SubmissionViewer` instantly without redirects. (3) Clean share URLs in `FormFiller.tsx`: links copied from toolbar (`[ ↗ Chia sẻ ]`) or success screen (`submitResult`) are completely token-free (`/f/:slug/s/:id` and `/f/:slug/r/:id`). (4) Enforced pure lifecycle-based security: any recipient with link can view and amend submission if `supervisorSignoff` is null; once signed off, record is permanently frozen (100% read-only). |
| 2026-09-30 | `CURRENT` | **Performance: Bundled Form Template Response & Data Path Optimization:** (1) Server `GET /submissions/view/:id` now JOINs `forms` table, returning `formTemplate` alongside submission data in a single response — eliminates 2 sequential RTTs (404 form lookup + fetch-all-processes) for public viewers. (2) `SubmissionViewer` extracts bundled `formTemplate` and passes `preloadedFormTemplate` to `FormFiller`, which uses a fast-path to build `virtualProcess` without network calls. (3) Fixed `effectiveFormName` derivation: when `formName='submission'` (hardcoded from short links `/s/:id`), falls back to `submission.formId`. (4) Fixed `ReferenceError: token` crash in `GET /reports/view/:submissionId` by removing dead `accessToken` field. (5) Parallelized Q2+Q3 in public report endpoint via `Promise.all`. (6) Added `Cache-Control: public, max-age=3600` for locked submissions. (7) `FormReport`: memoized `extractAllFormFields` via `useMemo`, built `fieldMap: Map<string, FormFieldISO>` for O(1) lookups replacing O(N) `.find()` in table render loop. |
| 2026-09-30 | `CURRENT` | **Option 1 Cleanup: Complete Removal of Legacy QMS Status (`SubmissionManager`, `FormManager`, `FormFiller`):** (1) Removed `QMS Status` table column and `Status` dropdown filter from `SubmissionManager.tsx`; rebalanced table columns (`Record ID` 14%, `Process Name` 36%, `Operator` 14%, `Date/Time` 16%, `Verification` 12%, `Actions` 8%). (2) Removed `Status` table column and dropdown filter from `FormManager.tsx`. (3) Pruned dead `isOverallPass` logic and binary `ABNORMALITY` tagging from `FormFiller.tsx` and `ProcessReader.tsx`; submissions now submit with canonical status `'SUBMITTED'`. (4) Removed status badge from `FormFiller` local history drawer, displaying clean `🔒 Đã ký duyệt` or `🕒 Chờ duyệt`. (5) Removed `Status: PASS / ABNORMALITY` from `PrintFilledForm.tsx` preview header. (6) Server endpoints default `status = 'SUBMITTED'` if omitted. Management views now rely purely on single lifecycle indicator `Verification` (`Pending` / `Verified`). |
| 2026-09-30 | `CURRENT` | **Submissions Tab Redesign: Grouped by Form, Filter by Process, 100% List Layout (`SubmissionManager`, `Dashboard`):** (1) Converted Submissions tab to strict 100% List view, hiding top-right List/Grid toggle in `Dashboard.tsx` when on Submissions tab. (2) Replaced flat table and redundant `BIỂU MẪU & QUY TRÌNH` column with dynamic Accordion cards grouped by Form Template (`formGroups`). Header displays form title, version, linked process badge, submission/pending counters, and 1-click `[ ✍️ Điền phiếu mới ]`. (3) Added Process Filter dropdown (`processFilter`) and Verification Status dropdown on Toolbar alongside search text and `[ ⊞ Mở rộng / Thu gọn tất cả ]`. (4) Streamlined table into 5 focus columns (`MÃ PHIẾU` 20%, `NGÀY` 18% formatted as DD/MM/YYYY, `NGƯỜI LẬP` 24%, `TRẠNG THÁI` 18%, `THAO TÁC` 20%). (5) Contextual action buttons: `[ ✍️ Ký duyệt ]` (Pending) / `[ 👁 Xem ]` (Verified), `[ 📊 Báo cáo ]`, and `[ ••• ]` dropdown (Web Full View, Copy Record, Print A4, Delete). |
| 2026-09-30 | `CURRENT` | **Visual Streamlining & Actions Alignment (`SubmissionManager`):** (1) Standardized version string formatting with `formatVersion` helper, stripping redundant leading `v`/`V` before prefixing `v` (fixing `vv0.2` -> `v0.2`). (2) Streamlined toolbar: removed right-side cluster (`<N> phiếu / <M> nhóm`, `[ ↕ Thu gọn ]`, `[ ↻ Làm mới ]`); pruned dead `toggleAllGroups`, `ChevronsUpDown`, `RefreshCw` to satisfy `TS6133`. (3) Removed circular avatar badges (`NG`, `TR`, `AD`) from Operator column, rendering clean textual operator ID. (4) Removed submission count and pending badges from form group accordion header. (5) Aligned table header titles with Tab Forms Title Case conventions (`Record ID`, `Date`, `Operator`, `Status`, `Actions`). (6) Streamlined Actions column into compact 28x28px square icon buttons centered in table cells (`[ 👁 ]` View/Sign-off, `[ 📊 ]` Report, `[ ••• ]` Dropdown Menu). |
| 2026-09-30 | `CURRENT` | **Performance: Light List Endpoint & SWR Caching (`SubmissionManager`, `server.cjs`, `Dashboard`):** (1) Removed `form_data`, `media_urls`, `access_token` from `GET /api/submissions` SELECT query — payload reduced ~90% (metadata-only response). (2) Added `fetchFullSubmission` lazy-fetch helper: fetches full submission via `GET /api/submissions/:id` on-demand for detail panel, print, and copy actions. (3) SWR cache pattern: `submissions` state initializes from `sessionStorage('swr_submissions')`, `loading` defaults `false` when cache exists, background revalidation on mount. (4) Eliminated redundant `/api/processes` call: added `cachedProcesses` prop to `SubmissionManagerProps`, Dashboard passes its SWR-cached `processes` down; `processes` state initializes from prop → sessionStorage fallback. (5) O(1) `processLookupMap` via `useMemo`: pre-parses all `workflowFormsData` once into `Map<formId, Process>`, replacing O(N×M) `getLinkedProcess` inner loop with O(1) `Map.get`. |


