import { useState, useEffect, useRef } from 'react';
import type { FormFieldISO, FormRevisionEntry, FormTemplateISO, LayoutBlockISO, RadioOption, MatrixConfigISO, TableColumnConfig, TableRowConfig, ColumnSummaryRowConfig, TitleFormatISO, SubtableColumn } from '../types';
import { formatFormVersion, getColStyleWidth } from '../types';
import { sanitizeLabel, getEffectiveTitleFormat, getAutoCheckboxLayoutMode, hasLongOptions, canTableOptionsFitInline, isSeamlessTableBlock, getInfoGridTemplateColumns, snap2ColWidth, snap3ColWidths, INFO_GRID_2COL_PRESETS, generateSmartFieldSlug } from '../utils/formUtils';
import { applyTextFormat, handleFormatKeyDown } from '../utils/textFormatter';
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  Hash, 
  Calendar, 
  X, 
  Clock, 
  PenTool, 
  Camera, 
  Grid,
  Copy,
  AlignLeft,
  AlignCenter,
  AlignRight,
  GitBranch,
  Rows2,
  Columns2,
  Link,
  Link2Off,
  Eye,
  EyeOff,
  CheckSquare,
  Printer,
  Star,
  SquareDashed,
  Table as TableIcon,
  CircleDot,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import PrintBlankForm from './print/PrintBlankForm';

interface FormBuilderProps {
  formName: string;
  initialData?: {
    formId?: string;
    formTitle?: string;
    version?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    updatedAt?: string;
    pageSize?: 'A4' | 'A5_LANDSCAPE';
    layoutBlocks?: LayoutBlockISO[];
    revisionHistory?: FormRevisionEntry[];
  };
  onSave: (data: any) => void;
  onClose: () => void;
  /** Nếu có → Form ID đang được quản lý bởi process này → khoá trường Form ID */
  linkedProcessId?: string;
  /**
   * Callback khi user xác nhận phá liên kết.
   * ProcessEditor xử lý việc xoá form khỏi steps + auto-save.
   * Trả về Promise<boolean>: true = thành công, false = thất bại.
   */
  onUnlinkFromProcess?: () => Promise<boolean>;
}



const generateFormChangeSummary = (
  initialBlocks?: LayoutBlockISO[],
  currentBlocks?: LayoutBlockISO[],
  history?: FormRevisionEntry[]
): string => {
  const hasActiveVersion = (history || []).some(
    h => h.status === 'ACTIVE' || h.status === 'RETIRED' || h.change?.includes('Published')
  );

  if (!hasActiveVersion) {
    return 'Ban hành lần đầu';
  }

  const current = currentBlocks || [];
  const initial = initialBlocks || [];

  const changes: string[] = [];

  const initialBlockMap = new Map<string, LayoutBlockISO>();
  initial.forEach(b => initialBlockMap.set(b.id, b));

  const currentBlockMap = new Map<string, LayoutBlockISO>();
  current.forEach(b => currentBlockMap.set(b.id, b));

  // 1. Detect added groups
  current.forEach(b => {
    if (!initialBlockMap.has(b.id)) {
      const groupTitle = b.title || b.type;
      changes.push(`[BỔ SUNG] Bổ sung nhóm mới: "${groupTitle}"`);
    }
  });

  // 2. Detect removed groups
  initial.forEach(b => {
    if (!currentBlockMap.has(b.id)) {
      const groupTitle = b.title || b.type;
      changes.push(`[LOẠI BỎ] Loại bỏ nhóm: "${groupTitle}"`);
    }
  });

  // 3. Detect modified groups and field diffs inside existing groups
  current.forEach(currBlock => {
    const initBlock = initialBlockMap.get(currBlock.id);
    if (!initBlock) return;

    const groupTitle = currBlock.title || currBlock.type;

    if (currBlock.title !== initBlock.title) {
      changes.push(`[ĐIỀU CHỈNH] Đổi tên nhóm: "${initBlock.title || 'Không tiêu đề'}" ➔ "${currBlock.title}"`);
    }

    const initFieldMap = new Map<string, FormFieldISO>();
    (initBlock.fields || []).forEach(f => initFieldMap.set(f.id, f));

    const currFieldMap = new Map<string, FormFieldISO>();
    (currBlock.fields || []).forEach(f => currFieldMap.set(f.id, f));

    // Added fields (nội dung)
    (currBlock.fields || []).forEach(f => {
      if (!initFieldMap.has(f.id)) {
        const itemLabel = sanitizeLabel(f.checkItem) || f.type;
        changes.push(`[BỔ SUNG] Thêm nội dung mới trong nhóm "${groupTitle}": "${itemLabel}"`);
      }
    });

    // Removed fields (nội dung)
    (initBlock.fields || []).forEach(f => {
      if (!currFieldMap.has(f.id)) {
        const itemLabel = sanitizeLabel(f.checkItem) || f.type;
        changes.push(`[LOẠI BỎ] Loại bỏ nội dung trong nhóm "${groupTitle}": "${itemLabel}"`);
      }
    });

    // Modified fields (nội dung)
    (currBlock.fields || []).forEach(f => {
      const initField = initFieldMap.get(f.id);
      if (!initField) return;

      const currLabel = sanitizeLabel(f.checkItem);
      const initLabel = sanitizeLabel(initField.checkItem);

      if (currLabel !== initLabel) {
        changes.push(`[ĐIỀU CHỈNH] Cập nhật nhãn nội dung trong nhóm "${groupTitle}": "${initLabel}" ➔ "${currLabel}"`);
      } else if (f.type !== initField.type) {
        changes.push(`[ĐIỀU CHỈNH] Cập nhật kiểu nội dung "${currLabel || 'Nội dung'}" trong nhóm "${groupTitle}"`);
      } else if (f.type === 'subtable') {
        const initCols = initField.subtableColumns || [];
        const currCols = f.subtableColumns || [];
        if (initCols.length !== currCols.length || JSON.stringify(initCols) !== JSON.stringify(currCols)) {
          changes.push(`[ĐIỀU CHỈNH] Điều chỉnh cột bảng subtable trong nhóm "${groupTitle}"`);
        }
      }
    });
  });

  if (changes.length === 0) {
    return '[ĐIỀU CHỈNH] Cập nhật điều chỉnh chi tiết biểu mẫu.';
  }

  const uniqueChanges = Array.from(new Set(changes));
  if (uniqueChanges.length > 5) {
    return uniqueChanges.slice(0, 4).join('\n') + '\n• Và một số điều chỉnh chi tiết khác.';
  }

  return uniqueChanges.join('\n');
};

interface InfoGridSteppedSplitterProps {
  columns: 2 | 3;
  columnWidths?: number[];
  onChange: (widths: number[]) => void;
  disabled?: boolean;
}

function InfoGridSteppedSplitter({ columns, columnWidths, onChange, disabled }: InfoGridSteppedSplitterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeHandle, setActiveHandle] = useState<number | null>(null);

  // 2 Columns Setup
  const w1 = columns === 2 ? (columnWidths?.[0] ?? 50) : 0;
  const w2 = columns === 2 ? (columnWidths?.[1] ?? (100 - w1)) : 0;

  // 3 Columns Setup
  const c3_w1 = columns === 3 ? (columnWidths?.[0] ?? 33) : 0;
  const c3_w2 = columns === 3 ? (columnWidths?.[1] ?? 34) : 0;
  const c3_w3 = columns === 3 ? (columnWidths?.[2] ?? Math.max(10, 100 - c3_w1 - c3_w2)) : 0;
  const c3_pos1 = c3_w1;
  const c3_pos2 = c3_w1 + c3_w2;

  const handlePointerDown = (handleIdx: number, e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handleIdx);

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const rawPct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));

      if (columns === 2) {
        const snapped = snap2ColWidth(rawPct);
        onChange(snapped);
      } else if (columns === 3) {
        const snapped = snap3ColWidths(handleIdx as 0 | 1, rawPct);
        onChange(snapped);
      }
    };

    const onUp = () => {
      setActiveHandle(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };

  const handleBarClick = (e: React.MouseEvent) => {
    if (disabled || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const rawPct = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));

    if (columns === 2) {
      const snapped = snap2ColWidth(rawPct);
      onChange(snapped);
    } else if (columns === 3) {
      const distTo1 = Math.abs(rawPct - c3_pos1);
      const distTo2 = Math.abs(rawPct - c3_pos2);
      const handleIdx: 0 | 1 = distTo1 <= distTo2 ? 0 : 1;
      const snapped = snap3ColWidths(handleIdx, rawPct);
      onChange(snapped);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', userSelect: 'none' }}>
      {/* Interactive Track */}
      <div
        ref={containerRef}
        onClick={handleBarClick}
        style={{
          position: 'relative',
          height: '34px',
          background: '#f8fafc',
          border: '1.5px solid #cbd5e1',
          borderRadius: '6px',
          overflow: 'hidden',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
        }}
      >
        {columns === 2 ? (
          <>
            {/* Tick Marks for 2 Columns */}
            {INFO_GRID_2COL_PRESETS.map((pct) => (
              <div
                key={pct}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  bottom: 0,
                  width: '1px',
                  height: pct === 50 ? '8px' : '4px',
                  background: pct === 50 ? '#0d9488' : '#cbd5e1',
                  pointerEvents: 'none',
                  zIndex: 1
                }}
              />
            ))}

            {/* Left Segment */}
            <div
              style={{
                width: `${w1}%`,
                background: 'rgba(13, 148, 136, 0.12)',
                borderRight: '1px solid rgba(13, 148, 136, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#0f766e',
                transition: activeHandle !== null ? 'none' : 'width 0.15s ease'
              }}
            >
              {w1}%
            </div>

            {/* Right Segment */}
            <div
              style={{
                width: `${w2}%`,
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#334155',
                transition: activeHandle !== null ? 'none' : 'width 0.15s ease'
              }}
            >
              {w2}%
            </div>

            {/* Handle */}
            <div
              onMouseDown={(e) => handlePointerDown(0, e)}
              onTouchStart={(e) => handlePointerDown(0, e)}
              style={{
                position: 'absolute',
                left: `${w1}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '24px',
                background: '#ffffff',
                border: '1.5px solid #0d9488',
                borderRadius: '4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                cursor: disabled ? 'not-allowed' : 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                zIndex: 10,
                transition: activeHandle !== null ? 'none' : 'left 0.15s ease'
              }}
              title="Kéo sang trái/phải để điều chỉnh tỷ lệ 2 cột"
            >
              <div style={{ width: '1.5px', height: '10px', background: '#0d9488', borderRadius: '1px' }} />
              <div style={{ width: '1.5px', height: '10px', background: '#0d9488', borderRadius: '1px' }} />
            </div>
          </>
        ) : (
          <>
            {/* 3 Columns Segments */}
            <div
              style={{
                width: `${c3_w1}%`,
                background: 'rgba(13, 148, 136, 0.12)',
                borderRight: '1px solid rgba(13, 148, 136, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#0f766e',
                transition: activeHandle !== null ? 'none' : 'width 0.15s ease'
              }}
            >
              {c3_w1}%
            </div>

            <div
              style={{
                width: `${c3_w2}%`,
                background: '#ffffff',
                borderRight: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#1e293b',
                transition: activeHandle !== null ? 'none' : 'width 0.15s ease'
              }}
            >
              {c3_w2}%
            </div>

            <div
              style={{
                width: `${c3_w3}%`,
                background: 'rgba(100, 116, 139, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#475569',
                transition: activeHandle !== null ? 'none' : 'width 0.15s ease'
              }}
            >
              {c3_w3}%
            </div>

            {/* Handle 1 (between Col 1 and Col 2) */}
            <div
              onMouseDown={(e) => handlePointerDown(0, e)}
              onTouchStart={(e) => handlePointerDown(0, e)}
              style={{
                position: 'absolute',
                left: `${c3_pos1}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '24px',
                background: '#ffffff',
                border: '1.5px solid #0d9488',
                borderRadius: '4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                cursor: disabled ? 'not-allowed' : 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                zIndex: 10,
                transition: activeHandle !== null ? 'none' : 'left 0.15s ease'
              }}
              title="Kéo để điều chỉnh ranh giới Cột 1 & 2"
            >
              <div style={{ width: '1.5px', height: '10px', background: '#0d9488', borderRadius: '1px' }} />
              <div style={{ width: '1.5px', height: '10px', background: '#0d9488', borderRadius: '1px' }} />
            </div>

            {/* Handle 2 (between Col 2 and Col 3) */}
            <div
              onMouseDown={(e) => handlePointerDown(1, e)}
              onTouchStart={(e) => handlePointerDown(1, e)}
              style={{
                position: 'absolute',
                left: `${c3_pos2}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '16px',
                height: '24px',
                background: '#ffffff',
                border: '1.5px solid #0d9488',
                borderRadius: '4px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                cursor: disabled ? 'not-allowed' : 'col-resize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                zIndex: 10,
                transition: activeHandle !== null ? 'none' : 'left 0.15s ease'
              }}
              title="Kéo để điều chỉnh ranh giới Cột 2 & 3"
            >
              <div style={{ width: '1.5px', height: '10px', background: '#0d9488', borderRadius: '1px' }} />
              <div style={{ width: '1.5px', height: '10px', background: '#0d9488', borderRadius: '1px' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export interface FieldTypeOptionItem {
  value: 'label' | 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature' | 'photo' | 'subtable' | 'likert_scale' | 'rating';
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; style?: React.CSSProperties }>;
}

export const getFormSnapshot = (data: {
  formId: string;
  formTitle: string;
  version: string;
  status: string;
  pageSize: string;
  effectiveDate?: string;
  layoutBlocks: LayoutBlockISO[];
  revisionHistory: FormRevisionEntry[];
}) => {
  return JSON.stringify({
    formId: data.formId,
    formTitle: data.formTitle,
    version: data.version,
    status: data.status,
    pageSize: data.pageSize,
    effectiveDate: data.effectiveDate,
    layoutBlocks: data.layoutBlocks,
    revisionHistory: data.revisionHistory
  });
};

export const FIELD_TYPE_OPTIONS: FieldTypeOptionItem[] = [
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'time', label: 'Time', icon: Clock },
  { value: 'radio', label: 'Radio', icon: CircleDot },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'likert_scale', label: 'Scale', icon: SlidersHorizontal },
  { value: 'photo', label: 'Photo', icon: Camera },
  { value: 'signature', label: 'Sign-off', icon: PenTool },
  { value: 'subtable', label: 'Subtable', icon: TableIcon },
  { value: 'label', label: 'Label', icon: AlignLeft }
];

interface FieldTypeDropdownProps {
  value: 'label' | 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature' | 'photo' | 'rating' | 'subtable' | 'likert_scale';
  onChange: (newType: 'label' | 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature' | 'photo' | 'rating' | 'subtable' | 'likert_scale') => void;
  disabled?: boolean;
  compact?: boolean;
}

function FieldTypeDropdown({ value, onChange, disabled, compact }: FieldTypeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeOption = FIELD_TYPE_OPTIONS.find(o => o.value === value) 
    || (value === 'rating' ? { value: 'likert_scale', label: 'Scale', icon: SlidersHorizontal } : FIELD_TYPE_OPTIONS[0]);
  const ActiveIcon = activeOption.icon;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: compact ? 'fit-content' : '100%', userSelect: 'none' }}>
      {/* Trigger Button Card */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        style={compact ? {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 6px',
          borderRadius: '4px',
          border: isOpen ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
          background: '#ffffff',
          color: '#0f172a',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.72rem',
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease',
          outline: 'none',
          minWidth: '85px',
          justifyContent: 'space-between'
        } : {
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 0.65rem',
          borderRadius: '6px',
          border: isOpen ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
          background: '#ffffff',
          color: '#0f172a',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '0.82rem',
          fontWeight: 600,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'all 0.15s ease',
          outline: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? '4px' : '0.6rem' }}>
          <ActiveIcon size={compact ? 13 : 16} strokeWidth={2} style={{ color: 'var(--primary)' }} />
          <span>{activeOption.label}</span>
        </div>
        <ChevronDown
          size={compact ? 11 : 14}
          strokeWidth={2}
          style={{
            color: '#64748b',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            marginLeft: '2px'
          }}
        />
      </button>

      {/* Popover Card Menu List */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: compact ? 0 : 'auto',
            left: compact ? 'auto' : 0,
            width: compact ? '160px' : 'auto',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.12), 0 4px 6px -4px rgba(0,0,0,0.08)',
            padding: '0.35rem',
            zIndex: 9999,
            maxHeight: '340px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}
        >
          {FIELD_TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = opt.value === value || (value === 'rating' && opt.value === 'likert_scale');
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: compact ? '0.35rem 0.5rem' : '0.45rem 0.6rem',
                  borderRadius: '6px',
                  border: isSelected ? '1.5px solid var(--primary)' : '1px solid #f1f5f9',
                  background: isSelected ? 'rgba(13, 148, 136, 0.06)' : '#ffffff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.12s ease',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#f1f5f9';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon size={14} strokeWidth={2} style={{ color: isSelected ? 'var(--primary)' : '#64748b' }} />
                  <span style={{ fontSize: '0.76rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--primary)' : '#1e293b' }}>
                    {opt.label}
                  </span>
                </div>
                {isSelected && <Check size={13} strokeWidth={2.5} style={{ color: 'var(--primary)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface InCanvasTitleHeaderProps {
  block: LayoutBlockISO;
  isLocked: boolean;
  isBlockSelected: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription?: (desc: string) => void;
  onUpdateTitleFormat: (fmt: TitleFormatISO) => void;
  onSelectBlock: () => void;
}

function InCanvasTitleHeader({
  block,
  isLocked,
  isBlockSelected,
  onUpdateTitle,
  onUpdateDescription,
  onUpdateTitleFormat,
  onSelectBlock
}: InCanvasTitleHeaderProps) {
  const titleFmt = getEffectiveTitleFormat(block);

  const renderStylePill = () => (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        background: '#f1f5f9',
        padding: '2px',
        borderRadius: '5px',
        border: '1px solid #cbd5e1',
        gap: '2px',
        flexShrink: 0
      }}
    >
      {(['H1', 'H2', 'BODY', 'NONE'] as const).map(fmt => {
        const isSelected = titleFmt === fmt;
        const labelText = fmt === 'BODY' ? 'Body' : fmt === 'NONE' ? 'None' : fmt;
        return (
          <button
            key={fmt}
            type="button"
            disabled={isLocked}
            onClick={() => onUpdateTitleFormat(fmt)}
            style={{
              padding: '1px 6px',
              fontSize: '0.65rem',
              fontWeight: isSelected ? 700 : 500,
              border: 'none',
              borderRadius: '3px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              background: isSelected ? 'var(--primary)' : 'transparent',
              color: isSelected ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.12s ease',
              lineHeight: '16px'
            }}
            title={`Định dạng tiêu đề: ${labelText}`}
          >
            {labelText}
          </button>
        );
      })}
    </div>
  );

  if (titleFmt === 'NONE') {
    if (block.type === 'SECTION_LABEL' || isBlockSelected) {
      return (
        <div
          onClick={onSelectBlock}
          style={{
            padding: '0.35rem 0.6rem',
            border: '1.5px dashed #cbd5e1',
            borderRadius: '4px',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic' }}>
            {block.type === 'SECTION_LABEL' ? '⚠️ Section Label đang ẩn (Format: NONE) — Bấm chọn Style để hiển thị:' : 'Tiêu đề khối đang ẩn — Bấm chọn Style để hiển thị:'}
          </span>
          {renderStylePill()}
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          {titleFmt === 'H1' ? (
            <input
              type="text"
              disabled={isLocked}
              value={block.title}
              onClick={onSelectBlock}
              onChange={(e) => onUpdateTitle(e.target.value)}
              placeholder="NHẬP TIÊU ĐỀ PHÂN ĐOẠN (H1)..."
              style={{
                width: '100%',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#0f172a',
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                padding: '0.15rem 0.2rem',
                borderRadius: '0px',
                cursor: isLocked ? 'default' : 'text',
                transition: 'all 0.15s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = '#f8fafc';
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            />
          ) : titleFmt === 'H2' ? (
            <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid var(--primary)', borderRadius: '0px' }}>
              <input
                type="text"
                disabled={isLocked}
                value={block.title}
                onClick={onSelectBlock}
                onChange={(e) => onUpdateTitle(e.target.value)}
                placeholder="Nhập tiêu đề phân đoạn (H2)..."
                style={{
                  width: '100%',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#1e293b',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  padding: '0.1rem 0.2rem',
                  cursor: isLocked ? 'default' : 'text',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              />
            </div>
          ) : (
            <div style={{ padding: '0.1rem 0' }}>
              <input
                type="text"
                disabled={isLocked}
                value={block.title}
                onClick={onSelectBlock}
                onChange={(e) => onUpdateTitle(e.target.value)}
                placeholder="Nhập tiêu đề phân đoạn (Body)..."
                style={{
                  width: '100%',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderBottom: '1px dotted #cbd5e1',
                  background: 'transparent',
                  outline: 'none',
                  padding: '0.1rem 0.2rem',
                  cursor: isLocked ? 'default' : 'text',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              />
            </div>
          )}
        </div>
        {renderStylePill()}
      </div>

      {block.type === 'SECTION_LABEL' && (
        <div style={{ display: 'grid', width: '100%', marginTop: '4px', position: 'relative' }}>
          {/* CSS Grid Auto-Grow Textarea mirror span */}
          <span
            aria-hidden="true"
            style={{
              gridArea: '1 / 1 / 2 / 2',
              visibility: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.8rem',
              lineHeight: 1.5,
              fontFamily: 'inherit',
              padding: '0.2rem 0.35rem',
              minHeight: '26px'
            }}
          >
            {(block.description || '') + ' '}
          </span>

          {/* Overlay Textarea */}
          <textarea
            disabled={isLocked}
            rows={1}
            value={block.description || ''}
            onClick={onSelectBlock}
            onKeyDown={(e) => handleFormatKeyDown(e, block.description || '', (val) => onUpdateDescription?.(val))}
            onChange={(e) => onUpdateDescription?.(e.target.value)}
            placeholder="Gõ mô tả hoặc ghi chú hướng dẫn (hỗ trợ **in đậm**, *in nghiêng*, __gạch chân__)..."
            style={{
              gridArea: '1 / 1 / 2 / 2',
              width: '100%',
              height: '100%',
              fontSize: '0.8rem',
              color: '#475569',
              border: '1px solid transparent',
              borderRadius: '4px',
              background: 'transparent',
              outline: 'none',
              padding: '0.2rem 0.35rem',
              margin: 0,
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              cursor: isLocked ? 'default' : 'text',
              transition: 'all 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.background = '#ffffff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.background = 'transparent';
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function FormBuilder({ formName, initialData, onSave, onClose, linkedProcessId, onUnlinkFromProcess }: FormBuilderProps) {
  // 1. Core Layout State
  const [formId, setFormId] = useState(initialData?.formId || `FM-${formName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`);
  const [formTitle, setFormTitle] = useState(initialData?.formTitle || formName);
  const [version, setVersion] = useState(
    initialData?.version ? initialData.version.replace(/\s*\([^)]*\)/g, '').trim() : 'v0.1'
  );
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(initialData?.status || 'DRAFT');
  const [pageSize, setPageSize] = useState<'A4' | 'A5_LANDSCAPE'>(
    initialData?.pageSize || (initialData as any)?.page_size || 'A4'
  );
  
  // Default blocks if none provided
  const defaultBlocks: LayoutBlockISO[] = [];

  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlockISO[]>(initialData?.layoutBlocks || defaultBlocks);
  const [revisionHistory, setRevisionHistory] = useState<FormRevisionEntry[]>(initialData?.revisionHistory || []);
  const [loading, setLoading] = useState(false);
  const inspectorLabelRef = useRef<HTMLTextAreaElement>(null);
  const sectionDescRef = useRef<HTMLTextAreaElement>(null);
  const [effectiveDate, setEffectiveDate] = useState(() => (initialData as any)?.effectiveDate || (initialData as any)?.effective_date || new Date().toISOString().split('T')[0]);

  // Track saved state via Snapshot comparison
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(() => {
    return getFormSnapshot({
      formId: initialData?.formId || `FM-${formName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`,
      formTitle: initialData?.formTitle || formName,
      version: initialData?.version ? initialData.version.replace(/\s*\([^)]*\)/g, '').trim() : 'v0.1',
      status: initialData?.status || 'DRAFT',
      pageSize: initialData?.pageSize || (initialData as any)?.page_size || 'A4',
      effectiveDate: (initialData as any)?.effectiveDate || (initialData as any)?.effective_date,
      layoutBlocks: initialData?.layoutBlocks || defaultBlocks,
      revisionHistory: initialData?.revisionHistory || []
    });
  });

  useEffect(() => {
    const fetchFormTemplate = async () => {
      const targetId = initialData?.formId || formName;
      if (!targetId) return;
      try {
        setLoading(true);
        // 1. Fetch current form details
        const res = await fetch(`/api/forms/${encodeURIComponent(targetId)}`);
        if (res.ok) {
          const data = await res.json();
          const targetFormId = data.form_id || targetId;
          const targetFormTitle = data.form_title || data.form_name || targetId;
          const targetVersion = (data.version || 'v0.1').replace(/\s*\([^)]*\)/g, '').trim();
          const targetEffectiveDate = data.effective_date ? data.effective_date.split('T')[0] : undefined;
          const targetStatus = data.status || 'DRAFT';
          const targetPageSize = data.page_size || data.pageSize || 'A4';
          const targetBlocks = data.layout_blocks
            ? (typeof data.layout_blocks === 'string' ? JSON.parse(data.layout_blocks) : data.layout_blocks)
            : [];

          setFormId(targetFormId);
          setFormTitle(targetFormTitle);
          setVersion(targetVersion);
          if (targetEffectiveDate) {
            setEffectiveDate(targetEffectiveDate);
          }
          setStatus(targetStatus);
          setPageSize(targetPageSize);
          setLayoutBlocks(targetBlocks);

          // 2. Fetch unified form revision history (including historical and bug duplicates)
          let targetHistory: FormRevisionEntry[] = [];
          const historyRes = await fetch(`/api/forms/${encodeURIComponent(targetId)}/history`);
          if (historyRes.ok) {
            targetHistory = await historyRes.json();
            setRevisionHistory(targetHistory);
          }

          setLastSavedSnapshot(getFormSnapshot({
            formId: targetFormId,
            formTitle: targetFormTitle,
            version: targetVersion,
            status: targetStatus,
            pageSize: targetPageSize,
            effectiveDate: targetEffectiveDate,
            layoutBlocks: targetBlocks,
            revisionHistory: targetHistory
          }));
        }
      } catch (err) {
        console.error("Error fetching form template and history:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFormTemplate();
  }, [initialData?.formId, formName]);

  const saveFormToBackend = async (opts: { versionOverride?: string, statusOverride?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED', historyOverride?: FormRevisionEntry[], effectiveDateOverride?: string, layoutBlocksOverride?: LayoutBlockISO[], allowActiveUpdate?: boolean, oldVersionOverride?: string } = {}) => {
    const activeVersion = opts.versionOverride || version;
    const activeStatus = opts.statusOverride || status;
    let activeHistory = opts.historyOverride || revisionHistory;

    try {
      const initialCleanVer = initialData?.version ? initialData.version.replace(/\s*\([^)]*\)/g, '').trim() : undefined;
      const targetOldVer = opts.oldVersionOverride || (initialCleanVer && initialCleanVer !== activeVersion ? initialCleanVer : undefined);
      
      // If renaming a draft version, filter out the old draft version string from activeHistory
      if (targetOldVer && targetOldVer !== activeVersion) {
        activeHistory = activeHistory.filter(h => {
          const cleanH = h.version ? h.version.replace(/\s*\([^)]*\)/g, '').trim() : '';
          return cleanH !== targetOldVer;
        });
        setRevisionHistory(activeHistory);
      }

      const payload = {
        formId,
        formName,
        formTitle,
        status: activeStatus,
        version: activeVersion,
        pageSize,
        effectiveDate: activeStatus === 'ACTIVE' ? (opts.effectiveDateOverride || effectiveDate) : null,
        layoutBlocks: opts.layoutBlocksOverride ?? layoutBlocks,
        revisionHistory: activeHistory,
        allowActiveUpdate: opts.allowActiveUpdate ?? true,
        oldFormId: initialData?.formId && initialData.formId !== formId ? initialData.formId : undefined,
        oldVersion: targetOldVer
      };
      
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        throw new Error('Failed to save form template to database');
      }
      
      const savedForm = await res.json();
      return savedForm;
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error saving form template.');
      throw err;
    }
  };
  
  // Selection and editor states
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [isLocked, setIsLocked] = useState(initialData?.status === 'ACTIVE');
  /** true = Form ID bị khoá vì đang liên kết với process (có thể đổi sang false sau khi unlink) */
  const [formIdLinked, setFormIdLinked] = useState(!!linkedProcessId);
  const [printPreviewData, setPrintPreviewData] = useState<FormTemplateISO | null>(null);
  const [autoExportPdf, setAutoExportPdf] = useState<boolean>(false);
  const [currentDraftBackup, setCurrentDraftBackup] = useState<{ layoutBlocks: LayoutBlockISO[]; version: string; isLocked: boolean } | null>(null);
  const [viewingRevisionVersion, setViewingRevisionVersion] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'properties' | 'versions'>('properties');
  const [hoveredTableRowId, setHoveredTableRowId] = useState<string | null>(null);
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);

  // Compute live snapshot & isSaved state
  const currentSnapshot = getFormSnapshot({
    formId,
    formTitle,
    version,
    status,
    pageSize,
    effectiveDate: status === 'ACTIVE' ? effectiveDate : undefined,
    layoutBlocks,
    revisionHistory
  });
  const isSaved = lastSavedSnapshot !== '' && lastSavedSnapshot === currentSnapshot;

  useEffect(() => {
    if (activeBlockId) {
      setRightTab('properties');
    }
  }, [activeBlockId]);

  useEffect(() => {
    if (rightTab === 'versions' && !changeSummary.trim()) {
      const suggested = generateFormChangeSummary(initialData?.layoutBlocks, layoutBlocks, revisionHistory);
      if (suggested) {
        setChangeSummary(suggested);
      }
    }
  }, [rightTab, layoutBlocks, initialData, revisionHistory]);

  useEffect(() => {
    setIsLocked(status === 'ACTIVE');
  }, [status]);

  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [existingLogos, setExistingLogos] = useState<{ key: string, isUsed: boolean }[]>([]);

  const titleBlock = layoutBlocks.find(b => b.type === 'TITLE');
  const titleBlockLogo = titleBlock?.logo;

  useEffect(() => {
    fetch('/api/storage/logos')
      .then(res => res.json())
      .then(data => {
        if (data.logos) {
          setExistingLogos(data.logos);
        }
      })
      .catch(err => console.error('Error fetching existing logos:', err));
  }, [titleBlockLogo]);

  const [showLogoGallery, setShowLogoGallery] = useState(false);
  const [resolvedLogos, setResolvedLogos] = useState<{[key: string]: string}>({});

  // Copy section states
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [allProcesses, setAllProcesses] = useState<any[]>([]);
  const [allFormsData, setAllFormsData] = useState<any[]>([]);
  const [selectedFormKey, setSelectedFormKey] = useState<string>(''); // format: "processId:formName"
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');

  useEffect(() => {
    if (showCopyModal && (allProcesses.length === 0 || allFormsData.length === 0)) {
      Promise.all([
        fetch('/api/processes').then(res => res.json()).catch(() => []),
        fetch('/api/forms').then(res => res.json()).catch(() => [])
      ]).then(([procData, formData]) => {
        if (Array.isArray(procData)) setAllProcesses(procData);
        if (Array.isArray(formData)) setAllFormsData(formData);
      }).catch(err => console.error('Error fetching data for section copy:', err));
    }
  }, [showCopyModal, allProcesses, allFormsData]);

  useEffect(() => {
    if (showLogoGallery && existingLogos.length > 0) {
      existingLogos.forEach(logo => {
        const key = logo.key;
        if (!resolvedLogos[key]) {
          fetch(`/api/storage/download-url?key=${encodeURIComponent(key)}`)
            .then(res => res.json())
            .then(data => {
              if (data.downloadUrl) {
                setResolvedLogos(prev => ({ ...prev, [key]: data.downloadUrl }));
              }
            })
            .catch(err => console.error('Error resolving gallery logo key:', key, err));
        }
      });
    }
  }, [showLogoGallery, existingLogos, resolvedLogos]);

  const handleDeleteUnusedLogo = async (logoKey: string) => {
    try {
      const res = await fetch('/api/storage/logos', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logoKey })
      });
      if (res.ok) {
        // Re-fetch logos list
        fetch('/api/storage/logos')
          .then(r => r.json())
          .then(data => {
            if (data.logos) {
              setExistingLogos(data.logos);
            }
          });
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete logo.');
      }
    } catch (err) {
      console.error('Error deleting logo from gallery:', err);
      alert('An error occurred while deleting the logo.');
    }
  };

  useEffect(() => {
    if (!titleBlockLogo) {
      setLogoUrl('');
      return;
    }
    if (titleBlockLogo.startsWith('uploads/')) {
      fetch(`/api/storage/download-url?key=${encodeURIComponent(titleBlockLogo)}`)
        .then(res => res.json())
        .then(data => {
          if (data.downloadUrl) {
            setLogoUrl(data.downloadUrl);
          }
        })
        .catch(err => {
          console.error('Error fetching logo URL:', err);
          setLogoUrl('');
        });
    } else {
      setLogoUrl(titleBlockLogo);
    }
  }, [titleBlockLogo]);

  const sanitizeLogoName = (fileName: string): string => {
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    return nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleLogoUpload = async (blockId: string, file: File) => {
    if (isLocked) return;
    setIsLogoUploading(true);
    try {
      const sanitizedName = sanitizeLogoName(file.name);
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isLogo: true,
          logoName: sanitizedName
        })
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json();
        throw new Error(errData.error || 'Failed to get secure upload URL.');
      }

      const { uploadUrl, pdfKey } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'image/jpeg'
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to Cloudflare storage.');
      }

      handleUpdateBlockLogo(blockId, pdfKey);
      // Auto-save immediately with the updated blocks so the R2 key is persisted
      // to DB before any cleanup routine runs. We pass layoutBlocksOverride because
      // setLayoutBlocks (called inside handleUpdateBlockLogo) is async — the state
      // won't be updated yet when saveFormToBackend reads `layoutBlocks` from closure.
      const updatedBlocks = layoutBlocks.map(b =>
        b.id === blockId ? { ...b, logo: pdfKey } : b
      );
      await saveFormToBackend({ layoutBlocksOverride: updatedBlocks });
      alert('Logo uploaded and saved successfully!');
    } catch (err) {
      console.error(err);
      alert(`Error uploading logo: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally {
      setIsLogoUploading(false);
    }
  };

  const handleLogoRemove = (blockId: string) => {
    if (isLocked) return;
    if (confirm('Are you sure you want to remove the logo from this form?')) {
      handleUpdateBlockLogo(blockId, '');
    }
  };

  // Extract version numbers for display logic
  const parseVersion = (vString: string) => {
    const match = vString.match(/v(\d+)\.(\d+)/);
    if (match) {
      return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
    }
    return { major: 0, minor: 1 };
  };

  // Helper: derive CHECKLIST_TABLE columns — falls back to columnLabels for backward compat
  const getChecklistColumns = (block: LayoutBlockISO, includeHidden = false): TableColumnConfig[] => {
    let cols: TableColumnConfig[];
    if (block.tableColumns && block.tableColumns.length > 0) {
      cols = block.tableColumns;
    } else if (block.columnLabels) {
      cols = [
        { id: 'col_stt',      label: block.columnLabels.stt      || 'STT',                          width: '40px',  type: 'static_text', locked: true },
        { id: 'col_item',     label: block.columnLabels.item     || 'Chi tiết kiểm tra',            width: 'auto',  type: 'static_text', locked: true },
        { id: 'col_target',   label: block.columnLabels.target   || 'Đạt / Không Đạt',             width: '130px', type: 'radio',        align: 'center',
          options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
        { id: 'col_reaction', label: block.columnLabels.reaction || 'Mô tả cụ thể nếu Không đạt', width: '220px', type: 'text' }
      ];
    } else {
      cols = [
        { id: 'col_stt',      label: 'STT',                          width: '5%',   type: 'static_text', locked: true },
        { id: 'col_item',     label: 'Tiêu chí',                     width: '35%',  type: 'static_text', locked: true },
        { id: 'col_unit',     label: 'Đơn vị',                       width: '10%',  type: 'static_text', locked: true },
        { id: 'col_spec',     label: 'Tiêu chuẩn',                   width: '20%',  type: 'static_text', locked: true },
        { id: 'col_target',   label: 'Kết quả',                      width: '15%',  type: 'radio',        align: 'center', locked: true,
          options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
        { id: 'col_reaction', label: 'Ghi chú',                      width: '15%',  type: 'text' }
      ];
    }

    if (block.hideSTT) {
      cols = cols.map(c => c.id === 'col_stt' ? { ...c, hidden: true } : c);
    }

    if (includeHidden) return cols;
    return cols.filter(c => !c.hidden);
  };

  // 2. Block Handlers
  const handleAddBlock = (type: 'TITLE' | 'INFO_GRID' | 'CHECKLIST_TABLE' | 'MATRIX_TABLE' | 'SIGN' | 'TABLE' | 'SECTION_LABEL', columns: 1 | 2 | 3 = 1) => {
    if (isLocked) return;
    const newBlock: LayoutBlockISO = {
      id: `b_${type.toLowerCase()}_${Date.now()}`,
      type,
      columns,
      title: type === 'TITLE' ? formTitle : type === 'INFO_GRID' ? 'Thông tin chung' : type === 'CHECKLIST_TABLE' ? 'Bảng kiểm tra' : type === 'MATRIX_TABLE' ? 'Bảng kiểm đếm số lượng' : type === 'TABLE' ? 'Bảng biểu mẫu động' : type === 'SECTION_LABEL' ? 'Tiêu đề danh mục' : 'Ký nhận',
      description: type === 'SECTION_LABEL' ? '' : undefined,
      titleFormat: type === 'SECTION_LABEL' ? 'H1' : undefined,
      sectionFormat: undefined,
      fields: [],
      columnLabels: type === 'CHECKLIST_TABLE' ? {
        stt: 'STT',
        item: 'Tiêu chí',
        target: 'Kết quả',
        reaction: 'Ghi chú'
      } : undefined,
      matrixConfig: type === 'MATRIX_TABLE' ? {
        rowHeader: 'Lớp',
        rowCount: 10,
        columnHeader: 'Tên hàng, quy cách',
        columns: ['SP 1', 'SP 2', 'SP 3'],
        showTotalColumn: true,
        totalColumnHeader: 'Tổng mỗi lớp (bao/carton)',
        showNotesColumn: true,
        notesColumnHeader: 'Ghi chú',
        columnAlign: 'center'
      } : undefined,
      tableColumns: type === 'CHECKLIST_TABLE' ? [
        { id: 'col_stt',      label: 'STT',                          width: '5%',   type: 'static_text', locked: true },
        { id: 'col_item',     label: 'Tiêu chí',                     width: '35%',  type: 'static_text', locked: true },
        { id: 'col_unit',     label: 'Đơn vị',                       width: '10%',  type: 'static_text', locked: true },
        { id: 'col_spec',     label: 'Tiêu chuẩn',                   width: '20%',  type: 'static_text', locked: true },
        { id: 'col_target',   label: 'Kết quả',                      width: '15%',  type: 'radio',        align: 'center', locked: true,
          options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
        { id: 'col_reaction', label: 'Ghi chú',                      width: '15%',  type: 'text' }
      ] : type === 'TABLE' ? [
        { id: 'col_1', label: 'STT', width: '8%', align: 'center', type: 'text' },
        { id: 'col_2', label: 'Tên hạng mục', width: '50%', type: 'text' },
        { id: 'col_3', label: 'Giá trị', width: '', type: 'number' }
      ] : undefined,
      tableRows: type === 'TABLE' ? [
        { id: 'row_1' },
        { id: 'row_2' }
      ] : undefined,
      tableData: type === 'TABLE' ? {
        row_1: { col_1: '1', col_2: 'Hạng mục kiểm tra A' },
        row_2: { col_1: '2', col_2: 'Hạng mục kiểm tra B' }
      } : undefined
    };
    setLayoutBlocks(prev => {
      if (activeBlockId) {
        const activeIdx = prev.findIndex(b => b.id === activeBlockId);
        if (activeIdx !== -1) {
          const next = [...prev];
          next.splice(activeIdx + 1, 0, newBlock);
          return next;
        }
      }
      return [...prev, newBlock];
    });
    setActiveBlockId(newBlock.id);
    setActiveFieldId(null);
  };

  const handleExecuteCopy = (sourceBlock: LayoutBlockISO) => {
    if (isLocked) return;
    
    // Generate new unique ID for the block
    const newBlockId = `b_${sourceBlock.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Regenerate unique IDs for all fields in the block to prevent collisions
    const existingIds = layoutBlocks.flatMap(b => (b.fields || []).map(f => f.id));
    const generatedIds = [...existingIds];
    const newFields = sourceBlock.fields.map(field => {
      const newFieldId = generateSmartFieldSlug(field.checkItem, generatedIds, field.type);
      generatedIds.push(newFieldId);
      return {
        ...field,
        id: newFieldId
      };
    });

    const newBlock: LayoutBlockISO = {
      ...sourceBlock,
      id: newBlockId,
      fields: newFields
    };

    // Insert after current activeBlockId if present, else append
    setLayoutBlocks(prev => {
      if (activeBlockId) {
        const activeIdx = prev.findIndex(b => b.id === activeBlockId);
        if (activeIdx !== -1) {
          const next = [...prev];
          next.splice(activeIdx + 1, 0, newBlock);
          return next;
        }
      }
      return [...prev, newBlock];
    });
    setShowCopyModal(false);
    setActiveBlockId(newBlockId);
    setActiveFieldId(null);
  };

  const handleCloneBlock = (blockId: string) => {
    if (isLocked) return;
    const sourceBlock = layoutBlocks.find(b => b.id === blockId);
    if (!sourceBlock || sourceBlock.type === 'TITLE') return;

    // Generate new unique ID for the block
    const newBlockId = `b_${sourceBlock.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Regenerate unique IDs for all fields in the block
    const existingIds = layoutBlocks.flatMap(b => (b.fields || []).map(f => f.id));
    const generatedIds = [...existingIds];
    const newFields = (sourceBlock.fields || []).map(field => {
      const newFieldId = generateSmartFieldSlug(field.checkItem, generatedIds, field.type);
      generatedIds.push(newFieldId);
      return {
        ...field,
        id: newFieldId
      };
    });

    // For TABLE blocks, regenerate unique row IDs and remap tableData and cellOptionsMap
    const rowIdMap = new Map<string, string>();
    const newRows = (sourceBlock.tableRows || []).map(row => {
      const newRowId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      rowIdMap.set(row.id, newRowId);
      return {
        ...row,
        id: newRowId
      };
    });

    const newTableData: { [rowId: string]: { [colId: string]: string } } = {};
    if (sourceBlock.tableData) {
      Object.entries(sourceBlock.tableData).forEach(([oldRowId, rowVals]) => {
        const mappedRowId = rowIdMap.get(oldRowId) || oldRowId;
        newTableData[mappedRowId] = { ...rowVals };
      });
    }

    const newCellOptionsMap: { [cellKey: string]: RadioOption[] } = {};
    if (sourceBlock.cellOptionsMap) {
      Object.entries(sourceBlock.cellOptionsMap).forEach(([oldCellKey, opts]) => {
        let mappedKey = oldCellKey;
        for (const [oldRId, newRId] of rowIdMap.entries()) {
          if (oldCellKey.startsWith(oldRId + '_')) {
            mappedKey = newRId + oldCellKey.slice(oldRId.length);
            break;
          }
        }
        newCellOptionsMap[mappedKey] = [...opts];
      });
    }

    const newCols = sourceBlock.tableColumns ? sourceBlock.tableColumns.map(c => ({
      ...c,
      options: c.options ? [...c.options] : undefined,
      scaleOptions: c.scaleOptions ? [...c.scaleOptions] : undefined,
      summaryRows: c.summaryRows ? [...c.summaryRows] : undefined
    })) : undefined;

    const newMatrixConfig = sourceBlock.matrixConfig ? {
      ...sourceBlock.matrixConfig,
      columns: [...sourceBlock.matrixConfig.columns]
    } : undefined;

    const newBlock: LayoutBlockISO = {
      ...sourceBlock,
      id: newBlockId,
      fields: newFields,
      tableRows: sourceBlock.type === 'TABLE' ? newRows : sourceBlock.tableRows,
      tableColumns: sourceBlock.type === 'TABLE' ? newCols : sourceBlock.tableColumns,
      tableData: sourceBlock.type === 'TABLE' ? newTableData : sourceBlock.tableData,
      cellOptionsMap: sourceBlock.type === 'TABLE' ? newCellOptionsMap : sourceBlock.cellOptionsMap,
      matrixConfig: sourceBlock.type === 'MATRIX_TABLE' ? newMatrixConfig : sourceBlock.matrixConfig
    };

    // Insert contextually immediately after the source block
    const sourceIdx = layoutBlocks.findIndex(b => b.id === blockId);
    const insertIdx = sourceIdx !== -1 ? sourceIdx + 1 : layoutBlocks.length;
    setLayoutBlocks(prev => {
      const next = [...prev];
      next.splice(insertIdx, 0, newBlock);
      return next;
    });

    setActiveBlockId(newBlockId);
    setActiveFieldId(null);
  };

  // Keyboard Shortcut: Ctrl+D / Cmd+D to clone currently active layout block
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (!isLocked && activeBlockId) {
          const target = e.target as HTMLElement | null;
          const isEditingText = target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
          );
          if (!isEditingText) {
            const activeBlk = layoutBlocks.find(b => b.id === activeBlockId);
            if (activeBlk && activeBlk.type !== 'TITLE') {
              e.preventDefault();
              handleCloneBlock(activeBlockId);
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeBlockId, isLocked, layoutBlocks]);

  const handleUpdateBlockTitle = (blockId: string, newTitle: string) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, title: newTitle } : b));
    // Sync to formTitle if this is the TITLE block
    const block = layoutBlocks.find(b => b.id === blockId);
    if (block?.type === 'TITLE') setFormTitle(newTitle);
  };

  const handleUpdateBlockColumns = (blockId: string, cols: 1 | 2 | 3) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      let defaultWidths: number[] | undefined;
      if (cols === 2) {
        defaultWidths = b.columnWidths && b.columnWidths.length === 2 ? b.columnWidths : [50, 50];
      } else if (cols === 3) {
        defaultWidths = b.columnWidths && b.columnWidths.length === 3 ? b.columnWidths : [33, 34, 33];
      } else {
        defaultWidths = undefined;
      }
      return { ...b, columns: cols, columnWidths: defaultWidths };
    }));
  };

  const handleUpdateBlockColumnWidths = (blockId: string, widths: number[]) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, columnWidths: widths } : b));
  };

  const handleUpdateBlockLogo = (blockId: string, newLogo: string) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, logo: newLogo } : b));
  };

  const handleUpdateBlockDescription = (blockId: string, newDesc: string) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const updatedFields = b.fields.map((f, idx) => idx === 0 ? { ...f, checkItem: newDesc } : f);
      return { ...b, description: newDesc, fields: updatedFields };
    }));
  };

  const handleUpdateBlockTitleFormat = (blockId: string, format: TitleFormatISO) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, titleFormat: format, sectionFormat: format === 'H1' || format === 'H2' ? format : b.sectionFormat } : b));
  };

  const handleUpdateBlockBorderStyle = (blockId: string, borderStyle: 'grid' | 'borderless' | 'horizontal_only') => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, borderStyle } : b));
  };

  const handleToggleBlockHideHeader = (blockId: string) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, hideHeader: !b.hideHeader } : b));
  };



  const handleUpdateBlockMatrixConfig = (blockId: string, updates: Partial<MatrixConfigISO>) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          matrixConfig: b.matrixConfig ? { ...b.matrixConfig, ...updates } : undefined
        };
      }
      return b;
    }));
  };

  const handleConvertChecklistToTable = (blockId: string) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.type === 'CHECKLIST_TABLE') {
        const tableColumns: TableColumnConfig[] = [
          { id: 'col_stt', label: b.columnLabels?.stt || 'STT', width: '40px', type: 'static_text', locked: true, align: 'center' },
          { id: 'col_item', label: b.columnLabels?.item || 'Chi tiết kiểm tra', width: 'auto', type: 'static_text', locked: true, align: 'left' },
          { 
            id: 'col_target', 
            label: b.columnLabels?.target || 'Kết quả', 
            width: '130px', 
            type: 'radio', 
            align: 'center',
            options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }]
          },
          { id: 'col_reaction', label: b.columnLabels?.reaction || 'Mô tả cụ thể nếu Không đạt', width: '220px', type: 'text', align: 'left' }
        ];

        const tableRows: TableRowConfig[] = b.fields.map((f, idx) => ({
          id: f.id || `row_${idx}_${Date.now()}`
        }));

        const tableData: { [rowId: string]: { [colId: string]: string } } = {};
        b.fields.forEach((f, idx) => {
          const rowId = f.id || `row_${idx}_${Date.now()}`;
          tableData[rowId] = {
            col_stt: (idx + 1).toString(),
            col_item: f.checkItem || ''
          };
        });

        return {
          ...b,
          type: 'TABLE' as const,
          tableColumns,
          tableRows,
          tableData,
          fields: []
        };
      }
      return b;
    }));
  };

  // Helper: Get effective options for a cell in a TABLE block (cell override or column default)
  const getEffectiveCellOptions = (block: LayoutBlockISO, rowId: string, colId: string): RadioOption[] => {
    const cellKey = `${rowId}_${colId}`;
    const custom = block.cellOptionsMap?.[cellKey];
    if (custom !== undefined) return custom;
    const col = block.tableColumns?.find(c => c.id === colId);
    return col?.options || [];
  };

  // Helper: Update cell options in a TABLE block
  const handleUpdateCellOptions = (blockId: string, rowId: string, colId: string, options: RadioOption[]) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const cellKey = `${rowId}_${colId}`;
        const cellOptionsMap = { ...b.cellOptionsMap || {}, [cellKey]: options };
        return { ...b, cellOptionsMap };
      }
      return b;
    }));
  };

  // Helper: Reset cell options back to column default
  const handleResetCellOptions = (blockId: string, rowId: string, colId: string) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId && b.cellOptionsMap) {
        const cellKey = `${rowId}_${colId}`;
        const cellOptionsMap = { ...b.cellOptionsMap };
        delete cellOptionsMap[cellKey];
        return { ...b, cellOptionsMap };
      }
      return b;
    }));
  };

  const handleUpdateTableColumn = (blockId: string, colId: string, updates: Partial<TableColumnConfig>) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const updatedCols = (b.tableColumns || []).map(c => c.id === colId ? { ...c, ...updates } : c);
        return { ...b, tableColumns: updatedCols };
      }
      return b;
    }));
  };

  const handleMoveColumn = (blockId: string, colId: string, direction: 'left' | 'right') => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const cols = [...(b.tableColumns || [])];
        const idx = cols.findIndex(c => c.id === colId);
        if (idx === -1) return b;
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= cols.length) return b;
        const temp = cols[idx];
        cols[idx] = cols[targetIdx];
        cols[targetIdx] = temp;
        return { ...b, tableColumns: cols };
      }
      return b;
    }));
  };

  const handleDeleteColumn = (blockId: string, colId: string) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const updatedCols = (b.tableColumns || []).filter(c => c.id !== colId);
        const updatedData = { ...b.tableData || {} };
        Object.keys(updatedData).forEach(rowId => {
          if (updatedData[rowId]) {
            const rowData = { ...updatedData[rowId] };
            delete rowData[colId];
            updatedData[rowId] = rowData;
          }
        });
        return { ...b, tableColumns: updatedCols, tableData: updatedData };
      }
      return b;
    }));
  };

  const handleAddColumn = (blockId: string) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const nextColId = `col_${Date.now()}`;
        const updatedCols = [...(b.tableColumns || []), {
          id: nextColId,
          label: 'Cột mới',
          width: '20%',
          type: 'text' as const
        }];
        return { ...b, tableColumns: updatedCols };
      }
      return b;
    }));
  };


  const handleDeleteBlock = (blockId: string) => {
    if (isLocked) return;
    if (confirm('Are you sure you want to delete this entire layout block and all its fields?')) {
      setLayoutBlocks(prev => prev.filter(b => b.id !== blockId));
      if (activeBlockId === blockId) {
        setActiveBlockId(null);
        setActiveFieldId(null);
      }
    }
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (isLocked) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layoutBlocks.length) return;
    
    setLayoutBlocks(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // 3. Field Handlers inside Blocks
  const DEFAULT_RADIO_OPTIONS: RadioOption[] = [
    { label: 'Đạt',   value: 'PASS', isPass: true  },
    { label: 'Không', value: 'FAIL', isPass: false }
  ];

  const handleAddField = (blockId: string, type: 'text' | 'number' | 'date' | 'time' | 'radio' | 'checkbox' | 'signature' | 'photo' | 'subtable') => {
    if (isLocked) return;
    
    const labelPrefix = type === 'radio' || type === 'checkbox' ? 'Kiểm tra ' : type === 'number' ? 'Đo thông số ' : type === 'time' ? 'Thời gian ' : type === 'subtable' ? 'Bảng ' : 'Thông tin ';
    const defaultCheckItem = `${labelPrefix}mới`;
    const existingIds = layoutBlocks.flatMap(b => (b.fields || []).map(f => f.id));
    const newFieldId = generateSmartFieldSlug(defaultCheckItem, existingIds, type);

    const newField: FormFieldISO = {
      id: newFieldId,
      type,
      checkItem: defaultCheckItem,
      locationCode: `LOC-${Math.floor(10 + Math.random() * 90)}`,
      reactionProtocol: type === 'radio' || type === 'checkbox' || type === 'number' ? "Báo cáo trưởng ca và ghi nhận hành động khắc phục." : ""
    };

    if (type === 'number') {
      newField.minSpec = undefined;
      newField.maxSpec = undefined;
      newField.unit = '';
    } else if (type === 'time') {
      newField.timeMode = 'single';
    } else if (type === 'radio' || type === 'checkbox') {
      newField.options = [...DEFAULT_RADIO_OPTIONS];
    } else if (type === 'photo') {
      newField.checkItem = 'Ảnh bằng chứng';
      newField.placeholder = '[photo]';
      newField.rowSpan = 3;
    } else if (type === 'subtable') {
      newField.subtableColumns = [
        { id: `stcol_${Date.now()}_1`, label: 'Ngành hàng', type: 'text', width: '35%' },
        { id: `stcol_${Date.now()}_2`, label: 'Nhóm sản phẩm', type: 'text', width: '40%' },
        { id: `stcol_${Date.now()}_3`, label: '% Doanh thu', type: 'number', width: '25%' },
      ];
      newField.subtableDefaultRows = 3;
    }

    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return { ...b, fields: [...b.fields, newField] };
      }
      return b;
    }));

    setActiveFieldId(newField.id);
  };

  const handleUpdateField = (blockId: string, fieldId: string, updates: Partial<FormFieldISO>) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          fields: b.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f)
        };
      }
      return b;
    }));
    if (updates.id && updates.id !== fieldId && activeFieldId === fieldId) {
      setActiveFieldId(updates.id);
    }
  };

  const handleChangeFieldType = (blockId: string, fieldId: string, newType: 'label' | 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature' | 'photo' | 'subtable' | 'likert_scale' | 'rating') => {
    if (isLocked) return;
    
    // Find current field to inspect its options
    const block = layoutBlocks.find(b => b.id === blockId);
    const field = block?.fields.find(f => f.id === fieldId);
    
    const updates: Partial<FormFieldISO> = { type: newType };
    
    if (newType === 'number') {
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = '';
    } else if (newType === 'time') {
      updates.timeMode = 'single';
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    } else if (newType === 'likert_scale' || (newType as any) === 'rating') {
      updates.type = 'likert_scale';
      updates.likertVariant = field?.likertVariant || ((newType as any) === 'rating' ? 'stars' : 'scale');
      updates.ratingScale = field?.ratingScale || 5;
      updates.scaleOptions = field?.scaleOptions && field.scaleOptions.length > 0 ? field.scaleOptions : ['1', '2', '3', '4', '5'];
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    } else if (newType === 'radio' || newType === 'checkbox') {
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
      // If options do not exist, initialize them
      if (!field?.options || field.options.length === 0) {
        updates.options = [...DEFAULT_RADIO_OPTIONS];
      }
    } else if (newType === 'subtable') {
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
      if (!field?.subtableColumns || field.subtableColumns.length === 0) {
        updates.subtableColumns = [
          { id: `stcol_${Date.now()}_1`, label: 'Cột 1', type: 'text', width: '50%' },
          { id: `stcol_${Date.now()}_2`, label: 'Cột 2', type: 'text', width: '50%' },
        ];
        updates.subtableDefaultRows = 3;
      }
    } else if (newType === 'signature') {
      updates.reactionProtocol = 'Ký và ghi rõ họ tên';
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    } else if (newType === 'photo') {
      updates.rowSpan = field?.rowSpan ?? 3;
      updates.placeholder = field?.placeholder || '[photo]';
      if (!field?.checkItem || field.checkItem === 'Thông tin mới' || field.checkItem === '[photo]') {
        updates.checkItem = 'Ảnh bằng chứng';
      }
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    } else {
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    }
    
    handleUpdateField(blockId, fieldId, updates);
  };


  const handleDeleteField = (blockId: string, fieldId: string) => {
    if (isLocked) return;
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return { ...b, fields: b.fields.filter(f => f.id !== fieldId) };
      }
      return b;
    }));
    if (activeFieldId === fieldId) {
      setActiveFieldId(null);
    }
  };

  const handleMoveField = (blockId: string, fieldId: string, direction: 'up' | 'down') => {
    if (isLocked) return;
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const index = b.fields.findIndex(f => f.id === fieldId);
      if (index === -1) return b;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= b.fields.length) return b;
      const updatedFields = [...b.fields];
      const temp = updatedFields[index];
      updatedFields[index] = updatedFields[targetIndex];
      updatedFields[targetIndex] = temp;
      return { ...b, fields: updatedFields };
    }));
  };

  const handleMoveRow = (blockId: string, rowId: string, direction: 'up' | 'down') => {
    if (isLocked) return;
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const rows = b.tableRows || [];
      const index = rows.findIndex(r => r.id === rowId);
      if (index === -1) return b;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= rows.length) return b;
      
      const updatedRows = [...rows];
      const temp = updatedRows[index];
      updatedRows[index] = updatedRows[targetIndex];
      updatedRows[targetIndex] = temp;
      
      // Auto-renumber the first column if it's static_text
      const updatedData = { ...b.tableData || {} };
      const firstCol = b.tableColumns?.[0];
      if (firstCol && firstCol.type === 'static_text') {
        updatedRows.forEach((r, idx) => {
          updatedData[r.id] = {
            ...updatedData[r.id] || {},
            [firstCol.id]: String(idx + 1)
          };
        });
      }
      
      return { ...b, tableRows: updatedRows, tableData: updatedData };
    }));
  };

  const handleUpdateRowLineCount = (blockId: string, rowId: string, lineCount: number) => {
    if (isLocked) return;
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      return { ...b, tableRows: (b.tableRows || []).map(r =>
        r.id === rowId ? { ...r, lineCount } : r
      )};
    }));
  };

  // 4. Save and Publish

  const handlePublish = async () => {
    let activeSummary = changeSummary.trim();
    if (!activeSummary) {
      activeSummary = generateFormChangeSummary(initialData?.layoutBlocks, layoutBlocks, revisionHistory);
      setChangeSummary(activeSummary);
    }

    const { major, minor } = parseVersion(version);
    const targetVersion = `v${major}.${minor}`;
    
    const initialCleanVersion = initialData?.version ? initialData.version.replace(/\s*\([^)]*\)/g, '').trim() : '';
    const isSameFormAndVersion = formId === initialData?.formId && targetVersion === initialCleanVersion;
    
    let versionExists = false;
    if (!isSameFormAndVersion) {
      try {
        setLoading(true);
        const res = await fetch(`/api/forms/${encodeURIComponent(formId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.version && data.version.replace(/\s*\([^)]*\)/g, '').trim() === targetVersion) {
            versionExists = true;
          }
        }
      } catch (err) {
        console.error('Error checking version existence:', err);
      } finally {
        setLoading(false);
      }
    }

    if (versionExists) {
      alert(`Phiên bản ${targetVersion} của mã biểu mẫu ${formId} đã tồn tại`);
      return;
    }

    const approveDate = effectiveDate || new Date().toISOString().split('T')[0];
    const newActiveVersion = `v${major}.${minor}`;
    
    const newHistoryEntry: FormRevisionEntry = {
      version: `v${major}.${minor}`,
      date: approveDate,
      author: 'QA Administrator',
      change: changeSummary,
      layoutBlocks: JSON.parse(JSON.stringify(layoutBlocks))
    };

    const updatedHistory = [newHistoryEntry, ...revisionHistory];
    
    setVersion(newActiveVersion);
    setStatus('ACTIVE');
    setRevisionHistory(updatedHistory);
    setIsLocked(true);
    setChangeSummary('');

    try {
      setLoading(true);
      await saveFormToBackend({
        versionOverride: newActiveVersion,
        statusOverride: 'ACTIVE',
        historyOverride: updatedHistory,
        effectiveDateOverride: approveDate
      });

      onSave({
        formId,
        formTitle,
        version: newActiveVersion,
        status: 'ACTIVE',
        layoutBlocks,
        revisionHistory: updatedHistory
      });

      alert(`Successfully published active version: ${newActiveVersion}. This template is now locked for quality compliance.`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreRevision = (entry: FormRevisionEntry) => {
    if (!entry.layoutBlocks || entry.layoutBlocks.length === 0) {
      alert(`This revision entry (${entry.version}) does not have layout blocks stored. It might be a log-only entry from an older version.`);
      return;
    }
    
    // Backup the current working draft if we haven't already
    if (!currentDraftBackup) {
      setCurrentDraftBackup({
        layoutBlocks: JSON.parse(JSON.stringify(layoutBlocks)),
        version: version,
        isLocked: isLocked
      });
    }

    // Load the revision blocks
    const restoredBlocks = JSON.parse(JSON.stringify(entry.layoutBlocks));
    setLayoutBlocks(restoredBlocks);

    // Set version name, status as retired, and lock the view
    setVersion(entry.version);
    setIsLocked(true);
    setViewingRevisionVersion(entry.version);
  };

  const handleDeleteRevisionEntry = async (targetVersion: string) => {
    // 1. Check if submissions exist for this formId and targetVersion
    try {
      setLoading(true);
      const res = await fetch('/api/submissions');
      if (res.ok) {
        const submissions = await res.json();
        const matchingSubs = submissions.filter((s: any) => {
          const fId = s.formId || s.form_id;
          const vVer = (s.formVersion || s.form_version || '').replace(/\s*\([^)]*\)/g, '').trim();
          const cleanTarget = targetVersion.replace(/\s*\([^)]*\)/g, '').trim();
          return fId === formId && vVer === cleanTarget;
        });

        if (matchingSubs.length > 0) {
          alert(`⛔ Không thể xóa phiên bản ${targetVersion} vì đã có ${matchingSubs.length} lượt điền dữ liệu lưu trữ trong hệ thống.`);
          return;
        }
      }
    } catch (err) {
      console.error('Error checking version submissions:', err);
    } finally {
      setLoading(false);
    }

    // 2. Prompt confirmation
    const confirmMessage = `⚠️ Bạn có chắc chắn muốn xóa phiên bản lịch sử ${targetVersion}?\nThao tác này sẽ xóa vĩnh viễn phiên bản này khỏi lịch sử và không thể hoàn tác.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    // 3. Filter out targetVersion
    const updatedHistory = revisionHistory.filter(h => h.version !== targetVersion);
    setRevisionHistory(updatedHistory);

    if (viewingRevisionVersion === targetVersion) {
      if (currentDraftBackup) {
        setLayoutBlocks(currentDraftBackup.layoutBlocks);
        setVersion(currentDraftBackup.version);
        setIsLocked(currentDraftBackup.isLocked);
        setCurrentDraftBackup(null);
      }
      setViewingRevisionVersion(null);
    }

    // 4. Delete the version row from backend if it exists and save updated history
    try {
      setLoading(true);
      // Delete version row from forms table if present
      const deleteRes = await fetch(`/api/forms/${encodeURIComponent(formId)}?version=${encodeURIComponent(targetVersion)}`, {
        method: 'DELETE'
      });

      if (!deleteRes.ok && deleteRes.status !== 404) {
        console.warn('Could not delete version row from DB:', await deleteRes.text());
      }

      // Save updated history list to current active/draft form record
      await saveFormToBackend({ historyOverride: updatedHistory, allowActiveUpdate: true });
    } catch (err) {
      console.error('Error saving updated history after delete:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToDraft = () => {
    if (currentDraftBackup) {
      setLayoutBlocks(currentDraftBackup.layoutBlocks);
      setVersion(currentDraftBackup.version);
      setIsLocked(currentDraftBackup.isLocked);
      
      setCurrentDraftBackup(null);
      setViewingRevisionVersion(null);
    }
  };

  const handleCommitRestore = () => {
    if (!viewingRevisionVersion) return;
    if (confirm(`Bạn có chắc chắn muốn khôi phục phiên bản ${viewingRevisionVersion} thành bản nháp hiện tại không? Bản nháp chưa lưu hiện tại sẽ bị ghi đè.`)) {
      // Find the revision entry to get its clean version number (e.g. "v0.1")
      const entry = revisionHistory.find(h => h.version === viewingRevisionVersion);
      const baseVersion = entry ? entry.version : 'v0.1';
      
      // Parse major/minor of the restored version
      const { major, minor } = parseVersion(baseVersion);
      const draftVersion = `v${major}.${minor}`;
      
      setVersion(draftVersion);
      setStatus('DRAFT');
      setIsLocked(false);
      
      // Discard the backup draft and exit read-only preview mode
      setCurrentDraftBackup(null);
      setViewingRevisionVersion(null);
      
      alert(`Đã khôi phục phiên bản ${baseVersion} thành bản nháp hiện tại.`);
    }
  };

  const handleDeleteVersion = async () => {
    if (!viewingRevisionVersion) return;
    if (confirm(`Bạn có chắc chắn muốn xóa phiên bản ${viewingRevisionVersion}?`)) {
      try {
        setLoading(true);
        const res = await fetch(`/api/forms/${encodeURIComponent(formId)}?version=${encodeURIComponent(viewingRevisionVersion)}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) {
          const text = await res.text();
          let errMsg = 'Server error';
          try {
            const errData = JSON.parse(text);
            errMsg = errData.error || errMsg;
          } catch (_) {
            errMsg = `Yêu cầu không hợp lệ (${res.status}). Vui lòng đảm bảo backend server đã được khởi động lại để kích hoạt các API mới.`;
          }
          throw new Error(errMsg);
        }
        
        // Update local history list
        const updatedHistory = revisionHistory.filter(h => h.version !== viewingRevisionVersion);
        setRevisionHistory(updatedHistory);
        
        // Return to draft state
        if (currentDraftBackup) {
          setLayoutBlocks(currentDraftBackup.layoutBlocks);
          setVersion(currentDraftBackup.version);
          setIsLocked(currentDraftBackup.isLocked);
          setCurrentDraftBackup(null);
        }
        setViewingRevisionVersion(null);
        
        alert(`Đã xóa thành công phiên bản ${viewingRevisionVersion}.`);
      } catch (err) {
        console.error(err);
        setLoading(false);
        alert(`Không thể xóa phiên bản: ${err instanceof Error ? err.message : 'Lỗi máy chủ'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteActiveDraft = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa bản nháp này?')) {
      try {
        setLoading(true);
        const res = await fetch(`/api/forms/${encodeURIComponent(formId)}?version=${encodeURIComponent(version)}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) {
          const text = await res.text();
          let errMsg = 'Server error';
          try {
            const errData = JSON.parse(text);
            errMsg = errData.error || errMsg;
          } catch (_) {
            errMsg = `Yêu cầu không hợp lệ (${res.status}). Vui lòng đảm bảo backend server đã được khởi động lại để kích hoạt các API mới.`;
          }
          throw new Error(errMsg);
        }
        
        alert(`Đã xóa thành công bản nháp.`);
        onClose();
      } catch (err) {
        console.error(err);
        setLoading(false);
        alert(`Không thể xóa bản nháp: ${err instanceof Error ? err.message : 'Lỗi máy chủ'}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCreateNewVersion = () => {
    const { major, minor } = parseVersion(version);
    const draftVersion = `v${major}.${minor + 1}`;
    setVersion(draftVersion);
    setStatus('DRAFT');
    setIsLocked(false);
    setChangeSummary('');
    alert(`New draft version created: ${draftVersion} (draft). You can now make edits. The previous version remains active in production until you publish this draft.`);
  };

  const handleSaveDraft = async () => {
    if (isSaved || isLocked) return;

    // Validation: Ensure the draft version doesn't conflict with any published version in history
    const { major, minor } = parseVersion(version);
    const targetVersion = `v${major}.${minor}`;
    
    // Check if the combination of formId and targetVersion already exists in the database
    const initialCleanVersion = initialData?.version ? initialData.version.replace(/\s*\([^)]*\)/g, '').trim() : '';
    const isSameFormAndVersion = formId === initialData?.formId && targetVersion === initialCleanVersion;
    
    let versionExists = false;
    if (!isSameFormAndVersion) {
      try {
        setLoading(true);
        const checkRes = await fetch(`/api/forms/${encodeURIComponent(formId)}?version=${encodeURIComponent(targetVersion)}`);
        if (checkRes.ok) {
          versionExists = true;
        }
      } catch (err) {
        console.error('Error verifying version existence:', err);
      } finally {
        setLoading(false);
      }
    }

    if (versionExists) {
      alert(`Phiên bản ${targetVersion} của mã biểu mẫu ${formId} đã tồn tại`);
      return;
    }

    try {
      setLoading(true);
      const initialCleanVersion = initialData?.version ? initialData.version.replace(/\s*\([^)]*\)/g, '').trim() : undefined;
      await saveFormToBackend({
        oldVersionOverride: initialCleanVersion && initialCleanVersion !== targetVersion ? initialCleanVersion : undefined
      });
      onSave({
        formId,
        formTitle,
        version,
        status,
        layoutBlocks,
        revisionHistory
      });
      setLastSavedSnapshot(currentSnapshot);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardChangesAndClose = () => {
    onClose();
  };

  // Find currently selected element details
  const activeBlock = layoutBlocks.find(b => b.id === activeBlockId);
  const activeField = activeBlock?.fields.find(f => f.id === activeFieldId);

  // Render Loading spinner
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', background: '#f8fafc', height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading form template from database...</p>
      </div>
    );
  }

  // Render Print Preview bypass
  if (printPreviewData) {
    return (
      <PrintBlankForm
        template={printPreviewData}
        autoExportPdf={autoExportPdf}
        exportMode={autoExportPdf}
        onClose={() => {
          setPrintPreviewData(null);
          setAutoExportPdf(false);
        }}
      />
    );
  }

  const { major, minor } = parseVersion(version);

  const handleMajorChange = (newMajor: number) => {
    setVersion(`v${newMajor}.${minor}`);
  };

  const handleMinorChange = (newMinor: number) => {
    setVersion(`v${major}.${newMinor}`);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      background: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* Warning banner when viewing old revision in read-only mode */}
      {viewingRevisionVersion && (
        <div style={{
          background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          padding: '0.5rem 1.25rem',
          fontSize: '0.82rem',
          color: '#b45309',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 500,
          flexShrink: 0
        }}>
          <span>
            ⚠️ Bạn đang xem phiên bản cũ <strong>{viewingRevisionVersion}</strong> (Chế độ chỉ đọc - Read-only).
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCommitRestore}
              style={{
                background: '#059669',
                border: 'none',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Khôi phục thành bản nháp hiện tại
            </button>
            <button
              type="button"
              onClick={handleReturnToDraft}
              style={{
                background: '#b45309',
                border: 'none',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Quay lại bản nháp hiện tại
            </button>
            <button
              type="button"
              onClick={handleDeleteVersion}
              style={{
                background: '#dc2626',
                border: 'none',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Xóa phiên bản này
            </button>
          </div>
        </div>
      )}
      {/* Title bar */}
      <div style={{
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        background: '#ffffff',
        borderBottom: '1px solid var(--neutral-border)',
        gap: '0.75rem',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        zIndex: 10,
        boxSizing: 'border-box',
        flexShrink: 0
      }}>
        {/* 1. LEFT: Identity & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <FileText size={18} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>Form Builder</h2>
          {status !== 'DRAFT' && (
            <span className={`badge ${status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
              {status}
            </span>
          )}
        </div>

        {/* 2. CENTER: Section Adders Toolbar (ISO Logical Order) */}
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1', gap: '2px', flexShrink: 0 }}>
          <button 
            type="button" 
            onClick={() => handleAddBlock('TITLE')}
            disabled={isLocked}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
            title="Thêm Tiêu đề biểu mẫu"
          >
            <FileText size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Title</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('INFO_GRID', 2)}
            disabled={isLocked}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
            title="Thêm Lưới thông tin"
          >
            <Grid size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Info Grid</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('TABLE')}
            disabled={isLocked}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
            title="Thêm Bảng kiểm tra"
          >
            <TableIcon size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Table</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('MATRIX_TABLE')}
            disabled={isLocked}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
            title="Thêm Bảng ma trận"
          >
            <Grid size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Matrix</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('SIGN', 2)}
            disabled={isLocked}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
            title="Thêm Khối chữ ký"
          >
            <PenTool size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Sign</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('SECTION_LABEL')}
            disabled={isLocked}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
            title="Thêm Nhãn phân cách"
          >
            <AlignLeft size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Label</span>
          </button>

          <div style={{ borderLeft: '1px solid #cbd5e1', height: '14px', margin: '0 2px' }} />

          <button 
            type="button" 
            onClick={() => {
              setSelectedFormKey('');
              setSelectedBlockId('');
              setShowCopyModal(true);
            }}
            disabled={isLocked}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
            title="Sao chép khối từ biểu mẫu khác"
          >
            <Copy size={13} style={{ color: '#64748b' }} />
            <span>Copy...</span>
          </button>
        </div>

        {/* 3. RIGHT: Page Setup, PDF/Print, Save (with Greyout state) & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Page size toggle */}
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            background: '#f1f5f9', 
            padding: '2px', 
            borderRadius: '6px', 
            border: '1px solid #cbd5e1'
          }}>
            <button
              type="button"
              onClick={() => setPageSize('A4')}
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: pageSize === 'A4' ? 600 : 400,
                color: pageSize === 'A4' ? '#0f172a' : '#64748b',
                background: pageSize === 'A4' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                boxShadow: pageSize === 'A4' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Khổ in A4 Dọc tiêu chuẩn (210mm x 297mm)"
            >
              A4 Dọc
            </button>
            <button
              type="button"
              onClick={() => setPageSize('A5_LANDSCAPE')}
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: pageSize === 'A5_LANDSCAPE' ? 600 : 400,
                color: pageSize === 'A5_LANDSCAPE' ? '#0f172a' : '#64748b',
                background: pageSize === 'A5_LANDSCAPE' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                boxShadow: pageSize === 'A5_LANDSCAPE' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Khổ in A5 Ngang (210mm x 148mm)"
            >
              A5 Ngang
            </button>
          </div>

          <div style={{ borderLeft: '1px solid var(--neutral-border)', height: '16px', margin: '0 0.1rem' }} />

          {/* Export PDF & Print */}
          <button 
            type="button"
            onClick={() => {
              setAutoExportPdf(true);
              setPrintPreviewData({
                formId,
                formTitle,
                version,
                status,
                pageSize,
                effectiveDate: status === 'ACTIVE' ? (effectiveDate || (initialData as any)?.effectiveDate || (initialData as any)?.effective_date) : undefined,
                updatedAt: initialData?.updatedAt || (initialData as any)?.updated_at || new Date().toISOString(),
                layoutBlocks,
                revisionHistory
              });
            }}
            style={{
              background: 'none',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            title="Xuất biểu mẫu dạng Fillable PDF tương tác"
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>

          <button 
            type="button"
            onClick={() => setPrintPreviewData({
              formId,
              formTitle,
              version,
              status,
              pageSize,
              effectiveDate: status === 'ACTIVE' ? (effectiveDate || (initialData as any)?.effectiveDate || (initialData as any)?.effective_date) : undefined,
              updatedAt: initialData?.updatedAt || (initialData as any)?.updated_at || new Date().toISOString(),
              layoutBlocks,
              revisionHistory
            })}
            style={{
              background: 'none',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            title="In thử hoặc xem trước biểu mẫu"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          <div style={{ borderLeft: '1px solid var(--neutral-border)', height: '16px', margin: '0 0.1rem' }} />

          {/* Save & Close Buttons */}
          {!isLocked ? (
            <>
              <button 
                type="button"
                disabled={isSaved}
                onClick={handleSaveDraft} 
                style={{
                  background: isSaved ? '#f1f5f9' : '#0f172a',
                  border: isSaved ? '1px solid #cbd5e1' : '1px solid #0f172a',
                  color: isSaved ? '#94a3b8' : '#ffffff',
                  padding: '3px 12px',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: isSaved ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => { if (!isSaved) e.currentTarget.style.background = '#1e293b'; }}
                onMouseLeave={(e) => { if (!isSaved) e.currentTarget.style.background = '#0f172a'; }}
                title={isSaved ? 'Đã lưu trạng thái mới nhất' : 'Lưu lại thay đổi'}
              >
                {isSaved ? (
                  <>
                    <Check size={13} strokeWidth={2.5} style={{ color: '#94a3b8' }} />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
              
              <button 
                type="button"
                onClick={handleDiscardChangesAndClose} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'none'; }}
                title="Đóng (Close)"
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                onClick={handleCreateNewVersion} 
                style={{
                  background: '#0f172a',
                  border: '1px solid #0f172a',
                  color: '#ffffff',
                  padding: '3px 12px',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
              >
                Edit
              </button>
              <button 
                type="button"
                onClick={onClose} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'none'; }}
                title="Đóng (Close)"
              >
                <X size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Designer Grid (2-Column Streamlined Layout) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, overflow: 'hidden' }}>
        
        {/* CENTER CANVAS: A4/A5 Document Simulation */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', flex: 1, background: '#f1f5f9' }}>
          <div style={{
            width: '100%',
            maxWidth: pageSize === 'A5_LANDSCAPE' ? '920px' : '820px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            padding: '2.5rem',
            minHeight: '1050px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0px',
            position: 'relative',
            boxSizing: 'border-box'
          }}>
            


            {/* Layout blocks render */}
            {layoutBlocks.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '3rem', textAlign: 'center' }}>
                <Grid size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Empty Layout Canvas</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Add layout blocks from the top toolbar to design your document structure.</p>
              </div>
            ) : (
              layoutBlocks.map((block, index) => {
                const isBlockSelected = activeBlockId === block.id;
                const prevBlock = index > 0 ? layoutBlocks[index - 1] : undefined;
                const nextBlock = index < layoutBlocks.length - 1 ? layoutBlocks[index + 1] : undefined;
                const isSeamless = isSeamlessTableBlock(block, prevBlock);
                const isFollowedBySeamless = nextBlock ? isSeamlessTableBlock(nextBlock, block) : false;
                const isPrevSection = prevBlock?.type === 'SECTION_LABEL' && getEffectiveTitleFormat(prevBlock) !== 'NONE';

                let blockMarginTop = '0px';
                if (index > 0) {
                  if (isSeamless) {
                    blockMarginTop = '-1px';
                  } else if (isPrevSection) {
                    blockMarginTop = '4px';
                  } else {
                    blockMarginTop = block.type === 'SECTION_LABEL' ? '20px' : '12px';
                  }
                }
                
                return (
                  <div 
                    key={block.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBlockId(block.id);
                      setActiveFieldId(null);
                    }}
                    style={{
                      border: isBlockSelected ? '2px solid var(--primary)' : '1px dashed #cbd5e1',
                      borderTop: isSeamless && !isBlockSelected ? '1px dashed transparent' : undefined,
                      borderRadius: isSeamless && isFollowedBySeamless ? '0px' : isSeamless ? '0 0 6px 6px' : isFollowedBySeamless ? '6px 6px 0 0' : '6px',
                      padding: block.type === 'SECTION_LABEL' ? '0.35rem 0.65rem' : '0.85rem',
                      marginTop: blockMarginTop,
                      position: 'relative',
                      background: isBlockSelected ? 'rgba(16, 163, 163, 0.02)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Block Toolbar */}
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      background: '#ffffff',
                      padding: '0 4px',
                      fontSize: '0.65rem',
                      zIndex: 10
                    }}>
                      <span style={{ fontWeight: 700, color: isBlockSelected ? 'var(--primary)' : 'var(--text-muted)', marginRight: '0.25rem' }}>
                        {block.type}
                      </span>
                      <button 
                        type="button" 
                        disabled={index === 0 || isLocked}
                        onClick={(e) => { e.stopPropagation(); handleMoveBlock(index, 'up'); }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '2px', background: '#ffffff', padding: '1px 3px', cursor: (index === 0 || isLocked) ? 'not-allowed' : 'pointer' }}
                        title="Di chuyển lên"
                      >
                        <ArrowUp size={10} />
                      </button>
                      <button 
                        type="button" 
                        disabled={index === layoutBlocks.length - 1 || isLocked}
                        onClick={(e) => { e.stopPropagation(); handleMoveBlock(index, 'down'); }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '2px', background: '#ffffff', padding: '1px 3px', cursor: (index === layoutBlocks.length - 1 || isLocked) ? 'not-allowed' : 'pointer' }}
                        title="Di chuyển xuống"
                      >
                        <ArrowDown size={10} />
                      </button>
                      <button 
                        type="button" 
                        disabled={isLocked || block.type === 'TITLE'}
                        onClick={(e) => { e.stopPropagation(); handleCloneBlock(block.id); }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '2px', background: '#ffffff', padding: '1px 3px', cursor: (isLocked || block.type === 'TITLE') ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}
                        title="Nhân bản khối này (Ctrl+D)"
                      >
                        <Copy size={10} />
                      </button>
                      <button 
                        type="button" 
                        disabled={isLocked || block.type === 'TITLE'}
                        onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '2px', background: '#ffffff', padding: '1px 3px', cursor: (isLocked || block.type === 'TITLE') ? 'not-allowed' : 'pointer', color: 'var(--danger)' }}
                        title="Xóa khối"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>

                    {/* Block Content Render */}
                    <div style={{ marginTop: '0.25rem' }}>
                      
                      {/* 1.1 SECTION LABEL BLOCK */}
                      {block.type === 'SECTION_LABEL' && (
                        <InCanvasTitleHeader
                          block={block}
                          isLocked={isLocked}
                          isBlockSelected={isBlockSelected}
                          onUpdateTitle={(val) => handleUpdateBlockTitle(block.id, val)}
                          onUpdateDescription={(val) => handleUpdateBlockDescription(block.id, val)}
                          onUpdateTitleFormat={(fmt) => handleUpdateBlockTitleFormat(block.id, fmt)}
                          onSelectBlock={() => {
                            setActiveBlockId(block.id);
                            setActiveFieldId(null);
                          }}
                        />
                      )}

                      {/* 1. TITLE BLOCK */}
                      {block.type === 'TITLE' && (
                        block.logo ? (
                          <div style={{
                            padding: '10px 0',
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '10px',
                            position: 'relative'
                          }}>
                            {logoUrl && (
                              <div style={{
                                marginRight: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                height: '65px'
                              }}>
                                <img src={logoUrl} alt="Logo" style={{ maxHeight: '65px', maxWidth: '260px', objectFit: 'contain' }} />
                              </div>
                            )}
                            <div style={{ textAlign: 'center', flex: 1 }}>
                              <h1 style={{ margin: '0 0 2px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                {block.title || 'TÊN BIỂU MẪU'}
                              </h1>
                              <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                {block.description || '(mô tả ngắn kiểm tra)'}
                              </p>
                              {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                                <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                  <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                                </div>
                              )}
                            </div>
                            {block.showDate && block.datePosition === 'A' && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                                <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{
                            padding: '10px 0',
                            textAlign: 'center',
                            marginBottom: '10px',
                            position: 'relative'
                          }}>
                            {block.showDate && block.datePosition === 'A' && (
                              <div style={{ position: 'absolute', right: 0, top: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                              </div>
                            )}
                            <h1 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                              {block.title || 'TÊN BIỂU MẪU'}
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                              {block.description || '(mô tả ngắn kiểm tra)'}
                            </p>
                            {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {/* 2. INFO GRID BLOCK */}
                      {block.type === 'INFO_GRID' && (() => {
                        return (
                          <div>
                            <InCanvasTitleHeader
                              block={block}
                              isLocked={isLocked}
                              isBlockSelected={isBlockSelected}
                              onUpdateTitle={(val) => handleUpdateBlockTitle(block.id, val)}
                              onUpdateTitleFormat={(fmt) => handleUpdateBlockTitleFormat(block.id, fmt)}
                              onSelectBlock={() => {
                                setActiveBlockId(block.id);
                                setActiveFieldId(null);
                              }}
                            />
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: getInfoGridTemplateColumns(block),
                              columnGap: '0.75rem',
                              rowGap: '0.5rem',
                              gridAutoRows: 'minmax(38px, auto)',
                            }}>
                              {block.fields.map((f, fIdx, fArr) => {
                                const isFieldSelected = activeFieldId === f.id;
                                const parsedRSpan = f.type === 'subtable' ? undefined : (f.rowSpan ? Number(f.rowSpan) : undefined);
                                const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
                                const cSpan = f.type === 'subtable' ? -1 : (f.colSpan ? Number(f.colSpan) : undefined);

                                return (
                                  <div 
                                    key={f.id} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveBlockId(block.id);
                                      setActiveFieldId(f.id);
                                    }}
                                    style={{
                                      gridRow: rSpan ? `span ${rSpan}` : undefined,
                                      gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                                      alignSelf: f.type === 'photo' ? 'stretch' : 'start',
                                      height: f.type === 'photo' ? '100%' : 'auto',
                                      border: isFieldSelected ? '2px solid var(--primary)' : '1px dotted #cbd5e1',
                                      borderRadius: '4px',
                                      padding: '6px',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                      gap: '4px',
                                      background: isFieldSelected ? 'rgba(16, 163, 163, 0.05)' : 'none',
                                    }}
                                  >
                                    {/* Header row: editable label (left) + move controls & type selector (right) */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
                                      {/* CSS Grid Auto-Grow Textarea mirror */}
                                      <div style={{ display: 'grid', flex: 1, minWidth: '50px', minHeight: '24px', boxSizing: 'border-box' }}>
                                        <span
                                          aria-hidden="true"
                                          style={{
                                            gridArea: '1 / 1 / 2 / 2',
                                            visibility: 'hidden',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            fontSize: '0.8rem',
                                            fontWeight: f.type === 'label' ? 400 : 600,
                                            lineHeight: 1.4,
                                            fontFamily: 'inherit',
                                            padding: '2px 4px',
                                            minHeight: '20px'
                                          }}
                                        >
                                          {(f.checkItem || '') + ' '}
                                        </span>
                                        <textarea
                                          disabled={isLocked}
                                          rows={1}
                                          value={f.checkItem}
                                          placeholder="Nhập tên trường / nhãn..."
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveBlockId(block.id);
                                            setActiveFieldId(f.id);
                                          }}
                                          onKeyDown={(e) => handleFormatKeyDown(e, f.checkItem, (val) => handleUpdateField(block.id, f.id, { checkItem: val }))}
                                          onChange={(e) => handleUpdateField(block.id, f.id, { checkItem: e.target.value })}
                                          style={{
                                            gridArea: '1 / 1 / 2 / 2',
                                            width: '100%',
                                            height: '100%',
                                            fontWeight: f.type === 'label' ? 400 : 600,
                                            fontSize: '0.8rem',
                                            lineHeight: 1.4,
                                            fontFamily: 'inherit',
                                            color: 'var(--text-primary)',
                                            border: '1px solid transparent',
                                            borderRadius: '3px',
                                            background: 'transparent',
                                            outline: 'none',
                                            padding: '2px 4px',
                                            margin: 0,
                                            resize: 'none',
                                            overflow: 'hidden',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            cursor: isLocked ? 'default' : 'text'
                                          }}
                                          onFocus={(e) => {
                                            e.target.style.borderColor = 'var(--primary)';
                                            e.target.style.background = '#ffffff';
                                          }}
                                          onBlur={(e) => {
                                            e.target.style.borderColor = 'transparent';
                                            e.target.style.background = 'transparent';
                                          }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginTop: '2px' }}>
                                        {isFieldSelected && !isLocked && (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '2px' }}>
                                            <button
                                              type="button"
                                              disabled={fIdx === 0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveField(block.id, f.id, 'up');
                                              }}
                                              style={{ width: '18px', height: '18px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: fIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fIdx === 0 ? 0.3 : 1, padding: 0 }}
                                              title="Di chuyển lên"
                                            >
                                              <ArrowUp size={10} style={{ color: '#0f172a' }} />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={fIdx === fArr.length - 1}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleMoveField(block.id, f.id, 'down');
                                              }}
                                              style={{ width: '18px', height: '18px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: fIdx === fArr.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: fIdx === fArr.length - 1 ? 0.3 : 1, padding: 0 }}
                                              title="Di chuyển xuống"
                                            >
                                              <ArrowDown size={10} style={{ color: '#0f172a' }} />
                                            </button>
                                          </div>
                                        )}
                                        <FieldTypeDropdown
                                          compact
                                          disabled={isLocked}
                                          value={f.type}
                                          onChange={(newType) => {
                                            setActiveBlockId(block.id);
                                            setActiveFieldId(f.id);
                                            handleChangeFieldType(block.id, f.id, newType);
                                          }}
                                        />
                                      </div>
                                    </div>

                                    {/* Photo editable tip box — rendered BELOW the header row */}
                                    {f.type === 'photo' && (
                                      <div style={{ flex: 1, border: '1.5px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: '#fafafa', marginTop: '4px' }}>
                                        <input
                                          type="text"
                                          value={f.placeholder ?? ''}
                                          disabled={isLocked}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => handleUpdateField(block.id, f.id, { placeholder: e.target.value })}
                                          style={{
                                            border: 'none',
                                            background: 'transparent',
                                            textAlign: 'center',
                                            color: '#475569',
                                            fontStyle: 'italic',
                                            fontSize: '0.78rem',
                                            width: '100%',
                                            outline: 'none',
                                            cursor: isLocked ? 'default' : 'text',
                                            fontWeight: 500
                                          }}
                                          placeholder="Gõ ghi chú/hướng dẫn ảnh..."
                                        />
                                      </div>
                                    )}

                                    {(f.type === 'likert_scale' || (f.type as any) === 'rating') && (() => {
                                      const isStars = f.likertVariant === 'stars' || (f.type as any) === 'rating';
                                      if (isStars) {
                                        const scale = f.ratingScale === 3 ? 3 : 5;
                                        return (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', paddingTop: '2px' }}>
                                            {Array.from({ length: scale }).map((_, idx) => (
                                              <Star
                                                key={idx}
                                                size={18}
                                                style={{
                                                  color: '#f59e0b',
                                                  fill: '#fef3c7',
                                                  strokeWidth: 1.5
                                                }}
                                              />
                                            ))}
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontWeight: 500 }}>
                                              ({scale} sao)
                                            </span>
                                          </div>
                                        );
                                      }

                                      const scales = f.scaleOptions && f.scaleOptions.length > 0 ? f.scaleOptions : ['1', '2', '3', '4', '5'];
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px', marginTop: '6px', paddingTop: '2px', width: '100%', overflowX: 'auto' }}>
                                          {scales.map((opt, idx) => (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1, minWidth: '32px', textAlign: 'center', position: 'relative' }}>
                                              <input
                                                type="text"
                                                disabled={isLocked}
                                                value={opt}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveBlockId(block.id);
                                                  setActiveFieldId(f.id);
                                                }}
                                                onChange={(e) => {
                                                  const newScales = [...scales];
                                                  newScales[idx] = e.target.value;
                                                  handleUpdateField(block.id, f.id, { scaleOptions: newScales });
                                                }}
                                                style={{
                                                  fontSize: '0.68rem',
                                                  color: '#334155',
                                                  fontWeight: 600,
                                                  lineHeight: 1.1,
                                                  textAlign: 'center',
                                                  width: '100%',
                                                  maxWidth: '90px',
                                                  border: '1px solid transparent',
                                                  borderRadius: '3px',
                                                  background: 'transparent',
                                                  outline: 'none',
                                                  cursor: isLocked ? 'default' : 'text',
                                                  padding: '1px 2px',
                                                  transition: 'all 0.15s ease'
                                                }}
                                                onFocus={(e) => {
                                                  e.currentTarget.style.borderColor = 'var(--primary)';
                                                  e.currentTarget.style.background = '#ffffff';
                                                }}
                                                onBlur={(e) => {
                                                  e.currentTarget.style.borderColor = 'transparent';
                                                  e.currentTarget.style.background = 'transparent';
                                                }}
                                                placeholder={`Nấc ${idx + 1}`}
                                              />
                                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' }}>
                                                <span style={{ display: 'inline-block', width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid #64748b', background: '#ffffff' }} />
                                                {isFieldSelected && !isLocked && scales.length > 2 && (
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      const newScales = scales.filter((_, i) => i !== idx);
                                                      handleUpdateField(block.id, f.id, { scaleOptions: newScales });
                                                    }}
                                                    style={{
                                                      position: 'absolute',
                                                      top: '-12px',
                                                      right: 'calc(50% - 18px)',
                                                      background: '#fee2e2',
                                                      border: '1px solid #fca5a5',
                                                      color: '#ef4444',
                                                      borderRadius: '50%',
                                                      width: '12px',
                                                      height: '12px',
                                                      fontSize: '8px',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      cursor: 'pointer',
                                                      padding: 0,
                                                      lineHeight: 1
                                                    }}
                                                    title="Xóa nấc này"
                                                  >
                                                    ✕
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                          {isFieldSelected && !isLocked && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const newScales = [...scales, `Mức ${scales.length + 1}`];
                                                handleUpdateField(block.id, f.id, { scaleOptions: newScales });
                                              }}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '2px 5px',
                                                fontSize: '0.65rem',
                                                borderRadius: '4px',
                                                border: '1px dashed #94a3b8',
                                                background: '#ffffff',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                marginTop: '10px',
                                                flexShrink: 0
                                              }}
                                              title="Thêm nấc mới"
                                            >
                                              <Plus size={10} />
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {(f.type === 'radio' || f.type === 'checkbox') && (() => {
                                      const options = f.options ?? [{ label: 'Đạt', value: 'PASS' }, { label: 'Không Đạt', value: 'FAIL' }];
                                      const layoutMode = getAutoCheckboxLayoutMode(f, block.columns);
                                      const isOptionC = layoutMode === 'OPTION_C';
                                      const isLongOpt = hasLongOptions(f);
                                      return (
                                        <div style={{
                                          display: 'flex',
                                          flexDirection: isOptionC && isLongOpt ? 'column' : 'row',
                                          flexWrap: isOptionC && isLongOpt ? 'nowrap' : 'wrap',
                                          gap: isOptionC && isLongOpt ? '5px' : '6px 18px',
                                          alignItems: isOptionC && isLongOpt ? 'flex-start' : 'center',
                                          marginTop: '4px',
                                          paddingTop: '2px',
                                          paddingLeft: isOptionC ? '1rem' : '0',
                                          maxWidth: '100%'
                                        }}>
                                          {options.map((opt: any, optIdx: number) => (
                                            <span key={opt.value || optIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#334155', maxWidth: '100%' }}>
                                              <span style={{
                                                display: 'inline-block',
                                                width: '12px',
                                                height: '12px',
                                                border: '1.5px solid #64748b',
                                                borderRadius: f.type === 'radio' ? '50%' : '2px',
                                                background: '#ffffff',
                                                flexShrink: 0,
                                                marginTop: isOptionC && isLongOpt ? '2px' : '0'
                                              }} />
                                              <input
                                                type="text"
                                                disabled={isLocked}
                                                value={opt.label}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveBlockId(block.id);
                                                  setActiveFieldId(f.id);
                                                }}
                                                onChange={(e) => {
                                                  const newOptions = [...options];
                                                  newOptions[optIdx] = { ...newOptions[optIdx], label: e.target.value };
                                                  handleUpdateField(block.id, f.id, { options: newOptions });
                                                }}
                                                style={{
                                                  fontSize: '0.78rem',
                                                  color: '#334155',
                                                  border: '1px solid transparent',
                                                  borderRadius: '3px',
                                                  background: 'transparent',
                                                  outline: 'none',
                                                  cursor: isLocked ? 'default' : 'text',
                                                  padding: '1px 3px',
                                                  maxWidth: '180px',
                                                  transition: 'all 0.15s ease'
                                                }}
                                                onFocus={(e) => {
                                                  e.currentTarget.style.borderColor = 'var(--primary)';
                                                  e.currentTarget.style.background = '#ffffff';
                                                }}
                                                onBlur={(e) => {
                                                  e.currentTarget.style.borderColor = 'transparent';
                                                  e.currentTarget.style.background = 'transparent';
                                                }}
                                                placeholder="Nhãn..."
                                              />
                                              {isFieldSelected && !isLocked && options.length > 1 && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newOptions = options.filter((_: any, i: number) => i !== optIdx);
                                                    handleUpdateField(block.id, f.id, { options: newOptions });
                                                  }}
                                                  style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ef4444',
                                                    cursor: 'pointer',
                                                    padding: '0 2px',
                                                    fontSize: '10px',
                                                    lineHeight: 1,
                                                    opacity: 0.6
                                                  }}
                                                  title="Xóa lựa chọn này"
                                                >
                                                  ✕
                                                </button>
                                              )}
                                            </span>
                                          ))}
                                          {isFieldSelected && !isLocked && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const newOptions = [...options, { label: `Tùy chọn ${options.length + 1}`, value: `opt_${Date.now()}` }];
                                                handleUpdateField(block.id, f.id, { options: newOptions });
                                              }}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '2px',
                                                padding: '1px 5px',
                                                fontSize: '0.68rem',
                                                borderRadius: '3px',
                                                border: '1px dashed #94a3b8',
                                                background: '#ffffff',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer'
                                              }}
                                              title="Thêm tùy chọn mới"
                                            >
                                              <Plus size={10} /> Thêm
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    {f.type === 'subtable' && (() => {
                                      const cols = f.subtableColumns ?? [];
                                      const previewRowCount = f.subtableDefaultRows ?? 3;
                                      return (
                                        <div style={{ marginTop: '2px', width: '100%' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', background: '#fff' }}>
                                            <thead>
                                              <tr style={{ background: '#e2e8f0', borderBottom: '2px solid var(--primary)' }}>
                                                {cols.map((col: SubtableColumn) => (
                                                  <th key={col.id} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 600, color: '#0f172a', textAlign: (col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'))) as any, width: col.width }}>
                                                    {col.label}
                                                  </th>
                                                ))}
                                                {!isLocked && <th style={{ width: '22px', border: '1px solid #cbd5e1', background: '#e2e8f0' }} />}
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {Array.from({ length: previewRowCount }).map((_, rIdx) => (
                                                <tr key={rIdx}>
                                                  {cols.map((col: SubtableColumn) => {
                                                    const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'));
                                                    if (col.type === 'static_text') {
                                                      const val = f.subtableStaticData?.[rIdx]?.[col.id] || '';
                                                      return (
                                                        <td key={col.id} style={{ border: '1px solid #e2e8f0', padding: '2px', height: '28px' }}>
                                                          <input
                                                            type="text"
                                                            disabled={isLocked}
                                                            value={val}
                                                            onChange={(e) => {
                                                              const newVal = e.target.value;
                                                              const currentData = { ...(f.subtableStaticData || {}) };
                                                              currentData[rIdx] = { ...(currentData[rIdx] || {}), [col.id]: newVal };
                                                              handleUpdateField(block.id, f.id, { subtableStaticData: currentData });
                                                            }}
                                                            placeholder="Gõ nhãn..."
                                                            style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '2px 4px', fontSize: '0.72rem', fontWeight: 600, color: '#0f172a', textAlign: cellAlign as any, boxSizing: 'border-box' }}
                                                          />
                                                        </td>
                                                      );
                                                    }
                                                    return (
                                                      <td key={col.id} style={{ border: '1px solid #e2e8f0', padding: '4px 6px', height: '28px', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.68rem', textAlign: cellAlign as any }}>
                                                        {col.type === 'number' ? '[0]' : col.type === 'date' ? '[Ngày]' : col.type === 'time' ? '[Giờ]' : '[Nhập chữ]'}
                                                      </td>
                                                    );
                                                  })}
                                                  {!isLocked && (
                                                    <td style={{ border: '1px solid #e2e8f0', textAlign: 'center', padding: '1px' }}>
                                                      <button
                                                        type="button"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleUpdateField(block.id, f.id, { subtableDefaultRows: Math.max(1, previewRowCount - 1) });
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                        title="Xóa dòng in phôi này"
                                                      >
                                                        <Trash2 size={11} />
                                                      </button>
                                                    </td>
                                                  )}
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                          {!isLocked && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateField(block.id, f.id, { subtableDefaultRows: previewRowCount + 1 });
                                              }}
                                              style={{ marginTop: '4px', float: 'right', fontSize: '0.68rem', padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#fff', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                                            >+ Thêm dòng</button>
                                          )}
                                          <div style={{ clear: 'both' }} />
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                              {!isLocked && (
                                <div 
                                  onClick={(e) => { e.stopPropagation(); handleAddField(block.id, 'text'); }}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    border: '1px dashed #cbd5e1', 
                                    borderRadius: '4px', 
                                    padding: '5px', 
                                    fontSize: '0.72rem', 
                                    fontWeight: 500,
                                    color: 'var(--text-muted)', 
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => { 
                                    e.currentTarget.style.borderColor = 'var(--primary)'; 
                                    e.currentTarget.style.color = 'var(--primary)'; 
                                    e.currentTarget.style.background = 'rgba(13, 148, 136, 0.04)';
                                  }}
                                  onMouseLeave={(e) => { 
                                    e.currentTarget.style.borderColor = '#cbd5e1'; 
                                    e.currentTarget.style.color = 'var(--text-muted)'; 
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <Plus size={11} style={{ marginRight: '3px' }} /> Add Field Slot
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 3. CHECKLIST TABLE BLOCK */}
                      {block.type === 'CHECKLIST_TABLE' && (() => {
                        return (
                          <div>
                            <InCanvasTitleHeader
                              block={block}
                              isLocked={isLocked}
                              isBlockSelected={isBlockSelected}
                              onUpdateTitle={(val) => handleUpdateBlockTitle(block.id, val)}
                              onUpdateTitleFormat={(fmt) => handleUpdateBlockTitleFormat(block.id, fmt)}
                              onSelectBlock={() => {
                                setActiveBlockId(block.id);
                                setActiveFieldId(null);
                              }}
                            />
                          
                          <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                {getChecklistColumns(block).map((col) => (
                                  <th
                                    key={col.id}
                                    style={{
                                      padding: '4px 6px',
                                      textAlign: (col.align || (col.id === 'col_stt' ? 'center' : 'left')) as any,
                                      width: col.width
                                    }}
                                  >
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {block.fields.length === 0 ? (
                                <tr>
                                  <td colSpan={getChecklistColumns(block).length} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No checklist fields added yet. Click elements in the left panel to populate this checklist.
                                  </td>
                                </tr>
                              ) : (
                                block.fields.map((f, idx) => {
                                  const isFieldSelected = activeFieldId === f.id;
                                  return (
                                    <tr 
                                      key={f.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBlockId(block.id);
                                        setActiveFieldId(f.id);
                                      }}
                                      style={{
                                        borderBottom: '1px solid #e2e8f0',
                                        background: isFieldSelected ? 'rgba(16, 163, 163, 0.05)' : 'none',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {getChecklistColumns(block).map((col) => {
                                        if (col.id === 'col_stt') {
                                          return <td key={col.id} style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>;
                                        }
                                        if (col.id === 'col_item') {
                                          return <td key={col.id} style={{ padding: '4px 6px' }}>{f.checkItem}</td>;
                                        }
                                        if (col.id === 'col_unit') {
                                          return <td key={col.id} style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{f.unit || ''}</td>;
                                        }
                                        if (col.id === 'col_spec') {
                                          let specText = '';
                                          if (f.type === 'number') {
                                            if (f.minSpec !== undefined && f.maxSpec !== undefined) {
                                              specText = `${f.minSpec} ~ ${f.maxSpec}`;
                                            } else if (f.minSpec !== undefined) {
                                              specText = `>= ${f.minSpec}`;
                                            } else if (f.maxSpec !== undefined) {
                                              specText = `<= ${f.maxSpec}`;
                                            }
                                          } else {
                                            specText = f.targetRange || '';
                                          }
                                          return <td key={col.id} style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{specText}</td>;
                                        }
                                        if (col.id === 'col_target') {
                                          return (
                                            <td key={col.id} style={{ padding: '4px 6px', textAlign: 'center' }}>
                                              {(f.type === 'radio' || f.type === 'checkbox') ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                  {(f.options ?? DEFAULT_RADIO_OPTIONS).map(opt => (
                                                    <span key={opt.value} style={{
                                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                      padding: '0 5px', height: '16px', borderRadius: '8px',
                                                      border: '1px solid #cbd5e1', fontSize: '0.5rem',
                                                      color: 'var(--text-secondary)', whiteSpace: 'nowrap'
                                                    }}>{opt.label}</span>
                                                  ))}
                                                </div>
                                              ) : f.type === 'time' ? (
                                                f.timeMode === 'dual'
                                                  ? <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>([Từ] ~ [Đến])</span>
                                                  : <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>([Giờ])</span>
                                              ) : f.type === 'number' ? (
                                                (f.minSpec !== undefined && f.maxSpec !== undefined)
                                                  ? <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>({f.minSpec}-{f.maxSpec})</span>
                                                  : null
                                              ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{f.type}</span>
                                              )}
                                            </td>
                                          );
                                        }
                                        if (col.id === 'col_reaction') {
                                          return (
                                            <td key={col.id} style={{ padding: '4px 6px', borderLeft: '1px solid #e2e8f0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                              {f.reactionProtocol || ''}
                                            </td>
                                          );
                                        }
                                        return <td key={col.id} style={{ padding: '4px 6px', borderLeft: '1px solid #e2e8f0' }} />;
                                      })}
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                            </table>
                          </div>
                          
                          {!isLocked && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); handleAddField(block.id, 'radio'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              >
                                <Plus size={12} /> Radio Row
                              </button>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); handleAddField(block.id, 'number'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              >
                                <Plus size={12} /> Numeric Spec Row
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                      {/* 3.1 MATRIX TABLE BLOCK */}
                      {block.type === 'MATRIX_TABLE' && block.matrixConfig && (() => {
                        return (
                          <div>
                            <InCanvasTitleHeader
                              block={block}
                              isLocked={isLocked}
                              isBlockSelected={isBlockSelected}
                              onUpdateTitle={(val) => handleUpdateBlockTitle(block.id, val)}
                              onUpdateTitleFormat={(fmt) => handleUpdateBlockTitleFormat(block.id, fmt)}
                              onSelectBlock={() => {
                                setActiveBlockId(block.id);
                                setActiveFieldId(null);
                              }}
                            />
                          
                          <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                              <thead>
                                <tr style={{ background: '#e2e8f0' }}>
                                  <th rowSpan={2} style={{ padding: '6px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid var(--primary)', textAlign: 'center', width: '50px', color: '#0f172a', fontWeight: 600 }}>
                                    {block.matrixConfig.rowHeader}
                                  </th>
                                  <th colSpan={block.matrixConfig.columns.length} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', textAlign: 'center', color: '#0f172a', fontWeight: 600 }}>
                                    {block.matrixConfig.columnHeader}
                                  </th>
                                  {block.matrixConfig.showTotalColumn && (
                                    <th rowSpan={2} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid var(--primary)', textAlign: 'center', width: '100px', fontSize: '0.7rem', color: '#0f172a', fontWeight: 600 }}>
                                      {block.matrixConfig.totalColumnHeader}
                                    </th>
                                  )}
                                  {block.matrixConfig.showNotesColumn && (
                                    <th rowSpan={2} style={{ padding: '4px', borderBottom: '2px solid var(--primary)', textAlign: 'left', width: '150px', color: '#0f172a', fontWeight: 600 }}>
                                      {block.matrixConfig.notesColumnHeader}
                                    </th>
                                  )}
                                </tr>
                                <tr style={{ background: '#cbd5e1', borderBottom: '2px solid var(--primary)' }}>
                                  {block.matrixConfig.columns.map((colName, cIdx) => (
                                    <th key={cIdx} style={{ padding: '4px', borderRight: '1px solid #94a3b8', textAlign: block.matrixConfig!.columnAlign || 'center', fontWeight: 600, fontSize: '0.7rem', color: '#0f172a' }}>
                                      {colName || `(Cột ${cIdx + 1})`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[1, 2, 3].map((rowIdx) => (
                                  <tr key={rowIdx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                    <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>
                                      {rowIdx}
                                    </td>
                                    {block.matrixConfig!.columns.map((_, cIdx) => (
                                      <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>
                                        <div style={{ border: '1px dashed #cbd5e1', padding: '2px', background: '#f8fafc', color: '#94a3b8', fontSize: '0.65rem' }}>
                                          [0]
                                        </div>
                                      </td>
                                    ))}
                                    {block.matrixConfig!.showTotalColumn && (
                                      <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', background: '#f1f5f9', fontWeight: 'bold' }}>
                                        0
                                      </td>
                                    )}
                                    {block.matrixConfig!.showNotesColumn && (
                                      <td style={{ padding: '4px', color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                        ...
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                <tr style={{ background: '#f8fafc', fontWeight: 'bold', borderTop: '1.5px solid #cbd5e1' }}>
                                  <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>TỔNG</td>
                                  {block.matrixConfig.columns.map((_, cIdx) => (
                                    <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>0</td>
                                  ))}
                                  {block.matrixConfig.showTotalColumn && (
                                    <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', background: '#e2e8f0' }}>0</td>
                                  )}
                                  {block.matrixConfig.showNotesColumn && (
                                    <td style={{ padding: '4px' }}></td>
                                  )}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                            * Thiết kế mô phỏng (Hiển thị 3 hàng demo). Số dòng thực tế cấu hình: {block.matrixConfig.rowCount} hàng.
                          </div>
                        </div>
                      );
                    })()}
                      
                      {/* 3.2 DYNAMIC TABLE BLOCK */}
                      {block.type === 'TABLE' && (() => {
                        const bStyle = block.borderStyle || 'grid';
                        return (
                          <div>
                            <InCanvasTitleHeader
                              block={block}
                              isLocked={isLocked}
                              isBlockSelected={isBlockSelected}
                              onUpdateTitle={(val) => handleUpdateBlockTitle(block.id, val)}
                              onUpdateTitleFormat={(fmt) => handleUpdateBlockTitleFormat(block.id, fmt)}
                              onSelectBlock={() => {
                                setActiveBlockId(block.id);
                                setActiveFieldId(null);
                              }}
                            />
                          
                          <div style={{
                            overflowX: 'auto',
                            border: bStyle === 'borderless' ? '1px dashed #e2e8f0' : '1px solid #cbd5e1',
                            borderTop: isSeamless ? 'none' : (bStyle === 'borderless' ? '1px dashed #e2e8f0' : '1px solid #cbd5e1'),
                            borderRadius: isSeamless && isFollowedBySeamless ? '0px' : isSeamless ? '0 0 4px 4px' : isFollowedBySeamless ? '4px 4px 0 0' : '4px',
                            background: bStyle === 'borderless' ? '#ffffff' : 'inherit'
                          }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' }}>
                              <colgroup>
                                {(block.tableColumns || []).map((col) => {
                                  const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                  return <col key={col.id} style={{ width: colWidth }} />;
                                })}
                                {!isLocked && (
                                  <col style={{ width: '75px' }} />
                                )}
                              </colgroup>
                              <thead style={{ opacity: block.hideHeader ? 0.45 : 1, transition: 'opacity 0.2s ease' }} title={block.hideHeader ? 'Tiêu đề đang ẨN trên bản in & biểu mẫu' : undefined}>
                                <tr style={{ background: bStyle === 'borderless' ? (block.hideHeader ? '#f8fafc' : 'transparent') : '#f1f5f9', borderBottom: bStyle === 'borderless' ? (block.hideHeader ? '1px dashed #cbd5e1' : 'none') : (block.hideHeader ? '1px dashed #94a3b8' : '1px solid #cbd5e1') }}>
                                  {(block.tableColumns || []).map((col) => {
                                    const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                    const headerAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' || col.type === 'likert_scale' ? 'center' : 'left'));
                                    return (
                                      <th
                                        key={col.id}
                                        style={{
                                          padding: '4px 6px',
                                          borderRight: bStyle === 'grid' ? '1px solid #cbd5e1' : 'none',
                                          borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1',
                                          width: colWidth,
                                          verticalAlign: 'top',
                                          boxSizing: 'border-box'
                                        }}
                                      >
                                        {col.type === 'likert_scale' ? (
                                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(col.scaleOptions || []).length || 3}, 1fr)`, gap: '4px', textAlign: 'center', width: '100%', minHeight: '22px' }}>
                                            {(col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer']).map((opt, sIdx) => (
                                              <div key={sIdx} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', padding: '2px 2px', wordBreak: 'break-word', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {opt}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div style={{ display: 'grid', width: '100%', minHeight: '22px', boxSizing: 'border-box' }}>
                                            <span
                                              aria-hidden="true"
                                              style={{
                                                gridArea: '1 / 1 / 2 / 2',
                                                visibility: 'hidden',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                lineHeight: 1.35,
                                                fontFamily: 'inherit',
                                                textAlign: headerAlign as any,
                                                padding: '2px 4px',
                                                minHeight: '18px'
                                              }}
                                            >
                                              {(col.label || '') + ' '}
                                            </span>
                                            <textarea
                                              disabled={isLocked}
                                              rows={1}
                                              value={col.label || ''}
                                              placeholder="Tên cột..."
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveBlockId(block.id);
                                              }}
                                              onChange={(e) => handleUpdateTableColumn(block.id, col.id, { label: e.target.value })}
                                              style={{
                                                gridArea: '1 / 1 / 2 / 2',
                                                width: '100%',
                                                height: '100%',
                                                fontWeight: 700,
                                                fontSize: '0.82rem',
                                                lineHeight: 1.35,
                                                fontFamily: 'inherit',
                                                color: '#0f172a',
                                                textAlign: headerAlign as any,
                                                border: '1px solid transparent',
                                                borderRadius: '3px',
                                                background: 'transparent',
                                                outline: 'none',
                                                padding: '2px 4px',
                                                margin: 0,
                                                resize: 'none',
                                                overflow: 'hidden',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                cursor: isLocked ? 'default' : 'text'
                                              }}
                                              onFocus={(e) => {
                                                e.target.style.borderColor = 'var(--primary)';
                                                e.target.style.background = '#ffffff';
                                              }}
                                              onBlur={(e) => {
                                                e.target.style.borderColor = 'transparent';
                                                e.target.style.background = 'transparent';
                                              }}
                                            />
                                          </div>
                                        )}
                                      </th>
                                    );
                                  })}
                                  {!isLocked && (
                                    <th style={{ width: '75px', padding: '0', border: 'none', background: 'transparent' }} />
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {(block.tableRows || []).length === 0 ? (
                                  <tr>
                                    <td colSpan={(block.tableColumns || []).length + (isLocked ? 0 : 1)} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      Không có dòng nào. Bấm nút Thêm dòng dưới đây.
                                    </td>
                                  </tr>
                                ) : (
                                  (block.tableRows || []).map((row) => {
                                    if (row.isGroupHeader) {
                                      const isSelected = activeCellKey === `${row.id}_group`;
                                      const groupTitleVal = row.groupTitle !== undefined ? row.groupTitle : (block.tableData?.[row.id]?.['_groupTitle'] || '');
                                      return (
                                        <tr
                                          key={row.id}
                                          style={{ borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1', background: bStyle === 'borderless' ? 'transparent' : '#f8fafc' }}
                                          onMouseEnter={() => !isLocked && setHoveredTableRowId(row.id)}
                                          onMouseLeave={() => setHoveredTableRowId(null)}
                                        >
                                          <td
                                            colSpan={(block.tableColumns || []).length}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveBlockId(block.id);
                                              setActiveCellKey(`${row.id}_group`);
                                            }}
                                            style={{
                                              padding: '6px 10px',
                                              verticalAlign: 'middle',
                                              fontWeight: 600,
                                              fontSize: '0.80rem',
                                              color: '#1e293b',
                                              outline: isSelected ? '1.5px solid #3b82f6' : 'none'
                                            }}
                                          >
                                            <div style={{ display: 'grid', width: '100%', minHeight: '26px', boxSizing: 'border-box' }}>
                                              <span
                                                aria-hidden="true"
                                                style={{
                                                  gridArea: '1 / 1 / 2 / 2',
                                                  visibility: 'hidden',
                                                  whiteSpace: 'pre-wrap',
                                                  wordBreak: 'break-word',
                                                  fontSize: '0.80rem',
                                                  fontWeight: 600,
                                                  lineHeight: 1.4,
                                                  fontFamily: 'inherit',
                                                  minHeight: '18px'
                                                }}
                                              >
                                                {(groupTitleVal || '') + ' '}
                                              </span>
                                              <textarea
                                                disabled={isLocked}
                                                rows={1}
                                                value={groupTitleVal}
                                                placeholder="Nhập tên phân nhóm (ví dụ: I. Bao bì và đóng gói)..."
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setLayoutBlocks(prev => prev.map(b => {
                                                    if (b.id === block.id) {
                                                      const updatedRows = (b.tableRows || []).map(r => r.id === row.id ? { ...r, groupTitle: val } : r);
                                                      const updatedData = { ...b.tableData || {} };
                                                      updatedData[row.id] = { ...updatedData[row.id] || {}, _groupTitle: val };
                                                      return { ...b, tableRows: updatedRows, tableData: updatedData };
                                                    }
                                                    return b;
                                                  }));
                                                }}
                                                style={{
                                                  gridArea: '1 / 1 / 2 / 2',
                                                  width: '100%',
                                                  height: '100%',
                                                  border: 'none',
                                                  background: 'transparent',
                                                  outline: 'none',
                                                  padding: 0,
                                                  margin: 0,
                                                  fontWeight: 600,
                                                  fontSize: '0.80rem',
                                                  lineHeight: 1.4,
                                                  fontFamily: 'inherit',
                                                  color: '#1e293b',
                                                  resize: 'none',
                                                  overflow: 'hidden',
                                                  whiteSpace: 'pre-wrap',
                                                  wordBreak: 'break-word'
                                                }}
                                              />
                                            </div>
                                          </td>
                                          {!isLocked && (
                                            <td style={{ width: '75px', padding: '0 4px', border: 'none', textAlign: 'center', background: '#e5e7eb' }}>
                                              <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', alignItems: 'center', opacity: hoveredTableRowId === row.id ? 1 : 0, transition: 'opacity 0.15s ease' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleMoveRow(block.id, row.id, 'up')}
                                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                  title="Di chuyển phân nhóm lên"
                                                >
                                                  <ArrowUp size={11} style={{ pointerEvents: 'none' }} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleMoveRow(block.id, row.id, 'down')}
                                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                                  title="Di chuyển phân nhóm xuống"
                                                >
                                                  <ArrowDown size={11} style={{ pointerEvents: 'none' }} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setLayoutBlocks(prev => prev.map(b => {
                                                      if (b.id === block.id) {
                                                        const updatedRows = (b.tableRows || []).map(r => r.id === row.id ? { ...r, isGroupHeader: false } : r);
                                                        return { ...b, tableRows: updatedRows };
                                                      }
                                                      return b;
                                                    }));
                                                  }}
                                                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', fontSize: '0.65rem' }}
                                                  title="Chuyển thành dòng dữ liệu thường"
                                                >
                                                  🔄
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setLayoutBlocks(prev => prev.map(b => {
                                                      if (b.id === block.id) {
                                                        const updatedRows = (b.tableRows || []).filter(r => r.id !== row.id);
                                                        const updatedData = { ...b.tableData || {} };
                                                        delete updatedData[row.id];
                                                        return { ...b, tableRows: updatedRows, tableData: updatedData };
                                                      }
                                                      return b;
                                                    }));
                                                    setHoveredTableRowId(null);
                                                  }}
                                                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                  title="Xóa phân nhóm"
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    }

                                    const lc = row.lineCount ?? 1;
                                    return (
                                    <tr
                                      key={row.id}
                                      style={{ borderBottom: '1px solid #cbd5e1' }}
                                      onMouseEnter={() => !isLocked && setHoveredTableRowId(row.id)}
                                      onMouseLeave={() => setHoveredTableRowId(null)}
                                    >
                                       {(block.tableColumns || []).map((col) => {
                                         const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                         const cellKey = `${row.id}_${col.id}`;
                                         const cellOptions = getEffectiveCellOptions(block, row.id, col.id);
                                         const isCustomCellOpts = block.cellOptionsMap?.[cellKey] !== undefined;
                                         const hasOpts = (col.type === 'checkbox' || col.type === 'radio') && cellOptions.length > 0;
                                         const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOpts ? 'left' : 'center') : col.type === 'likert_scale' ? 'center' : 'left'));
                                         const isCellSelected = activeCellKey === cellKey;
                                         const isOptionCell = col.type === 'checkbox' || col.type === 'radio';

                                         return (
                                           <td 
                                             key={col.id} 
                                             onClick={(e) => {
                                                e.stopPropagation();
                                               setActiveBlockId(block.id);
                                               setActiveCellKey(cellKey);
                                             }}
                                             style={{ 
                                               padding: isOptionCell ? '4px' : '0', 
                                               borderRight: bStyle === 'grid' ? '1px solid #cbd5e1' : 'none',
                                               borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1',
                                               verticalAlign: 'top', 
                                               textAlign: cellAlign,
                                                width: colWidth,
                                                maxWidth: colWidth,
                                                boxSizing: 'border-box',
                                               background: isCellSelected ? 'rgba(59, 130, 246, 0.08)' : isCustomCellOpts ? 'rgba(254, 215, 170, 0.15)' : 'none',
                                               outline: isCellSelected ? '1.5px solid #3b82f6' : 'none',
                                               cursor: 'pointer'
                                             }}
                                           >
                                             {isOptionCell ? (() => {
                                                const isInline = canTableOptionsFitInline(cellOptions, col.width, col.checkboxLayout);
                                                return (
                                                <div style={{
                                                  display: 'flex',
                                                  flexDirection: isInline ? 'row' : 'column',
                                                  flexWrap: isInline ? 'wrap' : undefined,
                                                  gap: isInline ? '4px 12px' : '4px',
                                                  alignItems: isInline ? 'center' : 'flex-start',
                                                  justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                                  padding: '2px 0',
                                                  width: '100%'
                                                }}>
                                                   {isCustomCellOpts && !isLocked && (
                                                     <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '2px', width: isInline ? '100%' : undefined }}>
                                                       <button
                                                         type="button"
                                                         onClick={(e) => { e.stopPropagation(); handleResetCellOptions(block.id, row.id, col.id); }}
                                                         style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '3px', color: '#c2410c', cursor: 'pointer', fontSize: '0.62rem', padding: '1px 5px' }}
                                                         title="Khôi phục về dùng chung cấu hình Cột"
                                                       >
                                                         🔄 Reset
                                                       </button>
                                                     </div>
                                                   )}
                                                 
                                                 {cellOptions.map((opt, oIdx) => (
                                                   <div key={oIdx} style={{ display: isInline ? 'inline-flex' : 'flex', alignItems: isInline ? 'center' : 'flex-start', gap: '4px', fontSize: '0.75rem', width: isInline ? 'auto' : '100%' }}>
                                                     <input type={col.type} disabled style={{ pointerEvents: 'none', flexShrink: 0, marginTop: isInline ? 0 : '3px' }} />
                                                     <div style={{ display: 'grid', flex: isInline ? undefined : 1, minWidth: isInline ? '30px' : 0, minHeight: '18px', boxSizing: 'border-box' }}>
                                                       <span
                                                         aria-hidden="true"
                                                         style={{
                                                           gridArea: '1 / 1 / 2 / 2',
                                                           visibility: 'hidden',
                                                           whiteSpace: isInline ? 'nowrap' : 'pre-wrap',
                                                           wordBreak: isInline ? 'normal' : 'break-word',
                                                           fontSize: '0.75rem',
                                                           lineHeight: 1.35,
                                                           fontFamily: 'inherit',
                                                           padding: '1px 2px',
                                                           minHeight: '16px'
                                                         }}
                                                       >
                                                         {(opt.label || '') + ' '}
                                                       </span>
                                                       <textarea
                                                         disabled={isLocked}
                                                         rows={1}
                                                         value={opt.label}
                                                         placeholder="Tùy chọn..."
                                                         onClick={(e) => e.stopPropagation()}
                                                         onChange={(e) => {
                                                           const newOpts = [...cellOptions];
                                                           newOpts[oIdx] = { ...newOpts[oIdx], label: e.target.value };
                                                           handleUpdateCellOptions(block.id, row.id, col.id, newOpts);
                                                         }}
                                                         style={{
                                                           gridArea: '1 / 1 / 2 / 2',
                                                           width: '100%',
                                                           height: '100%',
                                                           fontSize: '0.75rem',
                                                           lineHeight: 1.35,
                                                           fontFamily: 'inherit',
                                                           color: 'var(--text-primary)',
                                                           border: 'none',
                                                           borderBottom: '1px dotted #cbd5e1',
                                                           borderRadius: 0,
                                                           background: 'transparent',
                                                           outline: 'none',
                                                           padding: '1px 2px',
                                                           margin: 0,
                                                           resize: 'none',
                                                           overflow: 'hidden',
                                                           whiteSpace: isInline ? 'nowrap' : 'pre-wrap',
                                                           wordBreak: isInline ? 'normal' : 'break-word',
                                                           cursor: isLocked ? 'default' : 'text'
                                                         }}
                                                         onFocus={(e) => {
                                                           e.target.style.borderBottom = '1px solid var(--primary)';
                                                           e.target.style.background = 'rgba(255, 255, 255, 0.8)';
                                                         }}
                                                         onBlur={(e) => {
                                                           e.target.style.borderBottom = '1px dotted #cbd5e1';
                                                           e.target.style.background = 'transparent';
                                                         }}
                                                       />
                                                     </div>
                                                     {!isLocked && (
                                                       <button 
                                                         type="button" 
                                                         onClick={(e) => { 
                                                           e.stopPropagation(); 
                                                           const newOpts = cellOptions.filter((_, i) => i !== oIdx); 
                                                           handleUpdateCellOptions(block.id, row.id, col.id, newOpts); 
                                                         }} 
                                                         style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '0.7rem', lineHeight: 1 }}
                                                         title="Xóa lựa chọn này khỏi ô"
                                                       >
                                                         ✕
                                                       </button>
                                                     )}
                                                   </div>
                                                 ))}
                                                 {!isLocked && (
                                                   <button 
                                                     type="button" 
                                                     onClick={(e) => { 
                                                       e.stopPropagation(); 
                                                       const newOpts = [...cellOptions, { label: 'Lựa chọn mới', value: `OPT_${Date.now()}`, isPass: true }]; 
                                                       handleUpdateCellOptions(block.id, row.id, col.id, newOpts); 
                                                     }} 
                                                     style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 4px', fontSize: '0.65rem', borderRadius: '3px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content', marginTop: isInline ? 0 : '2px', alignSelf: isInline ? 'center' : 'flex-start' }}
                                                   >
                                                     + Thêm lựa chọn
                                                   </button>
                                                 )}
                                               </div>
                                                );
                                              })() : (
                                                <>
                                                  {col.type === 'static_text' || col.type === 'text' ? (
                                                    <div style={{ display: 'grid', width: '100%', minHeight: `${28 * lc}px`, padding: '4px 6px', boxSizing: 'border-box' }}>
                                                      <span
                                                        aria-hidden="true"
                                                        style={{
                                                          gridArea: '1 / 1 / 2 / 2',
                                                          visibility: 'hidden',
                                                          whiteSpace: 'pre-wrap',
                                                          wordBreak: 'break-word',
                                                          fontSize: '0.82rem',
                                                          lineHeight: 1.4,
                                                          fontFamily: 'inherit',
                                                          textAlign: cellAlign,
                                                          minHeight: `${Math.max(20, 28 * lc - 8)}px`
                                                        }}
                                                      >
                                                        {(block.tableData?.[row.id]?.[col.id] || '') + ' '}
                                                      </span>
                                                      <textarea
                                                        disabled={isLocked}
                                                        rows={1}
                                                        value={block.tableData?.[row.id]?.[col.id] || ''}
                                                        onChange={(e) => {
                                                          const val = e.target.value;
                                                          setLayoutBlocks(prev => prev.map(b => {
                                                            if (b.id === block.id) {
                                                              const updatedData = { ...b.tableData || {} };
                                                              if (val === '') {
                                                                if (updatedData[row.id]) {
                                                                  const newRowData = { ...updatedData[row.id] };
                                                                  delete newRowData[col.id];
                                                                  if (Object.keys(newRowData).length === 0) {
                                                                    delete updatedData[row.id];
                                                                  } else {
                                                                    updatedData[row.id] = newRowData;
                                                                  }
                                                                }
                                                              } else {
                                                                updatedData[row.id] = { ...updatedData[row.id] || {}, [col.id]: val };
                                                              }
                                                              return { ...b, tableData: updatedData };
                                                            }
                                                            return b;
                                                          }));
                                                        }}
                                                        placeholder="[Nhập chữ]"
                                                        style={{
                                                          gridArea: '1 / 1 / 2 / 2',
                                                          width: '100%',
                                                          height: '100%',
                                                          border: 'none',
                                                          background: 'transparent',
                                                          outline: 'none',
                                                          padding: 0,
                                                          margin: 0,
                                                          fontSize: '0.82rem',
                                                          lineHeight: 1.4,
                                                          fontFamily: 'inherit',
                                                          textAlign: cellAlign,
                                                          resize: 'none',
                                                          overflow: 'hidden',
                                                          whiteSpace: 'pre-wrap',
                                                          wordBreak: 'break-word',
                                                          color: (block.tableData?.[row.id]?.[col.id] || '') !== '' ? '#0f172a' : undefined,
                                                          fontWeight: (block.tableData?.[row.id]?.[col.id] || '') !== '' ? 500 : 400
                                                        }}
                                                      />
                                                    </div>
                                                  ) : (
                                                    <div style={{ height: `${28 * lc}px`, padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', overflow: 'hidden' }}>
                                                      {col.type === 'rating' ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', width: '100%' }}>
                                                          {Array.from({ length: col.ratingScale === 3 ? 3 : 5 }).map((_, sIdx) => (
                                                            <Star key={sIdx} size={14} style={{ color: '#f59e0b', fill: '#fef3c7', strokeWidth: 1.5 }} />
                                                          ))}
                                                        </div>
                                                      ) : col.type === 'likert_scale' ? (
                                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(col.scaleOptions || []).length || 3}, 1fr)`, gap: '4px', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                                          {(col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer']).map((_, sIdx) => (
                                                            <div key={sIdx} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                              <span style={{ display: 'inline-block', width: '13px', height: '13px', borderRadius: '50%', border: '1.5px solid #64748b', background: '#ffffff' }} />
                                                            </div>
                                                          ))}
                                                        </div>
                                                      ) : col.type === 'date' ? (
                                                        <span style={{ color: '#cbd5e1', fontSize: '0.7rem', display: 'block', textAlign: 'center', width: '100%' }}>[Ngày]</span>
                                                      ) : col.type === 'time' ? (
                                                        <span style={{ color: '#cbd5e1', fontSize: '0.7rem', display: 'block', textAlign: 'center', width: '100%' }}>[Giờ]</span>
                                                      ) : col.type === 'number' ? (
                                                        <span style={{ color: '#cbd5e1', fontSize: '0.7rem', display: 'block', textAlign: 'right', width: '100%' }}>[Nhập số]</span>
                                                      ) : (
                                                        <span style={{ color: '#cbd5e1', fontSize: '0.7rem', display: 'block', textAlign: 'left', width: '100%' }}>[Nhập chữ]</span>
                                                      )}
                                                    </div>
                                                  )}
                                                  {lc > 1 && Array.from({ length: lc - 1 }).map((_, i) => (
                                                    <div key={i} style={{ height: '28px', borderTop: '1px dashed #e2e8f0' }} />
                                                  ))}
                                                </>
                                             )}
                                           </td>
                                         );
                                       })}
                                      {!isLocked && (
                                         <td style={{ width: '75px', padding: '0 4px', border: 'none', textAlign: 'center' }}>
                                           <div style={{ display: 'flex', gap: '2px', justifyContent: 'center', alignItems: 'center', opacity: hoveredTableRowId === row.id ? 1 : 0, transition: 'opacity 0.15s ease' }}>
                                             <button
                                               type="button"
                                               onClick={() => handleMoveRow(block.id, row.id, 'up')}
                                               style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                               title="Di chuyển dòng lên"
                                             >
                                               <ArrowUp size={11} style={{ pointerEvents: 'none' }} />
                                             </button>
                                             <button
                                               type="button"
                                               onClick={() => handleMoveRow(block.id, row.id, 'down')}
                                               style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                               title="Di chuyển dòng xuống"
                                             >
                                               <ArrowDown size={11} style={{ pointerEvents: 'none' }} />
                                             </button>
                                             <select
                                               value={lc}
                                               onClick={(e) => e.stopPropagation()}
                                               onChange={(e) => handleUpdateRowLineCount(block.id, row.id, Number(e.target.value))}
                                               style={{ width: '34px', fontSize: '0.62rem', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '1px 0', background: 'var(--neutral-bg)', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center' }}
                                               title="Số dòng viết tay trong ô (1–5)"
                                             >
                                               {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}↕</option>)}
                                             </select>
                                             <button
                                               type="button"
                                               onClick={() => {
                                                 setLayoutBlocks(prev => prev.map(b => {
                                                   if (b.id === block.id) {
                                                     const updatedRows = (b.tableRows || []).filter(r => r.id !== row.id);
                                                     const updatedData = { ...b.tableData || {} };
                                                     delete updatedData[row.id];
                                                     return { ...b, tableRows: updatedRows, tableData: updatedData };
                                                   }
                                                   return b;
                                                 }));
                                                  setHoveredTableRowId(null);
                                               }}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                               title="Xóa dòng"
                                             >
                                                <Trash2 size={11} />
                                             </button>
                                           </div>
                                         </td>
                                       )}
                                    </tr>
                                    );
                                  })
                                )}
                              </tbody>
                              {(() => {
                                const columns = block.tableColumns || [];
                                const totalCols = columns.length;
                                if (totalCols === 0) return null;

                                const summaryTypes: { id: string; label: string }[] = [];
                                const columnsWithSummaries: { col: any; colIdx: number; rowMap: Map<string, any> }[] = [];

                                const getDummySummaryVal = (col: any, row: any): number => {
                                  const summaryRows = col.summaryRows || [];
                                  if (row.type === 'sum') {
                                    let sum = 0;
                                    (block.tableRows || []).forEach((r: any) => {
                                      const valStr = block.tableData?.[r.id]?.[col.id] || '';
                                      const num = parseFloat(valStr.replace(/,/g, '')) || 0;
                                      sum += num;
                                    });
                                    return sum;
                                  }
                                  if (row.type === 'percentage') {
                                    if (!row.percentageOfId) return 0;
                                    const parentRow = summaryRows.find((r: any) => r.id === row.percentageOfId);
                                    if (!parentRow) return 0;
                                    const parentVal = getDummySummaryVal(col, parentRow);
                                    return parentVal * ((row.percentageValue || 0) / 100);
                                  }
                                  if (row.type === 'sum_all') {
                                    let sum = 0;
                                    (row.sumRowIds || []).forEach((id: string) => {
                                      const targetRow = summaryRows.find((r: any) => r.id === id);
                                      if (targetRow) {
                                        sum += getDummySummaryVal(col, targetRow);
                                      }
                                    });
                                    return sum;
                                  }
                                  return 0;
                                };

                                columns.forEach((col: any, colIdx: number) => {
                                  if (col.type === 'number' && col.summaryRows && col.summaryRows.length > 0) {
                                    const rowMap = new Map<string, any>();
                                    col.summaryRows.forEach((row: any) => {
                                      rowMap.set(row.id, row);
                                      if (!summaryTypes.some(s => s.label === row.label)) {
                                        summaryTypes.push({ id: row.id, label: row.label || 'Cộng:' });
                                      }
                                    });
                                    columnsWithSummaries.push({ col, colIdx, rowMap });
                                  }
                                });

                                if (columnsWithSummaries.length === 0) return null;

                                const firstSumColIdx = Math.min(...columnsWithSummaries.map(c => c.colIdx));

                                return (
                                  <tfoot style={{ borderTop: '2px solid #94a3b8' }}>
                                    {summaryTypes.map((sumType, idx) => {
                                      return (
                                        <tr key={sumType.id || idx} style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                          {firstSumColIdx > 0 && (
                                            <td colSpan={firstSumColIdx} style={{
                                              padding: '6px 8px',
                                              borderRight: '1px solid #cbd5e1',
                                              borderBottom: '1px solid #cbd5e1',
                                              textAlign: 'right',
                                              color: 'var(--text-secondary)',
                                              fontSize: '0.8rem'
                                            }}>
                                              {sumType.label}
                                            </td>
                                          )}
                                          {columns.slice(firstSumColIdx).map((col: any, offsetIdx: number) => {
                                            const actualColIdx = firstSumColIdx + offsetIdx;
                                            const colSumData = columnsWithSummaries.find(c => c.colIdx === actualColIdx);
                                            const targetRow = colSumData ? (colSumData.rowMap.get(sumType.id) || Array.from(colSumData.rowMap.values()).find((r: any) => r.label === sumType.label)) : null;
                                            const isLabelColIfFirst = actualColIdx === 0 && firstSumColIdx === 0;

                                            if (!targetRow) {
                                              return (
                                                <td key={col.id} style={{
                                                  padding: '6px 8px',
                                                  borderRight: '1px solid #cbd5e1',
                                                  borderBottom: '1px solid #cbd5e1',
                                                  fontSize: '0.8rem'
                                                }}>
                                                  {isLabelColIfFirst ? sumType.label : ''}
                                                </td>
                                              );
                                            }

                                            const dummyVal = getDummySummaryVal(col, targetRow);
                                            const isManual = targetRow.type === 'manual';
                                            const displayStr = isManual ? '[Người điền tự nhập]' : dummyVal.toLocaleString('vi-VN');

                                            return (
                                              <td key={col.id} style={{
                                                padding: '6px 8px',
                                                borderRight: '1px solid #cbd5e1',
                                                borderBottom: '1px solid #cbd5e1',
                                                textAlign: 'right',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.8rem'
                                              }}>
                                                {displayStr}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tfoot>
                                );
                              })()}
                            </table>
                          </div>
                          {!isLocked && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '0.5rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setLayoutBlocks(prev => prev.map(b => {
                                    if (b.id === block.id) {
                                      const nextRowId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                                      const updatedRows = [...(b.tableRows || []), { id: nextRowId, lineCount: 1, isGroupHeader: false }];
                                      
                                      // Prepopulate STT if first column is static_text
                                      const updatedData = { ...b.tableData || {} };
                                      const firstCol = b.tableColumns?.[0];
                                      if (firstCol && firstCol.type === 'static_text') {
                                        const normalRows = updatedRows.filter(r => !r.isGroupHeader);
                                        updatedData[nextRowId] = {
                                          ...updatedData[nextRowId] || {},
                                          [firstCol.id]: String(normalRows.length)
                                        };
                                      }
                                      return { ...b, tableRows: updatedRows, tableData: updatedData };
                                    }
                                    return b;
                                  }));
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                              >
                                + Thêm dòng
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLayoutBlocks(prev => prev.map(b => {
                                    if (b.id === block.id) {
                                      const nextRowId = `row_grp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                                      const groupHeaderCount = (b.tableRows || []).filter(r => r.isGroupHeader).length + 1;
                                      const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
                                      const roman = romanNumerals[groupHeaderCount - 1] || `${groupHeaderCount}`;
                                      const defaultGroupTitle = `${roman}. `;
                                      const updatedRows = [...(b.tableRows || []), { id: nextRowId, isGroupHeader: true, groupTitle: defaultGroupTitle }];
                                      const updatedData = { ...b.tableData || {} };
                                      updatedData[nextRowId] = { _groupTitle: defaultGroupTitle };
                                      return { ...b, tableRows: updatedRows, tableData: updatedData };
                                    }
                                    return b;
                                  }));
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: '#f1f5f9', border: '1px dashed #94a3b8' }}
                              >
                                + Hàng phân nhóm
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                      {/* 4. SIGN BLOCK */}
                      {block.type === 'SIGN' && (() => {
                        return (
                          <div>
                            <InCanvasTitleHeader
                              block={block}
                              isLocked={isLocked}
                              isBlockSelected={isBlockSelected}
                              onUpdateTitle={(val) => handleUpdateBlockTitle(block.id, val)}
                              onUpdateTitleFormat={(fmt) => handleUpdateBlockTitleFormat(block.id, fmt)}
                              onSelectBlock={() => {
                                setActiveBlockId(block.id);
                                setActiveFieldId(null);
                              }}
                            />
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
                            gap: '1rem'
                          }}>
                            {block.fields.map(f => {
                              const isFieldSelected = activeFieldId === f.id;
                              return (
                                <div 
                                  key={f.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBlockId(block.id);
                                    setActiveFieldId(f.id);
                                  }}
                                  style={{
                                    border: isFieldSelected ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '0.5rem',
                                    textAlign: 'center',
                                    background: isFieldSelected ? 'rgba(16, 163, 163, 0.05)' : '#f8fafc',
                                    position: 'relative'
                                  }}
                                >
                                  {isFieldSelected && !isLocked && (
                                    <div style={{ position: 'absolute', right: '4px', top: '4px', display: 'flex', gap: '2px' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveField(block.id, f.id, 'up');
                                        }}
                                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '1px 2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                                        title="Di chuyển sang trái / lên"
                                      >
                                        <ArrowUp size={10} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMoveField(block.id, f.id, 'down');
                                        }}
                                        style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '1px 2px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                                        title="Di chuyển sang phải / xuống"
                                      >
                                        <ArrowDown size={10} />
                                      </button>
                                    </div>
                                  )}
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {f.checkItem}
                                  </div>
                                  <div style={{ fontSize: '0.65rem', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                    {f.reactionProtocol ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`) : '(Ký và ghi rõ họ tên)'}
                                  </div>
                                  <div style={{ height: '36px' }} />
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px dotted #cbd5e1', paddingTop: '4px', width: '80%', margin: '0 auto' }}>
                                    Họ và tên
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    </div>
                  </div>
                );
              })
            )}

            {/* Static layout-driven footer matching paper printouts */}
            <div style={{
              marginTop: 'auto',
              borderTop: '1px solid #334155',
              paddingTop: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace'
            }}>
              <span>{formId || 'PENDING'}</span>
              <span>{formatFormVersion(version, status, status === 'ACTIVE' ? effectiveDate : undefined, initialData?.updatedAt || (initialData as any)?.updated_at || new Date().toISOString())}</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Properties Configuration Panel */}
        <div style={{ background: '#ffffff', borderLeft: '1px solid var(--neutral-border)', padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Tab Switcher */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--neutral-border)',
            marginBottom: '0.25rem',
            paddingBottom: '2px',
            gap: '0.5rem'
          }}>
            <button
              type="button"
              onClick={() => setRightTab('properties')}
              style={{
                flex: 1,
                padding: '0.45rem 0.25rem',
                fontSize: '0.78rem',
                fontWeight: rightTab === 'properties' ? 700 : 500,
                color: rightTab === 'properties' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                background: 'none',
                borderBottom: rightTab === 'properties' ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'center'
              }}
            >
              Properties
            </button>
            <button
              type="button"
              onClick={() => setRightTab('versions')}
              style={{
                flex: 1,
                padding: '0.45rem 0.25rem',
                fontSize: '0.78rem',
                fontWeight: rightTab === 'versions' ? 700 : 500,
                color: rightTab === 'versions' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                background: 'none',
                borderBottom: rightTab === 'versions' ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'center'
              }}
            >
              Versions
            </button>
          </div>

          {rightTab === 'properties' ? (
            activeField ? (
            /* FIELD PROPERTIES */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  Field Properties
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {(() => {
                    const activeBlockObj = layoutBlocks.find(b => b.id === activeBlockId);
                    if (!activeBlockObj || isLocked) return null;
                    const fieldIdx = activeBlockObj.fields.findIndex(f => f.id === activeFieldId);
                    if (fieldIdx === -1) return null;
                    const isFirst = fieldIdx === 0;
                    const isLast = fieldIdx === activeBlockObj.fields.length - 1;
                    return (
                      <div style={{ display: 'flex', gap: '2px', marginRight: '4px' }}>
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => handleMoveField(activeBlockId!, activeFieldId!, 'up')}
                          style={{ width: '22px', height: '22px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isFirst ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isFirst ? 0.3 : 1, padding: 0 }}
                          title="Di chuyển trường lên"
                        >
                          <ArrowUp size={12} style={{ color: '#0f172a' }} />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => handleMoveField(activeBlockId!, activeFieldId!, 'down')}
                          style={{ width: '22px', height: '22px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLast ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLast ? 0.3 : 1, padding: 0 }}
                          title="Di chuyển trường xuống"
                        >
                          <ArrowDown size={12} style={{ color: '#0f172a' }} />
                        </button>
                      </div>
                    );
                  })()}
                  <button 
                    type="button" 
                    disabled={isLocked}
                    onClick={() => handleDeleteField(activeBlockId!, activeFieldId!)}
                    style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                    title="Xóa trường này"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                
                {/* Field ID (Mã định danh trường) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      ID
                    </label>
                    <button
                      type="button"
                      title="Tự động tạo lại ID sạch từ tiêu đề trường"
                      disabled={isLocked}
                      onClick={() => {
                        const otherIds = layoutBlocks
                          .flatMap(b => (b.fields || []).map(f => f.id))
                          .filter(id => id !== activeField.id);
                        const autoSlug = generateSmartFieldSlug(activeField.checkItem, otherIds, activeField.type);
                        handleUpdateField(activeBlockId!, activeFieldId!, { id: autoSlug });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.68rem',
                        color: 'var(--primary)',
                        background: 'none',
                        border: 'none',
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        padding: '0 2px'
                      }}
                    >
                      <Sparkles size={11} /> Tự động
                    </button>
                  </div>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={activeField.id}
                    onChange={(e) => {
                      const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                      handleUpdateField(activeBlockId!, activeFieldId!, { id: sanitized });
                    }}
                    placeholder="e.g. ten_doanh_nghiep"
                    style={{
                      padding: '0.35rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--neutral-border)',
                      fontFamily: 'monospace',
                      fontSize: '0.78rem',
                      background: isLocked ? '#f8fafc' : '#ffffff'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Label</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        title="In đậm (Ctrl+B)"
                        disabled={isLocked}
                        onClick={() => applyTextFormat(inspectorLabelRef.current, 'bold', activeField.checkItem, (val) => handleUpdateField(activeBlockId!, activeFieldId!, { checkItem: val }))}
                        style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontWeight: 'bold', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        title="In nghiêng (Ctrl+I)"
                        disabled={isLocked}
                        onClick={() => applyTextFormat(inspectorLabelRef.current, 'italic', activeField.checkItem, (val) => handleUpdateField(activeBlockId!, activeFieldId!, { checkItem: val }))}
                        style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontStyle: 'italic', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        I
                      </button>
                      <button
                        type="button"
                        title="Gạch chân (Ctrl+U)"
                        disabled={isLocked}
                        onClick={() => applyTextFormat(inspectorLabelRef.current, 'underline', activeField.checkItem, (val) => handleUpdateField(activeBlockId!, activeFieldId!, { checkItem: val }))}
                        style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', textDecoration: 'underline', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        U
                      </button>
                    </div>
                  </div>
                  <textarea
                    ref={inspectorLabelRef}
                    rows={activeField.type === 'label' ? 3 : 2}
                    disabled={isLocked}
                    value={activeField.checkItem}
                    onKeyDown={(e) => handleFormatKeyDown(e, activeField.checkItem, (val) => handleUpdateField(activeBlockId!, activeFieldId!, { checkItem: val }))}
                    onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { checkItem: e.target.value })}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', resize: 'vertical', fontSize: '0.8rem', fontFamily: 'inherit', lineHeight: 1.4 }}
                  />
                </div>

                {activeField.type === 'photo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Văn bản gợi ý trong ô (Placeholder Text)</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={activeField.placeholder ?? ''}
                      onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { placeholder: e.target.value })}
                      placeholder="Ví dụ: [photo]"
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Chữ này hiển thị căn giữa bên trong khung nét đứt. Nếu để trống sẽ hiển thị ô trắng.</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', minWidth: '40px' }}>Type</label>
                  <div style={{ flex: 1 }}>
                    <FieldTypeDropdown
                      disabled={isLocked}
                      value={activeField.type}
                      onChange={(newType) => handleChangeFieldType(activeBlockId!, activeFieldId!, newType)}
                    />
                  </div>
                </div>

                {(activeField.type === 'likert_scale' || (activeField.type as any) === 'rating') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontWeight: 600, fontSize: '0.75rem', color: '#0f172a' }}>Display Variant</label>
                      <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { likertVariant: 'scale' })}
                          style={{
                            flex: 1,
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: 'none',
                            background: (activeField.likertVariant || 'scale') === 'scale' && (activeField.type as any) !== 'rating' ? '#ffffff' : 'transparent',
                            color: (activeField.likertVariant || 'scale') === 'scale' && (activeField.type as any) !== 'rating' ? '#0f172a' : '#64748b',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            cursor: isLocked ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            boxShadow: (activeField.likertVariant || 'scale') === 'scale' && (activeField.type as any) !== 'rating' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                          }}
                        >
                          <SlidersHorizontal size={12} />
                          Linear Scale
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { likertVariant: 'stars' })}
                          style={{
                            flex: 1,
                            padding: '3px 6px',
                            borderRadius: '4px',
                            border: 'none',
                            background: activeField.likertVariant === 'stars' || (activeField.type as any) === 'rating' ? '#ffffff' : 'transparent',
                            color: activeField.likertVariant === 'stars' || (activeField.type as any) === 'rating' ? '#0f172a' : '#64748b',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                            cursor: isLocked ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            boxShadow: activeField.likertVariant === 'stars' || (activeField.type as any) === 'rating' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                          }}
                        >
                          <Star size={12} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
                          Stars
                        </button>
                      </div>
                    </div>

                    {activeField.likertVariant === 'stars' || (activeField.type as any) === 'rating' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rating Scale</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { ratingScale: 5 })}
                            style={{
                              flex: 1,
                              padding: '0.35rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: (activeField.ratingScale || 5) === 5 ? 'var(--primary)' : '#ffffff',
                              color: (activeField.ratingScale || 5) === 5 ? '#ffffff' : 'var(--text-primary)',
                              cursor: isLocked ? 'default' : 'pointer',
                              fontWeight: 600,
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <Star size={12} style={{ fill: (activeField.ratingScale || 5) === 5 ? '#ffffff' : '#f59e0b', color: (activeField.ratingScale || 5) === 5 ? '#ffffff' : '#f59e0b' }} />
                            5 Stars
                          </button>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { ratingScale: 3 })}
                            style={{
                              flex: 1,
                              padding: '0.35rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: activeField.ratingScale === 3 ? 'var(--primary)' : '#ffffff',
                              color: activeField.ratingScale === 3 ? '#ffffff' : 'var(--text-primary)',
                              cursor: isLocked ? 'default' : 'pointer',
                              fontWeight: 600,
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <Star size={12} style={{ fill: activeField.ratingScale === 3 ? '#ffffff' : '#f59e0b', color: activeField.ratingScale === 3 ? '#ffffff' : '#f59e0b' }} />
                            3 Stars
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mẫu thang đo nhanh (Presets)</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: ['1', '2', '3', '4', '5'] })}
                              style={{ padding: '2px 6px', fontSize: '0.68rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer' }}
                            >
                              1 – 5
                            </button>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: ['1', '2', '3'] })}
                              style={{ padding: '2px 6px', fontSize: '0.68rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer' }}
                            >
                              1 – 3
                            </button>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: ['Kém', 'Đạt', 'Tốt'] })}
                              style={{ padding: '2px 6px', fontSize: '0.68rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer' }}
                            >
                              3 Mức
                            </button>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: ['Rất kém', 'Kém', 'Đạt', 'Tốt', 'Xuất sắc'] })}
                              style={{ padding: '2px 6px', fontSize: '0.68rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer' }}
                            >
                              5 Mức
                            </button>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: ['Không đạt', 'Đạt'] })}
                              style={{ padding: '2px 6px', fontSize: '0.68rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer' }}
                            >
                              Đạt / KĐ
                            </button>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '2px 0' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mức độ thang đo (Scale Options)</label>
                          {(activeField.scaleOptions || ['1', '2', '3', '4', '5']).map((opt, sIdx) => (
                            <div key={sIdx} style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.68rem', color: '#64748b', width: '14px', textAlign: 'center' }}>{sIdx + 1}.</span>
                              <input
                                type="text"
                                disabled={isLocked}
                                placeholder={`Mức ${sIdx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const currentScales = activeField.scaleOptions || ['1', '2', '3', '4', '5'];
                                  const newScales = [...currentScales];
                                  newScales[sIdx] = e.target.value;
                                  handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: newScales });
                                }}
                                style={{ flex: 1, padding: '0.15rem 0.25rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.7rem' }}
                              />
                              <button
                                type="button"
                                disabled={isLocked || (activeField.scaleOptions || []).length <= 2}
                                onClick={() => {
                                  const currentScales = activeField.scaleOptions || ['1', '2', '3', '4', '5'];
                                  const newScales = currentScales.filter((_, i) => i !== sIdx);
                                  handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: newScales });
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: isLocked || (activeField.scaleOptions || []).length <= 2 ? 'not-allowed' : 'pointer', padding: '0 2px', fontSize: '0.75rem', lineHeight: 1, opacity: isLocked || (activeField.scaleOptions || []).length <= 2 ? 0.3 : 1 }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>

                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => {
                              const currentScales = activeField.scaleOptions || ['1', '2', '3', '4', '5'];
                              const newScales = [...currentScales, `Mức ${currentScales.length + 1}`];
                              handleUpdateField(activeBlockId!, activeFieldId!, { scaleOptions: newScales });
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0.2rem 0.4rem', fontSize: '0.68rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}
                          >
                            <Plus size={10} /> Thêm mức độ
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeField.type === 'photo' && activeBlock?.type === 'INFO_GRID' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#f8fafc' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#0f172a' }}>Cấu hình Kích thước Ảnh (INFO_GRID)</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Chiều cao (Số dòng - rowSpan)</label>
                      <select
                        disabled={isLocked}
                        value={activeField.rowSpan || 3}
                        onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { rowSpan: parseInt(e.target.value, 10) })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', background: '#fff', fontSize: '0.75rem' }}
                      >
                        <option value={1}>1 dòng</option>
                        <option value={2}>2 dòng</option>
                        <option value={3}>3 dòng</option>
                        <option value={4}>4 dòng</option>
                        <option value={5}>5 dòng</option>
                        <option value={6}>6 dòng</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Chiều rộng (Số cột - colSpan)</label>
                      <select
                        disabled={isLocked}
                        value={activeField.colSpan || 1}
                        onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { colSpan: parseInt(e.target.value, 10) })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', background: '#fff', fontSize: '0.75rem' }}
                      >
                        <option value={1}>1 cột</option>
                        <option value={-1}>Tràn toàn bộ dòng (Full width)</option>
                      </select>
                    </div>
                  </div>
                )}

                {activeField.type === 'time' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Chế độ chọn giờ</label>
                    <select
                      disabled={isLocked}
                      value={activeField.timeMode || 'single'}
                      onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { timeMode: e.target.value as any })}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', background: '#fff' }}
                    >
                      <option value="single">Một mốc giờ (Single)</option>
                      <option value="dual">Khoảng Từ - Đến (Dual)</option>
                    </select>
                  </div>
                )}

                {activeField.type === 'signature' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Ghi chú</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="Ký và ghi rõ họ tên"
                      value={activeField.reactionProtocol || ''}
                      onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { reactionProtocol: e.target.value })}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                    />
                  </div>
                )}

                {activeField.type === 'number' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontWeight: 600 }}>Min Spec</label>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={activeField.minSpec !== undefined && activeField.minSpec !== null ? activeField.minSpec : ''}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            handleUpdateField(activeBlockId!, activeFieldId!, { minSpec: val === '' ? undefined : (parseFloat(val) ?? undefined) });
                          }}
                          style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontWeight: 600 }}>Max Spec</label>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={activeField.maxSpec !== undefined && activeField.maxSpec !== null ? activeField.maxSpec : ''}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            handleUpdateField(activeBlockId!, activeFieldId!, { maxSpec: val === '' ? undefined : (parseFloat(val) ?? undefined) });
                          }}
                          style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600 }}>Unit</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeField.unit || ''}
                        onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { unit: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>
                  </>
                )}

                {activeField.type !== 'number' && activeBlock?.type === 'CHECKLIST_TABLE' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Tiêu chuẩn</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        placeholder="e.g. Đúng vị trí, không trầy xước"
                        value={activeField.targetRange || ''}
                        onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { targetRange: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Đơn vị</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        placeholder="e.g. oC, kg, mm"
                        value={activeField.unit || ''}
                        onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { unit: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>
                  </>
                )}

                {(activeField.type === 'radio' || activeField.type === 'checkbox') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Radio Options</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(activeField.options ?? DEFAULT_RADIO_OPTIONS).map((opt, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            disabled={isLocked}
                            placeholder="Nhãn"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(activeField.options ?? DEFAULT_RADIO_OPTIONS)];
                              newOpts[idx] = { ...newOpts[idx], label: e.target.value };
                              handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                            }}
                            style={{ flex: 2, padding: '0.2rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={opt.isPass}
                              onChange={(e) => {
                                const newOpts = [...(activeField.options ?? DEFAULT_RADIO_OPTIONS)];
                                newOpts[idx] = { ...newOpts[idx], isPass: e.target.checked };
                                handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                              }}
                            />
                            Đạt
                          </label>
                          <button
                            type="button"
                            disabled={isLocked || (activeField.options ?? DEFAULT_RADIO_OPTIONS).length <= 1}
                            onClick={() => {
                              const newOpts = (activeField.options ?? DEFAULT_RADIO_OPTIONS).filter((_, i) => i !== idx);
                              handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '0.8rem', lineHeight: 1 }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = [...(activeField.options ?? DEFAULT_RADIO_OPTIONS), { label: 'Lựa chọn mới', value: `OPT_${Date.now()}`, isPass: true }];
                          handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', } }
                      >
                        <Plus size={11} /> Thêm lựa chọn
                      </button>
                    )}
                  </div>
                )}

                {activeField.type === 'subtable' && (() => {
                  const stCols = activeField.subtableColumns ?? [];
                  const stSumOtherPercent = stCols.length > 1
                    ? stCols.slice(0, stCols.length - 1)
                        .filter(c => c.width && (c.width.endsWith('%') || !isNaN(parseFloat(c.width))))
                        .reduce((sum, c) => sum + parseFloat(c.width || '0'), 0)
                    : 0;
                  const stLastAdjusted = Math.max(0, 100 - stSumOtherPercent);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Cấu hình Cột</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {stCols.map((col, idx, arr) => {
                          const isLast = idx === arr.length - 1;
                          return (
                            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--neutral-border)', padding: '6px', borderRadius: '4px', background: '#f8fafc' }}>
                              {/* Hàng 1: Tên cột + Di chuyển (Up/Down) + Nút xóa */}
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  disabled={isLocked}
                                  value={col.label}
                                  placeholder="Tên cột"
                                  onChange={(e) => {
                                    const newCols = [...stCols];
                                    newCols[idx] = { ...newCols[idx], label: e.target.value };
                                    handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols });
                                  }}
                                  style={{ flex: 1, padding: '0.2rem 0.35rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                />
                                <button
                                  type="button"
                                  disabled={isLocked || idx === 0}
                                  onClick={() => {
                                    const newCols = [...stCols];
                                    const temp = newCols[idx - 1];
                                    newCols[idx - 1] = newCols[idx];
                                    newCols[idx] = temp;
                                    handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols });
                                  }}
                                  style={{ width: '24px', height: '24px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked || idx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLocked || idx === 0 ? 0.4 : 1, padding: 0 }}
                                  title="Di chuyển lên"
                                >
                                  <ArrowUp size={13} style={{ color: '#0f172a' }} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLocked || idx === arr.length - 1}
                                  onClick={() => {
                                    const newCols = [...stCols];
                                    const temp = newCols[idx + 1];
                                    newCols[idx + 1] = newCols[idx];
                                    newCols[idx] = temp;
                                    handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols });
                                  }}
                                  style={{ width: '24px', height: '24px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked || idx === arr.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLocked || idx === arr.length - 1 ? 0.4 : 1, padding: 0 }}
                                  title="Di chuyển xuống"
                                >
                                  <ArrowDown size={13} style={{ color: '#0f172a' }} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLocked || arr.length <= 1}
                                  onClick={() => {
                                    const newCols = stCols.filter((_, i) => i !== idx);
                                    handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols });
                                  }}
                                  style={{ width: '24px', height: '24px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked || arr.length <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLocked || arr.length <= 1 ? 0.4 : 1, padding: 0 }}
                                  title="Xóa cột"
                                >
                                  <Trash2 size={13} style={{ color: '#ef4444' }} />
                                </button>
                              </div>
                              {/* Hàng 2: Dropdown Kiểu + Nút Căn lề + Độ rộng */}
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <select
                                  disabled={isLocked}
                                  value={col.type}
                                  onChange={(e) => {
                                    const newCols = [...stCols];
                                    newCols[idx] = { ...newCols[idx], type: e.target.value as SubtableColumn['type'] };
                                    handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols });
                                  }}
                                  style={{ flex: 1.0, padding: '0.2rem 0.3rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem', background: '#fff' }}
                                >
                                  <option value="static_text">Nhãn</option>
                                  <option value="text">Chữ</option>
                                  <option value="number">Số</option>
                                  <option value="date">Ngày</option>
                                  <option value="time">Giờ</option>
                                </select>

                                {(() => {
                                  const currentHeaderAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'));
                                  return (
                                    <div style={{ display: 'flex', border: '1px solid var(--neutral-border)', borderRadius: '4px', overflow: 'hidden', flex: 0.6 }}>
                                      <button type="button" disabled={isLocked} onClick={() => { const newCols = [...stCols]; newCols[idx] = { ...newCols[idx], align: 'left' }; handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols }); }} style={{ flex: 1, padding: '2px', background: currentHeaderAlign === 'left' ? '#cbd5e1' : '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Canh trái"><AlignLeft size={12} style={{ color: currentHeaderAlign === 'left' ? 'var(--text-primary)' : 'var(--text-muted)' }} /></button>
                                      <button type="button" disabled={isLocked} onClick={() => { const newCols = [...stCols]; newCols[idx] = { ...newCols[idx], align: 'center' }; handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols }); }} style={{ flex: 1, padding: '2px', background: currentHeaderAlign === 'center' ? '#cbd5e1' : '#ffffff', borderLeft: '1px solid var(--neutral-border)', borderRight: '1px solid var(--neutral-border)', borderTop: 'none', borderBottom: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Canh giữa"><AlignCenter size={12} style={{ color: currentHeaderAlign === 'center' ? 'var(--text-primary)' : 'var(--text-muted)' }} /></button>
                                      <button type="button" disabled={isLocked} onClick={() => { const newCols = [...stCols]; newCols[idx] = { ...newCols[idx], align: 'right' }; handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols }); }} style={{ flex: 1, padding: '2px', background: currentHeaderAlign === 'right' ? '#cbd5e1' : '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Canh phải"><AlignRight size={12} style={{ color: currentHeaderAlign === 'right' ? 'var(--text-primary)' : 'var(--text-muted)' }} /></button>
                                    </div>
                                  );
                                })()}

                                <input
                                  type="text"
                                  disabled={isLocked || isLast}
                                  value={isLast ? `${stLastAdjusted}%` : (col.width || '')}
                                  placeholder="Width %"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const finalVal = /^\d+$/.test(val) ? `${val}%` : val;
                                    const newCols = [...stCols];
                                    newCols[idx] = { ...newCols[idx], width: finalVal };
                                    handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: newCols });
                                  }}
                                  style={{ flex: 0.6, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: isLast ? '#f1f5f9' : '#ffffff', color: isLast ? '#64748b' : 'inherit', cursor: isLast ? 'not-allowed' : 'text' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const newCol: SubtableColumn = { id: `stcol_${Date.now()}`, label: 'Cột mới', type: 'text', width: 'auto' };
                            handleUpdateField(activeBlockId!, activeFieldId!, { subtableColumns: [...stCols, newCol] });
                          }}
                          style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', background: '#ffffff', fontSize: '0.78rem', fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', color: 'var(--text-primary)' }}
                        >
                          + Thêm Cột Mới
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {(activeField.type === 'radio' || activeField.type === 'checkbox' || activeField.type === 'number') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Reaction Protocol (Out of Spec)</label>
                    <textarea
                      disabled={isLocked}
                      value={activeField.reactionProtocol}
                      onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { reactionProtocol: e.target.value })}
                      rows={3}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', resize: 'none' }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : activeBlock ? (
            /* BLOCK PROPERTIES */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  Section Settings
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button 
                    type="button" 
                    disabled={isLocked || activeBlock.type === 'TITLE'}
                    onClick={() => handleCloneBlock(activeBlockId!)}
                    style={{ border: 'none', background: 'none', color: (isLocked || activeBlock.type === 'TITLE') ? 'var(--text-muted)' : 'var(--text-secondary)', cursor: (isLocked || activeBlock.type === 'TITLE') ? 'not-allowed' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    title="Nhân bản khối này (Ctrl+D)"
                  >
                    <Copy size={14} />
                  </button>
                  <button 
                    type="button" 
                    disabled={isLocked || activeBlock.type === 'TITLE'}
                    onClick={() => handleDeleteBlock(activeBlockId!)}
                    style={{ border: 'none', background: 'none', color: (isLocked || activeBlock.type === 'TITLE') ? 'var(--text-muted)' : 'var(--danger)', cursor: (isLocked || activeBlock.type === 'TITLE') ? 'not-allowed' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                    title="Xóa khối"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>Title</label>
                    
                    {activeBlock.type !== 'TITLE' && (
                      <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '5px', border: '1px solid var(--neutral-border)' }}>
                        {(['H1', 'H2', 'BODY', 'NONE'] as const).map(fmt => {
                          const activeFmt = getEffectiveTitleFormat(activeBlock);
                          const isSelected = activeFmt === fmt;
                          const labelText = fmt === 'BODY' ? 'Body' : fmt === 'NONE' ? 'None' : fmt;
                          return (
                            <button
                              key={fmt}
                              type="button"
                              disabled={isLocked}
                              onClick={() => handleUpdateBlockTitleFormat(activeBlockId!, fmt)}
                              style={{
                                padding: '1px 6px',
                                fontSize: '0.68rem',
                                fontWeight: isSelected ? 700 : 500,
                                border: 'none',
                                borderRadius: '3px',
                                cursor: isLocked ? 'not-allowed' : 'pointer',
                                background: isSelected ? 'var(--primary)' : 'transparent',
                                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s ease',
                                lineHeight: '16px'
                              }}
                              title={`Định dạng tiêu đề: ${labelText}`}
                            >
                              {labelText}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={activeBlock.title}
                    onChange={(e) => handleUpdateBlockTitle(activeBlockId!, e.target.value)}
                    placeholder={getEffectiveTitleFormat(activeBlock) === 'NONE' ? '(Tiêu đề đang ẩn)' : 'Tiêu đề khối...'}
                    style={{
                      padding: '0.35rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--neutral-border)',
                      fontSize: '0.78rem',
                      opacity: getEffectiveTitleFormat(activeBlock) === 'NONE' ? 0.6 : 1,
                      backgroundColor: getEffectiveTitleFormat(activeBlock) === 'NONE' ? '#f8fafc' : '#ffffff'
                    }}
                  />
                </div>

                {activeBlock.type === 'TABLE' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '0.1rem', padding: '2px 0' }}>
                    {/* Border Option Group */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>Border</label>
                      <div style={{ display: 'flex', border: '1px solid var(--neutral-border)', borderRadius: '4px', overflow: 'hidden', height: '22px' }}>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleUpdateBlockBorderStyle(activeBlockId!, 'grid')}
                          style={{
                            padding: '0 6px',
                            background: (activeBlock.borderStyle || 'grid') === 'grid' ? '#cbd5e1' : '#ffffff',
                            border: 'none',
                            cursor: isLocked ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Lưới đầy đủ (Full Grid)"
                        >
                          <Grid size={12} style={{ color: (activeBlock.borderStyle || 'grid') === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleUpdateBlockBorderStyle(activeBlockId!, 'horizontal_only')}
                          style={{
                            padding: '0 6px',
                            background: activeBlock.borderStyle === 'horizontal_only' ? '#cbd5e1' : '#ffffff',
                            borderLeft: '1px solid var(--neutral-border)',
                            borderRight: '1px solid var(--neutral-border)',
                            borderTop: 'none',
                            borderBottom: 'none',
                            cursor: isLocked ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Chỉ đường ngang (Horizontal Only)"
                        >
                          <Rows2 size={12} style={{ color: activeBlock.borderStyle === 'horizontal_only' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleUpdateBlockBorderStyle(activeBlockId!, 'borderless')}
                          style={{
                            padding: '0 6px',
                            background: activeBlock.borderStyle === 'borderless' ? '#cbd5e1' : '#ffffff',
                            border: 'none',
                            cursor: isLocked ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Không viền (Borderless)"
                        >
                          <SquareDashed size={12} style={{ color: activeBlock.borderStyle === 'borderless' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                        </button>
                      </div>
                    </div>

                    {/* Header Minimalist Toggle Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', margin: 0 }}>Header</label>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleToggleBlockHideHeader(activeBlockId!)}
                        style={{
                          width: '32px',
                          height: '18px',
                          borderRadius: '9px',
                          background: activeBlock.hideHeader ? '#cbd5e1' : 'var(--primary)',
                          border: 'none',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          position: 'relative',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'background-color 0.2s ease',
                          outline: 'none'
                        }}
                        title={activeBlock.hideHeader ? 'Tiêu đề đang Tắt (Click để Bật)' : 'Tiêu đề đang Bật (Click để Tắt)'}
                      >
                        <span
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: '#ffffff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            transform: activeBlock.hideHeader ? 'translateX(0px)' : 'translateX(14px)',
                            transition: 'transform 0.2s ease',
                            display: 'block'
                          }}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {activeBlock.type === 'SECTION_LABEL' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Description</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          title="In đậm (Ctrl+B)"
                          disabled={isLocked}
                          onClick={() => applyTextFormat(sectionDescRef.current, 'bold', activeBlock.description || '', (val) => handleUpdateBlockDescription(activeBlockId!, val))}
                          style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontWeight: 'bold', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          title="In nghiêng (Ctrl+I)"
                          disabled={isLocked}
                          onClick={() => applyTextFormat(sectionDescRef.current, 'italic', activeBlock.description || '', (val) => handleUpdateBlockDescription(activeBlockId!, val))}
                          style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontStyle: 'italic', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          title="Gạch chân (Ctrl+U)"
                          disabled={isLocked}
                          onClick={() => applyTextFormat(sectionDescRef.current, 'underline', activeBlock.description || '', (val) => handleUpdateBlockDescription(activeBlockId!, val))}
                          style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', textDecoration: 'underline', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          U
                        </button>
                      </div>
                    </div>
                    <textarea
                      ref={sectionDescRef}
                      rows={4}
                      disabled={isLocked}
                      value={activeBlock.description || ''}
                      onKeyDown={(e) => handleFormatKeyDown(e, activeBlock.description || '', (val) => handleUpdateBlockDescription(activeBlockId!, val))}
                      onChange={(e) => handleUpdateBlockDescription(activeBlockId!, e.target.value)}
                      placeholder="Nhập mô tả hoặc hướng dẫn danh mục..."
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.8rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
                    />
                  </div>
                )}

                {activeBlock.type === 'TITLE' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Logo Image</label>
                      
                      {activeBlock.logo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {logoUrl ? (
                            <div style={{ padding: '0.5rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80px' }}>
                              <img src={logoUrl} alt="Logo preview" style={{ maxHeight: '65px', maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Loading logo preview...</div>
                          )}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleLogoRemove(activeBlockId!)}
                            className="btn btn-sm btn-secondary"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}
                          >
                            Remove Logo
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isLocked || isLogoUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleLogoUpload(activeBlockId!, file);
                            }}
                            style={{ display: 'none' }}
                            id="logo-file-uploader"
                          />
                          <label
                            htmlFor="logo-file-uploader"
                            style={{
                              padding: '0.5rem',
                              border: '2px dashed var(--neutral-border)',
                              borderRadius: '6px',
                              textAlign: 'center',
                              cursor: (isLocked || isLogoUploading) ? 'not-allowed' : 'pointer',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                              background: '#f8fafc',
                              display: 'block',
                              fontSize: '0.75rem',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {isLogoUploading ? 'Uploading Logo...' : '+ Upload Logo'}
                          </label>

                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => setShowLogoGallery(true)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
                          >
                            <span>Or Choose from Gallery</span>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeBlock.description || ''}
                        onChange={(e) => handleUpdateBlockDescription(activeBlockId!, e.target.value)}
                        placeholder="e.g. (kiểm tra trước khi load...)"
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={!!activeBlock.showDate}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setLayoutBlocks(prev => prev.map(b => b.id === activeBlock.id ? { ...b, showDate: val, datePosition: b.datePosition || 'B' } : b));
                          }}
                        />
                        Hiển thị ô "Ngày"
                      </label>
                      {activeBlock.showDate && (
                        <div style={{ display: 'flex', border: '1px solid var(--neutral-border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => setLayoutBlocks(prev => prev.map(b => b.id === activeBlock.id ? { ...b, datePosition: 'A' } : b))}
                            style={{ padding: '3px 6px', background: activeBlock.datePosition === 'A' ? '#cbd5e1' : '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Bên phải tiêu đề"
                          >
                            <AlignRight size={13} style={{ color: activeBlock.datePosition === 'A' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                          </button>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => setLayoutBlocks(prev => prev.map(b => b.id === activeBlock.id ? { ...b, datePosition: 'B' } : b))}
                            style={{ padding: '3px 6px', background: (activeBlock.datePosition || 'B') === 'B' ? '#cbd5e1' : '#ffffff', borderLeft: '1px solid var(--neutral-border)', borderTop: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Dưới mô tả (Giữa)"
                          >
                            <AlignCenter size={13} style={{ color: (activeBlock.datePosition || 'B') === 'B' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeBlock.type === 'CHECKLIST_TABLE' && (() => {
                  const clCols = getChecklistColumns(activeBlock, true);
                  const visibleCols = clCols.filter(c => !c.hidden);
                  const clSumOther = visibleCols.length > 1
                    ? visibleCols.slice(0, visibleCols.length - 1)
                        .filter(c => c.width && (c.width.endsWith('%') || !isNaN(parseFloat(c.width))))
                        .reduce((sum, c) => sum + parseFloat(c.width), 0)
                    : 0;
                  const clLastAdjusted = Math.max(0, 100 - clSumOther);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <div style={{
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        marginBottom: '0.25rem',
                        fontSize: '0.78rem',
                        color: '#c2410c'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>⚠️ Khối cũ (Retired Block)</div>
                        <div style={{ lineHeight: 1.4 }}>Khối <strong>CHECKLIST_TABLE</strong> đã ngưng hỗ trợ tạo mới. Bạn có thể tiếp tục sử dụng hoặc nâng cấp sang khối <strong>TABLE</strong> tiêu chuẩn.</div>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleConvertChecklistToTable(activeBlock.id)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            marginTop: '0.6rem',
                            width: '100%',
                            color: '#c2410c',
                            borderColor: '#fdba74',
                            background: '#ffffff',
                            fontWeight: 600,
                            justifyContent: 'center'
                          }}
                        >
                          ⚡ Chuyển đổi sang khối TABLE chuẩn
                        </button>
                      </div>

                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Cấu hình Cột</label>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
                        {clCols.map((col, cIdx, arr) => {
                          const isLast = cIdx === arr.length - 1;
                          const isLockedCol = !!col.locked;
                          return (
                            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: `1px solid ${isLockedCol ? '#e2e8f0' : 'var(--neutral-border)'}`, padding: '6px', borderRadius: '4px', background: isLockedCol ? '#f1f5f9' : '#f8fafc', opacity: col.hidden ? 0.6 : 1 }}>
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                {isLockedCol && (
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', padding: '1px 4px', background: '#e2e8f0', borderRadius: '3px', whiteSpace: 'nowrap' }}>🔒 Cố định</span>
                                )}
                                <input
                                  type="text"
                                  disabled={isLocked || isLockedCol}
                                  value={col.label}
                                  onChange={(e) => handleUpdateTableColumn(activeBlock.id, col.id, { label: e.target.value })}
                                  placeholder="Tên cột"
                                  style={{ flex: 1, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                />
                                <button
                                  type="button"
                                  disabled={isLocked || cIdx === 0 || isLockedCol}
                                  onClick={() => handleMoveColumn(activeBlock.id, col.id, 'left')}
                                  style={{ width: '24px', height: '24px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked || cIdx === 0 || isLockedCol ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLocked || cIdx === 0 || isLockedCol ? 0.4 : 1, padding: 0 }}
                                  title="Di chuyển lên"
                                >
                                  <ArrowUp size={13} style={{ color: '#0f172a' }} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLocked || cIdx === arr.length - 1 || isLockedCol}
                                  onClick={() => handleMoveColumn(activeBlock.id, col.id, 'right')}
                                  style={{ width: '24px', height: '24px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked || cIdx === arr.length - 1 || isLockedCol ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLocked || cIdx === arr.length - 1 || isLockedCol ? 0.4 : 1, padding: 0 }}
                                  title="Di chuyển xuống"
                                >
                                  <ArrowDown size={13} style={{ color: '#0f172a' }} />
                                </button>
                                {isLockedCol ? (
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { hidden: !col.hidden })}
                                    style={{ width: '24px', height: '24px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                                    title={col.hidden ? "Hiện cột" : "Ẩn cột"}
                                  >
                                    {col.hidden ? (
                                      <EyeOff size={13} style={{ color: '#ef4444' }} />
                                    ) : (
                                      <Eye size={13} style={{ color: 'var(--primary)' }} />
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isLocked || arr.length <= 1}
                                    onClick={() => handleDeleteColumn(activeBlock.id, col.id)}
                                    style={{ width: '24px', height: '24px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isLocked || arr.length <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isLocked || arr.length <= 1 ? 0.4 : 1, padding: 0 }}
                                    title="Xóa cột"
                                  >
                                    <Trash2 size={13} style={{ color: '#ef4444' }} />
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <select
                                  disabled={isLocked || isLockedCol}
                                  value={col.type}
                                  onChange={(e) => {
                                    const nextType = e.target.value as any;
                                    const updates: Partial<TableColumnConfig> = { type: nextType };
                                    if ((nextType === 'radio' || nextType === 'checkbox') && (!col.options || col.options.length === 0)) {
                                      updates.options = [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }];
                                    }
                                    handleUpdateTableColumn(activeBlock.id, col.id, updates);
                                  }}
                                  style={{ flex: 1.0, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: isLockedCol ? '#f1f5f9' : '#ffffff' }}
                                >
                                  <option value="text">Chữ</option>
                                  <option value="number">Số</option>
                                    <option value="checkbox">Checkbox</option>
                                    <option value="radio">Radio</option>
                                    <option value="date">Ngày</option>
                                    <option value="time">Giờ</option>
                                    <option value="static_text">Nhãn</option>
                                  </select>

                                  {(() => {
                                    const currentAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? 'center' : 'left'));
                                    return (
                                      <div style={{ display: 'flex', border: '1px solid var(--neutral-border)', borderRadius: '4px', overflow: 'hidden', flex: 0.6 }}>
                                        <button type="button" disabled={isLocked} onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { align: 'left' })} style={{ flex: 1, padding: '2px', background: currentAlign === 'left' ? '#cbd5e1' : '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Canh trái"><AlignLeft size={12} style={{ color: currentAlign === 'left' ? 'var(--text-primary)' : 'var(--text-muted)' }} /></button>
                                        <button type="button" disabled={isLocked} onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { align: 'center' })} style={{ flex: 1, padding: '2px', background: currentAlign === 'center' ? '#cbd5e1' : '#ffffff', borderLeft: '1px solid var(--neutral-border)', borderRight: '1px solid var(--neutral-border)', borderTop: 'none', borderBottom: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Canh giữa"><AlignCenter size={12} style={{ color: currentAlign === 'center' ? 'var(--text-primary)' : 'var(--text-muted)' }} /></button>
                                        <button type="button" disabled={isLocked} onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { align: 'right' })} style={{ flex: 1, padding: '2px', background: currentAlign === 'right' ? '#cbd5e1' : '#ffffff', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }} title="Canh phải"><AlignRight size={12} style={{ color: currentAlign === 'right' ? 'var(--text-primary)' : 'var(--text-muted)' }} /></button>
                                      </div>
                                    );
                                  })()}

                                  <input
                                    type="text"
                                    disabled={isLocked || isLast}
                                    value={isLast ? `${clLastAdjusted}%` : col.width}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const finalVal = /^\d+$/.test(val) ? `${val}%` : val;
                                      handleUpdateTableColumn(activeBlock.id, col.id, { width: finalVal });
                                    }}
                                    placeholder="Width %"
                                    style={{ flex: 0.6, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: isLast ? '#f1f5f9' : '#ffffff', color: isLast ? '#64748b' : 'inherit', cursor: isLast ? 'not-allowed' : 'text' }}
                                  />
                                </div>

                              {col.type === 'checkbox' && !isLockedCol && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem', padding: '0.4rem', borderTop: '1px dashed var(--neutral-border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {(col.options || []).map((opt, oIdx) => (
                                      <div key={oIdx} style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                        <input type="text" disabled={isLocked} placeholder="Nhãn" value={opt.label} onChange={(e) => { const newOpts = [...(col.options || [])]; newOpts[oIdx] = { ...newOpts[oIdx], label: e.target.value }; handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts }); }} style={{ flex: 1, padding: '0.15rem 0.25rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.7rem' }} />
                                        <button type="button" disabled={isLocked} onClick={() => { const newOpts = (col.options || []).filter((_, i) => i !== oIdx); handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts }); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '0.75rem', lineHeight: 1 }}>✕</button>
                                      </div>
                                    ))}
                                  </div>
                                  {!isLocked && (
                                    <button type="button" onClick={() => { const newOpts = [...(col.options || []), { label: 'Lựa chọn mới', value: `OPT_${Date.now()}`, isPass: true }]; handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts }); }} style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0.15rem 0.3rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
                                      <Plus size={10} /> Thêm lựa chọn
                                    </button>
                                  )}
                                </div>
                              )}

                              {col.type === 'radio' && !isLockedCol && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem', padding: '0.4rem', borderTop: '1px dashed var(--neutral-border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {(col.options || []).map((opt, oIdx) => (
                                      <div key={oIdx} style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                        <input type="text" disabled={isLocked} placeholder="Nhãn" value={opt.label} onChange={(e) => { const newOpts = [...(col.options || [])]; newOpts[oIdx] = { ...newOpts[oIdx], label: e.target.value }; handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts }); }} style={{ flex: 1, padding: '0.15rem 0.25rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.7rem' }} />
                                        <button type="button" disabled={isLocked} onClick={() => { const newOpts = (col.options || []).filter((_, i) => i !== oIdx); handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts }); }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '0.75rem', lineHeight: 1 }}>✕</button>
                                      </div>
                                    ))}
                                  </div>
                                  {!isLocked && (
                                    <button type="button" onClick={() => { const newOpts = [...(col.options || []), { label: 'Lựa chọn mới', value: `OPT_${Date.now()}`, isPass: true }]; handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts }); }} style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0.15rem 0.3rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
                                      <Plus size={10} /> Thêm lựa chọn
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleAddColumn(activeBlock.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Plus size={12} />
                        <span>Thêm Cột Mới</span>
                      </button>
                    </div>
                  );
                })()}

                {activeBlock.type === 'TABLE' && (() => {
                  const cols = activeBlock.tableColumns || [];
                  const sumOtherPercent = cols.length > 1
                    ? cols.slice(0, cols.length - 1)
                        .filter(c => c.width && (c.width.endsWith('%') || !isNaN(parseFloat(c.width))))
                        .reduce((sum, c) => sum + parseFloat(c.width), 0)
                    : 0;
                  const lastColAdjusted = Math.max(0, 100 - sumOtherPercent);

                  const activeGroupRow = (activeBlock.tableRows || []).find(r => `${r.id}_group` === activeCellKey);

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      {activeGroupRow && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.25rem' }}>
                          <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Cấu hình Dòng</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--neutral-border)', padding: '6px', borderRadius: '4px', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={activeGroupRow.groupTitle || activeBlock.tableData?.[activeGroupRow.id]?.['_groupTitle'] || ''}
                                placeholder="Tên phân nhóm..."
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLayoutBlocks(prev => prev.map(b => {
                                    if (b.id === activeBlock.id) {
                                      const updatedRows = (b.tableRows || []).map(r => r.id === activeGroupRow.id ? { ...r, groupTitle: val } : r);
                                      const updatedData = { ...b.tableData || {} };
                                      updatedData[activeGroupRow.id] = { ...updatedData[activeGroupRow.id] || {}, _groupTitle: val };
                                      return { ...b, tableRows: updatedRows, tableData: updatedData };
                                    }
                                    return b;
                                  }));
                                }}
                                style={{ flex: 1, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontWeight: 600 }}
                              />
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleMoveRow(activeBlock.id, activeGroupRow.id, 'up')}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  cursor: isLocked ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0
                                }}
                                title="Di chuyển lên"
                              >
                                <ArrowUp size={13} style={{ color: '#0f172a' }} />
                              </button>
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleMoveRow(activeBlock.id, activeGroupRow.id, 'down')}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  cursor: isLocked ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0
                                }}
                                title="Di chuyển xuống"
                              >
                                <ArrowDown size={13} style={{ color: '#0f172a' }} />
                              </button>
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => {
                                  setLayoutBlocks(prev => prev.map(b => {
                                    if (b.id === activeBlock.id) {
                                      const updatedRows = (b.tableRows || []).filter(r => r.id !== activeGroupRow.id);
                                      const updatedData = { ...b.tableData || {} };
                                      delete updatedData[activeGroupRow.id];
                                      return { ...b, tableRows: updatedRows, tableData: updatedData };
                                    }
                                    return b;
                                  }));
                                  setActiveCellKey(null);
                                }}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  cursor: isLocked ? 'not-allowed' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: 0
                                }}
                                title="Xóa phân nhóm"
                              >
                                <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                              </button>
                            </div>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => {
                                setLayoutBlocks(prev => prev.map(b => {
                                  if (b.id === activeBlock.id) {
                                    const updatedRows = (b.tableRows || []).map(r => r.id === activeGroupRow.id ? { ...r, isGroupHeader: false } : r);
                                    return { ...b, tableRows: updatedRows };
                                  }
                                  return b;
                                }));
                                setActiveCellKey(null);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem', fontSize: '0.68rem', marginTop: '2px' }}
                            >
                              🔄 Chuyển sang dòng dữ liệu thường
                            </button>
                          </div>
                        </div>
                      )}

                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Cấu hình Cột</label>
                      

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
                        {cols.map((col, cIdx, arr) => {
                          const isLast = cIdx === arr.length - 1;
                          return (
                            <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--neutral-border)', padding: '6px', borderRadius: '4px', background: '#f8fafc' }}>
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  disabled={isLocked}
                                  value={col.label}
                                  onChange={(e) => handleUpdateTableColumn(activeBlock.id, col.id, { label: e.target.value })}
                                  placeholder="Tên cột"
                                  style={{ flex: 1, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                />
                                
                                <button
                                  type="button"
                                  disabled={isLocked || cIdx === 0}
                                  onClick={() => handleMoveColumn(activeBlock.id, col.id, 'left')}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    cursor: isLocked || cIdx === 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isLocked || cIdx === 0 ? 0.4 : 1,
                                    padding: 0
                                  }}
                                  title="Di chuyển lên"
                                >
                                  <ArrowUp size={13} style={{ color: '#0f172a' }} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLocked || cIdx === arr.length - 1}
                                  onClick={() => handleMoveColumn(activeBlock.id, col.id, 'right')}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    cursor: isLocked || cIdx === arr.length - 1 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isLocked || cIdx === arr.length - 1 ? 0.4 : 1,
                                    padding: 0
                                  }}
                                  title="Di chuyển xuống"
                                >
                                  <ArrowDown size={13} style={{ color: '#0f172a' }} />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLocked || arr.length <= 1}
                                  onClick={() => handleDeleteColumn(activeBlock.id, col.id)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    cursor: isLocked || arr.length <= 1 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: isLocked || arr.length <= 1 ? 0.4 : 1,
                                    padding: 0
                                  }}
                                  title="Xóa cột"
                                >
                                  <Trash2 size={13} style={{ color: '#ef4444' }} />
                                </button>
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <select
                                  disabled={isLocked}
                                  value={col.type}
                                  onChange={(e) => {
                                    const nextType = e.target.value as any;
                                    const updates: Partial<TableColumnConfig> = { type: nextType };
                                    if ((nextType === 'radio' || nextType === 'checkbox') && (!col.options || col.options.length === 0)) {
                                      updates.options = [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }];
                                    }
                                    if (nextType === 'rating') {
                                      updates.ratingScale = col.ratingScale || 5;
                                      updates.align = 'center';
                                    }
                                    if (nextType === 'likert_scale') {
                                      updates.scaleOptions = col.scaleOptions && col.scaleOptions.length > 0 ? col.scaleOptions : ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                      updates.align = 'center';
                                    }
                                    handleUpdateTableColumn(activeBlock.id, col.id, updates);
                                  }}
                                  style={{ flex: 1.0, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                >
                                  <option value="text">Chữ</option>
                                  <option value="number">Số</option>
                                  <option value="checkbox">Checkbox</option>
                                  <option value="radio">Radio</option>
                                  <option value="rating">Đánh giá sao</option>
                                  <option value="likert_scale">Scale</option>
                                  <option value="date">Ngày</option>
                                  <option value="time">Giờ</option>
                                </select>
                                
                                {(() => {
                                  const currentAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' || col.type === 'rating' || col.type === 'likert_scale' ? 'center' : 'left'));
                                  return (
                                    <div style={{ display: 'flex', border: '1px solid var(--neutral-border)', borderRadius: '4px', overflow: 'hidden', flex: 0.6 }}>
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { align: 'left' })}
                                        style={{
                                          flex: 1,
                                          padding: '2px',
                                          background: currentAlign === 'left' ? '#cbd5e1' : '#ffffff',
                                          border: 'none',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          justifyContent: 'center',
                                          alignItems: 'center'
                                        }}
                                        title="Canh trái"
                                      >
                                        <AlignLeft size={12} style={{ color: currentAlign === 'left' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { align: 'center' })}
                                        style={{
                                          flex: 1,
                                          padding: '2px',
                                          background: currentAlign === 'center' ? '#cbd5e1' : '#ffffff',
                                          borderLeft: '1px solid var(--neutral-border)',
                                          borderRight: '1px solid var(--neutral-border)',
                                          borderTop: 'none',
                                          borderBottom: 'none',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          justifyContent: 'center',
                                          alignItems: 'center'
                                        }}
                                        title="Canh giữa"
                                      >
                                        <AlignCenter size={12} style={{ color: currentAlign === 'center' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { align: 'right' })}
                                        style={{
                                          flex: 1,
                                          padding: '2px',
                                          background: currentAlign === 'right' ? '#cbd5e1' : '#ffffff',
                                          border: 'none',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          justifyContent: 'center',
                                          alignItems: 'center'
                                        }}
                                        title="Canh phải"
                                      >
                                        <AlignRight size={12} style={{ color: currentAlign === 'right' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                                      </button>
                                    </div>
                                  );
                                })()}

                                <input
                                  type="text"
                                  disabled={isLocked || isLast}
                                  value={isLast ? `${lastColAdjusted}%` : col.width}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    // Auto-append % if only digits are typed
                                    const finalVal = /^\d+$/.test(val) ? `${val}%` : val;
                                    handleUpdateTableColumn(activeBlock.id, col.id, { width: finalVal });
                                  }}
                                  placeholder="Width % or px"
                                  style={{ flex: 0.6, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: isLast ? '#f1f5f9' : '#ffffff', color: isLast ? '#64748b' : 'inherit', cursor: isLast ? 'not-allowed' : 'text' }}
                                />
                              </div>
                              {col.type === 'rating' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem', padding: '0.4rem', borderTop: '1px dashed var(--neutral-border)' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Thang điểm (Rating Scale)</label>
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { ratingScale: 5 })}
                                      style={{
                                        flex: 1,
                                        padding: '0.25rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--neutral-border)',
                                        background: (col.ratingScale || 5) === 5 ? 'var(--primary)' : '#ffffff',
                                        color: (col.ratingScale || 5) === 5 ? '#ffffff' : 'var(--text-primary)',
                                        cursor: isLocked ? 'default' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <Star size={11} style={{ fill: (col.ratingScale || 5) === 5 ? '#ffffff' : '#f59e0b', color: (col.ratingScale || 5) === 5 ? '#ffffff' : '#f59e0b' }} />
                                      Scale 5 (5 Sao)
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { ratingScale: 3 })}
                                      style={{
                                        flex: 1,
                                        padding: '0.25rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--neutral-border)',
                                        background: col.ratingScale === 3 ? 'var(--primary)' : '#ffffff',
                                        color: col.ratingScale === 3 ? '#ffffff' : 'var(--text-primary)',
                                        cursor: isLocked ? 'default' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.7rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <Star size={11} style={{ fill: col.ratingScale === 3 ? '#ffffff' : '#f59e0b', color: col.ratingScale === 3 ? '#ffffff' : '#f59e0b' }} />
                                      Scale 3 (3 Sao)
                                    </button>
                                  </div>
                                </div>
                              )}
                              {col.type === 'likert_scale' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem', padding: '0.4rem', borderTop: '1px dashed var(--neutral-border)' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mức độ thang đo (Scale Options)</label>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {(col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer']).map((opt, sIdx) => (
                                      <div key={sIdx} style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          placeholder={`Mức ${sIdx + 1}`}
                                          value={opt}
                                          onChange={(e) => {
                                            const currentScales = col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                            const newScales = [...currentScales];
                                            newScales[sIdx] = e.target.value;
                                            handleUpdateTableColumn(activeBlock.id, col.id, { scaleOptions: newScales });
                                          }}
                                          style={{ flex: 1, padding: '0.15rem 0.25rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.7rem' }}
                                        />
                                        <button
                                          type="button"
                                          disabled={isLocked || (col.scaleOptions || []).length <= 2}
                                          onClick={() => {
                                            const currentScales = col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                            const newScales = currentScales.filter((_, i) => i !== sIdx);
                                            handleUpdateTableColumn(activeBlock.id, col.id, { scaleOptions: newScales });
                                          }}
                                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: isLocked || (col.scaleOptions || []).length <= 2 ? 'not-allowed' : 'pointer', padding: '0 2px', fontSize: '0.75rem', lineHeight: 1, opacity: isLocked || (col.scaleOptions || []).length <= 2 ? 0.3 : 1 }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  {!isLocked && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentScales = col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                        const newScales = [...currentScales, `Mức ${currentScales.length + 1}`];
                                        handleUpdateTableColumn(activeBlock.id, col.id, { scaleOptions: newScales });
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0.15rem 0.3rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}
                                    >
                                      <Plus size={10} /> Thêm mức độ
                                    </button>
                                  )}
                                </div>
                              )}
                              {(col.type === 'checkbox' || col.type === 'radio') && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem', padding: '0.4rem', borderTop: '1px dashed var(--neutral-border)' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    {(col.options || []).map((opt, oIdx) => (
                                      <div key={oIdx} style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                        <input
                                          type="text"
                                          disabled={isLocked}
                                          placeholder="Nhãn"
                                          value={opt.label}
                                          onChange={(e) => {
                                            const newOpts = [...(col.options || [])];
                                            newOpts[oIdx] = { ...newOpts[oIdx], label: e.target.value };
                                            handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts });
                                          }}
                                          style={{ flex: 1, padding: '0.15rem 0.25rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.7rem' }}
                                        />
                                        <button
                                          type="button"
                                          disabled={isLocked}
                                          onClick={() => {
                                            const newOpts = (col.options || []).filter((_, i) => i !== oIdx);
                                            handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts });
                                          }}
                                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '0.75rem', lineHeight: 1 }}
                                        >✕</button>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                                    {!isLocked && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newOpts = [...(col.options || []), { label: 'Lựa chọn mới', value: `OPT_${Date.now()}`, isPass: true }];
                                          handleUpdateTableColumn(activeBlock.id, col.id, { options: newOpts });
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0.15rem 0.3rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}
                                      >
                                        <Plus size={10} /> Thêm lựa chọn
                                      </button>
                                    )}
                                    <div style={{ display: 'flex', border: '1px solid var(--neutral-border)', borderRadius: '4px', overflow: 'hidden', marginLeft: 'auto' }}>
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { checkboxLayout: '1-column' })}
                                        style={{
                                          padding: '2px 8px',
                                          background: (col.checkboxLayout || '1-column') === '1-column' ? '#cbd5e1' : '#ffffff',
                                          border: 'none',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                        title="1 Cột (Xếp dọc)"
                                      >
                                        <Rows2 size={12} style={{ color: (col.checkboxLayout || '1-column') === '1-column' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => handleUpdateTableColumn(activeBlock.id, col.id, { checkboxLayout: '2-column' })}
                                        style={{
                                          padding: '2px 8px',
                                          background: col.checkboxLayout === '2-column' ? '#cbd5e1' : '#ffffff',
                                          borderLeft: '1px solid var(--neutral-border)',
                                          borderRight: 'none',
                                          borderTop: 'none',
                                          borderBottom: 'none',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                        title="2 Cột (Song song)"
                                      >
                                        <Columns2 size={12} style={{ color: col.checkboxLayout === '2-column' ? 'var(--text-primary)' : 'var(--text-muted)' }} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {col.type === 'number' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem', padding: '0.4rem', borderTop: '1px dashed var(--neutral-border)' }}>
                                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Hàng cộng chân bảng (Summary)</label>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {(col.summaryRows || []).map((row, sIdx) => (
                                      <div key={row.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', border: '1px solid #cbd5e1', padding: '4px', borderRadius: '4px', background: '#ffffff' }}>
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            placeholder="Tiêu đề hàng cộng"
                                            value={row.label}
                                            onChange={(e) => {
                                              const nextRows = [...(col.summaryRows || [])];
                                              nextRows[sIdx] = { ...nextRows[sIdx], label: e.target.value };
                                              handleUpdateTableColumn(activeBlock.id, col.id, { summaryRows: nextRows });
                                            }}
                                            style={{ flex: 1, padding: '0.15rem 0.25rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                          />
                                          <button
                                            type="button"
                                            disabled={isLocked}
                                            onClick={() => {
                                              const nextRows = (col.summaryRows || []).filter(r => r.id !== row.id);
                                              handleUpdateTableColumn(activeBlock.id, col.id, { summaryRows: nextRows });
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '0.75rem', lineHeight: 1 }}
                                          >✕</button>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                          <select
                                            disabled={isLocked}
                                            value={row.type}
                                            onChange={(e) => {
                                              const nextRows = [...(col.summaryRows || [])];
                                              nextRows[sIdx] = { ...nextRows[sIdx], type: e.target.value as any };
                                              handleUpdateTableColumn(activeBlock.id, col.id, { summaryRows: nextRows });
                                            }}
                                            style={{ flex: 1, padding: '0.15rem 0.25rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                          >
                                            <option value="sum">Tổng cột (Sum)</option>
                                            <option value="manual">Nhập thủ công</option>
                                            <option value="percentage">Phần trăm (%)</option>
                                            <option value="sum_all">Tổng hàng khác</option>
                                          </select>
                                        </div>

                                        {row.type === 'percentage' && (
                                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                            <input
                                              type="number"
                                              placeholder="%"
                                              disabled={isLocked}
                                              value={row.percentageValue || ''}
                                              onChange={(e) => {
                                                const nextRows = [...(col.summaryRows || [])];
                                                nextRows[sIdx] = { ...nextRows[sIdx], percentageValue: parseFloat(e.target.value) || 0 };
                                                handleUpdateTableColumn(activeBlock.id, col.id, { summaryRows: nextRows });
                                              }}
                                              style={{ width: '45px', padding: '0.15rem 0.25rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                            />
                                            <span style={{ fontSize: '0.65rem' }}>% của</span>
                                            <select
                                              disabled={isLocked}
                                              value={row.percentageOfId || ''}
                                              onChange={(e) => {
                                                const nextRows = [...(col.summaryRows || [])];
                                                nextRows[sIdx] = { ...nextRows[sIdx], percentageOfId: e.target.value };
                                                handleUpdateTableColumn(activeBlock.id, col.id, { summaryRows: nextRows });
                                              }}
                                              style={{ flex: 1, padding: '0.15rem 0.25rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                                            >
                                              <option value="">-- Hàng cộng --</option>
                                              {(col.summaryRows || []).slice(0, sIdx).map(r => (
                                                <option key={r.id} value={r.id}>{r.label || 'Không tên'}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )}

                                        {row.type === 'sum_all' && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Chọn hàng cộng/trừ:</span>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                              {(col.summaryRows || []).slice(0, sIdx).map(r => {
                                                const isIncluded = (row.sumRowIds || []).includes(r.id);
                                                return (
                                                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem', cursor: 'pointer' }}>
                                                    <input
                                                      type="checkbox"
                                                      disabled={isLocked}
                                                      checked={isIncluded}
                                                      onChange={(e) => {
                                                        const nextRows = [...(col.summaryRows || [])];
                                                        let nextSumRowIds = [...(row.sumRowIds || [])];
                                                        if (e.target.checked) {
                                                          nextSumRowIds.push(r.id);
                                                        } else {
                                                          nextSumRowIds = nextSumRowIds.filter(id => id !== r.id);
                                                        }
                                                        nextRows[sIdx] = { ...nextRows[sIdx], sumRowIds: nextSumRowIds };
                                                        handleUpdateTableColumn(activeBlock.id, col.id, { summaryRows: nextRows });
                                                      }}
                                                    />
                                                    {r.label || 'Không tên'}
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  {!isLocked && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextRows: ColumnSummaryRowConfig[] = [...(col.summaryRows || []), { id: `sum_${Date.now()}`, label: 'Cộng:', type: 'sum' }];
                                         handleUpdateTableColumn(activeBlock.id, col.id, { summaryRows: nextRows });
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0.15rem 0.3rem', fontSize: '0.65rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content', marginTop: '0.2rem' }}
                                    >
                                      <Plus size={10} /> Thêm hàng cộng
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleAddColumn(activeBlock.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.35rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Plus size={12} />
                        <span>Thêm Cột Mới</span>
                      </button>

                      {/* Card tùy biến Lựa chọn cho Ô được chọn (Cell Options Override Inspector) */}
                      {activeCellKey && activeBlock?.type === 'TABLE' && (() => {
                        const [cellRowId, cellColId] = activeCellKey.split('_');
                        const cellCol = activeBlock.tableColumns?.find(c => c.id === cellColId);
                        if (!cellCol || (cellCol.type !== 'checkbox' && cellCol.type !== 'radio')) return null;

                        const rowIdx = activeBlock.tableRows?.findIndex(r => r.id === cellRowId) ?? 0;
                        const staticCol = activeBlock.tableColumns?.find(c => c.type === 'static_text');
                        const rowLabel = staticCol ? (activeBlock.tableData?.[cellRowId]?.[staticCol.id] || `Dòng ${rowIdx + 1}`) : `Dòng ${rowIdx + 1}`;

                        const isCustom = activeBlock.cellOptionsMap?.[activeCellKey] !== undefined;
                        const currentCellOptions = getEffectiveCellOptions(activeBlock, cellRowId, cellColId);

                        return (
                          <div style={{ marginTop: '1rem', borderTop: '2px dashed #cbd5e1', paddingTop: '0.75rem' }}>
                            <div style={{ background: isCustom ? '#eff6ff' : '#f8fafc', border: `1px solid ${isCustom ? '#93c5fd' : '#e2e8f0'}`, borderRadius: '6px', padding: '0.65rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: isCustom ? '#1e40af' : 'var(--text-primary)' }}>
                                  ✨ Tùy biến Lựa chọn cho Ô này
                                </span>
                                {isCustom && (
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => handleResetCellOptions(activeBlock.id, cellRowId, cellColId)}
                                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.7rem', textDecoration: 'underline', padding: 0 }}
                                    title="Khôi phục về dùng chung cấu hình Cột"
                                  >
                                    🔄 Dùng lại Cột
                                  </button>
                                )}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                Vị trí: <strong>{rowLabel}</strong> — Cột <strong>"{cellCol.label}"</strong> ({cellCol.type === 'checkbox' ? 'Checkbox' : 'Radio'})
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                                {currentCellOptions.map((opt, oIdx) => (
                                  <div key={oIdx} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      disabled={isLocked}
                                      placeholder="Nhãn lựa chọn"
                                      value={opt.label}
                                      onChange={(e) => {
                                        const newOpts = [...currentCellOptions];
                                        newOpts[oIdx] = { ...newOpts[oIdx], label: e.target.value };
                                        handleUpdateCellOptions(activeBlock.id, cellRowId, cellColId, newOpts);
                                      }}
                                      style={{ flex: 1, padding: '0.2rem 0.3rem', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', backgroundColor: '#ffffff' }}
                                    />
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => {
                                        const newOpts = currentCellOptions.filter((_, i) => i !== oIdx);
                                        handleUpdateCellOptions(activeBlock.id, cellRowId, cellColId, newOpts);
                                      }}
                                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 4px', fontSize: '0.8rem' }}
                                      title="Xóa lựa chọn này khỏi ô"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>

                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newOpts = [...currentCellOptions, { label: 'Lựa chọn mới', value: `OPT_${Date.now()}`, isPass: true }];
                                    handleUpdateCellOptions(activeBlock.id, cellRowId, cellColId, newOpts);
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', borderRadius: '4px', border: '1px dashed #3b82f6', background: '#ffffff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 500 }}
                                >
                                  <Plus size={11} /> Thêm tùy chọn cho Ô
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {activeBlock.type === 'MATRIX_TABLE' && activeBlock.matrixConfig && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Row Header Label</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeBlock.matrixConfig.rowHeader}
                        onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { rowHeader: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Row Count</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        disabled={isLocked}
                        value={activeBlock.matrixConfig.rowCount}
                        onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { rowCount: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Columns Group Title</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeBlock.matrixConfig.columnHeader}
                        onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { columnHeader: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Column Items</label>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateBlockMatrixConfig(activeBlockId!, { columnAlign: 'left' })}
                            style={{
                              padding: '2px 4px',
                              background: (activeBlock.matrixConfig.columnAlign || 'center') === 'left' ? '#eff6ff' : 'transparent',
                              border: (activeBlock.matrixConfig.columnAlign || 'center') === 'left' ? '1px solid #bfdbfe' : '1px solid transparent',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: (activeBlock.matrixConfig.columnAlign || 'center') === 'left' ? '#1e40af' : '#64748b'
                            }}
                            title="Canh trái tiêu đề"
                          >
                            <AlignLeft size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateBlockMatrixConfig(activeBlockId!, { columnAlign: 'center' })}
                            style={{
                              padding: '2px 4px',
                              background: (activeBlock.matrixConfig.columnAlign || 'center') === 'center' ? '#eff6ff' : 'transparent',
                              border: (activeBlock.matrixConfig.columnAlign || 'center') === 'center' ? '1px solid #bfdbfe' : '1px solid transparent',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: (activeBlock.matrixConfig.columnAlign || 'center') === 'center' ? '#1e40af' : '#64748b'
                            }}
                            title="Canh giữa tiêu đề"
                          >
                            <AlignCenter size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {activeBlock.matrixConfig.columns.map((colName, cIdx) => (
                          <div key={cIdx} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={colName}
                              onChange={(e) => {
                                const newCols = [...activeBlock.matrixConfig!.columns];
                                newCols[cIdx] = e.target.value;
                                handleUpdateBlockMatrixConfig(activeBlockId!, { columns: newCols });
                              }}
                              placeholder={`Column ${cIdx + 1}`}
                              style={{ flex: 1, padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                            />
                            <button
                              type="button"
                              disabled={isLocked || activeBlock.matrixConfig!.columns.length <= 1}
                              onClick={() => {
                                const newCols = activeBlock.matrixConfig!.columns.filter((_, i) => i !== cIdx);
                                handleUpdateBlockMatrixConfig(activeBlockId!, { columns: newCols });
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            const newCols = [...activeBlock.matrixConfig!.columns, `SP ${activeBlock.matrixConfig!.columns.length + 1}`];
                            handleUpdateBlockMatrixConfig(activeBlockId!, { columns: newCols });
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', justifyContent: 'center' }}
                        >
                          <Plus size={11} /> Thêm cột sản phẩm
                        </button>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={activeBlock.matrixConfig.showTotalColumn}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { showTotalColumn: e.target.checked })}
                        />
                        Hiện cột Tổng dòng
                      </label>
                      {activeBlock.matrixConfig.showTotalColumn && (
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.matrixConfig.totalColumnHeader}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { totalColumnHeader: e.target.value })}
                          style={{ padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                        />
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={activeBlock.matrixConfig.showNotesColumn}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { showNotesColumn: e.target.checked })}
                        />
                        Hiện cột Ghi chú
                      </label>
                      {activeBlock.matrixConfig.showNotesColumn && (
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.matrixConfig.notesColumnHeader}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { notesColumnHeader: e.target.value })}
                          style={{ padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {(activeBlock.type === 'INFO_GRID' || activeBlock.type === 'SIGN') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Columns</label>
                      
                      {/* Mini Segmented Pill [ 1 | 2 | 3 ] */}
                      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #cbd5e1' }}>
                        {[1, 2, 3].map((cols) => (
                          <button
                            key={cols}
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateBlockColumns(activeBlockId!, cols as 1 | 2 | 3)}
                            style={{
                              padding: '2px 10px',
                              fontSize: '0.75rem',
                              fontWeight: activeBlock.columns === cols ? 700 : 500,
                              background: activeBlock.columns === cols ? 'var(--primary)' : 'transparent',
                              color: activeBlock.columns === cols ? '#ffffff' : 'var(--text-secondary)',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: isLocked ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {cols}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Stepped Splitter Slider for INFO_GRID */}
                    {activeBlock.type === 'INFO_GRID' && (activeBlock.columns === 2 || activeBlock.columns === 3) && (
                      <InfoGridSteppedSplitter
                        columns={activeBlock.columns}
                        columnWidths={activeBlock.columnWidths}
                        onChange={(widths) => handleUpdateBlockColumnWidths(activeBlock.id, widths)}
                        disabled={isLocked}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* GENERAL FORM PROPERTIES */
            <div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                


                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Form Title</label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      // Sync to TITLE block if one exists
                      const titleBlock = layoutBlocks.find(b => b.type === 'TITLE');
                      if (titleBlock) handleUpdateBlockTitle(titleBlock.id, e.target.value);
                    }}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                  />
                </div>
              </div>
            </div>
          )
        ) : (
          /* VERSIONS TAB CONTENT */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
            
            {/* Form ID Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              {/* Label row với Link/Unlink icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Form ID</label>
                {linkedProcessId && (
                  <button
                    type="button"
                    title={formIdLinked
                      ? `Form ID đang được quản lý bởi quy trình "${linkedProcessId}". Click để phá liên kết.`
                      : 'Form đã phá liên kết khỏi quy trình. Bạn có thể chỉnh sửa Form ID tự do.'}
                    onClick={async () => {
                      if (!formIdLinked) return; // đã unlinked, không làm gì thêm
                      const confirmed = window.confirm(
                        `⚠️ Phá liên kết Form khỏi Quy trình\n\n` +
                        `Form "${formId}" đang được gắn với quy trình "${linkedProcessId}".\n\n` +
                        `Sau khi phá liên kết:\n` +
                        `• Form bị XOÁ khỏi danh sách biểu mẫu trong quy trình\n` +
                        `• Bước workflow tham chiếu form này sẽ không còn form liên kết\n` +
                        `• Form vẫn tồn tại độc lập — bạn có thể chỉnh sửa và gắn lại vào quy trình sau\n\n` +
                        `Thao tác này sẽ TỰ ĐỘNG LƯU quy trình.\n\nBạn có chắc chắn?`
                      );
                      if (confirmed && onUnlinkFromProcess) {
                        const success = await onUnlinkFromProcess();
                        if (success) {
                          setFormIdLinked(false); // mở khoá Form ID input
                        }
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: formIdLinked ? 'pointer' : 'default',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      color: formIdLinked ? 'var(--primary, #3b82f6)' : '#94a3b8',
                      flexShrink: 0,
                      borderRadius: '3px'
                    }}
                  >
                    {formIdLinked ? <Link size={13} /> : <Link2Off size={13} />}
                  </button>
                )}
              </div>

              {/* Input field */}
              <input
                type="text"
                disabled={isLocked || formIdLinked}
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="e.g. 3S-QC/F03"
                style={{
                  padding: '0.35rem 0.5rem',
                  borderRadius: '4px',
                  border: `1px solid ${formIdLinked ? 'var(--primary, #3b82f6)' : 'var(--neutral-border)'}`,
                  backgroundColor: (isLocked || formIdLinked) ? '#f1f5f9' : '#ffffff',
                  cursor: (isLocked || formIdLinked) ? 'not-allowed' : 'text'
                }}
              />

              {/* Hint text: trạng thái linked / unlinked */}
              {linkedProcessId && formIdLinked && (
                <span style={{ fontSize: '0.69rem', color: 'var(--primary, #3b82f6)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Link size={10} />
                  Đang liên kết với quy trình <strong style={{ marginLeft: '0.15rem' }}>{linkedProcessId}</strong>
                </span>
              )}
              {linkedProcessId && !formIdLinked && (
                <span style={{ fontSize: '0.69rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <Link2Off size={10} />
                  Form đã phá liên kết. Đang hoạt động độc lập.
                </span>
              )}
            </div>
            
            {/* Card 1: Current Version Info */}
            <div style={{
              backgroundColor: 'var(--neutral-card, #f8fafc)',
              border: '1px solid var(--neutral-border, #cbd5e1)',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <GitBranch size={13} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  Version Control
                </span>
              </div>


              {isLocked ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        v{major}.{minor}
                      </span>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', textTransform: 'uppercase', fontWeight: 700 }}>
                        Active
                      </span>
                    </div>
                    {status === 'ACTIVE' && effectiveDate && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        ({effectiveDate})
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: '0.15rem' }}>
                    <button
                      type="button"
                      onClick={handleCreateNewVersion}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        width: '100%',
                        padding: '0.45rem 0.75rem',
                        background: '#0f172a',
                        border: '1px solid #0f172a',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
                    >
                      <Plus size={12} /> NEW DRAFT
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>v</span>
                    <input
                      type="number"
                      min="0"
                      value={major}
                      onChange={(e) => handleMajorChange(parseInt(e.target.value, 10) || 0)}
                      style={{ width: '38px', padding: '0.2rem 0.15rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', textAlign: 'center', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>.</span>
                    <input
                      type="number"
                      min="0"
                      value={minor}
                      onChange={(e) => handleMinorChange(parseInt(e.target.value, 10) || 0)}
                      style={{ width: '38px', padding: '0.2rem 0.15rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', textAlign: 'center', fontSize: '0.8rem' }}
                    />

                    <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', textTransform: 'uppercase', fontWeight: 700, marginLeft: '0.15rem' }}>
                      Draft
                    </span>

                    <button
                      type="button"
                      title="Xóa bản nháp này"
                      onClick={handleDeleteActiveDraft}
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.2rem 0.4rem',
                        background: '#fee2e2',
                        border: '1px solid #fca5a5',
                        color: '#b91c1c',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        height: '24px'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fca5a5'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {!viewingRevisionVersion && (
                    <>
                      <div style={{ borderTop: '1px solid var(--neutral-border)', margin: '0.4rem 0' }} />

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Change Summary</label>
                          <button
                            type="button"
                            onClick={() => {
                              const suggested = generateFormChangeSummary(initialData?.layoutBlocks, layoutBlocks, revisionHistory);
                              setChangeSummary(suggested);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#0d9488',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              padding: 0
                            }}
                            title="Tự động phân tích thay đổi và tạo tóm tắt"
                          >
                            ✨ Gợi ý tự động
                          </button>
                        </div>
                        <textarea 
                          value={changeSummary}
                          onChange={(e) => setChangeSummary(e.target.value)}
                          placeholder=""
                          rows={3}
                          style={{
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.8rem',
                            border: '1px solid var(--neutral-border)',
                            borderRadius: '4px',
                            resize: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Release Date & Action</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input 
                            type="date"
                            value={effectiveDate}
                            onChange={(e) => setEffectiveDate(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.78rem',
                              border: '1px solid var(--neutral-border)',
                              borderRadius: '4px',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                          <button 
                            type="button"
                            onClick={handlePublish} 
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.35rem 0.75rem',
                              background: '#10b981',
                              border: '1px solid #10b981',
                              color: '#ffffff',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'background-color 0.15s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981'; }}
                          >
                            Publish
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Card 3: Revision History & Audit Log */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--neutral-border, #cbd5e1)',
              borderRadius: '6px',
              padding: '0.85rem 1rem',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={13} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  Revision History
                </span>
              </div>

              {revisionHistory.length === 0 ? (
                <div style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--neutral-border)', borderRadius: '5px' }}>
                  No version history available.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                  {revisionHistory.map((h, i) => {
                    const hasLayout = !!(h.layoutBlocks && h.layoutBlocks.length > 0);
                    const isCurrentActive = h.version === `v${major}.${minor}` && status === 'ACTIVE';
                    const isCurrentDraft = h.version === `v${major}.${minor}` && status === 'DRAFT';
                    const itemStatus = isCurrentActive ? 'ACTIVE' : (isCurrentDraft || h.status === 'DRAFT' ? 'DRAFT' : (h.status || 'RETIRED'));
                    
                    // Status colors matching ProcessEditor
                    const statusColor = 
                      itemStatus === 'ACTIVE' ? { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', label: 'Active' } :
                      itemStatus === 'DRAFT'  ? { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Draft' }  :
                                                { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Retired' };

                    return (
                      <div 
                        key={i} 
                        onClick={() => hasLayout && handleRestoreRevision(h)}
                        style={{ 
                          padding: '0.5rem 0.65rem', 
                          background: viewingRevisionVersion === h.version ? '#f0fdfa' : '#f9fafb', 
                          borderRadius: '6px', 
                          border: viewingRevisionVersion === h.version ? '1px solid #99f6e4' : '1px solid var(--neutral-border)', 
                          fontSize: '0.75rem',
                          cursor: hasLayout ? 'pointer' : 'default',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => { if (hasLayout && viewingRevisionVersion !== h.version) { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.borderColor = '#7dd3fc'; } }}
                        onMouseLeave={e => { if (hasLayout && viewingRevisionVersion !== h.version) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = 'var(--neutral-border)'; } }}
                        title={hasLayout ? "Click to view this version in read-only mode" : "Version log details"}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, marginBottom: h.change && !h.change.startsWith('Draft snapshot') ? '4px' : '0px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ color: 'var(--text-primary)' }}>{h.version}</span>
                            {viewingRevisionVersion === h.version && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '0.01rem 0.2rem', borderRadius: '3px', textTransform: 'uppercase' }}>
                                VIEWING
                              </span>
                            )}
                            <span className="badge" style={{ backgroundColor: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`, fontSize: '0.62rem', padding: '0.02rem 0.25rem', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 700 }}>
                              {statusColor.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 500 }}>{h.date}</span>
                            {!isCurrentActive && !isCurrentDraft && (
                              <button
                                type="button"
                                title={`Xóa phiên bản ${h.version}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRevisionEntry(h.version);
                                }}
                                style={{
                                  background: '#fee2e2',
                                  border: '1px solid #fca5a5',
                                  color: '#b91c1c',
                                  borderRadius: '4px',
                                  padding: '0.1rem 0.3rem',
                                  fontSize: '0.65rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#fca5a5'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {h.change && !h.change.startsWith('Draft snapshot') && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', wordBreak: 'break-word', whiteSpace: 'pre-line', lineHeight: '1.25' }}>
                            {h.change}
                          </div>
                        )}
                        
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                          By: {h.author}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      {/* 5. COPY SECTION FROM FORM MODAL */}
      {showCopyModal && (() => {
        interface FormOptionItem {
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

        const availableFormsMap = new Map<string, FormOptionItem>();
        const currentProcId = linkedProcessId || initialData?.formId || '';

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
              if (isSameProc && (fId === formId || fTitle === formTitle || fName === formName)) {
                return;
              }

              availableFormsMap.set(key, {
                key,
                processId: proc.id,
                processTitle: proc.title || 'Quy trình',
                formId: fId,
                formTitle: fTitle,
                formName: fName,
                updatedAt: formData.updatedAt || proc.lastUpdated || formData.updated_at || '',
                blocks: formData.layoutBlocks,
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
          if (fId === formId || fTitle === formTitle || fName === formName) return;

          // Check if form is already in availableFormsMap
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
              blocks: blocks,
              isSameProcess: false,
              isUnlinked: true
            });
          }
        });

        const availableForms = Array.from(availableFormsMap.values());

        // Sort into 3 predictive UX categories descending by updatedAt
        const getTs = (item: FormOptionItem) => item.updatedAt ? new Date(item.updatedAt).getTime() : 0;

        const sameProcessForms = availableForms
          .filter(f => f.isSameProcess)
          .sort((a, b) => getTs(b) - getTs(a));

        const otherProcessForms = availableForms
          .filter(f => !f.isSameProcess && !f.isUnlinked)
          .sort((a, b) => getTs(b) - getTs(a));

        const unlinkedForms = availableForms
          .filter(f => f.isUnlinked)
          .sort((a, b) => getTs(b) - getTs(a));

        const selectedForm = availableForms.find(f => f.key === selectedFormKey);
        const selectedBlock = selectedForm?.blocks.find(b => b.id === selectedBlockId);

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '85vh',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Copy Section from Form</h3>
                <button 
                  type="button" 
                  onClick={() => setShowCopyModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>1. Select Source Form</label>
                <select 
                  value={selectedFormKey} 
                  onChange={(e) => {
                    setSelectedFormKey(e.target.value);
                    setSelectedBlockId('');
                  }}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.8rem', outline: 'none' }}
                >
                  <option value="">-- Choose a Form --</option>
                  {sameProcessForms.length > 0 && (
                    <optgroup label={`📌 Form trong cùng quy trình (${sameProcessForms[0]?.processTitle || 'Quy trình hiện tại'})`}>
                      {sameProcessForms.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.formTitle} {f.formId && f.formId !== f.formTitle ? `(${f.formId})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherProcessForms.length > 0 && (
                    <optgroup label="🕒 Form các quy trình khác (Mới cập nhật gần đây)">
                      {otherProcessForms.map(f => {
                        let dateStr = '';
                        if (f.updatedAt) {
                          try { dateStr = ` — ${new Date(f.updatedAt).toLocaleDateString('vi-VN')}`; } catch {}
                        }
                        return (
                          <option key={f.key} value={f.key}>
                            {f.processTitle} › {f.formTitle} {f.formId && f.formId !== f.formTitle ? `(${f.formId})` : ''}{dateStr}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  {unlinkedForms.length > 0 && (
                    <optgroup label="📄 Biểu mẫu tự do (Chưa liên kết)">
                      {unlinkedForms.map(f => {
                        let dateStr = '';
                        if (f.updatedAt) {
                          try { dateStr = ` — ${new Date(f.updatedAt).toLocaleDateString('vi-VN')}`; } catch {}
                        }
                        return (
                          <option key={f.key} value={f.key}>
                            {f.formTitle} {f.formId && f.formId !== f.formTitle ? `(${f.formId})` : ''}{dateStr}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
              </div>

              {selectedForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>2. Select Section to Copy</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '4px', padding: '0.35rem' }}>
                    {selectedForm.blocks.map(block => (
                      <div 
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        style={{
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: selectedBlockId === block.id ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${selectedBlockId === block.id ? '#10b981' : 'transparent'}`,
                          color: selectedBlockId === block.id ? '#15803d' : 'var(--text-primary)',
                          fontWeight: selectedBlockId === block.id ? 600 : 400,
                          transition: 'all 0.15s'
                        }}
                      >
                        {block.title || `Unnamed Section (${block.type})`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBlock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>3. Section Preview</label>
                  <div style={{ 
                    padding: '0.75rem', 
                    background: '#f8fafc', 
                    border: '1px solid var(--neutral-border)', 
                    borderRadius: '6px', 
                    fontSize: '0.75rem' 
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.45rem', color: '#334155' }}>
                      {selectedBlock.title || 'Untitled Section'} ({selectedBlock.type})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '110px', overflowY: 'auto', padding: '0.1rem' }}>
                      {selectedBlock.fields.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No fields in this section.</span>
                      ) : (
                        selectedBlock.fields.map(field => (
                          <div key={field.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.7rem' }}>
                            <span style={{ fontWeight: 500 }}>{field.checkItem || '(Blank Label)'}</span>
                            <span style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase' }}>{field.type}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem' }}>
                <button 
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={!selectedBlock}
                  onClick={() => handleExecuteCopy(selectedBlock!)}
                  style={{
                    background: selectedBlock ? '#0f172a' : '#94a3b8',
                    border: `1px solid ${selectedBlock ? '#0f172a' : '#94a3b8'}`,
                    color: '#ffffff',
                    padding: '6px 16px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: selectedBlock ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => { if (selectedBlock) e.currentTarget.style.background = '#1e293b'; }}
                  onMouseLeave={(e) => { if (selectedBlock) e.currentTarget.style.background = '#0f172a'; }}
                >
                  Copy Section
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {showLogoGallery && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Select Brand Logo</h3>
              <button 
                type="button" 
                onClick={() => setShowLogoGallery(false)}
                style={{ border: 'none', background: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '50vh', padding: '0.25rem' }}>
              {existingLogos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No existing logos found. Upload one to start!
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '1rem'
                }}>
                  {existingLogos.map((logo) => {
                    const key = logo.key;
                    const resolvedUrl = resolvedLogos[key];
                    const displayName = key.replace('uploads/logo_', '');
                    
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          handleUpdateBlockLogo(activeBlockId!, key);
                          setShowLogoGallery(false);
                        }}
                        style={{
                          border: '1px solid var(--neutral-border)',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: '#f8fafc',
                          transition: 'all 0.15s ease',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = '#f0fdf4';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--neutral-border)';
                          e.currentTarget.style.background = '#f8fafc';
                        }}
                      >
                        {!logo.isUsed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete logo "${displayName}"?`)) {
                                handleDeleteUnusedLogo(key);
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: 'none',
                              color: 'var(--danger)',
                              borderRadius: '4px',
                              padding: '2px 4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              zIndex: 10
                            }}
                            onMouseEnter={(ev) => ev.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseLeave={(ev) => ev.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            title="Delete unused logo"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}

                        <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {resolvedUrl ? (
                            <img src={resolvedUrl} alt="Logo" style={{ maxHeight: '45px', maxWidth: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Loading...</span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-secondary)',
                          textAlign: 'center',
                          wordBreak: 'break-all',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {displayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
