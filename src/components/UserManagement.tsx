import React, { useState } from 'react';
import {
  useAuth,
  ROLES,
} from '../context/AuthContext';
import type {
  User,
  RoleId,
  PermissionKey,
} from '../context/AuthContext';
import {
  Users,
  ShieldCheck,
  Plus,
  Pencil,
  X,
  ChevronLeft,
  Check,
  Search,
  UserCircle2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// PERMISSION LABELS for the Role Matrix UI
// ─────────────────────────────────────────────────────────────
const PERMISSION_ROWS: { key: PermissionKey; group: string; label: string }[] = [
  { key: 'view_document',   group: 'Thiết kế Tài liệu', label: 'Xem & In ấn tài liệu / biểu mẫu' },
  { key: 'design_document', group: 'Thiết kế Tài liệu', label: 'Thiết kế (tạo / sửa bản DRAFT)' },
  { key: 'version_document',group: 'Thiết kế Tài liệu', label: 'Quản lý phiên bản (Publish / Revision)' },
  { key: 'fill_form',       group: 'Vận hành Biểu mẫu', label: 'Điền biểu mẫu mới' },
  { key: 'view_records',    group: 'Vận hành Biểu mẫu', label: 'Xem & In bản ghi đã nộp' },
  { key: 'verify_records',  group: 'Vận hành Biểu mẫu', label: 'Thẩm tra & Ký duyệt bản ghi' },
  { key: 'manage_users',    group: 'Quản lý Nhân sự',   label: 'Quản lý thành viên' },
];

// ─────────────────────────────────────────────────────────────
// ROLE BADGE COLOR HELPER
// ─────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<RoleId, { bg: string; color: string }> = {
  admin:      { bg: '#fef3c7', color: '#92400e' },
  supervisor: { bg: '#dbeafe', color: '#1e40af' },
  operator:   { bg: '#d1fae5', color: '#065f46' },
};

// ─────────────────────────────────────────────────────────────
// BLANK USER TEMPLATE
// ─────────────────────────────────────────────────────────────
const blankUser = (): Omit<User, 'id'> => ({
  email: '',
  username: '',
  password: '',
  full_name: '',
  title: '',
  role_id: 'operator',
  status: 'active',
});

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
}

const UserManagement: React.FC<Props> = ({ onBack }) => {
  const { currentUser, users, setUsers, rolePermissions, setRolePermissions } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Omit<User, 'id'>>(blankUser());
  const [formError, setFormError] = useState<string | null>(null);

  // ── Determine what roles this user can create / edit ──────
  const isAdmin = currentUser?.role_id === 'admin';
  const allowedRoles: RoleId[] = isAdmin ? ['admin', 'supervisor', 'operator'] : ['operator'];

  // ── Filtered user list ────────────────────────────────────
  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.title.toLowerCase().includes(search.toLowerCase())
  );

  // ── Drawer helpers ────────────────────────────────────────
  const openAdd = () => {
    setEditingUser(null);
    setFormData(blankUser());
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = (user: User) => {
    // Supervisors can only edit Operators
    if (!isAdmin && user.role_id !== 'operator') return;
    setEditingUser(user);
    setFormData({ ...user });
    setFormError(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  // ── Save user (add or edit) ───────────────────────────────
  const handleSave = async () => {
    if (!formData.full_name.trim()) { setFormError('Vui lòng nhập Họ tên.'); return; }
    if (!formData.email?.trim()) { setFormError('Vui lòng nhập Email.'); return; }
    if (!formData.username.trim()) { setFormError('Vui lòng nhập Tên đăng nhập.'); return; }
    if (!formData.password.trim()) { setFormError('Vui lòng nhập Mật khẩu.'); return; }

    // Duplicate username check (excluding self when editing)
    const dupCheck = users.find(
      (u) => u.username === formData.username.trim() && u.id !== editingUser?.id
    );
    if (dupCheck) { setFormError('Tên đăng nhập này đã tồn tại.'); return; }

    // Duplicate email check (excluding self when editing)
    const dupEmailCheck = users.find(
      (u) => u.email === formData.email?.trim() && u.id !== editingUser?.id
    );
    if (dupEmailCheck) { setFormError('Email này đã được sử dụng.'); return; }

    const token = localStorage.getItem('jwt_token');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingUser?.id,
          email: formData.email.trim(),
          username: formData.username.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          title: formData.title.trim(),
          role_id: formData.role_id,
          status: formData.status
        })
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || 'Có lỗi xảy ra khi lưu thông tin.');
        return;
      }

      const savedUser = await res.json();

      if (editingUser) {
        setUsers((prev) => prev.map((u) => u.id === editingUser.id ? savedUser : u));
      } else {
        setUsers((prev) => [...prev, savedUser]);
      }
      closeDrawer();
    } catch (err) {
      setFormError('Không thể kết nối đến máy chủ.');
    }
  };

  // ── Toggle a permission for a role in the matrix ──────────
  const togglePermission = (roleId: RoleId, key: PermissionKey) => {
    if (!isAdmin) return; // Only admin can modify the matrix
    setRolePermissions((prev) => {
      const updated = new Set(prev[roleId]);
      if (updated.has(key)) {
        updated.delete(key);
      } else {
        updated.add(key);
      }
      return { ...prev, [roleId]: updated };
    });
  };

  // ── Group permission rows by group label ──────────────────
  const permGroups = PERMISSION_ROWS.reduce<Record<string, typeof PERMISSION_ROWS>>((acc, row) => {
    if (!acc[row.group]) acc[row.group] = [];
    acc[row.group].push(row);
    return acc;
  }, {});

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={onBack}
          className="btn btn-sm btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '20px', padding: '0.35rem 0.85rem' }}
        >
          <ChevronLeft size={15} /> Quay lại
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Quản lý Nhân sự
          </h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Tài khoản thành viên & cấu hình phân quyền hệ thống
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--neutral-border)' }}>
        {[
          { id: 'users' as const, label: 'Nhân viên', icon: <Users size={15} /> },
          { id: 'roles' as const, label: 'Vai trò & Quyền hạn', icon: <ShieldCheck size={15} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1.2rem',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary)' : 'transparent'}`,
              marginBottom: '-2px',
              transition: 'color 0.2s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: USERS ── */}
      {activeTab === 'users' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                placeholder="Tìm kiếm theo tên, username, chức vụ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                  border: '1px solid var(--neutral-border)', borderRadius: '8px',
                  fontSize: '0.85rem', color: 'var(--text-primary)',
                  background: 'var(--surface, #fff)',
                  outline: 'none',
                }}
              />
            </div>
            <button
              id="btn-add-user"
              className="btn btn-sm btn-primary"
              onClick={openAdd}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
            >
              <Plus size={15} /> Thêm thành viên
            </button>
          </div>

          {/* User Table */}
          <div style={{ border: '1px solid var(--neutral-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt, #f9fafb)' }}>
                  {['Họ tên', 'Chức vụ', 'Tên đăng nhập', 'Vai trò', 'Trạng thái', ''].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Không tìm thấy thành viên nào.
                    </td>
                  </tr>
                )}
                {filteredUsers.map((user, idx) => {
                  const roleColors = ROLE_COLORS[user.role_id];
                  const canEdit = isAdmin || user.role_id === 'operator';
                  return (
                    <tr
                      key={user.id}
                      style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--neutral-border)', background: 'var(--surface, #fff)', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-alt, #f9fafb)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface, #fff)')}
                    >
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <UserCircle2 size={28} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.full_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>{user.title}</td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <code style={{ fontSize: '0.8rem', background: '#f3f4f6', padding: '0.15rem 0.45rem', borderRadius: '5px', color: 'var(--text-primary)' }}>
                          {user.username}
                        </code>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          background: roleColors.bg, color: roleColors.color,
                          padding: '0.2rem 0.6rem', borderRadius: '20px',
                          fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          {ROLES.find((r) => r.id === user.role_id)?.name ?? user.role_id}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          color: user.status === 'active' ? '#059669' : '#9ca3af',
                          fontWeight: 600, fontSize: '0.8rem',
                        }}>
                          {user.status === 'active' ? '● Hoạt động' : '○ Vô hiệu'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        {canEdit && (
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEdit(user)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', borderRadius: '7px', padding: '0.3rem 0.7rem' }}
                          >
                            <Pencil size={13} /> Sửa
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: ROLE MATRIX ── */}
      {activeTab === 'roles' && (
        <div>
          {!isAdmin && (
            <div style={{ padding: '0.75rem 1rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.82rem', color: '#92400e', marginBottom: '1rem' }}>
              Bạn không có quyền thay đổi cấu hình phân quyền. Chỉ Admin mới có thể chỉnh sửa bảng này.
            </div>
          )}
          <div style={{ border: '1px solid var(--neutral-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-alt, #f9fafb)' }}>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', width: '50%' }}>
                    Quyền hạn
                  </th>
                  {ROLES.map((role) => (
                    <th key={role.id} style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, fontSize: '0.78rem' }}>
                      <span style={{
                        background: ROLE_COLORS[role.id].bg, color: ROLE_COLORS[role.id].color,
                        padding: '0.2rem 0.65rem', borderRadius: '20px', whiteSpace: 'nowrap',
                        fontSize: '0.78rem', fontWeight: 700,
                      }}>
                        {role.id.charAt(0).toUpperCase() + role.id.slice(1)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(permGroups).map(([groupName, rows]) => (
                  <React.Fragment key={groupName}>
                    {/* Group header row */}
                    <tr>
                      <td
                        colSpan={4}
                        style={{ padding: '0.45rem 1rem', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        {groupName}
                      </td>
                    </tr>
                    {rows.map((row, idx) => (
                      <tr
                        key={row.key}
                        style={{ borderTop: '1px solid var(--neutral-border)', background: idx % 2 === 0 ? 'var(--surface, #fff)' : 'var(--surface-alt, #fafafa)' }}
                      >
                        <td style={{ padding: '0.8rem 1rem', color: 'var(--text-primary)' }}>{row.label}</td>
                        {ROLES.map((role) => {
                          const hasIt = rolePermissions[role.id]?.has(row.key) ?? false;
                          return (
                            <td key={role.id} style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                              <button
                                onClick={() => togglePermission(role.id, row.key)}
                                disabled={!isAdmin}
                                title={isAdmin ? (hasIt ? 'Bỏ quyền này' : 'Cấp quyền này') : 'Chỉ Admin mới thay đổi được'}
                                style={{
                                  width: '26px', height: '26px',
                                  borderRadius: '6px',
                                  border: hasIt ? 'none' : '2px solid #d1d5db',
                                  background: hasIt ? '#3b82f6' : 'transparent',
                                  cursor: isAdmin ? 'pointer' : 'default',
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {hasIt && <Check size={14} color="#fff" strokeWidth={3} />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SIDE DRAWER ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />
          {/* Drawer panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px',
            background: 'var(--surface, #fff)', zIndex: 50,
            boxShadow: '-8px 0 30px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 0.2s ease',
          }}>
            {/* Drawer header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--neutral-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingUser ? 'Chỉnh sửa thành viên' : 'Thêm thành viên mới'}
              </h3>
              <button onClick={closeDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {[
                { label: 'Họ tên *', field: 'full_name', type: 'text', placeholder: 'Nguyễn Văn A' },
                { label: 'Chức vụ', field: 'title', type: 'text', placeholder: 'Công nhân vận hành' },
                { label: 'Email *', field: 'email', type: 'text', placeholder: 'email@gmail.com' },
                { label: 'Tên đăng nhập *', field: 'username', type: 'text', placeholder: 'username' },
                { label: 'Mật khẩu *', field: 'password', type: 'password', placeholder: '••••••••' },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field} style={{ marginBottom: '1.1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={(formData as Record<string, string>)[field] ?? ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '0.6rem 0.8rem',
                      border: '1px solid var(--neutral-border)', borderRadius: '8px',
                      fontSize: '0.875rem', color: 'var(--text-primary)',
                      background: 'var(--surface, #fff)',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}

              {/* Role selector */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Vai trò *
                </label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, role_id: e.target.value as RoleId }))}
                  disabled={!isAdmin}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem',
                    border: '1px solid var(--neutral-border)', borderRadius: '8px',
                    fontSize: '0.875rem', color: 'var(--text-primary)',
                    background: 'var(--surface, #fff)',
                    cursor: isAdmin ? 'pointer' : 'not-allowed',
                  }}
                >
                  {allowedRoles.map((roleId) => (
                    <option key={roleId} value={roleId}>
                      {ROLES.find((r) => r.id === roleId)?.name ?? roleId}
                    </option>
                  ))}
                </select>
                {!isAdmin && (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Supervisor chỉ có thể tạo tài khoản Operator.
                  </p>
                )}
              </div>

              {/* Status toggle */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Trạng thái
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                  style={{
                    width: '100%', padding: '0.6rem 0.8rem',
                    border: '1px solid var(--neutral-border)', borderRadius: '8px',
                    fontSize: '0.875rem', color: 'var(--text-primary)',
                    background: 'var(--surface, #fff)',
                  }}
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Vô hiệu hóa</option>
                </select>
              </div>

              {/* Error */}
              {formError && (
                <div style={{
                  padding: '0.6rem 0.85rem', background: '#fef2f2',
                  border: '1px solid #fecaca', borderRadius: '8px',
                  color: '#dc2626', fontSize: '0.82rem', marginBottom: '1rem',
                }}>
                  {formError}
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--neutral-border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={closeDrawer} className="btn btn-sm btn-secondary" style={{ borderRadius: '8px', padding: '0.5rem 1.2rem' }}>
                Hủy
              </button>
              <button
                id="btn-save-user"
                onClick={handleSave}
                className="btn btn-sm btn-primary"
                style={{ borderRadius: '8px', padding: '0.5rem 1.2rem' }}
              >
                {editingUser ? 'Lưu thay đổi' : 'Thêm thành viên'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Keyframe for drawer slide-in */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default UserManagement;
