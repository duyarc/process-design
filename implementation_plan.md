# Implementation Plan: Process & Form Design Portal (Updated)

This implementation plan outlines the architecture for building the Process & Form Design Portal based on your feedback. It focuses on local CSV-based database storage, visual process/form creation, optimized A4 printing, and forward compatibility for roles management.

---

## Technical Design Choices

### 1. Database & Persistence: CSV in `/data`
To support local file-based database storage:
*   We will run a lightweight **Node/Express API server** in the background alongside Vite.
*   All processes will be saved in a dedicated **`d:\Code\antigravity\process-optimization\data\processes.csv`** file.
*   To handle multi-value fields (steps and form fields) within a clean, single-table CSV format without overcomplicating file syncs, we will serialize the `steps` and `formFields` arrays as JSON strings inside their respective CSV columns.

### 2. Forward-Compatible Role Management
*   We will implement a simple **`src/context/AuthContext.tsx`** that exports a `currentUser` state containing `{ id: '1', name: 'Default User', role: 'admin' }`.
*   All UI actions (editing, deleting, saving) will check user roles (e.g., `hasPermission('edit_process')`).
*   To add actual authentication later, we will only need to modify this context (e.g., by adding a login screen and connecting it to a backend LDAP or database), without changing any page layouts.

### 3. Simplified UI & Print Focus
*   We will remove classification tabs. The dashboard will show a clean, search-filtered list of all processes.
*   The primary goal is the editor interface (to quickly build the steps and form parameters) and the A4 print engine.

---

## Proposed Tech Stack

*   **Frontend:** React (TypeScript) + Vite
*   **Backend:** Node.js + Express (running on port 3001, proxied via Vite)
*   **Database:** Local CSV file writing (`csv-writer` and `csv-parser` or manual parsing) in the `/data` folder
*   **Diagrams:** `mermaid` (SVG rendering for swimlanes and processes)
*   **Icons:** `lucide-react`

---

## Proposed Changes

### [Backend Setup]

#### [NEW] [server.js](file:///d:/Code/antigravity/process-optimization/server.js)
A lightweight Node.js Express server to handle API routes:
*   `GET /api/processes` — Reads `/data/processes.csv`, parses records, deserializes JSON columns, and returns them as a JSON list.
*   `POST /api/processes` — Receives a process object, appends or updates the record in `/data/processes.csv`.
*   `DELETE /api/processes/:id` — Removes a process from the CSV.

#### [NEW] [data/processes.csv](file:///d:/Code/antigravity/process-optimization/data/processes.csv)
Initial CSV template with headers:
`id,title,description,version,lastUpdated,steps,formFields`

---

### [Frontend Setup]

#### [MODIFY] [package.json](file:///d:/Code/antigravity/process-optimization/package.json)
Add frontend and backend dependencies, along with dev command wrappers to start both servers.

#### [NEW] [vite.config.ts](file:///d:/Code/antigravity/process-optimization/vite.config.ts)
Vite setup with a dev server proxy targeting `http://localhost:3001` for `/api/*` paths.

#### [NEW] [src/context/AuthContext.tsx](file:///d:/Code/antigravity/process-optimization/src/context/AuthContext.tsx)
Mock auth provider establishing role checks.

#### [NEW] [src/types.ts](file:///d:/Code/antigravity/process-optimization/src/types.ts)
Definitions for:
*   `ProcessStep`: `id`, `role`, `action`, `warning`, `qualityCheck`, `envCheck`
*   `FormField`: `id`, `checkItem`, `locationCode`, `targetRange`, `reactionProtocol`, `frequency`
*   `Process`: `id`, `title`, `description`, `version`, `lastUpdated`, `steps`, `formFields`

#### [MODIFY] [src/index.css](file:///d:/Code/antigravity/process-optimization/src/index.css)
Style rules incorporating theme tokens from `DESIGN.md`.

#### [NEW] [src/print.css](file:///d:/Code/antigravity/process-optimization/src/print.css)
CSS rules specifically active during print, matching A4 rules.

#### [NEW] [src/components/Dashboard.tsx](file:///d:/Code/antigravity/process-optimization/src/components/Dashboard.tsx)
Dashboard containing list of processes, search bar, and action buttons.

#### [NEW] [src/components/ProcessEditor.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessEditor.tsx)
Process creation interface with:
*   Workflow details (title, description, version, sequential steps with roles)
*   Form builder (checksheets, specs, reactions)

#### [NEW] [src/components/ProcessReader.tsx](file:///d:/Code/antigravity/process-optimization/src/components/ProcessReader.tsx)
Reader interface with side-by-side Mermaid rendering of workflow swimlanes and visual checklist rendering, with a prominent **Print** button.

---

## Verification Plan

### Automated Checks
*   Verify that the TypeScript build succeeds: `npm run build`.

### Manual Verification
1.  **CSV Check:** Create a process inside the editor. Open `data/processes.csv` using a text viewer to verify that the record was correctly written with serialized steps/forms.
2.  **Role Readiness Check:** Temporarily change the role in `AuthContext` to `'viewer'`. Verify that the dashboard hides the "Create New Process" button and reader hides "Edit".
3.  **Visual Layout & Print Check:** Open print preview on a process. Verify it hides all buttons/headers, formats checklist tables cleanly, and renders the Mermaid diagram clearly on A4 page layout.
