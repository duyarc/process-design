import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type {
  ReportTemplateISO,
  Submission,
  FormTemplateISO,
  FormFieldISO
} from '../../types';
import { computeRecordReport } from '../../utils/reportCompute';
import { getInfoGridTemplateColumns, to5SFileName } from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';
import { extractAllFormFields } from '../../utils/tableFieldExtractor';
import { exportFillablePdfFromDOM } from '../../utils/pdfFormExporter';
import { RadarChartBlock } from '../report/RadarChartBlock';
import { BarChartBlock } from '../report/BarChartBlock';
import { FileText, Printer } from 'lucide-react';
import {
  usePrintLogo,
  PrintDocumentStyles,
  PrintTitleBlock,
  PrintSectionHeader,
  PrintPageFooter,
  renderReportField
} from './printShared';

interface PrintReportProps {
  template: ReportTemplateISO;
  submission: Submission;
  formTemplate: FormTemplateISO;
  onClose: () => void;
  exportMode?: boolean;
  autoExportPdf?: boolean;
}

export const PrintReport: React.FC<PrintReportProps> = ({
  template,
  submission,
  formTemplate,
  onClose,
  exportMode = false,
  autoExportPdf = false
}) => {
  const printContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const pageSize = template.pageSize || (template as any).page_size || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';

  const computed = computeRecordReport(submission, formTemplate, template);
  const allFormFields: FormFieldISO[] = extractAllFormFields(formTemplate?.layoutBlocks || []);

  const titleBlock = template.layoutBlocks.find(b => b.type === 'TITLE');
  const { logoUrl, imgLoaded, setImgLoaded } = usePrintLogo(titleBlock?.logo);

  const hasAutoExportedRef = useRef(false);
  const isExportingRef = useRef(false);

  const handleExportPdf = useCallback(async () => {
    if (!printContainerRef.current || isExportingRef.current) return;
    try {
      isExportingRef.current = true;
      setIsExportingPdf(true);
      const pdfTemplateAdapter = {
        ...template,
        formTitle: template.reportTitle,
        formId: template.reportId,
        pageSize
      } as any;
      await exportFillablePdfFromDOM(printContainerRef.current, pdfTemplateAdapter);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      isExportingRef.current = false;
      setIsExportingPdf(false);
    }
  }, [template, pageSize]);

  // 2. Trigger print or auto-export after DOM & image ready
  useEffect(() => {
    if (!imgLoaded) return;

    if (autoExportPdf && !hasAutoExportedRef.current) {
      hasAutoExportedRef.current = true;
      const timer = setTimeout(async () => {
        await handleExportPdf();
        onClose();
      }, 300);
      return () => clearTimeout(timer);
    }

    if (exportMode) return;

    const handleAfterPrint = () => {
      onClose();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    const timer = setTimeout(() => {
      window.print();
    }, 100);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timer);
    };
  }, [imgLoaded, onClose, exportMode, autoExportPdf, handleExportPdf]);

  // 3. Set Digital 5S document title
  useEffect(() => {
    const originalTitle = document.title;
    if (template.reportTitle) {
      document.title = `REPORT_${to5SFileName(template.reportTitle)}`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [template.reportTitle]);

  const getFieldValue = (fid: string): string => {
    if (!submission?.formData) return '—';
    if (Array.isArray(submission.formData)) {
      const item = (submission.formData as any[]).find(s => s.id === fid);
      return item?.value !== undefined ? String(item.value) : '—';
    }
    const val = (submission.formData as any)[fid];
    return val !== undefined ? String(val) : '—';
  };

  const submittedAtText = (submission as any)?.submittedAt || (submission as any)?.submitted_at
    ? new Date((submission as any).submittedAt || (submission as any)?.submitted_at).toLocaleDateString('vi-VN')
    : '—';

  const operatorText = (submission as any)?.operatorId || (submission as any)?.operator_id || 'Người vận hành';
  const supervisorText = (submission as any)?.supervisorSignoff?.signedBy || (submission as any)?.supervisor_signoff?.supervisor_name || '(Chưa ký duyệt)';

  return ReactDOM.createPortal(
    <div ref={printContainerRef} className="print-container print-doc" style={{
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
    }}>
      <PrintDocumentStyles isA5={isA5} />

      {/* Screen Action Bar (No-print) */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '1rem',
        borderBottom: '1px solid #cbd5e1',
        marginBottom: '2rem'
      }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Print Preview Mode</span>
          <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{template.reportTitle}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <FileText size={16} />
            {isExportingPdf ? 'Đang xuất PDF...' : 'PDF'}
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Printer size={16} />
            Print Report
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            Back
          </button>
        </div>
      </div>

      {/* Outer Table Wrapper for Native Print Header/Footer Support */}
      <table className="print-outer-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td>
              {template.layoutBlocks.filter(b => !b.hiddenInReport).map((block) => (
                <div key={block.id} className="print-block-avoid" style={{ marginBottom: '14px' }}>
                  
                  {/* 1. TITLE Block */}
                  {block.type === 'TITLE' && (
                    <PrintTitleBlock
                      block={{
                        ...block,
                        title: block.title || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ'
                      }}
                      logoUrl={logoUrl}
                      onImgSettled={() => setImgLoaded(true)}
                      dateValueNode={
                        <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 'var(--pw-weight-medium)' : 'var(--pw-weight-regular)' }}>
                          {submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}
                        </span>
                      }
                    />
                  )}

                  {/* 2. SECTION_LABEL Block */}
                  {block.type === 'SECTION_LABEL' && (
                    <PrintSectionHeader block={block} showDescription={true} marginBottom="6px" />
                  )}

                  {/* 3. INFO_GRID Block */}
                  {block.type === 'INFO_GRID' && (() => {
                    const isLegacyDefaultInfoGridTitle =
                      block.title === 'Thông tin chung' &&
                      (!block.boundFieldIds || block.boundFieldIds.length === 0);
                    const effectiveBlock = isLegacyDefaultInfoGridTitle
                      ? { ...block, titleFormat: 'NONE' as const }
                      : block;
                    return (
                      <div style={{ marginBottom: '8px' }}>
                        <PrintSectionHeader block={effectiveBlock} marginBottom="6px" />
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: getInfoGridTemplateColumns(block as any),
                          columnGap: '12px',
                          rowGap: '6px',
                          fontSize: 'var(--pw-font-body)'
                        }}>
                          {(block.boundFieldIds || []).map(fid => renderReportField(fid, block, allFormFields, getFieldValue))}
                          {(block.chartItems || []).map(chart => (
                            chart.chartType === 'RADAR' ? (
                              <RadarChartBlock key={chart.id} chart={chart} />
                            ) : (
                              <BarChartBlock key={chart.id} chart={chart} />
                            )
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4. TABLE Block */}
                  {block.type === 'TABLE' && (() => {
                    const borderStyle = block.borderStyle || 'grid';
                    const tableBorder = borderStyle === 'grid' ? '1px solid #000' : 'none';
                    const cellBorder = borderStyle === 'grid' ? '1px solid #000' : borderStyle === 'horizontal_only' ? '1px solid #cbd5e1' : 'none';

                    return (
                      <div style={{ marginBottom: '8px' }}>
                        <PrintSectionHeader block={block} marginBottom="6px" />
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--pw-font-body)', border: tableBorder }}>
                          {!block.hideHeader && (
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #000' }}>
                                <th style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center', width: '30px', fontWeight: 'var(--pw-weight-heavy)' }}>STT</th>
                                <th style={{ border: cellBorder, padding: '4px 6px', textAlign: 'left', fontWeight: 'var(--pw-weight-heavy)' }}>Hạng mục kiểm tra / Tiêu chí</th>
                                <th style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center', width: '25%', fontWeight: 'var(--pw-weight-heavy)' }}>Quy cách / Tiêu chuẩn</th>
                                <th style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center', width: '20%', fontWeight: 'var(--pw-weight-heavy)' }}>Kết quả thực tế</th>
                                <th style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center', width: '18%', fontWeight: 'var(--pw-weight-heavy)' }}>Đánh giá</th>
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {(block.boundFieldIds || []).map((fid, rIdx) => {
                              const field = allFormFields.find(f => f.id === fid);
                              const evalRes = computed.evaluations[fid];
                              const override = block.ruleOverrides?.[fid];
                              const min = override?.customMinSpec !== undefined ? override.customMinSpec : field?.minSpec;
                              const max = override?.customMaxSpec !== undefined ? override.customMaxSpec : field?.maxSpec;

                              let specText = override?.customTargetRange || field?.targetRange || '—';
                              if (min !== undefined && max !== undefined) specText = `${min} ~ ${max} ${field?.unit || ''}`;
                              else if (min !== undefined) specText = `≥ ${min} ${field?.unit || ''}`;
                              else if (max !== undefined) specText = `≤ ${max} ${field?.unit || ''}`;

                              const rawVal = getFieldValue(fid);
                              const isPass = evalRes?.status === 'PASS';
                              const isFail = evalRes?.status === 'FAIL';
                              const displayLabel = override?.customLabel || field?.checkItem || fid;

                              return (
                                <tr key={fid} style={{ borderBottom: cellBorder }}>
                                  <td style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center', color: '#64748b' }}>{rIdx + 1}</td>
                                  <td style={{ border: cellBorder, padding: '4px 6px', fontWeight: 'var(--pw-weight-medium)' }}>{renderFormattedText(displayLabel)}</td>
                                  <td style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center' }}>{specText}</td>
                                  <td style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center', fontWeight: 'var(--pw-weight-heavy)' }}>{rawVal}</td>
                                  <td style={{ border: cellBorder, padding: '4px 6px', textAlign: 'center', fontWeight: 'var(--pw-weight-heavy)' }}>
                                    <span style={{ color: isPass ? '#15803d' : isFail ? '#b91c1c' : '#475569' }}>
                                      {isPass ? '✓ ĐẠT' : isFail ? '✗ K.ĐẠT' : '—'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* 5. SIGN Block */}
                  {block.type === 'SIGN' && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '24px',
                      padding: '12px 0',
                      textAlign: 'center',
                      marginTop: '16px',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 'var(--pw-font-sub)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase' }}>NGƯỜI KIỂM TRA</div>
                        <div style={{ fontSize: 'var(--pw-font-xs)', fontStyle: 'italic', color: '#64748b', marginBottom: '32px' }}>(Ký và ghi rõ họ tên)</div>
                        <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', minWidth: '160px', borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
                          {operatorText}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: 'var(--pw-font-sub)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase' }}>NGƯỜI THẨM TRA (QA/QC)</div>
                        <div style={{ fontSize: 'var(--pw-font-xs)', fontStyle: 'italic', color: '#64748b', marginBottom: '32px' }}>(Ký và ghi rõ họ tên)</div>
                        <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', minWidth: '160px', borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
                          {supervisorText}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ISO Print Footer */}
      <PrintPageFooter template={template as any} leftLabel={template.reportId || ''} />
    </div>,
    document.body
  );
};

export default PrintReport;