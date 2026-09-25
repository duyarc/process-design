import React from 'react';
import type { FormTemplateISO, LayoutBlockISO, FormFieldISO, SubtableColumn, ReportBlockConfig, Submission } from '../../types';
import { formatFormVersion, getColStyleWidth } from '../../types';
import {
  getEffectiveTitleFormat,
  isSeamlessTableBlock,
  getInfoGridTemplateColumns,
  getAutoCheckboxLayoutMode,
  hasLongOptions,
  getEffectiveCellOptions,
  canTableOptionsFitInline,
  extractSubmissionValue,
  isLikertSelected,
  isOptionSelected,
  formatOptionDisplay
} from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';
import { getTableFieldId, getTableRowPrimaryFieldId, isFieldInTableRow } from '../../utils/tableFieldExtractor';
import { FileText, ChevronDown, Star } from 'lucide-react';

interface FormReferenceCanvasProps {
  form: FormTemplateISO;
  sampleSubmission?: Submission | null;
  reportBlocks?: ReportBlockConfig[];
  pageSize?: string;
  selectedFieldId: string | null;
  activeBlockId?: string | null;
  activeGroupTitle?: string | null;
  onSelectField: (fieldId: string) => void;
  onSelectBlock?: (blockId: string) => void;
  onSelectTableGroup?: (groupTitle: string) => void;
  onSelectH1Section?: (h1Title: string) => void;
  onDeselect: () => void;
}

export const FormReferenceCanvas: React.FC<FormReferenceCanvasProps> = ({
  form,
  sampleSubmission,
  reportBlocks,
  pageSize: propPageSize,
  selectedFieldId,
  activeBlockId,
  activeGroupTitle,
  onSelectField,
  onSelectBlock,
  onSelectTableGroup,
  onSelectH1Section,
  onDeselect
}) => {
  const pageSize = propPageSize || form.pageSize || (form as any).page_size || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';
  const blocks = form.layoutBlocks || [];

  const renderTitleHeader = (block: LayoutBlockISO) => {
    const titleFmt = getEffectiveTitleFormat(block);
    if (titleFmt === 'NONE' || !block.title) return null;

    if (titleFmt === 'H1') {
      return (
        <div style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#0f172a',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          padding: '0.15rem 0.2rem',
          marginBottom: '0.5rem'
        }}>
          {renderFormattedText(block.title)}
        </div>
      );
    }
    if (titleFmt === 'H2') {
      return (
        <div style={{
          padding: '2px 0 2px 8px',
          borderLeft: '3px solid var(--primary)',
          fontSize: '0.92rem',
          fontWeight: 700,
          color: '#1e293b',
          marginBottom: '0.5rem'
        }}>
          {renderFormattedText(block.title)}
        </div>
      );
    }
    return (
      <div style={{
        padding: '0.1rem 0',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        borderBottom: '1px dotted #cbd5e1',
        marginBottom: '0.5rem'
      }}>
        {renderFormattedText(block.title)}
      </div>
    );
  };

  const renderFieldValue = (f: FormFieldISO, block: LayoutBlockISO) => {
    const subVal = extractSubmissionValue(sampleSubmission, f.id);
    const hasSubVal = subVal !== undefined && subVal !== null && subVal !== '';

    if (f.type === 'photo') {
      return (
        <div style={{
          flex: 1,
          border: '1.5px dashed #cbd5e1',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          background: '#fafafa',
          marginTop: '4px',
          color: '#475569',
          fontStyle: 'italic',
          fontSize: '0.78rem'
        }}>
          {f.placeholder || 'Ghi chú / hướng dẫn ảnh...'}
        </div>
      );
    }

    if (f.type === 'text' || f.type === 'number') {
      return (
        <div style={{ marginTop: '4px', width: '100%' }}>
          <div style={{
            width: '100%',
            padding: '3px 6px',
            fontSize: '0.78rem',
            fontStyle: hasSubVal ? 'normal' : 'italic',
            fontWeight: hasSubVal ? 600 : 400,
            color: hasSubVal ? '#0f172a' : f.placeholder ? '#475569' : '#94a3b8',
            background: hasSubVal ? '#f0fdfa' : '#f8fafc',
            border: hasSubVal ? '1px solid var(--primary)' : '1px dashed #cbd5e1',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}>
            {hasSubVal ? String(subVal) : (f.placeholder || (f.type === 'number' ? '[0]' : '[Nhập chữ...]'))}
          </div>
        </div>
      );
    }

    if (f.type === 'date' || f.type === 'time') {
      return (
        <div style={{ marginTop: '4px', width: '100%' }}>
          <div style={{
            width: '100%',
            padding: '3px 6px',
            fontSize: '0.78rem',
            fontStyle: hasSubVal ? 'normal' : 'italic',
            fontWeight: hasSubVal ? 600 : 400,
            color: hasSubVal ? '#0f172a' : '#94a3b8',
            background: hasSubVal ? '#f0fdfa' : '#f8fafc',
            border: hasSubVal ? '1px solid var(--primary)' : '1px dashed #cbd5e1',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}>
            {hasSubVal ? String(subVal) : (f.type === 'date' ? '[DD/MM/YYYY]' : f.timeMode === 'dual' ? '[Từ] ~ [Đến]' : '[HH:MM]')}
          </div>
        </div>
      );
    }

    if (f.type === 'rating' || f.type === 'likert_scale') {
      const isStars = f.likertVariant === 'stars' || (f.type as any) === 'rating';
      if (isStars) {
        const scale = f.ratingScale === 3 ? 3 : 5;
        const currentRating = parseInt(String(subVal), 10) || 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', paddingTop: '2px' }}>
            {Array.from({ length: scale }).map((_, idx) => {
              const isFilled = currentRating > 0 && idx < currentRating;
              return (
                <Star
                  key={idx}
                  size={16}
                  style={{
                    color: isFilled ? '#f59e0b' : '#cbd5e1',
                    fill: isFilled ? '#f59e0b' : '#fef3c7',
                    strokeWidth: 1.5
                  }}
                />
              );
            })}
            <span style={{ fontSize: '0.72rem', color: currentRating > 0 ? '#0f172a' : 'var(--text-muted)', marginLeft: '4px', fontWeight: currentRating > 0 ? 700 : 500 }}>
              {currentRating > 0 ? `(${currentRating}/${scale} sao)` : `(${scale} sao)`}
            </span>
          </div>
        );
      }
      const scales = f.scaleOptions && f.scaleOptions.length > 0 ? f.scaleOptions : ['1', '2', '3', '4', '5'];
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px', marginTop: '6px', paddingTop: '2px', width: '100%', overflowX: 'auto' }}>
          {scales.map((opt, idx) => {
            const isSelected = isLikertSelected(subVal, opt, idx);
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1, minWidth: '32px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.68rem', color: isSelected ? 'var(--primary)' : '#334155', fontWeight: isSelected ? 800 : 600 }}>{opt}</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '13px',
                  height: '13px',
                  borderRadius: '50%',
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : '#64748b'}`,
                  background: isSelected ? 'var(--primary)' : '#ffffff',
                  boxShadow: isSelected ? '0 0 0 2px rgba(13, 148, 136, 0.2)' : 'none'
                }}>
                  {isSelected && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ffffff' }} />}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    if (f.type === 'radio' || f.type === 'checkbox') {
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
          paddingLeft: isOptionC ? '0.5rem' : '0',
          maxWidth: '100%'
        }}>
          {options.map((opt: any, optIdx: number) => {
            const isChecked = isOptionSelected(subVal, opt.value || opt.label, f.type);
            return (
              <span key={opt.value || optIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: isChecked ? 'var(--primary)' : '#334155', fontWeight: isChecked ? 700 : 400 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '12px',
                  height: '12px',
                  border: `1.5px solid ${isChecked ? 'var(--primary)' : '#64748b'}`,
                  borderRadius: f.type === 'radio' ? '50%' : '2px',
                  background: isChecked ? 'var(--primary)' : '#ffffff',
                  boxShadow: isChecked ? '0 0 0 2px rgba(13, 148, 136, 0.2)' : 'none',
                  color: '#ffffff',
                  fontSize: '8px',
                  fontWeight: 900,
                  flexShrink: 0
                }}>
                  {isChecked && f.type === 'checkbox' ? '✓' : isChecked && f.type === 'radio' ? <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ffffff' }} /> : null}
                </span>
                <span>{opt.label}</span>
              </span>
            );
          })}
        </div>
      );
    }

    if (f.type === 'select') {
      const options = f.options ?? [{ label: 'Lựa chọn 1', value: 'OPT_1' }, { label: 'Lựa chọn 2', value: 'OPT_2' }];
      return (
        <div style={{ marginTop: '4px', paddingTop: '2px', width: '100%' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px',
            border: hasSubVal ? '1px solid var(--primary)' : '1px solid #cbd5e1',
            borderRadius: '4px',
            background: hasSubVal ? '#f0fdfa' : '#f8fafc',
            color: hasSubVal ? '#0f172a' : '#64748b',
            fontWeight: hasSubVal ? 600 : 400,
            fontSize: '0.78rem',
            width: '100%'
          }}>
            <span>{hasSubVal ? formatOptionDisplay(String(subVal), options) : f.placeholder || (options.length > 0 ? `-- Chọn (${options.length} mục) --` : '-- Chọn --')}</span>
            <ChevronDown size={14} style={{ color: hasSubVal ? 'var(--primary)' : '#94a3b8' }} />
          </div>
        </div>
      );
    }

    if (f.type === 'subtable') {
      const cols = f.subtableColumns ?? [];
      const previewRowCount = f.subtableDefaultRows ?? 3;
      return (
        <div style={{ marginTop: '2px', width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', background: '#fff' }}>
            <thead>
              <tr style={{ background: '#e2e8f0', borderBottom: '2px solid var(--primary)' }}>
                {cols.map((col: SubtableColumn) => (
                  <th key={col.id} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', fontWeight: 600, color: '#0f172a', textAlign: (col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'))) as any, width: col.width }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: previewRowCount }).map((_, rIdx) => (
                <tr key={rIdx}>
                  {cols.map((col: SubtableColumn) => {
                    const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'));
                    const val = col.type === 'static_text' ? (f.subtableStaticData?.[rIdx]?.[col.id] || '') : (col.type === 'number' ? '[0]' : col.type === 'date' ? '[Ngày]' : col.type === 'time' ? '[Giờ]' : '[Nhập chữ]');
                    return (
                      <td key={col.id} style={{ border: '1px solid #e2e8f0', padding: '4px 6px', height: '24px', color: col.type === 'static_text' ? '#0f172a' : '#94a3b8', fontStyle: col.type === 'static_text' ? 'normal' : 'italic', fontSize: '0.68rem', textAlign: cellAlign as any, fontWeight: col.type === 'static_text' ? 600 : 400 }}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      onClick={onDeselect}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        cursor: 'default',
        boxSizing: 'border-box'
      }}
    >
      {/* Paper Container matching FormBuilder WYSIWYG */}
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onDeselect();
          }
        }}
        style={{
          width: '100%',
          maxWidth: isA5 ? '920px' : '820px',
          minHeight: isA5 ? '650px' : '1050px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.04)',
          padding: '1.75rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0px',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {blocks.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '3rem', textAlign: 'center' }}>
            <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Biểu mẫu chưa có nội dung</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Form nguồn chưa thiết lập các khối layout.</p>
          </div>
        ) : (
          blocks.map((block, index) => {
            const formInfoGrids = blocks.filter(b => b.type === 'INFO_GRID');
            const formInfoGridIdx = block.type === 'INFO_GRID' ? formInfoGrids.findIndex(b => b.id === block.id) : -1;
            const reportInfoGrids = (reportBlocks || []).filter(rb => rb.type === 'INFO_GRID');

            const matchedReportBlock = reportBlocks?.find(rb => {
              if (rb.id === block.id) return true;
              if (block.type === 'TITLE' && rb.type === 'TITLE') return true;
              if (block.type === 'SECTION_LABEL' && rb.type === 'SECTION_LABEL') {
                return rb.title.trim().toLowerCase() === (block.title || '').trim().toLowerCase();
              }
              if (block.type === 'INFO_GRID' && rb.type === 'INFO_GRID') {
                const blockFieldIds = (block.fields || []).map(f => f.id);
                if (blockFieldIds.length > 0 && rb.boundFieldIds?.some(fid => blockFieldIds.includes(fid))) {
                  return true;
                }
                return false;
              }
              if (block.type === 'TABLE' && rb.type === 'TABLE') {
                const blockTableFieldIds = (block.tableRows || []).flatMap(r => (block.tableColumns || []).map(c => getTableFieldId(block.id, r.id, c.id)));
                if (blockTableFieldIds.length > 0 && rb.boundFieldIds?.some(fid => blockTableFieldIds.includes(fid))) {
                  return true;
                }
                return (rb.title || '').trim().toLowerCase() === (block.title || '').trim().toLowerCase();
              }
              if (block.type === 'SIGN' && rb.type === 'SIGN') return true;
              return false;
            }) || (block.type === 'INFO_GRID' && formInfoGridIdx >= 0 ? reportInfoGrids[formInfoGridIdx] : undefined);

            const isBlockActive = block.id === activeBlockId || (Boolean(activeBlockId) && matchedReportBlock?.id === activeBlockId);
            const prevBlock = index > 0 ? blocks[index - 1] : undefined;
            const nextBlock = index < blocks.length - 1 ? blocks[index + 1] : undefined;
            const isSeamless = isSeamlessTableBlock(block, prevBlock);
            const isFollowedBySeamless = nextBlock ? isSeamlessTableBlock(nextBlock, block) : false;

            // Step 1: Build Layout Block Shell (matching FormBuilder 2-step architecture)
            const renderLayoutBlockShell = (content: React.ReactNode, customOnClick?: (e: React.MouseEvent) => void) => (
              <div
                key={block.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (customOnClick) {
                    customOnClick(e);
                  } else {
                    onSelectBlock?.(block.id);
                  }
                }}
                style={{
                  border: isBlockActive ? '2px solid var(--primary)' : '1px dashed #cbd5e1',
                  borderTop: isSeamless && !isBlockActive ? '1px dashed transparent' : undefined,
                  borderRadius: isSeamless && isFollowedBySeamless ? '0px' : isSeamless ? '0 0 6px 6px' : isFollowedBySeamless ? '6px 6px 0 0' : '6px',
                  padding: block.type === 'SECTION_LABEL' ? '0.35rem 0.65rem' : '0.85rem',
                  marginTop: '0px',
                  position: 'relative',
                  background: isBlockActive ? 'rgba(16, 163, 163, 0.02)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {/* Floating Layout Block Type Badge (matching FormBuilder) */}
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  background: '#ffffff',
                  padding: '0 5px',
                  fontSize: '0.62rem',
                  zIndex: 10
                }}>
                  <span style={{ fontWeight: 700, color: isBlockActive ? 'var(--primary)' : 'var(--text-muted)', letterSpacing: '0.3px' }}>
                    {block.type}
                  </span>
                </div>

                {/* Step 2: Content Filled into Layout Block */}
                <div style={{ marginTop: '0.25rem' }}>
                  {content}
                </div>
              </div>
            );

            // 1. TITLE BLOCK (Step 1: Title Block Layout Slots -> Step 2: Fill Content from Form & Report)
            if (block.type === 'TITLE') {
              const effectiveTitle = (matchedReportBlock?.title && matchedReportBlock.title !== 'BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG'
                ? matchedReportBlock.title
                : block.title) || form.formTitle || form.formId || 'TÊN BIỂU MẪU';
              const effectiveDesc = (matchedReportBlock?.description !== undefined && matchedReportBlock.description !== '')
                ? matchedReportBlock.description
                : (block.description || (block.fields?.[0]?.checkItem) || '');
              const effectiveLogo = matchedReportBlock?.logo || block.logo;
              const effectiveShowDate = matchedReportBlock?.showDate !== undefined ? matchedReportBlock.showDate : block.showDate;
              const effectiveDatePos = matchedReportBlock?.datePosition || block.datePosition || 'B';
              const hasLogo = Boolean(effectiveLogo);
              const logoSrc = effectiveLogo && (effectiveLogo.startsWith('http') || effectiveLogo.startsWith('data:') || effectiveLogo.startsWith('/')) ? effectiveLogo : null;

              return renderLayoutBlockShell(
                hasLogo ? (
                  <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', marginBottom: '10px', position: 'relative' }}>
                    <div style={{ marginRight: '20px', display: 'flex', alignItems: 'center', height: '65px' }}>
                      {logoSrc ? (
                        <img src={logoSrc} alt="Logo" style={{ maxHeight: '65px', maxWidth: '260px', objectFit: 'contain' }} />
                      ) : (
                        <div style={{
                          width: '100px',
                          height: '50px',
                          border: '1px dashed #cbd5e1',
                          borderRadius: '4px',
                          background: '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: '#64748b'
                        }}>
                          LOGO
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <h1 style={{ margin: '0 0 2px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                        {effectiveTitle}
                      </h1>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        {effectiveDesc || '(mô tả ngắn kiểm tra)'}
                      </p>
                      {effectiveShowDate && effectiveDatePos === 'B' && (
                        <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                          <span style={{ fontWeight: 600 }}>Ngày</span>
                          <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
                            &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;
                          </span>
                        </div>
                      )}
                    </div>
                    {effectiveShowDate && effectiveDatePos === 'A' && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                        <span style={{ fontWeight: 600 }}>Ngày</span>
                        <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
                          &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '10px 0', textAlign: 'center', marginBottom: '10px', position: 'relative' }}>
                    {effectiveShowDate && effectiveDatePos === 'A' && (
                      <div style={{ position: 'absolute', right: 0, top: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>Ngày</span>
                        <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
                          &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;
                        </span>
                      </div>
                    )}
                    <h1 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                      {effectiveTitle}
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      {effectiveDesc || '(mô tả ngắn kiểm tra)'}
                    </p>
                    {effectiveShowDate && effectiveDatePos === 'B' && (
                      <div style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>Ngày</span>
                        <span style={{ marginLeft: '6px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
                          &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;
                        </span>
                      </div>
                    )}
                  </div>
                )
              );
            }

            // 2. SECTION LABEL BLOCK (H1 / H2 / BODY)
            if (block.type === 'SECTION_LABEL') {
              const titleFmt = getEffectiveTitleFormat(block);
              if (titleFmt === 'NONE') return null;

              return renderLayoutBlockShell(
                <div style={{ marginBottom: '0.25rem' }}>
                  {titleFmt === 'H1' ? (
                    <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                        padding: '0.15rem 0.2rem'
                      }}>
                        {renderFormattedText(block.title || 'TIÊU ĐỀ PHÂN ĐOẠN')}
                      </div>
                    ) : titleFmt === 'H2' ? (
                      <div style={{
                        padding: '2px 0 2px 8px',
                        borderLeft: '3px solid var(--primary)',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: '#1e293b'
                      }}>
                        {renderFormattedText(block.title || 'Tiêu đề phân đoạn')}
                      </div>
                    ) : (
                      <div style={{
                        padding: '0.1rem 0',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        borderBottom: '1px dotted #cbd5e1'
                      }}>
                        {renderFormattedText(block.title || '')}
                      </div>
                    )}
                    {block.description && (
                      <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, padding: '0.2rem 0.35rem', marginTop: '2px' }}>
                        {renderFormattedText(block.description)}
                      </div>
                    )}
                  </div>,
                  () => {
                    if (titleFmt === 'H1' && onSelectH1Section && block.title) {
                      onSelectH1Section(block.title);
                    } else {
                      onSelectBlock?.(block.id);
                    }
                  }
                );
              }

            // 3. INFO GRID BLOCK (Step 1: Build Layout Block & Grid Columns -> Step 2: Arrange Fields into Slots)
            if (block.type === 'INFO_GRID') {
              const effectiveBlock: LayoutBlockISO = matchedReportBlock ? {
                ...block,
                title: matchedReportBlock.title !== undefined ? matchedReportBlock.title : block.title,
                titleFormat: matchedReportBlock.titleFormat !== undefined ? matchedReportBlock.titleFormat : block.titleFormat,
                columns: matchedReportBlock.columns || block.columns,
                columnWidths: matchedReportBlock.columnWidths || block.columnWidths,
                borderStyle: matchedReportBlock.borderStyle || block.borderStyle,
                hideHeader: matchedReportBlock.hideHeader ?? block.hideHeader
              } : block;
              const gridCols = getInfoGridTemplateColumns(effectiveBlock);
              const allBlockFields = block.fields || [];
              const orderedFields = (matchedReportBlock?.boundFieldIds && matchedReportBlock.boundFieldIds.length > 0)
                ? matchedReportBlock.boundFieldIds
                    .map(fid => allBlockFields.find(f => f.id === fid))
                    .filter((f): f is FormFieldISO => Boolean(f))
                : allBlockFields;
              const fieldsToRender = orderedFields.length > 0 ? orderedFields : allBlockFields;

              return renderLayoutBlockShell(
                <>
                  {renderTitleHeader(effectiveBlock)}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: gridCols,
                    columnGap: '0.75rem',
                    rowGap: '0.5rem',
                    gridAutoRows: 'minmax(38px, auto)'
                  }}>
                    {fieldsToRender.map((f) => {
                      const isFieldSelected = f.id === selectedFieldId;
                      const override = matchedReportBlock?.ruleOverrides?.[f.id];
                      const displayLabel = override?.customLabel !== undefined
                        ? override.customLabel
                        : (f.checkItem || '(Chưa đặt tên trường)');
                      const parsedRSpan = f.type === 'subtable' ? undefined : (f.rowSpan ? Number(f.rowSpan) : undefined);
                      const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
                      const cSpan = f.type === 'subtable' ? -1 : (f.colSpan ? Number(f.colSpan) : undefined);

                      return (
                        <div
                          key={f.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectField(f.id);
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
                            background: isFieldSelected ? 'rgba(13, 148, 136, 0.05)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          {!override?.hideLabel && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
                              <span style={{
                                fontWeight: f.type === 'label' ? 400 : 600,
                                fontSize: '0.8rem',
                                lineHeight: 1.4,
                                color: 'var(--text-primary)',
                                wordBreak: 'break-word'
                              }}>
                                {displayLabel}
                              </span>
                            </div>
                          )}
                          {renderFieldValue(f, effectiveBlock)}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            }

            // 4. TABLE BLOCK
            if (block.type === 'TABLE') {
              const bStyle = block.borderStyle || 'grid';
              const tableCols = block.tableColumns || [];
              const tableRows = block.tableRows || [];

              return renderLayoutBlockShell(
                <>
                  {renderTitleHeader(block)}
                  <div style={{
                    overflowX: 'auto',
                    border: bStyle === 'borderless' ? '1px dashed #e2e8f0' : '1px solid #cbd5e1',
                    borderRadius: '4px',
                    background: bStyle === 'borderless' ? '#ffffff' : 'inherit'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' }}>
                      <colgroup>
                        {tableCols.map((col) => {
                          const colWidth = getColStyleWidth(col.id, col.width, tableCols);
                          return <col key={col.id} style={{ width: colWidth }} />;
                        })}
                      </colgroup>
                      <thead
                        onClick={(e) => {
                          const hasGroupHeaders = tableRows.some(r => r.isGroupHeader || block.tableData?.[r.id]?.['_groupTitle']);
                          if (!hasGroupHeaders) {
                            e.stopPropagation();
                            onSelectBlock?.(block.id);
                          }
                        }}
                        style={{ opacity: block.hideHeader ? 0.45 : 1, cursor: tableRows.some(r => r.isGroupHeader) ? 'default' : 'pointer' }}
                      >
                        <tr style={{
                          background: bStyle === 'borderless' ? (block.hideHeader ? '#f8fafc' : 'transparent') : '#f1f5f9',
                          borderBottom: bStyle === 'borderless' ? (block.hideHeader ? '1px dashed #cbd5e1' : 'none') : (block.hideHeader ? '1px dashed #94a3b8' : '1px solid #cbd5e1')
                        }}>
                          {tableCols.map((col) => {
                            const colWidth = getColStyleWidth(col.id, col.width, tableCols);
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
                                  boxSizing: 'border-box',
                                  textAlign: headerAlign as any
                                }}
                              >
                                {col.type === 'likert_scale' ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(col.scaleOptions || []).length || 3}, 1fr)`, gap: '4px', textAlign: 'center', width: '100%' }}>
                                    {(col.scaleOptions || ['1', '2', '3']).map((opt, sIdx) => (
                                      <div key={sIdx} style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', textAlign: 'center' }}>
                                        {opt}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35, color: '#0f172a', textAlign: headerAlign as any }}>
                                    {col.label}
                                  </div>
                                )}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.length === 0 ? (
                          <tr>
                            <td colSpan={tableCols.length} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Không có dòng nào trong bảng.
                            </td>
                          </tr>
                        ) : (
                          tableRows.map((row, rIdx) => {
                            const rowPrimaryFieldId = getTableRowPrimaryFieldId(block, row.id);
                            const isRowActive = isFieldInTableRow(selectedFieldId, block.id, row.id);
                            if (row.isGroupHeader) {
                              const groupTitleVal = row.groupTitle !== undefined ? row.groupTitle : (block.tableData?.[row.id]?.['_groupTitle'] || '');
                              const cleanGroupTitle = groupTitleVal.replace(/^\*\*|\*\*$/g, '').trim();
                              const isGroupActive = !selectedFieldId && !!activeGroupTitle && cleanGroupTitle.toLowerCase() === activeGroupTitle.trim().toLowerCase();

                              return (
                                <tr
                                  key={row.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectTableGroup) {
                                      onSelectTableGroup(cleanGroupTitle);
                                    } else {
                                      onSelectBlock?.(block.id);
                                    }
                                  }}
                                  style={{
                                    borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1',
                                    borderLeft: isGroupActive ? '4px solid #2563eb' : 'none',
                                    background: isGroupActive ? '#eff6ff' : (bStyle === 'borderless' ? 'transparent' : '#f8fafc'),
                                    cursor: 'pointer',
                                    transition: 'all 0.12s ease'
                                  }}
                                  title={`Click để xem/cấu hình Table Properties cho nhóm: ${cleanGroupTitle}`}
                                >
                                  <td
                                    colSpan={tableCols.length}
                                    style={{
                                      padding: '6px 10px',
                                      verticalAlign: 'middle',
                                      fontWeight: 700,
                                      fontSize: '0.82rem',
                                      color: isGroupActive ? '#1d4ed8' : '#1e293b'
                                    }}
                                  >
                                    {groupTitleVal || 'Nhóm tiêu chí'}
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr
                                key={row.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (rowPrimaryFieldId) {
                                    onSelectField(rowPrimaryFieldId);
                                  }
                                }}
                                style={{
                                  borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1',
                                  borderLeft: isRowActive ? '3px solid var(--primary)' : 'none',
                                  background: isRowActive ? 'rgba(13, 148, 136, 0.08)' : (rIdx % 2 === 1 ? '#fafafa' : '#ffffff'),
                                  cursor: rowPrimaryFieldId ? 'pointer' : 'default',
                                  transition: 'background 0.12s ease'
                                }}
                              >
                                {tableCols.map((col, cIdx) => {
                                  const cellFieldId = getTableFieldId(block.id, row.id, col.id);
                                  const subVal = extractSubmissionValue(sampleSubmission, cellFieldId);
                                  const hasSubVal = subVal !== undefined && subVal !== null && subVal !== '';
                                  const cellOptions = getEffectiveCellOptions(block.cellOptionsMap, row.id, col.id, col.options);
                                  const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' || col.type === 'likert_scale' ? 'center' : 'left'));
                                  const rowData = block.tableData?.[row.id] || {};
                                  const cellValue = rowData[col.id];

                                  let content: React.ReactNode = null;
                                  if (col.id === 'col_stt' || (cIdx === 0 && col.label === 'STT')) {
                                    content = <span style={{ fontWeight: 600 }}>{rIdx + 1}</span>;
                                  } else if (col.type === 'checkbox' || col.type === 'radio') {
                                    const opts = cellOptions.length > 0 ? cellOptions : (col.options || [{ label: 'Đạt', value: 'PASS' }, { label: 'KĐ', value: 'FAIL' }]);
                                    const canInline = canTableOptionsFitInline(opts, col.width, col.checkboxLayout);
                                    content = (
                                      <div style={{ display: 'flex', flexDirection: canInline ? 'row' : 'column', gap: canInline ? '8px' : '3px', alignItems: canInline ? 'center' : 'flex-start', flexWrap: 'wrap', justifyContent: cellAlign === 'center' ? 'center' : 'flex-start' }}>
                                        {opts.map((opt, oIdx) => {
                                          const isChecked = isOptionSelected(subVal, opt.value || opt.label, col.type);
                                          return (
                                            <span key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', color: isChecked ? 'var(--primary)' : '#334155', fontWeight: isChecked ? 700 : 400 }}>
                                              <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '11px',
                                                height: '11px',
                                                borderRadius: col.type === 'radio' ? '50%' : '2px',
                                                border: `1.2px solid ${isChecked ? 'var(--primary)' : '#64748b'}`,
                                                background: isChecked ? 'var(--primary)' : '#fff',
                                                boxShadow: isChecked ? '0 0 0 2px rgba(13, 148, 136, 0.2)' : 'none',
                                                color: '#fff',
                                                fontSize: '8px',
                                                fontWeight: 900
                                              }}>
                                                {isChecked && col.type === 'checkbox' ? '✓' : isChecked && col.type === 'radio' ? <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#fff' }} /> : null}
                                              </span>
                                              <span>{opt.label}</span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    );
                                  } else if (col.type === 'rating') {
                                    const scale = col.ratingScale === 3 ? 3 : 5;
                                    const currentRating = parseInt(String(subVal), 10) || 0;
                                    content = (
                                      <div style={{ display: 'flex', justifyContent: cellAlign === 'center' ? 'center' : 'flex-start', gap: '2px' }}>
                                        {Array.from({ length: scale }).map((_, sIdx) => {
                                          const isFilled = currentRating > 0 && sIdx < currentRating;
                                          return (
                                            <Star
                                              key={sIdx}
                                              size={13}
                                              style={{
                                                color: isFilled ? '#f59e0b' : '#94a3b8',
                                                fill: isFilled ? '#f59e0b' : '#fef3c7'
                                              }}
                                            />
                                          );
                                        })}
                                      </div>
                                    );
                                  } else if (col.type === 'likert_scale') {
                                    const count = (col.scaleOptions || []).length || 3;
                                    const scales = col.scaleOptions && col.scaleOptions.length > 0 ? col.scaleOptions : Array.from({ length: count }, (_, i) => String(i + 1));
                                    content = (
                                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: '4px', textAlign: 'center' }}>
                                        {scales.map((opt, lIdx) => {
                                          const isSelected = isLikertSelected(subVal, opt, lIdx);
                                          return (
                                            <div key={lIdx} style={{ display: 'flex', justifyContent: 'center' }}>
                                              {isSelected ? (
                                                <span
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '13px',
                                                    height: '13px',
                                                    borderRadius: '50%',
                                                    border: '1.5px solid var(--primary)',
                                                    background: 'var(--primary)',
                                                    boxShadow: '0 0 0 2px rgba(13, 148, 136, 0.2)'
                                                  }}
                                                  title={`Đã chọn: ${opt}`}
                                                >
                                                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ffffff' }} />
                                                </span>
                                              ) : (
                                                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', border: '1.2px solid #64748b', background: '#fff' }} />
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  } else if (hasSubVal) {
                                    content = <span style={{ color: '#0f172a', fontWeight: 600 }}>{String(subVal)}</span>;
                                  } else if (col.type === 'select') {
                                    content = <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>-- Chọn --</span>;
                                  } else if (col.type === 'date') {
                                    content = <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>[Ngày]</span>;
                                  } else if (col.type === 'time') {
                                    content = <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>[Giờ]</span>;
                                  } else if (cellValue !== undefined && cellValue !== '') {
                                    content = <span style={{ color: '#0f172a' }}>{cellValue}</span>;
                                  } else if (col.type === 'number') {
                                    content = <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.7rem' }}>[0]</span>;
                                  } else {
                                    content = <span style={{ color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.7rem' }}>—</span>;
                                  }

                                  const isCellInput = col.type !== 'static_text' && col.id !== 'col_stt' && col.label?.toLowerCase() !== 'stt';
                                  const isCellActive = selectedFieldId === cellFieldId;

                                  return (
                                    <td
                                      key={col.id}
                                      onClick={isCellInput ? (e) => {
                                        e.stopPropagation();
                                        onSelectField(cellFieldId);
                                      } : undefined}
                                      style={{
                                        padding: '4px 6px',
                                        borderRight: bStyle === 'grid' ? '1px solid #cbd5e1' : 'none',
                                        borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1',
                                        textAlign: cellAlign as any,
                                        verticalAlign: 'middle',
                                        fontSize: '0.75rem',
                                        cursor: isCellInput ? 'pointer' : 'inherit',
                                        background: isCellActive ? 'rgba(13, 148, 136, 0.14)' : undefined,
                                        boxShadow: isCellActive ? 'inset 0 0 0 1.5px var(--primary)' : undefined
                                      }}
                                    >
                                      {content}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>,
                () => {
                  onSelectBlock?.(block.id);
                }
              );
            }

            // 5. CHECKLIST TABLE BLOCK
            if (block.type === 'CHECKLIST_TABLE') {
              const checklistCols = [
                { id: 'col_stt', label: 'STT', width: '45px', align: 'center' },
                { id: 'col_item', label: 'Hạng mục kiểm tra', align: 'left' },
                { id: 'col_unit', label: 'ĐVT', width: '60px', align: 'center' },
                { id: 'col_spec', label: 'Tiêu chuẩn', width: '120px', align: 'left' },
                { id: 'col_target', label: 'Kết quả', width: '140px', align: 'center' },
                { id: 'col_reaction', label: 'Hành động khắc phục', width: '140px', align: 'left' }
              ];

              return renderLayoutBlockShell(
                <>
                  {renderTitleHeader(block)}
                  <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                          {checklistCols.map((col) => (
                            <th
                              key={col.id}
                              style={{
                                padding: '4px 6px',
                                textAlign: col.align as any,
                                width: col.width
                              }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(block.fields || []).length === 0 ? (
                          <tr>
                            <td colSpan={checklistCols.length} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Chưa có hạng mục kiểm tra nào.
                            </td>
                          </tr>
                        ) : (
                          (block.fields || []).map((f, fIdx) => {
                            const isFieldActive = f.id === selectedFieldId;
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

                            return (
                              <tr
                                key={f.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectField(f.id);
                                }}
                                style={{
                                  borderBottom: '1px solid #e2e8f0',
                                  background: isFieldActive ? 'rgba(16, 163, 163, 0.05)' : 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <td style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'center' }}>{fIdx + 1}</td>
                                <td style={{ padding: '4px 6px' }}>{f.checkItem}</td>
                                <td style={{ padding: '4px 6px', color: 'var(--text-secondary)', textAlign: 'center' }}>{f.unit || ''}</td>
                                <td style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{specText}</td>
                                <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                  {(() => {
                                    const chkVal = extractSubmissionValue(sampleSubmission, f.id);
                                    if (f.type === 'radio' || f.type === 'checkbox') {
                                      return (
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                          {(f.options ?? [{ label: 'Đạt', value: 'PASS' }, { label: 'KĐ', value: 'FAIL' }]).map(opt => {
                                            const isChecked = isOptionSelected(chkVal, opt.value || opt.label, f.type);
                                            return (
                                              <span key={opt.value} style={{
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                padding: '0 5px', height: '16px', borderRadius: '8px',
                                                border: `1px solid ${isChecked ? 'var(--primary)' : '#cbd5e1'}`, fontSize: '0.6rem',
                                                background: isChecked ? 'var(--primary)' : 'transparent',
                                                color: isChecked ? '#ffffff' : 'var(--text-secondary)',
                                                fontWeight: isChecked ? 700 : 500,
                                                boxShadow: isChecked ? '0 0 0 1.5px rgba(13, 148, 136, 0.2)' : 'none',
                                                whiteSpace: 'nowrap'
                                              }}>{opt.label}</span>
                                            );
                                          })}
                                        </div>
                                      );
                                    }
                                    if (chkVal !== undefined && chkVal !== null && chkVal !== '') {
                                      return <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.75rem' }}>{String(chkVal)}</span>;
                                    }
                                    return <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{f.type}</span>;
                                  })()}
                                </td>
                                <td style={{ padding: '4px 6px', borderLeft: '1px solid #e2e8f0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                  {f.reactionProtocol || ''}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            }

            // 6. MATRIX TABLE BLOCK
            if (block.type === 'MATRIX_TABLE' && block.matrixConfig) {
              const mc = block.matrixConfig;
              return renderLayoutBlockShell(
                <>
                  {renderTitleHeader(block)}
                  <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ background: '#e2e8f0' }}>
                          <th rowSpan={2} style={{ padding: '6px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid var(--primary)', textAlign: 'center', width: '50px', color: '#0f172a', fontWeight: 600 }}>
                            {mc.rowHeader || 'STT'}
                          </th>
                          <th colSpan={mc.columns.length} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', textAlign: 'center', color: '#0f172a', fontWeight: 600 }}>
                            {mc.columnHeader || 'Chỉ tiêu'}
                          </th>
                          {mc.showTotalColumn && (
                            <th rowSpan={2} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '2px solid var(--primary)', textAlign: 'center', width: '100px', fontSize: '0.7rem', color: '#0f172a', fontWeight: 600 }}>
                              {mc.totalColumnHeader || 'TỔNG'}
                            </th>
                          )}
                          {mc.showNotesColumn && (
                            <th rowSpan={2} style={{ padding: '4px', borderBottom: '2px solid var(--primary)', textAlign: 'left', width: '150px', color: '#0f172a', fontWeight: 600 }}>
                              {mc.notesColumnHeader || 'Ghi chú'}
                            </th>
                          )}
                        </tr>
                        <tr style={{ background: '#cbd5e1', borderBottom: '2px solid var(--primary)' }}>
                          {mc.columns.map((colName, cIdx) => (
                            <th key={cIdx} style={{ padding: '4px', borderRight: '1px solid #94a3b8', textAlign: mc.columnAlign || 'center', fontWeight: 600, fontSize: '0.7rem', color: '#0f172a' }}>
                              {colName || `(Cột ${cIdx + 1})`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3].map((rowIdx) => (
                          <tr key={rowIdx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                            <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>{rowIdx}</td>
                            {mc.columns.map((_, cIdx) => (
                              <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>
                                <div style={{ border: '1px dashed #cbd5e1', padding: '2px', background: '#f8fafc', color: '#94a3b8', fontSize: '0.65rem' }}>[0]</div>
                              </td>
                            ))}
                            {mc.showTotalColumn && <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', background: '#f1f5f9', fontWeight: 'bold' }}>0</td>}
                            {mc.showNotesColumn && <td style={{ padding: '4px', color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.65rem' }}>...</td>}
                          </tr>
                        ))}
                        <tr style={{ background: '#f8fafc', fontWeight: 'bold', borderTop: '1.5px solid #cbd5e1' }}>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>TỔNG</td>
                          {mc.columns.map((_, cIdx) => <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>0</td>)}
                          {mc.showTotalColumn && <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', background: '#e2e8f0' }}>0</td>}
                          {mc.showNotesColumn && <td style={{ padding: '4px' }} />}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                    * Thiết kế mô phỏng (Hiển thị 3 hàng demo). Số dòng thực tế cấu hình: {mc.rowCount} hàng.
                  </div>
                </>
              );
            }

            // 7. SIGN BLOCK
            if (block.type === 'SIGN') {
              const colCount = block.columns || (block.fields && block.fields.length > 0 ? block.fields.length : 2);
              const signFields = block.fields && block.fields.length > 0 ? block.fields : [
                { id: 's1', checkItem: 'NGƯỜI KÝ', reactionProtocol: 'Ký và ghi rõ họ tên' },
                { id: 's2', checkItem: 'TRƯỞNG PHÒNG', reactionProtocol: 'Ký và ghi rõ họ tên' }
              ];

              return renderLayoutBlockShell(
                <>
                  {renderTitleHeader(block)}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                    gap: '1rem',
                    marginTop: '0.5rem'
                  }}>
                    {signFields.map((f: any, fIdx: number) => {
                      const isFieldSelected = f.id === selectedFieldId;
                      const instruction = f.reactionProtocol
                        ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`)
                        : '(Ký và ghi rõ họ tên)';

                      return (
                        <div
                          key={f.id || fIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (f.id) onSelectField(f.id);
                          }}
                          style={{
                            border: isFieldSelected ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                            borderRadius: '4px',
                            padding: '0.5rem',
                            textAlign: 'center',
                            background: isFieldSelected ? 'rgba(16, 163, 163, 0.05)' : '#f8fafc',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {f.checkItem || 'NGƯỜI KÝ'}
                          </div>
                          <div style={{ fontSize: '0.65rem', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            {instruction}
                          </div>
                          <div style={{ height: '36px' }} />
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px dotted #cbd5e1', paddingTop: '4px', width: '80%', margin: '0 auto' }}>
                            Họ và tên
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            }

            return null;
          })
        )}

        {/* Paper Footer matching FormBuilder */}
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
          <span>{form.formId || 'PENDING'}</span>
          <span>
            {formatFormVersion(
              form.version || 'v1.0',
              form.status || 'ACTIVE',
              form.status === 'ACTIVE' ? ((form as any).effectiveDate || (form as any).effective_date) : undefined,
              form.updatedAt || (form as any).updated_at || new Date().toISOString()
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FormReferenceCanvas;
