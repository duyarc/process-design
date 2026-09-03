# Platform Shell — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Platform Shell |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Verified At Commit** | (2026-09-03) — Section 3 (Dashboard Stale-While-Revalidate caching with sessionStorage checked against Dashboard.tsx). |

### Quick File Index

| File | Role |
|---|---|
| [`src/App.tsx`](src/App.tsx) | Main orchestrator, routing, layout shell |
| [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx) | Landing page containing hub views (Processes, Forms, Submissions, Guide) |
| [`src/components/LoginPage.tsx`](src/components/LoginPage.tsx) | Authentication UI (Credentials & Google OAuth) |
| [`src/components/UserManagement.tsx`](src/components/UserManagement.tsx) | User administration and Role matrix view |
| [`src/context/AuthContext.tsx`](src/context/AuthContext.tsx) | Auth logic, JWT storage, RBAC definitions |

> **Update rule:** Whenever any of the above files is modified in a session, update
> the "Verified At Commit" field and add an entry to the [Change Log](#8-change-log) at the
> bottom of this document. See [`AGENTS.md`](AGENTS.md) for the full maintenance contract.

---

## 1. Purpose & Scope

### What This Module Does
The Platform Shell is the **foundational layer** that glues all other modules (Process Designer, Form Designer, Form Operations) together. It provides:

- **Authentication & Authorization**: Verifies user identity via credentials or Google OAuth, issues and stores JWT tokens, and manages Role-Based Access Control (RBAC).
- **Navigation & Routing**: Acts as the main router. Since the app uses conditional rendering instead of a formal router (like `react-router`), `App.tsx` manages the global state for the active view.
- **Global Dashboard**: Provides the central hub for users to find processes, forms, and submissions based on their permissions.
- **User Management**: Allows Administrators and Supervisors to create, edit, and disable user accounts.
- **Deep Linking**: Handles specific URL parameters to launch directly into the `FormFiller` module for shared form links.

### What This Module Does NOT Do
- **Does not edit processes or forms**: It delegates to `ProcessEditor.tsx` and `FormBuilder.tsx`.
- **Does not execute workflows**: It routes users to the appropriate tools (e.g., `FormFiller.tsx`).

---

## 2. User-Facing Features

### LoginPage
| Feature | Detail |
|---|---|
| **Credentials Login** | Standard username/password form calling `/api/auth/login`. |
| **Google OAuth** | "Đăng nhập bằng Google" button integrated via `@react-oauth/google`. |
| **Error Handling** | Displays explicit error messages from the backend on failure. |

### Dashboard
| Feature | Detail |
|---|---|
| **Multi-tab View** | Switches between "Processes" (default), "Forms", "Submissions", and "Guide". |
| **Processes Tab** | Lists available processes. Admins/Supervisors see "+ Process", everyone can view active flows. |
| **Forms Tab** | Lists all standalone forms. Allows managing or filling directly. |
| **Submissions Tab** | Embeds `SubmissionManager.tsx` for global record viewing. |
| **Guide Tab** | Embeds `BPMNGuide.tsx` (reference documentation for notation). |

### UserManagement
| Feature | Detail |
|---|---|
| **User List** | Displays all users with Role badges (Admin, Supervisor, Operator) and Status. |
| **User Editor Modal** | Allows creating or editing users (email, username, full name, role). Supervisors can only manage Operators. |
| **Role Matrix** | Read-only matrix mapping available `PermissionKey` values to `RoleId` columns for transparent governance. |

---

## 3. Component Map

```
Platform Shell
│
├── index.tsx / main.tsx    Mounts the React tree with <GoogleOAuthProvider>
│   └── App.tsx             Global state manager (PageId), URL parser
│       │
│       ├── AuthContext     Provides currentUser, roles, permissions, login/logout functions
│       │
│       ├── LoginPage       Displayed if currentUser is null
│       │
│       ├── Dashboard       Landing page (processes, forms, submissions, guide)
│       │
│       ├── UserManagement  User administration interface
│       │
│       └── [Other Modules] ProcessEditor, FormManager, FormFiller, etc.
```

### State-Based Routing (`PageId`)
`App.tsx` uses a union type `PageId` to manage the active view:
`'dashboard' | 'editor' | 'reader' | 'guide' | 'submissions' | 'form-manager' | 'fill-form' | 'user-management'`

---

## 4. Data Model

All auth-related types are defined in [`src/context/AuthContext.tsx`](src/context/AuthContext.tsx).

### `User` (`interface User`)
```typescript
export interface User {
  id: string;
  email?: string;
  username: string;
  password: string; // Plain text representation in UI (hashed in DB)
  full_name: string;
  title: string;
  role_id: RoleId;
  status: 'active' | 'inactive';
}
```

### `Role` & `RoleId`
```typescript
export type RoleId = 'admin' | 'supervisor' | 'operator';
```
Roles define the broad archetype of the user.

### `PermissionKey` (`export type PermissionKey`)
Fine-grained permissions mapped to roles via `RolePermissionsMatrix`:
- **Document Design**: `'view_document'`, `'design_document'`, `'version_document'`
- **Form Run**: `'fill_form'`, `'view_records'`, `'verify_records'`
- **User Management**: `'manage_users'`

---

## 5. Key Flows

### Flow A: Authentication
```
User enters credentials / clicks Google Login
  └─ AuthContext.login() / loginWithGoogle()
       ├─ POST /api/auth/login OR POST /api/auth/google
       ├─ On Success: Stores JWT in localStorage('jwt_token')
       ├─ Stores user object in localStorage('currentUser')
       └─ Updates AuthContext state -> App.tsx re-renders to Dashboard
```

### Flow B: Deep Link to Form Fill
```
User navigates to `/?page=fill&processId=123&formName=ABC`
  └─ App.tsx useEffect (on mount)
       ├─ Parses URLSearchParams
       ├─ Detects `qPage === 'fill'`
       ├─ Sets selectedProcessId and selectedFormName state
       └─ Sets page = 'fill-form' -> renders FormFiller module directly
```

### Flow C: Manage Users
```
Admin navigates to User Management
  └─ UserManagement.tsx mounts
       ├─ AuthContext fetches GET /api/users
       ├─ Renders list of users
       └─ Admin creates user -> POST /api/users -> Refreshes context
```

---

## 6. Module Interface (Boundary Contracts)

### 6.1 Props Accepted by Main Components

**Dashboard** (`src/components/Dashboard.tsx`)
Receives callbacks from `App.tsx` to handle navigation out of the Dashboard into specific modules (`onSelectProcess`, `onEditProcess`, `onOpenFormManager`, etc.).

**UserManagement** (`src/components/UserManagement.tsx`)
Self-contained component. Relies entirely on `useAuth()` to get the current list of users and permission checks.

### 6.2 API Endpoints Consumed

| Method | Endpoint | Used By | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/login` | AuthContext | Validate credentials, return JWT. Accepts **either** email or username in the same field. |
| `POST` | `/api/auth/check-email` | LoginPage | Email-first step: reports whether an account exists, driving progressive disclosure of the password vs. registration fields. |
| `POST` | `/api/auth/register` | LoginPage | Self-service account registration. |
| `POST` | `/api/auth/google` | AuthContext | Validate Google ID token, return JWT |
| `GET` | `/api/users` | AuthContext | Fetch user list (Admin/Supervisor only) |
| `POST` | `/api/users` | UserManagement | **Upsert.** Creates a user when `id` is absent from the body; updates that user when `id` is present. Password is preserved via `COALESCE` when omitted. |
| `DELETE` | `/api/users/:id` | UserManagement | Delete a user account |
| `GET` | `/api/processes` | Dashboard | Fetch processes for listing |
| `GET` | `/api/forms` | Dashboard | Fetch unlinked forms for listing |

> There is **no `PUT /api/users/:id`**. Updates go through the `POST /api/users` upsert
> described above. See [`DESIGN_BACKEND.md`](DESIGN_BACKEND.md) for the full endpoint surface.

---

## 7. Known Design Constraints & Technical Debt

| Issue | Impact | Notes |
|---|---|---|
| **No formal Router** | URL doesn't reflect state | Standard React apps use `react-router-dom` to make states bookmarkable. Here, `App.tsx` state handles it. Only `?page=fill` is explicitly parsed. |
| **Passwords handled in plain text in UI** | Security risk | `User` interface expects `password`. When editing users, the password is submitted. |
| **`useEffect` chaining in App.tsx** | Maintenance difficulty | Top-level state is complex. Prop-drilling occurs heavily as `App.tsx` must pass down all inter-module callbacks. |
| **Roles are hardcoded** | Extensibility limit | `RolePermissionsMatrix` is defined statically in `AuthContext.tsx`. Creating new roles requires a code change. |

---

## 8. Change Log

Architectural changes only — schema, contracts, invariants, routing structure. UI polish
lives in `git log`; run `git show <commit>` for the full diff of any entry below.

| Date | Commit | Change |
|---|---|---|
| 2026-07-27 | `f9271da` | Re-style LoginPage to the Master UI/UX Design System: all colors via CSS variables, Executive Paper Card layout. Establishes that shell UI must consume `DESIGN_UI_UX.md` tokens rather than local styles. |
| 2026-07-27 | `9a555cb` | **Auth flow change:** Email-First progressive disclosure across `LoginPage.tsx`, `AuthContext.tsx`, `server.cjs`. Adds `POST /api/auth/check-email` and `POST /api/auth/register` (self-service); login query now matches on either email or username. |
| 2026-07-24 | 9a6bb9aa | **Fill Form Navigation Fix in Forms Tab:** Connected missing `onOpenFormFiller` prop from `App.tsx` into `<Dashboard />` component and updated `handleFillAction` & `processSelectDialog` in `Dashboard.tsx` to route to online form filler screen (`FormFiller`) when clicking Fill Form (`PenTool`) button, resolving route collision with View Submissions (`History`) button. |
| 2026-07-28 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Sort Process Families by Last Update Descending:** Added `getFamilyTimestamp` sorting helper in `Dashboard.tsx` to sort process families descending by most recent `lastUpdated` timestamp across all versions, placing recently modified processes at the top of the Dashboard. |
| 2026-07-28 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | **Sort Forms List by Last Update Descending in Forms Tab:** Added `getFormTimestamp` sorting logic in `Dashboard.tsx` to sort `formsList` descending by latest `updated_at` timestamp (with tie-breaker by `formTitle` A-Z), placing recently updated form templates at the top of the Forms tab. |
| 2026-07-09 | `1385a38` | Fix ProcessReader back-navigation by explicitly calling `setPage('dashboard')` — a consequence of state-based routing with no formal router (see Section 7). |
| 2026-07-09 | `8df2f3c` | Document created. Initial full write based on codebase review. |
| 2026-08-27 | `CURRENT` | **Clean Path Routing for Form Fill (`/f/:identifier`):** Added direct route resolution in `App.tsx` matching `/f/:identifier`, calling `/api/forms/resolve/:identifier` to render `FormFiller` directly without lengthy query strings. |
| 2026-08-31 | `CURRENT` | **Unified Short-Link Loading State Coordination:** Added `isShortLinkFlow` prop coordination between `App.tsx` and `FormFiller.tsx` to eliminate redundant secondary loading screen when opening forms via short path `/f/:identifier`. |
| 2026-09-03 | `CURRENT` | **Dashboard Stale-While-Revalidate (SWR) Instant Paint:** Implemented sessionStorage-backed SWR caching in `Dashboard.tsx` for `processes`, `allForms`, and `reportTemplates`. Eliminates the 3.7s–5.3s "Loading processes database..." spinner on every browser refresh by initializing state synchronously from cache and revalidating silently in the background. |
