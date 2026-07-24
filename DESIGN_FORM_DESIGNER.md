# Form Designer — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Form Designer |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Last Verified Against Codebase** | 2026-07-24 |
| **Verified By Session** | [9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) |

> **⚠️ Session Note (2026-07-14):** Deep codebase research confirmed FormBuilder has no awareness of which process it belongs to. `formName` prop is always identical to `formId`. New `linkedProcessId` and `onUnlinkFromProcess` props added — see Section 6.1 and Technical Debt table.

### Quick File Index

| File | Role | Size |
|---|---|---|
| [`src/components/FormBuilder.tsx`](src/components/FormBuilder.tsx) | Primary authoring UI — block canvas + field editor + version management | 3,443 lines |
| [`src/components/print/PrintBlankForm.tsx`](src/components/print/PrintBlankForm.tsx) | Blank form print renderer (React Portal) | 561 lines |
| [`src/types.ts`](src/types.ts) | Shared types: `FormTemplateISO`, `LayoutBlockISO`, `FormFieldISO`, `FormRevisionEntry`, `MatrixConfigISO`, `TableColumnConfig` | lines 87–162 |

> **Update rule:** Whenever any of the above files is modified in a session, update
> the "Last Verified" date and add an entry to the [Change Log](#9-change-log) at the
> bottom of this document.

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
| **Block type buttons** | Add TITLE, INFO_GRID, CHECKLIST_TABLE, MATRIX_TABLE, TABLE, SIGN, SECTION_LABEL blocks |
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

### Top-level: `FormTemplateISO` (lines 155–162)

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

### Layout Block: `LayoutBlockISO` (lines 135–153)

```typescript
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
| `CHECKLIST_TABLE` | Columnar check items with target and reaction | Yes (all types) |
| `MATRIX_TABLE` | Tally count matrix (rows × product columns) | No — matrix config only |
| `TABLE` | Freeform dynamic table (configurable columns + rows) | No — table config only |
| `SIGN` | Signature/approval block | Yes (signature type) |
| `SECTION_LABEL` | Visual separator with heading and description text | No |

### Field: `FormFieldISO` (lines 87–100)

```typescript
interface FormFieldISO {
  id: string;
  type: 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature' | 'photo';
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

### Revision History: `FormRevisionEntry` (lines 102–108)

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

**FormBuilder** (`src/components/FormBuilder.tsx`, line 28–41)

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

**PrintBlankForm** (`src/components/print/PrintBlankForm.tsx`, line 6–9)

| Prop | Type | Description |
|---|---|---|
| `template` | `FormTemplateISO` | The complete form snapshot to render |
| `onClose` | `() => void` | Called when user dismisses the print view; triggers `setPrintPreviewData(null)` in FormBuilder |

### 6.4 API Endpoints Consumed

All calls are inline `fetch()` within `FormBuilder.tsx` and `PrintBlankForm.tsx`.

| Method | Endpoint | Used By | Purpose |
|---|---|---|---|
| `GET` | `/api/forms/:formId` | FormBuilder (mount) | Load the current form record from DB |
| `GET` | `/api/forms/:formId?version=v0.1` | FormBuilder | Check if a specific version already exists before save/publish |
| `GET` | `/api/forms/:formId/history` | FormBuilder (mount) | Load the full merged revision timeline |
| `POST` | `/api/forms` | FormBuilder (`saveFormToBackend`) | Upsert a form template (save draft or publish) |
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
| **FormBuilder is a monolith** | 3,443-line single file with no sub-component isolation | Left panel, center canvas, right panel, all block renderers, all field renderers, all handlers are co-located |
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

| Date | Session / Conversation | Change |
|---|---|---|
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Document created. Initial full write based on codebase review. |
| 2026-07-10 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Standardize form version strings in FormBuilder, server.cjs, and types.ts. Extract version date into a separate effectiveDate field and clean up legacy formatting regexes. |
| 2026-07-13 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Remove trailing colon (":") from field labels in INFO_GRID blocks if the label is blank. Affects FormBuilder.tsx and PrintBlankForm.tsx. |
| 2026-07-13 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Fix logo race condition in PrintBlankForm.tsx by adding logoReady state guard to print dialog initialization. |
| 2026-07-13 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Fix logo print blank on slow machines by using img onLoad/onError listeners to ensure image bytes are loaded before printing. |
| 2026-07-14 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Link formTitle state and TITLE block title field in FormBuilder (bidirectional sync). |
| 2026-07-14 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Implement multi-option checkbox table columns in FormBuilder and PrintBlankForm.tsx with options editor and stacked layout preview/print. |
| 2026-07-14 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Add support for 1-column vs 2-column checkbox layout (icon button group) and customizable footer summary rows on number columns (Auto Sum, Manual, Percentage, Sum Rows) in FormBuilder.tsx and PrintBlankForm.tsx. |
| 2026-07-14 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Fix tfoot border rendering (precise borderTop/borderBottom styling) and remove whiteSpace: 'nowrap' to prevent checkbox label clipping in PrintBlankForm.tsx. |
| 2026-07-14 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Deep codebase research: Document that `formName` prop always equals `formId`. Clarify FormBuilder has no intrinsic process context. Add new props `linkedProcessId` and `onUnlinkFromProcess`. Update Section 6.1 interface contract and Technical Debt table. |
| 2026-07-20 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Bug fix (critical):** `isLogoKeyUsed()` in `server.cjs` rewrote to query `forms.layout_blocks` (the authoritative table) instead of `processes.workflowFormsData` (which never contains `layoutBlocks`). The old implementation always returned `false`, causing every logo to be deleted from R2 on the next process save. Fixed by using `SELECT COUNT(*) FROM forms WHERE layout_blocks::text LIKE '%' || $1 || '%'`. |
| 2026-07-20 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Bug fix:** `handleLogoUpload()` in `FormBuilder.tsx` now calls `saveFormToBackend({ layoutBlocksOverride })` immediately after a successful R2 upload, persisting the logo R2 key to `forms.layout_blocks` in DB before any cleanup routine can run. Added `layoutBlocksOverride` option to `saveFormToBackend` signature to bypass React state batching. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Retire Check Frequency:** Retire Check Frequency ("frequency") property from FormBuilder field inspector panel and default field creation. Update FormFieldISO and FormField interfaces in types.ts to make frequency optional for backward compatibility. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Upgrade Section Label block:** Add H1 (full-width bottom line accent) vs H2 (left bar box accent) format selector. Rename description label to "Description" in FormBuilder sidebar and set default description to blank ("") for newly created blocks. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Complete Colon Removal & Radio Group Layout Upgrade:** Remove all hardcoded trailing colons (`:`) across FormBuilder, FormFiller, ProcessReader, PrintBlankForm, and PrintRecord via `sanitizeLabel()` helper (`label.replace(/:+$/, '')`). Upgrade Radio/Checkbox group layout to Picture 2 format: top dedicated title row without colons, and flex-wrapped stacked option pills below. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Space Optimization & Font Weight Consistency:** Tighten excessive padding/margins between Section H1 lines and Info Grid fields (from >30px down to ~8px), tighten field row gaps (from 8px to 5px), tighten radio label gap (from 4px+2px to 2px), and unify radio title font weight to `fontWeight: 600` matching regular text field labels. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Universal Block Title Format Selector:** Add `titleFormat?: 'H1' | 'H2' | 'BODY' | 'NONE'` to `LayoutBlockISO`. Add 4-button segmented pill selector (`[H1] [H2] [Body] [None]`) to FormBuilder sidebar inspector for all block types. `SECTION_LABEL` defaults to `H1`, while all content blocks default to non-bold `BODY` text (`fontWeight: 400`). Implemented across FormBuilder, FormFiller, ProcessReader, PrintBlankForm, and PrintRecord. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Shorten Table Column Type Selector Options:** Rename "Nhãn tĩnh" ➔ "Nhãn", "Chữ nhập" ➔ "Chữ", "Số nhập" ➔ "Số" in FormBuilder table config inspector selector. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Fix Block Title Print Formatting:** Support `titleFormat` options (`H1`, `H2`, `BODY`, `NONE`) for all remaining block types (`CHECKLIST_TABLE`, `TABLE`, `MATRIX_TABLE`, `SIGN`) in `PrintBlankForm.tsx` and `PrintRecord.tsx` to match canvas layout print previews exactly. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Standardize Block Spacing in Print Templates:** Standardize block separation by removing ad-hoc block-level inline `marginTop` styles and replacing them with a unified `.print-block` margin-bottom of `24px` in stylesheet of `PrintBlankForm.tsx` and `PrintRecord.tsx`. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Standardize Font Family in Print Templates:** Set `fontFamily` of print container portal to `'Be Vietnam Pro'` in `PrintBlankForm.tsx` and `PrintRecord.tsx` to preserve brand typography on PDF and physical print outputs. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Refine Print Spacing & Normalize Table Header Font Weight:** Adjusted `.print-block` margin-bottom from `24px` to `16px` to resolve excessive gap between INFO_GRID and TABLE blocks. Standardized all table `<th>` headers to `fontWeight: 600` (semi-bold) in `PrintBlankForm.tsx` and `PrintRecord.tsx` for visual consistency with field labels. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Form 3S-FA-01 Visual Consistency Fixes:** (1) Elevated BODY format block title font weight from `400` → `600` across FormBuilder, FormFiller, ProcessReader, PrintBlankForm, and PrintRecord to eliminate hierarchy inversion. (2) Upgraded handwriting slots in PrintBlankForm to `1.5px dotted #94a3b8` lines. (3) Harmonized INFO_GRID row gap to `8px` matching table row density. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Refine Blank Form Handwriting Lines:** Changed dotted lines `borderBottom: '1.5px dotted #94a3b8'` to thin light grey lines `1px solid #e2e8f0` in `PrintBlankForm.tsx` to match the record print style. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Upgrade CHECKLIST_TABLE Column Editor:** Migrated CHECKLIST_TABLE from fixed `columnLabels` system to dynamic `tableColumns: TableColumnConfig[]` (same as TABLE block). Added `locked?: boolean` to `TableColumnConfig`. New inspector panel reuses TABLE column editor handlers (`handleAddColumn`, `handleUpdateTableColumn`, `handleMoveColumn`, `handleDeleteColumn`); STT and Item columns show 🔒 badge and are protected from deletion/type change. Default columns: STT (static_text, locked), Chi tiết kiểm tra (static_text, locked), Đạt/Không Đạt (radio with Đ/KĐ options), Mô tả (text). Full backward compatibility via `getChecklistColumns()` helper that falls back to `columnLabels` for existing saved forms. Updated `FormBuilder.tsx`, `PrintBlankForm.tsx`, `PrintRecord.tsx`. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Upgrade TITLE Block with "Ngày" Date Slot:** Added optional `showDate?: boolean` and `datePosition?: 'A' | 'B'` to `LayoutBlockISO`. FormBuilder inspector features a minimal toggle switch + icon selector (`AlignRight` for inline right position A, `AlignCenter` for centered below description position B). FormFiller provides a date picker (`__title_date__` saved into submission snapshots). PrintBlankForm renders handwriting slot `Ngày ___________`. PrintRecord displays the entered date value (or submission timestamp fallback). |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Preserve SIGN Block Column Layout in Print:** Modified `PrintBlankForm.tsx` to keep blank sign-off fields in the DOM but hide them visually with `visibility: 'hidden'` instead of filtering them out. This prevents the column count from collapsing and ensures filled columns stay aligned in their designed grid positions (e.g. left column) rather than stretching full-width and centering. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Refine Date Handwriting Layout in TITLE Block:** Replaced solid underscore border with dynamic slash `/` separators (`   /   /    `) for handwriting date slot in `PrintBlankForm.tsx` and `FormBuilder.tsx` canvas preview to provide a more standard physical form appearance. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Standardize PDF Naming according to Digital 5S Rules:** Set `document.title` on mount in print templates to guide the default browser suggested PDF filenames. Created `to5SFileName` helper in `formUtils.ts` to strip diacritics, strip special characters, and normalize spaces to underscores. Blank forms use `FORM_[Normalized_Form_Title]`. Filled records fetch `formTitle` and format as `REC_[YYYYMMDD]_[Normalized_Form_Title]` for perfect chronological sorting. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Add Field and Row Reordering on Canvas:** (1) Enabled field rearranging inside INFO_GRID and SIGN blocks via inline ArrowUp/ArrowDown buttons that display when a field is selected in the canvas. (2) Enabled row rearranging inside TABLE blocks via hover ArrowUp/ArrowDown buttons next to the row delete icon. (3) Added `handleMoveRow` with 5S automation that auto-renumbers the first STT static column sequentially (1, 2, 3...) when rows are swapped. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Align Canvas Block Gap with Print Styles:** Changed the center canvas block wrapper's vertical gap spacing from `1.5rem` (`24px`) to `1rem` (`16px`) in `FormBuilder.tsx` to match the exact print block spacing layout (`margin-bottom: 16px`), providing an accurate WYSIWYG preview. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Checklist Table Upgrade (STT Toggle, Percentage-Based Widths, 6-Column Layout):** Added `hidden?: boolean` to `TableColumnConfig`. Exposed Eye/EyeOff toggle buttons on locked columns in the Column Settings editor to control visibility. Replaced px widths with percentage-based widths for 5S-optimized default columns (STT, Tiêu chí, Đơn vị, Tiêu chuẩn, Kết quả, Ghi chú). Refactored all rendering loops to map dynamically by `col.id`. Updated `FormBuilder.tsx`, `PrintBlankForm.tsx`, `PrintRecord.tsx`, `FormFiller.tsx`, and `types.ts`. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Form Visual Synchronization (Flat TITLE Block) & Duplicate Table Title Fix:** Flattened TITLE block container in FormFiller.tsx and ProcessReader.tsx by removing boxed border, background, and padding. Centered main form header and added `textTransform: 'uppercase'` to match printout styles. Skipped card title duplicate header rendering for TITLE block. Removed duplicate inner `{block.title}` text rendering from dynamic TABLE block component in FormFiller.tsx and ProcessReader.tsx. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Checkbox Group & Option Preservation:** Added Checkbox Group (Hộp kiểm) to the field type options in FormBuilder.tsx. Upgraded type change handlers (`handleChangeFieldType` and column type select `onChange`) to preserve previously configured options in the data model (hiding them from the UI instead of deleting them). Enabled multi-select checkbox group controls rendering and comma-separated value splitting/validation in FormFiller.tsx, ProcessReader.tsx, and PrintRecord.tsx. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Paper-like Flat Form Layout (Fillable PDF Style):** Removed individual card borders, backgrounds, shadows, and padding from blocks in FormFiller.tsx and ProcessReader.tsx. Styled text, number, date, and time inputs inside INFO_GRID to render as flat rectangles with light grey backgrounds (`#f8fafc`) and thin borders (`1px solid #e2e8f0`) to mimic digital fillable PDF fields. Flattened dynamic table and matrix table container wrappers (removed outer border-radius and borders) to match printed grid sheets. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Remove Table Input Placeholder Guidance:** Removed the confusing and cluttered placeholder attributes (`placeholder="Nhập chữ..."` and `placeholder="Nhập số..."`) from dynamic table cells in FormFiller.tsx and ProcessReader.tsx for a cleaner, paper-like look. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Table Inputs Soft Highlighting & Standardized Alignments:** Updated dynamic table cell input controls in FormFiller.tsx and ProcessReader.tsx to use a soft background color (`#f8fafc`) and thin borders (`1px solid #e2e8f0`) to visually guide users to fillable elements. Standardized input text alignments by type (Left for text, Right for numbers, Center for date/time) while maintaining configured configurations on table headers. |
| 2026-07-23 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Form Designer Preview Alignment Synchronization:** Updated dynamic table cell placeholders (`[Nhập chữ]`, `[Nhập số]`, `[Ngày]`, `[Giờ]`) inside the Form Designer authoring canvas in FormBuilder.tsx to follow the same standardized data type alignments as the live form (Left for text, Right for numbers, Center for date/time) to ensure a true WYSIWYG experience. |
| 2026-07-24 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Form Designer Sidebar Toolbox Sync:** Added the missing Checkbox button to the toolbox under "2. Field Elements" in FormBuilder.tsx and mapped it to handleAddField. Simplified all element labels to match the new type names (Text, Number, Radio, Checkbox, Date, Time, Photo, Sign-off) and reordered them logically based on frequency of use. Updated handleAddField signature and options initialization logic to support the new `'checkbox'` type. |








