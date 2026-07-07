import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import type { Submission } from '../../types';
import { formatFormVersion, getColStyleWidth } from '../../types';

interface PrintRecordProps {
  submission: Submission;
  processTitle: string;
  logoText?: string;
  descriptionText?: string;
  columnLabels?: {
    stt: string;
    item: string;
    target: string;
    reaction: string;
  };
  onClose: () => void;
}

export default function PrintRecord({ submission, processTitle, logoText, descriptionText, columnLabels, onClose }: PrintRecordProps) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');

  useEffect(() => {
    if (!logoText) {
      setLogoUrl('');
      return;
    }
    if (logoText.startsWith('uploads/')) {
      fetch(`/api/storage/download-url?key=${encodeURIComponent(logoText)}`)
        .then(res => res.json())
        .then(data => {
          if (data.downloadUrl) {
            setLogoUrl(data.downloadUrl);
          }
        })
        .catch(err => {
          console.error('Error fetching logo URL for record print:', err);
          setLogoUrl('');
        });
    } else {
      setLogoUrl(logoText);
    }
  }, [logoText]);

  // 1. Fetch presigned download URLs for photo evidence on mount
  useEffect(() => {
    const fetchImages = async () => {
      if (!submission.mediaUrls || submission.mediaUrls.length === 0) return;
      try {
        setLoadingImages(true);
        const resolvedUrls = await Promise.all(
          submission.mediaUrls.map(async (key) => {
            const res = await fetch(`/api/storage/download-url?key=${encodeURIComponent(key)}`);
            if (!res.ok) throw new Error('Failed to resolve image URL');
            const { downloadUrl } = await res.json();
            return downloadUrl;
          })
        );
        setImageUrls(resolvedUrls);
      } catch (err) {
        console.error('Error loading photo evidence:', err);
      } finally {
        setLoadingImages(false);
      }
    };

    fetchImages();
  }, [submission]);

  // 2. Trigger print dialog after images loaded and close when done
  useEffect(() => {
    if (!loadingImages) {
      const handleAfterPrint = () => {
        onClose();
      };
      window.addEventListener('afterprint', handleAfterPrint);

      const timer = setTimeout(() => {
        window.print();
      }, 800);

      return () => {
        window.removeEventListener('afterprint', handleAfterPrint);
        clearTimeout(timer);
      };
    }
  }, [loadingImages, onClose]);

  const [layoutBlocks, setLayoutBlocks] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/processes`)
      .then(res => res.json())
      .then(data => {
        const proc = data.find((p: any) => p.id === submission.processId);
        if (proc && proc.workflowFormsData && proc.workflowFormsData[submission.formId]) {
          setLayoutBlocks(proc.workflowFormsData[submission.formId].layoutBlocks || []);
        }
      })
      .catch(err => console.error('Error fetching process blocks for PrintRecord:', err));
  }, [submission.processId, submission.formId]);

  // 3. Separate flat data into Layout Blocks for structured printing
  const infoFields = submission.formData.filter(
    f => f.id.startsWith('f_info_') || f.locationCode.startsWith('INFO')
  );
  
  const tableBlockIds = layoutBlocks.filter(b => b.type === 'TABLE').map(b => b.id);
  
  const checklistFields = submission.formData.filter(
    f => !f.id.startsWith('f_info_') && 
         !f.locationCode.startsWith('INFO') && 
         !f.id.startsWith('f_sign_') && 
         !f.locationCode.startsWith('SIGN') &&
         f.targetRange !== 'Tally Count' &&
         f.targetRange !== 'Ghi chú' &&
         !tableBlockIds.some(id => f.id.startsWith(id + '_'))
  );

  // Group and reconstruct matrix blocks dynamically
  const matrixBlocksMap: { [blockId: string]: {
    blockId: string;
    rowHeader: string;
    columnHeader: string;
    rowCount: number;
    columns: string[];
    showTotalColumn: boolean;
    totalColumnHeader: string;
    showNotesColumn: boolean;
    notesColumnHeader: string;
    columnAlign?: 'left' | 'center';
    cells: { [rowIdx: number]: { [colIdx: number]: string } };
    notes: { [rowIdx: number]: string };
  }} = {};

  submission.formData.forEach(f => {
    if (f.targetRange === 'Tally Count') {
      const parts = f.id.split('_row_');
      if (parts.length === 2) {
        const blockId = parts[0];
        const rowColPart = parts[1].split('_col_');
        const rowIdx = parseInt(rowColPart[0], 10);
        const colIdx = parseInt(rowColPart[1], 10);

        const itemParts = f.checkItem.split(' - ');
        const rowHeaderPart = itemParts[0].split(' ');
        const rowHeader = rowHeaderPart[0];
        const colName = itemParts[1];

        // Find match in layoutBlocks to get headers, fallback to defaults
        const matchedBlock = layoutBlocks.find(b => b.id === blockId);

        if (!matrixBlocksMap[blockId]) {
          matrixBlocksMap[blockId] = {
            blockId,
            rowHeader: matchedBlock?.matrixConfig?.rowHeader || rowHeader || 'Lớp',
            columnHeader: matchedBlock?.matrixConfig?.columnHeader || 'Tên hàng, quy cách',
            rowCount: matchedBlock?.matrixConfig?.rowCount || 0,
            columns: matchedBlock?.matrixConfig?.columns || [],
            showTotalColumn: matchedBlock?.matrixConfig?.showTotalColumn ?? true,
            totalColumnHeader: matchedBlock?.matrixConfig?.totalColumnHeader || 'Tổng mỗi lớp',
            showNotesColumn: matchedBlock?.matrixConfig?.showNotesColumn ?? false,
            notesColumnHeader: matchedBlock?.matrixConfig?.notesColumnHeader || 'Ghi chú',
            columnAlign: matchedBlock?.matrixConfig?.columnAlign || 'center',
            cells: {},
            notes: {}
          };
        }

        const block = matrixBlocksMap[blockId];
        if (rowIdx + 1 > block.rowCount) {
          block.rowCount = rowIdx + 1;
        }
        if (!block.columns.includes(colName)) {
          block.columns[colIdx] = colName;
        }

        if (!block.cells[rowIdx]) {
          block.cells[rowIdx] = {};
        }
        block.cells[rowIdx][colIdx] = f.value;
      }
    } else if (f.targetRange === 'Ghi chú') {
      const parts = f.id.split('_row_');
      if (parts.length === 2) {
        const blockId = parts[0];
        const rowIdx = parseInt(parts[1].split('_note')[0], 10);

        const itemParts = f.checkItem.split(' - ');
        const rowHeaderPart = itemParts[0].split(' ');
        const rowHeader = rowHeaderPart[0];

        const matchedBlock = layoutBlocks.find(b => b.id === blockId);

        if (!matrixBlocksMap[blockId]) {
          matrixBlocksMap[blockId] = {
            blockId,
            rowHeader: matchedBlock?.matrixConfig?.rowHeader || rowHeader || 'Lớp',
            columnHeader: matchedBlock?.matrixConfig?.columnHeader || 'Tên hàng, quy cách',
            rowCount: matchedBlock?.matrixConfig?.rowCount || 0,
            columns: matchedBlock?.matrixConfig?.columns || [],
            showTotalColumn: matchedBlock?.matrixConfig?.showTotalColumn ?? true,
            totalColumnHeader: matchedBlock?.matrixConfig?.totalColumnHeader || 'Tổng mỗi lớp',
            showNotesColumn: true,
            notesColumnHeader: matchedBlock?.matrixConfig?.notesColumnHeader || 'Ghi chú',
            columnAlign: matchedBlock?.matrixConfig?.columnAlign || 'center',
            cells: {},
            notes: {}
          };
        }

        const block = matrixBlocksMap[blockId];
        block.showNotesColumn = true;
        if (rowIdx + 1 > block.rowCount) {
          block.rowCount = rowIdx + 1;
        }
        block.notes[rowIdx] = f.value;
      }
    }
  });

  // Clean undefined columns
  Object.values(matrixBlocksMap).forEach(block => {
    block.columns = block.columns.filter(c => c !== undefined);
  });

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
      {/* Dynamic CSS override to force portrait printing */}
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
        <span>{submission.formId || 'N/A'}</span>
        <span>{formatFormVersion(submission.formVersion || 'v1.0')}</span>
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
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Print Record View</span>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Checksheet Record ID: {submission.id}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Print Record
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

      {/* TITLE BLOCK */}
      {logoText ? (
        <div className="print-block print-block-avoid" style={{
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
              {processTitle || 'PHIẾU KIỂM TRA'}
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
              {descriptionText || ''}
            </p>
          </div>
        </div>
      ) : (
        <div className="print-block print-block-avoid" style={{
          padding: '10px 0',
          textAlign: 'center',
          marginBottom: '15px'
        }}>
          <h1 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 800, textTransform: 'uppercase' }}>
            {processTitle || 'PHIẾU KIỂM TRA'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
            {descriptionText || ''}
          </p>
        </div>
      )}

      {/* INFO GRID BLOCK */}
      {infoFields.length > 0 && (() => {
        const cols: any[][] = Array.from({ length: 2 }, () => []);
        infoFields.forEach((f, idx) => {
          cols[idx % 2].push(f);
        });

        return (
          <div className="print-block print-block-avoid" style={{
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
                      <span style={{ borderBottom: '1px solid #e2e8f0', flex: 1, paddingBottom: '2px', fontWeight: 700 }}>
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* CHECKLIST TABLE BLOCK */}
      {checklistFields.length > 0 && (
        <div className="print-block" style={{ marginTop: '15px' }}>
          <table className="print-table" style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr>
                <th style={{ width: '40px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>{columnLabels?.stt || 'STT'}</th>
                <th style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}>{columnLabels?.item || 'Chi tiết kiểm tra'}</th>
                <th style={{ width: '90px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>{columnLabels?.target || 'Đạt / Không Đạt'}</th>
                <th style={{ width: '220px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}>{columnLabels?.reaction || 'Mô tả cụ thể nếu Không đạt'}</th>
              </tr>
            </thead>
            <tbody>
              {checklistFields.map((field, idx) => {
                const matchHeader = field.checkItem.match(/^\[(.*?)\]\s*(.*)$/);
                let displayTitle = field.checkItem;
                let sectionHeader = '';
                if (matchHeader) {
                  sectionHeader = matchHeader[1];
                  displayTitle = matchHeader[2];
                }

                const renderRows = [];

                // Render section header dividers
                const prevField = checklistFields[idx - 1];
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

                const isFailed = field.status === 'FAIL';

                renderRows.push(
                  <tr key={field.id} style={{ pageBreakInside: 'avoid', background: isFailed ? '#fef2f2' : 'transparent' }}>
                    <td style={{ border: '1.5px solid #000000', padding: '8px 6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ border: '1.5px solid #000000', padding: '8px 6px', fontSize: '0.8rem' }}>{displayTitle}</td>
                    <td style={{ 
                      border: '1.5px solid #000000', 
                      padding: '8px 6px', 
                      textAlign: 'center'
                    }}>
                      {field.id.startsWith('f_temp_') ? (
                        <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: isFailed ? '#dc2626' : '#16a34a' }}>
                          {parseFloat(field.value) || field.value} {field.targetRange.split(' ').pop()}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {((field as any).options ?? [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }]).map((opt: any) => {
                            const isSelected = field.value === opt.value || (field.value.startsWith(opt.value + ' '));
                            const activeColor = opt.isPass ? '#10b981' : '#ef4444';
                            return (
                              <span key={opt.value} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minWidth: '20px',
                                height: '20px',
                                padding: '0 4px',
                                borderRadius: '10px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                background: isSelected ? activeColor : 'transparent',
                                color: isSelected ? '#ffffff' : '#cbd5e1',
                                border: isSelected ? `1px solid ${activeColor}` : '1px solid #cbd5e1'
                              }}>{opt.label}</span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ border: '1.5px solid #000000', padding: '8px 6px', fontSize: '0.75rem', color: isFailed ? '#b45309' : '#475569' }}>
                      {isFailed ? (
                        <div>
                          <strong>Lỗi:</strong> {field.reactionProtocol}
                        </div>
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                );

                return renderRows;
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MATRIX TABLE RECORD BLOCK */}
      {Object.values(matrixBlocksMap).map((block: any) => {
        // Pre-calculate row totals and column totals for printing
        const rowTotals = Array.from({ length: block.rowCount }).map((_: any, rIdx: number) => {
          return block.columns.reduce((sum: number, _: any, cIdx: number) => {
            const val = parseInt(block.cells[rIdx]?.[cIdx] || '0', 10);
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
        });

        const colTotals = block.columns.map((_: any, cIdx: number) => {
          return Array.from({ length: block.rowCount }).reduce((sum: number, _: any, rIdx: number) => {
            const val = parseInt(block.cells[rIdx]?.[cIdx] || '0', 10);
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
        });

        const grandTotal = rowTotals.reduce((sum: number, val) => sum + val, 0);

        return (
          <div key={block.blockId} className="print-block" style={{ marginTop: '15px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', color: '#1e293b' }}>
              {(layoutBlocks.find(b => b.id === block.blockId)?.title) || 'BẢNG KIỂM ĐẾM SỐ LƯỢNG'}
            </div>
            <table className="print-table" style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '50px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>
                    {block.rowHeader}
                  </th>
                  <th colSpan={block.columns.length} style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>
                    {block.columnHeader}
                  </th>
                  {block.showTotalColumn && (
                    <th rowSpan={2} style={{ width: '130px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'center' }}>
                      {block.totalColumnHeader}
                    </th>
                  )}
                  {block.showNotesColumn && (
                    <th rowSpan={2} style={{ width: '180px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: 'left' }}>
                      {block.notesColumnHeader}
                    </th>
                  )}
                </tr>
                <tr>
                  {block.columns.map((colName: string, cIdx: number) => (
                    <th key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px', background: '#f8fafc', fontWeight: 'bold', fontSize: '0.75rem', textAlign: block.columnAlign || 'center' }}>
                      {colName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: block.rowCount }).map((_: any, rIdx: number) => (
                  <tr key={rIdx} style={{ pageBreakInside: 'avoid' }}>
                    <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', background: '#f8fafc' }}>
                      {rIdx + 1}
                    </td>
                    {block.columns.map((_: any, cIdx: number) => (
                      <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem' }}>
                        {block.cells[rIdx]?.[cIdx] || '0'}
                      </td>
                    ))}
                    {block.showTotalColumn && (
                      <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 'bold', background: '#f8fafc' }}>
                        {rowTotals[rIdx]}
                      </td>
                    )}
                    {block.showNotesColumn && (
                      <td style={{ border: '1.5px solid #000000', padding: '6px', fontSize: '0.8rem' }}>
                        {block.notes[rIdx] || ''}
                      </td>
                    )}
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr style={{ background: '#f1f5f9', fontWeight: 'bold', pageBreakInside: 'avoid' }}>
                  <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem' }}>TỔNG</td>
                  {colTotals.map((total: number, cIdx: number) => (
                    <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem' }}>
                      {total}
                    </td>
                  ))}
                  {block.showTotalColumn && (
                    <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem', background: '#e2e8f0' }}>
                      {grandTotal}
                    </td>
                  )}
                  {block.showNotesColumn && (
                    <td style={{ border: '1.5px solid #000000', padding: '6px' }}></td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* REGULAR TABLE RECORD BLOCK */}
      {layoutBlocks.filter(b => b.type === 'TABLE').map((block: any) => {
        return (
          <div key={block.id} className="print-block" style={{ marginTop: '15px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', color: '#1e293b' }}>
              {block.title || 'BẢNG THÔNG TIN'}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="print-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr>
                    {(block.tableColumns || []).map((col: any) => {
                      const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                      const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? 'center' : 'left'));
                      return (
                        <th key={col.id} style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'bold', fontSize: '0.8rem', textAlign: cellAlign, width: colWidth }}>
                          {col.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(block.tableRows || []).length === 0 ? (
                    <tr>
                      <td colSpan={(block.tableColumns || []).length} style={{ border: '1.5px solid #000000', padding: '8px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        Không có dữ liệu.
                      </td>
                    </tr>
                  ) : (
                    (block.tableRows || []).map((row: any) => (
                      <tr key={row.id} style={{ pageBreakInside: 'avoid' }}>
                        {(block.tableColumns || []).map((col: any) => {
                          const cellKey = `${block.id}_${row.id}_${col.id}`;
                          const cellValue = submission.formData.find(f => f.id === cellKey)?.value || '';
                          const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? 'center' : 'left'));
                          return (
                            <td key={col.id} style={{ border: '1.5px solid #000000', padding: '6px 8px', fontSize: '0.8rem', verticalAlign: 'middle', textAlign: cellAlign }}>
                              {col.type === 'static_text' ? (
                                <span style={{ fontWeight: 500, display: 'block', textAlign: cellAlign }}>{block.tableData?.[row.id]?.[col.id] || ''}</span>
                              ) : col.type === 'checkbox' ? (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <input type="checkbox" checked={cellValue === 'true'} readOnly style={{ transform: 'scale(1.1)' }} />
                                </div>
                              ) : col.type === 'radio' ? (
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                  <input type="radio" checked={cellValue === 'true'} readOnly style={{ transform: 'scale(1.1)' }} />
                                </div>
                              ) : (
                                <span style={{ display: 'block', textAlign: cellAlign }}>{cellValue}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* SECTION LABEL RECORD BLOCK */}
      {layoutBlocks.filter(b => b.type === 'SECTION_LABEL').map((block: any) => {
        return (
          <div key={block.id} className="print-block print-block-avoid" style={{ marginTop: '15px' }}>
            <div style={{
              padding: '8px 12px',
              background: '#f1f5f9',
              borderLeft: '4px solid #000000',
              borderRadius: '4px',
              marginBottom: '5px'
            }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                {block.title}
              </h3>
              {block.description && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', whiteSpace: 'pre-line' }}>
                  {block.description}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* PHOTO EVIDENCE LOG */}
      {imageUrls.length > 0 && (
        <div className="print-block" style={{ marginTop: '20px', pageBreakInside: 'avoid' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#475569' }}>
            Hình ảnh bằng chứng đính kèm (Photo Evidence Log)
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            border: '1px solid #000000',
            padding: '15px'
          }}>
            {imageUrls.map((url, index) => (
              <div key={index} style={{ textAlign: 'center' }}>
                <img 
                  src={url} 
                  alt={`Bằng chứng ${index + 1}`} 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '160px',
                    border: '1px solid #cbd5e1',
                    objectFit: 'contain'
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                  Hình {index + 1}: Ảnh ghi nhận lỗi thực tế
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SIGN BLOCK & AUDIT SIGN-OFF */}
      <div className="print-block print-block-avoid" style={{
        paddingTop: '5px',
        marginTop: '12px',
        marginBottom: '45px',
        display: 'flex',
        justifyContent: 'space-between',
        gap: '40px'
      }}>
        {/* Operator signature */}
        <div style={{
          flex: 1,
          height: '100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>Người kiểm tra (Operator)</span>
          <div style={{ fontSize: '0.8rem' }}>
            Họ tên: <strong>{submission.operatorId}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569' }}>
            <span>Ký tên: [Đã xác thực điện tử]</span>
            <span>Ngày: {new Date(submission.submittedAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Supervisor signature */}
        <div style={{
          flex: 1,
          height: '100px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: submission.supervisorSignoff ? 'transparent' : '#f8fafc'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>Người thẩm tra (Supervisor)</span>
          {submission.supervisorSignoff ? (
            <>
              <div style={{ fontSize: '0.8rem' }}>
                Họ tên: <strong>{submission.supervisorSignoff.signedBy}</strong>
                {submission.supervisorSignoff.notes && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', marginLeft: '4px' }}>
                    ({submission.supervisorSignoff.notes})
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569' }}>
                <span>Ký tên: [Phê duyệt hệ thống]</span>
                <span>Ngày: {new Date(submission.supervisorSignoff.signedAt).toLocaleDateString()}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
              Chờ thẩm tra & phê duyệt chất lượng
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
