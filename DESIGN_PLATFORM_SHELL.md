# Platform Shell — Module Design Document

---

## Header Block

| Field | Value |
|---|---|
| **Module Name** | Platform Shell |
| **Status** | Active Development |
| **Document Version** | 1.0 |
| **Last Verified Against Codebase** | 2026-07-09 |
| **Verified By Session** | [9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) |

### Quick File Index

| File | Role | Size |
|---|---|---|
| [`src/App.tsx`](src/App.tsx) | Main orchestrator, routing, layout shell | 340 lines |
| [`src/components/Dashboard.tsx`](src/components/Dashboard.tsx) | Landing page containing hub views (Processes, Forms, Submissions, Guide) | 706 lines |
| [`src/components/LoginPage.tsx`](src/components/LoginPage.tsx) | Authentication UI (Credentials & Google OAuth) | 229 lines |
| [`src/components/UserManagement.tsx`](src/components/UserManagement.tsx) | User administration and Role matrix view | 570 lines |
| [`src/context/AuthContext.tsx`](src/context/AuthContext.tsx) | Auth logic, JWT storage, RBAC definitions | 225 lines |

> **Update rule:** Whenever any of the above files is modified in a session, update
> the "Last Verified" date and add an entry to the [Change Log](#9-change-log) at the
> bottom of this document.

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

### `User` (lines 70–79)
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

### `PermissionKey` (lines 6–16)
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
| `POST` | `/api/auth/login` | AuthContext | Validate username/password, return JWT |
| `POST` | `/api/auth/google` | AuthContext | Validate Google ID token, return JWT |
| `GET` | `/api/users` | AuthContext | Fetch user list (Admin/Supervisor only) |
| `POST` | `/api/users` | UserManagement | Create a new user account |
| `PUT` | `/api/users/:id` | UserManagement | Update user account details |
| `GET` | `/api/processes` | Dashboard | Fetch processes for listing |
| `GET` | `/api/forms` | Dashboard | Fetch unlinked forms for listing |

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

| Date | Session / Conversation | Change |
|---|---|---|
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Document created. Initial full write based on codebase review. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Make process family default to Draft version if available. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Move the Guide tab option from the main dashboard tabs into the profile dropdown menu. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Introduce a collapsible "Retired Processes" section at the bottom of the processes list on the Dashboard. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Prioritize 'Retired' status when choosing the default representative version of a process family on the Dashboard. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Implement universal List/Grid View layout toggling for Processes, Forms, and Submissions tabs. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Support displaying multiple active linked processes for a form and prompting an action selection dialog if more than one exists. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Simplify the processes list table layout by replacing the complex 'Metadata' column with a clean, single-value 'Last update' column. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Hide the virtual fallback process family 'unlinked' (Biểu mẫu tự do) from the Processes listing tab. |
| 2026-07-09 | [9a6bb9aa](conversation://9a6bb9aa-9ff4-4e14-a3f4-84e603e6ae73) | Add direct Print action buttons to the Processes tab list and grid card layouts. |
