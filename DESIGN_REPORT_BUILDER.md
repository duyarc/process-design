# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 1.0 |
| **Verified At Commit** | (2026-08-27) — Sections 1 to 4 checked against source code (Top Toolbar FormBuilder Parity & Standardized Report Print Engine) |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/ReportBuilder.tsx`](src/components/ReportBuilder.tsx) | 3-panel authoring tool for configuring report templates |
| [`src/components/FormReport.tsx`](src/components/FormReport.tsx) | Interactive report viewer for single submission records |
| [`src/components/print/PrintReport.tsx`](src/components/print/PrintReport.tsx) | Dedicated A4/PDF print renderer complying with DESIGN_UI_UX.md |
| [`src/utils/tableFieldExtractor.ts`](src/utils/tableFieldExtractor.ts) | Core extraction engine converting TABLE/Likert/Matrix into FormFieldISO |
| [`src/utils/reportCompute.ts`](src/utils/reportCompute.ts) | Headless hybrid calculation engine (Compute stage) |
| [`src/types.ts`](src/types.ts) | Shared types: `ReportTemplateISO`, `ReportBlockConfig`, `ReportRevisionEntry`, `ReportDataModel` |

> **Update rule:** Whenever any files belonging to this module are created or modified, update
> the "Verified At Commit" field and add an entry to the [Change Log](#4-change-log) at the
> bottom of this document. Cite symbol names, never line numbers.

---

## 1. Purpose & Scope

### What This Module Does
- **Record Reporting (1-to-1):** Ingests a single filled form submission, transforms raw field inputs against engineering specifications with optional report-level rule overrides, and generates an actionable, insight-rich document (e.g., Inspection Scorecard, Audit Summary, Compliance Certificate).
- **Structured Visual Layout:** Formats computed metrics into structured visual presentations reusing FormBuilder block designs (`TITLE`, `SECTION_LABEL`, `INFO_GRID`, `TABLE`, `SIGN`).
- **Multi-Channel Distribution:** Delivers reports for interactive on-screen viewing and formatted A4/PDF document export.
- **Empty State Fallback:** Informs operators if no report template is yet configured for a submission with a direct button to build one.

### Future Scope (Phase 2)
- **Summary Reporting (1-to-N):** Consolidating multiple submissions across time, shifts, operators, or batches for trend analysis, yield metrics, and Pareto distributions.

### What This Module Does NOT Do
- **Does not collect raw form data** — handled by Form Operations (`FormFiller.tsx`).
- **Does not author base form input schemas** — handled by Form Designer (`FormBuilder.tsx`).
- **Does not route workflows or SOP steps** — handled by Process Designer (`ProcessEditor.tsx`).

---

## 2. Core 4-Stage Architecture

The module operates on a linear 4-stage processing and rendering pipeline:

```
[ 1. Source ] ───► [ 2. Compute ] ───► [ 3. Layout ] ───► [ 4. Distribute ]
```

### Stage 1: Source (Data Ingestion & Scope)
- Ingests the raw single submission payload and its corresponding form template metadata.
- Exposes a field data tree on the left panel for drag-and-drop binding.

### Stage 2: Compute (Hybrid Calculation Engine)
- Headless calculation engine (`reportCompute.ts`).
- Inherits form-level validation rules (`minSpec`, `maxSpec`, `isPass`) by default, while supporting report-level rule overrides defined in `ReportBuilder`.

### Stage 3: Layout (Visual Canvas & Block Composition)
- Renders an A4 page container initialized as a **Blank Page**.
- Reuses `FormBuilder` block designs:
  - `TITLE`: ISO header, title, logo, metadata.
  - `SECTION_LABEL`: Visual separators and section descriptions.
  - `INFO_GRID`: Grid layout of metadata and single-value fields.
  - `TABLE`: Tabular data rows with spec comparison and pass/fail badges.
  - `SIGN`: Inspector & supervisor signature verification stamps.

### Stage 4: Distribute (Multi-Channel Presenters)
- **Interactive Screen Presenter (`FormReport.tsx`):** Responsive viewing with back-navigation and print trigger.
- **Print/PDF Presenter (`PrintReport.tsx`):** Pixel-perfect A4 pagination adhering to `DESIGN_UI_UX.md`.

---

## 3. Integration Points

- **Platform Shell:**
  - 4th Top Nav Tab (`[Reports]`) in `Dashboard.tsx` acting as the central Report Hub.
- **Form Operations:**
  - `[📊 Report Template]` shortcut button on `Forms` table.
  - `[📄 View Report]` shortcut button on `Submissions` table.

---

## 4. Change Log

| Date | Change |
|---|---|
| 2026-08-27 | **Top Toolbar FormBuilder Parity & Standardized Report Print Engine:** (1) Aligned `ReportBuilder` Top Right Toolbar with `FormBuilder` (Segmented `[ A4 Dọc | A5 Ngang ]` pill, `[ 📄 PDF ]`, `[ 🖨️ Print ]`, `[ ✓ Saved ]` and `✕` close button). (2) Rebuilt `PrintReport.tsx` as a standard Print Engine portal with `ReactDOM.createPortal(..., document.body)` and `.print-container .print-doc` + `.print-outer-table`. (3) Added `download-inline` Base64 R2 logo loader preventing CORS/tainted canvas issues. (4) Integrated `exportFillablePdfFromDOM` for direct 1-click vector PDF generation with Digital 5S filename standard (`REPORT_...pdf`). (5) Applied Design System typography tokens (`--pw-font-banner`, `--pw-font-h1`, `--pw-font-h2`, `--pw-font-body`, `--pw-weight-banner`, etc.) and ISO report footer. |
| 2026-08-27 | **Unified Action Cluster, Direct Canvas Field Adding & No Nested Scroll:** (1) Removed nested scrollbar (`maxHeight: 240px`) on bound fields list, allowing natural expansion. (2) Streamlined bound field items in Right Inspector to a sleek single row: STT + Custom Label input + Reset `[ ↺ ]` + `ToggleSwitch Label` + Unified Action cluster `[ ↑ ] [ ↓ ] [ ✕ ]`. (3) Added direct `[ + Thêm trường ]` dashed slot button to Canvas `INFO_GRID` and `TABLE` footer. (4) Built searchable `Quick Field Picker Modal` with type badge mapping, search query filtering, and instant `[ + Gán ]` action from both Canvas and Inspector. |
| 2026-08-27 | **WYSIWYG Inline Label Editing, Reset [ ↺ ] & Modern Toggle Switches:** (1) Added `customLabel?: string` and `hideLabel?: boolean` to `ReportFieldRuleOverride` in `types.ts`. (2) Built `ToggleSwitch` component with rounded pill teal design. (3) Upgraded Canvas `INFO_GRID` to support WYSIWYG inline editable labels directly on Canvas with subtle focus ring, quick reset icon `[ ↺ ]` (RotateCcw) when modified, and respect `hideLabel` (rendering clean value-only cards). (4) Removed redundant `[TEXT]` / `[NUMBER]` type badges from report cards. (5) Extended Right Inspector with `customLabel` text input, `[ ↺ ]` restore button, and modern `ToggleSwitch` for `Label` in `INFO_GRID` and `Header` in `TABLE`. (6) Synchronized `PrintReport.tsx` A4 portal. |
| 2026-08-27 | **INFO_GRID & TABLE Layout Engine Parity with Loaded Fields:** (1) Extended `ReportBlockConfig` with `columnWidths?: number[]`, `titleFormat?: TitleFormatISO`, and `hideHeader?: boolean`. (2) Integrated `InfoGridSteppedSplitter` and column ratio presets for 2 & 3 columns. (3) Upgraded Canvas for `INFO_GRID` to render blank dropzone when empty, and `Loaded Field Cards` when bound (with question label, type badge, sample value, and removal action). (4) Upgraded Canvas for `TABLE` to render evaluation dropzone when empty, and `Loaded Criteria Rows` when bound (with STT, Spec, Actual value, Pass/Fail status, and removal action). (5) Extended Right Inspector with Title format pills (`[ H1 | H2 | Body | None ]`), Columns pill `[ 1 | 2 | 3 ]`, Stepped Splitter, Border style `[ Grid | Horizontal | None ]`, Header toggle `[ Hiện | Ẩn ]`, and Bound field list managers with reordering. (6) Synchronized print layout in `PrintReport.tsx`. |
| 2026-08-27 | **Title Block ISO Design Parity & Logo Engine:** (1) Added `showDate?: boolean` and `datePosition?: 'A' | 'B'` to `ReportBlockConfig`. (2) Upgraded Canvas render for `TITLE` block in `ReportBuilder.tsx` to match FormBuilder's ISO layout (H1 uppercase title, italic description, 2-column layout with left Logo container, flexible date placement at top-right or bottom-center). (3) Extended Right Inspector with Logo Uploader (`+ Upload Logo`), preview container (70px), `Remove Logo` action, `Description` input, and date position toggle (`Phải` / `Giữa`). (4) Implemented auto-inheritance of source form's logo and subtitle when adding Title block. (5) Synchronized identical ISO Title rendering in `PrintReport.tsx`. |
| 2026-08-27 | **Modular Table-to-Field Extraction Engine & Multi-Table Data Ingestion:** (1) Created standalone module `tableFieldExtractor.ts` with `extractTableFields` and `extractAllFormFields`, converting 4 table variants (Likert scale, row QA, multi-column inputs, and group-header tables) into first-class `FormFieldISO` objects. (2) Re-exported through `formUtils.ts` for uniform system access. (3) Integrated with `ReportBuilder.tsx` and `reportCompute.ts`, unlocking all 89 fields in `5C-Scorecard`. (4) Upgraded Left Panel `FIELDS` tray with colored type badges (`[LIKERT]`, `[RATING]`, `[RADIO]`, `[NUMBER]`, `[CHECKBOX]`, `[TEXT]`), block location subtitles, and tri-field search matching. |
| 2026-08-27 | **ReportBuilder Label Cleanup & Redundancy Removal:** (1) Streamlined Left Panel labels to concise English: `1. SOURCE FORM`, `2. SAMPLE SUBMISSION`, `FIELDS (n)`. (2) In Right Inspector `Properties` tab when no block is selected, removed duplicate `Report ID`, duplicate `Linked Form`, section header, and helper hint note, leaving only a clean `Report Title` input field. |
| 2026-08-27 | **Right Panel & Tab Switcher Standardization:** (1) Standardized Right Panel tab switcher to clean underline style with `Properties` / `Versions` labels. (2) Added independent `Report ID` input field at the top of Tab Versions. (3) Standardized Version Control card to clean 1px border without teal accent border, updated icon to `<GitBranch />`, and added active draft discard button (`[ 🗑 ]` + `handleDeleteActiveDraft`). |
| 2026-08-27 | **Save State Machine & Minimalist Close Icon:** (1) Implemented `getReportSnapshot` and `isSaved` state machine on the Save button (`[✓ Saved]` / `[Save]`). (2) Replaced text `Close` button with a minimalist `<X size={18} />` icon button with confirmation dialog for unsaved changes (`handleDiscardChangesAndClose`). |
| 2026-08-27 | **Versions Tab & Publish Relocation (FormBuilder Parity):** (1) Removed Publish button from Top Action Bar to match FormBuilder's clean layout. (2) Replicated FormBuilder's 3-card Versions tab: Card 1 (Version Control & Status with Major/Minor inputs & New Draft trigger), Card 2 (Change Summary with auto-suggest `generateReportChangeSummary`, Release Date & green Publish action), Card 3 (Revision History with Read-only preview & Rollback, status badges, and yellow top warning banner). |
| 2026-08-27 | **Header & Top Toolbar Alignment with FormBuilder:** (1) Restructured ReportBuilder Top Action Bar into 3 clusters: Left (Identity & Status), Center (Pill block adders toolbar: `+ Title`, `+ Info Grid`, `+ Table`, `+ Sign`, `+ Label`), Right (`[A4 Dọc]`, `[Print]`, `[Save]`, `Close`). (2) Removed in-canvas floating toolbar. (3) Moved Report ID and Title inputs to Right Inspector Properties tab. |
| 2026-08-27 | **Report Builder Implementation Complete:** Built 3-panel `ReportBuilder.tsx` authoring canvas, `reportCompute.ts` hybrid engine, `FormReport.tsx` single-record viewer with empty-state fallback, `PrintReport.tsx` A4 portal, and wired 4th `[Reports]` Hub in `Dashboard.tsx` and `App.tsx`. Verified with `npm run build`. |
| 2026-08-27 | **Finalized Architecture:** Locked in 5 core decisions: dedicated `report_templates` table, starter blocks (`TITLE`, `SECTION_LABEL`, `INFO_GRID`, `TABLE`, `SIGN`), blank page initialization, hybrid compute engine, and empty state fallback. |
