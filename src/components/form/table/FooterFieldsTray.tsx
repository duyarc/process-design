import type { FormFieldISO } from '../../../types';
import type { TableSummaryType } from '../../../utils/formUtils';
import { Plus, X, ChevronDown, Calendar } from 'lucide-react';

interface FooterFieldsTrayProps {
  blockId: string;
  sumType: TableSummaryType;
  isLocked: boolean;
  isHoveredRow: boolean;
  isAddMenuOpen: boolean;
  onToggleAddMenu: () => void;
  onCloseAddMenu: () => void;
  onAddField: (blockId: string, summaryId: string, type: 'text' | 'select' | 'number' | 'date') => void;
  onUpdateField: (blockId: string, summaryId: string, fieldId: string, updates: Partial<FormFieldISO>) => void;
  onDeleteField: (blockId: string, summaryId: string, fieldId: string) => void;
}

/** Khay Footer Fields (Tiền tệ, Tỷ giá...) nằm ở ô nhãn bên trái của hàng chân bảng trên Canvas. */
export default function FooterFieldsTray({
  blockId,
  sumType,
  isLocked,
  isHoveredRow,
  isAddMenuOpen,
  onToggleAddMenu,
  onCloseAddMenu,
  onAddField,
  onUpdateField,
  onDeleteField,
}: FooterFieldsTrayProps) {
  return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
          {(sumType.footerFields || []).map((f: FormFieldISO) => (
            <div 
              key={f.id} 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}
            >
              {/* Nhãn trường: Cho phép sửa trực tiếp */}
              {!isLocked ? (
                <input
                  type="text"
                  value={f.checkItem || (f as any).label || ''}
                  onChange={(e) => onUpdateField(blockId, sumType.id, f.id, { checkItem: e.target.value })}
                  style={{
                    width: `${Math.max(45, (f.checkItem || (f as any).label || 'Tên').length * 8 + 6)}px`,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontWeight: 600,
                    color: '#475569',
                    fontSize: '0.75rem',
                    padding: '0 2px'
                  }}
                  placeholder="Tên trường..."
                />
              ) : (
                <span style={{ fontWeight: 600, color: '#475569' }}>{f.checkItem || (f as any).label}:</span>
              )}
              <span style={{ color: '#94a3b8' }}>:</span>

              {/* Control hiển thị / nhập placeholder */}
              {f.type === 'select' ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  {!isLocked ? (
                    <input
                      type="text"
                      value={(f.options || []).map(o => o.label).join(', ')}
                      onChange={(e) => {
                        const rawOpts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        const newOpts = rawOpts.map(s => ({ label: s, value: s }));
                        onUpdateField(blockId, sumType.id, f.id, { options: newOpts });
                      }}
                      title="Các lựa chọn (phân cách bằng dấu phẩy, e.g. USD, EUR, VNĐ)"
                      placeholder="USD, EUR, VNĐ"
                      style={{
                        width: '90px',
                        padding: '1px 4px',
                        fontSize: '0.72rem',
                        fontStyle: 'italic',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '3px',
                        background: '#f8fafc',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {f.options?.[0]?.label || 'USD'}
                    </span>
                  )}
                  <ChevronDown size={11} style={{ color: '#94a3b8' }} />
                </div>
              ) : (
                <input
                  type="text"
                  disabled={isLocked}
                  value={f.placeholder || ''}
                  onChange={(e) => onUpdateField(blockId, sumType.id, f.id, { placeholder: e.target.value })}
                  placeholder={f.type === 'number' ? '25,450' : f.type === 'date' ? 'Ngày' : 'Gợi ý...'}
                  style={{
                    width: f.type === 'number' ? '65px' : '80px',
                    padding: '1px 4px',
                    fontSize: '0.72rem',
                    fontStyle: 'italic',
                    textAlign: f.type === 'number' ? 'right' : 'left',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '3px',
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none'
                  }}
                />
              )}

              {/* Nút xóa trường ✕ */}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => onDeleteField(blockId, sumType.id, f.id)}
                  title="Xóa trường này"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '1px',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '2px',
                    marginLeft: '2px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          ))}

          {/* Nút + Thêm trường chân bảng */}
          {!isLocked && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleAddMenu();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: isAddMenuOpen ? 'var(--primary)' : '#64748b',
                  background: isAddMenuOpen ? '#f0fdfa' : '#ffffff',
                  border: `1px dashed ${isAddMenuOpen ? 'var(--primary)' : '#94a3b8'}`,
                  borderRadius: '3px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  opacity: (isHoveredRow || isAddMenuOpen || (sumType.footerFields || []).length > 0) ? 1 : 0.4,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                onMouseLeave={(e) => {
                  if (!isAddMenuOpen) {
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }
                }}
                title="Thêm trường nhập liệu vào chân bảng (Tiền tệ, Tỷ giá...)"
              >
                <Plus size={10} /> Trường
              </button>

              {/* Popover chọn loại trường */}
              {isAddMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: '100%',
                    marginBottom: '4px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    zIndex: 35,
                    minWidth: '150px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', padding: '2px 6px', textTransform: 'uppercase' }}>
                    Chọn loại trường
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onAddField(blockId, sumType.id, 'select');
                      onCloseAddMenu();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', fontSize: '0.72rem', background: 'none', border: 'none', borderRadius: '3px', cursor: 'pointer', textAlign: 'left', color: '#0f172a' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)', width: '16px' }}>▼</span>
                    <span>Tiền tệ (Dropdown)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddField(blockId, sumType.id, 'number');
                      onCloseAddMenu();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', fontSize: '0.72rem', background: 'none', border: 'none', borderRadius: '3px', cursor: 'pointer', textAlign: 'left', color: '#0f172a' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)', width: '16px' }}>#</span>
                    <span>Tỷ giá (Số)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddField(blockId, sumType.id, 'text');
                      onCloseAddMenu();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', fontSize: '0.72rem', background: 'none', border: 'none', borderRadius: '3px', cursor: 'pointer', textAlign: 'left', color: '#0f172a' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)', width: '16px' }}>T</span>
                    <span>Chữ tự do (Text)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddField(blockId, sumType.id, 'date');
                      onCloseAddMenu();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', fontSize: '0.72rem', background: 'none', border: 'none', borderRadius: '3px', cursor: 'pointer', textAlign: 'left', color: '#0f172a' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <Calendar size={12} style={{ color: 'var(--primary)' }} />
                    <span>Ngày chốt tỷ giá</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
  );
}
