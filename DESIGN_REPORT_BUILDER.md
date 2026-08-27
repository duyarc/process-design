# Report Builder — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Report Builder |
| **Status** | Implemented & Verified |
| **Document Version** | 1.0 |
| **Verified At Commit** | (2026-08-27) — Sections 1 to 4 checked against source code and verified with production build |

### Quick File Index

| File | Role |
|---|---|
| [`src/components/ReportBuilder.tsx`](src/components/ReportBuilder.tsx) | 3-panel authoring tool for configuring report templates |
| [`src/components/FormReport.tsx`](src/components/FormReport.tsx) | Interactive report viewer for single submission records |
| [`src/components/print/PrintReport.tsx`](src/components/print/PrintReport.tsx) | Dedicated A4/PDF print renderer complying with DESIGN_UI_UX.md |
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
| 2026-08-27 | **Report Builder Implementation Complete:** Built 3-panel `ReportBuilder.tsx` authoring canvas, `reportCompute.ts` hybrid engine, `FormReport.tsx` single-record viewer with empty-state fallback, `PrintReport.tsx` A4 portal, and wired 4th `[Reports]` Hub in `Dashboard.tsx` and `App.tsx`. Verified with `npm run build`. |
| 2026-08-27 | **Finalized Architecture:** Locked in 5 core decisions: dedicated `report_templates` table, starter blocks (`TITLE`, `SECTION_LABEL`, `INFO_GRID`, `TABLE`, `SIGN`), blank page initialization, hybrid compute engine, and empty state fallback. |
