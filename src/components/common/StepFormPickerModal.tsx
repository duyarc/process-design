import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, Plus, X, ArrowLeft, FileText, Check } from 'lucide-react';

export interface FormOptionItem {
  form_id: string;
  form_title?: string;
  form_name?: string;
  updated_at?: string;
}

interface StepFormPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableForms: FormOptionItem[];
  linkedFormIds: string[];
  onSelectForm: (formId: string) => void;
  onCreateForm: (formId: string, formTitle: string) => void;
}

export default function StepFormPickerModal({
  isOpen,
  onClose,
  availableForms,
  linkedFormIds,
  onSelectForm,
  onCreateForm
}: StepFormPickerModalProps) {
  const [mode, setMode] = useState<'browse' | 'create'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create mode state
  const [newFormId, setNewFormId] = useState('');
  const [newFormTitle, setNewFormTitle] = useState('');
  const [formError, setFormError] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setMode('browse');
      setSearchTerm('');
      setNewFormId('');
      setNewFormTitle('');
      setFormError('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Focus ID input when switching to create mode
  useEffect(() => {
    if (mode === 'create') {
      setTimeout(() => idInputRef.current?.focus(), 50);
    } else {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [mode]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'create') {
          setMode('browse');
          setFormError('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, onClose]);

  // Deduplicate and filter forms
  const filteredForms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return availableForms;
    return availableForms.filter(f => {
      const idMatch = f.form_id.toLowerCase().includes(term);
      const titleMatch = (f.form_title || f.form_name || '').toLowerCase().includes(term);
      return idMatch || titleMatch;
    });
  }, [availableForms, searchTerm]);

  const handleCreateSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedId = newFormId.trim();
    const trimmedTitle = newFormTitle.trim();

    if (!trimmedId) {
      setFormError('Vui lòng nhập mã Form ID.');
      return;
    }
    if (!/^[a-zA-Z0-9_\-\/]+$/.test(trimmedId)) {
      setFormError('Mã Form ID chỉ chứa chữ cái, số, dấu gạch nối (-), gạch dưới (_), hoặc gạch chéo (/).');
      return;
    }
    const isDuplicate = availableForms.some(f => f.form_id.toLowerCase() === trimmedId.toLowerCase());
    if (isDuplicate) {
      setFormError(`Mã Form ID "${trimmedId}" đã tồn tại trong hệ thống.`);
      return;
    }
    if (!trimmedTitle) {
      setFormError('Vui lòng nhập tên biểu mẫu.');
      return;
    }

    onCreateForm(trimmedId, trimmedTitle);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1rem',
        animation: 'modal-fade-in 0.15s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <style>{`
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-scale-in {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .step-form-picker-card {
          animation: modal-scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div
        className="step-form-picker-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--neutral-border, #e2e8f0)'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--neutral-border, #e2e8f0)',
            background: '#fafafa'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {mode === 'create' && (
              <button
                type="button"
                onClick={() => {
                  setMode('browse');
                  setFormError('');
                }}
                title="Quay lại danh sách"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-secondary, #64748b)',
                  borderRadius: '4px'
                }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={16} style={{ color: 'var(--primary, #0d9488)' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                {mode === 'browse' ? 'Liên kết Biểu mẫu với Bước công việc' : 'Tạo Biểu Mẫu Mới'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Đóng (Esc)"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-muted, #94a3b8)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* BROWSE MODE */}
        {mode === 'browse' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Search Box & Create Action Bar */}
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.4rem 0.65rem',
                  border: '1px solid var(--neutral-border, #cbd5e1)',
                  borderRadius: '6px',
                  background: '#ffffff',
                  flex: 1
                }}
              >
                <Search size={15} style={{ color: 'var(--text-muted, #94a3b8)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Tìm theo mã hoặc tên biểu mẫu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '0.85rem',
                    width: '100%',
                    color: 'var(--text-primary, #0f172a)'
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#94a3b8', display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode('create');
                  setNewFormTitle(searchTerm.trim());
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  backgroundColor: 'var(--primary-bg, #f0fdfa)',
                  border: '1px solid var(--primary, #0d9488)',
                  color: 'var(--primary, #0d9488)',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary, #0d9488)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-bg, #f0fdfa)';
                  e.currentTarget.style.color = 'var(--primary, #0d9488)';
                }}
              >
                <Plus size={14} /> Tạo mới
              </button>
            </div>

            {/* List of Forms */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.5rem 0.75rem',
                minHeight: '260px',
                maxHeight: '380px'
              }}
            >
              {filteredForms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted, #94a3b8)' }}>
                  <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
                    Không tìm thấy biểu mẫu nào khớp với "{searchTerm}".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('create');
                      setNewFormTitle(searchTerm.trim());
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #0d9488)',
                      fontSize: '0.825rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    + Tạo biểu mẫu mới với tên này
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {filteredForms.map((form) => {
                    const isAlreadyLinked = linkedFormIds.includes(form.form_id);
                    return (
                      <div
                        key={form.form_id}
                        onClick={() => {
                          if (!isAlreadyLinked) {
                            onSelectForm(form.form_id);
                            onClose();
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          cursor: isAlreadyLinked ? 'default' : 'pointer',
                          backgroundColor: isAlreadyLinked ? '#f8fafc' : '#ffffff',
                          opacity: isAlreadyLinked ? 0.65 : 1,
                          border: '1px solid transparent',
                          transition: 'all 0.12s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isAlreadyLinked) {
                            e.currentTarget.style.backgroundColor = '#f0fdfa';
                            e.currentTarget.style.borderColor = '#99f6e4';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isAlreadyLinked) {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.borderColor = 'transparent';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--primary, #0d9488)',
                              backgroundColor: '#e6fffa',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #b2f5ea',
                              flexShrink: 0
                            }}
                          >
                            {form.form_id}
                          </span>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              color: 'var(--text-primary, #0f172a)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {form.form_title || form.form_name}
                          </span>
                        </div>

                        {isAlreadyLinked ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.725rem',
                              color: '#64748b',
                              backgroundColor: '#e2e8f0',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              flexShrink: 0
                            }}
                          >
                            <Check size={11} /> Đã liên kết
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--primary, #0d9488)',
                              flexShrink: 0
                            }}
                          >
                            Chọn
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CREATE MODE */}
        {mode === 'create' && (
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '0.35rem' }}>
                  Mã Form ID*
                </label>
                <input
                  ref={idInputRef}
                  type="text"
                  placeholder="Ví dụ: 3S-QC/F05"
                  value={newFormId}
                  onChange={(e) => {
                    setNewFormId(e.target.value);
                    setFormError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--neutral-border, #cbd5e1)',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.25rem', display: 'block' }}>
                  Chỉ gồm chữ cái, số, gạch ngang (-), gạch dưới (_) và gạch chéo (/).
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '0.35rem' }}>
                  Tên biểu mẫu*
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Biên bản Nghiệm thu kỹ thuật"
                  value={newFormTitle}
                  onChange={(e) => {
                    setNewFormTitle(e.target.value);
                    setFormError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid var(--neutral-border, #cbd5e1)',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {formError && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500, backgroundColor: '#fef2f2', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #fecaca' }}>
                  {formError}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={() => {
                  setMode('browse');
                  setFormError('');
                }}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem', backgroundColor: 'var(--primary, #0d9488)', border: 'none' }}
              >
                Tạo & Liên kết
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
