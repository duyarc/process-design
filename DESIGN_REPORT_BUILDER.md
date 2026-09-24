# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 2.5 |
| **Verified At Commit** | (2026-09-24) — Strict 4-Tier Hierarchy (`H1` ➔ `H2` strictly `titleFormat === 'H2'` ➔ `Element (TABLE/INFO_GRID)` ➔ `Field`) & `extractParentGroupTitle` resolving Level-4 Field parent to Level-3 Table (`locationCode`) verified against source |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/ReportBuilder.tsx`](src/components/ReportBuilder.tsx) | 3-panel authoring tool for configuring report templates |
| [`src/components/report/FieldScoringInspector.tsx`](src/components/report/FieldScoringInspector.tsx) | Dedicated sub-component for field-level dual scoring rules & weights |
| [`src/components/report/FormReferenceCanvas.tsx`](src/components/report/FormReferenceCanvas.tsx) | Dedicated sub-component for rendering source form WYSIWYG A4 sheet |
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
- Exposes a strict 4-tier field data tree (`H1 Pillar` ➔ `H2 Sub-section (strictly titleFormat === 'H2')` ➔ `Element (TABLE / INFO_GRID indented one level below H2)` ➔ `Field`) on the left panel for selection and binding.

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
| 2026-09-24 | **Strict 4-Tier Hierarchy (`H1` ➔ `H2` strictly `titleFormat === 'H2'` ➔ `Element` ➔ `Field`):** (1) In `tableFieldExtractor.ts`, redefined `extractTableFields`, `extractAllFormFields`, `ElementHierarchyGroup`, `FieldHierarchyGroup`, `groupFieldsByElements`, and `groupFieldsByHierarchy` so `sectionH2` is strictly populated only by headers with `titleFormat === 'H2'` (or `sectionFormat === 'H2'`); normal `TABLE` and `INFO_GRID` elements (`titleFormat !== 'H2'`) and table `groupHeader` rows never overwrite `sectionH2` and instead form Level-3 `elements` under `h2Groups` (or `directElements` under `H1` when no `H2` header exists). (2) In `reportScoring.ts`, upgraded `summarizeH1ChildGroups` to roll up true `H2` sub-sections (or direct elements when `H1` has no `H2`) and added `summarizeH2ChildElements` to roll up child `TABLE` elements under an `H2` section. (3) In `ReportBuilder.tsx`, upgraded the Left Panel `FIELDS` tree and Quick Field Picker Modal to render the 4-tier hierarchy with `[TABLE]` nodes indented one level below `[H2]`, separated `handleSelectH2Subgroup` (opening `H2 Section Properties` with `TỔNG HỢP ĐIỂM PHÂN MỤC H2`) from `handleSelectElementGroup` (opening `Table Properties` with parent badge `of [ [H2] ... ]`). |
| 2026-09-24 | **2-Step Design Principle (`Build Layout First → Arrange Fields Into Layout`) for `TITLE` & `INFO_GRID` Blocks:** (1) In `ReportBuilder.tsx`, upgraded initialization (`syncHeaderAndInfoGridBlocksFromForm`) and `handleFormChange()` to construct each `TITLE` and `INFO_GRID` Layout Block first (preserving `columns`, `columnWidths` such as `[65, 35]` and `[50, 50]`, `title`, `titleFormat` `'H1'` vs `'NONE'`, `borderStyle`, and `hideHeader`) and then populate each block's exact `boundFieldIds` from `srcBlock.fields` (including `checkbox`, `select`, and `text` fields without truncation). (2) In `FormReferenceCanvas.tsx` and `handleSelectBlockFromFormCanvas`, implemented 1-to-1 `INFO_GRID` block matching by shared `boundFieldIds` and ordinal index so multiple `INFO_GRID` blocks with the same title (`"Thông tin chung"`) remain independently selectable and configurable. (3) Upgraded `INFO_GRID` Field Slot rendering on both `Form` and `Report` tabs to enforce `rowSpan`, `colSpan`, `1px dotted #cbd5e1` slot borders, and option visualization (`checkbox` / `radio` / `select`). |
| 2026-09-24 | **Section Label H1 & H2 Properties Redesign & Scoring Roll-up Summary:** In `ReportBuilder.tsx` and `reportScoring.ts`: (1) Added dynamic Inspector header with colored badge (`[H1]` / `[H2]`) and title (`H1 Section Properties` / `H2 Section Properties`). (2) Added Seamless Borderless Title Input directly beneath header with pencil icon `✎` for viewing and inline renaming. (3) Added Title Format selector pills `[ H1 | H2 | Body | None ]` in Inspector. (4) Standardized H1/H2 weight controls into the modern 2-row card (`Row 1: isKnockout + Loại trực tiếp`, `Row 2: Weight [ xx ] %` + badge `of [ Toàn bộ Báo cáo ]` for H1 or `of [ {parentH1Title} ]` for H2). (5) Extracted pure utility `summarizeH1ChildGroups` and integrated H1 Pillar Combined Scoring Summary Table displaying all child H2 groups, isPass, Score, Weight, and combined pillar score via `computeH1CombinedScore`. |
| 2026-09-24 | **Table Properties Streamlined Layout (Seamless Title, Combined Border & Header, 2-Row Weight Card):** In `ReportBuilder.tsx`: (1) Added Seamless Borderless Table Name input right below `Table Properties` header with pencil icon `✎` and active teal focus ring. (2) Streamlined table controls by combining `Border` ([Grid | Horiz | None]) and `Header` toggle switch on the same horizontal row, saving ~24px vertical height. (3) Upgraded H2 Property card to a structured 2-row card mirroring Field Properties: Row 1 features `[ ] isKnockout (H2)` toggle on left and `"Loại trực tiếp"` secondary label on right; Row 2 features `Weight: [ xx ] %` on left and dynamic badge `of [ {parentH1Title} ]` on right, with multi-tier parent H1 resolution from `boundFields`, `sectionH2` title matching, and `hierarchyGroups`. |
| 2026-09-24 | **Smart Target Block Resolution & Auto-Initialization for Field Scoring & Weights:** (1) In `ReportBuilder.tsx`, upgraded `updateRuleOverride` with a 5-tier priority resolution: Priority 1 (block explicitly binding field), Priority 2 (block already containing override), Priority 3 (TABLE matching parent section title), Priority 4 (active TABLE/INFO_GRID block), Priority 5 (auto-initializes a TABLE block for the field's section when `layoutBlocks` is empty or lacks matching block), eliminating silent update aborts. (2) Added `setActiveBlockId(null)` to Left Panel field clicks and `key={selectedField.id}` to `FieldScoringInspector`. (3) In `FieldScoringInspector.tsx`, upgraded Score and Weight inputs to safely handle empty string and intermediate typing without forced reset to zero. |
| 2026-09-24 | **Field Properties Weight of Section 2-Row Structured Layout:** In `FieldScoringInspector.tsx`, upgraded the bottom property bar to an intuitive 2-row card (Option 1 approved by user): (1) Row 1 features the `[ ] isKnockout` toggle with `"Loại trực tiếp"` secondary label. (2) Row 2 features `Weight: [ xx ] %` adjacent to a dedicated badge displaying `of [ {parentGroupTitle} ]` in bold Teal with text ellipsis and full hover tooltip. This preserves clear parent section hierarchy and prevents text wrapping on narrow inspector sidebars. |
| 2026-09-24 | **Canvas Interactive Selection for Table Properties & H2 Group Headers:** (1) In `ReportBuilder.tsx`, added `handleSelectTableGroupFromCanvas` mapping table group titles to `hierarchyGroups` field IDs and invoking `handleSelectH2Subgroup`, and passed `activeGroupTitle`, `onSelectTableGroup`, and `onSelectH1Section` to `FormReferenceCanvas`. (2) In `FormReferenceCanvas.tsx`, enabled clicking table group header rows (`row.isGroupHeader`) to select the corresponding H2 Table block and open `Table Properties` on Right Inspector, added active border/background styling (`borderLeft: 4px solid #2563eb`, `#eff6ff`), and supported clicking table block wrapper/thead for non-grouped tables. (3) In `ReportBuilder.tsx`, updated `InCanvasTitleHeader` `onSelectBlock` across `TABLE`, `INFO_GRID`, `SECTION_LABEL` to reset `selectedFieldId = null` and switch to `properties` tab, and added direct click listener on Report Canvas `<thead>` to select `Table Properties`. |
| 2026-09-24 | **Canvas Interactive Selection for Table Likert Scale Questions & Report Canvas Field Selection:** (1) In `tableFieldExtractor.ts`, exported `getTableFieldId`, `getTableRowPrimaryFieldId`, and `isFieldInTableRow` to cleanly resolve composite field IDs (`${block.id}_${row.id}_${col.id}`) for table cells and rows. (2) In `FormReferenceCanvas.tsx`, replaced raw `row.id` click with `rowPrimaryFieldId` and added cell-level `onClick` on input columns (`likert_scale`, `rating`, `checkbox`, `radio`, `number`, etc.) so clicking a table question on canvas correctly sets `selectedFieldId`, activates `FIELD PROPERTIES` and `FieldScoringInspector` in Right Inspector, and renders active teal border and cell ring highlights. (3) In `ReportBuilder.tsx`, added direct `onClick` selection and active border highlights on Report canvas `TABLE` rows and `INFO_GRID` field cards. |
| 2026-09-23 | **FormReferenceCanvas FormBuilder-Parity Rewrite:** (1) Rebuilt `FormReferenceCanvas.tsx` to replicate FormBuilder center canvas WYSIWYG 100%: Paper container dimensions `maxWidth: 820px` (or `920px` for A5), `padding: 2.5rem`, `minHeight: 1050px`, `gap: 0px`. (2) Eliminated all inter-block `marginTop` as requested (blockMarginTop = 0px). (3) Integrated FormBuilder-exact footer with `formId || 'PENDING'` and `formatFormVersion(version, status, effectiveDate, updatedAt)`. (4) Added type-aware field preview for all types (photo, text/number, date/time, radio/checkbox, select, rating/likert, subtable) and full table layout parity (`tableLayout: fixed`, `<colgroup>`, `getColStyleWidth`, `hideHeader`, group header resolution, `getEffectiveCellOptions`, and MATRIX_TABLE demo preview). |
| 2026-09-23 | **Dual Tab Canvas [Form | Report] & FormReferenceCanvas Sub-component:** (1) Replaced single canvas layout with a clean 2-Tab Canvas Switcher `[ Form | Report ]` in `ReportBuilder.tsx`. (2) Created isolated sub-component `FormReferenceCanvas.tsx` rendering the source form's A4 sheet WYSIWYG (`selectedForm.layoutBlocks`) with full ISO Title, Info Grid, Section Labels, Tables, and Signs. (3) Enabled interactive cross-tab field selection (`selectedFieldId`) and synchronization with Right Inspector properties. (4) Maintained zero-regression on existing Report evaluation canvas. |
| 2026-09-23 | **Blank Space Click-to-Deselect & Report Properties Inspector:** Added background click event delegation on Center Canvas scroll container (`#f1f5f9`) and Paper sheet margins (`.paper-card`) in `ReportBuilder.tsx` to reset `activeBlockId` and `selectedFieldId` to null, isolated block selection with `e.stopPropagation()`, and displayed Report Properties with standardized uppercase header. |
| 2026-09-23 | **Number Multi-Range & Text Completeness Scoring Rules & Minimal English Inspector:** (1) Extended `ReportFieldRuleOverride` with `numberRanges`, `numberDefaultPass`, `numberDefaultScore`, `textMinLength`, `textPassScore`, `textShortScore`, `textShortPass`, `textAllowEmpty`, `textEmptyScore` and defined `NumberRangeSpec` in `types.ts`. (2) Upgraded `computeFieldScoreAndPass` in `reportScoring.ts` to evaluate multi-interval thresholds for Number fields and completeness rules for Text fields with full live matching. (3) Rebuilt `FieldScoringInspector.tsx` with Number Multi-Range matrix (+ Add Range, row highlight, fallback row), Text completeness matrix (Option 4 inline editable min length in `Standard (≥ [ N ])`), and streamlined minimal English styling (`Value:`, `Range`, `Condition`, `Copy`/`Copied!`). (4) Compressed `Type` into a space-efficient single-row layout in `ReportBuilder.tsx`. |
| 2026-09-23 | **Streamlined Weight Label in Field, H1 & H2 Property Bars:** (1) Streamlined the weight label across all 3 hierarchical property bars from verbose text (`Weight (% trong [Tên Nhóm]):`, `Weight (% trong Báo cáo):`, `Weight (% trong [Trụ Cột]):`) to a concise, single-line label **`Weight:`** in `FieldScoringInspector.tsx` and `ReportBuilder.tsx`. (2) Preserved full contextual parent group descriptions in the HTML `title` tooltip, eliminating multiline text wrapping and visual clutter on single-row property bars. |
| 2026-09-22 | **Left Panel Section H1 / H2 Interactive Selection & Collapsed Card Clipping Fix:** (1) Fixed vertical text clipping on collapsed Section H1 cards by adding `flexShrink: 0`, `minHeight: '34px'`, and `boxSizing: 'border-box'` to tree containers in Left Panel and Quick Field Picker Modal. (2) Separated Chevron button click (`[ > ]` / `[ v ]` for `toggleSectionExpand`) from Section / Sub-section row clicks. (3) Added `handleSelectH1Section` and `handleSelectH2Subgroup` in `ReportBuilder.tsx`: clicking H1 or H2 in the left tree immediately activates the corresponding block (or auto-initializes if not present), clears individual field selection (`selectedFieldId = null`), and switches to the Right Panel `Properties` tab to configure H1 / H2 properties (`isKnockout`, `Weight %`, scoring summary). (4) Added active highlight styling (Teal border/background for H1, Blue for H2) when a section/sub-section is currently active. |
| 2026-09-22 | **Dual Evaluation Engine & Hierarchical Combined Score Roll-up:** (1) Implemented parallel dual evaluation architecture running qualitative compliance (`isPass`) and quantitative scoring (`Score`) independently across all levels. (2) Added 3-tier hierarchical roll-up in `reportScoring.ts`: Field ➔ Sub-section H2 (`computeH2CombinedScore`) ➔ Section H1 (`computeH1CombinedScore`) ➔ Report Overall (`computeRecordReport`), computing combined weighted scores: $\text{Combined Score} = \sum (\text{Score}_i \times \frac{\text{Weight}_i}{100})$. (3) Built dedicated sub-component `FieldScoringInspector.tsx` rendering 3-column evaluation matrix (`Option / Condition`, `isPass`, `Score`), responsive SUM row with `PASS`/`FAIL` & clean numeric score (no `đ` suffix), and single-row property bar (`isKnockout` + dynamic `Weight (% trong [Tên Nhóm])`). (4) Standardized table column header strictly to `Score` across all levels without hardcoded `/ 10` assumptions. (5) Integrated H2 scoring matrix and H1 weight property bar into `ReportBuilder.tsx` Right Inspector. |

