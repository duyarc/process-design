# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 1.9 |
| **Verified At Commit** | (2026-09-24) — Smart target block resolution & auto-initialization for field scoring & weights verified against source |

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
| 2026-09-22 | **Field Properties Auto-Grow Label & Streamlined Multi-Option Value Visualizer:** (1) Upgraded `selectedField` `Label` in Right Inspector of `ReportBuilder.tsx` to an auto-growing read-only container (`whiteSpace: 'pre-wrap', wordBreak: 'break-word'`), displaying 100% of long question texts without vertical scrollbars và removing formatting buttons `[ B ] [ I ] [ U ]`. (2) Upgraded `Value` inspector to render a pure visual multi-option visualizer for `scale` / `likert_scale`, `checkbox`, `radio`, `select`, pulling candidate options directly from the schema and highlighting submitted values with teal border/background and check/radio icons without redundant text badges (`Selected`, `Đã chọn`, `Active`). |
| 2026-09-22 | **FormBuilder-Parity Field Properties Inspector & Left Tray Streamlining:** (1) Streamlined Left Panel `FIELDS` tray cards by removing cluttered technical `ID:` subtitles and adding active teal selection highlight. (2) Built dedicated `FIELD PROPERTIES` inspector in Right Panel Properties tab matching FormBuilder 100% UI parity: header with dismiss `[✕]`, `ID` with 1-click `[📋 Sao chép]` / `[✓ Đã chép!]`, `Label` with `[B][I][U]`, `Type` with exact `FIELD_TYPE_OPTIONS` Lucide icon trigger, and raw `Value` from sample submission. (3) Updated form ingestion in `init()` to sort `formsData` by `updated_at DESC` ensuring the latest form drafts load automatically. (4) Pruned orphaned `toggleFieldInBlock`. |
| 2026-09-22 | **Hierarchical Section H1 & H2 Grouping & Batch Field Adding:** (1) Enhanced `tableFieldExtractor.ts` to assign `sectionH1` (from `SECTION_LABEL` H1 or section titles) and `sectionH2` (from `SECTION_LABEL` H2, table group headers `row.isGroupHeader`, or block titles). (2) Added pure utility `groupFieldsByHierarchy` returning nested `{ h1, totalFieldsCount, h2Groups: [{ h2, fields }] }`. (3) Replaced flat field lists in `ReportBuilder.tsx` Left Panel `FIELDS` tray and Quick Field Picker Modal with collapsible Accordion Trees with expand/collapse-all toggles, auto-expand on search match, and batch assignment action buttons `[ + Gán cả H1 ]` and `[ + Nhóm ]`. |
| 2026-09-10 | **Report Publish Revision Deduplication & Author Binding:** In `ReportBuilder.tsx`, bound revision author to `currentUser` (`useAuth`), set `status: 'ACTIVE'`, and filtered out matching clean versions and draft entries from `template.revisionHistory`, retiring older entries and updating `itemStatus` display logic. |
| 2026-09-04 | **Streamlined Right Inspector & Contextual Header Parity:** (1) Streamlined ReportBuilder Right Inspector by removing redundant title format pills `[ H1 | H2 | Body | None ]` and title input that duplicate In-Canvas controls for non-TITLE blocks. (2) Added dynamic contextual header (`Table Properties`, `Info Grid Properties`, etc.) with delete block action. (3) Added dedicated `Tiêu đề báo cáo` input in `TITLE` block. (4) Promoted block-specific controls to top-1 view. |
| 2026-09-04 | **In-Canvas Title Header Greyout Input Parity:** In `InCanvasTitleHeader` of `ReportBuilder.tsx`, replaced static notice text with inline editable greyed-out `<input>` for `NONE` title format (placeholder `(Tiêu đề đang ẩn)`, opacity 0.6, focus highlight), matching FormBuilder Canvas and Right Inspector parity. |
