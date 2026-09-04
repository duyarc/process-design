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
  TitleFormatISO
} from '../types';
import { computeRecordReport } from '../utils/reportCompute';
import { extractAllFormFields } from '../utils/tableFieldExtractor';
import { getInfoGridTemplateColumns, snap2ColWidth, snap3ColWidths } from '../utils/formUtils';
import { applyTextFormat, handleFormatKeyDown } from '../utils/textFormatter';
import ConfirmModal from './common/ConfirmModal';
import PrintReport from './print/PrintReport';
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
  GitBranch
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
    case 'likert_scale': return { bg: '#f3e8ff', color: '#7e22ce', label: 'LIKERT' }; // Purple
    case 'rating': return { bg: '#fef3c7', color: '#b45309', label: 'RATING' };       // Amber
    case 'radio': return { bg: '#e0f2fe', color: '#0369a1', label: 'RADIO' };        // Sky
    case 'select': return { bg: '#e0f2fe', color: '#0369a1', label: 'DROPDOWN' };    // Sky
    case 'number': return { bg: '#ccfbf1', color: '#0f766e', label: 'NUMBER' };       // Teal
    case 'checkbox': return { bg: '#e0e7ff', color: '#4338ca', label: 'CHECKBOX' };   // Indigo
    default: return { bg: '#f1f5f9', color: '#475569', label: (type || 'TEXT').toUpperCase() }; // Slate
  }
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
  const [fieldPickerBlockId, setFieldPickerBlockId] = useState<string | null>(null);
  const [fieldPickerSearch, setFieldPickerSearch] = useState<string>('');
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
          const map = new Map<string, FormTemplateISO>();
          formsData.forEach((f: any) => {
            const fid = f.formId || f.form_id;
            if (!map.has(fid) || f.status === 'ACTIVE') {
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

          const targetFormId = initialFormId || template.linkedFormId || (formList[0]?.formId || '');
          if (targetFormId) {
            const matched = formList.find(f => f.formId === targetFormId) || formList[0];
            setSelectedForm(matched || null);
            setTemplate(prev => ({
              ...prev,
              linkedFormId: targetFormId,
              reportId: prev.reportId === 'RP-NEW' ? `RP-${targetFormId}` : prev.reportId
            }));
            fetchSubmissionsForForm(targetFormId);
          }
        }

        if (initialReportId) {
          const repRes = await fetch(`/api/reports/${initialReportId}`);
          if (repRes.ok) {
            const repData = await repRes.json();
            setTemplate(repData);
            setInitialBlocks(repData.layoutBlocks || []);
            setLastSavedSnapshot(getReportSnapshot(repData));
            if (repData.effectiveDate) setEffectiveDate(repData.effectiveDate);
            if (repData.linkedFormId) {
              fetchSubmissionsForForm(repData.linkedFormId);
            }
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
    setTemplate(prev => ({
      ...prev,
      linkedFormId: formId,
      reportId: prev.status === 'DRAFT' && prev.reportId.startsWith('RP-') ? `RP-${formId}` : prev.reportId
    }));
    fetchSubmissionsForForm(formId);
  };

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
    const newEntry: ReportRevisionEntry = {
      version: template.version,
      date: publishDate,
      author: 'Admin',
      change: activeSummary,
      status: 'ACTIVE',
      layoutBlocks: JSON.parse(JSON.stringify(template.layoutBlocks))
    };

    const updatedHistory = [newEntry, ...template.revisionHistory];

    try {
      setSaving(true);
      const payload: ReportTemplateISO = {
        ...template,
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

  const toggleFieldInBlock = (fieldId: string) => {
    if (!activeBlock) return;
    const current = activeBlock.boundFieldIds || [];
    const updated = current.includes(fieldId)
      ? current.filter(id => id !== fieldId)
      : [...current, fieldId];

    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b =>
        b.id === activeBlock.id ? { ...b, boundFieldIds: updated } : b
      )
    }));
  };

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
    if (!activeBlock) return;
    const overrides = { ...(activeBlock.ruleOverrides || {}) };
    overrides[fieldId] = {
      ...(overrides[fieldId] || { fieldId }),
      ...updates
    };

    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b =>
        b.id === activeBlock.id ? { ...b, ruleOverrides: overrides } : b
      )
    }));
  };

  const allFormFields: FormFieldISO[] = extractAllFormFields(selectedForm?.layoutBlocks || []);
  const filteredFormFields = allFormFields.filter(f =>
    (f.checkItem || '').toLowerCase().includes(searchFieldQuery.toLowerCase()) ||
    (f.id || '').toLowerCase().includes(searchFieldQuery.toLowerCase()) ||
    (f.locationCode || '').toLowerCase().includes(searchFieldQuery.toLowerCase())
  );

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
        {/* 1. LEFT: Identity & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <FileText size={18} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>Report Builder</h2>
          {template.status !== 'DRAFT' && (
            <span className={`badge ${template.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
              {template.status}
            </span>
          )}
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
        
        {/* ── LEFT PANEL: Source & Field Data Tray ── */}
        <div style={{ width: '280px', background: '#ffffff', borderRight: '1px solid var(--neutral-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--neutral-border)', background: '#f8fafc' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              1. SOURCE FORM
            </label>
            <select
              value={template.linkedFormId}
              onChange={e => handleFormChange(e.target.value)}
              style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
            >
              {availableForms.map(f => (
                <option key={f.formId} value={f.formId}>
                  {f.formId} - {f.formTitle}
                </option>
              ))}
            </select>
          </div>

          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--neutral-border)', background: '#ffffff' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              2. SAMPLE SUBMISSION
            </label>
            <select
              value={sampleSubmission?.id || ''}
              onChange={e => {
                const found = sampleSubmissions.find(s => s.id === e.target.value);
                if (found) setSampleSubmission(found);
              }}
              style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
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

          {/* Field Data Dictionary Tray */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                FIELDS ({allFormFields.length})
              </span>
            </div>
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

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {filteredFormFields.map(field => {
                const isBoundToActive = activeBlock?.boundFieldIds?.includes(field.id);
                const badgeStyle = getFieldBadgeStyle(field.type);

                return (
                  <div
                    key={field.id}
                    onClick={() => activeBlock && toggleFieldInBlock(field.id)}
                    style={{
                      padding: '0.45rem 0.6rem',
                      borderRadius: '4px',
                      border: `1px solid ${isBoundToActive ? 'var(--primary)' : 'var(--neutral-border)'}`,
                      background: isBoundToActive ? '#eff6ff' : '#ffffff',
                      cursor: activeBlock ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      gap: '0.5rem'
                    }}
                    title={activeBlock ? 'Click để thêm/bớt khỏi khối đang chọn' : 'Chọn một khối ở giữa để gán trường này'}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {field.checkItem || field.id}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.1rem' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          ID: {field.id.length > 24 ? `${field.id.substring(0, 10)}...${field.id.slice(-8)}` : field.id}
                        </span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.63rem',
                      padding: '0.12rem 0.35rem',
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
          </div>
        </div>

        {/* ── CENTER PANEL: Blank A4 Layout Canvas ── */}
        <div style={{ flex: 1, background: '#f1f5f9', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* A4 Sheet Container */}
          <div
            className="paper-card"
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
                    onClick={() => setActiveBlockId(block.id)}
                    style={{
                      border: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                      borderRadius: '6px',
                      padding: '0.5rem',
                      position: 'relative',
                      background: isActive ? 'rgba(16, 163, 163, 0.02)' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
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
                            {block.description && (
                              <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                {block.description}
                              </p>
                            )}
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
                          {block.description && (
                            <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                              {block.description}
                            </p>
                          )}
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
                        onSelectBlock={() => setActiveBlockId(block.id)}
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
                            onSelectBlock={() => setActiveBlockId(block.id)}
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

                                return (
                                  <div
                                    key={fid}
                                    style={{
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      padding: '6px 8px',
                                      background: '#ffffff',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: isLabelHidden ? 'center' : 'space-between',
                                      minHeight: '48px',
                                      position: 'relative'
                                    }}
                                  >
                                    {!isLabelHidden && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
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
                                              fontSize: '0.75rem',
                                              fontWeight: 600,
                                              color: 'var(--text-secondary)',
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
                                    <div style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 600, paddingLeft: '3px' }}>
                                      {val || '—'}
                                    </div>
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
                            onSelectBlock={() => setActiveBlockId(block.id)}
                          />

                          {(!block.boundFieldIds || block.boundFieldIds.length === 0) ? (
                            <div style={{ padding: '1rem', border: '1.5px dashed #cbd5e1', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', background: '#f8fafc' }}>
                              <div style={{ marginBottom: '6px' }}>Chưa có tiêu chí nào trong bảng đánh giá này.</div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveBlockId(block.id);
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
                                <thead>
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

                                  return (
                                    <tr key={fid} style={{ borderBottom: cellBorder }}>
                                      <td style={{ border: cellBorder, padding: '5px 6px', textAlign: 'center', color: '#64748b' }}>{rIdx + 1}</td>
                                      <td style={{ border: cellBorder, padding: '5px 8px' }}>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{displayLabel}</div>
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
              {activeBlock ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0 }}>
                      {activeBlock.type === 'TABLE' ? 'Table Properties' :
                       activeBlock.type === 'INFO_GRID' ? 'Info Grid Properties' :
                       activeBlock.type === 'SECTION_LABEL' ? 'Section Label Properties' :
                       activeBlock.type === 'SIGN' ? 'Signatures Properties' :
                       activeBlock.type === 'TITLE' ? 'Report Header Properties' : 'Block Properties'}
                    </h3>
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
                  </div>

                  {activeBlock.type === 'SECTION_LABEL' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mô tả phân đoạn (Description)</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            title="In đậm (Ctrl+B)"
                            disabled={isLocked}
                            onClick={() => applyTextFormat(sectionDescRef.current, 'bold', activeBlock.description || '', (val) => {
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, description: val } : b)
                              }));
                            })}
                            style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontWeight: 'bold', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            B
                          </button>
                          <button
                            type="button"
                            title="In nghiêng (Ctrl+I)"
                            disabled={isLocked}
                            onClick={() => applyTextFormat(sectionDescRef.current, 'italic', activeBlock.description || '', (val) => {
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, description: val } : b)
                              }));
                            })}
                            style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontStyle: 'italic', fontSize: '0.75rem', cursor: isLocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            I
                          </button>
                          <button
                            type="button"
                            title="Gạch chân (Ctrl+U)"
                            disabled={isLocked}
                            onClick={() => applyTextFormat(sectionDescRef.current, 'underline', activeBlock.description || '', (val) => {
                              setTemplate(prev => ({
                                ...prev,
                                layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, description: val } : b)
                              }));
                            })}
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
                        onKeyDown={(e) => handleFormatKeyDown(e, activeBlock.description || '', (val) => {
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, description: val } : b)
                          }));
                        })}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, description: val } : b)
                          }));
                        }}
                        placeholder="Nhập mô tả hoặc hướng dẫn..."
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.8rem', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }}
                      />
                    </div>
                  )}

                  {/* TITLE Block Special Controls: Logo, Description, Date */}
                  {activeBlock.type === 'TITLE' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tiêu đề báo cáo</label>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.title}
                          onChange={e => {
                            const val = e.target.value;
                            setTemplate(prev => ({
                              ...prev,
                              layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, title: val } : b)
                            }));
                          }}
                          placeholder="Nhập tiêu đề báo cáo..."
                          style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                        />
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

                  {/* TABLE Special Controls */}
                  {activeBlock.type === 'TABLE' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Border Style</label>
                        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '4px', padding: '1px', border: '1px solid #cbd5e1' }}>
                          {[
                            { id: 'grid', label: 'Grid' },
                            { id: 'horizontal_only', label: 'Horizontal' },
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
                                padding: '2px 6px',
                                fontSize: '0.68rem',
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

                      <ToggleSwitch
                        label="Header"
                        checked={!(activeBlock.hideHeader ?? false)}
                        onChange={(show) => {
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, hideHeader: !show } : b)
                          }));
                        }}
                      />
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

                  {/* Field Rules Override Section */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                      CẤU HÌNH QUY TẮC ĐÁNH GIÁ (HYBRID RULES)
                    </div>

                    {(activeBlock.boundFieldIds || []).map(fid => {
                      const field = allFormFields.find(f => f.id === fid);
                      const override = activeBlock.ruleOverrides?.[fid];
                      return (
                        <div key={fid} style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{field?.checkItem || fid}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                            Mặc định form: {field?.minSpec !== undefined ? `Min: ${field.minSpec}` : ''} {field?.maxSpec !== undefined ? `Max: ${field.maxSpec}` : ''} {field?.targetRange || ''}
                          </div>

                          {field?.type === 'number' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Custom Min</label>
                                <input
                                  type="number"
                                  placeholder={String(field?.minSpec ?? '')}
                                  value={override?.customMinSpec ?? ''}
                                  onChange={e => updateRuleOverride(fid, { customMinSpec: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                  style={{ width: '100%', padding: '0.2rem 0.35rem', fontSize: '0.75rem', border: '1px solid var(--neutral-border)', borderRadius: '3px' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Custom Max</label>
                                <input
                                  type="number"
                                  placeholder={String(field?.maxSpec ?? '')}
                                  value={override?.customMaxSpec ?? ''}
                                  onChange={e => updateRuleOverride(fid, { customMaxSpec: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                  style={{ width: '100%', padding: '0.2rem 0.35rem', fontSize: '0.75rem', border: '1px solid var(--neutral-border)', borderRadius: '3px' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                      const isCurrentActive = h.version === template.version && template.status === 'ACTIVE';
                      const isCurrentDraft = h.version === template.version && template.status === 'DRAFT';
                      const itemStatus = isCurrentActive ? 'ACTIVE' : (isCurrentDraft || h.status === 'DRAFT' ? 'DRAFT' : (h.status || 'RETIRED'));
                      
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
            <div style={{ padding: '0.5rem 1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(() => {
                const targetBlock = template.layoutBlocks.find(b => b.id === fieldPickerBlockId);
                const boundIds = targetBlock?.boundFieldIds || [];
                const q = fieldPickerSearch.toLowerCase().trim();

                const filtered = allFormFields.filter(f => {
                  if (boundIds.includes(f.id)) return false;
                  if (!q) return true;
                  return (
                    (f.checkItem || '').toLowerCase().includes(q) ||
                    (f.id || '').toLowerCase().includes(q)
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

                return filtered.map((field) => {
                  const badgeStyle = getFieldBadgeStyle(field.type);
                  return (
                    <div
                      key={field.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        background: '#ffffff',
                        gap: '8px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={field.checkItem || field.id}>
                          {field.checkItem || field.id}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontFamily: 'monospace', marginTop: '1px' }}>
                          ID: {field.id}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '3px', background: badgeStyle.bg, color: badgeStyle.color, fontWeight: 700, textTransform: 'uppercase' }}>
                          {badgeStyle.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => addFieldToBlock(fieldPickerBlockId, field.id)}
                          style={{
                            padding: '3px 8px',
                            background: 'var(--primary)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          + Gán
                        </button>
                      </div>
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