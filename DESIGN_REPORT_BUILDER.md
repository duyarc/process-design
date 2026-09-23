# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 1.3 |
| **Verified At Commit** | (2026-09-23) — Streamlined Weight Label in Field, H1 & H2 Property Bars verified against source |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/ReportBuilder.tsx`](src/components/ReportBuilder.tsx) | 3-panel authoring tool for configuring report templates |
| [`src/components/report/FieldScoringInspector.tsx`](src/components/report/FieldScoringInspector.tsx) | Dedicated sub-component for field-level dual scoring rules & weights |
| [`src/components/FormReport.tsx`](src/components/FormReport.tsx) | Interactive report viewer for single submission records |
| [`src/components/print/PrintReport.tsx`](src/components/print/PrintReport.tsx) | Dedicated A4/PDF print renderer complying with DESIGN_UI_UX.md |
| [`src/utils/tableFieldExtractor.ts`](src/utils/tableFieldExtractor.ts) | Core extraction engine converting TABLE/Likert/Matrix into FormFieldISO |
| [`src/utils/reportScoring.ts`](src/utils/reportScoring.ts) | Pure calculation utility for multi-level hierarchical scoring & weights |
| [`src/utils/reportCompute.ts`](src/utils/reportCompute.ts) | Headless hybrid calculation engine (Compute stage) |
| [`src/types.ts`](src/types.ts) | Shared types: `ReportTemplateISO`, `ReportBlockConfig`, `ReportRevisionEntry`, `ReportDataModel`, `FieldEvaluationResult`, `ReportFieldRuleOverride` |

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

### Stage 2: Compute (Hybrid Engine)
- Headless TypeScript calculation worker executing field rules.

### Stage 3: Layout (Visual Builder & Canvas)
- 3-panel UI with live Canvas previewing report structure.

### Stage 4: Distribute (Interactive & Print)
- Interactive viewer and A4/PDF portal.

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
| 2026-09-23 | **Streamlined Weight Label in Field, H1 & H2 Property Bars:** (1) Streamlined the weight label across all 3 hierarchical property bars from verbose text (`Weight (% trong [Tên Nhóm]):`, `Weight (% trong Báo cáo):`, `Weight (% trong [Trụ Cột]):`) to a concise, single-line label **`Weight:`** in `FieldScoringInspector.tsx` and `ReportBuilder.tsx`. (2) Preserved full contextual parent group descriptions in the HTML `title` tooltip, eliminating multiline text wrapping and visual clutter on single-row property bars. |
| 2026-09-22 | **Left Panel Section H1 / H2 Interactive Selection & Collapsed Card Clipping Fix:** (1) Fixed vertical text clipping on collapsed Section H1 cards by adding `flexShrink: 0`, `minHeight: '34px'`, and `boxSizing: 'border-box'` to tree containers in Left Panel and Quick Field Picker Modal. (2) Separated Chevron button click (`[ > ]` / `[ v ]` for `toggleSectionExpand`) from Section / Sub-section row clicks. (3) Added `handleSelectH1Section` and `handleSelectH2Subgroup` in `ReportBuilder.tsx`: clicking H1 or H2 in the left tree immediately activates the corresponding block (or auto-initializes if not present), clears individual field selection (`selectedFieldId = null`), and switches to the Right Panel `Properties` tab to configure H1 / H2 properties (`isKnockout`, `Weight %`, scoring summary). (4) Added active highlight styling (Teal border/background for H1, Blue for H2) when a section/sub-section is currently active. |
| 2026-09-22 | **Dual Evaluation Engine & Hierarchical Combined Score Roll-up:** (1) Implemented parallel dual evaluation architecture running qualitative compliance (`isPass`) and quantitative scoring (`Score`) independently across all levels. (2) Added 3-tier hierarchical roll-up in `reportScoring.ts`: Field ➔ Sub-section H2 (`computeH2CombinedScore`) ➔ Section H1 (`computeH1CombinedScore`) ➔ Report Overall (`computeRecordReport`), computing combined weighted scores: $\text{Combined Score} = \sum (\text{Score}_i \times \frac{\text{Weight}_i}{100})$. (3) Built dedicated sub-component `FieldScoringInspector.tsx` rendering 3-column evaluation matrix (`Option / Condition`, `isPass`, `Score`), responsive SUM row with `PASS`/`FAIL` & clean numeric score (no `đ` suffix), and single-row property bar (`isKnockout` + dynamic `Weight (% trong [Tên Nhóm])`). (4) Standardized table column header strictly to `Score` across all levels without hardcoded `/ 10` assumptions. (5) Integrated H2 scoring matrix and H1 weight property bar into `ReportBuilder.tsx` Right Inspector. |
| 2026-09-22 | **Field Properties Auto-Grow Label & Streamlined Multi-Option Value Visualizer:** (1) Upgraded `selectedField` `Label` in Right Inspector of `ReportBuilder.tsx` to an auto-growing read-only container (`whiteSpace: 'pre-wrap', wordBreak: 'break-word'`), displaying 100% of long question texts without vertical scrollbars and removing formatting buttons `[ B ] [ I ] [ U ]`. (2) Upgraded `Value` inspector to render a pure visual multi-option visualizer for `scale` / `likert_scale`, `checkbox`, `radio`, `select`, pulling candidate options directly from the schema and highlighting submitted values with teal border/background and check/radio icons without redundant text badges (`Selected`, `Đã chọn`, `Active`). |
| 2026-09-22 | **FormBuilder-Parity Field Properties Inspector & Left Tray Streamlining:** (1) Streamlined Left Panel `FIELDS` tray cards by removing cluttered technical `ID:` subtitles and adding active teal selection highlight. (2) Built dedicated `FIELD PROPERTIES` inspector in Right Panel Properties tab matching FormBuilder 100% UI parity: header with dismiss `[✕]`, `ID` with 1-click `[📋 Sao chép]` / `[✓ Đã chép!]`, `Label` with `[B][I][U]`, `Type` with exact `FIELD_TYPE_OPTIONS` Lucide icon trigger, and raw `Value` from sample submission. (3) Updated form ingestion in `init()` to sort `formsData` by `updated_at DESC` ensuring the latest form drafts load automatically. (4) Pruned orphaned `toggleFieldInBlock`. |
| 2026-09-22 | **Hierarchical Section H1 & H2 Grouping & Batch Field Adding:** (1) Enhanced `tableFieldExtractor.ts` to assign `sectionH1` (from `SECTION_LABEL` H1 or section titles) and `sectionH2` (from `SECTION_LABEL` H2, table group headers `row.isGroupHeader`, or block titles). (2) Added pure utility `groupFieldsByHierarchy` returning nested `{ h1, totalFieldsCount, h2Groups: [{ h2, fields }] }`. (3) Replaced flat field lists in `ReportBuilder.tsx` Left Panel `FIELDS` tray and Quick Field Picker Modal with collapsible Accordion Trees with expand/collapse-all toggles, auto-expand on search match, and batch assignment action buttons `[ + Gán cả H1 ]` and `[ + Nhóm ]`. |
| 2026-09-10 | **Report Publish Revision Deduplication & Author Binding:** In `ReportBuilder.tsx`, bound revision author to `currentUser` (`useAuth`), set `status: 'ACTIVE'`, and filtered out matching clean versions and draft entries from `template.revisionHistory`, retiring older entries and updating `itemStatus` display logic. |
| 2026-09-04 | **Streamlined Right Inspector & Contextual Header Parity:** (1) Streamlined ReportBuilder Right Inspector by removing redundant title format pills `[ H1 | H2 | Body | None ]` and title input that duplicate In-Canvas controls for non-TITLE blocks. (2) Added dynamic contextual header (`Table Properties`, `Info Grid Properties`, etc.) with delete block action. (3) Added dedicated `Tiêu đề báo cáo` input in `TITLE` block. (4) Promoted block-specific controls to top-1 view. |
| 2026-09-04 | **In-Canvas Title Header Greyout Input Parity:** In `InCanvasTitleHeader` of `ReportBuilder.tsx`, replaced static notice text with inline editable greyed-out `<input>` for `NONE` title format (placeholder `(Tiêu đề đang ẩn)`, opacity 0.6, focus highlight), matching FormBuilder Canvas and Right Inspector parity. |
| 2026-08-27 | **Executive Editorial Pair 1 H1-H2 Typography & Spacing Standardization:** (1) Standardized **H1** in `ReportBuilder.tsx`, `FormReport.tsx`, and `PrintReport.tsx` to bold uppercase typography (`fontSize: var(--pw-font-h1)`, `fontWeight: 700`, `letterSpacing: 0.6px`, `border: 'none'`, `background: 'transparent'`), eliminating divisive horizontal underlines. (2) Standardized **H2** to use a sleek Left Accent Bar (`borderLeft: '3px solid var(--primary)'` / `3px solid #000`, `padding: '2px 0 2px 8px'`) with transparent background (`background: 'transparent'`), eliminating gray boxes for smooth visual flow. |
| 2026-08-27 | **Section Label Description Auto-Grow Mirror & Markdown Formatting Parity:** (1) Upgraded Canvas `InCanvasTitleHeader` description in `ReportBuilder.tsx` to CSS Grid Auto-Grow Textarea Mirror, preventing multiline text clipping. (2) Added keyboard shortcuts `handleFormatKeyDown` (`Ctrl+B`, `Ctrl+I`, `Ctrl+U`) on Canvas description. (3) Added `[ B ] [ I ] [ U ]` format buttons and `sectionDescRef` to Right Inspector for `SECTION_LABEL`. (4) Synchronized `PrintReport.tsx` and `FormReport.tsx` to render markdown `renderFormattedText` with `whiteSpace: 'pre-wrap'` and `lineHeight: 1.5`. |
| 2026-08-27 | **Section Label Parity with FormBuilder & In-Canvas Style Switcher:** (1) Standardized `SECTION_LABEL` creation default to `H1`. (2) Integrated `InCanvasTitleHeader` component into `ReportBuilder.tsx` Canvas for `SECTION_LABEL`, `INFO_GRID`, `TABLE`, and `SIGN` with WYSIWYG direct inline editable title/description inputs and quick-switch pill group `[ H1 | H2 | Body | None ]`. (3) Added `Description` textarea to Right Inspector for `SECTION_LABEL`. (4) Synchronized `PrintReport.tsx` and `FormReport.tsx` with full ISO typography and description rendering. |
| 2026-08-27 | **Table Field Extraction Parity in PrintReport & FormReport:** Replaced naive `layoutBlocks.flatMap(b => b.fields)` with full `extractAllFormFields(formTemplate.layoutBlocks)` in `PrintReport.tsx` and `FormReport.tsx`. Fixed bug where bound fields originating from Likert/QA/Matrix table rows (such as `5C-Scorecard`) failed to resolve their human-readable `checkItem` questions and incorrectly fell back to raw technical field IDs (e.g., `btable178...acol_3`). |
| 2026-08-27 | **Top Toolbar FormBuilder Parity & Standardized Report Print Engine:** (1) Aligned `ReportBuilder` Top Right Toolbar with `FormBuilder` (Segmented `[ A4 Dọc | A5 Ngang ]` pill, `[ 📄 PDF ]`, `[ 🖨️ Print ]`, `[ ✓ Saved ]` and `✕` close button). (2) Rebuilt `PrintReport.tsx` as a standard Print Engine portal with `ReactDOM.createPortal(..., document.body)` and `.print-container .print-doc` + `.print-outer-table`. (3) Added `download-inline` Base64 R2 logo loader preventing CORS/tainted canvas issues. (4) Integrated `exportFillablePdfFromDOM` for direct 1-click vector PDF generation with Digital 5S filename standard (`REPORT_...pdf`). (5) Applied Design System typography tokens (`--pw-font-banner`, `--pw-font-h1`, `--pw-font-h2`, `--pw-font-body`, `--pw-weight-banner`, etc.) and ISO report footer. |
| 2026-08-27 | **Unified Action Cluster, Direct Canvas Field Adding & No Nested Scroll:** (1) Removed nested scrollbar (`maxHeight: 240px`) on bound fields list, allowing natural expansion. (2) Streamlined bound field items in Right Inspector to a sleek single row: STT + Custom Label input + Reset `[ ↺ ]` + `ToggleSwitch Label` + Unified Action cluster `[ ↑ ] [ ↓ ] [ ✕ ]`. (3) Added direct `[ + Thêm trường ]` dashed slot button to Canvas `INFO_GRID` and `TABLE` footer. (4) Built searchable `Quick Field Picker Modal` with type badge mapping, search query filtering, and instant `[ + Gán ]` action from both Canvas and Inspector. |
| 2026-08-27 | **WYSIWYG Inline Label Editing, Reset [ ↺ ] & Modern Toggle Switches:** (1) Added `customLabel?: string` and `hideLabel?: boolean` to `ReportFieldRuleOverride` in `types.ts`. (2) Built `ToggleSwitch` component with rounded pill teal design. (3) Upgraded Canvas `INFO_GRID` to support WYSIWYG inline editable labels directly on Canvas with subtle focus ring, quick reset icon `[ ↺ ]` (RotateCcw) when modified, and respect `hideLabel` (rendering clean value-only cards). (4) Removed redundant `[TEXT]` / `[NUMBER]` type badges from report cards. (5) Extended Right Inspector with `customLabel` text input, `[ ↺ ]` restore button, and modern `ToggleSwitch` for `Label` in `INFO_GRID` and `Header` in `TABLE`. (6) Synchronized `PrintReport.tsx` A4 portal. |
| 2026-08-27 | **Title Block ISO Design Parity & Logo Engine:** (1) Added `showDate?: boolean` and `datePosition?: 'A' | 'B'` to `ReportBlockConfig`. (2) Upgraded Canvas render for `TITLE` block in `ReportBuilder.tsx` to match FormBuilder's ISO layout (H1 uppercase title, italic description, 2-column layout with left Logo container, flexible date placement at top-right or bottom-center). (3) Extended Right Inspector with Logo Uploader (`+ Upload Logo`), preview container (70px), `Remove Logo` action, `Description` input, and date position toggle (`Phải` / `Giữa`). (4) Implemented auto-inheritance of source form's logo and subtitle when adding Title block. (5) Synchronized identical ISO Title rendering in `PrintReport.tsx`. |
| 2026-08-27 | **Modular Table-to-Field Extraction Engine & Multi-Table Data Ingestion:** (1) Created standalone module `tableFieldExtractor.ts` with `extractTableFields` and `extractAllFormFields`, converting 4 table variants (Likert scale, row QA, multi-column inputs, and group-header tables) into first-class `FormFieldISO` objects. (2) Re-exported through `formUtils.ts` for uniform system access. (3) Integrated with `ReportBuilder.tsx` and `reportCompute.ts`, unlocking all 89 fields in `5C-Scorecard`. (4) Upgraded Left Panel `FIELDS` tray with colored type badges (`[LIKERT]`, `[RATING]`, `[RADIO]`, `[NUMBER]`, `[CHECKBOX]`, `[TEXT]`), block location subtitles, and tri-field search matching. |
| 2026-08-27 | **Right Panel & Tab Switcher Standardization:** (1) Standardized Right Panel tab switcher to clean underline style with `Properties` / `Versions` labels. (2) Added independent `Report ID` input field at the top of Tab Versions. (3) Standardized Version Control card to clean 1px border without teal accent border, updated icon to `<GitBranch />`, and added active draft discard button (`[ 🗑 ]` + `handleDeleteActiveDraft`). |
| 2026-08-27 | **Save State Machine & Minimalist Close Icon:** (1) Implemented `getReportSnapshot` and `isSaved` state machine on the Save button (`[✓ Saved]` / `[Save]`). (2) Replaced text `Close` button with a minimalist `<X size={18} />` icon button with confirmation dialog for unsaved changes (`handleDiscardChangesAndClose`). |
