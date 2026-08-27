import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type {
  ReportTemplateISO,
  Submission,
  FormTemplateISO,
  FormFieldISO
} from '../../types';
import { formatFormVersion } from '../../types';
import { computeRecordReport } from '../../utils/reportCompute';
import { getInfoGridTemplateColumns, to5SFileName } from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';
import { extractAllFormFields } from '../../utils/tableFieldExtractor';
import { exportFillablePdfFromDOM } from '../../utils/pdfFormExporter';
import { FileText, Printer } from 'lucide-react';

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
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const printContainerRef = useRef<HTMLDivElement>(null);

  const pageSize = template.pageSize || (template as any).page_size || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';

  const computed = computeRecordReport(submission, formTemplate, template);
  const allFormFields: FormFieldISO[] = extractAllFormFields(formTemplate?.layoutBlocks || []);

  const titleBlock = template.layoutBlocks.find(b => b.type === 'TITLE');
  const titleBlockLogo = titleBlock?.logo;

  // 1. Fetch inline base64 logo from R2 to prevent CORS and export issues
  useEffect(() => {
    if (!titleBlockLogo) {
      setLogoUrl('');
      setImgLoaded(true);
      return;
    }
    if (titleBlockLogo.startsWith('uploads/')) {
      fetch(`/api/storage/download-inline?key=${encodeURIComponent(titleBlockLogo)}`)
        .then(res => res.json())
        .then(data => {
          if (data.dataUrl) {
            setLogoUrl(data.dataUrl);
          } else {
            setImgLoaded(true);
          }
        })
        .catch(err => {
          console.error('Error fetching inline logo for report print:', err);
          setImgLoaded(true);
        });
    } else {
      setLogoUrl(titleBlockLogo);
    }
  }, [titleBlockLogo]);

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
      <style>{`
        @media print {
          #root {
            display: none !important;
          }
          .print-container {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          @page {
            size: ${isA5 ? 'A5 landscape' : 'A4 portrait'};
            margin: ${isA5 ? '8mm 10mm 10mm 10mm' : '12mm 15mm 15mm 15mm'};
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-block-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 20px;
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            font-size: var(--pw-font-xs);
            font-family: inherit;
            color: #475569;
          }
        }
      `}</style>

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
              {template.layoutBlocks.map((block) => (
                <div key={block.id} className="print-block-avoid" style={{ marginBottom: '14px' }}>
                  
                  {/* 1. TITLE Block */}
                  {block.type === 'TITLE' && (
                    (logoUrl || block.logo) ? (
                      <div style={{
                        padding: '8px 0',
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '10px',
                        position: 'relative'
                      }}>
                        <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center', height: '60px' }}>
                          <img 
                            src={logoUrl || block.logo} 
                            alt="Logo" 
                            style={{ maxHeight: '60px', maxWidth: '240px', objectFit: 'contain' }}
                            onLoad={() => setImgLoaded(true)}
                            onError={() => setImgLoaded(true)}
                          />
                        </div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <h1 style={{ margin: '0 0 2px 0', fontSize: 'var(--pw-font-banner)', fontWeight: 'var(--pw-weight-banner)', textTransform: 'uppercase', color: '#000000' }}>
                            {renderFormattedText(block.title || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ')}
                          </h1>
                          {block.description && (
                            <p style={{ margin: 0, fontSize: 'var(--pw-font-sub)', fontStyle: 'italic', color: '#475569' }}>
                              {renderFormattedText(block.description)}
                            </p>
                          )}
                          {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                            <div style={{ marginTop: '4px', fontSize: 'var(--pw-font-sub)', color: '#475569', textAlign: 'center' }}>
                              <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 'var(--pw-weight-medium)' : 'var(--pw-weight-regular)' }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                            </div>
                          )}
                        </div>
                        {block.showDate && block.datePosition === 'A' && (
                          <div style={{ fontSize: 'var(--pw-font-sub)', color: '#475569', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '2px' }}>
                            <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 'var(--pw-weight-medium)' : 'var(--pw-weight-regular)' }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{
                        padding: '8px 0',
                        textAlign: 'center',
                        marginBottom: '10px',
                        position: 'relative'
                      }}>
                        {block.showDate && block.datePosition === 'A' && (
                          <div style={{ position: 'absolute', right: 0, top: '8px', fontSize: 'var(--pw-font-sub)', color: '#475569', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 'var(--pw-weight-medium)' : 'var(--pw-weight-regular)' }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                          </div>
                        )}
                        <h1 style={{ margin: '0 0 4px 0', fontSize: 'var(--pw-font-banner)', fontWeight: 'var(--pw-weight-banner)', textTransform: 'uppercase', color: '#000000' }}>
                          {renderFormattedText(block.title || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ')}
                        </h1>
                        {block.description && (
                          <p style={{ margin: 0, fontSize: 'var(--pw-font-sub)', fontStyle: 'italic', color: '#475569' }}>
                            {renderFormattedText(block.description)}
                          </p>
                        )}
                        {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                          <div style={{ marginTop: '4px', fontSize: 'var(--pw-font-sub)', color: '#475569', textAlign: 'center' }}>
                            <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 'var(--pw-weight-medium)' : 'var(--pw-weight-regular)' }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* 2. SECTION_LABEL Block */}
                  {block.type === 'SECTION_LABEL' && (() => {
                    const titleFmt = block.titleFormat || 'H1';
                    if (titleFmt === 'NONE') return null;

                    return (
                      <div style={{ marginBottom: '6px' }}>
                        {titleFmt === 'H1' ? (
                          <h2 style={{ margin: '0 0 4px 0', fontSize: 'var(--pw-font-h1)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '2px' }}>
                            {renderFormattedText(block.title)}
                          </h2>
                        ) : titleFmt === 'H2' ? (
                          <div style={{ padding: '4px 8px', background: '#f1f5f9', borderLeft: '4px solid #000', fontWeight: 'var(--pw-weight-heavy)', fontSize: 'var(--pw-font-h2)', textTransform: 'uppercase', marginBottom: '4px' }}>
                            {renderFormattedText(block.title)}
                          </div>
                        ) : (
                          <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', marginBottom: '4px' }}>
                            {renderFormattedText(block.title)}
                          </div>
                        )}
                        {block.description && (
                          <p style={{ margin: '2px 0 0 0', fontSize: 'var(--pw-font-small)', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {renderFormattedText(block.description)}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* 3. INFO_GRID Block */}
                  {block.type === 'INFO_GRID' && (() => {
                    const titleFmt = block.titleFormat || 'H2';
                    return (
                      <div style={{ marginBottom: '8px' }}>
                        {titleFmt !== 'NONE' && (
                          titleFmt === 'H1' ? (
                            <h2 style={{ margin: '0 0 6px 0', fontSize: 'var(--pw-font-h1)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '2px' }}>
                              {renderFormattedText(block.title)}
                            </h2>
                          ) : titleFmt === 'H2' ? (
                            <div style={{ padding: '3px 6px', background: '#f1f5f9', borderLeft: '3px solid #000', fontWeight: 'var(--pw-weight-heavy)', fontSize: 'var(--pw-font-h2)', textTransform: 'uppercase', marginBottom: '6px' }}>
                              {renderFormattedText(block.title)}
                            </div>
                          ) : (
                            <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', marginBottom: '4px' }}>
                              {renderFormattedText(block.title)}
                            </div>
                          )
                        )}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: getInfoGridTemplateColumns(block as any),
                          columnGap: '12px',
                          rowGap: '6px',
                          fontSize: 'var(--pw-font-body)'
                        }}>
                          {(block.boundFieldIds || []).map(fid => {
                            const field = allFormFields.find(f => f.id === fid);
                            const override = block.ruleOverrides?.[fid];
                            const isLabelHidden = !!override?.hideLabel;
                            const displayLabel = override?.customLabel !== undefined
                              ? override.customLabel
                              : (field?.checkItem || fid);
                            const val = getFieldValue(fid);
                            return (
                              <div key={fid} style={{ display: 'flex', justifyContent: isLabelHidden ? 'flex-start' : 'space-between', borderBottom: '1px dotted #94a3b8', paddingBottom: '2px' }}>
                                {!isLabelHidden && <span style={{ color: '#475569', fontWeight: 'var(--pw-weight-medium)' }}>{renderFormattedText(displayLabel)}:</span>}
                                <strong style={{ color: '#000000', marginLeft: isLabelHidden ? '0' : '6px', fontWeight: 'var(--pw-weight-heavy)' }}>{val}</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 4. TABLE Block */}
                  {block.type === 'TABLE' && (() => {
                    const titleFmt = block.titleFormat || 'H2';
                    const borderStyle = block.borderStyle || 'grid';
                    const tableBorder = borderStyle === 'grid' ? '1px solid #000' : 'none';
                    const cellBorder = borderStyle === 'grid' ? '1px solid #000' : borderStyle === 'horizontal_only' ? '1px solid #cbd5e1' : 'none';

                    return (
                      <div style={{ marginBottom: '8px' }}>
                        {titleFmt !== 'NONE' && (
                          titleFmt === 'H1' ? (
                            <h2 style={{ margin: '0 0 6px 0', fontSize: 'var(--pw-font-h1)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase', borderBottom: '2px solid #000', paddingBottom: '2px' }}>
                              {renderFormattedText(block.title)}
                            </h2>
                          ) : titleFmt === 'H2' ? (
                            <div style={{ padding: '3px 6px', background: '#f1f5f9', borderLeft: '3px solid #000', fontWeight: 'var(--pw-weight-heavy)', fontSize: 'var(--pw-font-h2)', textTransform: 'uppercase', marginBottom: '6px' }}>
                              {renderFormattedText(block.title)}
                            </div>
                          ) : (
                            <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', marginBottom: '4px' }}>
                              {renderFormattedText(block.title)}
                            </div>
                          )
                        )}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', border: '1px solid #000', padding: '10px', textAlign: 'center', marginTop: '10px' }}>
                      <div>
                        <div style={{ fontSize: 'var(--pw-font-sub)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase' }}>NGƯỜI KIỂM TRA</div>
                        <div style={{ fontSize: 'var(--pw-font-xs)', color: '#64748b', marginBottom: '28px' }}>(Ký và ghi rõ họ tên)</div>
                        <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
                          {operatorText}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 'var(--pw-font-sub)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase' }}>NGƯỜI THẨM TRA (QA/QC)</div>
                        <div style={{ fontSize: 'var(--pw-font-xs)', color: '#64748b', marginBottom: '28px' }}>(Ký và ghi rõ họ tên)</div>
                        <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
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
      <div className="print-footer">
        <div>{template.reportId || ''}</div>
        <div>
          {formatFormVersion(
            template.version || 'v1.0',
            template.status,
            template.effectiveDate,
            template.updatedAt
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintReport;