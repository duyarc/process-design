# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 5.14 |
| **Verified At Commit** | (2026-09-29) — Cross-block INFO_GRID field drag-and-drop and ruleOverrides migration verified against ReportBuilder.tsx source |

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
| [`src/components/print/PrintScoring.tsx`](src/components/print/PrintScoring.tsx) | Dedicated minimalist A4/PDF print renderer for `tab Form` Scoring Blueprint matching `PrintBlankForm` |
| [`src/components/print/printShared.tsx`](src/components/print/printShared.tsx) | Shared print hooks and components (`usePrintLogo`, `PrintDocumentStyles`, `PrintTitleBlock`, `PrintSectionHeader`, `PrintPageFooter`) |
| [`src/utils/tableFieldExtractor.ts`](src/utils/tableFieldExtractor.ts) | Core extraction engine converting TABLE/Likert/Matrix into FormFieldISO |
| [`src/utils/reportScoring.ts`](src/utils/reportScoring.ts) | Pure calculation utility for multi-level hierarchical scoring, weights & `buildFormScoringBlueprintMap` |
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
| 2026-09-29 | **Cross-Block `INFO_GRID` Field Drag-and-Drop Fix & `ruleOverrides` Migration (`ReportBuilder`):** Fixed 4 root causes preventing fields from being dragged across `INFO_GRID` blocks: (1) Added dedicated `application/x-report-reorder` branch with `dropEffect = 'move'` in block container `onDragOver` so `effectAllowed = 'move'` from canvas cells no longer conflicts with `dropEffect = 'copy'` when hovering over block backgrounds. (2) Added `onDragOver` and `onDrop` handlers directly to `INFO_GRID` empty slots (`+ Thả vào đây`) supporting cross-block move (`moveFieldBetweenBlocks`), same-block move-to-end (`reorderFieldInBlock`), group field assignment (`addMultipleFieldsToBlock`), and single field assignment (`addFieldToBlock`). (3) Set `setIsDraggingField(true)` on `INFO_GRID` cell `onDragStart` (and cleared on `onDragEnd`) so populated target `INFO_GRID` blocks dynamically reveal their `+ Thả vào đây` slot during canvas field drags. (4) Updated `moveFieldBetweenBlocks` to atomically migrate `ruleOverrides[fieldId]` from the source block to the target block. |
| 2026-09-29 | **Option 3 Stacked Label Layout, Badge Tags (Cách C) & DATA PRUNING Controls (`types`, `printShared`, `ReportBuilder`):** (1) Extended `ReportBlockConfig` in `src/types.ts` with `hideUncheckedOptions?: boolean` and `hideEmptyFields?: boolean`. (2) Refactored `renderReportField` in `src/components/print/printShared.tsx` into **Option 3 Stacked Layout** (top uppercase label `0.72rem`, bottom bold value `0.85rem` with dotted baseline) across text, select, date/time, and general fields; replaced traditional checkbox/radio `[✓]` glyphs with **Cách C Badge Tags** (rounded pill tags with checkmark glyph `✓` when selected); added data pruning support so `hideEmptyFields` suppresses unpopulated fields (returning `null`) and `hideUncheckedOptions` filters out unchecked tags. Pruned unused imports `getAutoCheckboxLayoutMode` and `hasLongOptions`. (3) Synchronized Canvas cell preview in `ReportBuilder.tsx` to match Option 3 and Badge Tags WYSIWYG. (4) Added `DATA PRUNING` control group with 2 clean `ToggleSwitch` controls (`Ẩn lựa chọn chưa tick`, `Ẩn trường khi không có dữ liệu`) directly into the Right Inspector for `INFO_GRID` without altering any existing inspector controls. |
| 2026-09-29 | **Insert Layout Block Immediately After Active Block (`formUtils`, `ReportBuilder`):** (1) Extracted pure utility function `insertAfterActive<T extends { id: string }>(list: T[], newItem: T, activeId?: string \| null): T[]` into `src/utils/formUtils.ts` (Rule 4.1). (2) Updated `handleAddBlock` in `ReportBuilder.tsx` so that when a layout block is currently active/selected, any newly added block (`TITLE`, `INFO_GRID`, `TABLE`, `SIGN`, `SECTION_LABEL`) is inserted immediately at `activeIdx + 1` instead of defaulting to the end of the sheet, matching `FormBuilder` parity. (3) Applied `insertAfterActive` across `handleInsertChartIntoInfoGrid` (when auto-generating a new grid block) and section linking handlers (`handleSelectH1Section`, `handleSelectH2Subgroup`, `handleSelectElementGroup`). |
| 2026-09-29 | **Full Chart Drag-to-Reorder, Cross-Block Move & DropZone Chart Insertion (`ReportBuilder`):** (1) Added drag-to-reorder support for individual chart items (`RadarChartBlock`, `BarChartBlock`) inside `INFO_GRID` blocks: added `reorderChartDrag` and `dragOverChartIndex` states, `reorderChartInBlock` (using `reorderArray`), and `moveChartBetweenBlocks` for cross-block chart moving. Wrapped chart items in `draggable={true}` container with `GripVertical` handle, `#cIdx + 1` badge, and `2px solid var(--primary)` drag-over indicator. (2) Enhanced `renderBlockDropZone` to accept drops of `application/x-report-chart-type` from Left Sidebar (creating new `INFO_GRID` block at target index) and `application/x-report-chart-item-reorder` (extracting dragged chart into a new block). (3) Updated block badge to intuitively show `BIỂU ĐỒ` instead of technical `INFO_GRID` when the block exclusively contains chart items. |
| 2026-09-29 | **Canvas Drag-to-Reorder Layout Blocks & Cross-Block Field Dragging (`ReportBuilder`):** (1) Added canvas-level layout block drag-to-reorder mechanism in `activeCanvasTab === 'report'`: integrated top-left `#idx+1` grip handle and toolbar drag handle on every block using MIME type `application/x-report-block-reorder`. Added `blockDragFromIndex` and `blockDragOverIndex` state, `handleBlockReorderDrop`, and dynamic drop zones (`renderBlockDropZone`) before block 0 and after every block with glowing `var(--primary)` indicator lines. (2) Added cross-block field move capability (`moveFieldBetweenBlocks`): dragging fields between different `INFO_GRID` or `TABLE` blocks or dropping onto block containers now atomically removes the field from the source block and inserts it into the target block at the specified position. |
| 2026-09-28 | **Zero-Latency Report Tab — Props Bypass + Background Pre-fetch (`FormFiller`, `FormReport`):** (1) Added 3 optional bypass props to `FormReport.tsx` (`initialSubmission`, `initialFormTemplate`, `initialReportTemplate`), aliased as `bypassSubmission/bypassFormTemplate/bypassReportTemplate` inside component. (2) Refactored `fetchData` useEffect from 2 fixed paths into 3 branches: **Nhánh A** — zero fetch when all 3 bypass props are available (computeRecordReport synchronously ~2ms, render immediately); **Nhánh B** — 1 lightweight GET `/api/reports/by-form/:formId` (~10–30KB) when only `reportTemplate` is missing; **Nhánh C** — full fetch fallback (existing jwt-bundle and public/token paths, used for standalone `/r/:id` without bypass props). (3) Added `prefetchedReportTemplate: ReportTemplateISO \| null` state and a background non-blocking `useEffect` pre-fetch to `FormFiller.tsx` that silently fetches report template when `rawFormTemplate.formId` + `initialSubmission` are ready. (4) Passed all 3 bypass props down to the embedded `<FormReport>` render call in `FormFiller.tsx`. **Result:** switching from Form tab → Report tab is now ~0ms (instant render) when user has viewed the Form tab for ≥1–2s, or ~50–150ms (1 lightweight request) when switching immediately. Standalone `/r/:id` behavior unchanged. |
| 2026-09-28 | **Unified Canvas Dimensions (A4 820px / A5 920px) & Toolbar Alignment between Form and Report (`FormFiller`, `FormReport`, `SubmissionViewer`):** (1) Upgraded FormFiller container from 800px to dynamic Canvas Builder standard `canvasMaxWidth`: `820px` for standard A4 and `920px` for A5_LANDSCAPE (`effectivePageSize === 'A5_LANDSCAPE' \|\| effectivePageSize === 'A5'`). (2) Refactored `FormReport.tsx` embedded paper card to `maxWidth: '100%'`, `padding: '2rem'`, `borderRadius: 'var(--card-radius, 8px)'`, and `boxShadow: 'var(--shadow-md)'` — eliminating the 698px shrink defect and achieving 100% geometric parity when switching between `[ Form \| Report ]` tabs. Standalone report view normalized to `820px` (A4) / `920px` (A5). (3) Expanded Toolbar inline share link input from 180px to 210px for improved readability and verified zero-jump alignment across both tabs. (4) Updated `SubmissionViewer.tsx` to width 100% wrapper allowing child `FormFiller` to expand to 820px/920px. |
| 2026-09-28 | **`FormReport.tsx` INFO_GRID Display Bug Fix — `normalizeForm` layoutBlocks normalization (`FormReport`):** Fixed 3 cascading display bugs (raw field IDs as labels, `OPT_...` IDs not decoded, checkbox/radio raw string values) caused by a single root cause: `/api/forms/:formId` returns raw DB row with snake_case key `layout_blocks` while `FormReport.tsx` reads camelCase `layoutBlocks`. Added inline `normalizeForm(raw)` helper inside `useEffect` that sets `layoutBlocks: raw.layoutBlocks \|\| raw.layout_blocks \|\| []` and applied it to both the authenticated bundle path (`view-auth`) and public/token path. After normalization `extractAllFormFields` correctly resolves all fields → `renderReportField` shows human-readable `checkItem` labels, `formatOptionDisplay` decodes `OPT_...` IDs, and checkbox/radio fields render glyph `[✓]` instead of raw stored strings. |
| 2026-09-28 | **`FormReport.tsx` Fetch Performance Optimization & Skeleton UI (`FormReport`, `server.cjs`):** (1) Added `GET /api/reports/view-auth/:submissionId` endpoint in `server.cjs` — authenticated counterpart to the public `view` endpoint. Accepts `Authorization: Bearer <JWT>` header, fetches submission by ID, then runs `Promise.all([query forms, query report_templates])` for parallel Step B, returning combined `{ submission, formTemplate, reportTemplate }` bundle. Reduces authenticated report load from **3 sequential RTTs → 2 RTTs** (-33% wall time). (2) Refactored `FormReport.tsx` `useEffect` `fetchData`: when `currentUser` (JWT) is present and no public `token` prop is passed, dispatches a single call to `view-auth` endpoint; otherwise falls back to the public/token path with `Promise.all([fetch form, fetch report])` after the initial submission fetch (also reducing that path from 3 → 2 RTTs). (3) Replaced plain-text `loading` state with an animated Skeleton UI (paper-card containing shimmer rows) for both `isEmbedded` and standalone modes, providing immediate progressive disclosure instead of a blank screen. |
| 2026-09-28 | **WYSIWYG Parity between `FormReport.tsx` & `PrintReport.tsx`, Shared Pure Field Renderer & Removal of Hardcoded Borders/KPIs (`FormReport`, `PrintReport`, `printShared`):** (1) Extracted and exported `renderReportField` into `src/components/print/printShared.tsx` (Rule 4.1 Pure Utility Extraction), eliminating code duplication between interactive screen view and PDF/print view. Both viewers now uniformly render checkboxes `[✓]`, radio choices, decoded select labels, textareas with dotted baselines, and nested charts (`RadarChartBlock`, `BarChartBlock`). (2) Refactored `FormReport.tsx` `.paper-card` to match `PrintReport.tsx` 100% WYSIWYG: replaced hardcoded boxed TITLE with `<PrintTitleBlock />` (supporting organization logos via `usePrintLogo`), `SECTION_LABEL` with `<PrintSectionHeader />`, `TABLE` with ISO table layout (respecting `borderStyle`, STT column, `ruleOverrides`), and `SIGN` with clean borderless signature columns. (3) Removed all hardcoded artificial boxes (`border: 1px solid #000`) and the 4 top KPI cards summary (`totalEvaluated`, `passCount`, `failCount`, `overallStatus`) that did not exist in Report Builder. (4) Updated `onImgSettled` prop on `PrintTitleBlock` to be optional for non-print contexts. |
| 2026-09-28 | **Type-Aware `INFO_GRID` Rendering Engine & Option Resolution in `PrintReport.tsx` (`PrintReport`, `formUtils`):** (1) Upgraded `PrintReport.tsx` to fully respect `field.type` for all bound fields inside `INFO_GRID` blocks via `renderReportField`. Replaced legacy full-width stretched key-value rows (`justifyContent: space-between`) with clean document print typography aligned with `PrintFilledForm` and `PrintScoring`. (2) Checkbox & Radio fields render visual option glyphs `[✓]` / `(✓)` with label matching (`isOptionSelected(val, opt.value) || isOptionSelected(val, opt.label)`), respecting `getAutoCheckboxLayoutMode` (`OPTION_C` vs `OPTION_A`) and `hasLongOptions`. (3) Select dropdown fields resolve raw option IDs (`OPT_...`) into human-readable labels via `formatOptionDisplay(val, field.options)`. Text and number fields display adjacent labels with dotted underline indicators and support `colSpan`/`rowSpan` grid cell positioning. (4) Extended `src/utils/formUtils.ts` with case-insensitive option lookup and added `formatMultiOptionDisplay`. |
| 2026-09-28 | **Standardized `PrintReport.tsx` with Shared Print Architecture (`printShared`, `PrintReport`):** Refactored `PrintReport.tsx` to consume shared primitives from `src/components/print/printShared.tsx` alongside `PrintBlankForm`, `PrintFilledForm`, and `PrintScoring`. Replaced 30-line manual base64 logo fetch with `usePrintLogo`, replaced 53-line duplicate inline `@media print` style block with `<PrintDocumentStyles isA5={isA5} />`, unified TITLE banner with `<PrintTitleBlock />`, streamlined H1/H2 headers across `SECTION_LABEL`, `INFO_GRID`, and `TABLE` using `<PrintSectionHeader />`, and replaced manual footer with `<PrintPageFooter />`. Expanded `PrintTitleBlock` and `PrintSectionHeader` type contracts in `printShared.tsx` to natively support `ReportBlockConfig`. |
| 2026-09-28 | **Embedded FormReport Mode & Token-Based Public Viewing (`FormReport`, `server.cjs`):** Added `isEmbedded` prop to `FormReport.tsx` allowing borderless seamless rendering inside `FormFiller.tsx` submission view toolbar without duplicate fixed headers. Added `GET /api/reports/view/:submissionId` endpoint in `server.cjs` returning combined submission, form template, and report template for guest access via `/r/:submissionId?token=...`. |
| 2026-09-28 | **Minimalist `PrintScoring.tsx` (Matching `PrintBlankForm`), Shared Print Utilities (`printShared.tsx` & `formUtils.ts`) & Pruned `PrintFormScoringSpec` (`reportScoring`, `printShared`, `PrintBlankForm`, `PrintFilledForm`, `PrintScoring`, `ReportBuilder`):** (1) Extracted shared print logic into pure helpers `getChecklistColumns` and `groupTableRowsForPrint` in `src/utils/formUtils.ts` (Rule 4.1) and shared print components `usePrintLogo`, `PrintDocumentStyles`, `PrintTitleBlock`, `PrintSectionHeader`, and `PrintPageFooter` in `src/components/print/printShared.tsx` reused across `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, and `PrintScoring.tsx`. (2) Redesigned the `tab Form` Scoring Blueprint printout into minimalist component `src/components/print/PrintScoring.tsx`: eliminated redundant top banners, eliminated top legend formula box, eliminated artificial `INFO_GRID` outer borders/header bars, preserved `PrintBlankForm`'s borderless `INFO_GRID` layout (with dotted lines `... 5đ` and inline `☐` options), preserved `TABLE` border styles (`borderless` 3-column Likert scale `○ 5đ` / `○ 3đ` / `○ 1đ`, rating `☆ ☆ ☆ ☆ ☆`, and checkbox options `☐ Option (+1đ)`), with clean monospace weight badges `[X% / Parent]` pinned to the top-right corner. (3) Pruned dead component `PrintFormScoringSpec.tsx` (Rule 4.2 Dead-Code Pruning) and updated `ReportBuilder.tsx` to render `<PrintScoring />`. |
| 2026-09-28 | **Universal Option D Weight Notation (`/` + `⊞`), Top-Right Corner Weight Badges & `isPass` Omission in `tab Form` Printout (`reportScoring`, `PrintFormScoringSpec`):** (1) Updated `WeightBadgeSpec` and `FieldBlueprintSpec` in `src/utils/reportScoring.ts` and `renderWeightBadge` in `src/components/print/PrintFormScoringSpec.tsx` to use language-neutral Option D notation: replaced `"of"` with `"/"` and `"Bảng"` with `"⊞"` (`[35% / Form]`, `[50% / H1]`, `[100% / H2]`, `[17% / ⊞]`). (2) Pinned all weight badges to the **top-right corner** (`display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'`) of their respective containers across `H1`, `H2`, `INFO_GRID` block headers, `INFO_GRID` field cells, `TABLE` block headers, and `TABLE` cells. (3) Temporarily omitted `isPass` pass/fail differentiation (`◉` vs `○`, emerald vs muted slate) and `ruleSummary` pass thresholds from `renderInlineFieldAnswerKey` and the top legend strip, rendering all choice/scale items uniformly with their scores (`• {label} · {scoreText}` and `[{label}: {scoreText}]`). |




