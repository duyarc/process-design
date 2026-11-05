import { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Search, X, ArrowLeft, FileText, ChevronRight, Copy, Layers, Table, CheckSquare, PenTool, Plus } from 'lucide-react';
import type { LayoutBlockISO } from '../../types';

export interface FormOptionItem {
  key: string;
  processId: string;
  processTitle: string;
  formId: string;
  formTitle: string;
  formName: string;
  updatedAt: string;
  blocks: LayoutBlockISO[];
  isSameProcess: boolean;
  isUnlinked: boolean;
}

interface CopySectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFormId: string;
  currentFormTitle: string;
  currentFormName: string;
  linkedProcessId?: string;
  allProcesses: any[];
  allFormsData: any[];
  onCopyBlock: (sourceBlock: LayoutBlockISO) => void;
}

export default function CopySectionModal({
  isOpen,
  onClose,
  currentFormId,
  currentFormTitle,
  currentFormName,
  linkedProcessId,
  allProcesses,
  allFormsData,
  onCopyBlock
}: CopySectionModalProps) {
  const [mode, setMode] = useState<'browse' | 'select_block'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormKey, setSelectedFormKey] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setMode('browse');
      setSearchTerm('');
      setSelectedFormKey('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode === 'select_block') {
          setMode('browse');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, onClose]);

  // Aggregate and memoize available forms
  const availableForms = useMemo(() => {
    const availableFormsMap = new Map<string, FormOptionItem>();
    const currentProcId = linkedProcessId || '';

    // 1. Collect forms embedded in allProcesses
    allProcesses.forEach(proc => {
      const isSameProc = proc.id === currentProcId;
      if (proc.workflowFormsData) {
        const wfd = typeof proc.workflowFormsData === 'string' ? JSON.parse(proc.workflowFormsData) : proc.workflowFormsData;
        Object.entries(wfd).forEach(([fName, formData]: [string, any]) => {
          if (!formData || !Array.isArray(formData.layoutBlocks) || formData.layoutBlocks.length === 0) return;

          const key = `${proc.id}:${fName}`;
          const fTitle = formData.formTitle || formData.form_title || fName;
          const fId = formData.formId || formData.form_id || fName;

          // Skip current form being edited
          if (isSameProc && (fId === currentFormId || fTitle === currentFormTitle || fName === currentFormName)) {
            return;
          }

          // Filter out TITLE-only forms
          const copyableBlocks = (formData.layoutBlocks as LayoutBlockISO[]).filter(b => b.type !== 'TITLE');
          if (copyableBlocks.length === 0) return;

          availableFormsMap.set(key, {
            key,
            processId: proc.id,
            processTitle: proc.title || 'Quy trình',
            formId: fId,
            formTitle: fTitle,
            formName: fName,
            updatedAt: formData.updatedAt || proc.lastUpdated || formData.updated_at || '',
            blocks: copyableBlocks,
            isSameProcess: isSameProc,
            isUnlinked: false
          });
        });
      }
    });

    // 2. Collect standalone forms from allFormsData
    allFormsData.forEach(form => {
      const blocks = typeof form.layout_blocks === 'string' ? JSON.parse(form.layout_blocks) : (form.layout_blocks || []);
      if (!Array.isArray(blocks) || blocks.length === 0) return;

      const fTitle = form.form_title || form.form_name || form.form_id;
      const fId = form.form_id || form.form_name;
      const fName = form.form_name || form.form_id;
      const key = `form_db:${form.id || fId}`;

      // Skip current form
      if (fId === currentFormId || fTitle === currentFormTitle || fName === currentFormName) return;

      const copyableBlocks = (blocks as LayoutBlockISO[]).filter(b => b.type !== 'TITLE');
      if (copyableBlocks.length === 0) return;

      const alreadyExists = Array.from(availableFormsMap.values()).some(existing => existing.formId === fId && existing.formTitle === fTitle);
      if (!alreadyExists) {
        availableFormsMap.set(key, {
          key,
          processId: 'unlinked',
          processTitle: 'Biểu mẫu tự do',
          formId: fId,
          formTitle: fTitle,
          formName: fName,
          updatedAt: form.updated_at || form.updatedAt || '',
          blocks: copyableBlocks,
          isSameProcess: false,
          isUnlinked: true
        });
      }
    });

    const forms = Array.from(availableFormsMap.values());
    const getTs = (item: FormOptionItem) => item.updatedAt ? new Date(item.updatedAt).getTime() : 0;

    // Prioritize same process, then recent
    return forms.sort((a, b) => {
      if (a.isSameProcess && !b.isSameProcess) return -1;
      if (!a.isSameProcess && b.isSameProcess) return 1;
      return getTs(b) - getTs(a);
    });
  }, [allProcesses, allFormsData, linkedProcessId, currentFormId, currentFormTitle, currentFormName]);

  // Filter forms based on search term
  const filteredForms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return availableForms;
    return availableForms.filter(f => {
      const idMatch = f.formId.toLowerCase().includes(term);
      const titleMatch = f.formTitle.toLowerCase().includes(term);
      const procMatch = f.processTitle.toLowerCase().includes(term);
      return idMatch || titleMatch || procMatch;
    });
  }, [availableForms, searchTerm]);

  const selectedForm = useMemo(() => {
    return availableForms.find(f => f.key === selectedFormKey) || null;
  }, [availableForms, selectedFormKey]);

  if (!isOpen) return null;

  const getBlockTypeMeta = (type: LayoutBlockISO['type']) => {
    switch (type) {
      case 'INFO_GRID':
        return { label: 'Thông tin chung', icon: <Layers size={13} style={{ color: '#0284c7' }} />, tagColor: '#e0f2fe', tagText: '#0369a1' };
      case 'TABLE':
        return { label: 'Bảng dữ liệu', icon: <Table size={13} style={{ color: '#0d9488' }} />, tagColor: '#e6fffa', tagText: '#0f766e' };
      case 'CHECKLIST_TABLE':
        return { label: 'Bảng kiểm tra', icon: <CheckSquare size={13} style={{ color: '#16a34a' }} />, tagColor: '#dcfce7', tagText: '#15803d' };
      case 'SIGN':
        return { label: 'Chữ ký', icon: <PenTool size={13} style={{ color: '#d97706' }} />, tagColor: '#fef3c7', tagText: '#b45309' };
      case 'SECTION_LABEL':
        return { label: 'Ghi chú / Nhãn', icon: <FileText size={13} style={{ color: '#64748b' }} />, tagColor: '#f1f5f9', tagText: '#475569' };
      default:
        return { label: type, icon: <Layers size={13} style={{ color: '#64748b' }} />, tagColor: '#f1f5f9', tagText: '#475569' };
    }
  };

  const renderBlockSummary = (block: LayoutBlockISO) => {
    if (block.type === 'INFO_GRID' && block.fields?.length > 0) {
      const fieldNames = block.fields.map(f => f.checkItem || '(Chưa đặt tên)').filter(Boolean);
      const displayNames = fieldNames.slice(0, 4).join(', ');
      const remaining = fieldNames.length - 4;
      return (
        <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
          {block.fields.length} trường: <strong style={{ color: '#334155', fontWeight: 500 }}>{displayNames}</strong>
          {remaining > 0 && <span style={{ color: '#94a3b8' }}> +{remaining} trường khác</span>}
        </span>
      );
    }
    if ((block.type === 'TABLE' || block.type === 'CHECKLIST_TABLE') && block.tableColumns?.length) {
      const colNames = block.tableColumns.map(c => c.label).filter(Boolean).slice(0, 4).join(', ');
      const remainingCols = block.tableColumns.length - 4;
      return (
        <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
          {block.tableColumns.length} cột, {block.tableRows?.length || 0} dòng: <strong style={{ color: '#334155', fontWeight: 500 }}>{colNames}</strong>
          {remainingCols > 0 && <span style={{ color: '#94a3b8' }}> +{remainingCols} cột khác</span>}
        </span>
      );
    }
    if (block.type === 'SIGN' && block.fields?.length > 0) {
      const signNames = block.fields.map(f => f.checkItem || 'Chữ ký').join(', ');
      return (
        <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
          {block.fields.length} chữ ký: <strong style={{ color: '#334155', fontWeight: 500 }}>{signNames}</strong>
        </span>
      );
    }
    return (
      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
        Khối nội dung sẵn sàng sao chép
      </span>
    );
  };

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
        .copy-section-modal-card {
          animation: modal-scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div
        className="copy-section-modal-card"
        style={{
          width: '100%',
          maxWidth: '560px',
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
            padding: '0.9rem 1.25rem',
            borderBottom: '1px solid var(--neutral-border, #e2e8f0)',
            background: '#fafafa'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            {mode === 'select_block' && (
              <button
                type="button"
                onClick={() => setMode('browse')}
                title="Quay lại danh sách biểu mẫu"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-secondary, #64748b)',
                  borderRadius: '4px',
                  marginRight: '2px'
                }}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
              {mode === 'browse' ? (
                <Copy size={16} style={{ color: 'var(--primary, #0d9488)', flexShrink: 0 }} />
              ) : (
                <FileText size={16} style={{ color: 'var(--primary, #0d9488)', flexShrink: 0 }} />
              )}
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mode === 'browse' ? 'Sao chép Khối từ Biểu mẫu khác' : `Chọn khối từ: ${selectedForm?.formTitle || ''}`}
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
              borderRadius: '4px',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* STEP 1: BROWSE FORMS */}
        {mode === 'browse' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Search Box */}
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
                  placeholder="Tìm theo mã hoặc tên biểu mẫu nguồn..."
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
            </div>

            {/* List of Forms */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.5rem 0.75rem',
                minHeight: '260px',
                maxHeight: '400px'
              }}
            >
              {filteredForms.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted, #94a3b8)' }}>
                  <FileText size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem' }}>
                    Không tìm thấy biểu mẫu nào khớp với "{searchTerm}".
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Vui lòng thử tìm với từ khóa hoặc mã biểu mẫu khác.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {filteredForms.map((form) => (
                    <div
                      key={form.key}
                      onClick={() => {
                        setSelectedFormKey(form.key);
                        setMode('select_block');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: '#ffffff',
                        border: '1px solid transparent',
                        transition: 'all 0.12s ease',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0fdfa';
                        e.currentTarget.style.borderColor = '#99f6e4';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = 'transparent';
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
                          {form.formId}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                            {form.formTitle}
                          </span>
                          {!form.isSameProcess && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {form.processTitle}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#64748b',
                            backgroundColor: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: '10px'
                          }}
                        >
                          {form.blocks.length} khối
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--primary, #0d9488)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          Chọn <ChevronRight size={13} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: SELECT BLOCK TO COPY */}
        {mode === 'select_block' && selectedForm && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Context Sub-header */}
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Nguồn:</span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--primary, #0d9488)',
                    backgroundColor: '#e6fffa',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    border: '1px solid #b2f5ea',
                    flexShrink: 0
                  }}
                >
                  {selectedForm.formId}
                </span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedForm.formTitle}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', flexShrink: 0 }}>
                {selectedForm.blocks.length} khối có sẵn
              </span>
            </div>

            {/* Blocks List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: '260px',
                maxHeight: '400px'
              }}
            >
              {selectedForm.blocks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted, #94a3b8)' }}>
                  <Layers size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Biểu mẫu này không có khối nội dung nào có thể sao chép.</p>
                </div>
              ) : (
                selectedForm.blocks.map((block) => {
                  const meta = getBlockTypeMeta(block.type);
                  return (
                    <div
                      key={block.id}
                      style={{
                        padding: '0.75rem 0.9rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0fdfa';
                        e.currentTarget.style.borderColor = '#99f6e4';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: meta.tagText,
                              backgroundColor: meta.tagColor,
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            {meta.icon}
                            {meta.label}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {block.title || '(Khối không có tiêu đề)'}
                          </span>
                        </div>
                        {renderBlockSummary(block)}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onCopyBlock(block);
                          onClose();
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '0.4rem 0.8rem',
                          backgroundColor: 'var(--primary, #0d9488)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '5px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'opacity 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        <Plus size={13} />
                        Sao chép
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
