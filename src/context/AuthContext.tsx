import React, { createContext, useContext, useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// PERMISSION KEYS - All available permissions in the system
// ─────────────────────────────────────────────────────────────
export type PermissionKey =
  // Document Design branch (applies to both Process & Form)
  | 'view_document'      // View & Print diagrams, forms
  | 'design_document'    // Create / Edit DRAFT documents
  | 'version_document'   // Publish (DRAFT → ACTIVE), create revision, delete
  // Form Run branch
  | 'fill_form'          // Submit a new form record
  | 'view_records'       // View & Print submitted records
  | 'verify_records'     // Review, feedback & sign-off records
  // User Management branch
  | 'manage_users';      // Create / edit user accounts

// ─────────────────────────────────────────────────────────────
// ROLE DEFINITIONS
// ─────────────────────────────────────────────────────────────
export type RoleId = 'admin' | 'supervisor' | 'operator';

export interface Role {
  id: RoleId;
  name: string;            // Display name
  description: string;
}

export const ROLES: Role[] = [
  { id: 'admin',      name: 'Admin',          description: 'Toàn quyền hệ thống' },
  { id: 'supervisor', name: 'Manager',        description: 'Thiết kế tài liệu, duyệt form, cấp tài khoản Operator' },
  { id: 'operator',   name: 'Operator',       description: 'Xem tài liệu, điền form, xem bản ghi của mình' },
];

// ─────────────────────────────────────────────────────────────
// ROLE PERMISSIONS MATRIX (dynamic - can be modified at runtime)
// Each key maps a RoleId to the set of PermissionKeys it holds.
// ─────────────────────────────────────────────────────────────
export type RolePermissionsMatrix = Record<RoleId, Set<PermissionKey>>;

const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  admin: new Set<PermissionKey>([
    'view_document',
    'design_document',
    'version_document',
    'fill_form',
    'view_records',
    'verify_records',
    'manage_users',
  ]),
  supervisor: new Set<PermissionKey>([
    'view_document',
    'design_document',
    'version_document',
    'fill_form',
    'view_records',
    'verify_records',
    'manage_users',   // Limited: can only create/edit Operator accounts
  ]),
  operator: new Set<PermissionKey>([
    'view_document',
    'fill_form',
    'view_records',
  ]),
};

// ─────────────────────────────────────────────────────────────
// USER MODEL
// ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email?: string;          // Email for Google Login
  username: string;       // Login credential
  password: string;       // Stored plain text for mock; hash in production
  full_name: string;      // Ho ten
  title: string;          // Chuc vu
  role_id: RoleId;
  status: 'active' | 'inactive';
}


// ─────────────────────────────────────────────────────────────
// AUTH CONTEXT TYPES
// ─────────────────────────────────────────────────────────────
interface AuthContextType {
  currentUser: User | null;
  users: User[];
  rolePermissions: RolePermissionsMatrix;

  /** Attempt login; returns error message string on failure, null on success */
  login: (username: string, password: string) => Promise<string | null>;
  register: (email: string, full_name: string, password: string) => Promise<string | null>;
  loginWithGoogle: (idToken: string) => Promise<string | null>;
  logout: () => void;

  /** Check if currentUser holds a specific permission */
  hasPermission: (key: PermissionKey) => boolean;

  /** Update the full user list (used by UserManagement component) */
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;

  /** Update the role-permissions matrix (used by the Role Matrix UI) */
  setRolePermissions: React.Dispatch<React.SetStateAction<RolePermissionsMatrix>>;
}

// ─────────────────────────────────────────────────────────────
// CONTEXT SETUP
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMatrix>(DEFAULT_ROLE_PERMISSIONS);

  // Fetch users when logged in as admin or supervisor
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('jwt_token');
      if (!token) return;
      try {
        const res = await fetch('/api/users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };

    if (currentUser && (currentUser.role_id === 'admin' || currentUser.role_id === 'supervisor')) {
      fetchUsers();
    } else {
      setUsers([]);
    }
  }, [currentUser]);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return data.error || 'Tên đăng nhập hoặc mật khẩu không đúng.';
      }
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      setCurrentUser(data.user);
      return null; // success
    } catch (err) {
      console.error('Login error:', err);
      return 'Không thể kết nối đến máy chủ.';
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      const data = await res.json();
      if (!res.ok) {
        return data.error || 'Đăng nhập Google thất bại.';
      }
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      setCurrentUser(data.user);
      return null; // success
    } catch (err) {
      console.error('Google login error:', err);
      return 'Không thể kết nối đến máy chủ để xác thực Google.';
    }
  };

  const register = async (email: string, full_name: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, full_name, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return data.error || 'Tạo tài khoản thất bại.';
      }
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      setCurrentUser(data.user);
      return null; // success
    } catch (err) {
      console.error('Registration error:', err);
      return 'Không thể kết nối đến máy chủ để tạo tài khoản.';
    }
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  const hasPermission = (key: PermissionKey): boolean => {
    if (!currentUser) return false;
    return rolePermissions[currentUser.role_id]?.has(key) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        rolePermissions,
        login,
        register,
        loginWithGoogle,
        logout,
        hasPermission,
        setUsers,
        setRolePermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
