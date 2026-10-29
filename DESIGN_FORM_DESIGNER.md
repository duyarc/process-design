# Form Designer — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Form Designer |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Verified At Commit** | (2026-10-29) — FormBuilder TITLE block formCode sync & sessionStorage oldFormId purge verified against source |

> **⚠️ Architectural note:** FormBuilder has no awareness of which process it belongs to. The `formName` prop is always identical to `formId`. See Section 6.1 and the Technical Debt table.

### Quick File Index

| [`src/components/FormBuilder.tsx`](src/components/FormBuilder.tsx) | Shell workspace: header bar, left palette, center canvas, right inspector |
| [`src/components/form/InCanvasColSpanToggle.tsx`](src/components/form/InCanvasColSpanToggle.tsx) | Sub-component: in-canvas discrete colSpan toggle pill (`1/2`, `2/2`, `1/3`, `2/3`, `3/3`) |
| [`src/components/form/InCanvasGuidanceEditor.tsx`](src/components/form/InCanvasGuidanceEditor.tsx) | Sub-component: accordion editor for row/block guidance with markdown & preview |
| [`src/components/form/InCanvasImageField.tsx`](src/components/form/InCanvasImageField.tsx) | Sub-component: image field with 3 stretch modes (`full`, `bleed`, `fit`) & presigned upload |
| [`src/components/form/InCanvasLabelField.tsx`](src/components/form/InCanvasLabelField.tsx) | Sub-component: WYSIWYG heading & markdown banner field |
| [`src/components/form/ImageGalleryModal.tsx`](src/components/form/ImageGalleryModal.tsx) | Sub-component: Cloudflare R2 media gallery modal |
| [`src/components/form/MiniMapCanvas.tsx`](src/components/form/MiniMapCanvas.tsx) | Sub-component: pure HTML5 Canvas tile stitcher for Location mini map preview |
| [`src/components/print/PrintBlankForm.tsx`](src/components/print/PrintBlankForm.tsx) | A4 print layout renderer (React Portal) |
| [`src/utils/pdfFormExporter.ts`](src/utils/pdfFormExporter.ts) | Facade API entry point for Fillable PDF export |
| [`src/utils/pdf/types.ts`](src/utils/pdf/types.ts) | Types for PDF export module (`ScannedAcroField`, `PdfPageConfig`) |
| [`src/utils/pdf/textAnchorInjector.ts`](src/utils/pdf/textAnchorInjector.ts) | Helper functions for text anchor tags `{{acro:id:type:w:h}}` |
| [`src/utils/pdf/domScanner.ts`](src/utils/pdf/domScanner.ts) | Scans DOM field annotations at exact A4 width `697.7px` |
| [`src/utils/pdf/backgroundGenerator.ts`](src/utils/pdf/backgroundGenerator.ts) | Generates 300 DPI A4 background PDF via `html2canvas` & `jsPDF` |
| [`src/utils/pdf/acroFormOverlay.ts`](src/utils/pdf/acroFormOverlay.ts) | Overlays interactive AcroForm fields onto PDF pages via `pdf-lib` |
| [`src/utils/pdf/downloadHelper.ts`](src/utils/pdf/downloadHelper.ts) | Browser 5S PDF download helper |
| [`src/types.ts`](src/types.ts) | Shared types: `FormTemplateISO`, `LayoutBlockISO` (`cellPlaceholderMap`), `FormFieldISO`, `FormRevisionEntry`, `MatrixConfigISO`, `TableColumnConfig` (`placeholder`), `SubtableColumn` (`placeholder`), `BlockVisibilityCondition`, `RadioOption` (`isOther?`) (**owning doc** for these types) |

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
- Configure **conditional visibility rules** (`BlockVisibilityCondition`) so blocks appear dynamically based on upstream answers.
- Manage a company logo on the form header.
- **Version** form templates: Draft → Active (published) — with a full revision history that stores a layout snapshot per version.
- **Restore** any past version's layout back into the current draft.
- **Print** a blank form for physical shop-floor use.

### What This Module Does NOT Do
- **Does not have its own page route** — FormBuilder is launched as a fullscreen workspace overlay (`position: fixed; inset: 0`) from inside ProcessEditor or Dashboard.
- **Does not collect or store form submissions** — that is the Form Operations module (`FormFiller.tsx`, `FormManager.tsx`).
- **Does not manage which steps in a process use which form** — that linkage is owned by ProcessEditor via `workflowFormsData`.
- **Does not manage user permissions** — the launch context (ProcessEditor) decides whether to show Edit or View mode.
- **Has no intrinsic knowledge of which process it belongs to** — as of 2026-07-14, `linkedProcessId` is passed as a prop from ProcessEditor. Without this prop, FormBuilder cannot determine if the form is linked to any process (no DB query or context exists inside FormBuilder for this).

---

## 2. User-Facing Features

FormBuilder renders as an edge-to-edge **Fullscreen Studio Workspace** (`position: fixed; inset: 0; zIndex: 1000`) comprising 3 primary zones:

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
| **Conditional Badge (`⚡`)** | Visual indicator on Canvas showing block visibility condition summary (e.g. `Hiện khi "..." = [...]`) |
| **Table Option Cell Footer Actions** | In-cell Checkbox/Radio options render in a clean vertical flow with bottom Footer Action Bar (`[+ Thêm]`, `[🔄 Khôi phục]`), eliminating top-right coordinate collisions with individual option delete buttons (`✕`). |
| **Table Row LineCount Mini Popover Pill** | In-row handwritten line count selector replaced with compact Pill button (`[ 1↕ ]`, 22px) and floating Mini Popover (`[ 1 ]..[ 5 ]`), pairing with a `GripVertical` handle and trash can inside a streamlined **54px** action column (reduced from 88px, saving 34px width). |
| **In-Canvas Title Header & Hidden Style Behavior** | When title format is `NONE`, replaces static notice message with an in-place editable greyed-out `<input>` (placeholder `(Tiêu đề đang ẩn)`, opacity 0.6) with focus state highlight; preserves `extraControls` across all format modes. |
| **In-Canvas Dropdown (Select) Accordion Editor** | When field is selected (`isFieldSelected`), expands an in-place options list under the select box with inline label editing, deletion (`✕`), reorder-safe addition, and `[ ➕ Khác... ]` custom option support with auto-scroll. |
| **Drag to Reorder Options (Canvas & Inspector)** | Reorder options via HTML5 native drag & drop with `GripVertical` handle across select dropdown accordion, radio/checkbox chips, and table in-cell options with list-scoped drag isolation and anchored "Khác" option. |
| **Drag to Reorder Table Rows & Columns (Canvas & Inspector)** | Direct manipulation drag-to-reorder via `GripVertical` handles: (1) Table Rows on Canvas (both regular rows and `isGroupHeader` rows with drop insertion indicators, auto-renumbering STT, and 54px compact action column), (2) Table Columns in Right Inspector (for `TABLE` and `CHECKLIST_TABLE` cards), and (3) Table Column Headers on Canvas (`<th>`) with horizontal insertion indicators. |

### Right Panel — Two Tabs
| Tab | Purpose |
|---|---|
| **Properties** | Displays contextual header (`Table Properties`, `Info Grid Properties`, etc.) with block clone/delete actions. Redundant title format and border controls are eliminated in favor of In-Canvas direct editing. Deep settings (`Cấu hình Cột`, `Columns`, `InfoGridSteppedSplitter`, `⚡ Logic Hiển Thị`) sit immediately at top-1 view. `TITLE` block retains dedicated `Tên Biểu mẫu` input. Edit selected field's label, type, specs, units, radio/dropdown options with drag-to-reorder handles (`GripVertical`) for field options and table column options. |
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
├── FormBuilder.tsx                           Shell: header bar + left palette + center canvas + right inspector
│   │
│   ├── form/InCanvasColSpanToggle.tsx        Sub-component: 1-click cyclic colSpan toggle for INFO_GRID fields
│   ├── form/InCanvasGuidanceEditor.tsx       Sub-component: accordion editor for row/block guidance with Markdown & preview
│   ├── form/InCanvasImageField.tsx           Sub-component: image field with 3 stretch modes (full, bleed, fit) & upload
│   ├── form/InCanvasLabelField.tsx           Sub-component: WYSIWYG text & markdown banner editor
│   ├── form/ImageGalleryModal.tsx            Sub-component: modal gallery for browsing and selecting R2 images
│   ├── form/MiniMapCanvas.tsx                Sub-component: pure Canvas OSM/Esri tile stitcher for Location preview
│   └── PrintBlankForm                        Rendered conditionally as a React Portal for print preview
│
└── print/PrintBlankForm.tsx                  A4 print layout renderer; accepts FormTemplateISO and renders print-safe HTML
```

### Component Responsibilities

- **FormBuilder** (`src/components/FormBuilder.tsx`) — Owns all mutable form state (`formId`, `formTitle`, `version`, `status`, `layoutBlocks`, `revisionHistory`). Coordinates save, publish, version management, logo upload, and block/field editing. Communicates back to ProcessEditor via `onSave` and `onClose` callbacks.
- **In-Canvas Sub-Components** (`src/components/form/` — Rule 4.3 Monolith Guard):
  - `InCanvasColSpanToggle.tsx`: Discrete column span toggle pill (`1/2` ↔ `2/2` or `1/3` ➔ `2/3` ➔ `3/3`).
  - `InCanvasGuidanceEditor.tsx`: Inline markdown editor with formatting tools and live preview for table/field guidance.
  - `InCanvasImageField.tsx`: Image rendering with 3 stretch modes (`full`, `bleed`, `fit`) and presigned upload.
  - `InCanvasLabelField.tsx`: Heading/label field with responsive Markdown rendering.
  - `ImageGalleryModal.tsx`: Media manager modal for selecting/uploading images to Cloudflare R2.
  - `MiniMapCanvas.tsx`: Pure Canvas OpenStreetMap / Esri Satellite tile stitcher with zero iframe dependencies.
- **PrintBlankForm** (`src/components/print/PrintBlankForm.tsx`) — Pure renderer. Takes a `FormTemplateISO` snapshot and renders a full printable A4 document. Mounted via `ReactDOM.createPortal` into `document.body`.

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
export interface BlockVisibilityCondition {
  enabled: boolean;
  sourceType: 'table_row' | 'field';
  triggerBlockId: string;
  triggerRowId?: string;
  triggerColId?: string;
  triggerFieldId?: string;
  operator: 'in' | 'equals' | 'not_equals';
  expectedValues: string[];
}

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
  hideHeader?: boolean;               // TABLE block: omit <thead> row when true (default: false)
  tableColumns?: TableColumnConfig[]; // TABLE block column definitions
  tableRows?: TableRowConfig[];       // TABLE block row definitions
  tableData?: { [rowId: string]: { [colId: string]: string } }; // TABLE static cell values
  visibilityCondition?: BlockVisibilityCondition; // Block-level conditional logic
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
- **INFO_GRID long label wrapping:** When a `text`/`number` field label in `INFO_GRID` exceeds 45 characters or contains a newline (`isLongTextLabel`), `PrintBlankForm` wraps the label with `whiteSpace: 'pre-wrap'` and stacks the handwriting slot vertically (`flexDirection: 'column'`, `width: '100%'`) instead of `whiteSpace: 'nowrap'`, preventing `.print-outer-table` from overflowing A4 width (`794px`) and shrinking browser print scale. Similarly, `OPTION_A` `checkbox`/`radio` fields with `cleanLabel.length > 45` wrap onto the next line instead of forcing single-line `nowrap`.
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
| **Author hardcoded** | RESOLVED | Revision history `author` field now dynamically reads from `currentUser` via `AuthContext` (`full_name` or `username` with fallback to `'Admin'`) |
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

| Date | Change |
|---|---|
| 2026-10-16 | **In-Canvas Column Span Toggle for INFO_GRID & Right Inspector Prune (`FormBuilder`, `InCanvasColSpanToggle`):** (1) Created isolated sub-component `src/components/form/InCanvasColSpanToggle.tsx` (Rule 4.3 Monolith Guard) providing 1-click cyclic column span toggle: `1/2` ↔ `2/2` for 2-column grids; `1/3` ➔ `2/3` ➔ `3/3` ➔ `1/3` for 3-column grids, with adaptive teal `#f0fdfa` highlight when expanded and tooltip guidance. (2) In `FormBuilder.tsx`, integrated the toggle directly into the header row of active fields (`isFieldSelected`) in `INFO_GRID` for standard fields, `InCanvasLabelField`, and `InCanvasImageField`, disappearing completely when unfocused (Subtraction Design Mantra). (3) Pruned legacy, isolated `colSpan` `<select>` dropdown from `photo` inspector panel in Right Inspector, unifying column span control purely on Canvas with zero context switching. |
| 2026-10-26 | **Option Grouping for Checkbox & Radio (`RadioOption`, `FormBuilder`, `formUtils`):** (1) Extended `RadioOption` in `src/types.ts` with `group?: string`. (2) In `src/utils/formUtils.ts`, added pure utility `clusterOptionsByGroup` and updated `getAutoCheckboxLayoutMode` to automatically return `OPTION_C` when options have groups. (3) In `FormBuilder.tsx`, rendered group sub-headers on Canvas and upgraded Right Inspector with group header dividers, inline group `<datalist>` auto-complete suggestions, and `[+ Nhóm mới]` quick creation button. (4) In `FormFiller.tsx`, `ProcessReader.tsx`, `PrintBlankForm.tsx`, and `PrintFilledForm.tsx`, rendered grouped options under clean typography headers with zero layout disruption. |
| 2026-10-26 | **Button Parity, Group Drag-to-Reorder & Folder Icon Pruning (`FormBuilder`, `formUtils`):** (1) Extracted pure utilities `reorderGroupsInOptions` and `reorderOptionWithGroup` in `src/utils/formUtils.ts`. (2) In `FormBuilder.tsx`, unified the 3-button toolbar across Canvas and Right Inspector: `[+ Lựa chọn]`, `[+ Khác...]`, `[+ Nhóm]`, and pruned legacy `Mục "Khác"` Toggle Switch from Right Inspector. (3) Added Grip handle `::` on group headers enabling full-cluster drag-to-reorder, and updated option drag handler to automatically synchronize `group` attribute to target group. (4) Pruned `📂` emoji icon from group headers on Canvas and Inspector, elevating visual hierarchy with clean uppercase typography. |
| 2026-10-26 | **Dedicated Location Field Type (`FormFieldISO`, `FormBuilder`):** (1) Added `'location'` to `FormFieldISO['type']` in `src/types.ts`. (2) In `FormBuilder.tsx`, added `{ value: 'location', label: 'Location', icon: MapPin }` to `FIELD_TYPE_OPTIONS`, updated `FieldTypeDropdownProps`, and dynamically typed `handleChangeFieldType` with `FormFieldISO['type']`. (3) Added in-canvas preview for Location fields displaying placeholder input and mock `[📍 GPS]` badge. (4) Upgraded Right Inspector with placeholder configuration for Location fields. |
| 2026-10-26 | **Inline Group Renaming & Smart Group Assignment (`FormBuilder`):** (1) Replaced static `<span>` group headers on both Canvas and Right Inspector with inline `<input>` (`defaultValue={cluster.groupName}`, `key={cluster.groupName}`), enabling 1-click group renaming that atomically updates all options in the cluster on blur/Enter. (2) Upgraded `[+ Nhóm]` button logic on Canvas and Inspector: if un-grouped options exist (`Điều`, `Dừa`, `Cà phê`), clicking `[+ Nhóm]` immediately groups them into `Nhóm 1` without creating a phantom dummy option; if all options already belong to groups, creates a new group with correctly sequential label `Lựa chọn ${n+1}` (eliminating hardcoded `Lựa chọn 1`). |
| 2026-10-26 | **Empty Group Authoring & Cross-Group Drag-to-Reorder (`FormFieldISO`, `FormBuilder`, `formUtils`):** (1) Added `optionGroups?: string[]` to `FormFieldISO` in `src/types.ts` to persist empty groups independently of options. (2) Upgraded `clusterOptionsByGroup` and `reorderGroupsInOptions` in `src/utils/formUtils.ts` to accept explicit `optionGroups` and return synchronized `{ options, optionGroups }`. (3) In `FormBuilder.tsx`, upgraded `[+ Nhóm]` on Canvas and Right Inspector to cleanly add empty groups to `optionGroups` without generating phantom options ("không tự động thêm lựa chọn mới khi tạo nhóm"). (4) Added `pointerEvents: 'none'` to child `<input>` and `<textarea>` elements during active drag, eliminating event swallowing and enabling smooth cross-group drag-to-reorder on both Canvas and Inspector. (5) Loosened group drag handle to `clusters.length > 1` and enabled dropping dragged options directly onto group headers (including empty groups) with inline `[+]` and `[✕]` buttons. (6) In `FormFiller.tsx` and `ProcessReader.tsx`, filtered empty clusters and eradicated legacy `📂` folder icon. |
| 2026-10-26 | **'Other' Option Bottom-Anchoring & Inspector UI Pruning (`formUtils`, `FormBuilder`, `FormFiller`):** (1) Added pure utility `parseChecklistValues` in `src/utils/formUtils.ts` to cleanly separate comma-delimited checkbox selections without corrupting compound `__other__:<text>` strings containing commas. (2) Upgraded `clusterOptionsByGroup` with 3-tier partitioning: un-grouped regular options (top), named groups with group-scoped other anchored at group bottom, and standalone other anchored at the very end of all options. (3) Pruned redundant `[ Nhóm... ▾]` input and `<datalist>` from option rows in Right Inspector, expanding label input to `flex: 1` and rendering a clean `[Tự do]` badge for free-text options. (4) Unlocked drag-to-reorder for "Khác" options across groups and field boundaries. (5) Integrated `parseChecklistValues` and explicit `optionGroups` across `FormFiller.tsx`, `PrintBlankForm.tsx`, and `PrintFilledForm.tsx`. |
| 2026-10-26 | **Smart Layout Horizontal Wrapping & Indent Parity (`formUtils`, `FormBuilder`, `PrintBlankForm`):** (1) In `src/utils/formUtils.ts`, upgraded `hasLongOptions` to accept field or options cluster, removed hardcoded `options.length > 4` constraint that forced short grouped options into 1 column, and implemented dynamic length checks (> 25 chars, >= 3 options > 14 chars, or total > 100 chars). (2) In `FormBuilder.tsx` and `PrintBlankForm.tsx`, evaluated `isClusterLong` per cluster, enabling short option clusters to wrap horizontally (`flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: 4px 20px`), saving up to 75% vertical page height. (3) Standardized indentation across canvas and blank print with `hasAnyGroups ? '0.4rem' : (isClusterLong ? '1.25rem' : '0.4rem')`, eliminating the 10px zig-zag indentation misalignment for bottom-anchored "Khác" options. |
| 2026-10-26 | **Mini Map Configuration Toggle & Canvas Preview (`FormFieldISO`, `FormBuilder`):** (1) Added `showMiniMap?: boolean` to `FormFieldISO` in `src/types.ts` (default: `true`). (2) In `FormBuilder.tsx` Right Inspector, added a clean minimalist checkbox `[✓] Hiển thị Mini Map` when configuring fields of type `location`. (3) Upgraded Canvas layout for `location` fields to display a mock mini map preview box when `f.showMiniMap !== false`, and collapse to 1 line when disabled. |
| 2026-10-26 | **Satellite Map Layer Configuration (`FormFieldISO`, `FormBuilder`):** (1) Added `mapType?: 'roadmap' \| 'satellite'` to `FormFieldISO` in `src/types.ts` (default: `'roadmap'`). (2) In `FormBuilder.tsx` Right Inspector, added a segmented control `[ 🗺️ Bản đồ \| 🛰️ Vệ tinh ]` to configure the default layer for location fields when `showMiniMap !== false`. (3) Upgraded Canvas preview to display `'🛰️ Ảnh Vệ tinh'` or `'🗺️ Sơ đồ Mini Map'` reflecting the selected `mapType`. |
| 2026-10-26 | **Location rowSpan Configuration & Dense Grid Auto-Placement (`FormBuilder`):** (1) In `FormBuilder.tsx` `handleAddField` and `handleChangeFieldType`, initialized `location` fields with default `rowSpan = 2`, `showMiniMap = true`, and `mapType = 'roadmap'`. (2) In Right Inspector, added `Chiều cao (Số dòng - rowSpan)` dropdown (`2 dòng`, `3 dòng`, `1 dòng`) for `location` fields in `INFO_GRID`. (3) Added `gridAutoFlow: 'row dense'` to `INFO_GRID` canvas container and dynamically sized mini map preview box (`height: f.rowSpan === 3 ? '100px' : '65px'`). |
| 2026-10-26 | **External Add Field Bar & Compact Right Inspector (`FormBuilder`):** (1) In `FormBuilder.tsx`, moved `+ Thêm trường vào khối` outside the CSS Grid container in `INFO_GRID`, placing it as a dedicated dashed bar at the block bottom — completely eliminating absorption by `gridAutoFlow: 'row dense'` into empty field slots. (2) Elevated `Type` dropdown to the top level directly under `ID` and `Label`. (3) Pruned redundant placeholder explanation text. (4) Replaced fragmented 4-tier Mini Map controls with a 2-line compact card integrating `[✓] Hiển thị Mini Map`, `[ 🗺️ Bản đồ | 🛰️ Vệ tinh ]`, and 1-touch segmented pills `[ 2 dòng (85px) ] [ 3 dòng (125px) ] [ 1 dòng ]`, reducing inspector vertical height by ~65px. |
| 2026-10-26 | **Mini Map Auto-Stretch Grid Alignment & Segmented Control Pruning (`FormBuilder`):** (1) In `FormBuilder.tsx`, updated canvas field wrapper for `location` fields with Mini Map to use `alignSelf: 'stretch'` and `height: '100%'`, with preview container set to `flex: 1` and `minHeight: '65px'`. (2) In Right Inspector, pruned hardcoded pixel labels `(85px)` and `(125px)` from the height segmented pills, standardizing them to `[ 2 dòng ] [ 3 dòng ] [ 1 dòng ]` reflecting pure CSS Grid `rowSpan` allocation while height dynamically auto-stretches to match adjacent column content. |
| 2026-10-26 | **Component Map Architecture Modernization (`DESIGN_FORM_DESIGNER`):** Updated Quick File Index and Section 3 Component Map to document all 6 extracted in-canvas sub-components in `src/components/form/` (Monolith Guard Rule 4.3). Pruned legacy entries from Change Log to maintain standard 12-entry depth. |
| 2026-10-27 | **Master Guidance Toggle & Print/PDF Linkage (`FormBuilder`):** (1) In `FormBuilder.tsx`, added `isAllGuidanceExpanded` state and `handleToggleAllGuidance` handler to synchronously expand or collapse all guidance boxes across blocks, fields, and table rows on the Canvas. (2) Integrated independent `[ 💡 Hướng dẫn ]` toggle button on the Top Action Bar with standard token `#f0fdfa` / `#0d9488` when active and dot indicator. (3) Kept `PDF` and `Print` buttons 100% visually standard, while seamlessly linking their output via `includeGuidance={isAllGuidanceExpanded}` in `PrintBlankForm`. |
| 2026-10-29 | **FormID Rename In-Canvas TITLE Block Sync & Cache Purge (`FormBuilder`):** (1) In `FormBuilder.tsx`, upgraded `saveFormToBackend` to automatically synchronize `formCode` and `formTitle` inside any `TITLE` block whenever saving, eliminating stale form code headers on print/preview. (2) Added active filtering of `oldFormId` from `swr_forms` in `sessionStorage` during rename, preventing ghost/shadow form entries in linkage dropdowns. |
