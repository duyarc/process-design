# Form Operations — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Form Operations |
| **Status** | Active Development |
| **Verified At Commit** | (2026-10-28) — Consolidated Submissions: FormManager pruned & unified into SubmissionManager |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/FormFiller.tsx`](src/components/FormFiller.tsx) | Digital form fill-out UI for operators |
| [`src/components/form/MiniMapCanvas.tsx`](src/components/form/MiniMapCanvas.tsx) | **NEW** — Pure HTML5 Canvas map & satellite imagery thumbnail stitcher (OpenStreetMap & Esri World Imagery, zero dependency, no scroll trap, PDF-compatible) |
| [`src/components/form/LocationInputFiller.tsx`](src/components/form/LocationInputFiller.tsx) | Location input bar, GPS trigger, coordinate card & Mini Map |
| [`src/components/form/PhotoFieldFiller.tsx`](src/components/form/PhotoFieldFiller.tsx) | **NEW** — Sub-component: Photo evidence upload/view, R2 direct resolution, onError fallback, Lightbox modal |
| [`src/components/SubmissionViewer.tsx`](src/components/SubmissionViewer.tsx) | **NEW** — Public submission review & amendment container |
| [`src/components/SubmissionManager.tsx`](src/components/SubmissionManager.tsx) | Single Source of Truth for submission logs (global & single-form focused view) |
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

### SubmissionManager (Unified Submission Operations — Single Source of Truth)

| Feature | Detail |
|---|---|
| **All submissions across all forms** | Fetches the entire `submissions` table; enriches with process titles and form metadata |
| **Single-form focus mode** | When auditing from a form card or process step, focuses directly on that form with active filter banner and auto-expanded group |
| **Empty state 0-submission display** | Forms with 0 submissions remain visible when filtered, showing clean empty state + `+ Fill Form` and `Share Link` |
| **Share link** | Quick `Share Link` button on each group header copying deep URL `/?page=fill&processId=...&formName=...` via non-blocking toast |
| **Filter bar** | Search by process title, operator ID, submission ID, or form ID; filter by process and sign-off status |
| **Supervisor sign-off** | Slide-over drawer with name + notes fields; "Verify & Sign Off" button calls `POST /api/submissions/:id/signoff` |
| **Print record** | "Print" button mounts `PrintFilledForm` with the full submission data and template |
| **Embedded mode** | `isEmbedded=true` prop integrates seamlessly inside Dashboard Submissions tab |
| **Photo evidence preview** | Resolves R2 object keys to pre-signed download URLs for inline display and Lightbox |

---

## 3. Component Map

```
Form Operations Module
│
├── FormFiller.tsx              Operator fill-out form UI — standalone page (page='fill-form')
│
├── SubmissionManager.tsx       Unified submission log & supervisor operations — embedded inside Dashboard
│   └── PrintFilledForm         Print renderer — mounted as React Portal on print trigger
│
└── print/PrintFilledForm.tsx   A4 filled-record print renderer; mirrors blank form layout
```

### Routing in App.tsx

| Route | Component | Launched From |
|---|---|---|
| `page='fill-form'` | `FormFiller` | `Dashboard` → form card "Fill" button; group header `+ Fill Form`; deep link URL |
| Dashboard `Submissions` tab | `SubmissionManager` (embedded) | Dashboard tab switch; form card "Audit" button; Process step form audit |

### Component Responsibilities

- **FormFiller** — Renders the live form template; manages `formValues`, `fieldReactions`, and `uploadedPhotos` state; validates fields against specs; builds and submits a `Submission` payload to the API.
- **SubmissionManager** — Single Source of Truth for all form submissions; supports global cross-form auditing and single-form focused view; provides supervisor sign-off drawer, Share Link, and print integration.
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

### 6.9 Synchronous Focus Mode Initialization & SWR Cache Synchronization

- **Synchronous Default Mode (`viewMode`):** `FormFiller.tsx` initializes `viewMode` state synchronously via lazy initializer function inspecting `preloadedFormTemplate` and `initialCache.process` (`rawFormTemplate.defaultFocusMode === true`). Guarantees 0ms immediate render in Focus mode without flickering or defaulting to continuous view.
- **Dynamic Live DB Resynchronization (`userInteractedViewModeRef`):** Replaced one-shot `hasInitializedViewMode` ref with `userInteractedViewModeRef = useRef(false)`. If an operator has not explicitly toggled the mode, any background SWR revalidation (`fetchProcess`) updating `rawFormTemplate` will seamlessly synchronize `viewMode` to `rawFormTemplate.defaultFocusMode`. User interaction permanently preserves operator choice.
- **SWR Cache Synchronization Across Modules:** `FormBuilder.tsx` and `ProcessEditor.tsx` now synchronously update `sessionStorage.getItem('swr_forms')` on form save (`saveFormToBackend`, `onSave`), ensuring instant paint always receives fresh `default_focus_mode` metadata.
- **Section Threshold Relaxation:** `sections.length >= 1` allows single-section forms with H2 sub-sections or standalone sections to cleanly render in Focus accordion mode.

### 6.10 Guidance Box & Deduplication Invariants (Focus Mode & Field Parity)

- **Header Block Identification:** `FormSectionGroup` and `FormSubSectionGroup` include `headerBlock?: LayoutBlockISO` indicating the block that initiated the section/subsection.
- **Deduplication Suppression:** In Focus mode, section/sub-section plain text descriptions (`sec.description`, `subSec.description`) are suppressed when `headerBlock?.type === 'TABLE'`. Because `TABLE` blocks render their own dedicated, interactive guidance accordion (`[ 💡 Hướng dẫn ⌃/⌄ ]` + guidance box with formatted markdown), suppressing section-level plain text eliminates duplicate guidance display and ensures collapsible guidance controls all guidance text cleanly.
- **Section Label Preservation:** Conventional `SECTION_LABEL` blocks (which have no inputs or internal guidance controls) continue to render their descriptions via `sec.description` / `subSec.description` without modification.
- **100% Visual Parity Across All Guidance Boxes:** All guidance containers (`INFO_GRID` fields, `TABLE` blocks, and `TABLE` rows) share unified design tokens: `background: '#f8fafc'`, `borderLeft: '3px solid #0d9488'`, no outer 4-sided border, `borderRadius: '3px'`, `fontSize: '0.78rem'`, `color: 'var(--text-primary)'`, `boxShadow: '0 1px 3px rgba(0,0,0,0.04)'`, and standard light bulb icon `<span style={{ color: '#0d9488', fontSize: '0.82rem', marginTop: '2px' }}>💡</span>`. Eliminates green-tinted text and 4-sided teal borders.

---

## 7. Known Design Constraints & Technical Debt

| Issue | Impact | Notes |
|---|---|---|
| **`GET /api/submissions` loads ALL records** | Poor scalability as submission volume grows | Both `FormManager` and `SubmissionManager` fetch the entire submissions table and filter client-side. No pagination or server-side filter by `formId`. |
| **`GET /api/processes` loaded to resolve template** | Extra network round-trip | FormFiller and FormManager load the full process list just to find `workflowFormsData[formName]`. The form template should be fetched directly from `GET /api/forms/:formId` instead |
| **`status: 'ABNORMALITY' / 'FAIL'` pruned** | Legacy technical debt resolved | Pruned binary `QMS Status` on 2026-09-30. Forms now submit with `SUBMITTED`. Management tables rely purely on `Verification` (`supervisorSignoff`). |
| **`window.alert()` legacy debt** | Blocking dialogs disrupt UX | Progressively replaced: `SubmissionManager` completely converted to non-blocking floating toasts. Remaining alerts in `FormFiller` / `FormManager` to follow. |
| **Photo evidence keys not tracked by submission ID** | Resolved via Lifecycle Sync & GC | Submissions deletion now synchronously removes associated R2 objects; background GC & manual Admin GC purge orphaned files older than 2 hours. |
| **Operator ID is free-text, not authenticated** | Attributability is not verified | The `operatorId` field accepts any string. There is no tie to the authenticated `currentUser` — an operator can enter any name |
| **Supervisor name pre-fill is role-based but unverified** | Supervisor sign-off can be made by anyone who types a name | `supervisorName` is pre-filled from `currentUser.full_name` if role is `admin` or `supervisor`, but the field is editable and there is no server-side permission check on the signoff endpoint |
| **Form template resolved from `workflowFormsData`** | Stale template risk mitigated | Background SWR revalidation in `FormFiller` parallel-fetches `/api/forms/:id` and updates virtual process state. FormBuilder and ProcessEditor synchronize `sessionStorage` (`swr_forms`) on save. |

---

## 8. Change Log

Architectural changes only — data model, contracts, invariants, new block types.
UI/styling history lives in `git log`. Capped at ~15 entries; older rows are dropped.

| Date | Commit | Change |
|---|---|---|
| 2026-10-28 | `CURRENT` | **WYSIWYG 1-Touch Print & In-Progress Form Handling (`FormFiller`):** (1) Eradicated 2-tier print dropdown menu, chevron icons, and `isPrintMenuOpen` state, unifying print action into a single 1-touch `handlePrintWYSIWYG` button across Viewing and Filling headers. (2) Implemented automatic context detection: view mode prints completed submission, 100% empty form prints blank form (`PrintBlankForm`), and in-progress form (>= 1 filled field) prints clean draft filled form (`PrintFilledForm`) without arbitrary DRAFT stamps or watermarks. (3) Maintained master guidance toggle (`isAllGuidanceExpanded`) synchronization for clean vs. guided printouts. |
| 2026-10-28 | `CURRENT` | **Submission Manager Consolidation & Dead-Code Pruning (`SubmissionManager`, `FormManager`, `Dashboard`, `App`):** (1) Extracted and pruned `FormManager.tsx` (~723 lines dead-code) and `page='form-manager'` route, unifying submission operations into `SubmissionManager.tsx` as the single source of truth. (2) Upgraded `SubmissionManager` with single-form focused view (active filter banner, auto-expanding accordion), group header Share Link button, and synthetic 0-submission group display with empty state placeholder and `+ Fill Form` trigger. (3) Unified all Audit / View Submissions buttons in `Dashboard.tsx` to navigate directly to the Submissions tab with form filter. |
