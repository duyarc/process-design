# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 4.8 |
| **Verified At Commit** | (2026-09-28) — Ultra-Clean Left Sidebar `FIELDS` Tree UI (Option A Group Headers + Option B Type Icon Field Rows) & `application/x-report-group-fields` group drag-and-drop binding verified against source |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/ReportBuilder.tsx`](src/components/ReportBuilder.tsx) | 3-panel authoring tool for configuring report templates |
| [`src/components/report/FieldScoringInspector.tsx`](src/components/report/FieldScoringInspector.tsx) | Dedicated sub-component for field-level dual scoring rules & weights |
| [`src/components/report/RadarChartBlock.tsx`](src/components/report/RadarChartBlock.tsx) | Minimalist borderless 1-column Radar Chart renderer inside `INFO_GRID` cells |
| [`src/components/report/BarChartBlock.tsx`](src/components/report/BarChartBlock.tsx) | Minimalist borderless Bar Chart renderer with live commentary inside `INFO_GRID` cells |
| [`src/components/report/RadarChartInspector.tsx`](src/components/report/RadarChartInspector.tsx) | Right Sidebar Inspector for Radar Chart (Option B/D Summary Drop-Slot, strict `38px|48px|18px` alignment, two-way weight sync) |
| [`src/components/report/BarChartInspector.tsx`](src/components/report/BarChartInspector.tsx) | Right Sidebar Inspector for Bar Chart (Option B/D Summary Drop-Slot, two-way weight sync, and `NHẬN XÉT` commentary range editor) |
| [`src/components/common/SmartNumberInput.tsx`](src/components/common/SmartNumberInput.tsx) | Streamlined spinless numeric input with instant auto-select on focus, local draft backspace editing, and keyboard arrow stepping |
| [`src/components/report/FormReferenceCanvas.tsx`](src/components/report/FormReferenceCanvas.tsx) | Dedicated sub-component for rendering source form WYSIWYG A4 sheet |
| [`src/components/FormReport.tsx`](src/components/FormReport.tsx) | Interactive report viewer for single submission records |
| [`src/components/print/PrintReport.tsx`](src/components/print/PrintReport.tsx) | Dedicated A4/PDF print renderer complying with DESIGN_UI_UX.md |
| [`src/utils/tableFieldExtractor.ts`](src/utils/tableFieldExtractor.ts) | Core extraction engine converting TABLE/Likert/Matrix into FormFieldISO |
| [`src/utils/reportScoring.ts`](src/utils/reportScoring.ts) | Pure calculation utility for multi-level hierarchical scoring & weights |
| [`src/utils/reportChartUtils.ts`](src/utils/reportChartUtils.ts) | Pure calculation utility for Radar/Bar charts (`resolveChartSummaryState`, `buildRadarPolygonPoints`, `wrapSvgAxisLabel`, `resolveScoreRangeComment`) |
| [`src/utils/reportCompute.ts`](src/utils/reportCompute.ts) | Headless hybrid calculation engine (Compute stage) |
| [`src/types.ts`](src/types.ts) | Shared types: `ReportTemplateISO`, `ReportBlockConfig`, `ReportChartItemConfig`, `ChartComponentItem`, `SummaryFieldBinding`, `ScoreRangeCommentRule`, `ReportRevisionEntry`, `ReportDataModel`, `FieldEvaluationResult`, `ReportFieldRuleOverride` |

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
| 2026-09-28 | **Ultra-Clean Left Sidebar `FIELDS` Tree UI (Option A Group Headers + Option B Field Rows) & Group Drag-and-Drop Field Binding (`ReportBuilder`):** (1) Streamlined the 3-level `FIELDS` tree in `ReportBuilder.tsx` to eliminate text truncation by reclaiming `68px`–`98px` of horizontal space per group row: removed redundant `<Layers />` icon and `[+ Gán cả H1]` button from `H1` rows, removed `<Folder />`/`<FolderOpen />` icons (and their unused `lucide-react` imports) and `[+ Cả H2]` button from `H2` rows, removed duplicate `[TABLE]` badge and `[+ Bảng]` button from `Element` rows, and replaced `(count)` parentheses with slim right-aligned `tabular-nums` counts (`totalFieldsCount` / `fields.length`). (2) Streamlined individual Field Rows (`Option B`): replaced the left `⠿` grip dots and the wide right-side text type badge (`[CHECKBOX]` / `[DROPDOWN]` / `[TEXT]`) with a semantic `13px` color-coded `<TypeIcon />` (`getFieldTypeOption(field.type).icon` + `badgeStyle.color`) at the start of each field row and a slim `tabular-nums` `x{usageCount}` badge at the right edge, freeing `65px`–`85px` of width for field titles. (3) Preserved 100% of bulk group field assignment by adding `application/x-report-group-fields` JSON payload (`fieldIds`) to `onDragStart` across `H1`, `H2`, and `Element` rows alongside `setIsDraggingField(true)`, and handling `application/x-report-group-fields` in both Center Canvas (`INFO_GRID`/`TABLE` blocks) and Right Inspector dropzones via `addMultipleFieldsToBlock`. |
| 2026-09-28 | **`INFO_GRID` Multi-Column Rendering Fix & Layout Unification with `FormBuilder` (`ReportBuilder`, `RadarChartBlock`, `BarChartBlock`, `FormReport`):** (1) Unified `block.type === 'INFO_GRID'` in `ReportBuilder.tsx` with `FormBuilder.tsx` by always rendering the outer CSS Grid container (`display: 'grid', gridTemplateColumns: getInfoGridTemplateColumns(block)`) regardless of item count, eliminating the 1-column empty state bypass. (2) Implemented column-aware drop slots (`emptySlotCount`) inside the CSS Grid so a 2-column or 3-column `INFO_GRID` visually displays `2` (`50% | 50%`) or `3` side-by-side `+ Thả vào đây` column slots when empty or partially filled, reacting live to `columns` and `columnWidths` slider adjustments. (3) Removed hardcoded `gridColumn: '1 / -1'` from `RadarChartBlock.tsx` and `BarChartBlock.tsx` so charts naturally occupy a single column cell inside multi-column `INFO_GRID` layouts. (4) Updated `FormReport.tsx` to use shared `getInfoGridTemplateColumns(block)` from `src/utils/formUtils.ts`. |
| 2026-09-28 | **4-Tier Smart Zero-Sum Auto-Balance Weights, Implicit Manual Lock (`isWeightManual`), 1-Click Reset (`↺`) & Skip-Level Promotion (`reportScoring`, `reportCompute`, `FieldScoringInspector`, `ReportBuilder`, `types`):** (1) Extended `ReportFieldRuleOverride` and `ReportBlockConfig` in `src/types.ts` with `isWeightManual?: boolean`. (2) Added pure utilities `distributeIntegerTotal`, `resolveSmartGroupWeights`, and `resolveFormTopLevelGroups` in `src/utils/reportScoring.ts` implementing Zero-Sum Auto-Balance across all 4 tiers (`Form -> H1 -> H2 -> Table -> Field`): unedited (`AUTO`) siblings automatically share `Math.max(0, 100 - sum(manualWeights))` equally as integers, while any user edit sets `isWeightManual: true` and locks that item permanently (including `0%`) so it is never overwritten. (3) Implemented Skip-Level / Tier Promotion (`Form -> H2` when `H1` is omitted, `Form -> Bảng` when both `H1` & `H2` are omitted, and `H1 -> Bảng` when `H2` is omitted) in `resolveFormTopLevelGroups`, `summarizeH1ChildGroups`, `computeRecordReport`, and the Form Root Draggable Card (`[N H1]` / `[K H2]` / `[M Bảng]`). (4) Added Teal border/background highlight (`#f0fdfa` / `var(--primary)`) for manual weights (`isWeightManual === true`) and compact `↺` (`RotateCcw`) 1-click Reset to `AUTO` buttons in summary table headers and single weight cards across `FieldScoringInspector.tsx` and `ReportBuilder.tsx`. |
| 2026-09-28 | **Radar Chart Multi-Line SVG Axis Wrapping & Clean `INFO_GRID` Default Title (`reportChartUtils`, `RadarChartBlock`, `ReportBuilder`, `PrintReport`):** (1) Added pure helper `wrapSvgAxisLabel` in `src/utils/reportChartUtils.ts` and updated `<RadarChartBlock />` (`viewBoxWidth = 640`, `overflow: 'visible'`, 2-line balanced `<tspan>` axis labels) so long axis names never clip at the left/right SVG viewport edges. (2) Removed hardcoded `'Thông tin chung'` default title and `'H2'` format for `INFO_GRID` in `handleAddBlock` (`title = ''`, `titleFormat = 'NONE'`) and sanitized legacy empty/chart-only `INFO_GRID` blocks across `InCanvasTitleHeader` and `PrintReport.tsx`. |
| 2026-09-28 | **Form-Level All-H1 Chart Binding (Option A), Single-Group Component Drop & Full Sidebar Accordion (`ReportBuilder`, `RadarChartInspector`, `BarChartInspector`, `FormReferenceCanvas`):** (1) Separated dropzone semantics in `RadarChartInspector.tsx` and `BarChartInspector.tsx`: dropping a group (`Form Root`, `H1`, `H2`) into the top `Summary Row` (`handleSummaryDrop`) sets the parent summary title/score and populates child items into `THÀNH PHẦN`, whereas dropping a group (`H1`/`H2`) into the bottom `+ Kéo trường hoặc nhóm vào đây` dropzone (`handleAddComponentDrop`) appends that single group itself as 1 component axis/bar without expanding children. (2) Added Option A Form Root Draggable Card (`⠿ 📄 {selectedForm.formTitle} [N H1]`) at the top of the `FIELDS` tree in `ReportBuilder.tsx` with full `H1` roll-up payload and two-way `H1`/`H2` weight sync in `handleSyncChartWeightToSource`. (3) Implemented Full Sidebar Accordion: mutual exclusion between `CHARTS` and `FIELDS` trays plus multi-level sibling accordion inside `FIELDS` (`toggleSectionExpand` across `H1`, `H2`, and `Element`). (4) Restored `sampleSubmission` data display in `FormReferenceCanvas.tsx` and removed legacy hardcoded `boundFieldIds` pre-population in `handleAddBlock`. |
| 2026-09-27 | **Radar & Bar Chart Components, Paper Card Overflow Fix & Form Tab Section/Table Selection (`hiddenInReport`):** (1) Extended `ReportBlockConfig` with `chartItems?: ReportChartItemConfig[]` and `hiddenInReport?: boolean` in `src/types.ts`, plus pure chart utilities in `src/utils/reportChartUtils.ts`. (2) Removed all hardcoded demo data (`createDefaultRadarChartConfig`, `createDefaultBarChartConfig`, `sanitizeDemoChartConfig`). (3) Created borderless `<RadarChartBlock />` and `<BarChartBlock />` inside `INFO_GRID` across `ReportBuilder.tsx`, `FormReport.tsx`, and `PrintReport.tsx`. (4) Created `<RadarChartInspector />` and `<BarChartInspector />` implementing **Option B + D Hybrid Summary Drop-Slot**, strict `38px | 48px | 18px` vertical grid alignment, and Two-Way Weight Sync. (5) Fixed `.paper-card` clipping bug in `ReportBuilder.tsx` and `FormReport.tsx` (`height: 'auto', flexShrink: 0, overflow: 'visible'`). (6) Restored `SECTION_LABEL` (H1/H2) and `TABLE` selection in `tab Form` (`handleSelectH1Section`, `handleSelectH2Subgroup`, `handleSelectElementGroup`, `handleSelectBlockFromFormCanvas`) by creating `hiddenInReport: true` scoring blocks so properties/weights can be inspected and edited in `tab Form` without polluting the `tab Report` visual layout. |
| 2026-09-25 | **Pure Native Drag & Drop Field Reordering on Canvas & Inspector (ReportBuilder):** Upgraded ReportBuilder field management to pure native HTML5 drag and drop for reordering assigned fields in both Center Canvas (INFO_GRID grid cells and TABLE table rows) and Right Inspector (FIELDS list). (1) Real-time two-way reactive reorder: reordering items in Canvas automatically synchronizes with the Inspector FIELDS list and vice-versa via block `boundFieldIds` and `reorderArray`. (2) UI Streamlining & Zero Visual Clutter (Lesson 11): eliminated auxiliary instruction hints ("Kéo để xếp lại", hint boxes) in favor of intuitive visual affordances (⠿ grip handles, `cursor: grab`, `0.35` ghost opacity, and teal insertion border line `borderTop: 2.5px solid var(--primary)`). (3) Dead-Code Pruning (Rule 4.2 / Rule 13.7): completely removed single-step up/down buttons `↑` and `↓`, and completely replaced/pruned `moveFieldInBlock` with `reorderFieldInBlock` using pure utility `reorderArray` from `src/utils/formUtils.ts`. (4) Drag safety: prevented text input selection conflict by guarding dragStart on `<input>` elements. |
| 2026-09-25 | **Pure Native Drag & Drop Field Assignment & Pruned Quick Field Picker Modal (ReportBuilder):** Replaced modal/button-based field assignment with native HTML5 Drag and Drop across the 3-panel authoring workspace. (1) Left Sidebar FIELDS tree cards are draggable with grip handle ⠿ and display compact reuse frequency badges xN (x1, x2) for assigned fields while keeping unassigned fields clean without badges or redundant indicators. (2) INFO_GRID and TABLE layout blocks act as drop targets with visual cues (dashed primary border). (3) Option 4 Adaptive Microcopy: empty blocks display a dashed dropzone with `+ Thả vào đây`; populated blocks hide all dropzone slots during resting state and only reveal an adaptive dashed slot `+ Thả vào đây` when dragging a field (`isDraggingField === true`). (4) Dead-Code Pruning: completely eliminated the 365-line Quick Field Picker Modal (`fieldPickerBlockId`, `fieldPickerSearch`) and removed clutter buttons from Canvas and Right Inspector. |
| 2026-09-25 | **Removed Virtual Page Breaks & Pruned Tracking Code (ReportBuilder):** Removed virtual page break lines (`RANH GIỚI HẾT TRANG X (A4/A5)`) from the Report tab canvas sheet based on user feedback that the lines obstructed table rows and text during authoring. Pruned dead code including `paperCardRef`, `paperScrollHeight`, and the `ResizeObserver` hook adhering to Rule 4.2 / Rule 13.7. Preserved ISO Paper Footer and bottom scroll clearance. |
| 2026-09-25 | **Decoupled Form Scoring, Blank Slate Report, Bottom Clearance & Virtual Page Breaks (ReportBuilder, reportCompute, reportScoring, types.ts):** (1) Added `ruleOverrides` to `ReportTemplateISO` interface and updated `computeReportData` to merge template-level scoring rules and weights before block-level overrides. Tab Form now scores fields directly into `template.ruleOverrides` without mutating or auto-creating `layoutBlocks`. (2) Decoupled Tab Report visual blocks from Tab Form: Tab Report starts as a clean slate (blank canvas) without auto-cloning `INFO_GRID` or injecting `SECTION_LABEL`/`TABLE` blocks on click/sync. (3) Eliminated bottom cut-off on scrollable canvas by standardizing outer container padding (`padding: '1.25rem 1rem 5rem'`), adding `marginBottom: '2.5rem'` on `.paper-card`, and appending an explicit `4rem` bottom clearance spacer. (4) Added dynamic Virtual Page Break indicator lines (`RANH GIỚI HẾT TRANG X`) at page intervals (1050px for A4, 650px for A5) using `ResizeObserver`. (5) Added dedicated ISO Paper Footer (`reportId` and formatted semver version) at the bottom of the Report tab sheet. |
| 2026-09-25 | **Unified Canvas Dimensions & Tab Form Silent Edit Lock (ReportBuilder & FormReferenceCanvas):** (1) Standardized paper sheet dimensions across both `Form` and `Report` tabs: unified `maxWidth` to `920px` (A5 Landscape) / `820px` (A4 Portrait), `minHeight` to `650px` (A5) / `1050px` (A4), and internal padding to `1.75rem 2rem` (`padding: '1.75rem 2rem'`), eliminating the 122px layout jump when switching tabs. (2) Removed redundant outer scroll wrapper (`overflowY: 'auto'`, background `#f1f5f9`) from `FormReferenceCanvas`, solving the nested double-scrollbar bug and outer padding inflation. (3) Implemented silent layout/content edit locking (`if (activeCanvasTab === 'form') return;`) in `ReportBuilder.tsx` on `handleAddBlock`, `handleDeleteBlock`, title format pills (H1/H2), border toggles, table header toggles, and title/description inputs without cluttering the UI with readonly badges or disabling controls, while preserving full interactive scoring rule & weight overrides (`isKnockout`, `weight`, `ruleOverrides`). |
| 2026-09-25 | **Realigned Summary Table Footer Weight Slots & Removed Sigma Symbol (ReportBuilder):** Across all 3 summary tables in `ReportBuilder.tsx` (H1 Pillar Summary, H2 Child Elements Summary, and TABLE Block Fields Evaluation), removed the `∑` prefix from the total weight display and harmonized the footer weight container with the body rows (`display: flex, justifyContent: flex-end, gap: 2px, paddingRight: 2px`). Wrapped the total weight integer inside a dedicated 32px centered slot (`fontVariantNumeric: tabular-nums`, `fontWeight: 800`) matching the exact horizontal width and axis of the `<SmartNumberInput>` (32px) cells above it, followed by a separate `%` unit span. This achieves 100% vertical center alignment between the footer 100% metric and the component row inputs without obstructing the adjacent Score column. |
| 2026-09-25 | **Streamlined H1 Pillar Summary Table & In-Table Weight Editing (ReportBuilder & reportScoring):** (1) In `reportScoring.ts`, updated `summarizeH1ChildGroups` to return `blockId` for both H2 sub-sections and direct elements. (2) In `ReportBuilder.tsx`, added `handleUpdateH1ChildWeight` helper supporting in-table editing of child H2 weights and direct element weights with automatic percentage rebalancing. (3) Modernized H1 Summary Table: removed redundant title `"TỔNG HỢP ĐIỂM TRỤ CỘT H1"`, adopted unified 4-column `6 / 2 / 2 / 2` grid layout with `"Items"` header, added click drill-down on child titles (navigating to H2 Section Properties or Table Properties), integrated inline `<SmartNumberInput>` (32px, `min={0}`, `max={100}`, `%` suffix) for child weights, and modernized footer with blank column 1, status badge, combined score, and dynamic sum `∑ {totalWeight}%` (emerald if 100, amber if != 100). |
| 2026-09-25 | **Custom Cell Options & Checkbox Scoring Resolution (tableFieldExtractor, FieldScoringInspector, reportScoring):** (1) In `tableFieldExtractor.ts`, imported `getEffectiveCellOptions` from `formUtils.ts` and updated `extractTableFields` to prioritize cell-scoped option overrides from `block.cellOptionsMap` before falling back to `col.options`, while also extracting cell-scoped `placeholder` from `cellPlaceholderMap`. This resolves the issue where customized cell options (e.g. 7 target export market countries) were lost and reverted to column default ("Có" / "Không"). (2) In `formUtils.ts`, pruned dead unused re-exports of `tableFieldExtractor` (Rule 13.7). (3) In `FieldScoringInspector.tsx`, updated the Checkbox scoring matrix to support string/object options, detect `isOtherOpt` (`__other__` / `isOther`) alongside `isOtherValue` for live selection highlight, and render friendly "Khác" display. (4) In `reportScoring.ts`, updated `computeFieldScoreAndPass` checkbox evaluation to include `isOtherOpt` matching against submitted response values. |
| 2026-09-25 | **Strict Block Type Scoping for Field Rule Overrides (updateRuleOverride & Table Weight Sync):** (1) In `ReportBuilder.tsx`, upgraded `updateRuleOverride` with strict block type scoping: dynamically determines whether a field belongs to a `TABLE` or `INFO_GRID` in the source form, strictly restricting target resolution only to matching block types (`b.type === 'TABLE'` or `b.type === 'INFO_GRID'`). This completely eliminates the bug where a preceding `SECTION_LABEL` with identical title ("Đặc trưng nhân sự") accidentally captured field `ruleOverrides` and `boundFieldIds` away from the child `TABLE` block ("ĐẶC TRƯNG NHÂN SỰ"). (2) Priority 5 auto-initialization now binds the complete set of table fields (`extractTableFields`) rather than a single field ID. (3) Added automatic cleanup/migration purging orphaned field IDs and rule overrides from `SECTION_LABEL` blocks. (4) In `handleSelectBlockFromFormCanvas` and `handleSelectElementGroup`, guaranteed missing table field IDs are merged into `boundFieldIds`. (5) Updated `FieldScoringInspector` to prioritize `TABLE` and `INFO_GRID` blocks when resolving active rule overrides. |




