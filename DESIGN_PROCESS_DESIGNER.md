# Process Designer — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Process Designer |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Verified At Commit** | `001af74` (2026-07-27) — Sections 4, 4.5, 4.6 and 6 checked against source |

> **⚠️ Note:** Several architectural facts here are not obvious from the code — see Sections 4.5, 6.2, and 7.

### Quick File Index

| File | Role |
|---|---|
| [`src/components/ProcessEditor.tsx`](src/components/ProcessEditor.tsx) | Primary authoring UI — all four editor tabs |
| [`src/components/ProcessReader.tsx`](src/components/ProcessReader.tsx) | Read-only SOP viewer and print layout |
| [`src/components/BpmnModelerComponent.tsx`](src/components/BpmnModelerComponent.tsx) | Interactive BPMN diagram editor (drag & drop) |
| [`src/components/BpmnViewerComponent.tsx`](src/components/BpmnViewerComponent.tsx) | Read-only BPMN diagram renderer |
| [`src/components/BPMNGuide.tsx`](src/components/BPMNGuide.tsx) | BPMN notation reference guide (static content) |
| [`src/utils/bpmnXmlGenerator.ts`](src/utils/bpmnXmlGenerator.ts) | **Orchestrator** — imports sub-modules, renders final BPMN 2.0 XML string |
| [`src/utils/layout/types.ts`](src/utils/layout/types.ts) | Shared internal types for the layout engine sub-modules |
| [`src/utils/layout/gridLayout.ts`](src/utils/layout/gridLayout.ts) | **Module 1** — assigns each step to a (row, col) grid cell |
| [`src/utils/layout/linkEvents.ts`](src/utils/layout/linkEvents.ts) | **Module 2** — synthesises cross-row throw/catch link event pairs |
| [`src/utils/layout/nodePositioner.ts`](src/utils/layout/nodePositioner.ts) | **Module 3** — computes pixel bounding-boxes for all BPMN shapes |
| [`src/utils/layout/edgeRouter.ts`](src/utils/layout/edgeRouter.ts) | **Module 4** — computes sequence-flow waypoints (5 routing strategies) |
| [`src/utils/layout/documentPlacer.ts`](src/utils/layout/documentPlacer.ts) | **Module 5** — places document shapes with connector collision detection |
| [`src/types.ts`](src/types.ts) | Shared TypeScript types — `Process`, `ProcessStep`, `SOPSignOffs`, etc. |

> **Update rule:** Whenever any of the above files is modified in a session, update
> the "Verified At Commit" field and add an entry to the [Change Log](#8-change-log) at the bottom
> of this document.

---

## 1. Purpose & Scope

### What This Module Does
The Process Designer is the **authoring and publishing system for Standard Operating Procedures (SOPs)**.

It lets authorized users:
- Create a new SOP document with a structured process ID, title, description, and sign-off table.
- Define a sequential workflow as a list of **steps**, each assigned to a **role** and a **BPMN shape** (task, gateway, start/end event).
- Visualize the workflow as a live **BPMN 2.0 swimlane diagram**, with either auto-generated or custom drag-and-drop layout.
- Link **Form templates** (from the Form Designer module) to specific workflow steps that produce paperwork.
- Manage **versioning**: Draft → Pending Review → Active → Superseded / Retired.
- Read, navigate between versions, and **print** a formatted SOP document.

### What This Module Does NOT Do
- **Does not design form templates** — form layout (blocks, fields, specs) belongs to the Form Designer module (`FormBuilder.tsx`). Process Designer only references forms by `formId`.
- **Does not collect or store form submissions** — that is the Form Operations module (`FormFiller.tsx`, `FormManager.tsx`).
- **Does not manage users or permissions** — that is the Platform shell (`UserManagement.tsx`, `AuthContext.tsx`).

---

## 2. User-Facing Features

### In ProcessEditor (Authoring Mode)

| Tab | What the user can do |
|---|---|
| **Description** | Set Process ID, Title, Description, Roles list, Sign-off table (Author / Reviewer / Authoriser + Effective Date) |
| **Workflow** | Add / reorder / remove steps; set role + action per step; set BPMN shape; define gateway branch targets; toggle form-producing flag per step; switch between auto-layout and custom drag-and-drop BPMN layout |
| **Form** | See all forms linked to steps; open Form Designer (modal overlay) to build or view a form; upload a legacy PDF attachment per form |
| **Versions** | Browse all versions in the same SOP family; change lifecycle status (Submit for Review, Activate, Retire); create a new Draft from the current Active version; delete a Draft |

### In ProcessReader (Read / Print Mode)

| Action | Detail |
|---|---|
| **View SOP** | Full document layout: header with title/version badge/status, BPMN diagram, Approvals table |
| **Switch Version** | Dropdown to navigate between versions of the same SOP family |
| **Edit / View button** | Opens ProcessEditor for the selected version (Edit if Draft, View if locked) |
| **Print** | Browser print dialog; title block, BPMN diagram, and Approvals table are printed; interactive controls are hidden via `no-print` class |

---

## 3. Component Map

```
Process Designer Module
│
├── ProcessEditor.tsx          Shell + all four tab panels (Description, Workflow, Form, Versions)
│   ├── BpmnModelerComponent   Interactive BPMN drag-and-drop editor (custom layout mode)
│   ├── BpmnViewerComponent    Read-only BPMN diagram (auto-layout mode preview inside editor)
│   └── FormBuilder            [BRIDGE] Form Designer modal, launched from the Form tab
│
├── ProcessReader.tsx          SOP viewer + print layout
│   ├── BpmnViewerComponent    Read-only BPMN diagram in the SOP document
│   └── PrintBlankForm         [BRIDGE] Form Operations print component (blank form printout)
│
├── BpmnModelerComponent.tsx   Wraps bpmn-js Modeler; exposes getPositions() via ref
├── BpmnViewerComponent.tsx    Wraps bpmn-js Viewer; auto-fits diagram; re-renders on print
├── BPMNGuide.tsx              Static reference page explaining BPMN notation
└── utils/bpmnXmlGenerator.ts  Converts ProcessStep[] → valid BPMN 2.0 XML string
```

### Component Responsibilities (Single Sentence Each)

- **ProcessEditor** — Owns all mutable editor state and coordinates saving, versioning, and launching sub-components.
- **ProcessReader** — Fetches a process by ID (read-only), renders the SOP document layout, and handles inline form-filling and print triggers.
- **BpmnModelerComponent** — Renders a fully interactive `bpmn-js` modeler canvas; exposes element positions back to ProcessEditor via `useImperativeHandle`.
- **BpmnViewerComponent** — Renders a read-only `bpmn-js` viewer that auto-fits the diagram and re-renders correctly before the browser print dialog.
- **BPMNGuide** — A static educational page about BPMN 2.0 shapes used in this project.
- **bpmnXmlGenerator** — A pure stateless function with no React dependency; maps the app's `ProcessStep[]` data model into a valid BPMN 2.0 XML document string.

---

## 4. Data Model

### Core Type: `Process`
Defined as `interface Process` in [`src/types.ts`](src/types.ts).

```typescript
interface Process {
  id: string;                     // Unique version ID (e.g. "QC-PROC-001")
  parentProcessId: string;        // SOP family ID — all versions share this
  status: 'Draft' | 'Pending Review' | 'Active' | 'Superseded' | 'Retired';
  title: string;
  description: string;
  version: string;                // Integer string, e.g. "1", "2", "3"
  lastUpdated: string;            // ISO timestamp
  roles: string[];                // Swimlane role names, e.g. ["Operator", "QC Lead"]
  steps: ProcessStep[];
  formFields: FormField[];        // Legacy simple checklist fields (pre-ISO)
  sopSignoffs?: SOPSignOffs;      // Author / Reviewers / Authorisers + effective date
  workflowFormsData?: {           // Form references keyed by formId
    [formId: string]: {
      formId?: string;
      formTitle?: string;
      version?: string;
      status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      pdfName?: string;           // Optional legacy PDF attachment
      pdfUrl?: string;
      pdfKey?: string;            // Cloudflare R2 object key
      pdfSize?: number;
    }
  };
}
```

### Core Type: `ProcessStep`
Defined as `interface ProcessStep` in [`src/types.ts`](src/types.ts).

```typescript
interface ProcessStep {
  id: string;                      // Unique step ID (e.g. "step_1749123456789abc")
  role: string;                    // Must match one of Process.roles
  action: string;                  // Human-readable step description
  bpmnShape?: 'task' | 'exclusive-gateway' | 'start-event' | 'end-event' | 'message-end-event';
  nextStepId?: string;             // Default sequential connection
  branchYesLabel?: string;         // For exclusive-gateway: Yes branch label
  branchYesTargetId?: string;      // For exclusive-gateway: Yes branch target step ID
  branchNoLabel?: string;
  branchNoTargetId?: string;
  producesForm?: boolean;          // If true, this task step creates a form record
  formName?: string;               // Primary formId (legacy single-form reference)
  formNames?: string[];            // Multi-form reference list (current standard)
  // Custom BPMN layout coordinates (set when user drags elements):
  layoutX?: number;
  layoutY?: number;
  layoutWaypointsMap?: { [targetStepId: string]: { x: number; y: number }[] };
  layoutCatchWaypoints?: { x: number; y: number }[];
  labelX?: number; labelY?: number; labelW?: number; labelH?: number;
}
```

### Version Family Model

All versions of the same SOP share the same `parentProcessId`. The `id` of the first version equals the `parentProcessId`. Subsequent draft versions get a unique `id` but carry the same `parentProcessId`.

```
parentProcessId = "QC-PROC-001"

  id: "QC-PROC-001"   version: "1"  status: Superseded
  id: "QC-PROC-001_v2" version: "2" status: Active
  id: "QC-PROC-001_v3" version: "3" status: Draft
```

Siblings are fetched by filtering: `list.filter(p => p.parentProcessId === pid || p.id === pid)`.

### BPMN Layout Mode

| Mode | Stored Data | Description |
|---|---|---|
| `'auto'` | No `layoutX`/`layoutY` on steps | `bpmnXmlGenerator` places elements automatically using fixed-grid logic |
| `'custom'` | `layoutX`, `layoutY`, `layoutWaypointsMap` on steps | User has dragged elements; coordinates are persisted to the DB |

The current mode is detected on load: `const hasCustomLayout = loadedSteps.some(s => s.layoutX !== undefined)`.

### 4.5 Form–Process Linkage Architecture ⚠️ Critical Notes

> These facts were confirmed by deep codebase research on 2026-07-14 and are essential for future sessions.

#### How linkage is stored

Forms are linked to a process via **two places** — both derived from the same source of truth:

1. **`processes` table JSONB column `workflowFormsData`** — a dictionary keyed by `formId`:
   ```json
   { "3S-QC/F1.1": { "formId": "3S-QC/F1.1", "formTitle": "...", "version": "v1.0", "status": "ACTIVE" } }
   ```
2. **`ProcessStep.formNames[]`** — each task step lists the formIds it produces.
3. **`process_forms` junction table** (DB) — synced automatically by `syncProcessForms()` during every `POST /api/processes` call. This is a relational shadow copy, NOT the source of truth.
4. **`forms` table** — stores the form template itself. **No `linked_process_id` column exists** — the `forms` table has no back-reference to any process.

#### How linkage is computed (client-side)

**`workflowForms[]`** — the active form list used in the Forms tab — is derived at **render time** from `steps` state, NOT stored:
```ts
const workflowForms: string[] = [];
steps.forEach(s => {
  if (s.bpmnShape === 'task' && s.producesForm) {
    const names = s.formNames?.length > 0 ? s.formNames : (s.formName ? [s.formName] : []);
    names.forEach(name => { if (!workflowForms.includes(name)) workflowForms.push(name); });
  }
});
```

**Dashboard `linkedProcesses[]`** — computed client-side by scanning ALL process records:
```ts
const linkedProcs = processes.filter(proc =>
  allVersions.some(p => {
    const hasInWfd = wfd && Object.values(wfd).some(fdata => fdata.formId === formId);
    const hasInSteps = steps && steps.some(s => s.producesForm && s.formNames.includes(formId));
    return hasInWfd || hasInSteps;
  })
);
```

#### ⚠️ `handleSave` cleanup — only path that removes orphaned forms

`handleSave` is the **ONLY** save path that cleans up `workflowFormsData`. It:
1. Collects `activeFormNames` from current `steps` (only forms still referenced by a step).
2. Builds `cleanedFormsData` — keeps only forms in `activeFormNames`.
3. Saves `workflowFormsData: cleanedFormsData` to DB.

**All other save paths** (`handleSubmitForReview`, `handleActivateVersion`, `handleRetireVersion`, `handleReactivateVersion`, `handleSaveBpmnLayout`, `handleResetBpmnPositions`) send the **raw `workflowFormsData` state** without cleanup. If a form is unlinked from steps but one of these is triggered before `handleSave`, the orphaned entry survives in DB.

#### ⚠️ `handleSave` race condition with steps state

`handleSave` reads `steps` from React closure:
```ts
const filteredSteps = steps.filter(s => s.action.trim() !== '');
```
If `setSteps(updatedSteps)` is called right before `await handleSave(...)`, React may not have flushed the update yet → `handleSave` reads stale steps.

**Fix pattern** (added 2026-07-14): Use `pendingStepsRef = useRef<ProcessStep[] | null>(null)`.
- Caller sets `pendingStepsRef.current = updatedSteps` before calling `handleSave`.
- `handleSave` reads `stepsSource = pendingStepsRef.current ?? steps; pendingStepsRef.current = null;`.

#### `normalizeProcessFormsData` migration function

Legacy process records used human-readable form names (e.g. `"Inspection Sheet"`) as `workflowFormsData` keys instead of `formId`s. `normalizeProcessFormsData()` migrates these on load:
- Maps old name-keys → formId-keys using `val.formId || key`.
- Also normalizes `step.formName`/`step.formNames` from old names to IDs.

---

## 4.6 BPMN Auto-Layout Engine Architecture

> **Added 2026-07-20.** `bpmnXmlGenerator.ts` was refactored from a 1,000-line monolith into a thin orchestrator backed by 5 focused sub-modules in `src/utils/layout/`.

### Pipeline Overview

```
generateBPMNXML(steps, title, roles, rowFilter?)
  │
  ├── [Module 1] gridLayout.ts       → stepRows[], stepCols[], layoutNodes[], originalFlows[]
  │        Assigns each ProcessStep to a (row, col) cell.
  │        Wraps to a new row after 6 columns (COLS_PER_ROW).
  │        Gateways always force a column increment.
  │
  ├── [Module 2] linkEvents.ts       → allNodes[], finalFlows[]
  │        For each forward cross-row flow, synthesises a
  │        Throw Link Event (col 6, end of source row) and a
  │        Catch Link Event (col 0, start of target row).
  │        Backward loops (row A > row B) are kept as physical curved lines.
  │
  ├── [Module 3] nodePositioner.ts   → nodePositions: Map<id, Rect>, labelPositions
  │        Converts (row, col) grid cells to pixel (x, y, w, h) coordinates.
  │        Respects custom drag-and-drop positions stored in step.layoutX/Y.
  │        computeMaxRightEdge() called on full node set for uniform pool width.
  │
  ├── [Module 4] edgeRouter.ts       → edgeWaypoints: Map<flowId, WP[]>, allEdgeSegments[]
  │        Routes sequence flows using one of 5 strategies:
  │          1. backward-loop        — target row < source row
  │          2. vertical-aligned     — same X center (±35px)
  │          3. forward-straight     — left→right, same Y (±5px)
  │          4. forward-elbow        — left→right, different Y (cross-lane)
  │          5. backward-horizontal  — fallback loop
  │        Also emits allEdgeSegments[] (all waypoint-to-waypoint segments)
  │        for use by documentPlacer collision detection.
  │
  └── [Module 5] documentPlacer.ts  → DocumentPlacement[]
           Places DataObjectReference shapes (document icons) for form-producing
           task steps. Uses Direction A collision detection:
             - 6 candidate positions are tried in priority order.
             - First collision-free candidate wins (4px clearance margin).
             - Collision check skipped when step.formLayouts[formName] exists
               (user has manually positioned the shape — respect it).
           Association edge waypoints are computed from the chosen position.
```

### Layout Constants (`layout/types.ts: DEFAULT_LAYOUT_CONSTANTS`)

| Constant | Value | Description |
|---|---|---|
| `laneHeight` | 160px | Height of one role swimlane |
| `rowSpacing` | 80px | Vertical gap between page rows |
| `nodeWidth` | 110px | Task box width |
| `nodeHeight` | 80px | Task box height |
| `circleSize` | 36px | Event circle diameter |
| `gatewaySize` | 50px | Gateway diamond size |
| `startX` | 220px | X offset of grid column 0 from pool left edge |
| `spacingX` | 180px | Horizontal spacing between grid columns |

### Document Shape Candidate Positions

Tried in order by `documentPlacer.ts` until a collision-free position is found:

| Priority | Placement Strategy | Connector Routing | Relative Label Position |
|---|---|---|---|
| 1 (default) | **Middle-Right** (horizontally aligned with task center) | Straight horizontal line (no turns) from task right-center to doc left-center | Above document shape |
| 2 | **Top-Center** (fallback) | Straight vertical line from task top-center to doc bottom-center | Above document shape |
| 3 | **Below-Center** (fallback) | Straight vertical line from task bottom-center to doc top-center | Above document shape |
| 4 | **Middle-Left** (fallback) | Straight horizontal line from task left-center to doc right-center | Above document shape |

### Public API (unchanged)

| Export | Signature | Consumers |
|---|---|---|
| `getNumRows` | `(steps: ProcessStep[]) → number` | `ProcessEditor.tsx` |
| `generateBPMNXML` | `(steps, title, roles, rowFilter?) → string` | `ProcessEditor.tsx`, `ProcessReader.tsx`, `BpmnViewerComponent.tsx` |

---


### Flow A: Open an Existing Process in the Editor

```
App.tsx: page='editor', processId='QC-PROC-001'
  └─ ProcessEditor mounts
       ├─ useEffect [processId] fires
       │    ├─ fetch('/api/forms')           → sets allForms[]
       │    ├─ fetch('/api/processes')       → gets full list
       │    │    └─ finds matching process by id
       │    ├─ normalizeProcessFormsData()   → migrates legacy form-name keys to formId keys
       │    ├─ enforceStepShapes()           → corrects any invalid BPMN shape assignments
       │    ├─ sets all state: title, description, version, status, roles, steps, workflowFormsData, sopSignoffs, signoffRows
       │    └─ loads sibling versions for Versions tab
       └─ BPMN XML generated via generateBPMNXML(steps, title, roles) in separate useEffect (debounced 500ms)
```

### Flow B: Save a Draft Process

```
User clicks Save button
  └─ handleSave() runs
       ├─ Validates: title not empty, processId format valid, no duplicate ID
       ├─ Validates: at least one non-empty step
       ├─ If custom layout mode: reads current positions from modelerRef.current.getPositions()
       ├─ Cleans workflowFormsData: removes entries for forms no longer referenced in steps
       ├─ Converts flat signoffRows → structured SOPSignOffs
       └─ POST /api/processes  { id, parentProcessId, status, title, description, version, roles, steps, formFields, sopSignoffs, workflowFormsData }
            └─ on success: calls onSaveSuccess(saved.id)
                 └─ App.tsx: setSelectedProcessId(id), shows Toast notification, stays on editor page
```

### Flow C: Version Lifecycle Transitions

All status transitions follow the same pattern — build the same full process payload, add the target `status`, then `POST /api/processes`.

```
Draft ──[handleSubmitForReview]──→ Pending Review
Pending Review ──[handleActivateVersion]──→ Active  (requires effectiveDate to be set)
Active ──[handleCreateNewDraftEditor]──→ creates new Draft via POST /api/processes/:id/new-version
                                          └─ App.tsx: setSelectedProcessId(newDraft.id), stays on editor
Active / Pending Review ──[handleRetireVersion]──→ Retired
Draft ──[handleDeleteProcess]──→ deleted permanently via DELETE /api/processes/:id
```

### Flow D: Open Form Designer from the Form Tab

```
User clicks Edit / View button next to a form in the Form tab
  └─ ProcessEditor sets activeFormToBuild = formId (e.g. "FM-QC-F01")
       └─ FormBuilder modal renders (fixed overlay, z-index 1000)
            ├─ initialData resolved (priority order):
            │    1. Live record from allForms[] (fetched from DB)
            │    2. workflowFormsData[formId] (local state fallback)
            │    3. Blank new form with that formId
            └─ On FormBuilder.onSave(savedFormData):
                 ├─ Updates workflowFormsData[formId] in local state
                 ├─ Silently saves the process (handleSave(nextFormsData, isSilent=true))
                 ├─ Re-fetches allForms list
                 └─ Closes modal (setActiveFormToBuild(null))
                      OR calls onCancel() if exitOnCloseForm=true (launched from Dashboard)
```

### Flow E: Read and Print an SOP

```
App.tsx: page='reader', processId='QC-PROC-001'
  └─ ProcessReader mounts
       ├─ fetch('/api/forms')       → sets allForms[] for form version display
       ├─ fetch('/api/processes')   → fetches the specific process by id
       └─ fetch('/api/processes')   → fetches all versions in the family
            └─ Renders:
                 ├─ Header card: title, version dropdown, status badge, Edit/View/Print buttons
                 ├─ BpmnViewerComponent: live BPMN diagram from generateBPMNXML(steps)
                 └─ Approvals card: sopSignoffs table

User clicks Print button
  └─ window.print()
       ├─ CSS @media print hides .no-print elements (buttons, navbar)
       ├─ BpmnViewerComponent: beforeprint event fires → refits diagram for paper
       └─ Print-only elements become visible: static version text (replacing dropdown)
```

### Flow F: Switch Between SOP Versions (Reader)

```
User selects a different version from the dropdown in ProcessReader
  └─ onSwitchVersion(selectedId) callback fires
       └─ App.tsx: setSelectedProcessId(selectedId)
            └─ ProcessReader re-renders with new processId prop
                 └─ re-fetches process and all versions
```

---

## 6. Module Interface (Boundary Contracts)

### 6.1 Props Accepted from App.tsx (Shell)

**ProcessEditor** (`interface ProcessEditorProps` in [`src/components/ProcessEditor.tsx`](src/components/ProcessEditor.tsx))

| Prop | Type | Description |
|---|---|---|
| `processId` | `string \| null` | ID of the process to load. `null` = create new |
| `onCancel` | `() => void` | Called when user cancels or deletes; App navigates back |
| `onSaveSuccess` | `(id: string) => void` | Called after a successful save; App shows toast, stays on editor |
| `onOpenDraft` | `(id: string) => void` | Called after a new draft version is created; App reloads editor with new ID |
| `initialTab` | `'description' \| 'workflow' \| 'form' \| 'versions' \| undefined` | Which tab to open on mount |
| `initialFormToBuild` | `string \| null` | If set, auto-opens FormBuilder for this formId on mount |
| `onClearInitialEditOpts` | `() => void` | Called on mount to clear initial tab/form state in App |
| `exitOnCloseForm` | `boolean` | If true, closing FormBuilder calls onCancel() instead of returning to editor |

**ProcessReader** (`interface ProcessReaderProps` in [`src/components/ProcessReader.tsx`](src/components/ProcessReader.tsx))

| Prop | Type | Description |
|---|---|---|
| `processId` | `string` | ID of the process version to display |
| `onBack` | `() => void` | Called when user clicks Back |
| `onEdit` | `(id: string, tab?: 'description' \| 'workflow' \| 'form', formName?: string \| null) => void` | Called when user clicks Edit/View; App opens ProcessEditor, optionally on a specific tab or form |
| `initialPrintFormName` | `string \| null` (optional) | If set, triggers print dialog for this form on mount |
| `onClearPrintForm` | `() => void` (optional) | Clears the initialPrintFormName in App after use |
| `onSwitchVersion` | `(id: string) => void` | Called when user selects a different version from the dropdown |

### 6.2 Props Passed to FormBuilder (Form Designer Bridge)

FormBuilder is rendered as a modal overlay inside ProcessEditor, guarded by the
`activeFormToBuild` state (search for `<FormBuilder`).

> **Note:** `formName` prop is always the `formId` string — these are the same value. The legacy prop name `formName` is a historical artifact.

| Prop | Type | Value Provided |
|---|---|---|
| `formName` | `string` | The active `formId` (e.g. `"FM-QC-F01"`). Always equals `formId`. |
| `initialData` | `object` | Resolved from allForms DB → workflowFormsData local state → blank fallback |
| `onSave` | `(savedFormData) => void` | Updates workflowFormsData, silently saves process, re-fetches forms list, closes modal |
| `onClose` | `() => void` | Closes modal without saving |
| `linkedProcessId` | `string \| undefined` | *(Added 2026-07-14)* Passed when `processId !== null && !== 'unlinked'`. FormBuilder uses this to lock the Form ID input field. |
| `onUnlinkFromProcess` | `() => Promise<boolean>` | *(Added 2026-07-14)* Callback to trigger unlink: removes form from all steps + workflowFormsData + auto-saves process. Returns `true` on success. FormBuilder stays open (user continues editing as standalone). |

### 6.3 API Endpoints Consumed

All calls are made via inline `fetch()` within `ProcessEditor.tsx` and `ProcessReader.tsx`.
Base URL: relative path (proxied via Vite dev server to `http://localhost:3001`).

| Method | Endpoint | Used By | Purpose |
|---|---|---|---|
| `GET` | `/api/processes` | Editor, Reader | Load all process records (filtered client-side by ID) |
| `POST` | `/api/processes` | Editor | Create or update a process (upsert by ID) |
| `DELETE` | `/api/processes/:id` | Editor | Delete a draft version |
| `POST` | `/api/processes/:id/new-version` | Editor | Clone current version into a new Draft |
| `GET` | `/api/processes/check-id` | Editor | Validate uniqueness of a process ID before save |
| `GET` | `/api/forms` | Editor, Reader | Fetch all form templates (for display and FormBuilder initialData) |
| `GET` | `/api/forms/:formId` | Editor (new process init) | Load a specific form template when opening a blank process with a pre-set form |
| `GET` | `/api/storage/quota-status` | Editor | Display cloud storage usage in the Form tab |
| `POST` | `/api/storage/presign-upload` | Editor, Reader | Get a pre-signed URL to upload a PDF or photo to Cloudflare R2 |
| `PUT` | `(presigned R2 URL)` | Editor, Reader | Direct upload to Cloudflare R2 |
| `POST` | `/api/storage/confirm-upload` | Editor | Save R2 file key + metadata to the database |
| `DELETE` | `/api/storage/delete-file` | Editor | Delete a PDF attachment from R2 and the database |
| `GET` | `/api/storage/download-url` | Reader | Get a pre-signed download URL for a PDF attachment |
| `POST` | `/api/submissions` | Reader | Submit a completed form fill record |

---

## 7. Known Design Constraints & Technical Debt

| Issue | Impact | Notes |
|---|---|---|
| **ProcessEditor is a monolith** | Hard to navigate, high risk of cross-tab side effects | All four tabs are inline JSX in one 2,804-line file. No sub-component isolation. |
| **FormBuilder is also a monolith** | Same as above | 173KB single file. Launched inside ProcessEditor as a modal. |
| **All API calls are inline `fetch()`** | No centralized error handling or request caching | Calls are scattered across ~15 functions inside the component body |
| **No custom hooks** | State and side effects are mixed with render logic | There are 20+ `useState` declarations at the top of ProcessEditor with no grouping |
| **Global styles only** | No scoped or module CSS for this module | All styles live in `src/index.css` and `src/print.css` |
| **`window.alert()` and `window.confirm()` still used in editor** | Blocking browser dialogs disrupt UX flow | Save success was migrated to Toast; version actions and errors still use native dialogs |
| **`fetch('/api/processes')` loads ALL processes** | N+1 scalability risk as the dataset grows | The editor finds the target process by scanning the full list client-side, not by fetching a single record |
| **Legacy `formName` / `formNames` normalization** | Code complexity | `normalizeProcessFormsData()` exists to migrate older data where form names (strings) were used instead of `formId` references |
| **`isReadOnly` tied only to `status !== 'Draft'`** | Permission check is incomplete | `isReadOnly` uses only the status field; `hasPermission('design_document')` is checked separately in the JSX, which is inconsistent |
| **Only `handleSave` cleans orphaned `workflowFormsData`** | Stale form entries can persist if user triggers non-Save actions after unlinking | `handleSubmitForReview`, `handleActivateVersion`, BPMN save, etc. send raw state. See Section 4.5. |
| **`workflowForms[]` is render-time derived** | Easy to forget this is NOT a stored state variable | Derived from `steps` on every render; changing `steps` automatically changes the Forms tab list. |
| **No `linked_process_id` on `forms` table** | Cannot query "which process uses this form" at DB level | Linkage is resolved client-side by scanning all process records (Dashboard) or from ProcessEditor context (FormBuilder). |

---

## 8. Change Log

Architectural changes only — schema, interface contracts, invariants, and layout-engine
structure. UI polish and styling tweaks live in `git log`; run `git show <sha>` for the
full diff of any entry below.

| Date | Commit | Change |
|---|---|---|
| 2026-07-09 | `8df2f3c` | Document created. Initial full write based on codebase review. |
| 2026-07-09 | `8df2f3c` | Auto-sync custom BPMN layout coordinates to React state on tab switch, so manual drags are not lost when leaving the modeler tab. |
| 2026-07-09 | `1385a38` | Added `initialTriggerPrint` prop to ProcessReader for print-on-mount, with auto-navigation back to Dashboard when the print dialog closes. |
| 2026-07-09 | `bc3c04e` | Fixed TypeScript build errors in BpmnModelerComponent (unused `RotateCcw`, `onReset`, missing filter type) and ProcessReader (unused `attachmentText`). |
| 2026-07-14 | `57c64ee` | Replaced the PDF upload block with a Print button and PrintBlankForm integration in ProcessEditor. |
| 2026-07-14 | `e02e99d` | **Interface change:** added `linkedProcessId` and `onUnlinkFromProcess` to the FormBuilder bridge (Section 6.2). Implemented the Form ID lock and unlink flow. |
| 2026-07-14 | `e02e99d` | **Invariants documented (Section 4.5):** `workflowFormsData` cleanup happens only in `handleSave`; the `process_forms` junction table and derived `workflowForms` list; `normalizeProcessFormsData()` legacy key migration; and the `handleSave` stale-`steps` race fixed via `pendingStepsRef`. |
| 2026-07-20 | `02aa7a9` | **Refactor:** `bpmnXmlGenerator.ts` split from a ~1,000-line monolith into 5 sub-modules under `src/utils/layout/` (`gridLayout`, `linkEvents`, `nodePositioner`, `edgeRouter`, `documentPlacer`). Public API (`getNumRows`, `generateBPMNXML`) unchanged. Section 4.6 added. |
| 2026-07-29 | `9a6bb9a` | **BPMN Export Toolset:** (1) Added `src/utils/bpmnExportUtils.ts` providing `copyBpmnToClipboard` (PNG with opaque white background `#ffffff` at 2x High-DPI 300 DPI for 1-Click `Ctrl+V` MS Word paste) and `downloadBpmnVectorFile` (raw `.svg` vector export). (2) Updated `BpmnViewerComponent.tsx` and `BpmnModelerComponent.tsx` with concise `[ 📋 Copy ]` and `[ 📥 Download ]` action buttons and Toast notifications. |
| 2026-07-20 | `02aa7a9` | **Layout algorithm:** document shapes now try 6 candidate positions and pick the first that does not intersect any sequence-flow edge segment (4px clearance). Manually dragged shapes bypass the check. Fixes connectors cutting through document shapes. |
| 2026-07-20 | `0529624` | Document shapes default to middle-right of their task shape with a straight horizontal connector to the document's middle-left; labels stay above the shape. Touches `types.ts`, `documentPlacer.ts`, `bpmnXmlGenerator.ts`. |
| 2026-07-20 | `d2c7104` | Candidate position synced across all forms of a single step, preventing overlaps with other task nodes. |
| 2026-07-20 | `11118db` | **Bug fix:** removed double subtraction of `rowFilter * rowOffset` in the `documentPlacer` auto path — auto positions are computed from already-shifted task positions, so subtracting again floated document shapes into blank page gaps. |
| 2026-07-20 | `071c395` | **Bug fix:** BpmnViewerComponent now counts actual unique row values in the XML rather than max row index, preventing spurious page-divider dashed lines at y=0 on single-page views. |
| 2026-07-23 | `4f741e4` | **Schema change:** retired the `frequency` property — removed initialization in ProcessEditor and the Frequency column and badge from ProcessReader. |
| 2026-07-23 | `88d96bd` | SOP PDF filenames standardized to Digital 5S rules via `to5SFileName()`, producing `SOP_[Normalized_Title]`. |
| 2026-07-18 | `24d0ea5` | Process description preserves newlines in ProcessReader via `whiteSpace: 'pre-line'`. |
