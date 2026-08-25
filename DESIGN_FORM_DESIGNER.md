# Form Designer — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Form Designer |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Verified At Commit** | `755edc5` (2026-08-25) — Sections 2 & 3 (1-Click Block Cloning: handleCloneBlock, Canvas toolbar, Section Settings, Ctrl+D shortcut in FormBuilder.tsx). |

> **⚠️ Architectural note:** FormBuilder has no awareness of which process it belongs to. The `formName` prop is always identical to `formId`. See Section 6.1 and the Technical Debt table.

### Quick File Index

| [`src/utils/pdfFormExporter.ts`](src/utils/pdfFormExporter.ts) | Facade API entry point for Fillable PDF export |
| [`src/utils/pdf/types.ts`](src/utils/pdf/types.ts) | Types for PDF export module (`ScannedAcroField`, `PdfPageConfig`) |
| [`src/utils/pdf/textAnchorInjector.ts`](src/utils/pdf/textAnchorInjector.ts) | Helper functions for text anchor tags `{{acro:id:type:w:h}}` |
| [`src/utils/pdf/domScanner.ts`](src/utils/pdf/domScanner.ts) | Scans DOM field annotations at exact A4 width `697.7px` |
| [`src/utils/pdf/backgroundGenerator.ts`](src/utils/pdf/backgroundGenerator.ts) | Generates 300 DPI A4 background PDF via `html2canvas` & `jsPDF` |
| [`src/utils/pdf/acroFormOverlay.ts`](src/utils/pdf/acroFormOverlay.ts) | Overlays interactive AcroForm fields onto PDF pages via `pdf-lib` |
| [`src/utils/pdf/downloadHelper.ts`](src/utils/pdf/downloadHelper.ts) | Browser 5S PDF download helper |
| [`src/types.ts`](src/types.ts) | Shared types: `FormTemplateISO`, `LayoutBlockISO`, `FormFieldISO`, `FormRevisionEntry`, `MatrixConfigISO`, `TableColumnConfig` (**owning doc** for these types) |

> **Update rule:** Whenever any of the above files is modified in a session, update the
> "Verified At Commit" field and add an entry to the [Change Log](#8-change-log) at the
> bottom of this document. Cite symbol names, never line numbers.

---

## 1. Purpose & Scope

### What This Module Does
The Form Designer is the **authoring and publishing system for reusable operational form templates** (checklists, inspection sheets, sign-off tables, matrix count sheets).

It lets authorized users:
- Create and edit a form template by assembling **layout blocks** — each block is a self-contained section with a type (checklist table, info grid, matrix, sign-off, etc.).
- Configure **fields** within each block (type, label, acceptance spec, unit, reaction protocol, options).
- Manage a company logo on the form header.
- **Version** form templates: Draft → Active (published) — with a full revision history that stores a layout snapshot per version.
- **Restore** any past version's layout back into the current draft.
- **Print** a blank form for physical shop-floor use.

### What This Module Does NOT Do
- **Does not have its own page route** — FormBuilder is always launched as a modal overlay from inside ProcessEditor (Process Designer module). There is no `page='form-builder'` in `App.tsx`.
- **Does not collect or store form submissions** — that is the Form Operations module (`FormFiller.tsx`, `FormManager.tsx`).
- **Does not manage which steps in a process use which form** — that linkage is owned by ProcessEditor via `workflowFormsData`.
- **Does not manage user permissions** — the launch context (ProcessEditor) decides whether to show Edit or View mode.
- **Has no intrinsic knowledge of which process it belongs to** — as of 2026-07-14, `linkedProcessId` is passed as a prop from ProcessEditor. Without this prop, FormBuilder cannot determine if the form is linked to any process (no DB query or context exists inside FormBuilder for this).

---

## 2. User-Facing Features

FormBuilder renders as a three-panel layout inside a fixed fullscreen modal:

### Left Panel — Block Palette & Form Metadata
| Control | Purpose |
|---|---|
| **Form ID** | Editable identifier (e.g. `FM-QC-F01`) — primary key in the database |
| **Form Title** | Human-readable name |
| **Block type buttons** | Add TITLE, INFO_GRID, MATRIX_TABLE, TABLE, SIGN, SECTION_LABEL blocks (`CHECKLIST_TABLE` retired for new creation; superseded by `TABLE`) |
| **Copy Block from another form** | Opens a modal to browse all processes and copy an existing block as a template |

### Center Panel — Block Canvas
| Control | Purpose |
|---|---|
| **Block list** | Ordered list of blocks; click to select and activate a block |
| **Move Up / Move Down** | Reorder blocks within the form |
| **Delete Block** | Remove a block and all its fields |
| **Add Field button** | Add a field to the selected block (type: text / number / date / time / radio / signature / photo) |
| **Field row controls** | Reorder, delete fields within a block |
| **Logo upload** | On TITLE blocks: upload a new logo file, or open a gallery of previously uploaded logos |

### Right Panel — Two Tabs
| Tab | Purpose |
|---|---|
| **Properties** | Edit the selected block's title, column count, column header labels; edit the selected field's label, type, min/max spec, unit, target range, reaction protocol, frequency, radio options |
| **Versions** | View full revision history; restore a past layout; create a new draft version; delete a specific version; set effective date and change summary before publishing |

### Top Action Bar
| Button | Purpose |
|---|---|
| **Print Preview** | Renders `PrintBlankForm` (React Portal) for browser print |
| **Save Draft & Close** | Saves current layout to DB as DRAFT, calls `onSave` callback, closes modal |
| **Publish** | Validates, bumps status to ACTIVE, creates a revision history entry, locks the canvas |
| **Discard & Close** | Closes modal without saving |

---

## 3. Component Map

```
Form Designer Module
│
├── FormBuilder.tsx          Shell: header bar + left panel (palette) + center canvas + right panel (properties/versions)
│   └── PrintBlankForm       Rendered conditionally as a React Portal (replaces FormBuilder in DOM when print is triggered)
│
└── print/PrintBlankForm.tsx  A4 print layout renderer; accepts a FormTemplateISO and renders all block types to print-safe HTML
```

### Component Responsibilities

- **FormBuilder** — Owns all mutable form state (formId, formTitle, version, status, layoutBlocks, revisionHistory). Coordinates save, publish, version management, logo upload, and block/field editing. Communicates back to ProcessEditor via `onSave` and `onClose` callbacks.
- **PrintBlankForm** — A pure renderer. Takes a `FormTemplateISO` snapshot and renders a full printable A4 document. Mounted via `ReactDOM.createPortal` into `document.body`, replacing the FormBuilder view temporarily. Handles logo URL resolution from Cloudflare R2 via a `GET /api/storage/download-url` call.

---

## 4. Data Model

All types are defined in [`src/types.ts`](src/types.ts).

### Top-level: `FormTemplateISO`

```typescript
interface FormTemplateISO {
  formId: string;               // Primary key, e.g. "FM-QC-F01"
  formTitle: string;            // Display name
  version: string;              // e.g. "v1.2 (2026-07-01)" or "v1.3 (draft)"
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  layoutBlocks: LayoutBlockISO[];
  revisionHistory: FormRevisionEntry[];
}
```

### Layout Block: `LayoutBlockISO`

```typescript
export interface TableRowConfig {
  id: string;
  lineCount?: number; // Number of handwriting lines per row. Default = 1. Range: 1–5.
                     // Controls row height (28px × lineCount) in canvas, print, and PDF AcroForm.
}

interface LayoutBlockISO {
  id: string;
  type: 'TITLE' | 'INFO_GRID' | 'CHECKLIST_TABLE' | 'MATRIX_TABLE' | 'SIGN' | 'TABLE' | 'SECTION_LABEL';
  columns: 1 | 2 | 3;          // Number of field columns rendered in this block
  title: string;
  fields: FormFieldISO[];
  logo?: string;                // R2 storage key (e.g. "uploads/logo.png") or inline URL — TITLE blocks only
  description?: string;         // SECTION_LABEL block description text
  columnLabels?: {              // CHECKLIST_TABLE: custom header text
    stt: string; item: string; target: string; reaction: string;
  };
  matrixConfig?: MatrixConfigISO;    // MATRIX_TABLE configuration
  borderStyle?: 'grid' | 'borderless' | 'horizontal_only'; // TABLE block border style
  tableColumns?: TableColumnConfig[]; // TABLE block column definitions
  tableRows?: TableRowConfig[];       // TABLE block row definitions
  tableData?: { [rowId: string]: { [colId: string]: string } }; // TABLE static cell values
}
```

### Block Type Taxonomy

| Type | Purpose | Has Fields |
|---|---|---|
| `TITLE` | Form header: title, form ID, date, operator, logo | Optional INFO fields |
| `INFO_GRID` | General info fields laid out in a grid | Yes (text/date/time) |
| `CHECKLIST_TABLE` | *(Retired / Deprecated)* Legacy check items — use `TABLE` for new forms | Yes (all types) |
| `MATRIX_TABLE` | Tally count matrix (rows × product columns) | No — matrix config only |
| `TABLE` | Freeform dynamic table (configurable columns + rows) | No — table config only |
| `SIGN` | Signature/approval block | Yes (signature type) |
| `SECTION_LABEL` | Visual separator with heading and description text | No |

### Field: `FormFieldISO`

```typescript
interface FormFieldISO {
  id: string;
  type: 'label' | 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature' | 'photo' | 'subtable';
  checkItem: string;             // Label / description of what is being checked
  locationCode: string;          // Physical location code (e.g. "PG-02")
  minSpec?: number;              // For number type: lower bound
  maxSpec?: number;              // For number type: upper bound
  unit?: string;                 // For number type: display unit (e.g. "°C", "bar")
  targetRange?: string;          // For text/boolean: target description text
  options?: RadioOption[];        // For radio type: selectable options with isPass flag
  frequency: string;             // How often checked (e.g. "Once/Shift", "Every batch")
  reactionProtocol: string;      // What to do if the check fails
  timeMode?: 'single' | 'dual';  // For time type: single timestamp or from/to range
}
```

### Revision History: `FormRevisionEntry`

```typescript
interface FormRevisionEntry {
  version: string;               // Clean version string, e.g. "v1.2"
  date: string;                  // Effective date, e.g. "2026-07-01"
  author: string;                // Currently hardcoded as "QA Administrator"
  change: string;                // Change summary entered by the user
  layoutBlocks?: LayoutBlockISO[]; // Full layout snapshot — required to enable Restore
}
```

### Form Lifecycle

```
DRAFT ──[handlePublish]──→ ACTIVE  (canvas locked; revision entry created with layout snapshot)
ACTIVE ──[handleCreateNewVersion]──→ new DRAFT  (increments minor version; e.g. v1.2 → v1.3 draft)
DRAFT ──[handleDeleteActiveDraft]──→ deleted from DB
[any revision] ──[handleDeleteVersion]──→ deleted from revision history + DB
```

### Version String Format

| Phase | Format Example | Notes |
|---|---|---|
| Draft | `v0.1 (draft)` | Created by `handleCreateNewVersion` or default init |
| Active | `v0.1 (2026-07-01)` | Set by `handlePublish` using the effective date |
| Viewing old revision | `v0.1 (2026-07-01) [RETIRED]` | Temporary display-only string while browsing history |

### `isLocked` Flag

- Derived from `status === 'ACTIVE'` — updated by a `useEffect` whenever `status` changes.
- When `true`: all block and field mutation handlers (`handleAddBlock`, `handleDeleteBlock`, `handleMoveBlock`, `handleAddField`, etc.) return early without modifying state.
- This is a **UI-layer guard only** — no server-side enforcement.

---

## 5. Key Flows

### Flow A: Open FormBuilder (from ProcessEditor)

```
ProcessEditor: user clicks Edit / View button on a form row
  └─ activeFormToBuild = formId (e.g. "FM-QC-F01")
       └─ <FormBuilder /> modal overlay mounts
            ├─ Props resolved (priority order):
            │    1. Live record from allForms[] (fetched from DB by ProcessEditor)
            │    2. workflowFormsData[formId] (ProcessEditor local state fallback)
            │    3. Blank new form with that formId
            └─ On mount: useEffect [initialData?.formId] fires
                 ├─ GET /api/forms/:formId          → overrides state with DB record
                 └─ GET /api/forms/:formId/history  → loads full revision history
```

### Flow B: Add a Block and Configure a Field

```
User clicks a block type button in the left panel
  └─ handleAddBlock(type) runs (no-op if isLocked)
       ├─ Creates new LayoutBlockISO with default config for the type
       └─ Appends to layoutBlocks[], sets activeBlockId → right panel auto-switches to Properties

User clicks on a field row in the canvas
  └─ setActiveFieldId(fieldId) → right Properties panel shows field editor

User edits a field property in the right panel
  └─ handleUpdateField(blockId, fieldId, { ...updates }) → immutably updates layoutBlocks[]
```

### Flow C: Save Draft

```
User clicks "Save Draft & Close"
  └─ handleSaveDraftAndClose() runs
       ├─ Parses version string to extract clean version (e.g. "v0.1")
       ├─ Checks DB for version uniqueness: GET /api/forms/:formId?version=v0.1
       │    → if already exists AND different from the initialData version: shows alert, aborts
       ├─ saveFormToBackend() runs
       │    └─ POST /api/forms  { formId, formName, formTitle, status, version, layoutBlocks, revisionHistory }
       ├─ onSave({ formId, formTitle, version, status, layoutBlocks, revisionHistory })
       │    └─ ProcessEditor: updates workflowFormsData[formId], silently re-saves process
       └─ onClose() → modal unmounts
```

### Flow D: Publish (Activate) a Form Version

```
User fills in Change Summary + Effective Date in the Versions tab
User clicks "Publish"
  └─ handlePublish() runs
       ├─ Validates: changeSummary not empty, all fields have labels
       ├─ Parses version → target clean version string (e.g. "v0.1")
       ├─ Checks DB for version uniqueness: GET /api/forms/:formId?version=v0.1
       │    → if conflict: shows alert, aborts
       ├─ Builds newActiveVersion string: "v0.1 (2026-07-01)"
       ├─ Creates newHistoryEntry with full layoutBlocks snapshot
       ├─ Updates state: version, status='ACTIVE', revisionHistory, isLocked=true
       ├─ saveFormToBackend({ versionOverride, statusOverride='ACTIVE', historyOverride })
       │    └─ POST /api/forms  (upsert with new active version)
       └─ onSave({ formId, formTitle, version: newActiveVersion, status:'ACTIVE', ... })
            └─ ProcessEditor: updates workflowFormsData, silently re-saves process
```

### Flow E: Create a New Version Draft from Active

```
User clicks "+ NEW DRAFT" (in Form Settings panel or Version tab)
  └─ handleCreateNewVersion() runs
       ├─ Parses current version major.minor (e.g. v0.1 → major=0, minor=1)
       ├─ Sets version = "v0.2 (draft)"
       ├─ Sets status = 'DRAFT', isLocked = false
       └─ Canvas becomes editable (isLocked=false unblocks all mutation handlers)
            Note: this does NOT save to DB — user must Save Draft or Publish
```

### Flow F: Restore a Past Revision

```
User opens Versions tab → clicks "Restore" on a revision history entry
  └─ handleRestoreRevision(entry) runs
       ├─ Guards: entry must have layoutBlocks stored (some older entries may be log-only)
       ├─ Saves a backup of the current draft: currentDraftBackup = { layoutBlocks, version, isLocked }
       ├─ Loads entry.layoutBlocks into canvas
       ├─ Sets version = "v0.1 (2026-07-01) [RETIRED]", isLocked = true
       └─ viewingRevisionVersion = entry.version (enables banner + commit/cancel buttons)

User clicks "Return to Draft" (cancel)
  └─ handleReturnToDraft() → restores currentDraftBackup, clears viewingRevisionVersion

User clicks "Commit Restore to Draft" (confirm)
  └─ handleCommitRestore() runs
       ├─ Parses version number of the restored entry (e.g. v0.1 → draftVersion = "v0.1 (draft)")
       ├─ Sets version = draftVersion, status = 'DRAFT', isLocked = false
       └─ Clears currentDraftBackup and viewingRevisionVersion
            Note: this also does NOT auto-save to DB
```

### Flow G: Delete a Version

```
While viewing a past revision (viewingRevisionVersion is set):
User clicks "Delete Version"
  └─ handleDeleteVersion() runs
       ├─ DELETE /api/forms/:formId?version=v0.1
       ├─ Removes entry from local revisionHistory[]
       └─ Restores currentDraftBackup if available

While on the active Draft:
User clicks "Delete Draft"
  └─ handleDeleteActiveDraft() runs
       ├─ DELETE /api/forms/:formId?version=currentVersion
       └─ Calls onClose() → modal unmounts
```

### Flow H: Print Blank Form

```
User clicks "Print Preview" in the top action bar
  └─ setPrintPreviewData({ formId, formTitle, version, status, layoutBlocks, revisionHistory })
       └─ FormBuilder render returns <PrintBlankForm template={...} onClose={...} />
            ├─ Mounted via ReactDOM.createPortal into document.body
            ├─ If TITLE block has a logo stored as "uploads/..." key:
            │    GET /api/storage/download-url?key=...  → resolves to pre-signed R2 URL
            └─ User triggers browser print dialog (window.print())
                 onClose → setPrintPreviewData(null) → FormBuilder canvas re-renders
```

---

## 6. Module Interface (Boundary Contracts)

### 6.1 Props Accepted from ProcessEditor

**FormBuilder** — see `interface FormBuilderProps` in [`src/components/FormBuilder.tsx`](src/components/FormBuilder.tsx)

> **⚠️ Key architectural fact:** The `formName` prop is always identical to the `formId` string (e.g. `"3S-QC/F1.1"`). The prop is named `formName` for historical reasons but its value is always a `formId`. Do NOT assume `formName` is a human-readable label.

| Prop | Type | Description |
|---|---|---|
| `formName` | `string` | The `formId` of the form to edit (e.g. `"FM-QC-F01"`). **Always equals `formId`.** Used as fallback to initialize `formId` state if `initialData.formId` is absent. |
| `initialData` | `object` (optional) | Seed data — overridden immediately on mount by a live DB fetch if `initialData.formId` is set. See note below. |
| `initialData.formId` | `string` | Triggers the DB fetch on mount |
| `initialData.formTitle` | `string` | Initial display name |
| `initialData.version` | `string` | Initial version string |
| `initialData.status` | `'DRAFT' \| 'ACTIVE' \| 'ARCHIVED'` | Determines initial `isLocked` state |
| `initialData.layoutBlocks` | `LayoutBlockISO[]` | Initial block layout (overridden by DB fetch) |
| `initialData.revisionHistory` | `FormRevisionEntry[]` | Initial history (overridden by DB fetch) |
| `onSave` | `(data: any) => void` | Called after Save Draft or Publish. Receives `{ formId, formTitle, version, status, layoutBlocks, revisionHistory }`. ProcessEditor uses this to update `workflowFormsData` and silently re-save the process. |
| `onClose` | `() => void` | Called to unmount the modal. Called by Discard, Delete Draft, and after Save Draft completes. |
| `linkedProcessId` | `string \| undefined` | *(Added 2026-07-14)* If provided, the Form ID input is locked. Displays a link icon; user must click to unlink before editing Form ID. |
| `onUnlinkFromProcess` | `() => Promise<boolean>` | *(Added 2026-07-14)* When user confirms unlink dialog: ProcessEditor removes the form from steps + workflowFormsData + auto-saves process. Returns `true` on success. FormBuilder **stays open** in standalone mode after successful unlink. |

> **Note on `initialData` vs DB fetch:** `initialData` is used only as the initial React state seed. On mount, a `useEffect` fires and immediately overwrites state from `GET /api/forms/:formId` and `GET /api/forms/:formId/history`. This means `initialData` only matters for the brief loading window before the DB response arrives.

### 6.2 What `onSave` Returns to ProcessEditor

```typescript
{
  formId: string;
  formTitle: string;
  version: string;         // e.g. "v1.2 (2026-07-01)" or "v1.3 (draft)"
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  layoutBlocks: LayoutBlockISO[];
  revisionHistory: FormRevisionEntry[];
}
```

ProcessEditor stores only `{ formId, formTitle, version, status }` in `workflowFormsData` (the layout and history live in the `forms` DB table, not inside the process record).

### 6.3 Props Accepted by PrintBlankForm

**PrintBlankForm** — see `interface PrintBlankFormProps` in [`src/components/print/PrintBlankForm.tsx`](src/components/print/PrintBlankForm.tsx)

| Prop | Type | Description |
|---|---|---|
| `template` | `FormTemplateISO` | The complete form snapshot to render |
| `onClose` | `() => void` | Called when user dismisses the print view; triggers `setPrintPreviewData(null)` in FormBuilder |

### 6.4 PrintBlankForm layout invariants

The portal root carries `className="print-container print-doc"`. `.print-doc` is what activates the
shared print spacing scale in `print.css` and the `.print-doc` table exclusion — dropping it silently
reverts both. See [`DESIGN_UI_UX.md`](DESIGN_UI_UX.md) §4.2 and §4.3.

- **Block spacing is not this component's concern.** Every block is wrapped in `.print-block`, and the
  gap between blocks comes solely from `.print-block + .print-block`. No block wrapper may declare its
  own outer margin; an inline margin beats the selector. `SECTION_LABEL` wrappers add
  `.print-block--section` so CSS, not the component, picks the wider section gap.
- **INFO_GRID renders row-major**, as a `.print-info-grid` CSS grid with
  `gridTemplateColumns: repeat(block.columns, 1fr)` — the same shape the FormBuilder canvas uses. It
  previously split fields into per-column flex stacks via `cols[idx % block.columns]`, which printed
  field 2 at row 2 left instead of row 1 right, and let a tall field skew only its own column.
- **Subtables span the full grid** via `.print-field-full` (`grid-column: 1 / -1`). The old
  `gridColumn: span N` was inert because the parent was flex, not grid.
- Handwriting slots use `minHeight: var(--pw-line-h)` rather than a literal `22px`.

### 6.4 API Endpoints Consumed

All calls are inline `fetch()` within `FormBuilder.tsx` and `PrintBlankForm.tsx`.

| Method | Endpoint | Used By | Purpose |
|---|---|---|---|
| `GET` | `/api/forms/:formId` | FormBuilder (mount) | Load the current form record from DB |
| `GET` | `/api/forms/:formId?version=v0.1` | FormBuilder | Check if a specific version already exists before save/publish |
| `GET` | `/api/forms/:formId/history` | FormBuilder (mount) | Load the full merged revision timeline |
| `POST` | `/api/forms` | FormBuilder (`saveFormToBackend`) | Upsert a form template (save draft or publish) |
| `POST` | `/api/forms/:formId/activate` | FormBuilder | Transition a DRAFT version to ACTIVE |
| `POST` | `/api/forms/:formId/archive` | FormBuilder | Transition an ACTIVE version to ARCHIVED |
| `DELETE` | `/api/forms/:formId?version=v0.1` | FormBuilder | Delete a specific version record |
| `GET` | `/api/storage/logos` | FormBuilder (on mount + after logo change) | Fetch the list of previously uploaded logos from R2 |
| `DELETE` | `/api/storage/logos` | FormBuilder | Delete an unused logo from R2 |
| `POST` | `/api/storage/presign-upload` | FormBuilder | Get a pre-signed R2 URL for logo upload |
| `PUT` | `(presigned R2 URL)` | FormBuilder | Direct upload of logo image to Cloudflare R2 |
| `GET` | `/api/storage/download-url?key=...` | FormBuilder, PrintBlankForm | Resolve an R2 object key to a temporary pre-signed download URL (for logo display and print) |
| `GET` | `/api/processes` | FormBuilder (lazy, on Copy Modal open) | Fetch all processes to populate the "Copy Block from another form" picker |

---

## 7. Known Design Constraints & Technical Debt

| Issue | Impact | Notes |
|---|---|---|
| **FormBuilder is a monolith** | Single file with no sub-component isolation — the largest file in the codebase by a wide margin | Left panel, center canvas, right panel, all block renderers, all field renderers, all handlers are co-located |
| **No independent page route** | FormBuilder cannot be accessed standalone | Always launched via `activeFormToBuild` state in ProcessEditor; no deep-linking |
| **`initialData` is a red herring** | Causes a visual flash (prop state → DB fetch override) | Props are used only as the initial seed; DB response overwrites them immediately on mount. A future improvement would be to load directly from DB and skip the `initialData` prop entirely |
| **`isLocked` is UI-only** | Server does not enforce lock | ACTIVE forms can technically be mutated via direct API calls; only the UI guards prevent editing |
| **Author hardcoded** | Revision history `author` field is always `"QA Administrator"` | Should read from `currentUser.full_name` via `AuthContext` |
| **Logo management mixed in** | Logo upload/gallery/delete is embedded in FormBuilder | Should be a separate `AssetManager` component |
| **`handleCreateNewVersion` doesn't save to DB** | User must manually Save Draft after creating a new version | This is an invisible action; if the user closes without saving, the new version is lost |
| **`window.alert()` and `window.confirm()` used throughout** | Blocking browser dialogs disrupt UX | FormBuilder uses native dialogs extensively for error feedback and confirmations |
| **Copy Block fetches all processes** | `GET /api/processes` loads the entire process list every time the copy modal opens | Should be paginated or lazy-loaded |
| **`formName` prop = `formId` value** | Misleading naming causes confusion | `formName` prop passed from ProcessEditor is always the `formId` string, not a display name. Legacy naming artifact. |
| **No intrinsic process context** | FormBuilder has no way to know on its own if a form is linked to a process | Relies on `linkedProcessId` prop being passed from ProcessEditor. Without it (e.g. standalone launch), no lock is shown. |

---

## 8. Change Log

Architectural changes only — schema, interface contracts, invariants, and new block
types. UI polish and styling tweaks live in `git log`; run `git show <sha>` for the
full diff of any entry below.

| Date | Commit | Change |
|---|---|---|
| 2026-08-17 | `237f540` | **TABLE `<colgroup>` & `<col>` Dynamic Width Enforcement:** Added `<colgroup>` with dynamic `<col style={{ width }} />` across `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, `FormBuilder.tsx`, `FormFiller.tsx`, and `ProcessReader.tsx`. Prevents browser content-heuristic drift and aligns table columns 100% identically between tables with and without group headers. |
| 2026-08-17 | `76f1765` | **INFO_GRID Photo Field `rowSpan` Print Parity:** (1) Added `grid-auto-rows: minmax(var(--pw-line-h), auto)` to `.print-info-grid` in `print.css`. (2) Ensured robust integer parsing `Number(f.rowSpan)` and `gridRow: span ${rSpan}` across all renderers. (3) Removed `height: 100%` on outer item and applied `alignSelf: stretch` with `flex: 1` inner dashed box so multi-row photo field spans all configured rows without premature truncation. |
| 2026-08-17 | `cc106a7` | **Fillable PDF Export Unified Table Borders:** (1) Updated `domScanner.ts` to integer `targetWidthPx = 698` (snapping subpixel canvas rounding). (2) Applied `.exporting-pdf-mode` table rules in `index.css`: `border: 1px solid #000000 !important`, `border-collapse: collapse !important`, `border-spacing: 0 !important` on table, th, td. (3) Hidden invisible anchor rows (`tr[aria-hidden="true"] { display: none !important }`) in PDF mode to eliminate disjointed cell gaps. |
| 2026-08-18 | `62e77f9` | **Content-Driven Label/Text Cells & Column Type Simplification:** (1) Removed `static_text` ("Nhãn") option from column type dropdowns in `FormBuilder.tsx`. (2) In Canvas, text cells render an inline input with `placeholder="[Nhập chữ]"`; typing content marks the cell as a static template label, while clearing it returns the cell to an open input. (3) Propagated 1:1 to `FormFiller.tsx`, `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, `PrintRecord.tsx`, and `ProcessReader.tsx`. |
| 2026-08-20 | `89323fc` | **WYSIWYG Multi-Line Auto-Wrapping Table Cells & Group Headers:** (1) Replaced single-line `<input>` and fixed `height: 28px` with zero-lag CSS Grid Auto-Grow Textarea mirror in `FormBuilder.tsx` table cells and group headers. (2) Text wraps reactively at column boundaries and supports manual `Enter` linebreaks, naturally expanding row height without horizontal scrollbars. (3) Added `white-space: pre-wrap; word-break: break-word;` across all print and form renderers. |
| 2026-08-20 | `985ddfa` | **WYSIWYG Inline Field Label & Type Selector (INFO_GRID):** (1) Replaced static label text in `INFO_GRID` field cards with an inline editable `<input>` wired directly to `handleUpdateField`. (2) Replaced static `[type]` badge with an interactive inline `<select>` supporting all 9 field types wired to `handleChangeFieldType`. Enables direct on-canvas renaming and type switching without opening the right panel. |
| 2026-08-20 | `599e260` | **Static Non-Input 'label' Field Type (INFO_GRID):** (1) Added `'label'` field type to `FormFieldISO`. (2) In `FormBuilder.tsx`, available via Canvas and Inspector dropdowns. (3) In `FormFiller.tsx` and `ProcessReader.tsx`, renders as pure static text with no input control. (4) In `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, and `PrintRecord.tsx`, prints clean label text without dotted underlines or AcroForm widgets. |
| 2026-08-20 | `b431f46` | **WYSIWYG Auto-Grow Multi-Line Wrapping for INFO_GRID Labels:** (1) Replaced single-line `<input>` for `f.checkItem` in `INFO_GRID` canvas cards with CSS Grid Auto-Grow Textarea mirror. (2) Labels wrap dynamically at column borders and support `Enter` linebreaks without horizontal clipping, naturally expanding card height. (3) Pinned move buttons and type selector to top-right with `alignItems: flex-start`. |
| 2026-08-21 | `509fb8a` | **WYSIWYG Inline Editable Column Titles (TABLE Block):** (1) Replaced static text in `<th>` of `TABLE` canvas header with CSS Grid Auto-Grow Textarea mirror. (2) Users can click and type column titles directly on the canvas. (3) Multi-line wrapping and manual `Enter` linebreaks automatically expand header row height. (4) Bidirectionally synchronized with `handleUpdateTableColumn` and Right Inspector Panel. |
| 2026-08-21 | `cf9a986` | **Rating Scale Field Type (INFO_GRID & TABLE):** (1) Added `'rating'` type and `ratingScale?: 3 | 5` to `FormFieldISO`, `TableColumnConfig`, and `SubtableColumn` in `src/types.ts`. (2) In `FormBuilder.tsx`, added rating selector on Canvas and Scale 5/3 toggle in Inspector. (3) In `FormFiller.tsx` & `ProcessReader.tsx`, implemented interactive star scoring (click to rate, re-click to clear, numerical score badge). (4) In `PrintBlankForm.tsx`, rendered hollow stars `☆☆☆☆☆` with AcroForm attributes. (5) In `PrintFilledForm.tsx` & `PrintRecord.tsx`, printed filled stars `★★★☆☆` and score `X/Y`. |
| 2026-08-21 | `a3f2533` | **Rating Scale AcroForm PDFRadioGroup & Vector Star Parity:** (1) Removed `.acro-option-icon` class to eliminate square box artifact around rating stars. (2) Replaced unicode stars with vector `<Star />` from `lucide-react` across `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, and `PrintRecord.tsx`. (3) Added `'rating'` to `ScannedAcroField['fieldType']` in `src/utils/pdf/types.ts` and scanned `radioGroup` / `radioValue` in `domScanner.ts`. (4) Implemented `PDFRadioGroup` overlay in `acroFormOverlay.ts`, enabling 1-of-N interactive rating choice on fillable PDF exports. |
| 2026-08-25 | `4b1b0a4` | **Likert Scale Column Type & Borderless/Horizontal Table Style:** (1) Added `'likert_scale'` type and `scaleOptions?: string[]` to `TableColumnConfig` in `src/types.ts`. (2) Added `borderStyle?: 'grid' | 'borderless' | 'horizontal_only'` to `LayoutBlockISO`. (3) Added compact 3-icon button group (`[Grid]`, `[Horizontal]`, `[Borderless]`) under `Border Style` in `FormBuilder.tsx` Section Settings. (4) Added dynamic `scaleOptions` list editor in Column Inspector. (5) In Canvas, Filler, Reader, and Print templates (`PrintBlankForm`, `PrintFilledForm`, `PrintRecord`), rendered multi-level Likert scale headers with CSS grid and single-choice radio circles per row. (6) Added `.print-table--borderless` and `.print-table--horizontal` CSS rules in `src/index.css` for WYSIWYG, print, and PDF export parity. |
| 2026-08-25 | `bd156ba` | **Contextual Block Insertion (Insert After Active Block):** Updated `handleAddBlock` and `handleExecuteCopy` in `FormBuilder.tsx`. When a block is currently selected (`activeBlockId`), newly added or copied blocks are inserted at `activeIdx + 1` (immediately following the active block), rather than unconditionally appending to the end of the canvas. |
| 2026-08-25 | `a18181b` | **Table Block Border Styles Parity & Bottom Row Border Fix:** Standardized `table`, `th`, and `td` border definitions across `FormBuilder.tsx`, `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, and `PrintRecord.tsx`. Fixed missing bottom line on the last row and normalized top border and row borders for `horizontal_only` and `borderless` styles. |
| 2026-08-25 | `755edc5` | **1-Click Layout Block Cloning (Duplicate Block):** (1) Implemented `handleCloneBlock` in `FormBuilder.tsx` with deep-cloning routine (regenerating unique field IDs, table row IDs, remapping tableData and cellOptionsMap, cloning matrixConfig). (2) Added quick-action duplicate icon `<Copy size={10} />` to canvas block headers and Section Settings header. (3) Added dedicated `[Nhân bản khối này]` action button in Right Inspector Panel. (4) Added `Ctrl+D` / `Cmd+D` keyboard shortcut with focus detection. (5) Auto-activates and contextually splices cloned block immediately after source block (`sourceIdx + 1`). |


