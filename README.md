# Quality Management System (Process Optimization Platform)

A digital platform designed to digitize, author, and track operational workflows and quality checklists on the shop floor. It replaces physical paper trails with digital processes, offering dynamic form builders, visual process mapping (BPMN), and secure cross-role sign-offs.

---

## 🏗️ System Architecture

The project is divided into five distinct functional modules, each governed by its own architectural design document. The file → document ownership map lives in [AGENTS.md](./AGENTS.md).

### 1. [Platform Shell](./DESIGN_PLATFORM_SHELL.md)
The foundational layer and main entry point of the application.
- **Responsibilities:** Authentication, Global Routing & Dashboard, Role-Based Access Control (RBAC), and User Administration.
- **Key Components:** `App.tsx`, `Dashboard.tsx`, `AuthContext.tsx`.

### 2. [Process Designer](./DESIGN_PROCESS_DESIGNER.md)
The authoring tool for mapping visual business workflows.
- **Responsibilities:** Creating and editing BPMN diagrams (bpmn.io), linking operational steps to forms, versioning workflows, and displaying an interactive read-only viewer for operators.
- **Key Components:** `ProcessEditor.tsx`, `ProcessReader.tsx`, `BpmnModelerComponent.tsx`.

### 3. [Form Designer](./DESIGN_FORM_DESIGNER.md)
The authoring tool for creating dynamic templates (checklists, parameter sheets, matrices).
- **Responsibilities:** Drag-and-drop block layout configuration, configuring field validation (min/max spec, reactions), and locking form versions for compliance.
- **Key Components:** `FormBuilder.tsx`, `PrintBlankForm.tsx`.

### 4. [Form Operations](./DESIGN_FORM_OPERATIONS.md)
The execution and tracking layer for running processes on the floor.
- **Responsibilities:** Digital fill-out of forms, capturing photo evidence (QMS protocol), real-time pass/fail evaluation, logging submissions, and supervisor verification sign-off.
- **Key Components:** `FormFiller.tsx`, `FormManager.tsx`, `SubmissionManager.tsx`.

### 5. [Report Builder](./DESIGN_REPORT_BUILDER.md)
The reporting and insights layer for transforming completed form records.
- **Responsibilities:** 4-stage processing pipeline (Source → Compute → Layout → Distribute), 1-to-1 Record Reports (inspection scorecards, compliance certificates), spec tolerance evaluations, and A4 print export.
- **Key Components:** *(Components TBD)*.

### 6. [Backend & Persistence](./DESIGN_BACKEND.md)
The Express API server backing all frontend modules.
- **Responsibilities:** 30 REST endpoints, Postgres/Supabase schema and migrations, Cloudflare R2 presigned upload and cleanup, JWT issuance, and CSV offline fallback.
- **Key Components:** `server.cjs`, `api/index.js`.

---

## 🎨 Design & UI Guidelines

All visual decisions, typography, theming, and layout constraints are documented in:
👉 **[DESIGN_UI_UX.md](./DESIGN_UI_UX.md)**

---

## 🛠️ Technology Stack

- **Core:** React 18, TypeScript, Vite
- **Styling:** Vanilla CSS (CSS Variables for theming, Glassmorphism design)
- **Icons:** `lucide-react`
- **Workflow Modeler:** `bpmn-js`
- **Authentication:** Custom JWT-based + Google OAuth (`@react-oauth/google`)
- **Backend/API:** Node.js Express server (`server.cjs`)
- **Storage:** Supabase (Database), Cloudflare R2 (Media/Logos)

---

## 🚀 Setup & Local Development

### Prerequisites
- Node.js (v18+)
- Local `.env` file containing Supabase and Cloudflare R2 secrets.

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the local development environment:**
   The project uses `concurrently` to run both the Vite frontend and Node Express backend simultaneously.
   ```bash
   npm run dev
   ```

3. **Access the application:**
   - Frontend: `http://localhost:5173` (or port specified by Vite)
   - Backend API: `http://localhost:3000`

### Production Build
To create an optimized production bundle:
```bash
npm run build
```
