import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import type {
  Submission,
  FormTemplateISO,
  ReportTemplateISO,
  ReportDataModel,
  FormFieldISO
} from '../types';
import { computeRecordReport } from '../utils/reportCompute';
import { extractAllFormFields } from '../utils/tableFieldExtractor';
import { renderFormattedText } from '../utils/textFormatter';
import { getInfoGridTemplateColumns } from '../utils/formUtils';
import PrintReport from './print/PrintReport';
import {
  usePrintLogo,
  PrintTitleBlock,
  PrintSectionHeader,
  renderReportField
} from './print/printShared';
import { RadarChartBlock } from './report/RadarChartBlock';
import { BarChartBlock } from './report/BarChartBlock';
import {
  FileText,
  Printer,
  ArrowLeft,
  AlertTriangle,
  Plus
} from 'lucide-react';

interface FormReportProps {
  submissionId: string;
  onClose?: () => void;
  onOpenBuilder?: (formId: string) => void;
  isEmbedded?: boolean;
  token?: string;
  triggerPrint?: boolean;
  onPrintHandled?: () => void;
  // ── Bypass props (khi nhúng trong FormFiller) ──
  // Khi đủ cả 3, không cần bất kỳ network fetch nào
  initialSubmission?: Submission;
  initialFormTemplate?: FormTemplateISO;
  initialReportTemplate?: ReportTemplateISO;
}

export const FormReport: React.FC<FormReportProps> = ({
  submissionId,
  onClose,
  onOpenBuilder,
  isEmbedded = false,
  token,
  triggerPrint,
  onPrintHandled,
  initialSubmission: bypassSubmission,
  initialFormTemplate: bypassFormTemplate,
  initialReportTemplate: bypassReportTemplate,
}) => {
  const { currentUser } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [formTemplate, setFormTemplate] = useState<FormTemplateISO | null>(null);
  const [reportTemplate, setReportTemplate] = useState<ReportTemplateISO | null>(null);
  const [computedData, setComputedData] = useState<ReportDataModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintPortal, setShowPrintPortal] = useState<boolean>(false);

  const titleBlock = reportTemplate?.layoutBlocks?.find(b => b.type === 'TITLE');
  const { logoUrl } = usePrintLogo(titleBlock?.logo);

  useEffect(() => {
    if (triggerPrint) {
      setShowPrintPortal(true);
      onPrintHandled?.();
    }
  }, [triggerPrint, onPrintHandled]);

  useEffect(() => {
    // Normalize raw DB row → camelCase FormTemplateISO (layout_blocks → layoutBlocks)
    const normalizeForm = (raw: any): any => ({
      ...raw,
      layoutBlocks: raw.layoutBlocks || raw.layout_blocks || []
    });

    const fetchData = async () => {
      try {
        setLoading(true);

        // ── Nhánh A: Zero-fetch — đủ cả 3 bypass props từ FormFiller ──
        if (bypassSubmission && bypassFormTemplate && bypassReportTemplate) {
          const normForm = normalizeForm(bypassFormTemplate);
          setSubmission(bypassSubmission);
          setFormTemplate(normForm);
          setReportTemplate(bypassReportTemplate);
          const computed = computeRecordReport(bypassSubmission, normForm, bypassReportTemplate);
          setComputedData(computed);
          return; // Không fetch gì cả — render ngay lập tức
        }

        // ── Nhánh B: 1 fetch nhẹ — có submission + formTemplate, chỉ thiếu reportTemplate ──
        if (bypassSubmission && bypassFormTemplate) {
          const normForm = normalizeForm(bypassFormTemplate);
          setSubmission(bypassSubmission);
          setFormTemplate(normForm);
          const formId = bypassFormTemplate.formId;
          const repRes = await fetch(`/api/reports/by-form/${encodeURIComponent(formId)}`);
          if (repRes.ok) {
            const repData: ReportTemplateISO = await repRes.json();
            setReportTemplate(repData);
            const computed = computeRecordReport(bypassSubmission, normForm, repData);
            setComputedData(computed);
          }
          return;
        }

        // ── Nhánh C: Full fetch fallback — standalone /r/:id hoặc không có bypass props ──
        const jwtToken = currentUser ? localStorage.getItem('jwt_token') : null;

        if (jwtToken && !token) {
          // Authenticated bundle (2 RTT)
          const bundleRes = await fetch(
            `/api/reports/view-auth/${encodeURIComponent(submissionId)}`,
            { headers: { Authorization: `Bearer ${jwtToken}` } }
          );
          if (!bundleRes.ok) throw new Error(`Không tìm thấy bản nộp ID ${submissionId}`);
          const bundle = await bundleRes.json();
          const normForm = normalizeForm(bundle.formTemplate);
          setSubmission(bundle.submission);
          setFormTemplate(normForm);
          if (bundle.reportTemplate) {
            setReportTemplate(bundle.reportTemplate);
            const computed = computeRecordReport(bundle.submission, normForm, bundle.reportTemplate);
            setComputedData(computed);
          }
        } else {
          // Public path
          const subUrl = `/api/submissions/view/${encodeURIComponent(submissionId)}`;
          const subRes = await fetch(subUrl);
          if (!subRes.ok) throw new Error(`Không tìm thấy bản nộp ID ${submissionId}`);
          const subData: any = await subRes.json();
          setSubmission(subData);
          const formId = subData.formId || subData.form_id;

          const [formRes, repRes] = await Promise.all([
            fetch(`/api/forms/${formId}`),
            fetch(`/api/reports/by-form/${formId}`)
          ]);
          if (!formRes.ok) throw new Error(`Không tìm thấy biểu mẫu gốc ID ${formId}`);
          const normForm = normalizeForm(await formRes.json());
          setFormTemplate(normForm);
          if (repRes.ok) {
            const repData: ReportTemplateISO = await repRes.json();
            setReportTemplate(repData);
            const computed = computeRecordReport(subData, normForm, repData);
            setComputedData(computed);
          }
        }
      } catch (err: any) {
        console.error('Error loading report view:', err);
        setError(err.message || 'Lỗi khi tải dữ liệu báo cáo.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [submissionId, currentUser, bypassSubmission, bypassFormTemplate, bypassReportTemplate]);

  if (loading) {
    const skeletonRow = (w: string) => (
      <div style={{ height: '12px', background: 'var(--neutral-bg)', borderRadius: '4px', width: w, marginBottom: '8px' }} />
    );
    const skeletonBlock = (
      <div style={{ marginBottom: '1.5rem' }}>
        {skeletonRow('40%')}
        {skeletonRow('80%')}
        {skeletonRow('60%')}
      </div>
    );
    if (isEmbedded) {
      return (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="paper-card" style={{ width: '100%', padding: '2rem', background: '#ffffff', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--card-radius, 8px)' }}>
            <div style={{ height: '14px', background: 'var(--neutral-bg)', borderRadius: '4px', width: '55%', marginBottom: '1.5rem' }} />
            {skeletonBlock}{skeletonBlock}{skeletonBlock}
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="paper-card" style={{ maxWidth: '820px', width: '100%', padding: '2.5rem 2rem', background: '#ffffff', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--card-radius, 8px)' }}>
          <div style={{ height: '14px', background: 'var(--neutral-bg)', borderRadius: '4px', width: '55%', marginBottom: '1.5rem' }} />
          {skeletonBlock}{skeletonBlock}{skeletonBlock}
        </div>
      </div>
    );
  }

  if (error || !submission || !formTemplate) {
    if (isEmbedded) {
      return (
        <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
          <AlertTriangle size={32} color="#ef4444" style={{ margin: '0 auto 0.75rem' }} />
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Không thể hiển thị báo cáo</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{error || 'Dữ liệu không đầy đủ.'}</p>
        </div>
      );
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#ffffff', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Không thể hiển thị báo cáo</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error || 'Dữ liệu không đầy đủ.'}</p>
        {onClose && (
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <ArrowLeft size={14} /> Quay lại
          </button>
        )}
      </div>
    );
  }

  // ─── Empty State View (Decision 5: Option B) ───
  if (!reportTemplate) {
    if (isEmbedded) {
      return (
        <div style={{ width: '100%', padding: '2rem 1rem', display: 'flex', justifyContent: 'center' }}>
          <div className="paper-card" style={{ maxWidth: '540px', width: '100%', background: '#ffffff', padding: '2rem', textAlign: 'center', borderRadius: '12px' }}>
            <FileText size={40} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Chưa có mẫu Báo cáo cho biểu mẫu này
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Biểu mẫu <strong>{formTemplate.formTitle || formTemplate.formId}</strong> hiện chưa được thiết lập mẫu Report Template để tính điểm đánh giá và biểu đồ.
            </p>
            {onOpenBuilder && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onOpenBuilder(formTemplate.formId)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} /> Thiết lập Báo cáo ngay
              </button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '56px', background: '#ffffff', borderBottom: '1px solid var(--neutral-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
          {onClose && (
            <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ArrowLeft size={14} /> Quay lại danh sách
            </button>
          )}
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Báo cáo nộp: {submission.id}</span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="paper-card" style={{ maxWidth: '540px', width: '100%', background: '#ffffff', padding: '2.5rem 2rem', textAlign: 'center', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
            <FileText size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem', opacity: 0.8 }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
              Chưa có mẫu Báo cáo cho biểu mẫu này
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Biểu mẫu <strong>{formTemplate.formTitle || formTemplate.formId}</strong> hiện chưa được thiết lập mẫu Report Template tương ứng để tính điểm đánh giá và bảng đối chiếu quy cách.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              {onClose && (
                <button className="btn btn-secondary btn-sm" onClick={onClose}>
                  Đóng
                </button>
              )}
              {onOpenBuilder && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onOpenBuilder(formTemplate.formId)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={14} /> Thiết lập Báo cáo ngay (Report Builder)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Report Presentation View ───
  const allFormFields: FormFieldISO[] = useMemo(
    () => extractAllFormFields(formTemplate?.layoutBlocks || []),
    [formTemplate?.layoutBlocks]
  );
  const fieldMap = useMemo(() => {
    const m = new Map<string, FormFieldISO>();
    allFormFields.forEach(f => m.set(f.id, f));
    return m;
  }, [allFormFields]);

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
    ? new Date((submission as any).submittedAt || (submission as any).submitted_at).toLocaleDateString('vi-VN')
    : '—';

  const operatorText = (submission as any)?.operatorId || (submission as any)?.operator_id || '—';
  const supervisorText = (submission as any)?.supervisorSignoff?.signedBy || (submission as any)?.supervisor_signoff?.supervisor_name || '';
  const effectivePageSize = (reportTemplate as any)?.pageSize || (reportTemplate as any)?.page_size || (formTemplate as any)?.pageSize || (formTemplate as any)?.page_size || 'A4';
  const isA5 = effectivePageSize === 'A5_LANDSCAPE' || effectivePageSize === 'A5';
  const reportMaxWidth = isA5 ? '920px' : '820px';

  const reportContent = (
    <div style={{ padding: isEmbedded ? '0 0 2rem' : '1.5rem 0 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* A4/A5 Printable Paper Card Preview */}
      <div
        className="paper-card print-doc"
        style={{
          width: '100%',
          maxWidth: isEmbedded ? '100%' : reportMaxWidth,
          height: 'auto',
          flexShrink: 0,
          overflow: 'visible',
          background: '#ffffff',
          padding: '2rem',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--card-radius, 8px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, sans-serif",
          color: '#000000'
        }}
      >
        {reportTemplate.layoutBlocks.filter(b => !b.hiddenInReport).map((block) => (
          <div key={block.id} style={{ marginBottom: '8px' }}>
            
            {/* 1. TITLE */}
            {block.type === 'TITLE' && (
              <PrintTitleBlock
                block={{
                  ...block,
                  title: block.title || reportTemplate.reportTitle || 'BÁO CÁO ĐÁNH GIÁ'
                }}
                logoUrl={logoUrl}
                dateValueNode={
                  <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 'var(--pw-weight-medium)' : 'var(--pw-weight-regular)' }}>
                    {submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}
                  </span>
                }
              />
            )}

            {/* 2. SECTION_LABEL */}
            {block.type === 'SECTION_LABEL' && (
              <PrintSectionHeader block={block} showDescription={true} marginBottom="6px" />
            )}

            {/* 3. INFO_GRID */}
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

            {/* 4. TABLE: Spec Evaluation */}
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
                        const field = fieldMap.get(fid);
                        const evalRes = computedData?.evaluations?.[fid];
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
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontSize: '0.7rem',
                                fontWeight: 'var(--pw-weight-heavy)',
                                background: isPass ? '#dcfce7' : isFail ? '#fee2e2' : '#f1f5f9',
                                color: isPass ? '#15803d' : isFail ? '#b91c1c' : '#475569'
                              }}>
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

            {/* 5. SIGN */}
            {block.type === 'SIGN' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '24px',
                padding: '12px 0',
                textAlign: 'center',
                marginTop: '16px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 'var(--pw-font-sub)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase' }}>NGƯỜI KIỂM TRA</div>
                  <div style={{ fontSize: 'var(--pw-font-xs)', fontStyle: 'italic', color: '#64748b', marginBottom: '32px' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', minWidth: '160px', borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
                    {operatorText !== '—' ? operatorText : '\u00a0'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: 'var(--pw-font-sub)', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase' }}>NGƯỜI THẨM TRA (QA/QC)</div>
                  <div style={{ fontSize: 'var(--pw-font-xs)', fontStyle: 'italic', color: '#64748b', marginBottom: '32px' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontSize: 'var(--pw-font-body)', fontWeight: 'var(--pw-weight-heavy)', minWidth: '160px', borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
                    {supervisorText || '\u00a0'}
                  </div>
                </div>
              </div>
            )}

          </div>
        ))}

        {/* Footer info at paper bottom */}
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: '#64748b'
        }}>
          <span>{reportTemplate.reportId}</span>
          <span>{reportTemplate.version || 'v1.0'} &bull; Biểu mẫu liên kết: {reportTemplate.linkedFormId}</span>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {reportContent}
        {showPrintPortal && (
          <PrintReport
            template={reportTemplate}
            submission={submission}
            formTemplate={formTemplate}
            onClose={() => setShowPrintPortal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#f1f5f9', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '56px', background: '#ffffff', borderBottom: '1px solid var(--neutral-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {onClose && (
            <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ArrowLeft size={14} /> Quay lại
            </button>
          )}
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{reportTemplate.reportTitle}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>({reportTemplate.reportId})</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowPrintPortal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Printer size={14} /> In Báo cáo / Lưu PDF
          </button>
        </div>
      </div>

      {reportContent}

      {showPrintPortal && (
        <PrintReport
          template={reportTemplate}
          submission={submission}
          formTemplate={formTemplate}
          onClose={() => setShowPrintPortal(false)}
        />
      )}
    </div>
  );
};

export default FormReport;