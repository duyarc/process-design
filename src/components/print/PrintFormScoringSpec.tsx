import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type {
  ReportTemplateISO,
  FormTemplateISO,
  LayoutBlockISO,
  FormFieldISO
} from '../../types';
import { formatFormVersion, getColStyleWidth } from '../../types';
import {
  getEffectiveTitleFormat,
  getInfoGridTemplateColumns,
  isSeamlessTableBlock
} from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';
import { getTableFieldId } from '../../utils/tableFieldExtractor';
import {
  buildFormScoringBlueprintMap,
  type WeightBadgeSpec,
  type FieldBlueprintSpec
} from '../../utils/reportScoring';
import { exportFillablePdfFromDOM } from '../../utils/pdfFormExporter';
import { FileText, Printer } from 'lucide-react';

interface PrintFormScoringSpecProps {
  template: ReportTemplateISO;
  formTemplate: FormTemplateISO;
  onClose: () => void;
  autoExportPdf?: boolean;
}

export const PrintFormScoringSpec: React.FC<PrintFormScoringSpecProps> = ({
  template,
  formTemplate,
  onClose,
  autoExportPdf = false
}) => {
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const pageSize = template.pageSize || formTemplate.pageSize || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';

  const blueprint = React.useMemo(
    () => buildFormScoringBlueprintMap(formTemplate, template),
    [formTemplate, template]
  );

  const formTitleBlock = (formTemplate.layoutBlocks || []).find(b => b.type === 'TITLE');
  const reportTitleBlock = (template.layoutBlocks || []).find(b => b.type === 'TITLE');
  const rawLogo = formTitleBlock?.logo || reportTitleBlock?.logo;

  useEffect(() => {
    if (!rawLogo) {
      setLogoUrl('');
      setImgLoaded(true);
      return;
    }
    if (rawLogo.startsWith('uploads/')) {
      fetch(`/api/storage/download-inline?key=${encodeURIComponent(rawLogo)}`)
        .then(res => res.json())
        .then(data => {
          if (data.dataUrl) {
            setLogoUrl(data.dataUrl);
          } else {
            setImgLoaded(true);
          }
        })
        .catch(() => {
          setImgLoaded(true);
        });
    } else {
      setLogoUrl(rawLogo);
    }
  }, [rawLogo]);

  const hasAutoExportedRef = useRef(false);
  const isExportingRef = useRef(false);

  const handleExportPdf = useCallback(async () => {
    if (!printContainerRef.current || isExportingRef.current) return;
    try {
      isExportingRef.current = true;
      setIsExportingPdf(true);
      const pdfAdapter = {
        ...template,
        formTitle: `${formTemplate.formTitle || template.reportTitle}_Scoring_Blueprint`,
        formId: template.reportId || formTemplate.formId,
        pageSize
      } as any;
      await exportFillablePdfFromDOM(printContainerRef.current, pdfAdapter);
    } catch (err) {
      console.error('Failed to export scoring blueprint PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExportingPdf(false);
    }
  }, [template, formTemplate, pageSize]);

  useEffect(() => {
    if (!imgLoaded) return;
    const timer = setTimeout(() => {
      if (autoExportPdf) {
        if (!hasAutoExportedRef.current) {
          hasAutoExportedRef.current = true;
          handleExportPdf();
        }
      } else {
        window.print();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [imgLoaded, autoExportPdf, handleExportPdf]);

  useEffect(() => {
    const handleAfterPrint = () => {
      // Giữ cửa sổ xem trước để người dùng có thể bấm Xuất PDF hoặc Đóng
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const renderWeightBadge = (spec?: WeightBadgeSpec, size: 'md' | 'sm' = 'md') => {
    if (!spec) return null;
    const isMd = size === 'md';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: isMd ? '0.72rem' : '0.66rem',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            padding: isMd ? '2px 7px' : '1px 5px',
            borderRadius: '4px',
            background: spec.isWeightManual ? '#f0fdfa' : '#f1f5f9',
            color: spec.isWeightManual ? '#0f766e' : '#334155',
            border: spec.isWeightManual ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
            whiteSpace: 'nowrap'
          }}
        >
          [{spec.weight}%{spec.isWeightManual ? '•' : ''} / {spec.parentLabel}]
        </span>
        {spec.isKnockout && (
          <span
            style={{
              fontSize: isMd ? '0.66rem' : '0.62rem',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '3px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              whiteSpace: 'nowrap'
            }}
          >
            [KO]
          </span>
        )}
      </span>
    );
  };

  const renderInlineFieldAnswerKey = (spec?: FieldBlueprintSpec) => {
    if (!spec) return null;
    const isScale = spec.fieldType === 'likert_scale' || spec.fieldType === 'rating';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          marginTop: '3px'
        }}
      >
        {isScale ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            {spec.answerKeyItems.map((item, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                [{item.label}: {item.scoreText}]
              </span>
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: spec.answerKeyItems.length > 3 ? 'row' : 'column',
              flexWrap: 'wrap',
              gap: spec.answerKeyItems.length > 3 ? '4px 10px' : '2.5px'
            }}
          >
            {spec.answerKeyItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.71rem',
                  fontWeight: 500,
                  color: '#1e293b',
                  lineHeight: 1.35
                }}
              >
                <span style={{ color: '#64748b', fontWeight: 700 }}>•</span>
                <span>{item.label}</span>
                <span
                  style={{
                    fontWeight: 800,
                    color: '#0f766e',
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  · {item.scoreText}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSectionTitleWithWeight = (block: LayoutBlockISO) => {
    const titleFmt = getEffectiveTitleFormat(block);
    if (titleFmt === 'NONE' || !block.title) return null;
    const cleanTitle = block.title.trim().toLowerCase();

    const badgeSpec =
      titleFmt === 'H1'
        ? blueprint.h1Map[cleanTitle]
        : titleFmt === 'H2'
        ? blueprint.h2Map[cleanTitle]
        : blueprint.elementMap[cleanTitle];

    if (titleFmt === 'H1') {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '0.25rem 0.4rem',
            marginBottom: '0.4rem',
            background: '#f8fafc',
            borderBottom: '2px solid #0f172a'
          }}
        >
          <span
            style={{
              fontSize: '1.02rem',
              fontWeight: 800,
              color: '#0f172a',
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}
          >
            {renderFormattedText(block.title)}
          </span>
          {renderWeightBadge(badgeSpec, 'md')}
        </div>
      );
    }

    if (titleFmt === 'H2') {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '3px 6px 3px 8px',
            marginBottom: '0.35rem',
            borderLeft: '3px solid var(--primary)',
            background: '#f0fdfa'
          }}
        >
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
            {renderFormattedText(block.title)}
          </span>
          {renderWeightBadge(badgeSpec, 'md')}
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '0.15rem 0',
          marginBottom: '0.25rem',
          borderBottom: '1px dotted #cbd5e1'
        }}
      >
        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
          {renderFormattedText(block.title)}
        </span>
        {renderWeightBadge(badgeSpec, 'sm')}
      </div>
    );
  };

  const blocks = formTemplate.layoutBlocks || [];

  return ReactDOM.createPortal(
    <div
      className="print-portal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        zIndex: 9999,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1.5rem 1rem 4rem'
      }}
    >
      {/* Dynamic @page CSS rule */}
      <style>
        {`
          @media print {
            @page {
              size: ${isA5 ? 'A5 landscape' : 'A4 portrait'};
              margin: 10mm;
            }
            body > *:not(.print-portal-overlay) {
              display: none !important;
            }
            .print-portal-overlay {
              position: static !important;
              background: transparent !important;
              padding: 0 !important;
              overflow: visible !important;
            }
            .no-print-toolbar {
              display: none !important;
            }
            .print-sheet-container {
              box-shadow: none !important;
              margin: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
              padding: 0 !important;
            }
          }
        `}
      </style>

      {/* Top Screen Action Bar */}
      <div
        className="no-print-toolbar"
        style={{
          width: '100%',
          maxWidth: isA5 ? '920px' : '820px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '0.6rem 1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#5eead4' }}>
            📐 BẢN ĐẶC TẢ CÔNG THỨC, TRỌNG SỐ & ĐÁP ÁN CHẤM ĐIỂM (TAB FORM)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={handleExportPdf}
            style={{
              background: '#0d9488',
              border: 'none',
              color: '#ffffff',
              padding: '5px 12px',
              borderRadius: '5px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: isExportingPdf ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <FileText size={14} />
            <span>{isExportingPdf ? 'Đang tạo PDF...' : 'Xuất PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: '#3b82f6',
              border: 'none',
              color: '#ffffff',
              padding: '5px 12px',
              borderRadius: '5px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Printer size={14} />
            <span>In bản đặc tả (Ctrl+P)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#334155',
              border: 'none',
              color: '#ffffff',
              padding: '5px 12px',
              borderRadius: '5px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Printable Paper Sheet */}
      <div
        ref={printContainerRef}
        className="paper-card print-sheet-container"
        style={{
          width: '100%',
          maxWidth: isA5 ? '920px' : '820px',
          minHeight: isA5 ? '650px' : '1050px',
          background: '#ffffff',
          padding: '1.5rem 1.75rem',
          boxSizing: 'border-box',
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}
      >
        {/* 1. Header / Title Block */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '10px',
            marginBottom: '4px',
            gap: '12px'
          }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
              style={{ maxHeight: '56px', maxWidth: '180px', objectFit: 'contain' }}
            />
          )}
          <div style={{ flex: 1, textAlign: logoUrl ? 'center' : 'left' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '1.15rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: '#0f172a'
              }}
            >
              {formTitleBlock?.title || formTemplate.formTitle || template.reportTitle}
            </h1>
            <div
              style={{
                marginTop: '3px',
                display: 'inline-block',
                fontSize: '0.7rem',
                fontWeight: 800,
                color: '#0f766e',
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.03em'
              }}
            >
              BẢN ĐẶC TẢ CÔNG THỨC, TRỌNG SỐ & ĐÁP ÁN CHẤM ĐIỂM (SCORING BLUEPRINT)
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.68rem', color: '#475569', flexShrink: 0 }}>
            <div><strong>Mã BM:</strong> {formTemplate.formId}</div>
            <div><strong>Mã BC:</strong> {template.reportId}</div>
            <div><strong>Phiên bản:</strong> {formatFormVersion(template.version)}</div>
          </div>
        </div>

        {/* 2. Compact Formula & Legend Strip */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '7px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '0.7rem',
            color: '#1e293b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <span>
              <strong>• Công thức tổng hợp 4 tầng:</strong>{' '}
              <code>Điểm Nhóm = ∑(Điểm_i × Trọng số_i) / ∑(Trọng số_i)</code>{' '}
              <span style={{ color: '#64748b' }}>(Thang chuẩn 0.0 – 5.0)</span>
            </span>
            {blueprint.topLevelSummary.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                {blueprint.topLevelSummary.map((item, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '3px',
                      background: '#e2e8f0',
                      color: '#0f172a'
                    }}
                  >
                    {item.title}: {item.weight}%{item.isWeightManual ? '•' : ''} / Form
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: '3px', fontSize: '0.66rem' }}>
            <strong>• Ký hiệu:</strong>{' '}
            <span style={{ color: '#0f172a', fontWeight: 800 }}>⊞</span> = Bảng / Lưới (Table / Grid)
            &nbsp;│&nbsp;
            <span style={{ color: '#0f766e', fontWeight: 800 }}>•</span> = Trọng số khóa tay (Manual Weight)
            &nbsp;│&nbsp;
            <span style={{ color: '#dc2626', fontWeight: 800 }}>[KO]</span> = Tiêu chí Điểm liệt (Knockout)
          </div>
        </div>

        {/* 3. Source Form Layout Blocks with Variant 2A Inline Answer-Key & Option D [X% / Parent] */}
        {blocks.map((block, blockIdx) => {
          if (block.type === 'TITLE') return null;

          if (block.type === 'SECTION_LABEL') {
            return (
              <div key={block.id} style={{ marginTop: '4px' }}>
                {renderSectionTitleWithWeight(block)}
                {block.description && (
                  <div style={{ fontSize: '0.75rem', color: '#475569', padding: '0 4px 2px' }}>
                    {renderFormattedText(block.description)}
                  </div>
                )}
              </div>
            );
          }

          if (block.type === 'INFO_GRID') {
            const fields: FormFieldISO[] = block.fields || [];
            const cleanBlockTitle = (block.title || 'Thông tin chung').trim().toLowerCase();
            const elBadge = blueprint.elementMap[cleanBlockTitle];
            return (
              <div key={block.id} style={{ marginBottom: '4px' }}>
                {(block.title || elBadge) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      background: '#f1f5f9',
                      border: '1px solid #94a3b8',
                      borderBottom: 'none',
                      borderRadius: '4px 4px 0 0'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>
                      {renderFormattedText(block.title || '⊞ Thông tin chung')}
                    </span>
                    {renderWeightBadge(elBadge, 'sm')}
                  </div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: getInfoGridTemplateColumns(block),
                    border: '1px solid #94a3b8',
                    borderRadius: block.title || elBadge ? '0 0 4px 4px' : '4px',
                    overflow: 'hidden'
                  }}
                >
                  {fields.map(f => {
                    const spec = blueprint.fieldMap[f.id];
                    const span = f.colSpan ? Number(f.colSpan) : 1;
                    return (
                      <div
                        key={f.id}
                        style={{
                          gridColumn: span > 1 ? `span ${span}` : undefined,
                          padding: '6px 8px',
                          borderBottom: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: '6px',
                            width: '100%'
                          }}
                        >
                          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0f172a', flex: 1 }}>
                            {renderFormattedText(f.checkItem || f.id)}
                          </div>
                          {spec &&
                            renderWeightBadge(
                              {
                                weight: spec.weight,
                                parentLabel: spec.parentLabel,
                                isWeightManual: spec.isWeightManual,
                                isKnockout: spec.isKnockout
                              },
                              'sm'
                            )}
                        </div>
                        {renderInlineFieldAnswerKey(spec)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (block.type === 'TABLE') {
            const cols = block.tableColumns || [];
            const rows = block.tableRows || [];
            const prevBlock = blockIdx > 0 ? blocks[blockIdx - 1] : undefined;
            const isSeamless = isSeamlessTableBlock(block, prevBlock);
            const cleanTableTitle = (block.title || '').trim().toLowerCase();
            const tableBadge = cleanTableTitle ? blueprint.elementMap[cleanTableTitle] : undefined;
            let dataRowIndex = 0;

            return (
              <div key={block.id} style={{ marginTop: isSeamless ? '-8px' : '4px', marginBottom: '4px' }}>
                {((block.title && getEffectiveTitleFormat(block) !== 'NONE') || tableBadge) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      background: '#f1f5f9',
                      border: '1px solid #94a3b8',
                      borderBottom: 'none',
                      borderRadius: '4px 4px 0 0'
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                      {renderFormattedText(block.title || '⊞ Bảng đánh giá')}
                    </span>
                    {renderWeightBadge(tableBadge, 'sm')}
                  </div>
                )}

                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    border: '1px solid #64748b',
                    fontSize: '0.74rem'
                  }}
                >
                  {!block.hideHeader && (
                    <thead>
                      <tr style={{ background: '#e2e8f0', color: '#0f172a' }}>
                        <th
                          style={{
                            width: '34px',
                            border: '1px solid #64748b',
                            padding: '4px',
                            textAlign: 'center',
                            fontWeight: 800
                          }}
                        >
                          #
                        </th>
                        {cols.map(col => (
                          <th
                            key={col.id}
                            style={{
                              width: getColStyleWidth(col.id, col.width, cols),
                              border: '1px solid #64748b',
                              padding: '4px 6px',
                              textAlign: 'left',
                              fontWeight: 800
                            }}
                          >
                            {renderFormattedText(col.label || '')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {rows.map(row => {
                      if (row.isGroupHeader) {
                        const grpTitle = (row.groupTitle || block.tableData?.[row.id]?.['_groupTitle'] || '').trim();
                        const cleanGrp = grpTitle.toLowerCase();
                        const grpBadge = blueprint.h2Map[cleanGrp] || blueprint.elementMap[cleanGrp];
                        return (
                          <tr key={row.id} style={{ background: '#f0fdfa' }}>
                            <td
                              colSpan={1 + cols.length}
                              style={{
                                border: '1px solid #64748b',
                                padding: '4px 8px',
                                fontWeight: 800,
                                color: '#0f766e'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <span>{renderFormattedText(grpTitle)}</span>
                                {renderWeightBadge(grpBadge, 'sm')}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      dataRowIndex += 1;
                      return (
                        <tr key={row.id}>
                          <td
                            style={{
                              border: '1px solid #94a3b8',
                              padding: '5px 4px',
                              textAlign: 'center',
                              fontWeight: 700,
                              color: '#475569',
                              verticalAlign: 'top'
                            }}
                          >
                            {String(dataRowIndex).padStart(2, '0')}
                          </td>
                          {cols.map((col, colIdx) => {
                            const cellId = getTableFieldId(block.id, row.id, col.id);
                            const fieldSpec = blueprint.fieldMap[cellId];
                            const staticCellText = block.tableData?.[row.id]?.[col.id] ?? '';

                            return (
                              <td
                                key={col.id}
                                style={{
                                  border: '1px solid #94a3b8',
                                  padding: '5px 7px',
                                  verticalAlign: 'top'
                                }}
                              >
                                {(staticCellText || fieldSpec) && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      justifyContent: staticCellText ? 'space-between' : 'flex-end',
                                      gap: '6px',
                                      marginBottom: fieldSpec ? '3px' : 0
                                    }}
                                  >
                                    {staticCellText && (
                                      <div
                                        style={{
                                          fontWeight: colIdx === 0 ? 600 : 500,
                                          color: '#0f172a',
                                          flex: 1
                                        }}
                                      >
                                        {renderFormattedText(String(staticCellText))}
                                      </div>
                                    )}
                                    {fieldSpec &&
                                      renderWeightBadge(
                                        {
                                          weight: fieldSpec.weight,
                                          parentLabel: fieldSpec.parentLabel,
                                          isWeightManual: fieldSpec.isWeightManual,
                                          isKnockout: fieldSpec.isKnockout
                                        },
                                        'sm'
                                      )}
                                  </div>
                                )}
                                {fieldSpec && renderInlineFieldAnswerKey(fieldSpec)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }

          return null;
        })}

        {/* 4. ISO Footer */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '10px',
            borderTop: '1px solid #cbd5e1',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.68rem',
            color: '#64748b'
          }}
        >
          <span>Mã Đặc tả Báo cáo: {template.reportId} (Biểu mẫu gốc: {formTemplate.formId})</span>
          <span>Phiên bản: {formatFormVersion(template.version)} — Biến thể 2A (Inline Answer-Key)</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintFormScoringSpec;
