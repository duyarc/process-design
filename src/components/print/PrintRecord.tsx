import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import ReactDOM from 'react-dom';
import type { Submission, LayoutBlockISO, TableColumnConfig } from '../../types';
import { formatFormVersion, getColStyleWidth } from '../../types';
import { sanitizeLabel, getEffectiveTitleFormat, to5SFileName, canTableOptionsFitInline, getCheckboxGridTemplate, isSeamlessTableBlock, getInfoGridTemplateColumns } from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';

// Helper: derive CHECKLIST_TABLE columns — falls back to columnLabels for backward compat
function getChecklistColumns(block: LayoutBlockISO | undefined, fallbackLabels?: { stt?: string; item?: string; target?: string; reaction?: string }): TableColumnConfig[] {
  let cols: TableColumnConfig[];
  if (block?.tableColumns && block.tableColumns.length > 0) {
    cols = block.tableColumns;
  } else if (block?.columnLabels) {
    cols = [
      { id: 'col_stt',      label: block.columnLabels.stt      || fallbackLabels?.stt      || 'STT',                          width: '40px',  type: 'static_text', locked: true },
      { id: 'col_item',     label: block.columnLabels.item     || fallbackLabels?.item     || 'Chi tiết kiểm tra',            width: 'auto',  type: 'static_text', locked: true },
      { id: 'col_target',   label: block.columnLabels.target   || fallbackLabels?.target   || 'Đạt / Không Đạt',             width: '90px',  type: 'radio',        align: 'center',
        options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
      { id: 'col_reaction', label: block.columnLabels.reaction || fallbackLabels?.reaction || 'Mô tả cụ thể nếu Không đạt', width: '220px', type: 'text' }
    ];
  } else {
    cols = [
      { id: 'col_stt',      label: fallbackLabels?.stt || 'STT',                          width: '5%',   type: 'static_text', locked: true },
      { id: 'col_item',     label: fallbackLabels?.item || 'Tiêu chí',                     width: '35%',  type: 'static_text', locked: true },
      { id: 'col_unit',     label: 'Đơn vị',                       width: '10%',  type: 'static_text', locked: true },
      { id: 'col_spec',     label: 'Tiêu chuẩn',                   width: '20%',  type: 'static_text', locked: true },
      { id: 'col_target',   label: fallbackLabels?.target || 'Kết quả',                      width: '15%',  type: 'radio',        align: 'center', locked: true,
        options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
      { id: 'col_reaction', label: fallbackLabels?.reaction || 'Ghi chú',                      width: '15%',  type: 'text' }
    ];
  }

  if (block?.hideSTT) {
    cols = cols.map(c => c.id === 'col_stt' ? { ...c, hidden: true } : c);
  }

  return cols.filter(c => !c.hidden);
}

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
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!logoText) {
      setLogoUrl('');
      setImgLoaded(true); // No logo to wait for — proceed to print
      return;
    }
    if (logoText.startsWith('uploads/')) {
      // Use download-inline: server fetches from R2 and returns base64 data URL
      // This avoids cross-origin image loading in the print context
      fetch(`/api/storage/download-inline?key=${encodeURIComponent(logoText)}`)
        .then(res => res.json())
        .then(data => {
          if (data.dataUrl) {
            setLogoUrl(data.dataUrl);
            // imgLoaded will be set by <img> onLoad/onError after browser fully decodes the image
          } else {
            setImgLoaded(true); // No image returned — proceed without logo
          }
        })
        .catch(err => {
          console.error('Error fetching inline logo for record print:', err);
          setImgLoaded(true); // Fetch failed — proceed without logo
        });
    } else {
      setLogoUrl(logoText);
      // imgLoaded will be set by the <img> onLoad/onError handlers
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

  // 2. Trigger print dialog only after logo image bytes are fully loaded in DOM
  useEffect(() => {
    if (loadingImages || !imgLoaded) return;

    const handleAfterPrint = () => {
      onClose();
    };
    window.addEventListener('afterprint', handleAfterPrint);

    const timer = setTimeout(() => {
      window.print();
    }, 200);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timer);
    };
  }, [loadingImages, imgLoaded, onClose]);

  const [layoutBlocks, setLayoutBlocks] = useState<any[]>([]);
  const [formTitle, setFormTitle] = useState<string>('');
  const [pageSize, setPageSize] = useState<'A4' | 'A5_LANDSCAPE'>('A4');

  useEffect(() => {
    fetch(`/api/processes`)
      .then(res => res.json())
      .then(data => {
        const proc = data.find((p: any) => p.id === submission.processId);
        if (proc && proc.workflowFormsData && proc.workflowFormsData[submission.formId]) {
          const fData = proc.workflowFormsData[submission.formId];
          setLayoutBlocks(fData.layoutBlocks || []);
          setFormTitle(fData.formTitle || '');
          if (fData.pageSize || fData.page_size) {
            setPageSize(fData.pageSize || fData.page_size);
          }
        }
      })
      .catch(err => console.error('Error fetching process blocks for PrintRecord:', err));

    fetch(`/api/forms/${encodeURIComponent(submission.formId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(formData => {
        if (formData && (formData.page_size || formData.pageSize)) {
          setPageSize(formData.page_size || formData.pageSize);
        }
      })
      .catch(() => {});
  }, [submission.processId, submission.formId]);

  // Set document.title according to Digital 5S standard
  useEffect(() => {
    const originalTitle = document.title;
    const titleBlock = layoutBlocks.find(b => b.type === 'TITLE');
    const activeFormTitle = formTitle || titleBlock?.title || processTitle || 'Record';

    let datePart = '';
    if (submission.submittedAt) {
      const parts = submission.submittedAt.split('T')[0].split('-');
      if (parts.length === 3) datePart = parts.join(''); // YYYYMMDD
    }

    const normalizedTitle = to5SFileName(activeFormTitle);
    document.title = `REC_${datePart}_${normalizedTitle}`;

    return () => {
      document.title = originalTitle;
    };
  }, [formTitle, layoutBlocks, processTitle, submission.submittedAt]);

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
    <div className="print-container print-doc" style={{
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
      {/* Dynamic CSS override to force portrait printing */}
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
            size: ${pageSize === 'A5_LANDSCAPE' ? 'A5 landscape' : 'A4 portrait'};
            margin: ${pageSize === 'A5_LANDSCAPE' ? '8mm 10mm 10mm 10mm' : '12mm 15mm 15mm 15mm'};
          }
          ${pageSize === 'A5_LANDSCAPE' ? `
            .print-doc {
              gap: 0.4rem !important;
            }
            .print-block-avoid {
              margin-bottom: 0.35rem !important;
            }
          ` : ''}
          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          /* Khoảng cách giữa các block do .print-doc trong print.css quản. */
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
          .subtable-print-container {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-table tfoot td {
            background: transparent !important;
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
            font-size: 0.75rem;
            font-family: inherit;
            color: #475569;
          }
          .print-footer-spacer {
            height: 20px;
            display: block;
          }
        }
      `}</style>

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

      {/* Outer Table Wrapper for Native Print Header/Footer Support */}
      <table className="print-outer-table">
        <tbody>
          <tr>
            <td>
              {/* TITLE BLOCK */}
      {(() => {
        const titleBlock = layoutBlocks.find(b => b.type === 'TITLE');
        const titleDateSnapshot = submission.formData.find(s => s.id === '__title_date__');
        const showDate = titleBlock?.showDate || !!titleDateSnapshot;
        const datePos = titleBlock?.datePosition ?? 'B';
        const rawDate = titleDateSnapshot?.value;
        let formattedDate = '';
        if (rawDate) {
          const parts = rawDate.split('-');
          if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          else formattedDate = rawDate;
        } else if (submission.submittedAt) {
          formattedDate = new Date(submission.submittedAt).toLocaleDateString('vi-VN');
        }

        return logoText ? (
          <div className="print-block print-block-avoid" style={{
            padding: '10px 0',
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}>
            {logoUrl && (
              <div style={{
                marginRight: '20px',
                display: 'flex',
                alignItems: 'center',
                height: '65px'
              }}>
                <img
                  src={logoUrl}
                  alt="Logo"
                  style={{ maxHeight: '65px', maxWidth: '260px', objectFit: 'contain' }}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgLoaded(true)}
                />
              </div>
            )}
            <div style={{ textAlign: 'center', flex: 1 }}>
              <h1 style={{ margin: '0 0 2px 0', fontSize: '1.35rem', fontWeight: 'var(--pw-weight-banner)', textTransform: 'uppercase' }}>
                {processTitle || 'PHIẾU KIỂM TRA'}
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
                {descriptionText || ''}
              </p>
              {showDate && datePos === 'B' && (
                <div style={{ marginTop: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                  <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ borderBottom: '1px solid #000000', display: 'inline-block', width: '90px', marginLeft: '6px' }}>{formattedDate}</span>
                </div>
              )}
            </div>
            {showDate && datePos === 'A' && (
              <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ borderBottom: '1px solid #000000', display: 'inline-block', width: '80px', marginLeft: '6px' }}>{formattedDate}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="print-block print-block-avoid" style={{
            padding: '10px 0',
            textAlign: 'center',
            position: 'relative'
          }}>
            {showDate && datePos === 'A' && (
              <div style={{ position: 'absolute', right: 0, top: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ borderBottom: '1px solid #000000', display: 'inline-block', width: '80px', marginLeft: '6px' }}>{formattedDate}</span>
              </div>
            )}
            <h1 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 'var(--pw-weight-banner)', textTransform: 'uppercase' }}>
              {processTitle || 'PHIẾU KIỂM TRA'}
            </h1>
            <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
              {descriptionText || ''}
            </p>
            {showDate && datePos === 'B' && (
              <div style={{ marginTop: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>Ngày</span> <span style={{ borderBottom: '1px solid #000000', display: 'inline-block', width: '90px', marginLeft: '6px' }}>{formattedDate}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* INFO GRID BLOCK */}
      {infoFields.length > 0 && (() => {
        const infoBlock = layoutBlocks.find(b => b.type === 'INFO_GRID');

        return (
          <div className="print-block" style={{ padding: '0' }}>
            <div className="print-info-grid" style={{ gridTemplateColumns: getInfoGridTemplateColumns(infoBlock) }}>
              {infoFields.map((f) => {
                    const matchedBlock = layoutBlocks.find(b => b.fields?.some((field: any) => field.id === f.id));
                    const matchedField = matchedBlock?.fields?.find((field: any) => field.id === f.id);
                    if (matchedField?.type === 'subtable') {
                      let rows: Record<string, string>[] = [];
                      try { rows = JSON.parse(f.value || '[]'); } catch {}
                      const cols = matchedField.subtableColumns ?? [];
                      return (
                        <div key={f.id} className="subtable-print-container print-field-full" style={{ fontSize: '0.82rem', width: '100%', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          {f.checkItem && <div style={{ fontWeight: 'var(--pw-weight-regular)', marginBottom: '6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{f.checkItem}:</div>}
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                {cols.map((col: any) => {
                                  const headerAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'));
                                  return (
                                    <th key={col.id} style={{ border: '1px solid #000000', padding: '4px 6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-medium)', textAlign: headerAlign as any, fontSize: '0.78rem', width: col.width }}>
                                      {col.label}
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length === 0 ? (
                                <tr>
                                  <td colSpan={cols.length || 1} style={{ border: '1px solid #000000', padding: '5px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Chưa có dữ liệu</td>
                                </tr>
                              ) : rows.map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                  {cols.map((col: any) => {
                                    if (col.type === 'static_text') {
                                      const sttAlign = col.align || 'left';
                                      return (
                                         <td key={col.id} style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: sttAlign as any, fontWeight: 'var(--pw-weight-regular)', fontSize: '0.82rem' }}>
                                           {matchedField.subtableStaticData?.[rowIdx]?.[col.id] || ''}
                                         </td>
                                      );
                                    }
                                    const cellAlign = col.type === 'number' ? 'right' : col.type === 'date' || col.type === 'time' ? 'center' : 'left';
                                    return (
                                      <td key={col.id} style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: cellAlign as any, fontSize: '0.82rem' }}>
                                        {row[col.id] || ''}
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

                    const parsedRSpan = matchedField?.rowSpan ? Number(matchedField.rowSpan) : undefined;
                    const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
                    const cSpan = matchedField?.colSpan ? Number(matchedField.colSpan) : undefined;
                    const gridItemStyle: React.CSSProperties = {
                      gridRow: rSpan ? `span ${rSpan}` : undefined,
                      gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                      alignSelf: matchedField?.type === 'photo' ? 'stretch' : 'start',
                    };

                    if (matchedField?.type === 'label') {
                      return (
                        <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', pageBreakInside: 'avoid', lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a' }}>{renderFormattedText(f.checkItem)}</span>
                        </div>
                      );
                    }

                    if (matchedField?.type === 'photo') {
                      const photoUrl = f.value || '';
                      return (
                        <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', width: '100%', pageBreakInside: 'avoid' }}>
                          {f.checkItem && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', fontSize: '0.82rem', marginBottom: '4px' }}>{renderFormattedText(f.checkItem)}:</span>}
                          <div style={{ flex: 1, width: '100%', border: '1px solid #000000', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px', padding: '4px', boxSizing: 'border-box', background: '#f8fafc' }}>
                            {photoUrl ? (
                              <img src={photoUrl} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>(Không có ảnh đính kèm)</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (matchedField?.type === 'likert_scale' || matchedField?.type === 'rating') {
                      const isStars = matchedField?.likertVariant === 'stars' || matchedField?.type === 'rating';
                      if (isStars) {
                        const scale = matchedField?.ratingScale === 3 ? 3 : 5;
                        const currentRating = parseInt(f.value || '', 10) || 0;
                        return (
                          <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', pageBreakInside: 'avoid' }}>
                            {f.checkItem && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', fontSize: '0.82rem' }}>{renderFormattedText(f.checkItem)}:</span>}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '22px' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                {Array.from({ length: scale }).map((_, idx) => (
                                  <Star
                                    key={idx}
                                    size={14}
                                    style={{
                                      color: '#000000',
                                      fill: idx < currentRating ? '#000000' : 'none',
                                      strokeWidth: 1.4
                                    }}
                                  />
                                ))}
                              </div>
                              {currentRating > 0 && (
                                <span style={{ fontSize: '0.8rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', marginLeft: '4px' }}>
                                  ({currentRating}/{scale})
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }

                      const scales = matchedField?.scaleOptions && matchedField.scaleOptions.length > 0 ? matchedField.scaleOptions : ['1', '2', '3', '4', '5'];
                      return (
                        <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', pageBreakInside: 'avoid' }}>
                          {f.checkItem && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', fontSize: '0.82rem' }}>{renderFormattedText(f.checkItem)}:</span>}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minHeight: '22px', paddingTop: '2px' }}>
                            {scales.map((opt: string, idx: number) => {
                              const isSelected = f.value === opt;
                              return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1, textAlign: 'center' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#0f172a', fontWeight: isSelected ? 'var(--pw-weight-heavy)' : 500, lineHeight: 1.1 }}>{opt}</span>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      border: '1.2px solid #000000',
                                      background: isSelected ? '#000000' : '#ffffff'
                                    }}
                                  >
                                    {isSelected && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff' }} />}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', minHeight: 'var(--pw-line-h)', gap: '8px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 'var(--pw-weight-regular)', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{f.checkItem ? <>{renderFormattedText(f.checkItem)}:</> : ''}</span>
                        <span style={{ borderBottom: '1px solid #94a3b8', flex: 1, paddingBottom: '2px', fontWeight: 'var(--pw-weight-regular)' }}>
                          {f.value}
                        </span>
                      </div>
                    );
                  })}
            </div>
          </div>
        );
      })()}

      {/* CHECKLIST TABLE BLOCK */}
      {checklistFields.length > 0 && (() => {
        const matchedBlock = layoutBlocks.find(b => b.type === 'CHECKLIST_TABLE');
        const titleText = matchedBlock?.title || 'BẢNG KIỂM TRA CHẤT LƯỢNG';
        const titleFmt = matchedBlock ? getEffectiveTitleFormat(matchedBlock) : 'NONE';
        return (
          <div className="print-block">
            {titleFmt !== 'NONE' && (
              titleFmt === 'H1' ? (
                <h2 style={{ display: 'inline-block', margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase', color: '#000000', borderBottom: '2.5px solid #0d9488', paddingBottom: '3px' }}>
                  {titleText}
                </h2>
              ) : titleFmt === 'H2' ? (
                <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #0d9488', borderRadius: '0px', marginBottom: '8px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#000000' }}>
                  {titleText}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '8px', color: '#000000' }}>
                  {titleText}
                </div>
              )
            )}
            <table className="print-table" style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
            <thead>
              <tr>
                {getChecklistColumns(matchedBlock, columnLabels).map((col) => (
                  <th
                    key={col.id}
                    style={{
                      width: col.width,
                      border: '1px solid #000000',
                      padding: '6px',
                      background: '#f1f5f9',
                      fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000',
                      textAlign: (col.align || (col.id === 'col_stt' ? 'center' : 'left')) as any
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checklistFields.map((field, idx) => {
                const matchHeader = field.checkItem.match(/^\[(.*?)\]\s*(.*)$/);
                let displayTitle = sanitizeLabel(field.checkItem);
                let sectionHeader = '';
                if (matchHeader) {
                  sectionHeader = matchHeader[1];
                  displayTitle = sanitizeLabel(matchHeader[2]);
                }

                const renderRows = [];

                // Render section header dividers
                const prevField = checklistFields[idx - 1];
                const prevMatch = prevField?.checkItem.match(/^\[(.*?)\]/);
                const prevSection = prevMatch ? prevMatch[1] : '';

                if (sectionHeader && sectionHeader !== prevSection) {
                  renderRows.push(
                    <tr key={`sec_${field.id}`} style={{ background: '#f8fafc', pageBreakInside: 'avoid' }}>
                      <td colSpan={getChecklistColumns(matchedBlock, columnLabels).length} style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.8rem', textTransform: 'uppercase', color: '#1e293b' }}>
                        {sectionHeader}
                      </td>
                    </tr>
                  );
                }

                const isFailed = field.status === 'FAIL';
                const designField = matchedBlock?.fields.find((df: any) => df.id === field.id);
                const fieldUnit = designField?.unit || '';
                const fieldType = designField?.type || (field.id.startsWith('f_temp_') ? 'number' : 'radio');
                const fieldMinSpec = designField?.minSpec;
                const fieldMaxSpec = designField?.maxSpec;
                const fieldOptions = designField?.options || [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }];

                renderRows.push(
                  <tr key={field.id} style={{ pageBreakInside: 'avoid', background: isFailed ? '#fef2f2' : 'transparent' }}>
                    {getChecklistColumns(matchedBlock, columnLabels).map((col) => {
                      const commonStyle: React.CSSProperties = {
                        border: '1px solid #000000',
                        padding: '6px 8px',
                        fontSize: '0.8rem',
                        verticalAlign: 'middle',
                        textAlign: col.align as any || 'left'
                      };

                      if (col.id === 'col_stt') {
                        return <td key={col.id} style={{ ...commonStyle, textAlign: 'center', fontWeight: 'var(--pw-weight-regular)' }}>{idx + 1}</td>;
                      }
                      if (col.id === 'col_item') {
                        return (
                          <td key={col.id} style={commonStyle}>
                            <span style={{ fontWeight: 'var(--pw-weight-regular)', display: 'block' }}>{displayTitle}</span>
                          </td>
                        );
                      }
                      if (col.id === 'col_unit') {
                        return <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>{fieldUnit}</td>;
                      }
                      if (col.id === 'col_spec') {
                        let specText = '';
                        if (fieldType === 'number') {
                          if (fieldMinSpec !== undefined && fieldMaxSpec !== undefined) {
                            specText = `${fieldMinSpec} ~ ${fieldMaxSpec}`;
                          } else if (fieldMinSpec !== undefined) {
                            specText = `>= ${fieldMinSpec}`;
                          } else if (fieldMaxSpec !== undefined) {
                            specText = `<= ${fieldMaxSpec}`;
                          }
                        } else {
                          specText = designField?.targetRange || field.targetRange || '';
                        }
                        return <td key={col.id} style={commonStyle}>{specText}</td>;
                      }
                      if (col.id === 'col_target') {
                        return (
                          <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>
                            {field.id.startsWith('f_temp_') ? (
                              <span style={{ fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.85rem', color: isFailed ? '#dc2626' : '#16a34a' }}>
                                {parseFloat(field.value) || field.value} {fieldUnit}
                              </span>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                {fieldOptions.map((opt: any) => {
                                  const selectedValues = field.value ? field.value.split(',').filter(Boolean) : [];
                                  const isSelected = selectedValues.includes(opt.value) || field.value === opt.value || (field.value.startsWith(opt.value + ' '));
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
                                      fontWeight: 'var(--pw-weight-heavy)',
                                      background: isSelected ? activeColor : 'transparent',
                                      color: isSelected ? '#ffffff' : '#cbd5e1',
                                      border: isSelected ? `1px solid ${activeColor}` : '1px solid #cbd5e1'
                                    }}>{opt.label}</span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      }
                      if (col.id === 'col_reaction') {
                        return (
                          <td key={col.id} style={{ ...commonStyle, fontSize: '0.75rem', color: isFailed ? '#b45309' : '#475569' }}>
                            {isFailed ? (
                              <div>
                                <span style={{ fontWeight: 'var(--pw-weight-heavy)' }}>Lỗi:</span> {field.reactionProtocol}
                              </div>
                            ) : (
                              field.value && !field.id.startsWith('f_temp_') && !fieldOptions.some((o: any) => field.value === o.value) ? field.value : ''
                            )}
                          </td>
                        );
                      }
                      return <td key={col.id} style={commonStyle} />;
                    })}
                  </tr>
                );

                return renderRows;
              })}
            </tbody>
          </table>
        </div>
        );
      })()}

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
          <div key={block.blockId} className="print-block">
            {(() => {
              const matchedBlock = layoutBlocks.find(b => b.id === block.blockId);
              const titleText = matchedBlock?.title || 'BẢNG KIỂM ĐẾM SỐ LƯỢNG';
              const titleFmt = matchedBlock ? getEffectiveTitleFormat(matchedBlock) : 'BODY';
              return titleFmt !== 'NONE' && (
                titleFmt === 'H1' ? (
                  <h2 style={{ display: 'inline-block', margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase', color: '#000000', borderBottom: '2.5px solid #0d9488', paddingBottom: '3px' }}>
                    {titleText}
                  </h2>
                ) : titleFmt === 'H2' ? (
                  <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #0d9488', borderRadius: '0px', marginBottom: '8px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#000000' }}>
                    {titleText}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '8px', color: '#000000' }}>
                    {titleText}
                  </div>
                )
              );
            })()}
            <table className="print-table" style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '50px', border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'center' }}>
                    {block.rowHeader}
                  </th>
                  <th colSpan={block.columns.length} style={{ border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'center' }}>
                    {block.columnHeader}
                  </th>
                  {block.showTotalColumn && (
                    <th rowSpan={2} style={{ width: '130px', border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'center' }}>
                      {block.totalColumnHeader}
                    </th>
                  )}
                  {block.showNotesColumn && (
                    <th rowSpan={2} style={{ width: '180px', border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'left' }}>
                      {block.notesColumnHeader}
                    </th>
                  )}
                </tr>
                <tr>
                  {block.columns.map((colName: string, cIdx: number) => (
                    <th key={cIdx} style={{ border: '1px solid #000000', padding: '4px', background: '#f8fafc', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.75rem', textAlign: block.columnAlign || 'center' }}>
                      {colName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: block.rowCount }).map((_: any, rIdx: number) => (
                  <tr key={rIdx} style={{ pageBreakInside: 'avoid' }}>
                    <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'var(--pw-weight-regular)', background: '#f8fafc' }}>
                      {rIdx + 1}
                    </td>
                    {block.columns.map((_: any, cIdx: number) => (
                      <td key={cIdx} style={{ border: '1px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem' }}>
                        {block.cells[rIdx]?.[cIdx] || '0'}
                      </td>
                    ))}
                    {block.showTotalColumn && (
                      <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 'var(--pw-weight-heavy)', background: '#f8fafc' }}>
                        {rowTotals[rIdx]}
                      </td>
                    )}
                    {block.showNotesColumn && (
                      <td style={{ border: '1px solid #000000', padding: '6px', fontSize: '0.8rem' }}>
                        {block.notes[rIdx] || ''}
                      </td>
                    )}
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr style={{ background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', pageBreakInside: 'avoid' }}>
                  <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem' }}>TỔNG</td>
                  {colTotals.map((total: number, cIdx: number) => (
                    <td key={cIdx} style={{ border: '1px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem' }}>
                      {total}
                    </td>
                  ))}
                  {block.showTotalColumn && (
                    <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'right', fontSize: '0.8rem', background: '#e2e8f0' }}>
                      {grandTotal}
                    </td>
                  )}
                  {block.showNotesColumn && (
                    <td style={{ border: '1px solid #000000', padding: '6px' }}></td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* REGULAR TABLE RECORD BLOCK */}
      {layoutBlocks.filter(b => b.type === 'TABLE').map((block: any) => {
        const fullIndex = layoutBlocks.findIndex(b => b.id === block.id);
        const prevBlock = fullIndex > 0 ? layoutBlocks[fullIndex - 1] : undefined;
        const isSeamless = isSeamlessTableBlock(block, prevBlock);
        const titleFmt = getEffectiveTitleFormat(block);
        return (
          <div key={block.id} className={`print-block${isSeamless ? ' print-block--seamless-table' : ''}`}>
            {titleFmt !== 'NONE' && (
              titleFmt === 'H1' ? (
                <h2 style={{ display: 'inline-block', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase', color: '#000000', borderBottom: '2.5px solid #0d9488', paddingBottom: '3px' }}>
                  {block.title || 'BẢNG THÔNG TIN'}
                </h2>
              ) : titleFmt === 'H2' ? (
                <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #0d9488', borderRadius: '0px', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#000000' }}>
                  {block.title || 'BẢNG THÔNG TIN'}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>
                  {block.title || 'BẢNG THÔNG TIN'}
                </div>
              )
            )}
            {(() => {
              const bStyle = block.borderStyle || 'grid';
              const tableBorder = bStyle === 'borderless' ? 'none' : bStyle === 'horizontal_only' ? 'none' : '1px solid #000000';
              const tableBorderTop = isSeamless ? 'none' : (bStyle === 'horizontal_only' ? '1px solid #000000' : undefined);
              const cellBorder = bStyle === 'borderless' ? 'none' : bStyle === 'horizontal_only' ? 'none' : '1px solid #000000';
              const cellBorderBottom = bStyle === 'horizontal_only' ? '1px solid #000000' : (bStyle === 'borderless' ? 'none' : '1px solid #000000');

              return (
              <div style={{ overflowX: 'auto' }}>
                <table
                  className={`print-table ${bStyle === 'borderless' ? 'print-table--borderless' : bStyle === 'horizontal_only' ? 'print-table--horizontal' : ''}`}
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed',
                    border: tableBorder,
                    borderTop: tableBorderTop
                  }}
                >
                <colgroup>
                  {(block.tableColumns || []).map((col: any) => {
                    const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                    return <col key={col.id} style={{ width: colWidth }} />;
                  })}
                </colgroup>
                {!block.hideHeader && (
                  <thead>
                    <tr style={{ background: bStyle === 'borderless' ? 'transparent' : '#f1f5f9' }}>
                      {(block.tableColumns || []).map((col: any) => {
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
                              fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000',
                              textAlign: cellAlign,
                              width: colWidth
                            }}
                          >
                            {col.type === 'likert_scale' ? (
                              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(col.scaleOptions || []).length || 3}, 1fr)`, gap: '4px', textAlign: 'center', width: '100%' }}>
                                {(col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer']).map((opt: string, sIdx: number) => (
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
                {(() => {
                  const rawRows = block.tableRows || [];
                  const tableCols = block.tableColumns || [];
                  if (rawRows.length === 0) {
                    return (
                      <tbody className="print-table-group" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <tr>
                          <td colSpan={tableCols.length} style={{ border: cellBorder, padding: '8px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>
                            Không có dữ liệu.
                          </td>
                        </tr>
                      </tbody>
                    );
                  }

                  const groups: { groupHeaderRow?: any; rows: any[] }[] = [];
                  let curGroup: { groupHeaderRow?: any; rows: any[] } = { rows: [] };

                  rawRows.forEach((row: any) => {
                    if (row.isGroupHeader) {
                      if (curGroup.groupHeaderRow || curGroup.rows.length > 0) {
                        groups.push(curGroup);
                      }
                      curGroup = { groupHeaderRow: row, rows: [] };
                    } else {
                      curGroup.rows.push(row);
                    }
                  });
                  if (curGroup.groupHeaderRow || curGroup.rows.length > 0) {
                    groups.push(curGroup);
                  }

                  return groups.map((grp, gIdx) => (
                    <tbody key={grp.groupHeaderRow?.id || `grp_${gIdx}`} className="print-table-group" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                      <tr aria-hidden="true" style={{ height: 0, lineHeight: 0, overflow: 'hidden' }}>
                        {tableCols.map((col: any) => {
                          const colWidth = getColStyleWidth(col.id, col.width, tableCols);
                          return (
                            <td
                              key={`anchor_${col.id}`}
                              style={{
                                width: colWidth,
                                maxWidth: colWidth,
                                padding: 0,
                                border: 'none',
                                height: 0,
                                fontSize: 0,
                                lineHeight: 0,
                                overflow: 'hidden',
                                boxSizing: 'border-box'
                              }}
                            />
                          );
                        })}
                      </tr>
                      {grp.groupHeaderRow && (
                        <tr key={grp.groupHeaderRow.id} style={{ pageBreakInside: 'avoid', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                          <td
                            colSpan={tableCols.length}
                            style={{
                              border: cellBorder,
                              borderBottom: cellBorderBottom,
                              background: bStyle === 'borderless' ? 'transparent' : '#f8fafc', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.80rem',
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
                      {grp.rows.map((row: any) => (
                        <tr key={row.id} style={{ pageBreakInside: 'avoid' }}>
                          {tableCols.map((col: any) => {
                            const colWidth = getColStyleWidth(col.id, col.width, tableCols);
                            const cellKey = `${block.id}_${row.id}_${col.id}`;
                            const cellValue = submission.formData.find(f => f.id === cellKey)?.value || '';
                            const hasOptions = (col.type === 'checkbox' || col.type === 'radio') && col.options && col.options.length > 0;
                            const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : col.type === 'likert_scale' ? 'center' : 'left'));
                            const staticVal = block.tableData?.[row.id]?.[col.id];
                            const isStaticLabel = (col.type === 'static_text' || col.type === 'text') && staticVal !== undefined && staticVal !== null && staticVal.toString().trim() !== '';
                            return (
                              <td
                                key={col.id}
                                style={{
                                  border: cellBorder,
                                  borderBottom: cellBorderBottom,
                                  padding: '6px 8px',
                                  fontSize: '0.82rem',
                                  verticalAlign: 'middle',
                                  textAlign: cellAlign,
                                  width: colWidth,
                                  maxWidth: colWidth,
                                  boxSizing: 'border-box'
                                }}
                              >
                                {isStaticLabel ? (
                                  <span style={{ fontWeight: 'var(--pw-weight-regular)', display: 'block', textAlign: cellAlign, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.82rem', lineHeight: 1.4 }}>{renderFormattedText(staticVal)}</span>
                                ) : col.type === 'likert_scale' ? (() => {
                                  const scaleOptions = col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                  return (
                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scaleOptions.length}, 1fr)`, gap: '4px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                      {scaleOptions.map((opt: string, sIdx: number) => {
                                        const isSelected = cellValue === opt;
                                        return (
                                          <div key={sIdx} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                            <span
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '13px',
                                                height: '13px',
                                                borderRadius: '50%',
                                                border: '1px solid #000000',
                                                background: '#ffffff'
                                              }}
                                            >
                                              {isSelected && (
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#000000' }} />
                                              )}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })() : col.type === 'checkbox' ? (() => {
                                   const opts = col.options || [];
                                   const isInline = canTableOptionsFitInline(opts, col.width, col.checkboxLayout);
                                   return (
                                   hasOptions ? (
                                      <div style={{
                                        display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                        gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(opts) : undefined,
                                        flexDirection: col.checkboxLayout === '2-column' ? undefined : isInline ? 'row' : 'column',
                                        flexWrap: isInline ? 'wrap' : undefined,
                                        gap: col.checkboxLayout === '2-column' ? '4px 12px' : isInline ? '4px 12px' : '5px',
                                        alignItems: 'center',
                                        justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                        padding: '4px 0',
                                        width: '100%'
                                      }}>
                                        {(col.options || []).map((opt: any, oIdx: number) => {
                                         const currentValues = cellValue ? cellValue.split(',').filter(Boolean) : [];
                                         const isChecked = currentValues.includes(opt.value || opt.label);
                                         return (
                                           <div key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#000000', width: isInline ? 'auto' : '100%', whiteSpace: isInline ? 'nowrap' : undefined }}>
                                             <span style={{
                                               display: 'inline-flex',
                                               justifyContent: 'center',
                                               alignItems: 'center',
                                               width: '12px',
                                               height: '12px',
                                               border: '1px solid #000000',
                                               background: isChecked ? '#e2e8f0' : '#ffffff',
                                               borderRadius: '2px',
                                               flexShrink: 0,
                                               fontSize: '9px',
                                               fontWeight: 'var(--pw-weight-heavy)',
                                               lineHeight: 1,
                                               marginTop: '2px'
                                             }}>
                                               {isChecked ? '✓' : ''}
                                             </span>
                                             <span style={{ color: isChecked ? '#000000' : '#64748b', lineHeight: 1.3, whiteSpace: isInline ? 'nowrap' : 'pre-wrap', wordBreak: isInline ? 'normal' : 'break-word', flex: isInline ? undefined : 1 }}>{opt.label}</span>
                                           </div>
                                         );
                                       })}
                                     </div>
                                   ) : (
                                     <div style={{ display: 'flex', justifyContent: 'center' }}>
                                       <input type="checkbox" checked={cellValue === 'true'} readOnly style={{ transform: 'scale(1.1)' }} />
                                     </div>
                                   )
                                 );
                                })() : col.type === 'radio' ? (() => {
                                  const opts = col.options || [];
                                  const isInline = canTableOptionsFitInline(opts, col.width, col.checkboxLayout);
                                  return (
                                  hasOptions ? (
                                     <div style={{
                                       display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                       gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(opts) : undefined,
                                       flexDirection: col.checkboxLayout === '2-column' ? undefined : isInline ? 'row' : 'column',
                                       flexWrap: isInline ? 'wrap' : undefined,
                                       gap: col.checkboxLayout === '2-column' ? '4px 12px' : isInline ? '4px 12px' : '5px',
                                       alignItems: 'center',
                                       justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                       padding: '4px 0',
                                       width: '100%'
                                     }}>
                                       {opts.map((opt: any, oIdx: number) => {
                                        const isChecked = cellValue === (opt.value || opt.label);
                                        return (
                                          <div key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#000000', width: isInline ? 'auto' : '100%', whiteSpace: isInline ? 'nowrap' : undefined }}>
                                            <span style={{
                                              display: 'inline-flex',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                              width: '12px',
                                              height: '12px',
                                              border: '1px solid #000000',
                                              background: isChecked ? '#000000' : '#ffffff',
                                              borderRadius: '50%',
                                              flexShrink: 0,
                                              marginTop: 0
                                            }}>
                                              {isChecked && <span style={{ width: '4px', height: '4px', background: '#ffffff', borderRadius: '50%' }} />}
                                            </span>
                                            <span style={{ color: isChecked ? '#000000' : '#64748b', lineHeight: 1.3, whiteSpace: isInline ? 'nowrap' : 'pre-wrap', wordBreak: isInline ? 'normal' : 'break-word', flex: isInline ? undefined : 1 }}>{opt.label}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                      <input type="radio" checked={cellValue === 'true'} readOnly style={{ transform: 'scale(1.1)' }} />
                                    </div>
                                  )
                                  );
                                })() : col.type === 'rating' ? (() => {
                                  const scale = col.ratingScale === 3 ? 3 : 5;
                                  const currentRating = parseInt(cellValue, 10) || 0;
                                  return (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                        {Array.from({ length: scale }).map((_, idx) => (
                                          <Star
                                            key={idx}
                                            size={13}
                                            style={{
                                              color: '#000000',
                                              fill: idx < currentRating ? '#000000' : 'none',
                                              strokeWidth: 1.4
                                            }}
                                          />
                                        ))}
                                      </div>
                                      {currentRating > 0 && (
                                        <span style={{ fontSize: '0.72rem', fontWeight: 'var(--pw-weight-heavy)', marginLeft: '3px' }}>
                                          ({currentRating}/{scale})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })() : (
                                  <span style={{ display: 'block', textAlign: cellAlign }}>{cellValue}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  ));
                })()}
                {(() => {
                  const columns = block.tableColumns || [];
                  const totalCols = columns.length;
                  if (totalCols === 0) return null;

                  const summaryTypes: { id: string; label: string }[] = [];
                  const columnsWithSummaries: { col: any; colIdx: number; rowMap: Map<string, any> }[] = [];

                  columns.forEach((col: any, colIdx: number) => {
                    if (col.type === 'number' && col.summaryRows && col.summaryRows.length > 0) {
                      const rowMap = new Map<string, any>();
                      col.summaryRows.forEach((row: any) => {
                        rowMap.set(row.id, row);
                        if (!summaryTypes.some(s => s.label === row.label)) {
                          summaryTypes.push({ id: row.id, label: row.label || 'Cộng:' });
                        }
                      });
                      columnsWithSummaries.push({ col, colIdx, rowMap });
                    }
                  });

                  if (columnsWithSummaries.length === 0) return null;

                  const firstSumColIdx = Math.min(...columnsWithSummaries.map(c => c.colIdx));

                  return (
                    <tfoot>
                      {summaryTypes.map((sumType, idx) => {
                        return (
                          <tr key={sumType.id || idx} style={{ background: '#ffffff', fontWeight: 'var(--pw-weight-heavy)' }}>
                            {firstSumColIdx > 0 && (
                              <td colSpan={firstSumColIdx} style={{
                                border: '1px solid #000000',
                                padding: '5px 8px',
                                textAlign: 'right',
                                fontSize: '0.82rem',
                                color: '#000000'
                              }}>
                                {sumType.label}
                              </td>
                            )}
                            {columns.slice(firstSumColIdx).map((col: any, offsetIdx: number) => {
                              const actualColIdx = firstSumColIdx + offsetIdx;
                              const colSumData = columnsWithSummaries.find(c => c.colIdx === actualColIdx);
                              const targetRow = colSumData ? (colSumData.rowMap.get(sumType.id) || Array.from(colSumData.rowMap.values()).find((r: any) => r.label === sumType.label)) : null;
                              const isLabelColIfFirst = actualColIdx === 0 && firstSumColIdx === 0;

                              let cellContent = '';
                              if (targetRow) {
                                const cellKey = `${block.id}_summary_${col.id}_${targetRow.id}`;
                                const snapshotVal = submission.formData?.find(f => f.id === cellKey)?.value || '0';
                                const numVal = parseFloat(snapshotVal) || 0;
                                cellContent = numVal.toLocaleString('vi-VN');
                              } else if (isLabelColIfFirst) {
                                cellContent = sumType.label;
                              }

                              return (
                                <td key={col.id} style={{
                                  border: '1px solid #000000',
                                  padding: '5px 8px',
                                  textAlign: 'right',
                                  fontSize: '0.82rem',
                                  color: '#000000'
                                }}>
                                  {cellContent}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tfoot>
                  );
                })()}
              </table>
            </div>
            );
          })()}
          </div>
        );
      })}

      {/* SECTION LABEL RECORD BLOCK */}
      {layoutBlocks.filter(b => b.type === 'SECTION_LABEL').map((block: any) => {
        const titleFmt = getEffectiveTitleFormat(block);
        if (titleFmt === 'NONE') return null;
        const isH1 = titleFmt === 'H1';
        return (
          <div key={block.id} className="print-block print-block--section print-block-avoid">
            {isH1 ? (
              <div style={{
                padding: '0',
                marginBottom: 'var(--pw-title-gap)',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                pageBreakAfter: 'avoid',
                breakAfter: 'avoid'
              }}>
                <h2 style={{
                  display: 'inline-block',
                  margin: '0 0 4px 0',
                  fontSize: '1.1rem',
                  fontWeight: 'var(--pw-weight-heavy)',
                  color: '#000000',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2.5px solid #0d9488',
                  paddingBottom: '3px'
                }}>
                  {renderFormattedText(block.title)}
                </h2>
                {block.description && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#333333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {renderFormattedText(block.description)}
                  </p>
                )}
              </div>
            ) : (
              <div style={{
                padding: '8px 12px',
                background: '#f1f5f9',
                borderLeft: '4px solid #0d9488',
                borderRadius: '0px',
                marginBottom: 'var(--pw-title-gap)',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                pageBreakAfter: 'avoid',
                breakAfter: 'avoid'
              }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 'var(--pw-weight-heavy)', color: '#1e293b' }}>
                  {renderFormattedText(block.title)}
                </h3>
                {block.description && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {renderFormattedText(block.description)}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* PHOTO EVIDENCE LOG */}
      {imageUrls.length > 0 && (
        <div className="print-block" style={{ pageBreakInside: 'avoid' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 'var(--pw-weight-heavy)', textTransform: 'uppercase', color: '#475569' }}>
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
          <span style={{ fontSize: '0.8rem', fontWeight: 'var(--pw-weight-heavy)', textAlign: 'center' }}>Người kiểm tra (Operator)</span>
          <div style={{ fontSize: '0.8rem' }}>
            Họ tên: <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>{submission.operatorId}</span>
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
          <span style={{ fontSize: '0.8rem', fontWeight: 'var(--pw-weight-heavy)', textAlign: 'center' }}>Người thẩm tra (Supervisor)</span>
          {submission.supervisorSignoff ? (
            <>
              <div style={{ fontSize: '0.8rem' }}>
                Họ tên: <span style={{ fontWeight: 'var(--pw-weight-medium)' }}>{submission.supervisorSignoff.signedBy}</span>
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
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              {/* Spacer giữ chỗ cho footer fixed — cùng chiều cao với .print-footer */}
              <div className="print-footer-spacer"></div>
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Footer thực sự: position fixed, overlay đúng lên vùng spacer tfoot đã giữ chỗ */}
      <div className="print-footer">
        <span>{(submission as any).formId || (submission as any).form_id || (submission as any).formName || 'N/A'}</span>
        <span>{formatFormVersion(submission.formVersion || 'v1.0')}</span>
      </div>
    </div>,
    document.body
  );
}
