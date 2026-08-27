import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import type {
  ReportTemplateISO,
  Submission,
  FormTemplateISO,
  FormFieldISO
} from '../../types';
import { computeRecordReport } from '../../utils/reportCompute';

interface PrintReportProps {
  template: ReportTemplateISO;
  submission: Submission;
  formTemplate: FormTemplateISO;
  onClose: () => void;
}

export const PrintReport: React.FC<PrintReportProps> = ({
  template,
  submission,
  formTemplate,
  onClose
}) => {
  const computed = computeRecordReport(submission, formTemplate, template);
  const allFormFields: FormFieldISO[] = (formTemplate.layoutBlocks || []).flatMap(b => b.fields || []);

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

  const operatorText = (submission as any)?.operatorId || (submission as any)?.operator_id || 'Người vận hành';
  const supervisorText = (submission as any)?.supervisorSignoff?.signedBy || (submission as any)?.supervisor_signoff?.supervisor_name || '(Chưa ký duyệt)';

  useEffect(() => {
    // Add print trigger handling
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const content = (
    <div className="print-portal-root" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#ffffff', overflowY: 'auto' }}>
      
      {/* Screen action bar - hidden during print via @media print */}
      <div className="no-print" style={{ position: 'fixed', top: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 10000, background: 'rgba(255,255,255,0.95)', padding: '6px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #cbd5e1' }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 14px', background: '#10a3a3', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
        >
          🖨️ In lại (Print)
        </button>
        <button
          onClick={onClose}
          style={{ padding: '6px 14px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
        >
          ✕ Đóng (Close)
        </button>
      </div>

      {/* A4 Document Body */}
      <div
        className="print-page"
        style={{
          width: '698px',
          margin: '0 auto',
          padding: '20px 24px',
          color: '#000000',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#ffffff',
          boxSizing: 'border-box'
        }}
      >
        {template.layoutBlocks.map((block) => (
          <div key={block.id} style={{ marginBottom: '14px', pageBreakInside: 'avoid' }}>
            
            {/* TITLE Block */}
            {block.type === 'TITLE' && (
              block.logo ? (
                <div style={{
                  padding: '8px 0',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px',
                  position: 'relative',
                  pageBreakInside: 'avoid'
                }}>
                  <div style={{ marginRight: '16px', display: 'flex', alignItems: 'center', height: '60px' }}>
                    <img src={block.logo} alt="Logo" style={{ maxHeight: '60px', maxWidth: '240px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <h1 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>
                      {block.title || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ'}
                    </h1>
                    {block.description && (
                      <p style={{ margin: 0, fontSize: '11px', fontStyle: 'italic', color: '#475569' }}>
                        {block.description}
                      </p>
                    )}
                    {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                      <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569', textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 600 : 400 }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                      </div>
                    )}
                  </div>
                  {block.showDate && block.datePosition === 'A' && (
                    <div style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '2px' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 600 : 400 }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '8px 0',
                  textAlign: 'center',
                  marginBottom: '10px',
                  position: 'relative',
                  pageBreakInside: 'avoid'
                }}>
                  {block.showDate && block.datePosition === 'A' && (
                    <div style={{ position: 'absolute', right: 0, top: '8px', fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 600 : 400 }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                    </div>
                  )}
                  <h1 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', color: '#000000' }}>
                    {block.title || template.reportTitle || 'BÁO CÁO ĐÁNH GIÁ'}
                  </h1>
                  {block.description && (
                    <p style={{ margin: 0, fontSize: '11px', fontStyle: 'italic', color: '#475569' }}>
                      {block.description}
                    </p>
                  )}
                  {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#000000', letterSpacing: submittedAtText !== '—' ? '0px' : '2px', fontWeight: submittedAtText !== '—' ? 600 : 400 }}>{submittedAtText !== '—' ? submittedAtText : '\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0'}</span>
                    </div>
                  )}
                </div>
              )
            )}

            {/* SECTION_LABEL Block */}
            {block.type === 'SECTION_LABEL' && (
              <div style={{ background: '#f1f5f9', borderLeft: '4px solid #000', padding: '4px 8px', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', marginBottom: '6px' }}>
                {block.title}
              </div>
            )}

            {/* INFO_GRID Block */}
            {block.type === 'INFO_GRID' && (
              <div style={{ border: '1px solid #000', padding: '8px' }}>
                {block.title && <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>{block.title}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.columns || 2}, 1fr)`, gap: '6px 16px', fontSize: '11px' }}>
                  {(block.boundFieldIds || []).map(fid => {
                    const field = allFormFields.find(f => f.id === fid);
                    const val = getFieldValue(fid);
                    return (
                      <div key={fid} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #cbd5e1', paddingBottom: '2px' }}>
                        <span style={{ color: '#334155' }}>{field?.checkItem || fid}:</span>
                        <strong style={{ color: '#000000' }}>{val}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TABLE Block */}
            {block.type === 'TABLE' && (
              <div>
                {block.title && <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '4px' }}>{block.title}</div>}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', border: '1px solid #000' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #000' }}>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left', width: '32%' }}>Hạng mục kiểm tra</th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '28%' }}>Quy cách / Tiêu chuẩn</th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '20%' }}>Kết quả thực tế</th>
                      <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '20%' }}>Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(block.boundFieldIds || []).map(fid => {
                      const field = allFormFields.find(f => f.id === fid);
                      const evalRes = computed.evaluations[fid];
                      const override = block.ruleOverrides?.[fid];
                      const min = override?.customMinSpec !== undefined ? override.customMinSpec : field?.minSpec;
                      const max = override?.customMaxSpec !== undefined ? override.customMaxSpec : field?.maxSpec;

                      let specText = field?.targetRange || '—';
                      if (min !== undefined && max !== undefined) specText = `${min} ~ ${max} ${field?.unit || ''}`;
                      else if (min !== undefined) specText = `≥ ${min} ${field?.unit || ''}`;
                      else if (max !== undefined) specText = `≤ ${max} ${field?.unit || ''}`;

                      const rawVal = getFieldValue(fid);
                      const isPass = evalRes?.status === 'PASS';
                      const isFail = evalRes?.status === 'FAIL';

                      return (
                        <tr key={fid} style={{ borderBottom: '1px solid #000' }}>
                          <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{field?.checkItem || fid}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{specText}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{rawVal}</td>
                          <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}>
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
            )}

            {/* SIGN Block */}
            {block.type === 'SIGN' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', border: '1px solid #000', padding: '10px', textAlign: 'center', marginTop: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>NGƯỜI KIỂM TRA</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '28px' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
                    {operatorText}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>NGƯỜI THẨM TRA (QA/QC)</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '28px' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, borderTop: '1px dotted #94a3b8', paddingTop: '4px' }}>
                    {supervisorText}
                  </div>
                </div>
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

export default PrintReport;