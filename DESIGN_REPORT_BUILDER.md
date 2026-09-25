# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 3.7 |
| **Verified At Commit** | (2026-09-25) — Removed Virtual Page Breaks and pruned dead tracking code in ReportBuilder verified against source |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/ReportBuilder.tsx`](src/components/ReportBuilder.tsx) | 3-panel authoring tool for configuring report templates |
| [`src/components/report/FieldScoringInspector.tsx`](src/components/report/FieldScoringInspector.tsx) | Dedicated sub-component for field-level dual scoring rules & weights |
| [`src/components/common/SmartNumberInput.tsx`](src/components/common/SmartNumberInput.tsx) | Streamlined spinless numeric input with instant auto-select on focus, local draft backspace editing, and keyboard arrow stepping |
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
| 2026-09-25 | **Removed Virtual Page Breaks & Pruned Tracking Code (ReportBuilder):** Removed virtual page break lines (`RANH GIỚI HẾT TRANG X (A4/A5)`) from the Report tab canvas sheet based on user feedback that the lines obstructed table rows and text during authoring. Pruned dead code including `paperCardRef`, `paperScrollHeight`, and the `ResizeObserver` hook adhering to Rule 4.2 / Rule 13.7. Preserved ISO Paper Footer and bottom scroll clearance. |
| 2026-09-25 | **Decoupled Form Scoring, Blank Slate Report, Bottom Clearance & Virtual Page Breaks (ReportBuilder, reportCompute, reportScoring, types.ts):** (1) Added `ruleOverrides` to `ReportTemplateISO` interface and updated `computeReportData` to merge template-level scoring rules and weights before block-level overrides. Tab Form now scores fields directly into `template.ruleOverrides` without mutating or auto-creating `layoutBlocks`. (2) Decoupled Tab Report visual blocks from Tab Form: Tab Report starts as a clean slate (blank canvas) without auto-cloning `INFO_GRID` or injecting `SECTION_LABEL`/`TABLE` blocks on click/sync. (3) Eliminated bottom cut-off on scrollable canvas by standardizing outer container padding (`padding: '1.25rem 1rem 5rem'`), adding `marginBottom: '2.5rem'` on `.paper-card`, and appending an explicit `4rem` bottom clearance spacer. (4) Added dynamic Virtual Page Break indicator lines (`RANH GIỚI HẾT TRANG X`) at page intervals (1050px for A4, 650px for A5) using `ResizeObserver`. (5) Added dedicated ISO Paper Footer (`reportId` and formatted semver version) at the bottom of the Report tab sheet. |
| 2026-09-25 | **Unified Canvas Dimensions & Tab Form Silent Edit Lock (ReportBuilder & FormReferenceCanvas):** (1) Standardized paper sheet dimensions across both `Form` and `Report` tabs: unified `maxWidth` to `920px` (A5 Landscape) / `820px` (A4 Portrait), `minHeight` to `650px` (A5) / `1050px` (A4), and internal padding to `1.75rem 2rem` (`padding: '1.75rem 2rem'`), eliminating the 122px layout jump when switching tabs. (2) Removed redundant outer scroll wrapper (`overflowY: 'auto'`, background `#f1f5f9`) from `FormReferenceCanvas`, solving the nested double-scrollbar bug and outer padding inflation. (3) Implemented silent layout/content edit locking (`if (activeCanvasTab === 'form') return;`) in `ReportBuilder.tsx` on `handleAddBlock`, `handleDeleteBlock`, title format pills (H1/H2), border toggles, table header toggles, and title/description inputs without cluttering the UI with readonly badges or disabling controls, while preserving full interactive scoring rule & weight overrides (`isKnockout`, `weight`, `ruleOverrides`). |
| 2026-09-25 | **Realigned Summary Table Footer Weight Slots & Removed Sigma Symbol (ReportBuilder):** Across all 3 summary tables in `ReportBuilder.tsx` (H1 Pillar Summary, H2 Child Elements Summary, and TABLE Block Fields Evaluation), removed the `∑` prefix from the total weight display and harmonized the footer weight container with the body rows (`display: flex, justifyContent: flex-end, gap: 2px, paddingRight: 2px`). Wrapped the total weight integer inside a dedicated 32px centered slot (`fontVariantNumeric: tabular-nums`, `fontWeight: 800`) matching the exact horizontal width and axis of the `<SmartNumberInput>` (32px) cells above it, followed by a separate `%` unit span. This achieves 100% vertical center alignment between the footer 100% metric and the component row inputs without obstructing the adjacent Score column. |
| 2026-09-25 | **Streamlined H1 Pillar Summary Table & In-Table Weight Editing (ReportBuilder & reportScoring):** (1) In `reportScoring.ts`, updated `summarizeH1ChildGroups` to return `blockId` for both H2 sub-sections and direct elements. (2) In `ReportBuilder.tsx`, added `handleUpdateH1ChildWeight` helper supporting in-table editing of child H2 weights and direct element weights with automatic percentage rebalancing. (3) Modernized H1 Summary Table: removed redundant title `"TỔNG HỢP ĐIỂM TRỤ CỘT H1"`, adopted unified 4-column `6 / 2 / 2 / 2` grid layout with `"Items"` header, added click drill-down on child titles (navigating to H2 Section Properties or Table Properties), integrated inline `<SmartNumberInput>` (32px, `min={0}`, `max={100}`, `%` suffix) for child weights, and modernized footer with blank column 1, status badge, combined score, and dynamic sum `∑ {totalWeight}%` (emerald if 100, amber if != 100). |
| 2026-09-25 | **Custom Cell Options & Checkbox Scoring Resolution (tableFieldExtractor, FieldScoringInspector, reportScoring):** (1) In `tableFieldExtractor.ts`, imported `getEffectiveCellOptions` from `formUtils.ts` and updated `extractTableFields` to prioritize cell-scoped option overrides from `block.cellOptionsMap` before falling back to `col.options`, while also extracting cell-scoped `placeholder` from `cellPlaceholderMap`. This resolves the issue where customized cell options (e.g. 7 target export market countries) were lost and reverted to column default ("Có" / "Không"). (2) In `formUtils.ts`, pruned dead unused re-exports of `tableFieldExtractor` (Rule 13.7). (3) In `FieldScoringInspector.tsx`, updated the Checkbox scoring matrix to support string/object options, detect `isOtherOpt` (`__other__` / `isOther`) alongside `isOtherValue` for live selection highlight, and render friendly "Khác" display. (4) In `reportScoring.ts`, updated `computeFieldScoreAndPass` checkbox evaluation to include `isOtherOpt` matching against submitted response values. |
| 2026-09-25 | **Strict Block Type Scoping for Field Rule Overrides (updateRuleOverride & Table Weight Sync):** (1) In `ReportBuilder.tsx`, upgraded `updateRuleOverride` with strict block type scoping: dynamically determines whether a field belongs to a `TABLE` or `INFO_GRID` in the source form, strictly restricting target resolution only to matching block types (`b.type === 'TABLE'` or `b.type === 'INFO_GRID'`). This completely eliminates the bug where a preceding `SECTION_LABEL` with identical title ("Đặc trưng nhân sự") accidentally captured field `ruleOverrides` and `boundFieldIds` away from the child `TABLE` block ("ĐẶC TRƯNG NHÂN SỰ"). (2) Priority 5 auto-initialization now binds the complete set of table fields (`extractTableFields`) rather than a single field ID. (3) Added automatic cleanup/migration purging orphaned field IDs and rule overrides from `SECTION_LABEL` blocks. (4) In `handleSelectBlockFromFormCanvas` and `handleSelectElementGroup`, guaranteed missing table field IDs are merged into `boundFieldIds`. (5) Updated `FieldScoringInspector` to prioritize `TABLE` and `INFO_GRID` blocks when resolving active rule overrides. |
| 2026-09-25 | **TABLE Block Canvas Selection & H2 Name Collision Resolution (Event Decoupling & Drill-down):** (1) In `FormReferenceCanvas.tsx`, decoupled TABLE block click events from `onSelectTableGroup`: changed `thead` click (when without group headers) and outer shell `customOnClick` to call `onSelectBlock?.(block.id)` directly, and registered `TABLE` in `matchedReportBlock` by boundFieldIds and title so selected tables highlight with active teal border. (2) In `ReportBuilder.tsx`, added a dedicated `TABLE` branch to `handleSelectBlockFromFormCanvas` that matches existing report TABLE blocks by boundFieldIds or auto-creates a new `TABLE` block in `template.layoutBlocks` with extracted field IDs. (3) In `handleSelectTableGroupFromCanvas`, prioritized Element lookup before Section H2 lookup, eliminating the name collision bug where an H2 section and its child table share the same name (e.g. "Đặc trưng nhân sự" and "ĐẶC TRƯNG NHÂN SỰ"). (4) Added click drill-down on child element titles in the H2 summary table to instantly navigate to Table Properties. (5) Resolved `__other__` technical prefix leakage across Canvas and Report Preview via `formatOptionDisplay` in `FormReferenceCanvas.tsx` and `ReportBuilder.tsx`, with `isOtherValue` option matching in `FieldScoringInspector.tsx` and `reportScoring.ts`. |
| 2026-09-25 | **Live Submission Canvas Rendering (FormReferenceCanvas & formUtils Pure Extraction):** (1) In `src/utils/formUtils.ts`, added pure utilities `extractSubmissionValue` (safe object/array formData resolution), `isLikertSelected` (whitespace/case-normalized text & index matching), and `isOptionSelected` (radio & comma-delimited checkbox matching) complying with Rule 13.8. (2) In `ReportBuilder.tsx`, passed `sampleSubmission={sampleSubmission}` to `<FormReferenceCanvas />`. (3) In `FormReferenceCanvas.tsx`, upgraded `TABLE` cells, `INFO_GRID` fields (`renderFieldValue`), and `CHECKLIST_TABLE` target items to render live submission values: Likert options display selected state with solid teal dot `●` and halo ring; Rating displays filled amber stars `★`; Checkbox/Radio displays checked visual `[✓]` / `(●)`; Text/Number/Date/Select displays actual entered values in bold `#0f172a`. Full fallback to blank template preview when `sampleSubmission` is null. |
| 2026-09-25 | **Elimination of Floating Quick-Select Pill Bar in SmartNumberInput:** (1) In `SmartNumberInput.tsx`, completely removed the `presets` prop and the floating pill bar popover (`[ 0 | 10 | 20 | 25 | 50 | 100 ]`) that popped up when focusing any Weight input. This triệt tiêu triệt để tình trạng popup che khuất nhãn `isKnockout` và `Loại trực tiếp` ở hàng trên. (2) Removed `presets` call-sites across `FieldScoringInspector.tsx` (field weight card) and `ReportBuilder.tsx` (SECTION_LABEL weight card and TABLE weight card). (3) Preserved 100% of optimal keyboard input UX: instant full text selection on focus/click for immediate overwrite, Backspace editing with local draft state, arrow up/down keyboard stepping, and zero browser spinner arrows. |
| 2026-09-25 | **Streamlined Table Inspector (Single-row TABLE + Border Icons + Header Toggle, FIELDS, In-Table Weight Editing):** In `ReportBuilder.tsx`: (1) Merged the TABLE inspector top header into a single horizontal row containing `TABLE` title, 3 visual Border icons (Grid `[ ▦ ]`, Horiz `[ ☵ ]`, None `[ ▢ ]`), `Header` toggle switch, and delete `[🗑]` button, reclaiming ~28px of vertical inspector space. (2) Removed redundant duplicate Border & Header controls block below. (3) Renamed `CÁC TRƯỜNG ĐÃ GÁN (x)` to `FIELDS (x)` for clean consistency with the Left Sidebar. (4) Redesigned the child evaluation table: removed redundant title `TỔNG HỢP ĐIỂM BẢNG ĐÁNH GIÁ`, adopted 6/2/2/2 grid ratio with `Items` column header, neutral `#334155` text styling, and integrated inline `<SmartNumberInput>` (32px, no popup) directly editing `ruleOverrides[fieldId].weight`. (5) Simplified footer displaying `PASS/FAIL`, bold score, and total weight sum `∑ {totalWeight}%`. (6) Simplified knockout label to `isKnockout`. |
| 2026-09-25 | **Load Template Persistence Fix (Report not reloading after Save):** (1) In `ReportBuilder.tsx`, upgraded `init()` with an `else if (targetFormId)` fallback that calls `GET /api/reports/by-form/:targetFormId` when `initialReportId` is `undefined`. On HTTP 200, loads saved `layoutBlocks`, syncs header/info-grid, sets `initialBlocks` and `lastSavedSnapshot`. On 404 (no saved report yet), keeps fresh empty template — no regression. (2) In `Dashboard.tsx`, updated both `[📊 Report]` buttons (table view and card view, `onOpenReportBuilder` calls) to perform a local lookup `reportTemplates.find(r => r.linkedFormId === form.formId)` and pass `linkedRep?.reportId` as second argument, ensuring `ReportBuilder` always receives a concrete `reportId` when the form already has a saved template. The `[✏️ Edit]` button in the Reports tab was already correct (unaffected). |
| 2026-09-25 | **Child Elements Table UI Alignment & Popover Elimination (Option A):** In `ReportBuilder.tsx`: (1) Removed `presets` popup from `SmartNumberInput` inside child elements table, completely eliminating popover overflow clipping and row obstruction in dense table cells. (2) Rebalanced grid column ratio from `5 / 2 / 2 / 3` to `6 / 2 / 2 / 2`, giving `Items` more breathing room and preventing premature title truncation. (3) Aligned `Score` and `Weight` column alignments with consistent right padding across Header, Body, and Footer. (4) Unified header text color to clean neutral `#334155`. |
| 2026-09-25 | **Streamlined H2 Section Inspector (SECTION_LABEL Style 2A & In-Table Child Weight Editing):** (1) In `ReportBuilder.tsx`, redesigned `SECTION_LABEL` inspector header to place `SECTION_LABEL` title, `[ H1 | H2 | Body | None ]` format pills, and trash button on a single row. (2) Implemented Style 2A seamless title & description container without dividing lines, conditionally rendering description only when populated. (3) Simplified knockout label to `isKnockout`. (4) In child elements table, removed redundant title `TỔNG HỢP ĐIỂM PHÂN MỤC H2`, renamed column 1 to `Items`, and enabled direct child weight editing via `SmartNumberInput` with `presets={[0, 10, 20, 25, 50, 100]}` and helper `handleUpdateChildElementWeight`. (5) In `reportScoring.ts`, updated `summarizeH2ChildElements` to return `blockId` for direct layoutBlocks updating. (6) In child table footer, removed `Tổng Phân Mục H2:`, displaying status badge, total score, and weight sum `∑ {totalWeight}%`. |
| 2026-09-24 | **Base-5 (`Thang 5`) Scoring Scale & Focus-Only Quick-Select `SmartNumberInput`:** (1) Scaled the default scoring mechanism across `reportScoring.ts`, `reportCompute.ts`, and `FieldScoringInspector.tsx` to Base-5 (`Thang 5`): `likert_scale` / `rating` linear distribution scales from 5 to 0 (`[5, 2.5, 0]` or `[5, 4, 2.5, 1, 0]`), `radio` / `select` fallback to 5, `checkbox` per-option fallback to 2.5 (max 5), `number` multi-range default to 5, and `text` standard pass score to 5 (short score 2.5). (2) Built `SmartNumberInput` (`src/components/common/SmartNumberInput.tsx`) removing browser `▲/▼` spinners, auto-selecting text on focus/click, and maintaining draft typing state without forcing 0 on backspace. (3) Deployed `SmartNumberInput` with Focus-Only Quick-Select Pill Bar (`[0, 10, 20, 25, 50, 100]`) on `Weight %` inputs in `FieldScoringInspector.tsx` and `ReportBuilder.tsx` (SECTION_LABEL & TABLE). |
| 2026-09-24 | **Streamlined Left Sidebar Option 3 (Default-Collapsed `40px` Icon Rail) & Top Header `[Form \| Report]` Switcher (Option 1):** (1) In `ReportBuilder.tsx`, initialized `isLeftSidebarCollapsed = true` so the Left Sidebar starts collapsed as a `40px` icon rail, renamed `1. SOURCE FORM` to `SOURCE` (displaying only `f.formTitle || f.formId`) and `2. SAMPLE SUBMISSION` to `SUBMISSION`, and default-collapsed the `FIELDS` tree (`isFieldsTrayOpen = false`) behind an icon bar (`Layers` + `FIELDS` + count badge + `ChevronRight` / `ChevronDown` + `ChevronsUpDown` / `ChevronsDownUp`). (2) Moved the `[Form \| Report]` segmented switcher from above the A4 sheet directly into the Top Header bar beside `Report Builder`, reclaiming ~54px of vertical canvas height. (3) In `tableFieldExtractor.ts`, normalized `extractAllFormFields` `locationCode` for `INFO_GRID` fields to `elementName || f.locationCode`. |




