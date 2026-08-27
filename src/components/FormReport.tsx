import React, { useState, useEffect } from 'react';
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
import PrintReport from './print/PrintReport';
import {
  FileText,
  Printer,
  ArrowLeft,
  AlertTriangle,
  Plus
} from 'lucide-react';

interface FormReportProps {
  submissionId: string;
  onClose: () => void;
  onOpenBuilder?: (formId: string) => void;
}

export const FormReport: React.FC<FormReportProps> = ({
  submissionId,
  onClose,
  onOpenBuilder
}) => {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [formTemplate, setFormTemplate] = useState<FormTemplateISO | null>(null);
  const [reportTemplate, setReportTemplate] = useState<ReportTemplateISO | null>(null);
  const [computedData, setComputedData] = useState<ReportDataModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintPortal, setShowPrintPortal] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch submission record
        const subRes = await fetch(`/api/submissions/${submissionId}`);
        if (!subRes.ok) throw new Error(`Không tìm thấy bản nộp ID ${submissionId}`);
        const subData: any = await subRes.json();
        setSubmission(subData);

        const formId = subData.formId || subData.form_id;

        // 2. Fetch source form template
        const formRes = await fetch(`/api/forms/${formId}`);
        if (!formRes.ok) throw new Error(`Không tìm thấy biểu mẫu gốc ID ${formId}`);
        const formData = await formRes.json();
        setFormTemplate(formData);

        // 3. Fetch active report template linked to this form
        const repRes = await fetch(`/api/reports/by-form/${formId}`);
        if (repRes.ok) {
          const repData: ReportTemplateISO = await repRes.json();
          setReportTemplate(repData);
          // Compute report insights
          const computed = computeRecordReport(subData, formData, repData);
          setComputedData(computed);
        } else {
          setReportTemplate(null);
        }
      } catch (err: any) {
        console.error('Error loading report view:', err);
        setError(err.message || 'Lỗi khi tải dữ liệu báo cáo.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [submissionId]);

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Đang tạo báo cáo đánh giá chất lượng...</p>
      </div>
    );
  }

  if (error || !submission || !formTemplate) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#ffffff', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '1rem' }} />
        <h3 style={{ margin: '0 0 0.5rem 0' }}>Không thể hiển thị báo cáo</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{error || 'Dữ liệu không đầy đủ.'}</p>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          <ArrowLeft size={14} /> Quay lại
        </button>
      </div>
    );
  }

  // ─── Empty State View (Decision 5: Option B) ───
  if (!reportTemplate) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#f8fafc', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '56px', background: '#ffffff', borderBottom: '1px solid var(--neutral-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> Quay lại danh sách
          </button>
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
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                Đóng
              </button>
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
  const allFormFields: FormFieldISO[] = extractAllFormFields(formTemplate?.layoutBlocks || []);

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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#f1f5f9', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* ── Top Header Bar ── */}
      <div style={{ height: '56px', background: '#ffffff', borderBottom: '1px solid var(--neutral-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> Quay lại
          </button>
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

      {/* ── Report Content Container ── */}
      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* KPI Scorecard Cards Summary */}
        <div style={{ width: '100%', maxWidth: '698px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          <div className="paper-card" style={{ padding: '0.75rem', textAlign: 'center', background: '#ffffff' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TỔNG HẠNG MỤC</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{computedData?.totalEvaluated || 0}</div>
          </div>
          <div className="paper-card" style={{ padding: '0.75rem', textAlign: 'center', background: '#ffffff' }}>
            <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>ĐẠT TIÊU CHUẨN</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>{computedData?.passCount || 0}</div>
          </div>
          <div className="paper-card" style={{ padding: '0.75rem', textAlign: 'center', background: '#ffffff' }}>
            <div style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 600 }}>LỆCH CHUẨN (NG)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.2rem' }}>{computedData?.failCount || 0}</div>
          </div>
          <div className="paper-card" style={{ padding: '0.75rem', textAlign: 'center', background: computedData?.overallStatus === 'PASS' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${computedData?.overallStatus === 'PASS' ? '#bbf7d0' : '#fecaca'}` }}>
            <div style={{ fontSize: '0.7rem', color: computedData?.overallStatus === 'PASS' ? '#15803d' : '#b91c1c', fontWeight: 700 }}>ĐÁNH GIÁ CHUNG</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: computedData?.overallStatus === 'PASS' ? '#15803d' : '#b91c1c', marginTop: '0.2rem' }}>
              {computedData?.overallStatus === 'PASS' ? '✓ ĐẠT (PASS)' : '✗ KHÔNG ĐẠT'}
            </div>
          </div>
        </div>

        {/* A4 Printable Paper Card Preview */}
        <div
          className="paper-card"
          style={{
            width: '100%',
            maxWidth: '698px',
            background: '#ffffff',
            padding: '1.75rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          {reportTemplate.layoutBlocks.map((block) => (
            <div key={block.id}>
              
              {/* TITLE */}
              {block.type === 'TITLE' && (
                <div style={{ border: '1px solid #000', padding: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{reportTemplate.reportId}</div>
                  <h3 style={{ margin: '0.25rem 0', fontSize: '1.15rem', fontWeight: 700 }}>{block.title || reportTemplate.reportTitle}</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', marginTop: '0.5rem', color: '#475569', borderTop: '1px solid #000', paddingTop: '0.4rem' }}>
                    <span>Biểu mẫu: <strong>{reportTemplate.linkedFormId}</strong></span>
                    <span>Ngày lập: <strong>{submittedAtText}</strong></span>
                    <span>Người kiểm tra: <strong>{operatorText}</strong></span>
                  </div>
                </div>
              )}

              {/* SECTION_LABEL */}
              {block.type === 'SECTION_LABEL' && (() => {
                const titleFmt = block.titleFormat || 'H1';
                if (titleFmt === 'NONE') return null;

                return (
                  <div style={{ marginBottom: '8px' }}>
                    {titleFmt === 'H1' ? (
                      <h2 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#0f172a' }}>
                        {renderFormattedText(block.title)}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid var(--primary)', fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginBottom: '4px' }}>
                        {renderFormattedText(block.title)}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {renderFormattedText(block.title)}
                      </div>
                    )}
                    {block.description && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                        {renderFormattedText(block.description)}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* INFO_GRID */}
              {block.type === 'INFO_GRID' && (
                <div>
                  {block.title && <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.35rem' }}>{block.title}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.columns || 2}, 1fr)`, gap: '0.5rem', border: '1px solid #000', padding: '0.5rem' }}>
                    {(block.boundFieldIds || []).map(fid => {
                      const field = allFormFields.find(f => f.id === fid);
                      const val = getFieldValue(fid);
                      return (
                        <div key={fid} style={{ fontSize: '0.75rem' }}>
                          <span style={{ color: '#64748b' }}>{field?.checkItem || fid}: </span>
                          <strong>{val}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TABLE: Spec Evaluation */}
              {block.type === 'TABLE' && (
                <div>
                  {block.title && <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.35rem' }}>{block.title}</div>}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid #000' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #000' }}>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left', width: '30%' }}>Hạng mục kiểm tra</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '25%' }}>Quy cách / Tiêu chuẩn</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '20%' }}>Kết quả thực tế</th>
                        <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '25%' }}>Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(block.boundFieldIds || []).map(fid => {
                        const field = allFormFields.find(f => f.id === fid);
                        const evalRes = computedData?.evaluations?.[fid];
                        const override = block.ruleOverrides?.[fid];
                        const min = override?.customMinSpec !== undefined ? override.customMinSpec : field?.minSpec;
                        const max = override?.customMaxSpec !== undefined ? override.customMaxSpec : field?.maxSpec;

                        let specText = field?.targetRange || '—';
                        if (min !== undefined && max !== undefined) specText = `${min} ~ ${max} ${field?.unit || ''}`;
                        else if (min !== undefined) specText = `≥ ${min} ${field?.unit || ''}`;
                        else if (max !== undefined) specText = `≤ ${max} ${field?.unit || ''}`;

                        const rawVal = getFieldValue(fid);
                        const status = evalRes?.status || 'PASS';

                        return (
                          <tr key={fid} style={{ borderBottom: '1px solid #000' }}>
                            <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{field?.checkItem || fid}</td>
                            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{specText}</td>
                            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{rawVal}</td>
                            <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                background: status === 'PASS' ? '#dcfce7' : status === 'FAIL' ? '#fee2e2' : '#f1f5f9',
                                color: status === 'PASS' ? '#15803d' : status === 'FAIL' ? '#b91c1c' : '#475569'
                              }}>
                                {status === 'PASS' ? '✓ ĐẠT (PASS)' : status === 'FAIL' ? '✗ KHÔNG ĐẠT' : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SIGN */}
              {block.type === 'SIGN' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', border: '1px solid #000', padding: '0.75rem', textAlign: 'center', marginTop: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>NGƯỜI KIỂM TRA</div>
                    <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                      {operatorText !== '—' ? `[Đã ký: ${operatorText}]` : '(Ký và ghi rõ họ tên)'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>NGƯỜI THẨM TRA (QA/QC)</div>
                    <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                      {supervisorText ? `[Thẩm tra: ${supervisorText}]` : '(Chưa ký duyệt)'}
                    </div>
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      </div>

      {/* ── Print Portal Renderer ── */}
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