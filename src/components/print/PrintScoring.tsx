import React from 'react';
import ReactDOM from 'react-dom';
import { Printer, FileText, Star } from 'lucide-react';
import type { FormTemplateISO, LayoutBlockISO, ReportTemplateISO } from '../../types';
import { getColStyleWidth } from '../../types';
import {
  sanitizeLabel,
  to5SFileName,
  getAutoCheckboxLayoutMode,
  hasLongOptions,
  canTableOptionsFitInline,
  getCheckboxGridTemplate,
  isSeamlessTableBlock,
  getInfoGridTemplateColumns,
  getEffectiveCellOptions,
  getChecklistColumns,
  groupTableRowsForPrint
} from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';
import { exportFillablePdfFromDOM } from '../../utils/pdfFormExporter';
import {
  buildFormScoringBlueprintMap,
  type WeightBadgeSpec,
  type FieldBlueprintSpec,
  type AnswerKeyItemSpec
} from '../../utils/reportScoring';
import {
  usePrintLogo,
  PrintDocumentStyles,
  PrintTitleBlock,
  PrintSectionHeader,
  PrintPageFooter
} from './printShared';

interface PrintScoringProps {
  template: ReportTemplateISO;
  formTemplate: FormTemplateISO;
  autoExportPdf?: boolean;
  onClose: () => void;
}

/**
 * Group select/dropdown options that share identical scoreText into concise summaries:
 * e.g. "Điều, Dừa, Cà phê, Sầu riêng, Gạo (5đ) · Tôm, Cá, Sắn mì, Rau, Khác (1đ)"
 */
function formatCompactOptionGroups(items: AnswerKeyItemSpec[]): string {
  if (!items || items.length === 0) return '';
  const groups = new Map<string, string[]>();
  items.forEach(item => {
    const key = item.scoreText || '0đ';
    const list = groups.get(key) || [];
    list.push(item.label);
    groups.set(key, list);
  });
  return Array.from(groups.entries())
    .map(([score, labels]) => `${labels.join(', ')} (${score})`)
    .join(' · ');
}

export default function PrintScoring({
  template,
  formTemplate,
  autoExportPdf = false,
  onClose
}: PrintScoringProps) {
  const [isExportingPdf, setIsExportingPdf] = React.useState<boolean>(false);
  const printContainerRef = React.useRef<HTMLDivElement>(null);
  const hasAutoExportedRef = React.useRef(false);
  const isExportingRef = React.useRef(false);

  const pageSize = formTemplate.pageSize || (formTemplate as any).page_size || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';

  const titleBlock = formTemplate.layoutBlocks?.find(b => b.type === 'TITLE');
  const { logoUrl, imgLoaded, setImgLoaded } = usePrintLogo(titleBlock?.logo);

  const blueprint = React.useMemo(
    () => buildFormScoringBlueprintMap(formTemplate, template),
    [formTemplate, template]
  );

  const getBlockBadge = (block: LayoutBlockISO): WeightBadgeSpec | undefined => {
    const clean = (block.title || '').trim().toLowerCase();
    if (block.type === 'SECTION_LABEL') {
      const fmt = block.titleFormat || 'H1';
      if (fmt === 'H1') return blueprint.h1Map[clean];
      if (fmt === 'H2') return blueprint.h2Map[clean];
    }
    return blueprint.elementMap[clean] || blueprint.h2Map[clean] || blueprint.h1Map[clean];
  };

  const handleExportPdf = React.useCallback(async () => {
    if (!printContainerRef.current || isExportingRef.current) return;
    try {
      isExportingRef.current = true;
      setIsExportingPdf(true);
      await exportFillablePdfFromDOM(printContainerRef.current, {
        ...formTemplate,
        formTitle: `${formTemplate.formTitle || 'Form'}_Scoring`
      });
    } catch (err) {
      console.error('Failed to export Scoring PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExportingPdf(false);
    }
  }, [formTemplate]);

  React.useEffect(() => {
    if (!imgLoaded) return;

    if (autoExportPdf && !hasAutoExportedRef.current) {
      hasAutoExportedRef.current = true;
      const timer = setTimeout(async () => {
        await handleExportPdf();
        onClose();
      }, 300);
      return () => clearTimeout(timer);
    }

    const handleAfterPrint = () => onClose();
    window.addEventListener('afterprint', handleAfterPrint);
    const timer = setTimeout(() => {
      window.print();
    }, 150);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timer);
    };
  }, [imgLoaded, autoExportPdf, handleExportPdf, onClose]);

  React.useEffect(() => {
    const originalTitle = document.title;
    if (formTemplate.formTitle) {
      document.title = `SCORING_${to5SFileName(formTemplate.formTitle)}`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [formTemplate.formTitle]);

  const renderWeightBadge = (spec?: WeightBadgeSpec | FieldBlueprintSpec | null) => {
    if (!spec) return null;
    const isManual = Boolean(spec.isWeightManual);
    const isKo = 'isKnockout' in spec && Boolean(spec.isKnockout);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0, lineHeight: 1.2 }}>
        {isKo && (
          <span
            style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              color: '#dc2626',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'nowrap'
            }}
          >
            [KO]
          </span>
        )}
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 600,
            color: isManual ? '#0d9488' : '#64748b',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap'
          }}
        >
          [{spec.weight}%{isManual ? '•' : ''} / {spec.parentLabel}]
        </span>
      </span>
    );
  };

  const getOptionScoreText = (fieldSpec: FieldBlueprintSpec | undefined, optLabel: string, optIndex: number): string => {
    if (!fieldSpec || !fieldSpec.answerKeyItems) return '';
    const byIdx = fieldSpec.answerKeyItems[optIndex];
    if (byIdx && byIdx.scoreText) return byIdx.scoreText;
    const byLabel = fieldSpec.answerKeyItems.find(it => it.label === optLabel);
    return byLabel?.scoreText || '';
  };

  const getSingleScoreText = (fieldSpec: FieldBlueprintSpec | undefined): string => {
    if (!fieldSpec || !fieldSpec.answerKeyItems || fieldSpec.answerKeyItems.length === 0) return '';
    return fieldSpec.answerKeyItems[0]?.scoreText || '';
  };

  return ReactDOM.createPortal(
    <div
      ref={printContainerRef}
      className="print-container print-doc"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: '#ffffff',
        color: '#000000',
        fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, sans-serif",
        padding: '20px',
        overflowY: 'auto'
      }}
    >
      <PrintDocumentStyles isA5={isA5} />

      {/* Top Toolbar (Screen Only) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '1rem',
          borderBottom: '1px solid #cbd5e1',
          marginBottom: '2rem'
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700 }}>
            ● Bản In Trọng số & Thang điểm (Minimal PrintScoring)
          </span>
          <h2 style={{ margin: '2px 0 0', fontSize: '1.15rem' }}>{formTemplate.formTitle}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={15} /> {isExportingPdf ? 'Đang xuất PDF...' : 'Xuất PDF'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} /> In (Ctrl+P)
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Đóng
          </button>
        </div>
      </div>

      <table className="print-outer-table">
        <tbody>
          <tr>
            <td>
              {formTemplate.layoutBlocks &&
                formTemplate.layoutBlocks.map((block: LayoutBlockISO, index: number) => {
                  const prevBlock = index > 0 ? formTemplate.layoutBlocks[index - 1] : undefined;
                  const isSeamless = isSeamlessTableBlock(block, prevBlock);
                  const blockBadge = getBlockBadge(block);

                  return (
                    <div
                      key={block.id}
                      className={`print-block${block.type === 'SECTION_LABEL' ? ' print-block--section' : ''}${isSeamless ? ' print-block--seamless-table' : ''} ${block.type !== 'CHECKLIST_TABLE' && block.type !== 'INFO_GRID' && block.type !== 'TABLE' ? 'print-block-avoid' : ''}`}
                    >
                      {/* 1. SECTION_LABEL */}
                      {block.type === 'SECTION_LABEL' && (
                        <PrintSectionHeader
                          block={block}
                          rightBadge={renderWeightBadge(blockBadge)}
                          showDescription
                        />
                      )}

                      {/* 2. TITLE */}
                      {block.type === 'TITLE' && (
                        <PrintTitleBlock
                          block={block}
                          logoUrl={logoUrl}
                          onImgSettled={() => setImgLoaded(true)}
                        />
                      )}

                      {/* 3. INFO_GRID (Minimal borderless PrintBlankForm layout) */}
                      {block.type === 'INFO_GRID' && (
                        <div style={{ padding: '0' }}>
                          <PrintSectionHeader
                            block={block}
                            rightBadge={renderWeightBadge(blockBadge)}
                            marginBottom="6px"
                          />
                          <div
                            className="print-info-grid"
                            style={{ gridTemplateColumns: getInfoGridTemplateColumns(block) }}
                          >
                            {(block.fields || []).map(f => {
                              const cleanLabel = sanitizeLabel(f.checkItem);
                              const fSpec = blueprint.fieldMap[f.id];
                              const parsedRSpan = f.type === 'subtable' ? undefined : (f.rowSpan ? Number(f.rowSpan) : undefined);
                              const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
                              const cSpan = f.type === 'subtable' ? -1 : (f.colSpan ? Number(f.colSpan) : undefined);
                              const gridItemStyle: React.CSSProperties = {
                                gridRow: rSpan ? `span ${rSpan}` : undefined,
                                gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                                alignSelf: f.type === 'photo' ? 'stretch' : 'start'
                              };

                              if (f.type === 'label') {
                                return (
                                  <div
                                    key={f.id}
                                    style={{
                                      ...gridItemStyle,
                                      display: 'flex',
                                      alignItems: 'center',
                                      fontSize: '0.82rem',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      pageBreakInside: 'avoid',
                                      lineHeight: 1.5
                                    }}
                                  >
                                    <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a' }}>
                                      {renderFormattedText(cleanLabel)}
                                    </span>
                                  </div>
                                );
                              }

                              if (f.type === 'checkbox' || f.type === 'radio') {
                                const rawOptions = f.options ?? [{ label: 'Có', value: 'YES' }, { label: 'Không', value: 'NO' }];
                                const options = rawOptions.filter((opt: any) => opt.label && opt.label.trim() !== '');
                                const layoutMode = getAutoCheckboxLayoutMode(f, block.columns);
                                const isLongOpt = hasLongOptions(f);

                                if (layoutMode === 'OPTION_C') {
                                  return (
                                    <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.82rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px' }}>
                                        {cleanLabel && (
                                          <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a' }}>
                                            {renderFormattedText(cleanLabel)}
                                          </span>
                                        )}
                                        {renderWeightBadge(fSpec)}
                                      </div>
                                      <div
                                        style={{
                                          display: 'flex',
                                          flexDirection: isLongOpt ? 'column' : 'row',
                                          flexWrap: isLongOpt ? 'nowrap' : 'wrap',
                                          gap: isLongOpt ? '4px' : '4px 16px',
                                          paddingLeft: '1.25rem',
                                          alignItems: isLongOpt ? 'flex-start' : 'center'
                                        }}
                                      >
                                        {options.map((opt: any, oIdx: number) => {
                                          const sc = getOptionScoreText(fSpec, opt.label, oIdx);
                                          return (
                                            <span key={opt.value || oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem' }}>
                                              <span
                                                className="acro-option-icon"
                                                style={{ borderRadius: f.type === 'radio' ? '50%' : '2px' }}
                                              />
                                              <span>{opt.label}</span>
                                              {sc && <span style={{ fontSize: '0.74rem', color: '#0f766e', fontWeight: 600 }}>({sc})</span>}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={f.id}
                                    style={{
                                      ...gridItemStyle,
                                      display: 'grid',
                                      gridTemplateColumns: block.columns === 1 ? 'auto 1fr auto' : '32% 1fr auto',
                                      gap: '6px 12px',
                                      alignItems: 'start',
                                      minHeight: 'var(--pw-line-h)',
                                      fontSize: '0.82rem'
                                    }}
                                  >
                                    {cleanLabel && (
                                      <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', lineHeight: 1.4 }}>
                                        {renderFormattedText(cleanLabel)}
                                      </span>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
                                      {options.map((opt: any, oIdx: number) => {
                                        const sc = getOptionScoreText(fSpec, opt.label, oIdx);
                                        return (
                                          <span key={opt.value || oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                            <span
                                              className="acro-option-icon"
                                              style={{ borderRadius: f.type === 'radio' ? '50%' : '2px' }}
                                            />
                                            <span>{opt.label}</span>
                                            {sc && <span style={{ fontSize: '0.74rem', color: '#0f766e', fontWeight: 600 }}>({sc})</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {renderWeightBadge(fSpec)}
                                  </div>
                                );
                              }

                              if (f.type === 'select') {
                                const compactSummary = formatCompactOptionGroups(fSpec?.answerKeyItems || []);
                                return (
                                  <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.82rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: 'var(--pw-line-h)' }}>
                                      {cleanLabel && (
                                        <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap' }}>
                                          {renderFormattedText(cleanLabel)}
                                        </span>
                                      )}
                                      <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', height: '14px' }} />
                                      {renderWeightBadge(fSpec)}
                                    </div>
                                    {compactSummary && (
                                      <div style={{ fontSize: '0.73rem', color: '#475569', lineHeight: 1.35 }}>
                                        {compactSummary}
                                      </div>
                                    )}
                                  </div>
                                );
                              }

                              // Default single-line field (text, number, date, time)
                              const singleScore = getSingleScoreText(fSpec);
                              return (
                                <div
                                  key={f.id}
                                  style={{
                                    ...gridItemStyle,
                                    display: 'flex',
                                    alignItems: 'center',
                                    minHeight: 'var(--pw-line-h)',
                                    gap: '6px',
                                    fontSize: '0.82rem'
                                  }}
                                >
                                  {cleanLabel && (
                                    <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                                      {renderFormattedText(cleanLabel)}
                                    </span>
                                  )}
                                  <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', height: '14px' }} />
                                  {singleScore && (
                                    <span style={{ fontSize: '0.74rem', color: '#0f766e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      {singleScore}
                                    </span>
                                  )}
                                  {renderWeightBadge(fSpec)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 4. CHECKLIST_TABLE */}
                      {block.type === 'CHECKLIST_TABLE' && (
                        <div style={{ marginTop: '0' }}>
                          <PrintSectionHeader
                            block={block}
                            rightBadge={renderWeightBadge(blockBadge)}
                            marginBottom="6px"
                          />
                          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {getChecklistColumns(block).map(col => (
                                  <th
                                    key={col.id}
                                    style={{
                                      width: col.width,
                                      border: '1px solid #000000',
                                      padding: '6px',
                                      background: '#f1f5f9',
                                      fontWeight: 'var(--pw-weight-heavy)',
                                      fontSize: '0.82rem',
                                      color: '#000000',
                                      textAlign: (col.align || (col.id === 'col_stt' ? 'center' : 'left')) as any
                                    }}
                                  >
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(block.fields || []).map((field, idx) => {
                                const fSpec = blueprint.fieldMap[field.id];
                                return (
                                  <tr key={field.id} style={{ pageBreakInside: 'avoid' }}>
                                    {getChecklistColumns(block).map(col => {
                                      const commonStyle: React.CSSProperties = {
                                        border: '1px solid #000000',
                                        padding: '4px 6px',
                                        fontSize: '0.8rem',
                                        verticalAlign: 'middle',
                                        height: '28px',
                                        textAlign: (col.align as any) || 'left'
                                      };
                                      if (col.id === 'col_stt') {
                                        return <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>{idx + 1}</td>;
                                      }
                                      if (col.id === 'col_item') {
                                        return (
                                          <td key={col.id} style={commonStyle}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                                              <span>{field.checkItem}</span>
                                              {renderWeightBadge(fSpec)}
                                            </div>
                                          </td>
                                        );
                                      }
                                      if (col.id === 'col_target') {
                                        const opts = field.options ?? [{ label: 'Đ', value: 'PASS' }, { label: 'KĐ', value: 'FAIL' }];
                                        return (
                                          <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                              {opts.map((opt, oIdx) => {
                                                const sc = getOptionScoreText(fSpec, opt.label, oIdx);
                                                return (
                                                  <span key={opt.value || oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                                    <span className="acro-option-icon" style={{ borderRadius: '50%' }} />
                                                    <span>{opt.label}</span>
                                                    {sc && <span style={{ fontSize: '0.73rem', color: '#0f766e', fontWeight: 600 }}>({sc})</span>}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </td>
                                        );
                                      }
                                      return <td key={col.id} style={commonStyle} />;
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* 5. DYNAMIC TABLE (Preserves borderless / horizontal_only / grid from PrintBlankForm) */}
                      {block.type === 'TABLE' && (() => {
                        const bStyle = block.borderStyle || 'grid';
                        const tableBorder = bStyle === 'borderless' ? 'none' : bStyle === 'horizontal_only' ? 'none' : '1px solid #000000';
                        const tableBorderTop = isSeamless ? 'none' : (bStyle === 'horizontal_only' ? '1px solid #000000' : undefined);
                        const cellBorder = bStyle === 'borderless' ? 'none' : bStyle === 'horizontal_only' ? 'none' : '1px solid #000000';
                        const cellBorderBottom = bStyle === 'horizontal_only' ? '1px solid #000000' : (bStyle === 'borderless' ? 'none' : '1px solid #000000');
                        const rawRows = block.tableRows || [];
                        const groups = groupTableRowsForPrint(rawRows);

                        return (
                          <div style={{ marginTop: '0' }}>
                            <PrintSectionHeader
                              block={block}
                              rightBadge={renderWeightBadge(blockBadge)}
                              marginBottom="6px"
                            />
                            <table
                              className={`print-table ${bStyle === 'borderless' ? 'print-table--borderless' : bStyle === 'horizontal_only' ? 'print-table--horizontal' : ''}`}
                              style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                tableLayout: 'fixed',
                                pageBreakInside: 'auto',
                                border: tableBorder,
                                borderTop: tableBorderTop
                              }}
                            >
                              <colgroup>
                                {(block.tableColumns || []).map(col => {
                                  const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                  return <col key={col.id} style={{ width: colWidth }} />;
                                })}
                              </colgroup>
                              {!block.hideHeader && (
                                <thead>
                                  <tr style={{ background: bStyle === 'borderless' ? 'transparent' : '#f1f5f9' }}>
                                    {(block.tableColumns || []).map(col => {
                                      const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                      const hasOptions = col.type === 'checkbox' && col.options && col.options.length > 0;
                                      const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : col.type === 'likert_scale' ? 'center' : 'left'));
                                      return (
                                        <th
                                          key={col.id}
                                          style={{
                                            border: cellBorder,
                                            borderBottom: cellBorderBottom,
                                            padding: '6px',
                                            background: bStyle === 'borderless' ? 'transparent' : '#f1f5f9',
                                            fontWeight: 'var(--pw-weight-heavy)',
                                            fontSize: '0.82rem',
                                            color: '#000000',
                                            textAlign: cellAlign as any,
                                            width: colWidth
                                          }}
                                        >
                                          {col.type === 'likert_scale' ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(col.scaleOptions || []).length || 3}, 1fr)`, gap: '4px', textAlign: 'center', width: '100%' }}>
                                              {(col.scaleOptions || ['Dễ trả lời', 'Có thể trả lời', 'Khó trả lời']).map((opt, sIdx) => (
                                                <div key={sIdx} style={{ fontSize: '0.82rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', padding: '2px 4px', wordBreak: 'break-word', textAlign: 'center' }}>
                                                  {opt}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            col.label
                                          )}
                                        </th>
                                      );
                                    })}
                                  </tr>
                                </thead>
                              )}
                              {groups.map((grp, gIdx) => (
                                <tbody key={grp.groupHeaderRow?.id || `grp_${gIdx}`} className="print-table-group" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  {grp.groupHeaderRow && (
                                    <tr key={grp.groupHeaderRow.id} style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                                      <td
                                        colSpan={(block.tableColumns || []).length}
                                        style={{
                                          border: cellBorder,
                                          borderBottom: cellBorderBottom,
                                          background: bStyle === 'borderless' ? 'transparent' : '#f8fafc',
                                          fontWeight: 'var(--pw-weight-regular)',
                                          fontSize: 'var(--pw-font-body)',
                                          lineHeight: 1.45,
                                          padding: '5px 8px',
                                          color: '#000000',
                                          whiteSpace: 'pre-wrap',
                                          wordBreak: 'break-word'
                                        }}
                                      >
                                        {renderFormattedText(grp.groupHeaderRow.groupTitle || block.tableData?.[grp.groupHeaderRow.id]?.['_groupTitle'] || '')}
                                      </td>
                                    </tr>
                                  )}
                                  {grp.rows.map(({ row, rIdx }) => {
                                    const lc = row.lineCount ?? 1;
                                    const fieldIdPrefix = `${block.id}_r${rIdx}_${row.id}`;
                                    return (
                                      <tr key={row.id} style={{ pageBreakInside: 'avoid' }}>
                                        {(block.tableColumns || []).map(col => {
                                          const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                          const cellFieldId = `${fieldIdPrefix}_${col.id}`;
                                          const fSpec = blueprint.fieldMap[cellFieldId];
                                          const rawOpts = getEffectiveCellOptions(block.cellOptionsMap, row.id, col.id, col.options);
                                          const effectiveOpts = rawOpts.filter(opt => opt.label && opt.label.trim() !== '');
                                          const hasOptions = (col.type === 'checkbox' || col.type === 'radio') && effectiveOpts.length > 0;
                                          const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : col.type === 'likert_scale' ? 'center' : 'left'));

                                          const staticVal = block.tableData?.[row.id]?.[col.id];
                                          const isStaticLabel = (col.type === 'static_text' || col.type === 'text') && staticVal !== undefined && staticVal !== null && staticVal.toString().trim() !== '';

                                          if (isStaticLabel) {
                                            return (
                                              <td
                                                key={col.id}
                                                style={{
                                                  border: cellBorder,
                                                  borderBottom: cellBorderBottom,
                                                  padding: '4px 6px',
                                                  fontSize: '0.82rem',
                                                  verticalAlign: 'top',
                                                  minHeight: `${28 * lc}px`,
                                                  textAlign: cellAlign as any,
                                                  width: colWidth,
                                                  maxWidth: colWidth,
                                                  boxSizing: 'border-box'
                                                }}
                                              >
                                                <span style={{ fontWeight: 'var(--pw-weight-regular)', display: 'block', textAlign: cellAlign as any, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#000000', fontSize: '0.82rem', lineHeight: 1.4 }}>
                                                  {renderFormattedText(staticVal)}
                                                </span>
                                              </td>
                                            );
                                          }

                                          if (col.type === 'likert_scale') {
                                            const scaleOptions = col.scaleOptions || ['Dễ trả lời', 'Có thể trả lời', 'Khó trả lời'];
                                            return (
                                              <td
                                                key={col.id}
                                                style={{
                                                  border: cellBorder,
                                                  borderBottom: cellBorderBottom,
                                                  padding: '4px 6px',
                                                  fontSize: '0.8rem',
                                                  verticalAlign: 'middle',
                                                  height: `${28 * lc}px`,
                                                  textAlign: 'center',
                                                  width: colWidth,
                                                  maxWidth: colWidth,
                                                  boxSizing: 'border-box'
                                                }}
                                              >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${scaleOptions.length}, 1fr)`, gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                                                    {scaleOptions.map((opt, sIdx) => {
                                                      const sc = getOptionScoreText(fSpec, opt, sIdx);
                                                      return (
                                                        <div key={sIdx} style={{ display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                                                          <span className="acro-option-icon" style={{ borderRadius: '50%' }} />
                                                          {sc && <span style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600 }}>{sc}</span>}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                  {renderWeightBadge(fSpec)}
                                                </div>
                                              </td>
                                            );
                                          }

                                          if (col.type === 'rating') {
                                            const scale = col.ratingScale === 3 ? 3 : 5;
                                            const firstSc = fSpec?.answerKeyItems?.[0]?.scoreText || '1đ';
                                            const lastSc = fSpec?.answerKeyItems?.[scale - 1]?.scoreText || `${scale}đ`;
                                            return (
                                              <td
                                                key={col.id}
                                                style={{
                                                  border: cellBorder,
                                                  borderBottom: cellBorderBottom,
                                                  padding: '4px 6px',
                                                  fontSize: '0.8rem',
                                                  verticalAlign: 'top',
                                                  height: `${28 * lc}px`,
                                                  textAlign: 'center',
                                                  width: colWidth,
                                                  maxWidth: colWidth,
                                                  boxSizing: 'border-box'
                                                }}
                                              >
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                                                  {renderWeightBadge(fSpec)}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                  {Array.from({ length: scale }).map((_, idx) => (
                                                    <Star key={idx} size={13} style={{ color: '#000000', fill: 'none', strokeWidth: 1.4 }} />
                                                  ))}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#0f766e', fontWeight: 600, marginTop: '2px' }}>
                                                  (1★:{firstSc} → {scale}★:{lastSc})
                                                </div>
                                              </td>
                                            );
                                          }

                                          if (col.type === 'checkbox' || col.type === 'radio') {
                                            const isInline = canTableOptionsFitInline(effectiveOpts, col.width, col.checkboxLayout);
                                            return (
                                              <td
                                                key={col.id}
                                                style={{
                                                  border: cellBorder,
                                                  borderBottom: cellBorderBottom,
                                                  padding: '4px 6px',
                                                  fontSize: '0.8rem',
                                                  verticalAlign: 'top',
                                                  minHeight: '28px',
                                                  textAlign: cellAlign as any,
                                                  width: colWidth,
                                                  maxWidth: colWidth,
                                                  boxSizing: 'border-box'
                                                }}
                                              >
                                                {fSpec && (
                                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                                                    {renderWeightBadge(fSpec)}
                                                  </div>
                                                )}
                                                {hasOptions && (
                                                  <div
                                                    style={{
                                                      display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                                      gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(effectiveOpts) : undefined,
                                                      flexDirection: col.checkboxLayout === '2-column' ? undefined : (isInline ? 'row' : 'column'),
                                                      flexWrap: isInline ? 'wrap' : undefined,
                                                      gap: col.checkboxLayout === '2-column' ? '3px 8px' : (isInline ? '4px 12px' : '3px'),
                                                      alignItems: isInline ? 'center' : (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start'),
                                                      width: '100%'
                                                    }}
                                                  >
                                                    {effectiveOpts.map((opt, oIdx) => {
                                                      const sc = getOptionScoreText(fSpec, opt.label, oIdx);
                                                      return (
                                                        <div key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#000000', lineHeight: 1.25 }}>
                                                          <span className="acro-option-icon" style={{ borderRadius: col.type === 'radio' ? '50%' : '1px', flexShrink: 0 }} />
                                                          <span>{renderFormattedText(opt.label)}</span>
                                                          {sc && <span style={{ fontSize: '0.73rem', color: '#0f766e', fontWeight: 600 }}>({sc})</span>}
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </td>
                                            );
                                          }

                                          // Default text / number / select cell
                                          const singleScore = col.type === 'select'
                                            ? formatCompactOptionGroups(fSpec?.answerKeyItems || [])
                                            : getSingleScoreText(fSpec);
                                          return (
                                            <td
                                              key={col.id}
                                              style={{
                                                border: cellBorder,
                                                borderBottom: cellBorderBottom,
                                                padding: '4px 6px',
                                                height: `${28 * lc}px`,
                                                verticalAlign: 'top',
                                                width: colWidth,
                                                maxWidth: colWidth,
                                                boxSizing: 'border-box'
                                              }}
                                            >
                                              {fSpec && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
                                                  {renderWeightBadge(fSpec)}
                                                </div>
                                              )}
                                              {singleScore && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                                                  <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', height: '12px' }} />
                                                  <span style={{ color: '#0f766e', fontWeight: 600 }}>{singleScore}</span>
                                                </div>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              ))}
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div className="print-footer-spacer" />
            </td>
          </tr>
        </tfoot>
      </table>

      <PrintPageFooter template={formTemplate} />
    </div>,
    document.body
  );
}
