import React, { useState, useEffect, useRef } from 'react';
import type {
  ReportTemplateISO,
  ReportBlockConfig,
  ReportBlockType,
  ReportRevisionEntry,
  FormTemplateISO,
  FormFieldISO,
  Submission,
  ReportDataModel,
  FieldEvaluationResult,
  TitleFormatISO
} from '../types';
import { computeRecordReport, evaluateFieldSpec } from '../utils/reportCompute';
import { extractAllFormFields, groupFieldsByHierarchy, type FieldHierarchyGroup } from '../utils/tableFieldExtractor';
import { getInfoGridTemplateColumns, snap2ColWidth, snap3ColWidths } from '../utils/formUtils';
import { handleFormatKeyDown } from '../utils/textFormatter';
import { FieldScoringInspector } from './report/FieldScoringInspector';
import { FormReferenceCanvas } from './report/FormReferenceCanvas';
import { extractParentGroupTitle, computeH2CombinedScore, summarizeH1ChildGroups, summarizeH2ChildElements } from '../utils/reportScoring';
import { SmartNumberInput } from './common/SmartNumberInput';
import ConfirmModal from './common/ConfirmModal';
import PrintReport from './print/PrintReport';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Grid,
  Table as TableIcon,
  PenTool,
  AlignLeft,
  Trash2,
  ArrowUp,
  ArrowDown,
  Printer,
  Check,
  X,
  RotateCcw,
  Clock,
  Search,
  Sparkles,
  Plus,
  GitBranch,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  Hash,
  Calendar,
  CircleDot,
  CheckSquare,
  SlidersHorizontal,
  Camera,
  Copy,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, label, disabled }: ToggleSwitchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
      {label && <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: '32px',
          height: '18px',
          borderRadius: '9px',
          background: checked ? 'var(--primary)' : '#cbd5e1',
          position: 'relative',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s ease',
          padding: 0,
          outline: 'none',
          flexShrink: 0
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#ffffff',
            position: 'absolute',
            top: '2px',
            left: checked ? '16px' : '2px',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}
        />
      </button>
    </div>
  );
}

const getFieldBadgeStyle = (type?: string) => {
  switch (type) {
    case 'likert_scale': return { bg: '#f3e8ff', color: '#7e22ce', label: 'SCALE' }; // Purple
    case 'rating': return { bg: '#fef3c7', color: '#b45309', label: 'SCALE' };       // Amber
    case 'radio': return { bg: '#e0f2fe', color: '#0369a1', label: 'RADIO' };        // Sky
    case 'select': return { bg: '#e0f2fe', color: '#0369a1', label: 'DROPDOWN' };    // Sky
    case 'number': return { bg: '#ccfbf1', color: '#0f766e', label: 'NUMBER' };       // Teal
    case 'checkbox': return { bg: '#e0e7ff', color: '#4338ca', label: 'CHECKBOX' };   // Indigo
    case 'date': return { bg: '#fef9c3', color: '#854d0e', label: 'DATE' };          // Yellow
    case 'time': return { bg: '#fef9c3', color: '#854d0e', label: 'TIME' };          // Yellow
    case 'photo': return { bg: '#fdf2f8', color: '#9d174d', label: 'PHOTO' };        // Pink
    case 'signature': return { bg: '#f0fdf4', color: '#166534', label: 'SIGN-OFF' }; // Green
    case 'subtable': return { bg: '#e0f2fe', color: '#075985', label: 'SUBTABLE' };  // Sky
    default: return { bg: '#f1f5f9', color: '#475569', label: (type || 'TEXT').toUpperCase() }; // Slate
  }
};

export const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'time', label: 'Time', icon: Clock },
  { value: 'radio', label: 'Radio', icon: CircleDot },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'select', label: 'Dropdown', icon: ChevronDown },
  { value: 'likert_scale', label: 'Scale', icon: SlidersHorizontal },
  { value: 'photo', label: 'Photo', icon: Camera },
  { value: 'signature', label: 'Sign-off', icon: PenTool },
  { value: 'subtable', label: 'Subtable', icon: TableIcon },
  { value: 'label', label: 'Label', icon: AlignLeft }
];

export const getFieldTypeOption = (type?: string) => {
  if (type === 'rating') return { value: 'likert_scale', label: 'Scale', icon: SlidersHorizontal };
  return FIELD_TYPE_OPTIONS.find(o => o.value === type) || FIELD_TYPE_OPTIONS[0];
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

  const w1 = columns === 2 ? (columnWidths?.[0] ?? 50) : 0;
  const w2 = columns === 2 ? (columnWidths?.[1] ?? (100 - w1)) : 0;

  const c3_w1 = columns === 3 ? (columnWidths?.[0] ?? 33) : 0;
  const c3_w2 = columns === 3 ? (columnWidths?.[1] ?? 34) : 0;
  const c3_w3 = columns === 3 ? (columnWidths?.[2] ?? Math.max(10, 100 - c3_w1 - c3_w2)) : 0;
  const c3_pos1 = c3_w1;
  const c3_pos2 = c3_w1 + c3_w2;

  const handlePointerDown = (handleIdx: number, e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handleIdx);

    const onMove = (moveEvt: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawPct = Math.max(5, Math.min(95, ((moveEvt.clientX - rect.left) / rect.width) * 100));

      if (columns === 2) {
        onChange(snap2ColWidth(rawPct));
      } else if (columns === 3) {
        onChange(snap3ColWidths(handleIdx as 0 | 1, rawPct));
      }
    };

    const onUp = () => {
      setActiveHandle(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', userSelect: 'none' }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '32px',
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        {columns === 2 ? (
          <>
            <div style={{ width: `${w1}%`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', background: 'rgba(13, 148, 136, 0.08)' }}>
              {w1}%
            </div>
            <div
              onMouseDown={(e) => handlePointerDown(0, e)}
              style={{
                position: 'absolute',
                left: `${w1}%`,
                top: 0,
                bottom: 0,
                width: '10px',
                marginLeft: '-5px',
                cursor: 'col-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{ width: '3px', height: '100%', background: activeHandle === 0 ? 'var(--primary)' : '#64748b', borderRadius: '1px' }} />
            </div>
            <div style={{ width: `${w2}%`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
              {w2}%
            </div>
          </>
        ) : (
          <>
            <div style={{ width: `${c3_w1}%`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--primary)', background: 'rgba(13, 148, 136, 0.08)' }}>
              {c3_w1}%
            </div>
            <div
              onMouseDown={(e) => handlePointerDown(0, e)}
              style={{ position: 'absolute', left: `${c3_pos1}%`, top: 0, bottom: 0, width: '10px', marginLeft: '-5px', cursor: 'col-resize', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ width: '3px', height: '100%', background: activeHandle === 0 ? 'var(--primary)' : '#64748b', borderRadius: '1px' }} />
            </div>
            <div style={{ width: `${c3_w2}%`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#334155', background: 'rgba(51, 65, 85, 0.05)' }}>
              {c3_w2}%
            </div>
            <div
              onMouseDown={(e) => handlePointerDown(1, e)}
              style={{ position: 'absolute', left: `${c3_pos2}%`, top: 0, bottom: 0, width: '10px', marginLeft: '-5px', cursor: 'col-resize', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ width: '3px', height: '100%', background: activeHandle === 1 ? 'var(--primary)' : '#64748b', borderRadius: '1px' }} />
            </div>
            <div style={{ width: `${c3_w3}%`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
              {c3_w3}%
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const getReportSnapshot = (data: ReportTemplateISO) => {
  return JSON.stringify({
    reportId: data.reportId,
    reportTitle: data.reportTitle,
    linkedFormId: data.linkedFormId,
    reportType: data.reportType,
    version: data.version,
    status: data.status,
    effectiveDate: data.effectiveDate,
    layoutBlocks: data.layoutBlocks,
    revisionHistory: data.revisionHistory
  });
};

const generateReportChangeSummary = (
  initialBlocks?: ReportBlockConfig[],
  currentBlocks?: ReportBlockConfig[],
  history?: ReportRevisionEntry[]
): string => {
  const hasActiveVersion = (history || []).some(
    h => h.status === 'ACTIVE' || h.change?.includes('Published') || h.change?.includes('Ban hành')
  );

  if (!hasActiveVersion) {
    return 'Ban hành cấu hình báo cáo lần đầu';
  }

  const current = currentBlocks || [];
  const initial = initialBlocks || [];
  const changes: string[] = [];

  const initialBlockMap = new Map<string, ReportBlockConfig>();
  initial.forEach(b => initialBlockMap.set(b.id, b));

  const currentBlockMap = new Map<string, ReportBlockConfig>();
  current.forEach(b => currentBlockMap.set(b.id, b));

  // 1. Detect added blocks
  current.forEach(b => {
    if (!initialBlockMap.has(b.id)) {
      const groupTitle = b.title || b.type;
      changes.push(`[BỔ SUNG] Bổ sung khối mới: "${groupTitle}"`);
    }
  });

  // 2. Detect removed blocks
  initial.forEach(b => {
    if (!currentBlockMap.has(b.id)) {
      const groupTitle = b.title || b.type;
      changes.push(`[XOÁ] Xoá khối: "${groupTitle}"`);
    }
  });

  // 3. Detect updated blocks / rules
  current.forEach(b => {
    const orig = initialBlockMap.get(b.id);
    if (orig) {
      if (b.title !== orig.title) {
        changes.push(`[ĐỔI TÊN] Đổi tiêu đề khối "${orig.title}" -> "${b.title}"`);
      }
      if (JSON.stringify(b.boundFieldIds) !== JSON.stringify(orig.boundFieldIds)) {
        changes.push(`[CẬP NHẬT] Cập nhật danh sách trường dữ liệu khối "${b.title || b.type}"`);
      }
      if (JSON.stringify(b.ruleOverrides) !== JSON.stringify(orig.ruleOverrides)) {
        changes.push(`[QUY TẮC] Điều chỉnh quy tắc đánh giá dung sai khối "${b.title || b.type}"`);
      }
    }
  });

  if (changes.length === 0) {
    return 'Cập nhật cấu hình và chuẩn hóa bố cục báo cáo';
  }

  return changes.slice(0, 5).join('\n');
};

interface InCanvasTitleHeaderProps {
  block: ReportBlockConfig;
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
  const titleFmt = block.titleFormat || (block.type === 'SECTION_LABEL' ? 'H1' : 'H2');

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

  const renderDescription = () => {
    if (block.type !== 'SECTION_LABEL') return null;
    return (
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
          placeholder="Gõ mô tả hoặc ghi chú hướng dẫn..."
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
    );
  };

  if (titleFmt === 'NONE') {
    if (block.type === 'SECTION_LABEL' || isBlockSelected) {
      return (
        <div style={{ marginBottom: '0.5rem' }}>
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
              cursor: 'pointer'
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                disabled={isLocked}
                value={block.title}
                onClick={onSelectBlock}
                onChange={(e) => onUpdateTitle(e.target.value)}
                placeholder={block.type === 'SECTION_LABEL' ? '(Section Label đang ẩn - Format: NONE)' : '(Tiêu đề đang ẩn)'}
                style={{
                  width: '100%',
                  fontSize: '0.85rem',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  opacity: 0.6,
                  border: '1px solid transparent',
                  borderRadius: '3px',
                  background: 'transparent',
                  outline: 'none',
                  padding: '0.15rem 0.35rem',
                  cursor: isLocked ? 'default' : 'text',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = 'var(--neutral-border)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.opacity = '0.6';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              />
            </div>
            {renderStylePill()}
          </div>
          {renderDescription()}
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
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

      {renderDescription()}
    </div>
  );
}

interface ReportBuilderProps {
  initialReportId?: string;
  initialFormId?: string;
  onSave?: (template: ReportTemplateISO) => void;
  onClose: () => void;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  initialReportId,
  initialFormId,
  onSave,
  onClose
}) => {
  const { currentUser } = useAuth();
  const [template, setTemplate] = useState<ReportTemplateISO>({
    reportId: initialReportId || (initialFormId ? `RP-${initialFormId}` : 'RP-NEW'),
    reportTitle: 'BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG',
    linkedFormId: initialFormId || '',
    reportType: 'RECORD',
    status: 'DRAFT',
    version: 'v1.0',
    effectiveDate: new Date().toISOString().split('T')[0],
    layoutBlocks: [],
    revisionHistory: []
  });

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeCanvasTab, setActiveCanvasTab] = useState<'form' | 'report'>('report');
  const [copiedFieldId, setCopiedFieldId] = useState<boolean>(false);
  const [rightTab, setRightTab] = useState<'properties' | 'versions'>('properties');
  const [availableForms, setAvailableForms] = useState<FormTemplateISO[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormTemplateISO | null>(null);
  const [sampleSubmissions, setSampleSubmissions] = useState<Submission[]>([]);
  const [sampleSubmission, setSampleSubmission] = useState<Submission | null>(null);
  const [computedData, setComputedData] = useState<ReportDataModel | null>(null);
  const isLocked = template.status === 'ACTIVE';
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchFieldQuery, setSearchFieldQuery] = useState<string>('');
  const [isFieldsTrayOpen, setIsFieldsTrayOpen] = useState<boolean>(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState<boolean>(true);
  const [fieldPickerBlockId, setFieldPickerBlockId] = useState<string | null>(null);
  const [fieldPickerSearch, setFieldPickerSearch] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [autoExportPdf, setAutoExportPdf] = useState<boolean>(false);
  const sectionDescRef = useRef<HTMLTextAreaElement>(null);

  const [effectiveDate, setEffectiveDate] = useState<string>(template.effectiveDate || new Date().toISOString().split('T')[0]);
  const [changeSummary, setChangeSummary] = useState<string>('');
  const [viewingRevisionVersion, setViewingRevisionVersion] = useState<string | null>(null);
  const [draftBlocksSnapshot, setDraftBlocksSnapshot] = useState<ReportBlockConfig[] | null>(null);
  const [initialBlocks, setInitialBlocks] = useState<ReportBlockConfig[]>([]);

  // Compute live snapshot & isSaved state
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string>(() => getReportSnapshot(template));
  const currentSnapshot = getReportSnapshot(template);
  const isSaved = lastSavedSnapshot !== '' && lastSavedSnapshot === currentSnapshot;

  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleDiscardChangesAndClose = () => {
    if (!isSaved) {
      setConfirmModal({
        isOpen: true,
        title: 'Thoát không lưu?',
        message: 'Bạn có các thay đổi chưa được lưu trong báo cáo. Bạn có chắc muốn thoát mà không lưu?',
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          onClose();
        }
      });
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const formsRes = await fetch('/api/forms');
        if (formsRes.ok) {
          const formsData = await formsRes.json();
          const sortedForms = [...formsData].sort((a: any, b: any) => {
            const timeA = new Date(a.updated_at || a.updatedAt || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.updatedAt || b.created_at || 0).getTime();
            return timeB - timeA;
          });
          const map = new Map<string, FormTemplateISO>();
          sortedForms.forEach((f: any) => {
            const fid = f.formId || f.form_id;
            if (!map.has(fid)) {
              map.set(fid, {
                formId: fid,
                formTitle: f.formTitle || f.form_name || fid,
                version: f.version || 'v1.0',
                status: f.status || 'DRAFT',
                layoutBlocks: f.layoutBlocks || f.layout_blocks || [],
                revisionHistory: f.revisionHistory || f.revision_history || []
              });
            }
          });
          const formList = Array.from(map.values());
          setAvailableForms(formList);

          const syncHeaderAndInfoGridBlocksFromForm = (blocks: ReportBlockConfig[], formObj?: FormTemplateISO | null): ReportBlockConfig[] => {
            if (!formObj) return blocks;
            // Step 1 & 2 for TITLE Block: Build TITLE Layout Block -> Fill Title Metadata & Fields
            const srcTitle = formObj.layoutBlocks?.find(b => b.type === 'TITLE');
            const desiredTitle = srcTitle?.title || formObj.formTitle || formObj.formId || 'BÁO CÁO ĐÁNH GIÁ';
            const desiredDesc = srcTitle?.description || srcTitle?.fields?.[0]?.checkItem;
            const existingTitle = blocks.find(b => b.type === 'TITLE');
            const titleBlock: ReportBlockConfig = existingTitle
              ? {
                  ...existingTitle,
                  title: (!existingTitle.title || existingTitle.title === 'BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG') ? desiredTitle : existingTitle.title,
                  logo: existingTitle.logo || srcTitle?.logo,
                  description: existingTitle.description || desiredDesc,
                  showDate: existingTitle.showDate ?? srcTitle?.showDate ?? true,
                  datePosition: existingTitle.datePosition || srcTitle?.datePosition || 'B',
                  boundFieldIds: existingTitle.boundFieldIds?.length ? existingTitle.boundFieldIds : (srcTitle?.fields || []).map(f => f.id)
                }
              : {
                  id: `rep_block_title_${Date.now()}`,
                  type: 'TITLE',
                  title: desiredTitle,
                  logo: srcTitle?.logo,
                  description: desiredDesc,
                  showDate: srcTitle?.showDate ?? true,
                  datePosition: srcTitle?.datePosition || 'B',
                  columns: 1,
                  borderStyle: 'grid',
                  hideHeader: false,
                  boundFieldIds: (srcTitle?.fields || []).map(f => f.id)
                };

            // Step 1 & 2 for INFO_GRID Blocks: Build each INFO_GRID Layout Block -> Arrange its Fields into Slots
            const srcInfoGrids = (formObj.layoutBlocks || []).filter(b => b.type === 'INFO_GRID');
            const existingInfoGrids = blocks.filter(b => b.type === 'INFO_GRID');
            const syncedInfoGrids: ReportBlockConfig[] = srcInfoGrids.map((srcInfo, idx) => {
              const srcFieldIds = (srcInfo.fields || []).map(f => f.id);
              const matchedExisting = existingInfoGrids.find(eb =>
                srcFieldIds.length > 0 && eb.boundFieldIds?.some(fid => srcFieldIds.includes(fid)) &&
                !eb.boundFieldIds?.some(fid => fid.startsWith('b_table_'))
              ) || existingInfoGrids[idx];
              const isLegacyTruncated = matchedExisting && srcFieldIds.length > (matchedExisting.boundFieldIds?.length || 0);
              return {
                id: matchedExisting?.id || `rep_block_info_${idx}_${Date.now()}`,
                type: 'INFO_GRID',
                title: srcInfo.title || matchedExisting?.title || 'Thông tin chung',
                titleFormat: srcInfo.titleFormat || (idx === 0 && srcInfo.title ? 'H1' : 'NONE'),
                columns: srcInfo.columns || matchedExisting?.columns || 2,
                columnWidths: srcInfo.columnWidths || matchedExisting?.columnWidths || (srcInfo.columns === 3 ? [33.33, 33.33, 33.34] : [50, 50]),
                borderStyle: srcInfo.borderStyle || matchedExisting?.borderStyle || 'grid',
                hideHeader: srcInfo.hideHeader ?? matchedExisting?.hideHeader ?? false,
                boundFieldIds: (isLegacyTruncated || !matchedExisting?.boundFieldIds?.length) ? srcFieldIds : matchedExisting.boundFieldIds,
                ruleOverrides: matchedExisting?.ruleOverrides || {}
              };
            });

            const otherBlocks = blocks.filter(b => b.type !== 'TITLE' && b.type !== 'INFO_GRID');
            return [titleBlock, ...(syncedInfoGrids.length > 0 ? syncedInfoGrids : existingInfoGrids), ...otherBlocks];
          };

          const targetFormId = initialFormId || template.linkedFormId || (formList[0]?.formId || '');
          let activeMatchedForm: FormTemplateISO | null = null;
          if (targetFormId) {
            activeMatchedForm = formList.find(f => f.formId === targetFormId) || formList[0] || null;
            setSelectedForm(activeMatchedForm);
            setTemplate(prev => ({
              ...prev,
              reportTitle: (!prev.reportTitle || prev.reportTitle === 'BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG') && activeMatchedForm
                ? (activeMatchedForm.layoutBlocks?.find(b => b.type === 'TITLE')?.title || activeMatchedForm.formTitle || prev.reportTitle)
                : prev.reportTitle,
              linkedFormId: targetFormId,
              reportId: prev.reportId === 'RP-NEW' ? `RP-${targetFormId}` : prev.reportId,
              layoutBlocks: syncHeaderAndInfoGridBlocksFromForm(prev.layoutBlocks, activeMatchedForm)
            }));
            fetchSubmissionsForForm(targetFormId);
          }

          if (initialReportId) {
            const repRes = await fetch(`/api/reports/${initialReportId}`);
            if (repRes.ok) {
              const repData = await repRes.json();
              const linkedFormObj = formList.find(f => f.formId === (repData.linkedFormId || targetFormId)) || activeMatchedForm;
              const syncedBlocks = syncHeaderAndInfoGridBlocksFromForm(repData.layoutBlocks || [], linkedFormObj);
              const syncedTitle = syncedBlocks.find(b => b.type === 'TITLE')?.title || repData.reportTitle;
              const syncedRepData = { ...repData, reportTitle: syncedTitle, layoutBlocks: syncedBlocks };
              setTemplate(syncedRepData);
              setInitialBlocks(syncedBlocks);
              setLastSavedSnapshot(getReportSnapshot(syncedRepData));
              if (repData.effectiveDate) setEffectiveDate(repData.effectiveDate);
              if (repData.linkedFormId) {
                fetchSubmissionsForForm(repData.linkedFormId);
              }
            }
          } else if (targetFormId) {
            // Fallback: no reportId passed → try to load the latest saved report for this form
            const byFormRes = await fetch(`/api/reports/by-form/${targetFormId}`);
            if (byFormRes.ok) {
              const repData = await byFormRes.json();
              const linkedFormObj = formList.find(f => f.formId === targetFormId) || activeMatchedForm;
              const syncedBlocks = syncHeaderAndInfoGridBlocksFromForm(repData.layoutBlocks || [], linkedFormObj);
              const syncedTitle = syncedBlocks.find(b => b.type === 'TITLE')?.title || repData.reportTitle;
              const syncedRepData = { ...repData, reportTitle: syncedTitle, layoutBlocks: syncedBlocks };
              setTemplate(syncedRepData);
              setInitialBlocks(syncedBlocks);
              setLastSavedSnapshot(getReportSnapshot(syncedRepData));
              if (repData.effectiveDate) setEffectiveDate(repData.effectiveDate);
            }
            // If 404 (no saved report yet for this form) → keep the fresh template initialized above
          }
        }
      } catch (err) {
        console.error('Failed to initialize ReportBuilder:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [initialReportId, initialFormId]);

  const fetchSubmissionsForForm = async (formId: string) => {
    try {
      const res = await fetch(`/api/submissions?formId=${formId}`);
      if (res.ok) {
        const data = await res.json();
        setSampleSubmissions(data);
        if (data.length > 0) {
          setSampleSubmission(data[0]);
        }
      }
    } catch (e) {
      console.warn('No sample submissions found for form:', formId);
    }
  };

  useEffect(() => {
    if (selectedForm && sampleSubmission) {
      const computed = computeRecordReport(sampleSubmission, selectedForm, template);
      setComputedData(computed);
    } else {
      setComputedData(null);
    }
  }, [template, selectedForm, sampleSubmission]);

  const getSampleValue = (fid: string): string => {
    if (!sampleSubmission?.formData) return '—';
    if (Array.isArray(sampleSubmission.formData)) {
      const item = (sampleSubmission.formData as any[]).find(s => s.id === fid);
      return item?.value !== undefined ? String(item.value) : '—';
    }
    const val = (sampleSubmission.formData as any)[fid];
    return val !== undefined ? String(val) : '—';
  };

  const sampleSubmittedAtText = (sampleSubmission as any)?.submittedAt || (sampleSubmission as any)?.submitted_at
    ? new Date((sampleSubmission as any).submittedAt || (sampleSubmission as any).submitted_at).toLocaleDateString('vi-VN')
    : '—';

  const sampleOperatorText = (sampleSubmission as any)?.operatorId || (sampleSubmission as any)?.operator_id || '—';
  const sampleSupervisorText = (sampleSubmission as any)?.supervisorSignoff?.signedBy || (sampleSubmission as any)?.supervisor_signoff?.supervisor_name || '';

  const handleAddBlock = (type: ReportBlockType) => {
    const newId = `rep_block_${Date.now()}`;
    let title = 'Tiêu đề khối';
    let boundFieldIds: string[] = [];
    let logo: string | undefined = undefined;
    let description: string | undefined = undefined;
    let showDate: boolean | undefined = undefined;
    let datePosition: 'A' | 'B' | undefined = undefined;

    if (type === 'TITLE') {
      title = template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ';
      const sourceTitleBlock = selectedForm?.layoutBlocks?.find(b => b.type === 'TITLE');
      if (sourceTitleBlock) {
        logo = sourceTitleBlock.logo;
        description = sourceTitleBlock.description;
        showDate = sourceTitleBlock.showDate;
        datePosition = sourceTitleBlock.datePosition;
      }
    } else if (type === 'SECTION_LABEL') {
      title = '1. THÔNG TIN ĐÁNH GIÁ';
    } else if (type === 'INFO_GRID') {
      title = 'Thông tin chung';
      if (selectedForm) {
        boundFieldIds = selectedForm.layoutBlocks
          .flatMap(b => b.fields || [])
          .filter(f => f.type === 'text' || f.type === 'date' || f.type === 'time')
          .slice(0, 4)
          .map(f => f.id);
      }
    } else if (type === 'TABLE') {
      title = 'Bảng đánh giá thông số & quy cách (Specs vs Actual)';
      if (selectedForm) {
        boundFieldIds = selectedForm.layoutBlocks
          .flatMap(b => b.fields || [])
          .filter(f => f.type === 'number' || f.type === 'radio' || f.type === 'checkbox')
          .map(f => f.id);
      }
    } else if (type === 'SIGN') {
      title = 'Xác nhận & Thẩm định';
      if (selectedForm) {
        boundFieldIds = selectedForm.layoutBlocks
          .flatMap(b => b.fields || [])
          .filter(f => f.type === 'signature')
          .map(f => f.id);
      }
    }

    const newBlock: ReportBlockConfig = {
      id: newId,
      type,
      title,
      logo,
      description,
      showDate,
      datePosition,
      boundFieldIds,
      columns: type === 'INFO_GRID' ? 2 : 1,
      columnWidths: type === 'INFO_GRID' ? [50, 50] : undefined,
      titleFormat: type === 'SECTION_LABEL' ? 'H1' : 'H2',
      borderStyle: 'grid',
      hideHeader: false
    };

    setTemplate(prev => ({
      ...prev,
      layoutBlocks: [...prev.layoutBlocks, newBlock]
    }));
    setActiveBlockId(newId);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const blocks = [...template.layoutBlocks];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const temp = blocks[index];
    blocks[index] = blocks[targetIdx];
    blocks[targetIdx] = temp;
    setTemplate(prev => ({ ...prev, layoutBlocks: blocks }));
  };

  const handleDeleteBlock = (blockId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xoá khối báo cáo',
      message: 'Bạn có chắc chắn muốn xoá khối này khỏi báo cáo?',
      onConfirm: () => {
        setTemplate(prev => ({
          ...prev,
          layoutBlocks: prev.layoutBlocks.filter(b => b.id !== blockId)
        }));
        if (activeBlockId === blockId) setActiveBlockId(null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleFormChange = (formId: string) => {
    const matched = availableForms.find(f => f.formId === formId);
    if (!matched) return;
    setSelectedForm(matched);
    const formTitleBlock = matched.layoutBlocks?.find(b => b.type === 'TITLE');
    const syncedTitle = formTitleBlock?.title || matched.formTitle || prevTitleFallback(template.reportTitle);
    const srcInfoGrids = (matched.layoutBlocks || []).filter(b => b.type === 'INFO_GRID');
    const builtInfoGrids: ReportBlockConfig[] = srcInfoGrids.map((srcInfo, idx) => ({
      id: `rep_block_info_${idx}_${Date.now()}`,
      type: 'INFO_GRID',
      title: srcInfo.title || 'Thông tin chung',
      titleFormat: srcInfo.titleFormat || (idx === 0 && srcInfo.title ? 'H1' : 'NONE'),
      columns: srcInfo.columns || 2,
      columnWidths: srcInfo.columnWidths || (srcInfo.columns === 3 ? [33.33, 33.33, 33.34] : [50, 50]),
      borderStyle: srcInfo.borderStyle || 'grid',
      hideHeader: srcInfo.hideHeader ?? false,
      boundFieldIds: (srcInfo.fields || []).map(f => f.id),
      ruleOverrides: {}
    }));
    setTemplate(prev => {
      const nonHeaderBlocks = prev.layoutBlocks.filter(b => b.type !== 'TITLE' && b.type !== 'INFO_GRID');
      const titleBlock: ReportBlockConfig = {
        id: prev.layoutBlocks.find(b => b.type === 'TITLE')?.id || `rep_block_title_${Date.now()}`,
        type: 'TITLE',
        title: syncedTitle,
        description: formTitleBlock?.description || '',
        logo: formTitleBlock?.logo,
        showDate: formTitleBlock?.showDate ?? true,
        datePosition: formTitleBlock?.datePosition || 'B',
        boundFieldIds: (formTitleBlock?.fields || []).map(f => f.id)
      };
      return {
        ...prev,
        linkedFormId: formId,
        reportTitle: syncedTitle,
        reportId: prev.status === 'DRAFT' && prev.reportId.startsWith('RP-') ? `RP-${formId}` : prev.reportId,
        layoutBlocks: [titleBlock, ...builtInfoGrids, ...nonHeaderBlocks]
      };
    });
    fetchSubmissionsForForm(formId);
  };
  const prevTitleFallback = (t?: string) => (t && t !== 'BÁO CÁO ĐÁNH GIÁ') ? t : 'BÁO CÁO ĐÁNH GIÁ';

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save draft');
      }
      const saved = await res.json();
      setTemplate(saved);
      setLastSavedSnapshot(getReportSnapshot(saved));
      if (onSave) onSave(saved);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu bản nháp.');
    } finally {
      setSaving(false);
    }
  };

  const verParts = (template.version || 'v1.0').replace('v', '').split('.');
  const major = parseInt(verParts[0], 10) || 1;
  const minor = parseInt(verParts[1], 10) || 0;

  const handleMajorChange = (newMajor: number) => {
    setTemplate(prev => ({
      ...prev,
      version: `v${newMajor}.${minor}`
    }));
  };

  const handleMinorChange = (newMinor: number) => {
    setTemplate(prev => ({
      ...prev,
      version: `v${major}.${newMinor}`
    }));
  };

  const handleCreateNewVersion = () => {
    const nextMinor = minor + 1;
    const nextVer = `v${major}.${nextMinor}`;
    setTemplate(prev => ({
      ...prev,
      version: nextVer,
      status: 'DRAFT'
    }));
    setChangeSummary('');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
  };

  const handleDeleteActiveDraft = () => {
    if (template.status !== 'DRAFT') return;
    const latestActive = template.revisionHistory.find(r => r.status === 'ACTIVE');
    
    setConfirmModal({
      isOpen: true,
      title: 'Xoá bản nháp này?',
      message: latestActive
        ? `Bạn có chắc muốn huỷ bản nháp "${template.version}"? Báo cáo sẽ được đưa về phiên bản đang hoạt động (${latestActive.version}).`
        : `Bạn có chắc muốn xoá các thay đổi trong bản nháp "${template.version}"?`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          if (latestActive && latestActive.layoutBlocks) {
            const restoredTemplate: ReportTemplateISO = {
              ...template,
              version: latestActive.version,
              status: 'ACTIVE',
              effectiveDate: latestActive.date,
              layoutBlocks: JSON.parse(JSON.stringify(latestActive.layoutBlocks))
            };
            setTemplate(restoredTemplate);
            setInitialBlocks(latestActive.layoutBlocks);
            setLastSavedSnapshot(getReportSnapshot(restoredTemplate));
            setChangeSummary('');
          }
        } catch (err) {
          console.error('Failed to reset draft:', err);
        }
      }
    });
  };

  const handlePublish = async () => {
    let activeSummary = changeSummary.trim();
    if (!activeSummary) {
      activeSummary = generateReportChangeSummary(initialBlocks, template.layoutBlocks, template.revisionHistory);
      setChangeSummary(activeSummary);
    }

    if (!template.reportTitle.trim()) {
      alert('Vui lòng nhập Tiêu đề báo cáo trước khi xuất bản.');
      return;
    }

    const publishDate = effectiveDate || new Date().toISOString().split('T')[0];
    const cleanNewVer = template.version.replace(/\s*\([^)]*\)/g, '').trim();
    const newEntry: ReportRevisionEntry = {
      version: cleanNewVer,
      date: publishDate,
      author: currentUser?.full_name || currentUser?.username || 'Admin',
      change: activeSummary,
      status: 'ACTIVE',
      layoutBlocks: JSON.parse(JSON.stringify(template.layoutBlocks))
    };

    const olderEntries = (template.revisionHistory || [])
      .filter(h => {
        const cleanH = (h.version || '').replace(/\s*\([^)]*\)/g, '').trim();
        return cleanH !== cleanNewVer && h.status !== 'DRAFT';
      })
      .map(h => ({ ...h, status: 'RETIRED' as const }));

    const updatedHistory = [newEntry, ...olderEntries];

    try {
      setSaving(true);
      const payload: ReportTemplateISO = {
        ...template,
        version: cleanNewVer,
        status: 'ACTIVE',
        effectiveDate: publishDate,
        revisionHistory: updatedHistory
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, allowActiveUpdate: true })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to publish');
      }

      const published = await res.json();
      setTemplate(published);
      setInitialBlocks(published.layoutBlocks || []);
      setLastSavedSnapshot(getReportSnapshot(published));
      setChangeSummary('');
      if (onSave) onSave(published);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xuất bản báo cáo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreRevision = (entry: ReportRevisionEntry) => {
    if (!entry.layoutBlocks || entry.layoutBlocks.length === 0) {
      alert(`Bản ghi phiên bản (${entry.version}) không có dữ liệu bố cục.`);
      return;
    }

    if (!draftBlocksSnapshot) {
      setDraftBlocksSnapshot(JSON.parse(JSON.stringify(template.layoutBlocks)));
    }
    setViewingRevisionVersion(entry.version);
    setTemplate(prev => ({
      ...prev,
      layoutBlocks: JSON.parse(JSON.stringify(entry.layoutBlocks))
    }));
  };

  const handleCommitRestore = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Khôi phục phiên bản',
      message: `Bạn có chắc muốn áp dụng toàn bộ bố cục của phiên bản ${viewingRevisionVersion} vào bản nháp hiện tại?`,
      onConfirm: () => {
        setViewingRevisionVersion(null);
        setDraftBlocksSnapshot(null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleReturnToDraft = () => {
    if (draftBlocksSnapshot) {
      setTemplate(prev => ({
        ...prev,
        layoutBlocks: draftBlocksSnapshot
      }));
    }
    setViewingRevisionVersion(null);
    setDraftBlocksSnapshot(null);
  };

  const handleDeleteRevisionEntry = (ver: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa phiên bản khỏi lịch sử',
      message: `Bạn có chắc chắn muốn xóa bản ghi phiên bản ${ver} khỏi lịch sử không?`,
      onConfirm: async () => {
        const nextHistory = template.revisionHistory.filter(h => h.version !== ver);
        const nextTemplate = { ...template, revisionHistory: nextHistory };
        setTemplate(nextTemplate);
        try {
          await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...nextTemplate, allowActiveUpdate: true })
          });
        } catch (e) {
          console.error(e);
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const activeBlock = template.layoutBlocks.find(b => b.id === activeBlockId);

  const addFieldToBlock = (blockId: string, fieldId: string) => {
    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b => {
        if (b.id !== blockId) return b;
        const current = b.boundFieldIds || [];
        if (current.includes(fieldId)) return b;
        return {
          ...b,
          boundFieldIds: [...current, fieldId]
        };
      })
    }));
  };

  const addMultipleFieldsToBlock = (blockId: string, fieldIds: string[]) => {
    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b => {
        if (b.id !== blockId) return b;
        const current = b.boundFieldIds || [];
        const toAdd = fieldIds.filter(id => !current.includes(id));
        if (toAdd.length === 0) return b;
        return {
          ...b,
          boundFieldIds: [...current, ...toAdd]
        };
      })
    }));
  };

  const toggleSectionExpand = (key: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  const setAllSectionsExpanded = (expanded: boolean, groups: FieldHierarchyGroup[]) => {
    const next: Record<string, boolean> = {};
    groups.forEach(g => {
      next[`h1_${g.h1}`] = expanded;
      g.h2Groups.forEach(sub => {
        next[`h2_${g.h1}_${sub.h2}`] = expanded;
        sub.elements.forEach(el => {
          next[`h2_${g.h1}_${sub.h2}_el_${el.elementTitle}`] = expanded;
        });
      });
      g.directElements.forEach(el => {
        next[`h1_${g.h1}_el_${el.elementTitle}`] = expanded;
      });
    });
    setExpandedSections(next);
  };

  const removeFieldFromBlock = (blockId: string, fieldId: string) => {
    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b =>
        b.id === blockId ? { ...b, boundFieldIds: (b.boundFieldIds || []).filter(id => id !== fieldId) } : b
      )
    }));
  };

  const moveFieldInBlock = (blockId: string, fieldIdx: number, direction: 'up' | 'down') => {
    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b => {
        if (b.id !== blockId || !b.boundFieldIds) return b;
        const targetIdx = direction === 'up' ? fieldIdx - 1 : fieldIdx + 1;
        if (targetIdx < 0 || targetIdx >= b.boundFieldIds.length) return b;
        const newIds = [...b.boundFieldIds];
        const [moved] = newIds.splice(fieldIdx, 1);
        newIds.splice(targetIdx, 0, moved);
        return { ...b, boundFieldIds: newIds };
      })
    }));
  };

  const updateRuleOverride = (fieldId: string, updates: any) => {
    setTemplate(prev => {
      // 1. Resolve field metadata to identify parent section / group
      const allFields = extractAllFormFields(selectedForm?.layoutBlocks || []);
      const field = allFields.find(f => f.id === fieldId) || (selectedField?.id === fieldId ? selectedField : null);
      const groupTitle = field ? extractParentGroupTitle(field, prev.layoutBlocks) : '';
      const cleanGroup = groupTitle.trim().toLowerCase();

      // 2. Priority resolution for target block
      const targetBlock =
        // Priority 1: Block that already explicitly includes this field in boundFieldIds
        prev.layoutBlocks.find(b => b.boundFieldIds?.includes(fieldId)) ||
        // Priority 2: Block that already holds an override for this field
        prev.layoutBlocks.find(b => b.ruleOverrides?.[fieldId] !== undefined) ||
        // Priority 3: Block with matching section title (preferring TABLE)
        (cleanGroup ? prev.layoutBlocks.find(b => b.title && b.title.trim().toLowerCase() === cleanGroup) : undefined) ||
        // Priority 4: Current active block if it is TABLE or INFO_GRID
        ((activeBlock && (activeBlock.type === 'TABLE' || activeBlock.type === 'INFO_GRID')) ? activeBlock : undefined);

      if (!targetBlock) {
        // Priority 5: If no suitable block exists (e.g. empty layoutBlocks), auto-create TABLE block for this group
        const newBlock: ReportBlockConfig = {
          id: `rep_block_${Date.now()}`,
          type: 'TABLE',
          title: groupTitle || 'Bảng đánh giá',
          boundFieldIds: [fieldId],
          weight: 0,
          isKnockout: false,
          ruleOverrides: {
            [fieldId]: { fieldId, ...updates }
          }
        };
        return {
          ...prev,
          layoutBlocks: [...prev.layoutBlocks, newBlock]
        };
      }

      const overrides = { ...(targetBlock.ruleOverrides || {}) };
      overrides[fieldId] = {
        ...(overrides[fieldId] || { fieldId }),
        ...updates
      };

      const boundIds = targetBlock.boundFieldIds || [];
      const updatedBound = boundIds.includes(fieldId) ? boundIds : [...boundIds, fieldId];

      return {
        ...prev,
        layoutBlocks: prev.layoutBlocks.map(b =>
          b.id === targetBlock.id ? { ...b, boundFieldIds: updatedBound, ruleOverrides: overrides } : b
        )
      };
    });
  };

  const handleSelectH1Section = (h1Title: string) => {
    setSelectedFieldId(null);
    setRightTab('properties');

    const cleanTitle = h1Title.trim().toLowerCase();
    const existingH1Block = template.layoutBlocks.find(b =>
      b.type === 'SECTION_LABEL' &&
      (b.titleFormat === 'H1' || !b.titleFormat) &&
      b.title.trim().toLowerCase() === cleanTitle
    );

    if (existingH1Block) {
      setActiveBlockId(existingH1Block.id);
    } else {
      const anyMatchingBlock = template.layoutBlocks.find(b => b.title.trim().toLowerCase() === cleanTitle);
      if (anyMatchingBlock) {
        setActiveBlockId(anyMatchingBlock.id);
      } else {
        const newBlock: ReportBlockConfig = {
          id: `rep_block_${Date.now()}`,
          type: 'SECTION_LABEL',
          title: h1Title,
          titleFormat: 'H1',
          weight: 0,
          isKnockout: false
        };
        setTemplate(prev => ({
          ...prev,
          layoutBlocks: [...prev.layoutBlocks, newBlock]
        }));
        setActiveBlockId(newBlock.id);
      }
    }
  };

  const handleSelectH2Subgroup = (h2Title: string) => {
    setSelectedFieldId(null);
    setRightTab('properties');

    const cleanTitle = h2Title.trim().toLowerCase();
    const existingH2Block = template.layoutBlocks.find(b =>
      b.type === 'SECTION_LABEL' &&
      b.titleFormat === 'H2' &&
      (b.title || '').trim().toLowerCase() === cleanTitle
    );

    if (existingH2Block) {
      setActiveBlockId(existingH2Block.id);
    } else {
      const newBlock: ReportBlockConfig = {
        id: `rep_block_h2_${Date.now()}`,
        type: 'SECTION_LABEL',
        title: h2Title,
        titleFormat: 'H2',
        weight: 0,
        isKnockout: false
      };
      setTemplate(prev => ({
        ...prev,
        layoutBlocks: [...prev.layoutBlocks, newBlock]
      }));
      setActiveBlockId(newBlock.id);
    }
  };

  const handleSelectElementGroup = (elementTitle: string, fieldIds: string[]) => {
    setSelectedFieldId(null);
    setRightTab('properties');

    const cleanTitle = elementTitle.trim().toLowerCase();
    const existingTableBlock = template.layoutBlocks.find(b =>
      b.type === 'TABLE' &&
      ((b.title || '').trim().toLowerCase() === cleanTitle || b.boundFieldIds?.some(id => fieldIds.includes(id)))
    );

    if (existingTableBlock) {
      setActiveBlockId(existingTableBlock.id);
    } else {
      const newBlock: ReportBlockConfig = {
        id: `rep_block_${Date.now()}`,
        type: 'TABLE',
        title: elementTitle,
        boundFieldIds: fieldIds,
        weight: 0,
        isKnockout: false
      };
      setTemplate(prev => ({
        ...prev,
        layoutBlocks: [...prev.layoutBlocks, newBlock]
      }));
      setActiveBlockId(newBlock.id);
    }
  };

  const handleUpdateChildElementWeight = (elementTitle: string, blockId: string | undefined, newWeight: number) => {
    setTemplate(prev => {
      if (blockId) {
        return {
          ...prev,
          layoutBlocks: prev.layoutBlocks.map(b => b.id === blockId ? { ...b, weight: newWeight } : b)
        };
      }
      const cleanTitle = elementTitle.trim().toLowerCase();
      const existingIdx = prev.layoutBlocks.findIndex(b =>
        b.type === 'TABLE' && (b.title || '').trim().toLowerCase() === cleanTitle
      );
      if (existingIdx >= 0) {
        return {
          ...prev,
          layoutBlocks: prev.layoutBlocks.map((b, idx) => idx === existingIdx ? { ...b, weight: newWeight } : b)
        };
      }
      const allElements = hierarchyGroups.flatMap(h1 => h1.h2Groups).flatMap(h2 => h2.elements || []);
      const matchedEl = allElements.find(el => el.elementTitle.trim().toLowerCase() === cleanTitle);
      const newBlock: ReportBlockConfig = {
        id: `rep_block_tbl_${Date.now()}`,
        type: 'TABLE',
        title: elementTitle,
        weight: newWeight,
        boundFieldIds: matchedEl ? matchedEl.fields.map(f => f.id) : []
      };
      return {
        ...prev,
        layoutBlocks: [...prev.layoutBlocks, newBlock]
      };
    });
  };

  const allFormFields: FormFieldISO[] = extractAllFormFields(selectedForm?.layoutBlocks || []);
  const filteredFormFields = allFormFields.filter(f =>
    (f.checkItem || '').toLowerCase().includes(searchFieldQuery.toLowerCase()) ||
    (f.id || '').toLowerCase().includes(searchFieldQuery.toLowerCase()) ||
    (f.locationCode || '').toLowerCase().includes(searchFieldQuery.toLowerCase()) ||
    (f.sectionH1 || '').toLowerCase().includes(searchFieldQuery.toLowerCase()) ||
    (f.sectionH2 || '').toLowerCase().includes(searchFieldQuery.toLowerCase())
  );
  const hierarchyGroups = React.useMemo(() => groupFieldsByHierarchy(filteredFormFields), [filteredFormFields]);

  const handleSelectTableGroupFromCanvas = (groupTitle: string) => {
    const cleanTarget = groupTitle.trim().toLowerCase();
    // Nếu là tiêu đề H2 thực sự -> mở H2 Section Properties
    for (const h1 of hierarchyGroups) {
      const h2 = h1.h2Groups.find(g => g.h2.trim().toLowerCase() === cleanTarget);
      if (h2) {
        handleSelectH2Subgroup(h2.h2);
        return;
      }
    }
    // Nếu là Element / Table cấp dưới H2 hoặc trực tiếp dưới H1 -> mở Table Properties
    let matchedFieldIds: string[] = [];
    for (const h1 of hierarchyGroups) {
      for (const h2 of h1.h2Groups) {
        const el = h2.elements.find(e => e.elementTitle.trim().toLowerCase() === cleanTarget);
        if (el) {
          matchedFieldIds = el.fields.map(f => f.id);
          break;
        }
      }
      if (matchedFieldIds.length > 0) break;
      const directEl = h1.directElements.find(e => e.elementTitle.trim().toLowerCase() === cleanTarget);
      if (directEl) {
        matchedFieldIds = directEl.fields.map(f => f.id);
        break;
      }
    }
    if (matchedFieldIds.length === 0) {
      const fieldMatches = allFormFields.filter(f =>
        (f.locationCode && f.locationCode.split(' › ')[0].trim().toLowerCase() === cleanTarget) ||
        (f.locationCode && f.locationCode.trim().toLowerCase() === cleanTarget)
      );
      if (fieldMatches.length > 0) {
        matchedFieldIds = fieldMatches.map(f => f.id);
      }
    }
    handleSelectElementGroup(groupTitle, matchedFieldIds);
  };

  // Handler when clicking a Layout Block (TITLE, SECTION_LABEL, INFO_GRID, SIGN, TABLE) in FormReferenceCanvas
  const handleSelectBlockFromFormCanvas = (formBlockId: string) => {
    const existingDirect = template.layoutBlocks.find(b => b.id === formBlockId);
    if (existingDirect) {
      setActiveBlockId(existingDirect.id);
      setSelectedFieldId(null);
      setRightTab('properties');
      return;
    }
    const formBlock = selectedForm?.layoutBlocks?.find(b => b.id === formBlockId);
    if (!formBlock) {
      setActiveBlockId(formBlockId);
      setSelectedFieldId(null);
      setRightTab('properties');
      return;
    }
    if (formBlock.type === 'TITLE') {
      const existingTitle = template.layoutBlocks.find(b => b.type === 'TITLE');
      if (existingTitle) {
        setActiveBlockId(existingTitle.id);
      } else {
        const newId = `rep_block_title_${Date.now()}`;
        const newTitleBlock: ReportBlockConfig = {
          id: newId,
          type: 'TITLE',
          title: formBlock.title || selectedForm?.formTitle || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ',
          description: formBlock.description || '',
          logo: formBlock.logo,
          showDate: formBlock.showDate ?? true,
          datePosition: formBlock.datePosition || 'B'
        };
        setTemplate(prev => ({ ...prev, layoutBlocks: [newTitleBlock, ...prev.layoutBlocks] }));
        setActiveBlockId(newId);
      }
      setSelectedFieldId(null);
      setRightTab('properties');
      return;
    }
    if (formBlock.type === 'SECTION_LABEL') {
      const fmt = formBlock.sectionFormat || formBlock.titleFormat || 'H1';
      if (fmt === 'H2') {
        handleSelectH2Subgroup(formBlock.title || '');
      } else {
        handleSelectH1Section(formBlock.title || '');
      }
      return;
    }
    if (formBlock.type === 'INFO_GRID') {
      const formInfoGrids = (selectedForm?.layoutBlocks || []).filter(b => b.type === 'INFO_GRID');
      const formInfoIdx = formInfoGrids.findIndex(b => b.id === formBlock.id);
      const reportInfoGrids = template.layoutBlocks.filter(b => b.type === 'INFO_GRID');
      const formFieldIds = (formBlock.fields || []).map(f => f.id);
      const matchedInfo = reportInfoGrids.find(rb =>
        formFieldIds.length > 0 && rb.boundFieldIds?.some(fid => formFieldIds.includes(fid))
      ) || (formInfoIdx >= 0 ? reportInfoGrids[formInfoIdx] : undefined);

      if (matchedInfo) {
        setActiveBlockId(matchedInfo.id);
      } else {
        const newInfoId = `rep_block_info_${Date.now()}`;
        const newInfoBlock: ReportBlockConfig = {
          id: newInfoId,
          type: 'INFO_GRID',
          title: formBlock.title || 'Thông tin chung',
          titleFormat: formBlock.titleFormat || (formInfoIdx === 0 && formBlock.title ? 'H1' : 'NONE'),
          columns: formBlock.columns || 2,
          columnWidths: formBlock.columnWidths || (formBlock.columns === 3 ? [33.33, 33.33, 33.34] : [50, 50]),
          borderStyle: formBlock.borderStyle || 'grid',
          hideHeader: formBlock.hideHeader ?? false,
          boundFieldIds: formFieldIds,
          ruleOverrides: {}
        };
        setTemplate(prev => ({ ...prev, layoutBlocks: [...prev.layoutBlocks, newInfoBlock] }));
        setActiveBlockId(newInfoId);
      }
      setSelectedFieldId(null);
      setRightTab('properties');
      return;
    }
    const matchedByTypeAndTitle = template.layoutBlocks.find(
      b => b.type === (formBlock.type as any) && (
        (b.title || '').trim().toLowerCase() === (formBlock.title || '').trim().toLowerCase() ||
        formBlock.type === 'SIGN'
      )
    );
    if (matchedByTypeAndTitle) {
      setActiveBlockId(matchedByTypeAndTitle.id);
      setSelectedFieldId(null);
      setRightTab('properties');
      return;
    }
    setActiveBlockId(formBlockId);
    setSelectedFieldId(null);
    setRightTab('properties');
  };

  const selectedField = selectedFieldId ? allFormFields.find(f => f.id === selectedFieldId) : null;

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải Report Builder...</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* ── Warning banner when viewing old revision in read-only mode ── */}
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
          </div>
        </div>
      )}

      {/* ── Top Action Bar ── */}
      <div style={{
        height: '56px',
        background: '#ffffff',
        borderBottom: '1px solid var(--neutral-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 10,
        boxSizing: 'border-box',
        flexShrink: 0
      }}>
        {/* 1. LEFT: Identity, Status & Canvas Mode Switcher [Form | Report] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>Report Builder</h2>
            {template.status !== 'DRAFT' && (
              <span className={`badge ${template.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                {template.status}
              </span>
            )}
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#f0fdfa',
            padding: '2px',
            borderRadius: '6px',
            border: '1px solid #99f6e4'
          }}>
            <button
              type="button"
              onClick={() => {
                setActiveCanvasTab('form');
                setActiveBlockId(null);
                setSelectedFieldId(null);
              }}
              style={{
                padding: '2px 10px',
                fontSize: '0.75rem',
                fontWeight: activeCanvasTab === 'form' ? 700 : 500,
                color: activeCanvasTab === 'form' ? 'var(--primary)' : '#64748b',
                background: activeCanvasTab === 'form' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                boxShadow: activeCanvasTab === 'form' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Xem biểu mẫu gốc và chọn trực tiếp câu hỏi/bảng trên Canvas"
            >
              Form
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveCanvasTab('report');
                setActiveBlockId(null);
                setSelectedFieldId(null);
              }}
              style={{
                padding: '2px 10px',
                fontSize: '0.75rem',
                fontWeight: activeCanvasTab === 'report' ? 700 : 500,
                color: activeCanvasTab === 'report' ? 'var(--primary)' : '#64748b',
                background: activeCanvasTab === 'report' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                boxShadow: activeCanvasTab === 'report' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Thiết kế bố cục và bảng điểm Báo cáo"
            >
              Report
            </button>
          </div>
        </div>

        {/* 2. CENTER: Section Adders Toolbar */}
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1', gap: '2px', flexShrink: 0 }}>
          <button 
            type="button" 
            onClick={() => handleAddBlock('TITLE')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Tiêu đề báo cáo"
          >
            <FileText size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Title</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('INFO_GRID')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Lưới thông tin"
          >
            <Grid size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Info Grid</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('TABLE')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Bảng đánh giá tiêu chuẩn"
          >
            <TableIcon size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Table</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('SIGN')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Khối chữ ký"
          >
            <PenTool size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Sign</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('SECTION_LABEL')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Nhãn phân cách"
          >
            <AlignLeft size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Label</span>
          </button>
        </div>

        {/* 3. RIGHT: Page Setup, PDF Export, Print, Save, Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {/* Page Size Segmented Switcher */}
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
              onClick={() => setTemplate(prev => ({ ...prev, pageSize: 'A4' }))}
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: (template.pageSize || 'A4') === 'A4' ? 600 : 400,
                color: (template.pageSize || 'A4') === 'A4' ? '#0f172a' : '#64748b',
                background: (template.pageSize || 'A4') === 'A4' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                boxShadow: (template.pageSize || 'A4') === 'A4' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              title="Khổ in A4 Dọc tiêu chuẩn (210mm x 297mm)"
            >
              A4 Dọc
            </button>
            <button
              type="button"
              onClick={() => setTemplate(prev => ({ ...prev, pageSize: 'A5_LANDSCAPE' }))}
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: template.pageSize === 'A5_LANDSCAPE' ? 600 : 400,
                color: template.pageSize === 'A5_LANDSCAPE' ? '#0f172a' : '#64748b',
                background: template.pageSize === 'A5_LANDSCAPE' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                boxShadow: template.pageSize === 'A5_LANDSCAPE' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
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
              setShowPrintPreview(true);
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
            title="Xuất báo cáo dạng file PDF vector"
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setAutoExportPdf(false);
              setShowPrintPreview(true);
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
            title="In thử hoặc xem trước báo cáo"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          <div style={{ borderLeft: '1px solid var(--neutral-border)', height: '16px', margin: '0 0.1rem' }} />

          {/* Save & Close Buttons */}
          <button 
            type="button"
            disabled={isSaved || saving}
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
              <span>{saving ? 'Saving...' : 'Save'}</span>
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
        </div>
      </div>

      {/* ── Main 3-Panel Workspace ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* ── LEFT PANEL: Source & Field Data Tray (Option 3 Icon-First) ── */}
        <div style={{ width: isLeftSidebarCollapsed ? '40px' : '256px', background: isLeftSidebarCollapsed ? '#f8fafc' : '#ffffff', borderRight: '1px solid var(--neutral-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0 }}>
          {isLeftSidebarCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 0', gap: '0.6rem', height: '100%' }}>
              <button
                type="button"
                onClick={() => setIsLeftSidebarCollapsed(false)}
                style={{ width: '26px', height: '26px', borderRadius: '5px', border: '1px solid transparent', background: 'transparent', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title="Mở rộng Sidebar trái"
              >
                <PanelLeftOpen size={15} />
              </button>
              <div style={{ width: '20px', height: '1px', background: '#cbd5e1' }} />
              <button
                type="button"
                onClick={() => {
                  setIsLeftSidebarCollapsed(false);
                  setIsFieldsTrayOpen(true);
                }}
                style={{ width: '26px', height: '26px', borderRadius: '5px', border: '1px solid transparent', background: 'transparent', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title={`Mở danh sách FIELDS (${allFormFields.length})`}
              >
                <Layers size={14} />
              </button>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', background: '#ccfbf1', padding: '1px 5px', borderRadius: '99px' }}>
                {allFormFields.length}
              </span>
            </div>
          ) : (
            <>
              <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--neutral-border)', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.28rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    SOURCE
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLeftSidebarCollapsed(true)}
                    style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    title="Thu gọn cột Sidebar trái"
                  >
                    <PanelLeftClose size={14} />
                  </button>
                </div>
                <select
                  value={template.linkedFormId}
                  onChange={e => handleFormChange(e.target.value)}
                  style={{ width: '100%', padding: '0.38rem 0.5rem', fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', border: '1px solid var(--neutral-border)', borderRadius: '5px', background: '#ffffff' }}
                >
                  {availableForms.map(f => (
                    <option key={f.formId} value={f.formId}>
                      {f.formTitle || f.formId}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--neutral-border)', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.28rem' }}>
                  <label style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    SUBMISSION
                  </label>
                </div>
                <select
                  value={sampleSubmission?.id || ''}
                  onChange={e => {
                    const found = sampleSubmissions.find(s => s.id === e.target.value);
                    if (found) setSampleSubmission(found);
                  }}
                  style={{ width: '100%', padding: '0.38rem 0.5rem', fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', border: '1px solid var(--neutral-border)', borderRadius: '5px', background: '#ffffff' }}
                >
                  {sampleSubmissions.length === 0 ? (
                    <option value="">(Chưa có lượt nộp mẫu)</option>
                  ) : (
                    sampleSubmissions.map((s, idx) => {
                      const op = (s as any).operatorId || (s as any).operator_id || 'Operator';
                      const dt = (s as any).submittedAt || (s as any).submitted_at;
                      const dtText = dt ? new Date(dt).toLocaleDateString('vi-VN') : '';
                      return (
                        <option key={s.id} value={s.id}>
                          #{idx + 1} - {op} {dtText ? `(${dtText})` : ''}
                        </option>
                      );
                    })
                  )}
                </select>
              </div>

              {/* Collapsible Icon-First FIELDS Toggle Bar */}
              <div
                onClick={() => setIsFieldsTrayOpen(prev => !prev)}
                style={{
                  padding: '0.52rem 0.75rem',
                  borderBottom: '1px solid var(--neutral-border)',
                  background: isFieldsTrayOpen ? '#f0fdfa' : '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.15s'
                }}
                title={isFieldsTrayOpen ? 'Đóng danh sách FIELDS' : 'Mở danh sách FIELDS'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={13} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isFieldsTrayOpen ? 'var(--primary)' : '#334155', letterSpacing: '0.03em' }}>
                    FIELDS
                  </span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '99px', background: isFieldsTrayOpen ? '#ccfbf1' : '#e2e8f0', color: isFieldsTrayOpen ? 'var(--primary)' : '#475569' }}>
                    {filteredFormFields.length}{filteredFormFields.length !== allFormFields.length ? `/${allFormFields.length}` : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {isFieldsTrayOpen && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAllSectionsExpanded(true, hierarchyGroups);
                        }}
                        style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Mở rộng tất cả các nhóm"
                      >
                        <ChevronsUpDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAllSectionsExpanded(false, hierarchyGroups);
                        }}
                        style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title="Thu gọn tất cả các nhóm"
                      >
                        <ChevronsDownUp size={13} />
                      </button>
                    </>
                  )}
                  <span style={{ width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isFieldsTrayOpen ? 'var(--primary)' : '#64748b' }}>
                    {isFieldsTrayOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </div>
              </div>

              {/* Field Data Dictionary Tray (Rendered on demand when isFieldsTrayOpen is true) */}
              {isFieldsTrayOpen ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.6rem 0.75rem' }}>
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-secondary)' }} />
                    <input
                      type="text"
                      placeholder="Tìm kiếm trường..."
                      value={searchFieldQuery}
                      onChange={e => setSearchFieldQuery(e.target.value)}
                      style={{ width: '100%', padding: '0.3rem 0.5rem 0.3rem 1.6rem', fontSize: '0.75rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                    />
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '2px' }}>
              {hierarchyGroups.length === 0 ? (
                <div style={{ padding: '2rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                  {allFormFields.length === 0 ? 'Chưa nạp được trường nào.' : 'Không tìm thấy trường khớp từ khoá.'}
                </div>
              ) : (
                hierarchyGroups.map(h1Group => {
                  const h1Key = `h1_${h1Group.h1}`;
                  const isH1Expanded = searchFieldQuery ? true : (expandedSections[h1Key] ?? true);
                  const allH1FieldIds = [
                    ...h1Group.h2Groups.flatMap(g => g.fields.map(f => f.id)),
                    ...h1Group.directElements.flatMap(e => e.fields.map(f => f.id))
                  ];
                  const isH1Active = !selectedFieldId && activeBlock && (
                    (activeBlock.type === 'SECTION_LABEL' && (activeBlock.titleFormat === 'H1' || !activeBlock.titleFormat) && activeBlock.title.trim().toLowerCase() === h1Group.h1.trim().toLowerCase()) ||
                    (activeBlock.title?.trim().toLowerCase() === h1Group.h1.trim().toLowerCase())
                  );

                  const renderElementGroupNode = (elGroup: { elementTitle: string; fields: FormFieldISO[] }, parentKey: string) => {
                    const elKey = `${parentKey}_el_${elGroup.elementTitle}`;
                    const isElExpanded = searchFieldQuery ? true : (expandedSections[elKey] ?? true);
                    const elFieldIds = elGroup.fields.map(f => f.id);
                    const isElActive = !selectedFieldId && activeBlock && activeBlock.type === 'TABLE' && (
                      activeBlock.title?.trim().toLowerCase() === elGroup.elementTitle.trim().toLowerCase() ||
                      activeBlock.boundFieldIds?.some(id => elFieldIds.includes(id))
                    );

                    return (
                      <div key={elGroup.elementTitle} style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '3px 6px',
                            minHeight: '26px',
                            boxSizing: 'border-box',
                            background: isElActive ? '#f0fdfa' : '#f8fafc',
                            border: isElActive ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.12s'
                          }}
                          onClick={() => handleSelectElementGroup(elGroup.elementTitle, elFieldIds)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSectionExpand(elKey);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '1px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isElActive ? 'var(--primary)' : '#64748b'
                              }}
                              title={isElExpanded ? 'Thu gọn bảng' : 'Mở rộng bảng'}
                            >
                              {isElExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </button>
                            <TableIcon size={11} color={isElActive ? 'var(--primary)' : '#64748b'} />
                            <span
                              style={{
                                fontSize: '0.56rem',
                                fontWeight: 700,
                                padding: '0px 3px',
                                borderRadius: '2px',
                                background: isElActive ? '#ccfbf1' : '#e2e8f0',
                                color: isElActive ? '#0f766e' : '#475569',
                                flexShrink: 0
                              }}
                            >
                              TABLE
                            </span>
                            <span
                              style={{
                                fontWeight: isElActive ? 700 : 600,
                                fontSize: '0.7rem',
                                color: isElActive ? '#0f766e' : '#334155',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              title={`Click để xem/cấu hình thuộc tính Bảng: ${elGroup.elementTitle}`}
                            >
                              {elGroup.elementTitle}
                            </span>
                            <span style={{ fontSize: '0.62rem', color: isElActive ? '#0f766e' : '#94a3b8' }}>
                              ({elGroup.fields.length})
                            </span>
                          </div>

                          {activeBlock && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addMultipleFieldsToBlock(activeBlock.id, elFieldIds);
                              }}
                              style={{
                                padding: '1px 4px',
                                fontSize: '0.58rem',
                                background: '#ffffff',
                                color: 'var(--primary)',
                                border: '1px solid #cbd5e1',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                fontWeight: 500,
                                whiteSpace: 'nowrap'
                              }}
                              title={`Gán toàn bộ ${elFieldIds.length} trường của bảng này`}
                            >
                              + Bảng
                            </button>
                          )}
                        </div>

                        {isElExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '10px', borderLeft: '1.5px dashed #cbd5e1', marginLeft: '5px' }}>
                            {elGroup.fields.map(field => {
                              const isBoundToActive = activeBlock?.boundFieldIds?.includes(field.id);
                              const badgeStyle = getFieldBadgeStyle(field.type);
                              const isSelected = selectedFieldId === field.id;
                              return (
                                <div
                                  key={field.id}
                                  onClick={() => {
                                    setSelectedFieldId(field.id);
                                    setActiveBlockId(null);
                                    setRightTab('properties');
                                  }}
                                  style={{
                                    padding: '0.32rem 0.45rem',
                                    borderRadius: '4px',
                                    border: isSelected
                                      ? '1.5px solid var(--primary)'
                                      : isBoundToActive
                                      ? '1px solid #99f6e4'
                                      : '1px solid #e2e8f0',
                                    background: isSelected
                                      ? '#f0fdfa'
                                      : isBoundToActive
                                      ? '#eff6ff'
                                      : '#ffffff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.73rem',
                                    gap: '0.4rem',
                                    transition: 'all 0.1s',
                                    boxShadow: isSelected ? '0 1px 3px rgba(13, 148, 136, 0.15)' : 'none'
                                  }}
                                  title={`Click để xem chi tiết trường (${field.id})`}
                                >
                                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    <div style={{ fontWeight: isSelected ? 600 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {field.checkItem || field.id}
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.58rem',
                                    padding: '0.08rem 0.28rem',
                                    borderRadius: '3px',
                                    background: badgeStyle.bg,
                                    color: badgeStyle.color,
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}>
                                    {badgeStyle.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div
                      key={h1Group.h1}
                      style={{
                        border: isH1Active ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        background: '#ffffff',
                        overflow: 'hidden',
                        flexShrink: 0,
                        boxShadow: isH1Active ? '0 1px 3px rgba(13, 148, 136, 0.15)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* H1 Section Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          minHeight: '34px',
                          boxSizing: 'border-box',
                          background: isH1Active ? '#f0fdfa' : '#f8fafc',
                          borderBottom: isH1Expanded ? (isH1Active ? '1px solid #ccfbf1' : '1px solid #e2e8f0') : 'none',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'background 0.12s'
                        }}
                        onClick={() => handleSelectH1Section(h1Group.h1)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSectionExpand(h1Key);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '2px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isH1Active ? 'var(--primary)' : '#475569'
                            }}
                            title={isH1Expanded ? 'Thu gọn phân đoạn' : 'Mở rộng phân đoạn'}
                          >
                            {isH1Expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                          <Layers size={13} color="var(--primary)" />
                          <span
                            style={{
                              fontWeight: isH1Active ? 800 : 700,
                              fontSize: '0.75rem',
                              color: isH1Active ? 'var(--primary)' : '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={`Click để xem/cấu hình thuộc tính Section H1: ${h1Group.h1}`}
                          >
                            {h1Group.h1}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: isH1Active ? 'var(--primary)' : '#64748b', fontWeight: 600 }}>
                            ({h1Group.totalFieldsCount})
                          </span>
                        </div>

                        {activeBlock && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addMultipleFieldsToBlock(activeBlock.id, allH1FieldIds);
                            }}
                            style={{
                              padding: '1px 5px',
                              fontSize: '0.63rem',
                              background: '#eff6ff',
                              color: 'var(--primary)',
                              border: '1px solid #bfdbfe',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                            title={`Gán toàn bộ ${allH1FieldIds.length} trường của phần này vào khối đang chọn`}
                          >
                            + Gán cả H1
                          </button>
                        )}
                      </div>

                      {/* H1 Children: Level-2 H2 Sections (strictly format H2) + Level-3 Elements */}
                      {isH1Expanded && (
                        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {h1Group.h2Groups.map(h2Group => {
                            const h2Key = `h2_${h1Group.h1}_${h2Group.h2}`;
                            const isH2Expanded = searchFieldQuery ? true : (expandedSections[h2Key] ?? true);
                            const h2FieldIds = h2Group.fields.map(f => f.id);
                            const isH2Active = !selectedFieldId && activeBlock &&
                              activeBlock.type === 'SECTION_LABEL' &&
                              activeBlock.titleFormat === 'H2' &&
                              activeBlock.title?.trim().toLowerCase() === h2Group.h2.trim().toLowerCase();

                            return (
                              <div key={h2Group.h2} style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                                {/* Level 2: Strictly H2 Header */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '4px 6px',
                                    minHeight: '28px',
                                    boxSizing: 'border-box',
                                    background: isH2Active ? '#eff6ff' : '#f1f5f9',
                                    border: isH2Active ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    transition: 'all 0.12s'
                                  }}
                                  onClick={() => handleSelectH2Subgroup(h2Group.h2)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSectionExpand(h2Key);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: '1px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isH2Active ? '#2563eb' : '#475569'
                                      }}
                                      title={isH2Expanded ? 'Thu gọn phân mục H2' : 'Mở rộng phân mục H2'}
                                    >
                                      {isH2Expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                    </button>
                                    {isH2Expanded ? <FolderOpen size={12} color="#2563eb" /> : <Folder size={12} color="#2563eb" />}
                                    <span
                                      style={{
                                        fontSize: '0.58rem',
                                        fontWeight: 800,
                                        padding: '0px 4px',
                                        borderRadius: '3px',
                                        background: '#dbeafe',
                                        color: '#1d4ed8',
                                        flexShrink: 0
                                      }}
                                    >
                                      H2
                                    </span>
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        fontSize: '0.73rem',
                                        color: isH2Active ? '#1d4ed8' : '#1e293b',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title={`Click để xem/cấu hình thuộc tính Phân mục H2: ${h2Group.h2}`}
                                    >
                                      {h2Group.h2}
                                    </span>
                                    <span style={{ fontSize: '0.63rem', color: '#2563eb', fontWeight: 600 }}>({h2Group.fields.length})</span>
                                  </div>

                                  {activeBlock && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addMultipleFieldsToBlock(activeBlock.id, h2FieldIds);
                                      }}
                                      style={{
                                        padding: '1px 4px',
                                        fontSize: '0.6rem',
                                        background: '#ffffff',
                                        color: '#2563eb',
                                        border: '1px solid #93c5fd',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                      }}
                                      title={`Gán toàn bộ ${h2FieldIds.length} trường của phân mục H2 này`}
                                    >
                                      + Cả H2
                                    </button>
                                  )}
                                </div>

                                {/* Level 3: Normal Elements (TABLE / INFO_GRID) Indented One Level Below H2 */}
                                {isH2Expanded && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '10px', borderLeft: '2px solid #bfdbfe', marginLeft: '6px' }}>
                                    {h2Group.elements.map(elGroup => renderElementGroupNode(elGroup, h2Key))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Direct Elements under H1 (when H1 has no intermediate H2 section) */}
                          {h1Group.directElements.map(elGroup => renderElementGroupNode(elGroup, h1Key))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, background: '#fcfcfd' }} />
              )}
            </>
          )}
        </div>

        {/* ── CENTER PANEL: Canvas Workspace (Form | Report Tabs) ── */}
        <div
          onClick={() => {
            setActiveBlockId(null);
            setSelectedFieldId(null);
          }}
          style={{ flex: 1, background: '#f1f5f9', overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}
        >
          {activeCanvasTab === 'form' ? (
            selectedForm ? (
              <FormReferenceCanvas
                form={selectedForm}
                reportBlocks={template.layoutBlocks}
                selectedFieldId={selectedFieldId}
                activeBlockId={activeBlockId}
                activeGroupTitle={activeBlock?.type === 'TABLE' ? activeBlock.title : null}
                onSelectField={(fId) => {
                  setSelectedFieldId(fId);
                  setActiveBlockId(null);
                  setRightTab('properties');
                }}
                onSelectTableGroup={handleSelectTableGroupFromCanvas}
                onSelectH1Section={handleSelectH1Section}
                onSelectBlock={handleSelectBlockFromFormCanvas}
                onDeselect={() => {
                  setActiveBlockId(null);
                  setSelectedFieldId(null);
                }}
              />
            ) : (
              <div style={{ border: '2px dashed var(--neutral-border)', borderRadius: '8px', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', background: '#ffffff', width: '100%', maxWidth: '698px' }}>
                <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>Chưa chọn Biểu mẫu nguồn</h4>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>Vui lòng chọn hoặc liên kết với một biểu mẫu để xem cấu trúc Form gốc.</p>
              </div>
            )
          ) : (
            /* A4 Sheet Container (Report) */
            <div
              className="paper-card"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setActiveBlockId(null);
                  setSelectedFieldId(null);
                }
              }}
              style={{
                width: '100%',
                maxWidth: '698px',
                minHeight: '842px',
                background: '#ffffff',
                padding: '1.5rem',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                borderRadius: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
            >
            {template.layoutBlocks.length === 0 ? (
              <div style={{ border: '2px dashed var(--neutral-border)', borderRadius: '8px', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>Trang báo cáo đang trống (Blank Page)</h4>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>
                  Nhấp vào thanh công cụ bên trên để thêm khối <strong>TITLE</strong>, <strong>TABLE</strong>, hoặc <strong>SIGN</strong> vào trang.
                </p>
              </div>
            ) : (
              template.layoutBlocks.map((block, idx) => {
                const isActive = block.id === activeBlockId;
                return (
                  <div
                    key={block.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBlockId(block.id);
                      setSelectedFieldId(null);
                      setRightTab('properties');
                    }}
                    style={{
                      border: isActive ? '2px solid var(--primary)' : '1px dashed #cbd5e1',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      position: 'relative',
                      background: isActive ? 'rgba(16, 163, 163, 0.02)' : '#ffffff',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Floating Block Type Label Badge (Step 1 Layout Block Shell) */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-10px',
                        right: isActive ? '84px' : '10px',
                        background: isActive ? 'var(--primary)' : '#94a3b8',
                        color: 'white',
                        fontSize: '0.65rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        letterSpacing: '0.5px',
                        zIndex: 5
                      }}
                    >
                      {block.type}
                    </div>

                    {/* Block Toolbar */}
                    {isActive && (
                      <div style={{ position: 'absolute', right: '4px', top: '-14px', background: '#ffffff', border: '1px solid var(--neutral-border)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px', zIndex: 5, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'up'); }} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#64748b' }}>
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'down'); }} disabled={idx === template.layoutBlocks.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#64748b' }}>
                          <ArrowDown size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#ef4444' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}

                    {/* Block Renderer based on Type */}
                    {block.type === 'TITLE' && (
                      block.logo ? (
                        <div style={{
                          padding: '10px 0',
                          display: 'flex',
                          alignItems: 'center',
                          marginBottom: '10px',
                          position: 'relative'
                        }}>
                          <div style={{ marginRight: '20px', display: 'flex', alignItems: 'center', height: '65px' }}>
                            <img src={block.logo} alt="Logo" style={{ maxHeight: '65px', maxWidth: '260px', objectFit: 'contain' }} />
                          </div>
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <h1 style={{ margin: '0 0 2px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                              {block.title || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ'}
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                              {block.description || '(mô tả ngắn kiểm tra)'}
                            </p>
                            {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                              <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: sampleSubmittedAtText !== '—' ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: sampleSubmittedAtText !== '—' ? '0px' : '2px', fontWeight: sampleSubmittedAtText !== '—' ? 600 : 400 }}>{sampleSubmittedAtText !== '—' ? sampleSubmittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                              </div>
                            )}
                          </div>
                          {block.showDate && block.datePosition === 'A' && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                              <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: sampleSubmittedAtText !== '—' ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: sampleSubmittedAtText !== '—' ? '0px' : '2px', fontWeight: sampleSubmittedAtText !== '—' ? 600 : 400 }}>{sampleSubmittedAtText !== '—' ? sampleSubmittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
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
                              <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: sampleSubmittedAtText !== '—' ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: sampleSubmittedAtText !== '—' ? '0px' : '2px', fontWeight: sampleSubmittedAtText !== '—' ? 600 : 400 }}>{sampleSubmittedAtText !== '—' ? sampleSubmittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                            </div>
                          )}
                          <h1 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                            {block.title || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ'}
                          </h1>
                          <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                            {block.description || '(mô tả ngắn kiểm tra)'}
                          </p>
                          {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                            <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                              <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: sampleSubmittedAtText !== '—' ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: sampleSubmittedAtText !== '—' ? '0px' : '2px', fontWeight: sampleSubmittedAtText !== '—' ? 600 : 400 }}>{sampleSubmittedAtText !== '—' ? sampleSubmittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                            </div>
                          )}
                        </div>
                      )
                    )}

                    {/* 1.1 SECTION_LABEL Block Renderer */}
                    {block.type === 'SECTION_LABEL' && (
                      <InCanvasTitleHeader
                        block={block}
                        isLocked={isLocked}
                        isBlockSelected={activeBlockId === block.id}
                        onUpdateTitle={(val) => {
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, title: val } : b)
                          }));
                        }}
                        onUpdateDescription={(val) => {
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, description: val } : b)
                          }));
                        }}
                        onUpdateTitleFormat={(fmt) => {
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, titleFormat: fmt } : b)
                          }));
                        }}
                        onSelectBlock={() => {
                          setActiveBlockId(block.id);
                          setSelectedFieldId(null);
                          setRightTab('properties');
                        }}
                      />
                    )}

                    {/* 2. INFO_GRID Block Renderer */}
                    {block.type === 'INFO_GRID' && (() => {
                      return (
                        <div>
                          <InCanvasTitleHeader
                            block={block}
                            isLocked={isLocked}
                            isBlockSelected={activeBlockId === block.id}
                            onUpdateTitle={(val) => {
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, title: val } : b)
                              }));
                            }}
                            onUpdateTitleFormat={(fmt) => {
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, titleFormat: fmt } : b)
                              }));
                            }}
                            onSelectBlock={() => {
                              setActiveBlockId(block.id);
                              setSelectedFieldId(null);
                              setRightTab('properties');
                            }}
                          />

                          {/* Grid Container */}
                          {(!block.boundFieldIds || block.boundFieldIds.length === 0) ? (
                            <div style={{ padding: '1rem', border: '1.5px dashed #cbd5e1', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', background: '#f8fafc' }}>
                              + Nhấp chọn các trường từ danh mục <strong>FIELDS</strong> bên trái để nạp vào khung lưới này
                            </div>
                          ) : (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: getInfoGridTemplateColumns(block as any),
                              columnGap: '0.75rem',
                              rowGap: '0.5rem',
                              gridAutoRows: 'minmax(38px, auto)'
                            }}>
                              {block.boundFieldIds.map((fid) => {
                                const field = allFormFields.find(f => f.id === fid);
                                const override = block.ruleOverrides?.[fid];
                                const isLabelHidden = !!override?.hideLabel;
                                const hasCustomLabel = override?.customLabel !== undefined && override.customLabel !== (field?.checkItem || fid);
                                const displayLabel = override?.customLabel !== undefined
                                  ? override.customLabel
                                  : (field?.checkItem || fid);
                                const val = getSampleValue(fid);
                                const isFieldSelected = selectedFieldId === fid;
                                const parsedRSpan = field?.type === 'subtable' ? undefined : (field?.rowSpan ? Number(field.rowSpan) : undefined);
                                const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
                                const cSpan = field?.type === 'subtable' ? -1 : (field?.colSpan ? Number(field.colSpan) : undefined);
                                const fieldOptions = field?.options && field.options.length > 0 ? field.options : null;

                                return (
                                  <div
                                    key={fid}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFieldId(fid);
                                      setRightTab('properties');
                                    }}
                                    style={{
                                      gridRow: rSpan ? `span ${rSpan}` : undefined,
                                      gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                                      border: isFieldSelected ? '2px solid var(--primary)' : '1px dotted #cbd5e1',
                                      borderRadius: '4px',
                                      padding: '6px 8px',
                                      background: isFieldSelected ? 'rgba(13, 148, 136, 0.05)' : '#ffffff',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: isLabelHidden ? 'center' : 'space-between',
                                      gap: '4px',
                                      minHeight: '42px',
                                      position: 'relative',
                                      cursor: 'pointer',
                                      transition: 'all 0.12s ease'
                                    }}
                                  >
                                    {!isLabelHidden && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                                          <input
                                            type="text"
                                            value={displayLabel}
                                            placeholder={field?.checkItem || fid}
                                            onChange={(e) => {
                                              const newVal = e.target.value;
                                              updateRuleOverride(fid, { customLabel: newVal === '' ? undefined : newVal });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              fontSize: '0.78rem',
                                              fontWeight: 600,
                                              color: 'var(--text-primary)',
                                              border: '1px solid transparent',
                                              background: 'transparent',
                                              borderRadius: '3px',
                                              padding: '1px 3px',
                                              width: '100%',
                                              outline: 'none',
                                              transition: 'all 0.15s ease'
                                            }}
                                            onFocus={(e) => {
                                              e.target.style.borderColor = 'var(--primary)';
                                              e.target.style.background = '#f8fafc';
                                            }}
                                            onBlur={(e) => {
                                              e.target.style.borderColor = 'transparent';
                                              e.target.style.background = 'transparent';
                                            }}
                                          />
                                          {hasCustomLabel && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateRuleOverride(fid, { customLabel: undefined });
                                              }}
                                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '1px 2px', display: 'flex', alignItems: 'center' }}
                                              title="Khôi phục nhãn ban đầu"
                                            >
                                              <RotateCcw size={11} />
                                            </button>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeFieldFromBlock(block.id, fid);
                                          }}
                                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 2px', fontSize: '0.8rem', lineHeight: 1 }}
                                          title="Gỡ trường khỏi khối này"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                    {isLabelHidden && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeFieldFromBlock(block.id, fid);
                                        }}
                                        style={{ position: 'absolute', right: '4px', top: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1 }}
                                        title="Gỡ trường khỏi khối này"
                                      >
                                        ✕
                                      </button>
                                    )}
                                    {fieldOptions && (field?.type === 'checkbox' || field?.type === 'radio') ? (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', paddingTop: '2px' }}>
                                        {fieldOptions.map((opt, oIdx) => {
                                          const isChecked = val && val !== '—' && val.split(',').map(s => s.trim().toLowerCase()).some(s => s === (opt.value || '').toLowerCase() || s === (opt.label || '').toLowerCase());
                                          return (
                                            <span key={opt.value || oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: isChecked ? 'var(--primary)' : '#334155', fontWeight: isChecked ? 700 : 400 }}>
                                              <span style={{
                                                display: 'inline-block',
                                                width: '11px',
                                                height: '11px',
                                                border: `1.5px solid ${isChecked ? 'var(--primary)' : '#64748b'}`,
                                                borderRadius: field.type === 'radio' ? '50%' : '2px',
                                                background: isChecked ? 'var(--primary)' : '#ffffff',
                                                flexShrink: 0
                                              }} />
                                              <span>{opt.label}</span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div style={{
                                        fontSize: '0.82rem',
                                        color: val && val !== '—' ? '#0f172a' : '#64748b',
                                        fontWeight: val && val !== '—' ? 600 : 400,
                                        fontStyle: val && val !== '—' ? 'normal' : 'italic',
                                        padding: '3px 6px',
                                        background: '#f8fafc',
                                        border: '1px dashed #cbd5e1',
                                        borderRadius: '4px'
                                      }}>
                                        {val && val !== '—' ? val : (field?.placeholder || (field?.type === 'select' ? `-- Chọn (${fieldOptions?.length || 0} mục) --` : '[Chưa có dữ liệu]'))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Slot + Thêm trường trực tiếp trên Canvas */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveBlockId(block.id);
                                  setFieldPickerBlockId(block.id);
                                  setFieldPickerSearch('');
                                }}
                                style={{
                                  border: '1.5px dashed var(--primary)',
                                  borderRadius: '4px',
                                  padding: '6px 8px',
                                  background: '#f0fdfa',
                                  color: 'var(--primary)',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  minHeight: '48px',
                                  transition: 'all 0.15s ease'
                                }}
                                title="Nhấp để thêm trường vào lưới này"
                              >
                                <Plus size={13} /> Thêm trường
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 3. TABLE Block Renderer */}
                    {block.type === 'TABLE' && (() => {
                      const borderStyle = block.borderStyle || 'grid';
                      const tableBorder = borderStyle === 'grid' ? '1px solid #cbd5e1' : borderStyle === 'horizontal_only' ? 'none' : 'none';
                      const cellBorder = borderStyle === 'grid' ? '1px solid #cbd5e1' : borderStyle === 'horizontal_only' ? '1px solid #e2e8f0' : 'none';

                      return (
                        <div>
                          <InCanvasTitleHeader
                            block={block}
                            isLocked={isLocked}
                            isBlockSelected={activeBlockId === block.id}
                            onUpdateTitle={(val) => {
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, title: val } : b)
                              }));
                            }}
                            onUpdateTitleFormat={(fmt) => {
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, titleFormat: fmt } : b)
                              }));
                            }}
                            onSelectBlock={() => {
                              setActiveBlockId(block.id);
                              setSelectedFieldId(null);
                              setRightTab('properties');
                            }}
                          />

                          {(!block.boundFieldIds || block.boundFieldIds.length === 0) ? (
                            <div style={{ padding: '1rem', border: '1.5px dashed #cbd5e1', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', background: '#f8fafc' }}>
                              <div style={{ marginBottom: '6px' }}>Chưa có tiêu chí nào trong bảng đánh giá này.</div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveBlockId(block.id);
                                  setSelectedFieldId(null);
                                  setRightTab('properties');
                                  setFieldPickerBlockId(block.id);
                                  setFieldPickerSearch('');
                                }}
                                style={{
                                  padding: '4px 10px',
                                  border: '1px solid var(--primary)',
                                  borderRadius: '4px',
                                  background: 'var(--primary)',
                                  color: '#ffffff',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Plus size={12} /> Thêm trường
                              </button>
                            </div>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: tableBorder }}>
                              {!block.hideHeader && (
                                <thead
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBlockId(block.id);
                                    setSelectedFieldId(null);
                                    setRightTab('properties');
                                  }}
                                  style={{ cursor: 'pointer' }}
                                  title="Click để xem Table Properties"
                                >
                                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                                    <th style={{ border: cellBorder, padding: '5px 6px', textAlign: 'center', width: '35px', fontWeight: 700 }}>STT</th>
                                    <th style={{ border: cellBorder, padding: '5px 8px', textAlign: 'left', fontWeight: 700 }}>Hạng mục kiểm tra / Tiêu chí</th>
                                    <th style={{ border: cellBorder, padding: '5px 8px', textAlign: 'center', width: '22%', fontWeight: 700 }}>Quy cách / Tiêu chuẩn</th>
                                    <th style={{ border: cellBorder, padding: '5px 8px', textAlign: 'center', width: '18%', fontWeight: 700 }}>Kết quả thực tế</th>
                                    <th style={{ border: cellBorder, padding: '5px 8px', textAlign: 'center', width: '16%', fontWeight: 700 }}>Đánh giá</th>
                                    <th style={{ border: cellBorder, padding: '5px 4px', textAlign: 'center', width: '40px', fontWeight: 700 }}></th>
                                  </tr>
                                </thead>
                              )}
                              <tbody>
                                {block.boundFieldIds.map((fid, rIdx) => {
                                  const field = allFormFields.find(f => f.id === fid);
                                  const evalRes = computedData?.evaluations?.[fid];
                                  const override = block.ruleOverrides?.[fid];
                                  const min = override?.customMinSpec !== undefined ? override.customMinSpec : field?.minSpec;
                                  const max = override?.customMaxSpec !== undefined ? override.customMaxSpec : field?.maxSpec;

                                  let specText = override?.customTargetRange || field?.targetRange || '—';
                                  if (min !== undefined && max !== undefined) specText = `${min} ~ ${max} ${field?.unit || ''}`;
                                  else if (min !== undefined) specText = `≥ ${min} ${field?.unit || ''}`;
                                  else if (max !== undefined) specText = `≤ ${max} ${field?.unit || ''}`;

                                  const rawVal = getSampleValue(fid);
                                  const status = evalRes?.status || 'PASS';
                                  const displayLabel = override?.customLabel || field?.checkItem || fid;
                                  const isSelected = selectedFieldId === fid;

                                  return (
                                    <tr
                                      key={fid}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFieldId(fid);
                                        setRightTab('properties');
                                      }}
                                      style={{
                                        borderBottom: cellBorder,
                                        borderLeft: isSelected ? '3px solid var(--primary)' : 'none',
                                        background: isSelected ? 'rgba(13, 148, 136, 0.08)' : (rIdx % 2 === 1 ? '#fafafa' : '#ffffff'),
                                        cursor: 'pointer',
                                        transition: 'background 0.12s ease'
                                      }}
                                    >
                                      <td style={{ border: cellBorder, padding: '5px 6px', textAlign: 'center', color: isSelected ? 'var(--primary)' : '#64748b', fontWeight: isSelected ? 700 : 400 }}>{rIdx + 1}</td>
                                      <td style={{ border: cellBorder, padding: '5px 8px' }}>
                                        <div style={{ fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>{displayLabel}</div>
                                      </td>
                                      <td style={{ border: cellBorder, padding: '5px 8px', textAlign: 'center', color: '#475569' }}>{specText}</td>
                                      <td style={{ border: cellBorder, padding: '5px 8px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>{rawVal}</td>
                                      <td style={{ border: cellBorder, padding: '5px 8px', textAlign: 'center' }}>
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '3px',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          background: status === 'PASS' ? '#dcfce7' : status === 'FAIL' ? '#fee2e2' : '#f1f5f9',
                                          color: status === 'PASS' ? '#15803d' : status === 'FAIL' ? '#b91c1c' : '#475569'
                                        }}>
                                          {status === 'PASS' ? 'ĐẠT (PASS)' : status === 'FAIL' ? 'KHÔNG ĐẠT' : 'N/A'}
                                        </span>
                                      </td>
                                      <td style={{ border: cellBorder, padding: '2px', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeFieldFromBlock(block.id, fid);
                                          }}
                                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}
                                          title="Gỡ dòng này"
                                        >
                                          ✕
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={6} style={{ padding: '4px 0 0 0' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBlockId(block.id);
                                        setFieldPickerBlockId(block.id);
                                        setFieldPickerSearch('');
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '4px 8px',
                                        border: '1.5px dashed var(--primary)',
                                        borderRadius: '4px',
                                        background: '#f0fdfa',
                                        color: 'var(--primary)',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title="Nhấp để thêm dòng tiêu chí vào bảng này"
                                    >
                                      <Plus size={12} /> Thêm trường
                                    </button>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          )}
                        </div>
                      );
                    })()}

                    {block.type === 'SIGN' && (
                      <div>
                        <InCanvasTitleHeader
                          block={block}
                          isLocked={isLocked}
                          isBlockSelected={activeBlockId === block.id}
                          onUpdateTitle={(val) => {
                            setTemplate(prev => ({
                              ...prev,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, title: val } : b)
                            }));
                          }}
                          onUpdateTitleFormat={(fmt) => {
                            setTemplate(prev => ({
                              ...prev,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === block.id ? { ...b, titleFormat: fmt } : b)
                            }));
                          }}
                          onSelectBlock={() => setActiveBlockId(block.id)}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', border: '1px solid #000', padding: '0.75rem', textAlign: 'center' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>NGƯỜI KIỂM TRA</div>
                            <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                              {sampleOperatorText !== '—' ? `[Đã ký: ${sampleOperatorText}]` : '(Ký và ghi rõ họ tên)'}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>NGƯỜI THẨM TRA (QA/QC)</div>
                            <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                              {sampleSupervisorText ? `[Thẩm tra: ${sampleSupervisorText}]` : '(Ký và ghi rõ họ tên)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          )}
        </div>

        {/* ── RIGHT PANEL: Properties & Versions Inspector ── */}
        <div style={{ width: '320px', background: '#ffffff', borderLeft: '1px solid var(--neutral-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Tab Switcher */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--neutral-border)',
            marginBottom: '0.25rem',
            paddingBottom: '2px',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem 0'
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

          {/* Tab 1: Properties */}
          {rightTab === 'properties' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
              {selectedField ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
                      FIELD PROPERTIES
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedFieldId(null)}
                      style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                      title="Đóng xem chi tiết trường"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                    {/* 1. ID Field */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>ID</label>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedField.id);
                            setCopiedFieldId(true);
                            setTimeout(() => setCopiedFieldId(false), 2000);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.68rem', color: copiedFieldId ? '#059669' : 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '0 2px' }}
                          title="Copy Field ID"
                        >
                          {copiedFieldId ? <Check size={11} /> : <Copy size={11} />}
                          <span>{copiedFieldId ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={selectedField.id}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontFamily: 'monospace', fontSize: '0.78rem', background: '#ffffff', color: '#0f172a' }}
                      />
                    </div>

                    {/* 2. Label Field */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Label</label>
                      <div
                        style={{
                          padding: '0.45rem 0.6rem',
                          borderRadius: '4px',
                          border: '1px solid var(--neutral-border)',
                          background: '#ffffff',
                          fontSize: '0.8rem',
                          color: '#0f172a',
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          minHeight: '32px'
                        }}
                      >
                        {selectedField.checkItem || selectedField.id}
                      </div>
                    </div>

                    {/* 3. Type Field */}
                    {(() => {
                      const typeOpt = getFieldTypeOption(selectedField.type);
                      const TypeIcon = typeOpt.icon;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem', minWidth: '36px' }}>Type</label>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.8rem', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <TypeIcon size={15} strokeWidth={2} style={{ color: 'var(--primary)' }} />
                              <span>{typeOpt.label}</span>
                            </div>
                            <ChevronDown size={13} strokeWidth={2} style={{ color: '#64748b' }} />
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4. Unified Scoring & Value Matrix */}
                    <FieldScoringInspector
                      key={selectedField.id}
                      selectedField={selectedField}
                      sampleSubmission={sampleSubmission}
                      ruleOverride={template.layoutBlocks.find(b => b.ruleOverrides?.[selectedField.id])?.ruleOverrides?.[selectedField.id]}
                      parentGroupTitle={extractParentGroupTitle(selectedField, template.layoutBlocks)}
                      onUpdateRule={(updates) => updateRuleOverride(selectedField.id, updates)}
                      isLocked={isLocked}
                    />
                  </div>
                </div>
              ) : activeBlock ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {activeBlock.type === 'SECTION_LABEL' ? (
                      <>
                        <h3 style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0, letterSpacing: '0.02em' }}>
                          SECTION_LABEL
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '2px', borderRadius: '5px', border: '1px solid #cbd5e1', gap: '2px' }}>
                            {(['H1', 'H2', 'BODY', 'NONE'] as const).map(fmt => {
                              const isSelected = (activeBlock.titleFormat || 'H1') === fmt;
                              const labelText = fmt === 'BODY' ? 'Body' : fmt === 'NONE' ? 'None' : fmt;
                              return (
                                <button
                                  key={fmt}
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => {
                                    setTemplate(prev => ({
                                      ...prev,
                                      layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, titleFormat: fmt } : b)
                                    }));
                                  }}
                                  style={{
                                    padding: '1px 6px',
                                    fontSize: '0.65rem',
                                    fontWeight: isSelected ? 700 : 500,
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: isLocked ? 'not-allowed' : 'pointer',
                                    background: isSelected ? (fmt === 'H2' ? '#2563eb' : 'var(--primary)') : 'transparent',
                                    color: isSelected ? '#ffffff' : 'var(--text-secondary)'
                                  }}
                                >
                                  {labelText}
                                </button>
                              );
                            })}
                          </div>
                          <button 
                            type="button" 
                            disabled={isLocked}
                            onClick={() => handleDeleteBlock(activeBlock.id)}
                            style={{ border: 'none', background: 'none', color: isLocked ? 'var(--text-muted)' : 'var(--danger)', cursor: isLocked ? 'not-allowed' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="Xóa phân đoạn"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {activeBlock.type === 'TITLE' && (
                            <span style={{
                              background: 'var(--primary)',
                              color: '#ffffff',
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              lineHeight: '14px'
                            }}>
                              TITLE
                            </span>
                          )}
                          <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
                            {activeBlock.type === 'TABLE' ? 'Table Properties' :
                             activeBlock.type === 'INFO_GRID' ? 'Info Grid Properties' :
                             activeBlock.type === 'SIGN' ? 'Signatures Properties' :
                             activeBlock.type === 'TITLE' ? 'Title Block Properties' : 'Block Properties'}
                          </h3>
                        </div>
                        {activeBlock.type !== 'TITLE' && (
                          <button 
                            type="button" 
                            disabled={isLocked}
                            onClick={() => handleDeleteBlock(activeBlock.id)}
                            style={{ border: 'none', background: 'none', color: isLocked ? 'var(--text-muted)' : 'var(--danger)', cursor: isLocked ? 'not-allowed' : 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="Xóa khối"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* TABLE Name Inline Header (Biến thể 2A: Seamless Borderless) */}
                  {activeBlock.type === 'TABLE' && (
                    <div style={{ borderBottom: '1.5px solid #e2e8f0', paddingBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeBlock.title || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, title: val } : b)
                          }));
                        }}
                        placeholder="Nhập tên bảng..."
                        title="Bấm để đổi tên bảng"
                        style={{
                          width: '100%',
                          padding: '2px 4px',
                          border: '1px solid transparent',
                          borderRadius: '4px',
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          background: 'transparent',
                          outline: 'none',
                          transition: 'all 0.15s ease'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.boxShadow = '0 0 0 2px rgba(13, 148, 136, 0.15)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                      <Pencil size={12} style={{ color: '#94a3b8', flexShrink: 0, pointerEvents: 'none' }} />
                    </div>
                  )}

                  {/* SECTION_LABEL Unified Name & Description Header (Style 2A: Liền mạch, không có line giữa) */}
                  {activeBlock.type === 'SECTION_LABEL' && (
                    <div style={{ borderBottom: '1.5px solid #e2e8f0', paddingBottom: '3px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.title || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTemplate(prev => ({
                              ...prev,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, title: val } : b)
                            }));
                          }}
                          placeholder="Nhập tên phân đoạn..."
                          title="Bấm để đổi tên phân đoạn"
                          style={{
                            width: '100%',
                            padding: '2px 4px',
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            background: 'transparent',
                            outline: 'none',
                            transition: 'all 0.15s ease'
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = activeBlock.titleFormat === 'H2' ? '#2563eb' : 'var(--primary)';
                            e.currentTarget.style.boxShadow = activeBlock.titleFormat === 'H2' ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : '0 0 0 2px rgba(13, 148, 136, 0.15)';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                        <Pencil size={12} style={{ color: '#94a3b8', flexShrink: 0, pointerEvents: 'none' }} />
                      </div>

                      {Boolean(activeBlock.description && activeBlock.description.trim()) && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                          <textarea
                            ref={sectionDescRef}
                            rows={2}
                            disabled={isLocked}
                            value={activeBlock.description || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, description: val } : b)
                              }));
                            }}
                            placeholder="Nhập mô tả..."
                            title="Bấm để chỉnh sửa Description"
                            style={{
                              width: '100%',
                              padding: '2px 4px',
                              border: '1px solid transparent',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 400,
                              color: '#475569',
                              background: 'transparent',
                              outline: 'none',
                              lineHeight: 1.35,
                              resize: 'vertical',
                              minHeight: '32px',
                              fontFamily: 'inherit',
                              transition: 'all 0.15s ease'
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.background = '#ffffff';
                              e.currentTarget.style.borderColor = activeBlock.titleFormat === 'H2' ? '#2563eb' : 'var(--primary)';
                              e.currentTarget.style.boxShadow = activeBlock.titleFormat === 'H2' ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : '0 0 0 2px rgba(13, 148, 136, 0.15)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          />
                          <Pencil size={12} style={{ color: '#94a3b8', flexShrink: 0, pointerEvents: 'none', marginTop: '4px' }} />
                        </div>
                      )}
                    </div>
                  )}

                  {activeBlock.type === 'SECTION_LABEL' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {/* SECTION_LABEL Structured 2-Row Weight Card (H1 vs H2 aware) */}
                      {(() => {
                        const isH2 = activeBlock.titleFormat === 'H2';
                        const parentH1ForH2 = isH2
                          ? (hierarchyGroups.find(h1 => h1.h2Groups.some(g => g.h2.trim().toLowerCase() === (activeBlock.title || '').trim().toLowerCase()))?.h1 || 'Toàn bộ Báo cáo')
                          : 'Toàn bộ Báo cáo';

                        return (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            padding: '7px 9px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '0.72rem',
                            marginTop: '2px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: isLocked ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                                <input
                                  type="checkbox"
                                  disabled={isLocked}
                                  checked={Boolean(activeBlock.isKnockout)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setTemplate(prev => ({
                                      ...prev,
                                      layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, isKnockout: checked } : b)
                                    }));
                                  }}
                                  style={{ width: '13px', height: '13px', accentColor: '#e11d48', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                                />
                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9f1239' }}>
                                  isKnockout
                                </span>
                              </label>
                              <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>Loại trực tiếp</span>
                            </div>

                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '5px',
                              paddingTop: '5px',
                              borderTop: '1px solid #e2e8f0'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155' }}>
                                  Weight:
                                </span>
                                <SmartNumberInput
                                  disabled={isLocked}
                                  value={activeBlock.weight !== undefined ? activeBlock.weight : 0}
                                  presets={[0, 10, 20, 25, 50, 100]}
                                  min={0}
                                  max={100}
                                  onChange={(val) => {
                                    setTemplate(prev => ({
                                      ...prev,
                                      layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, weight: val } : b)
                                    }));
                                  }}
                                  style={{ width: '44px', fontSize: '0.72rem' }}
                                />
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>%</span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  minWidth: 0,
                                  fontSize: '0.68rem',
                                  color: '#475569',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  padding: '2px 5px',
                                  maxWidth: '155px'
                                }}
                                title={parentH1ForH2}
                              >
                                <span style={{ color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>of</span>
                                <span style={{
                                  fontWeight: 700,
                                  color: isH2 ? '#2563eb' : 'var(--primary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {parentH1ForH2}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* H1 Pillar Combined Scoring Summary Roll-up */}
                      {activeBlock.titleFormat !== 'H2' && (() => {
                        const { childH2Summary, h1CombinedScore } = summarizeH1ChildGroups(
                          activeBlock.title,
                          hierarchyGroups,
                          template.layoutBlocks,
                          sampleSubmission?.formData
                        );
                        if (!childH2Summary || childH2Summary.length === 0) return null;
                        const hasDirectElements = childH2Summary.some(item => item.isElement);

                        return (
                          <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.6rem', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              TỔNG HỢP ĐIỂM TRỤ CỘT H1
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', fontSize: '0.72rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '6px 8px', fontWeight: 700, color: '#475569', alignItems: 'center' }}>
                                <div style={{ gridColumn: 'span 5' }}>{hasDirectElements ? 'Bảng / Phần tử con' : 'Nhóm H2 con'}</div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'center', color: '#0f766e' }}>isPass</div>
                                <div style={{ gridColumn: 'span 3', textAlign: 'right', color: '#4338ca' }}>Score</div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'right', color: '#64748b' }}>Weight</div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {childH2Summary.map((h2Item, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                                      padding: '5px 8px',
                                      alignItems: 'center',
                                      borderBottom: idx < childH2Summary.length - 1 ? '1px solid #f1f5f9' : 'none'
                                    }}
                                  >
                                    <div style={{ gridColumn: 'span 5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#1e293b' }} title={h2Item.h2Title}>
                                      {h2Item.h2Title}
                                    </div>
                                    <div style={{ gridColumn: 'span 2', textAlign: 'center', fontWeight: 700, fontSize: '0.68rem', color: h2Item.isPass ? '#0f766e' : '#e11d48' }}>
                                      {h2Item.isPass ? 'PASS' : 'FAIL'}
                                    </div>
                                    <div style={{ gridColumn: 'span 3', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                      {h2Item.score}
                                    </div>
                                    <div style={{ gridColumn: 'span 2', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                                      {h2Item.weight}%
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', padding: '6px 8px', alignItems: 'center', background: '#f0fdfa', borderTop: '1px solid #ccfbf1' }}>
                                <div style={{ gridColumn: 'span 5', fontWeight: 700, color: '#0f766e', fontSize: '0.72rem' }}>Tổng Trụ Cột:</div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: h1CombinedScore.isPass ? '#0f766e' : '#e11d48' }}>
                                  {h1CombinedScore.isPass ? 'PASS' : 'FAIL'}
                                </div>
                                <div style={{ gridColumn: 'span 5', textAlign: 'right' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f766e', lineHeight: 1 }}>
                                    {h1CombinedScore.combinedScore}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* H2 Sub-section Combined Scoring Summary Roll-up (Child Elements / Tables) */}
                      {activeBlock.titleFormat === 'H2' && (() => {
                        const { childElementsSummary, h2CombinedScore } = summarizeH2ChildElements(
                          activeBlock.title,
                          hierarchyGroups,
                          template.layoutBlocks,
                          sampleSubmission?.formData
                        );
                        if (!childElementsSummary || childElementsSummary.length === 0) return null;

                        return (
                          <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.6rem', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ border: '1px solid #bfdbfe', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', fontSize: '0.72rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: '6px 8px', fontWeight: 700, color: '#334155', alignItems: 'center' }}>
                                <div style={{ gridColumn: 'span 6', color: '#1e3a8a' }}>Items</div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'center', color: '#0f766e' }}>isPass</div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'right', paddingRight: '4px', color: '#4338ca' }}>Score</div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'right', paddingRight: '2px', color: '#64748b' }}>Weight</div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {childElementsSummary.map((elItem, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                                      padding: '5px 8px',
                                      alignItems: 'center',
                                      borderBottom: idx < childElementsSummary.length - 1 ? '1px solid #f1f5f9' : 'none'
                                    }}
                                  >
                                    <div style={{ gridColumn: 'span 6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#1e293b' }} title={`${elItem.elementTitle} (${elItem.fieldsCount} câu hỏi)`}>
                                      {elItem.elementTitle}
                                    </div>
                                    <div style={{ gridColumn: 'span 2', textAlign: 'center', fontWeight: 700, fontSize: '0.68rem', color: elItem.isPass ? '#0f766e' : '#e11d48' }}>
                                      {elItem.isPass ? 'PASS' : 'FAIL'}
                                    </div>
                                    <div style={{ gridColumn: 'span 2', textAlign: 'right', fontWeight: 700, color: '#0f172a', paddingRight: '4px' }}>
                                      {elItem.score}
                                    </div>
                                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '2px', paddingRight: '2px' }}>
                                      <SmartNumberInput
                                        disabled={isLocked}
                                        value={elItem.weight}
                                        min={0}
                                        max={100}
                                        onChange={(val) => handleUpdateChildElementWeight(elItem.elementTitle, elItem.blockId, val)}
                                        style={{ width: '32px', fontSize: '0.72rem', height: '22px' }}
                                      />
                                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>%</span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', padding: '6px 8px', alignItems: 'center', background: '#eff6ff', borderTop: '1px solid #bfdbfe' }}>
                                <div style={{ gridColumn: 'span 6' }}></div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: h2CombinedScore.isPass ? '#0f766e' : '#e11d48' }}>
                                  {h2CombinedScore.isPass ? 'PASS' : 'FAIL'}
                                </div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'right', paddingRight: '4px' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>
                                    {h2CombinedScore.combinedScore}
                                  </span>
                                </div>
                                <div style={{ gridColumn: 'span 2', textAlign: 'right', paddingRight: '2px' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: h2CombinedScore.totalWeight === 100 ? '#059669' : '#d97706' }} title={`Tổng trọng số = ${h2CombinedScore.totalWeight}%`}>
                                    ∑ {h2CombinedScore.totalWeight}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* TITLE Block Special Controls: Logo, Description, Date */}
                  {activeBlock.type === 'TITLE' && (
                    <>
                      <div style={{ borderBottom: '1.5px solid #e2e8f0', paddingBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.title || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setTemplate(prev => ({
                              ...prev,
                              reportTitle: val || prev.reportTitle,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, title: val } : b)
                            }));
                          }}
                          placeholder="Nhập tiêu đề báo cáo (VD: 5C SCORECARD)..."
                          style={{
                            width: '100%',
                            padding: 0,
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: '#1e293b',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            textTransform: 'uppercase'
                          }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', flexShrink: 0, userSelect: 'none' }} title="Đổi tiêu đề khối TITLE">✎</span>
                      </div>

                      {/* Logo Section */}
                      <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.6rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                          Logo Image
                        </label>
                        {activeBlock.logo ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ padding: '0.4rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70px' }}>
                              <img src={activeBlock.logo} alt="Logo preview" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setTemplate(prev => ({
                                  ...prev,
                                  layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, logo: undefined } : b)
                                }));
                              }}
                              style={{ padding: '0.25rem 0.5rem', background: '#ffffff', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Remove Logo
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <input
                              type="file"
                              accept="image/*"
                              id="report-logo-uploader"
                              style={{ display: 'none' }}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    const base64 = reader.result as string;
                                    setTemplate(prev => ({
                                      ...prev,
                                      layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, logo: base64 } : b)
                                    }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            <label
                              htmlFor="report-logo-uploader"
                              style={{
                                padding: '0.45rem',
                                border: '2px dashed var(--neutral-border)',
                                borderRadius: '6px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                background: '#f8fafc',
                                display: 'block',
                                fontSize: '0.75rem'
                              }}
                            >
                              + Upload Logo
                            </label>
                          </div>
                        )}
                      </div>

                      {/* Description Section */}
                      <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.6rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                          Description
                        </label>
                        <input
                          type="text"
                          value={activeBlock.description || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setTemplate(prev => ({
                              ...prev,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, description: val } : b)
                            }));
                          }}
                          placeholder="e.g. (kiểm tra trước khi xuất kho...)"
                          style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                        />
                      </div>

                      {/* Show Date Section */}
                      <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!activeBlock.showDate}
                            onChange={e => {
                              const checked = e.target.checked;
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, showDate: checked, datePosition: b.datePosition || 'B' } : b)
                              }));
                            }}
                          />
                          Hiển thị ô "Ngày"
                        </label>
                        {activeBlock.showDate && (
                          <div style={{ display: 'flex', border: '1px solid var(--neutral-border)', borderRadius: '4px', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setTemplate(prev => ({
                                  ...prev,
                                  layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, datePosition: 'A' } : b)
                                }));
                              }}
                              style={{ padding: '2px 6px', background: activeBlock.datePosition === 'A' ? 'var(--primary)' : '#ffffff', color: activeBlock.datePosition === 'A' ? '#ffffff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                              title="Góc trên bên phải"
                            >
                              Phải
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTemplate(prev => ({
                                  ...prev,
                                  layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, datePosition: 'B' } : b)
                                }));
                              }}
                              style={{ padding: '2px 6px', background: (activeBlock.datePosition ?? 'B') === 'B' ? 'var(--primary)' : '#ffffff', color: (activeBlock.datePosition ?? 'B') === 'B' ? '#ffffff' : 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                              title="Căn giữa bên dưới"
                            >
                              Giữa
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* INFO_GRID Special Controls */}
                  {activeBlock.type === 'INFO_GRID' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Columns</label>
                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '4px', padding: '1px', border: '1px solid #cbd5e1' }}>
                          {[1, 2, 3].map(cols => (
                            <button
                              key={cols}
                              type="button"
                              onClick={() => {
                                setTemplate(prev => ({
                                  ...prev,
                                  layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? {
                                    ...b,
                                    columns: cols as 1 | 2 | 3,
                                    columnWidths: cols === 2 ? [50, 50] : cols === 3 ? [33, 34, 33] : undefined
                                  } : b)
                                }));
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.72rem',
                                fontWeight: (activeBlock.columns || 2) === cols ? 700 : 500,
                                background: (activeBlock.columns || 2) === cols ? 'var(--primary)' : 'transparent',
                                color: (activeBlock.columns || 2) === cols ? '#ffffff' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              {cols}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stepped Splitter for 2 or 3 columns */}
                      {(activeBlock.columns === 2 || activeBlock.columns === 3) && (
                        <InfoGridSteppedSplitter
                          columns={activeBlock.columns}
                          columnWidths={activeBlock.columnWidths}
                          onChange={(widths) => {
                            setTemplate(prev => ({
                              ...prev,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, columnWidths: widths } : b)
                            }));
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* TABLE Special Controls: Combined Single-Row Border & Header (Biến thể 2A) */}
                  {activeBlock.type === 'TABLE' && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Border</label>
                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '4px', padding: '1px', border: '1px solid #cbd5e1' }}>
                          {[
                            { id: 'grid', label: 'Grid' },
                            { id: 'horizontal_only', label: 'Horiz' },
                            { id: 'borderless', label: 'None' }
                          ].map(styleOpt => (
                            <button
                              key={styleOpt.id}
                              type="button"
                              onClick={() => {
                                setTemplate(prev => ({
                                  ...prev,
                                  layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, borderStyle: styleOpt.id as any } : b)
                                }));
                              }}
                              style={{
                                padding: '2px 5px',
                                fontSize: '0.67rem',
                                fontWeight: (activeBlock.borderStyle || 'grid') === styleOpt.id ? 700 : 500,
                                background: (activeBlock.borderStyle || 'grid') === styleOpt.id ? 'var(--primary)' : 'transparent',
                                color: (activeBlock.borderStyle || 'grid') === styleOpt.id ? '#ffffff' : 'var(--text-secondary)',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              {styleOpt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Header</span>
                        <ToggleSwitch
                          checked={!(activeBlock.hideHeader ?? false)}
                          onChange={(show) => {
                            setTemplate(prev => ({
                              ...prev,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, hideHeader: !show } : b)
                            }));
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Bound Fields Manager for INFO_GRID and TABLE */}
                  {(activeBlock.type === 'INFO_GRID' || activeBlock.type === 'TABLE') && (
                    <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.6rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>CÁC TRƯỜNG ĐÃ GÁN ({(activeBlock.boundFieldIds || []).length})</span>
                      </div>
                      {(!activeBlock.boundFieldIds || activeBlock.boundFieldIds.length === 0) ? (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '6px' }}>
                          Chưa có trường nào được gán.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
                          {activeBlock.boundFieldIds.map((fid, fIdx) => {
                            const field = allFormFields.find(f => f.id === fid);
                            const override = activeBlock.ruleOverrides?.[fid];
                            const hasCustomLabel = override?.customLabel !== undefined && override.customLabel !== (field?.checkItem || fid);

                            return (
                              <div
                                key={fid}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 6px',
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem'
                                }}
                              >
                                <span style={{ fontWeight: 700, color: 'var(--text-secondary)', minWidth: '14px' }}>
                                  {fIdx + 1}.
                                </span>

                                {/* Custom Label Input with Placeholder & Reset Button */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, minWidth: 0 }}>
                                  <input
                                    type="text"
                                    placeholder={field?.checkItem || fid}
                                    value={override?.customLabel ?? ''}
                                    onChange={(e) => updateRuleOverride(fid, { customLabel: e.target.value === '' ? undefined : e.target.value })}
                                    style={{
                                      width: '100%',
                                      padding: '2px 4px',
                                      fontSize: '0.72rem',
                                      border: '1px solid var(--neutral-border)',
                                      borderRadius: '3px',
                                      outline: 'none',
                                      background: '#ffffff'
                                    }}
                                  />
                                  {hasCustomLabel && (
                                    <button
                                      type="button"
                                      onClick={() => updateRuleOverride(fid, { customLabel: undefined })}
                                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '1px', display: 'flex', alignItems: 'center' }}
                                      title="Khôi phục nhãn ban đầu"
                                    >
                                      <RotateCcw size={11} />
                                    </button>
                                  )}
                                </div>

                                {/* Right Unified Action Cluster */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                                  {activeBlock.type === 'INFO_GRID' && (
                                    <div title={!override?.hideLabel ? "Đang hiện nhãn" : "Đang ẩn nhãn"} style={{ display: 'flex', alignItems: 'center' }}>
                                      <ToggleSwitch
                                        checked={!override?.hideLabel}
                                        onChange={(show) => updateRuleOverride(fid, { hideLabel: !show })}
                                      />
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1px', borderLeft: '1px solid #cbd5e1', paddingLeft: '3px' }}>
                                    <button
                                      type="button"
                                      disabled={fIdx === 0}
                                      onClick={() => moveFieldInBlock(activeBlock.id, fIdx, 'up')}
                                      style={{ border: 'none', background: 'none', cursor: fIdx === 0 ? 'not-allowed' : 'pointer', color: fIdx === 0 ? '#cbd5e1' : '#64748b', padding: '1px 2px' }}
                                      title="Di chuyển lên"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      type="button"
                                      disabled={fIdx === (activeBlock.boundFieldIds?.length || 0) - 1}
                                      onClick={() => moveFieldInBlock(activeBlock.id, fIdx, 'down')}
                                      style={{ border: 'none', background: 'none', cursor: fIdx === (activeBlock.boundFieldIds?.length || 0) - 1 ? 'not-allowed' : 'pointer', color: fIdx === (activeBlock.boundFieldIds?.length || 0) - 1 ? '#cbd5e1' : '#64748b', padding: '1px 2px' }}
                                      title="Di chuyển xuống"
                                    >
                                      ↓
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeFieldFromBlock(activeBlock.id, fid)}
                                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', padding: '1px 2px' }}
                                      title="Gỡ trường"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* + Thêm trường Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setFieldPickerBlockId(activeBlock.id);
                          setFieldPickerSearch('');
                        }}
                        style={{
                          width: '100%',
                          padding: '5px',
                          border: '1px dashed var(--primary)',
                          borderRadius: '4px',
                          background: '#f0fdfa',
                          color: 'var(--primary)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Mở bảng chọn trường để gán vào khối này"
                      >
                        <Plus size={13} /> Thêm trường
                      </button>
                    </div>
                  )}

                  {/* H2 Sub-section Scoring Summary & Properties */}
                  {activeBlock.type === 'TABLE' && (() => {
                    const boundFields = (activeBlock.boundFieldIds || []).map(fid => allFormFields.find(f => f.id === fid)).filter(Boolean) as FormFieldISO[];
                    const h2EvalMap: Record<string, FieldEvaluationResult> = {};
                    boundFields.forEach(f => {
                      const subVal = sampleSubmission?.formData;
                      const rawVal = Array.isArray(subVal)
                        ? subVal.find((s: any) => s.id === f.id || s.fieldId === f.id)?.value
                        : (subVal ? (subVal as any)[f.id] : undefined);

                      const evalRes = evaluateFieldSpec(rawVal, f, activeBlock.ruleOverrides?.[f.id]);
                      h2EvalMap[f.id] = evalRes;
                    });

                    const h2Score = computeH2CombinedScore(boundFields, h2EvalMap, activeBlock.ruleOverrides);
                    const resolveParentH1Title = (): string => {
                      if (boundFields.length > 0) {
                        const f0 = boundFields[0];
                        if (f0.sectionH2 && f0.sectionH2.trim().length > 0) {
                          return `[H2] ${f0.sectionH2.trim()}`;
                        }
                        if (f0.sectionH1 && f0.sectionH1.trim().length > 0) {
                          return `[H1] ${f0.sectionH1.trim()}`;
                        }
                      }
                      const cleanTitle = (activeBlock.title || '').trim().toLowerCase();
                      if (cleanTitle) {
                        const matchingByLoc = allFormFields.find(f =>
                          (f.locationCode || '').split(' › ')[0].trim().toLowerCase() === cleanTitle
                        );
                        if (matchingByLoc) {
                          if (matchingByLoc.sectionH2 && matchingByLoc.sectionH2.trim().length > 0) {
                            return `[H2] ${matchingByLoc.sectionH2.trim()}`;
                          }
                          if (matchingByLoc.sectionH1 && matchingByLoc.sectionH1.trim().length > 0) {
                            return `[H1] ${matchingByLoc.sectionH1.trim()}`;
                          }
                        }
                      }
                      return 'Toàn bộ Báo cáo';
                    };
                    const parentH1Title = resolveParentH1Title();

                    return (
                      <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          TỔNG HỢP ĐIỂM BẢNG ĐÁNH GIÁ
                        </div>

                        {boundFields.length > 0 && (
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '6px 8px', fontSize: '0.7rem', fontWeight: 700, color: '#475569', alignItems: 'center' }}>
                              <div style={{ gridColumn: 'span 5' }}>Câu hỏi con</div>
                              <div style={{ gridColumn: 'span 2', textAlign: 'center', color: '#0f766e' }}>isPass</div>
                              <div style={{ gridColumn: 'span 3', textAlign: 'right', color: '#4338ca' }}>Score</div>
                              <div style={{ gridColumn: 'span 2', textAlign: 'right', color: '#64748b' }}>Weight</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              {boundFields.map((f, fIdx) => {
                                const evalRes = h2EvalMap[f.id];
                                const override = activeBlock.ruleOverrides?.[f.id];
                                const weight = override?.weight !== undefined ? override.weight : 0;

                                return (
                                  <div
                                    key={f.id}
                                    style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                                      padding: '5px 8px',
                                      alignItems: 'center',
                                      borderBottom: fIdx < boundFields.length - 1 ? '1px solid #f1f5f9' : 'none',
                                      fontSize: '0.72rem'
                                    }}
                                  >
                                    <div style={{ gridColumn: 'span 5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#1e293b' }} title={f.checkItem || f.id}>
                                      {f.checkItem || f.id}
                                    </div>
                                    <div style={{ gridColumn: 'span 2', textAlign: 'center', fontWeight: 700, fontSize: '0.68rem', color: evalRes?.status === 'PASS' ? '#0f766e' : '#e11d48' }}>
                                      {evalRes?.status === 'PASS' ? 'PASS' : 'FAIL'}
                                    </div>
                                    <div style={{ gridColumn: 'span 3', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                      {evalRes?.score ?? 0}
                                    </div>
                                    <div style={{ gridColumn: 'span 2', textAlign: 'right', fontWeight: 600, color: '#64748b' }}>
                                      {weight}%
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', padding: '7px 8px', alignItems: 'center', background: '#f5f3ff', borderTop: '1px solid #ddd6fe' }}>
                              <div style={{ gridColumn: 'span 5', fontWeight: 700, color: '#4c1d95', fontSize: '0.72rem' }}>Tổng Bảng:</div>
                              <div style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: h2Score.isPass ? '#0f766e' : '#e11d48' }}>
                                {h2Score.isPass ? 'PASS' : 'FAIL'}
                              </div>
                              <div style={{ gridColumn: 'span 5', textAlign: 'right' }}>
                                <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#2e1065', lineHeight: 1 }}>
                                  {h2Score.combinedScore}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Table Property Card: Row 1 [ ] isKnockout + Row 2 Weight [ xx ] % of {parentH1Title} */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '7px 9px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '0.72rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: isLocked ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                disabled={isLocked}
                                checked={Boolean(activeBlock.isKnockout)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setTemplate(prev => ({
                                    ...prev,
                                    layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, isKnockout: checked } : b)
                                  }));
                                }}
                                style={{ width: '13px', height: '13px', accentColor: '#e11d48', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                              />
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9f1239' }}>isKnockout (Bảng)</span>
                            </label>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>Loại trực tiếp</span>
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '5px',
                            paddingTop: '5px',
                            borderTop: '1px solid #e2e8f0'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155' }}>
                                Weight:
                              </span>
                              <SmartNumberInput
                                disabled={isLocked}
                                value={activeBlock.weight !== undefined ? activeBlock.weight : 0}
                                presets={[0, 10, 20, 25, 50, 100]}
                                min={0}
                                max={100}
                                onChange={(val) => {
                                  setTemplate(prev => ({
                                    ...prev,
                                    layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, weight: val } : b)
                                  }));
                                }}
                                style={{ width: '44px', fontSize: '0.72rem' }}
                              />
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>%</span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                minWidth: 0,
                                fontSize: '0.68rem',
                                color: '#475569',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                padding: '2px 5px',
                                maxWidth: '155px'
                              }}
                              title={parentH1Title}
                            >
                              <span style={{ color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>of</span>
                              <span style={{
                                fontWeight: 700,
                                color: 'var(--primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {parentH1Title}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
                      Report Properties
                    </h3>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                      Report Title
                    </label>
                    <input
                      type="text"
                      value={template.reportTitle}
                      onChange={e => setTemplate({ ...template, reportTitle: e.target.value })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', fontWeight: 600 }}
                      placeholder="Tiêu đề mẫu báo cáo..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Versions */}
          {rightTab === 'versions' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.8rem' }}>
              
              {/* Report ID Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Report ID</label>
                <input
                  type="text"
                  disabled={template.status === 'ACTIVE'}
                  value={template.reportId}
                  onChange={(e) => setTemplate({ ...template, reportId: e.target.value.toUpperCase() })}
                  placeholder="e.g. RP-QC-F01"
                  style={{
                    padding: '0.35rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--neutral-border)',
                    backgroundColor: template.status === 'ACTIVE' ? '#f1f5f9' : '#ffffff',
                    cursor: template.status === 'ACTIVE' ? 'not-allowed' : 'text',
                    fontWeight: 600
                  }}
                />
              </div>

              {/* Card 1: Version Control & Status */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--neutral-border, #cbd5e1)',
                borderRadius: '6px',
                padding: '0.85rem 1rem',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <GitBranch size={13} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                    Version Control
                  </span>
                </div>

                {template.status === 'ACTIVE' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {template.version}
                        </span>
                        <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', textTransform: 'uppercase', fontWeight: 700 }}>
                          Active
                        </span>
                      </div>
                      {template.effectiveDate && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          ({template.effectiveDate})
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
                          borderRadius: '4px',
                          color: '#dc2626',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fca5a5'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                      >
                        <Trash2 size={13} />
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
                                const suggested = generateReportChangeSummary(initialBlocks, template.layoutBlocks, template.revisionHistory);
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
                              <Sparkles size={11} /> Gợi ý tự động
                            </button>
                          </div>
                          <textarea 
                            value={changeSummary}
                            onChange={(e) => setChangeSummary(e.target.value)}
                            placeholder="Mô tả tóm tắt thay đổi..."
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
                              disabled={saving}
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
                                cursor: saving ? 'default' : 'pointer',
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

              {/* Card 2: Revision History & Audit Log */}
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

                {template.revisionHistory.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--neutral-border)', borderRadius: '5px' }}>
                    No version history available.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {template.revisionHistory.map((h, i) => {
                      const hasLayout = !!(h.layoutBlocks && h.layoutBlocks.length > 0);
                      const cleanTemplateVer = template.version.replace(/\s*\([^)]*\)/g, '').trim();
                      const isCurrentActive = h.version === cleanTemplateVer && template.status === 'ACTIVE';
                      const isCurrentDraft = h.version === cleanTemplateVer && template.status === 'DRAFT';
                      const itemStatus = isCurrentActive
                        ? 'ACTIVE'
                        : (h.status === 'ACTIVE'
                            ? 'ACTIVE'
                            : (isCurrentDraft || h.status === 'DRAFT' ? 'DRAFT' : 'RETIRED'));
                      
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
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, marginBottom: h.change ? '4px' : '0px' }}>
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
                          
                          {h.change && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', wordBreak: 'break-word', whiteSpace: 'pre-line', lineHeight: '1.25' }}>
                              {h.change}
                            </div>
                          )}
                          
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                            By: {h.author || 'Admin'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Print Preview Portal ── */}
      {showPrintPreview && (
        <PrintReport
          template={template}
          autoExportPdf={autoExportPdf}
          submission={sampleSubmission || {
            id: 'SAMPLE-001',
            processId: 'PROC-001',
            formId: template.linkedFormId,
            formVersion: 'v1.0',
            operatorId: 'Operator',
            submittedAt: new Date().toISOString(),
            status: 'PASS',
            formData: []
          }}
          formTemplate={selectedForm || {
            formId: template.linkedFormId,
            formTitle: 'Source Form',
            version: 'v1.0',
            status: 'ACTIVE',
            layoutBlocks: [],
            revisionHistory: []
          }}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* ── Quick Field Picker Modal ── */}
      {fieldPickerBlockId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setFieldPickerBlockId(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                <Plus size={16} color="var(--primary)" />
                Thêm trường vào khối
              </div>
              <button
                type="button"
                onClick={() => setFieldPickerBlockId(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', borderRadius: '4px', padding: '4px 8px' }}>
                <Search size={14} color="#64748b" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên trường hoặc ID..."
                  value={fieldPickerSearch}
                  onChange={(e) => setFieldPickerSearch(e.target.value)}
                  autoFocus
                  style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8rem' }}
                />
                {fieldPickerSearch && (
                  <button type="button" onClick={() => setFieldPickerSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem' }}>✕</button>
                )}
              </div>
            </div>

            {/* Field List */}
            <div style={{ padding: '0.6rem 1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(() => {
                const targetBlock = template.layoutBlocks.find(b => b.id === fieldPickerBlockId);
                const boundIds = targetBlock?.boundFieldIds || [];
                const q = fieldPickerSearch.toLowerCase().trim();

                const unassigned = allFormFields.filter(f => !boundIds.includes(f.id));
                const filtered = unassigned.filter(f => {
                  if (!q) return true;
                  return (
                    (f.checkItem || '').toLowerCase().includes(q) ||
                    (f.id || '').toLowerCase().includes(q) ||
                    (f.sectionH1 || '').toLowerCase().includes(q) ||
                    (f.sectionH2 || '').toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                      {allFormFields.length === 0
                        ? 'Chưa nạp được trường nào từ Biểu mẫu nguồn.'
                        : 'Tất cả các trường phù hợp đã được gán vào khối này.'}
                    </div>
                  );
                }

                const modalGroups = groupFieldsByHierarchy(filtered);

                return modalGroups.map(h1Group => {
                  const h1Key = `picker_h1_${h1Group.h1}`;
                  const isH1Expanded = q ? true : (expandedSections[h1Key] ?? true);
                  const allH1FieldIds = [
                    ...h1Group.h2Groups.flatMap(g => g.fields.map(f => f.id)),
                    ...h1Group.directElements.flatMap(e => e.fields.map(f => f.id))
                  ];

                  const renderPickerElementGroup = (elGroup: { elementTitle: string; fields: FormFieldISO[] }, parentKey: string) => {
                    const elKey = `${parentKey}_el_${elGroup.elementTitle}`;
                    const isElExpanded = q ? true : (expandedSections[elKey] ?? true);
                    const elFieldIds = elGroup.fields.map(f => f.id);

                    return (
                      <div key={elGroup.elementTitle} style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '3px 6px',
                            minHeight: '26px',
                            boxSizing: 'border-box',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}
                          onClick={() => toggleSectionExpand(elKey)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                            {isElExpanded ? <ChevronDown size={11} color="#64748b" /> : <ChevronRight size={11} color="#64748b" />}
                            <TableIcon size={11} color="#64748b" />
                            <span style={{ fontSize: '0.56rem', fontWeight: 700, padding: '0px 3px', borderRadius: '2px', background: '#e2e8f0', color: '#475569' }}>
                              TABLE
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.72rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {elGroup.elementTitle}
                            </span>
                            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>({elGroup.fields.length})</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addMultipleFieldsToBlock(fieldPickerBlockId, elFieldIds);
                            }}
                            style={{
                              padding: '1px 5px',
                              fontSize: '0.6rem',
                              background: '#ffffff',
                              color: 'var(--primary)',
                              border: '1px solid #cbd5e1',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            + Bảng ({elFieldIds.length})
                          </button>
                        </div>

                        {isElExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '8px', borderLeft: '1.5px dashed #cbd5e1', marginLeft: '4px' }}>
                            {elGroup.fields.map(field => {
                              const badgeStyle = getFieldBadgeStyle(field.type);
                              return (
                                <div
                                  key={field.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '4px 6px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '4px',
                                    background: '#ffffff',
                                    gap: '6px'
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={field.checkItem || field.id}>
                                      {field.checkItem || field.id}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontFamily: 'monospace', marginTop: '1px' }}>
                                      ID: {field.id.length > 24 ? `${field.id.substring(0, 10)}...${field.id.slice(-8)}` : field.id}
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '0.58rem', padding: '1px 4px', borderRadius: '3px', background: badgeStyle.bg, color: badgeStyle.color, fontWeight: 700, textTransform: 'uppercase' }}>
                                      {badgeStyle.label}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => addFieldToBlock(fieldPickerBlockId, field.id)}
                                      style={{
                                        padding: '2px 7px',
                                        background: 'var(--primary)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '3px',
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      + Gán
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div key={h1Group.h1} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', background: '#ffffff', overflow: 'hidden', flexShrink: 0 }}>
                      {/* H1 Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          minHeight: '34px',
                          boxSizing: 'border-box',
                          background: '#f8fafc',
                          borderBottom: isH1Expanded ? '1px solid #e2e8f0' : 'none',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        onClick={() => toggleSectionExpand(h1Key)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                          {isH1Expanded ? <ChevronDown size={13} color="#475569" /> : <ChevronRight size={13} color="#475569" />}
                          <Layers size={13} color="var(--primary)" />
                          <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h1Group.h1}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>({h1Group.totalFieldsCount})</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addMultipleFieldsToBlock(fieldPickerBlockId, allH1FieldIds);
                          }}
                          style={{
                            padding: '2px 7px',
                            fontSize: '0.65rem',
                            background: '#eff6ff',
                            color: 'var(--primary)',
                            border: '1px solid #bfdbfe',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            whiteSpace: 'nowrap'
                          }}
                          title={`Gán toàn bộ ${allH1FieldIds.length} trường của phần này`}
                        >
                          + Gán cả H1 ({allH1FieldIds.length})
                        </button>
                      </div>

                      {/* H1 Children */}
                      {isH1Expanded && (
                        <div style={{ padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {h1Group.h2Groups.map(h2Group => {
                            const h2Key = `picker_h2_${h1Group.h1}_${h2Group.h2}`;
                            const isH2Expanded = q ? true : (expandedSections[h2Key] ?? true);
                            const h2FieldIds = h2Group.fields.map(f => f.id);

                            return (
                              <div key={h2Group.h2} style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '4px 6px',
                                    minHeight: '28px',
                                    boxSizing: 'border-box',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                  }}
                                  onClick={() => toggleSectionExpand(h2Key)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
                                    {isH2Expanded ? <ChevronDown size={11} color="#2563eb" /> : <ChevronRight size={11} color="#2563eb" />}
                                    {isH2Expanded ? <FolderOpen size={12} color="#2563eb" /> : <Folder size={12} color="#2563eb" />}
                                    <span style={{ fontSize: '0.58rem', fontWeight: 800, padding: '0px 4px', borderRadius: '3px', background: '#dbeafe', color: '#1d4ed8' }}>
                                      H2
                                    </span>
                                    <span style={{ fontWeight: 700, fontSize: '0.74rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {h2Group.h2}
                                    </span>
                                    <span style={{ fontSize: '0.63rem', color: '#2563eb', fontWeight: 600 }}>({h2Group.fields.length})</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addMultipleFieldsToBlock(fieldPickerBlockId, h2FieldIds);
                                    }}
                                    style={{
                                      padding: '1px 5px',
                                      fontSize: '0.62rem',
                                      background: '#ffffff',
                                      color: '#2563eb',
                                      border: '1px solid #93c5fd',
                                      borderRadius: '3px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={`Gán toàn bộ ${h2FieldIds.length} trường của phân mục H2 này`}
                                  >
                                    + Cả H2 ({h2FieldIds.length})
                                  </button>
                                </div>

                                {isH2Expanded && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '10px', borderLeft: '2px solid #bfdbfe', marginLeft: '6px' }}>
                                    {h2Group.elements.map(elGroup => renderPickerElementGroup(elGroup, h2Key))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {h1Group.directElements.map(elGroup => renderPickerElementGroup(elGroup, h1Key))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div style={{ padding: '0.6rem 1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setFieldPickerBlockId(null)}
                style={{
                  padding: '4px 12px',
                  background: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ReportBuilder;