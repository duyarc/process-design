import React from 'react';
import ReactDOM from 'react-dom';
import type { FormTemplateISO } from '../../types';
import { formatFormVersion } from '../../types';

interface PrintBlankFormProps {
  template: FormTemplateISO;
  onClose: () => void;
}

export default function PrintBlankForm({ template, onClose }: PrintBlankFormProps) {
  const [logoUrl, setLogoUrl] = React.useState<string>('');

  const titleBlock = template.layoutBlocks.find(b => b.type === 'TITLE');
  const titleBlockLogo = titleBlock?.logo;

  React.useEffect(() => {
    if (!titleBlockLogo) {
      setLogoUrl('');
      return;
    }
    if (titleBlockLogo.startsWith('uploads/')) {
      fetch(`/api/storage/download-url?key=${encodeURIComponent(titleBlockLogo)}`)
        .then(res => res.json())
        .then(data => {
          if (data.downloadUrl) {
            setLogoUrl(data.downloadUrl);
          }
        })
        .catch(err => {
          console.error('Error fetching logo URL for print:', err);
          setLogoUrl('');
        });
    } else {
      setLogoUrl(titleBlockLogo);
    }
  }, [titleBlockLogo]);

  // Trigger print dialog immediately on mount and close when done
  React.useEffect(() => {
    const handleAfterPrint = () => {
      onClose();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    const timer = setTimeout(() => {
      window.print();
    }, 500);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timer);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="print-container" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999,
      background: '#ffffff',
      color: '#000000',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      overflowY: 'auto'
    }}>
      {/* Dynamic CSS override to force portrait printing and clean page breaks */}
      <style>{`
        @media print {
          #root {
            display: none !important;
          }
          html, body {
            height: 100% !important;
          }
          .print-container {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            padding: 0 0 30px 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
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
          .print-block {
            margin-bottom: 12px;
          }
          .print-block-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-table tfoot td {
            border-bottom: none !important;
            border-left: none !important;
            border-right: none !important;
            background: transparent !important;
          }
          .print-footer {
            position: fixed;
            bottom: 8px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            font-family: inherit;
            color: #475569;
          }
        }
      `}</style>

      {/* Default footer forced at the bottom of printed page (Moved to top for Chromium print viewport rendering fix) */}
      <div className="print-footer">
        <span>{template.formId || 'N/A'}</span>
        <span>{formatFormVersion(template.version || 'v1.0')}</span>
      </div>

      {/* Close button (only visible on screen) */}
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
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Blank Form: {template.formTitle}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Print Form
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Back
          </button>
        </div>
      </div>

      {/* Dynamic Blocks Rendering */}
      {template.layoutBlocks && template.layoutBlocks.map((block) => {
        return (
          <div key={block.id} className={`print-block ${block.type !== 'CHECKLIST_TABLE' ? 'print-block-avoid' : ''}`}>
            
            {/* 1. TITLE BLOCK */}
            {block.type === 'TITLE' && (
              block.logo ? (
                <div style={{
                  padding: '10px 0',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '15px'
                }}>
                  {logoUrl && (
                    <div style={{
                      marginRight: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      height: '65px'
                    }}>
                      <img src={logoUrl} alt="Logo" style={{ maxHeight: '65px', maxWidth: '260px', objectFit: 'contain' }} />
                    </div>
                  )}
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <h1 style={{ margin: '0 0 2px 0', fontSize: '1.35rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      {block.title}
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
                      {block.fields[0]?.checkItem || ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '10px 0',
                  textAlign: 'center',
                  marginBottom: '15px'
                }}>
                  <h1 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    {block.title}
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
                    {block.fields[0]?.checkItem || ''}
                  </p>
                </div>
              )
            )}

            {/* 2. INFO GRID BLOCK */}
            {block.type === 'INFO_GRID' && (() => {
              const cols: any[][] = Array.from({ length: block.columns }, () => []);
              block.fields.forEach((f, idx) => {
                cols[idx % block.columns].push(f);
              });

              return (
                <div style={{
                  padding: '10px 0',
                  marginTop: '10px',
                  marginBottom: '15px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '40px'
                  }}>
                    {cols.map((colFields, colIdx) => (
                      <div key={colIdx} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {colFields.map(f => (
                          <div key={f.id} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{f.checkItem}:</span>
                            {(f.type === 'checkbox' || f.type === 'radio') ? (
                              <div style={{ display: 'inline-flex', gap: '15px', alignItems: 'center' }}>
                                {(f.options ?? [{ label: 'Có', value: 'YES' }, { label: 'Không', value: 'NO' }]).map((opt: any) => (
                                  <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      width: '14px',
                                      height: '14px',
                                      border: '1.5px solid #000000',
                                      background: '#ffffff',
                                      borderRadius: '2px'
                                    }} />
                                    <span>{opt.label}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ flex: 1, borderBottom: '1px solid #000000', minHeight: '16px' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 3. CHECKLIST TABLE BLOCK */}
            {block.type === 'CHECKLIST_TABLE' && (
              <div style={{ marginTop: '15px' }}>
                <table className="print-table" style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>{block.columnLabels?.stt || 'STT'}</th>
                      <th style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}>{block.columnLabels?.item || 'Chi tiết kiểm tra'}</th>
                      <th style={{ width: '130px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>{block.columnLabels?.target || 'Đạt / Không Đạt'}</th>
                      <th style={{ width: '220px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}>{block.columnLabels?.reaction || 'Mô tả cụ thể nếu Không đạt'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.fields.map((field, idx) => {
                      const matchHeader = field.checkItem.match(/^\[(.*?)\]\s*(.*)$/);
                      let displayTitle = field.checkItem;
                      let sectionHeader = '';
                      if (matchHeader) {
                        sectionHeader = matchHeader[1];
                        displayTitle = matchHeader[2];
                      }

                      const renderRows = [];

                      const prevField = block.fields[idx - 1];
                      const prevMatch = prevField?.checkItem.match(/^\[(.*?)\]/);
                      const prevSection = prevMatch ? prevMatch[1] : '';

                      if (sectionHeader && sectionHeader !== prevSection) {
                        renderRows.push(
                          <tr key={`sec_${field.id}`} style={{ background: '#f8fafc', pageBreakInside: 'avoid' }}>
                            <td colSpan={4} style={{ border: '1.5px solid #000000', padding: '6px 8px', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', color: '#1e293b' }}>
                              {sectionHeader}
                            </td>
                          </tr>
                        );
                      }

                      renderRows.push(
                        <tr key={field.id} style={{ pageBreakInside: 'avoid' }}>
                          <td style={{ border: '1.5px solid #000000', padding: '8px 6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ border: '1.5px solid #000000', padding: '8px 6px', fontSize: '0.8rem' }}>{displayTitle}</td>
                          <td style={{ border: '1.5px solid #000000', padding: '8px 6px', textAlign: 'center' }}>
                            {(field.type === 'radio' || field.type === 'checkbox') ? (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {(field.options ?? [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }]).map(opt => (
                                  <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      width: '14px',
                                      height: '14px',
                                      border: '1.5px solid #000000',
                                      background: '#ffffff',
                                      borderRadius: '2px'
                                    }} />
                                    <span>{opt.label}</span>
                                  </span>
                                ))}
                              </div>
                            ) : field.type === 'number' ? (
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>.............. {field.unit || 'oC'}</span>
                            ) : (
                              <div style={{ borderBottom: '1px dashed #94a3b8', width: '80%', height: '14px', margin: '0 auto' }} />
                            )}
                          </td>
                          <td style={{ border: '1.5px solid #000000', padding: '8px 6px', textAlign: 'left', fontSize: '0.75rem', color: '#64748b' }}>
                            {field.type === 'number' && field.minSpec !== undefined ? (
                              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Spec: {field.minSpec} ~ {field.maxSpec} {field.unit}</span>
                            ) : ''}
                          </td>
                        </tr>
                      );

                      return renderRows;
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3.1 MATRIX TABLE BLOCK */}
            {block.type === 'MATRIX_TABLE' && block.matrixConfig && (
              <div style={{ marginTop: '15px' }}>
                <table className="print-table" style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: '50px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>
                        {block.matrixConfig.rowHeader}
                      </th>
                      <th colSpan={block.matrixConfig.columns.length} style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>
                        {block.matrixConfig.columnHeader}
                      </th>
                      {block.matrixConfig.showTotalColumn && (
                        <th rowSpan={2} style={{ width: '130px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>
                          {block.matrixConfig.totalColumnHeader}
                        </th>
                      )}
                      {block.matrixConfig.showNotesColumn && (
                        <th rowSpan={2} style={{ width: '180px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}>
                          {block.matrixConfig.notesColumnHeader}
                        </th>
                      )}
                    </tr>
                    <tr>
                      {block.matrixConfig.columns.map((colName, cIdx) => (
                        <th key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px', background: '#f8fafc', fontWeight: 'bold', fontSize: '0.75rem', textAlign: block.matrixConfig!.columnAlign || 'center' }}>
                          {colName || `Cột ${cIdx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: block.matrixConfig.rowCount }).map((_, rIdx) => (
                      <tr key={rIdx} style={{ pageBreakInside: 'avoid' }}>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                          {rIdx + 1}
                        </td>
                        {block.matrixConfig!.columns.map((_, cIdx) => (
                          <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '6px', height: '24px' }}></td>
                        ))}
                        {block.matrixConfig!.showTotalColumn && (
                          <td style={{ border: '1.5px solid #000000', padding: '6px', height: '24px' }}></td>
                        )}
                        {block.matrixConfig!.showNotesColumn && (
                          <td style={{ border: '1.5px solid #000000', padding: '6px', height: '24px' }}></td>
                        )}
                      </tr>
                    ))}
                    {/* Empty Total Row */}
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold', pageBreakInside: 'avoid' }}>
                      <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem' }}>TỔNG</td>
                      {block.matrixConfig.columns.map((_, cIdx) => (
                        <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '6px', height: '24px' }}></td>
                      ))}
                      {block.matrixConfig.showTotalColumn && (
                        <td style={{ border: '1.5px solid #000000', padding: '6px', height: '24px' }}></td>
                      )}
                      {block.matrixConfig.showNotesColumn && (
                        <td style={{ border: '1.5px solid #000000', padding: '6px', height: '24px' }}></td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. SIGN BLOCK */}
            {block.type === 'SIGN' && (
              <div style={{
                paddingTop: '5px',
                marginTop: '12px',
                marginBottom: '45px',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '40px'
              }}>
                {block.fields.map((f) => (
                  <div key={f.id} style={{
                    flex: 1,
                    height: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center' }}>{f.checkItem}</span>
                    <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#475569', textAlign: 'center' }}>
                      {f.reactionProtocol ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`) : '(Ký và ghi rõ họ tên)'}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        );
      })}
    </div>,
    document.body
  );
}
