import React from 'react';
import ReactDOM from 'react-dom';
import type { FormTemplateISO, LayoutBlockISO, TableColumnConfig } from '../../types';
import { formatFormVersion, getColStyleWidth } from '../../types';
import { sanitizeLabel, getEffectiveTitleFormat, to5SFileName } from '../../utils/formUtils';

// Helper: derive CHECKLIST_TABLE columns — falls back to columnLabels for backward compat
function getChecklistColumns(block: LayoutBlockISO): TableColumnConfig[] {
  let cols: TableColumnConfig[];
  if (block.tableColumns && block.tableColumns.length > 0) {
    cols = block.tableColumns;
  } else if (block.columnLabels) {
    cols = [
      { id: 'col_stt',      label: block.columnLabels.stt      || 'STT',                          width: '40px',  type: 'static_text', locked: true },
      { id: 'col_item',     label: block.columnLabels.item     || 'Chi tiết kiểm tra',            width: 'auto',  type: 'static_text', locked: true },
      { id: 'col_target',   label: block.columnLabels.target   || 'Đạt / Không Đạt',             width: '130px', type: 'radio',        align: 'center',
        options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
      { id: 'col_reaction', label: block.columnLabels.reaction || 'Mô tả cụ thể nếu Không đạt', width: '220px', type: 'text' }
    ];
  } else {
    cols = [
      { id: 'col_stt',      label: 'STT',                          width: '5%',   type: 'static_text', locked: true },
      { id: 'col_item',     label: 'Tiêu chí',                     width: '35%',  type: 'static_text', locked: true },
      { id: 'col_unit',     label: 'Đơn vị',                       width: '10%',  type: 'static_text', locked: true },
      { id: 'col_spec',     label: 'Tiêu chuẩn',                   width: '20%',  type: 'static_text', locked: true },
      { id: 'col_target',   label: 'Kết quả',                      width: '15%',  type: 'radio',        align: 'center', locked: true,
        options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
      { id: 'col_reaction', label: 'Ghi chú',                      width: '15%',  type: 'text' }
    ];
  }

  if (block.hideSTT) {
    cols = cols.map(c => c.id === 'col_stt' ? { ...c, hidden: true } : c);
  }

  return cols.filter(c => !c.hidden);
}

interface PrintBlankFormProps {
  template: FormTemplateISO;
  onClose: () => void;
}

const getCheckboxGridTemplate = (options: any[]) => {
  if (!options || options.length === 0) return '1fr 1fr';
  let maxLen1 = 0;
  let maxLen2 = 0;
  options.forEach((opt, idx) => {
    const len = opt && opt.label ? opt.label.length : 0;
    if (idx % 2 === 0) {
      if (len > maxLen1) maxLen1 = len;
    } else {
      if (len > maxLen2) maxLen2 = len;
    }
  });
  if (maxLen1 === 0) maxLen1 = 10;
  if (maxLen2 === 0) maxLen2 = 10;
  const total = maxLen1 + maxLen2;
  const pct1 = Math.max(30, Math.min(70, Math.round((maxLen1 / total) * 100)));
  const pct2 = 100 - pct1;
  return `${pct1}% ${pct2}%`;
};

export default function PrintBlankForm({ template, onClose }: PrintBlankFormProps) {
  const [logoUrl, setLogoUrl] = React.useState<string>('');
  const [imgLoaded, setImgLoaded] = React.useState<boolean>(false);

  const titleBlock = template.layoutBlocks.find(b => b.type === 'TITLE');
  const titleBlockLogo = titleBlock?.logo;

  React.useEffect(() => {
    if (!titleBlockLogo) {
      setLogoUrl('');
      setImgLoaded(true); // No logo to wait for — proceed to print immediately
      return;
    }
    if (titleBlockLogo.startsWith('uploads/')) {
      // Use download-inline: server fetches from R2 and returns base64 data URL
      // This avoids cross-origin image loading in the print context
      fetch(`/api/storage/download-inline?key=${encodeURIComponent(titleBlockLogo)}`)
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
          console.error('Error fetching inline logo for print:', err);
          setImgLoaded(true); // Fetch failed — proceed without logo
        });
    } else {
      setLogoUrl(titleBlockLogo);
      // imgLoaded will be set by the <img> onLoad/onError handlers
    }
  }, [titleBlockLogo]);

  // Trigger print dialog only after logo image is fully loaded in DOM
  React.useEffect(() => {
    if (!imgLoaded) return;

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
  }, [imgLoaded, onClose]);

  // Set document.title according to Digital 5S standard
  React.useEffect(() => {
    const originalTitle = document.title;
    if (template.formTitle) {
      document.title = `FORM_${to5SFileName(template.formTitle)}`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [template.formTitle]);

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
      fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, sans-serif",
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
            padding: 0 0 48px 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 20mm 15mm;
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
            margin-bottom: 20px;
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
          .subtable-print-container {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .print-table tfoot td {
            background: transparent !important;
          }
          .print-footer {
            position: fixed;
            bottom: 0px;
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
        <span>{formatFormVersion(template.version || 'v0.1', template.status, template.effectiveDate, template.updatedAt)}</span>
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
          <div key={block.id} className={`print-block ${block.type !== 'CHECKLIST_TABLE' && block.type !== 'INFO_GRID' ? 'print-block-avoid' : ''}`}>
            
            {/* 1.1 SECTION LABEL BLOCK */}
            {block.type === 'SECTION_LABEL' && (() => {
              const titleFmt = getEffectiveTitleFormat(block);
              if (titleFmt === 'NONE') return null;
              if (titleFmt === 'H1') {
                return (
                  <div style={{
                    padding: '0',
                    marginTop: '28px',
                    marginBottom: '8px',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    pageBreakAfter: 'avoid',
                    breakAfter: 'avoid'
                  }}>
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: '#000000',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '2px solid #000000',
                      paddingBottom: '3px'
                    }}>
                      {block.title}
                    </h2>
                    {block.description && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#333333', whiteSpace: 'pre-line' }}>
                        {block.description}
                      </p>
                    )}
                  </div>
                );
              }
              if (titleFmt === 'H2') {
                return (
                  <div style={{
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    borderLeft: '4px solid #000000',
                    borderRadius: '4px',
                    marginTop: '20px',
                    marginBottom: '6px',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    pageBreakAfter: 'avoid',
                    breakAfter: 'avoid'
                  }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                      {block.title}
                    </h3>
                    {block.description && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#475569', whiteSpace: 'pre-line' }}>
                        {block.description}
                      </p>
                    )}
                  </div>
                );
              }
              // BODY format (normal body text, non-bold)
              return (
                <div style={{ padding: '2px 0', marginTop: '14px', marginBottom: '4px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#000000' }}>
                    {block.title}
                  </div>
                  {block.description && (
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#333333', whiteSpace: 'pre-line' }}>
                      {block.description}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* 1. TITLE BLOCK */}
            {block.type === 'TITLE' && (
              block.logo ? (
                <div style={{
                  padding: '10px 0',
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '15px',
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
                    <h1 style={{ margin: '0 0 2px 0', fontSize: '1.35rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      {block.title}
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
                      {block.fields[0]?.checkItem || ''}
                    </p>
                    {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                      <div style={{ marginTop: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                        <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                      </div>
                    )}
                  </div>
                  {block.showDate && block.datePosition === 'A' && (
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '10px 0',
                  textAlign: 'center',
                  marginBottom: '15px',
                  position: 'relative'
                }}>
                  {block.showDate && block.datePosition === 'A' && (
                    <div style={{ position: 'absolute', right: 0, top: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </div>
                  )}
                  <h1 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    {block.title}
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
                    {block.fields[0]?.checkItem || ''}
                  </p>
                  {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                    <div style={{ marginTop: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </div>
                  )}
                </div>
              )
            )}

            {/* 2. INFO GRID BLOCK */}
            {block.type === 'INFO_GRID' && (() => {
              const cols: any[][] = Array.from({ length: block.columns }, () => []);
              block.fields.forEach((f, idx) => {
                cols[idx % block.columns].push(f);
              });
              const titleFmt = getEffectiveTitleFormat(block);

              return (
                <div style={{
                  padding: '0',
                  marginTop: '0',
                  marginBottom: '0'
                }}>
                  {titleFmt !== 'NONE' && (
                    titleFmt === 'H1' ? (
                      <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase', borderBottom: '2px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '4px', marginBottom: '6px', fontWeight: 700, fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#000000' }}>
                        {block.title}
                      </div>
                    )
                  )}
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
                        {colFields.map(f => {
                          const cleanLabel = sanitizeLabel(f.checkItem);
                          if (f.type === 'checkbox' || f.type === 'radio') {
                            const options = f.options ?? [{ label: 'Có', value: 'YES' }, { label: 'Không', value: 'NO' }];
                            return (
                              <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.85rem' }}>
                                {cleanLabel && (
                                  <span style={{ fontWeight: 600, color: '#000000' }}>{cleanLabel}</span>
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', alignItems: 'center' }}>
                                  {options.map((opt: any) => (
                                    <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                      <span style={{
                                        display: 'inline-block',
                                        width: '14px',
                                        height: '14px',
                                        border: '1.5px solid #000000',
                                        background: '#ffffff',
                                        borderRadius: '2px',
                                        flexShrink: 0
                                      }} />
                                      <span>{opt.label}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          if (f.type === 'subtable') {
                            const cols = f.subtableColumns ?? [];
                            const blankRows = f.subtableDefaultRows ?? 3;
                            return (
                              <div key={f.id} className="subtable-print-container" style={{ fontSize: '0.82rem', width: '100%', gridColumn: `span ${block.columns || 1}`, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                {cleanLabel && <div style={{ fontWeight: 600, marginTop: '18px', marginBottom: '6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{cleanLabel}</div>}
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      {cols.map((col: any) => {
                                        const headerAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'));
                                        return (
                                          <th key={col.id} style={{ border: '1.5px solid #000000', padding: '4px 6px', background: '#f1f5f9', fontWeight: 600, textAlign: headerAlign as any, fontSize: '0.78rem', width: col.width }}>
                                            {col.label}
                                          </th>
                                        );
                                      })}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from({ length: blankRows }).map((_, rowIdx) => (
                                      <tr key={rowIdx}>
                                        {cols.map((col: any) => {
                                          if (col.type === 'static_text') {
                                            const sttAlign = col.align || 'left';
                                            return (
                                               <td key={col.id} style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px', textAlign: sttAlign as any, fontWeight: 600, fontSize: '0.8rem' }}>
                                                 {f.subtableStaticData?.[rowIdx]?.[col.id] || ''}
                                               </td>
                                            );
                                          }
                                          return <td key={col.id} style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px' }} />;
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          }

                          return (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '0.85rem' }}>
                              {cleanLabel && <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{cleanLabel}</span>}
                              {f.type === 'time' ? (
                                f.timeMode === 'dual' ? (
                                  <div style={{ fontSize: '0.85rem', color: '#000000', display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                                    Từ <span style={{ borderBottom: '1px solid #e2e8f0', flex: 1, minWidth: '40px', display: 'inline-block', height: '14px', textAlign: 'center' }} /> : <span style={{ borderBottom: '1px solid #e2e8f0', flex: 1, minWidth: '40px', display: 'inline-block', height: '14px', textAlign: 'center' }} /> đến <span style={{ borderBottom: '1px solid #e2e8f0', flex: 1, minWidth: '40px', display: 'inline-block', height: '14px', textAlign: 'center' }} /> : <span style={{ borderBottom: '1px solid #e2e8f0', flex: 1, minWidth: '40px', display: 'inline-block', height: '14px', textAlign: 'center' }} />
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.85rem', color: '#000000', display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                                    <span style={{ borderBottom: '1px solid #e2e8f0', flex: 1, minWidth: '60px', display: 'inline-block', height: '14px', textAlign: 'center' }} /> : <span style={{ borderBottom: '1px solid #e2e8f0', flex: 1, minWidth: '60px', display: 'inline-block', height: '14px', textAlign: 'center' }} />
                                  </div>
                                )
                              ) : (
                                <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0', minHeight: '16px' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 3. CHECKLIST TABLE BLOCK */}
            {block.type === 'CHECKLIST_TABLE' && (() => {
              const titleFmt = getEffectiveTitleFormat(block);
              return (
                <div style={{ marginTop: '0' }}>
                  {titleFmt !== 'NONE' && (
                    titleFmt === 'H1' ? (
                      <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase', borderBottom: '2px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '4px', marginBottom: '6px', fontWeight: 700, fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#000000' }}>
                        {block.title}
                      </div>
                    )
                  )}
                  <table className="print-table" style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                  <thead>
                    <tr>
                      {getChecklistColumns(block).map((col) => (
                        <th
                          key={col.id}
                          style={{
                            width: col.width,
                            border: '1.5px solid #000000',
                            padding: '6px',
                            background: '#f1f5f9',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            textAlign: (col.align || (col.id === 'col_stt' ? 'center' : 'left')) as any
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
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
                            <td colSpan={getChecklistColumns(block).length} style={{ border: '1.5px solid #000000', padding: '6px 8px', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase', color: '#1e293b' }}>
                              {sectionHeader}
                            </td>
                          </tr>
                        );
                      }

                      renderRows.push(
                        <tr key={field.id} style={{ pageBreakInside: 'avoid' }}>
                          {getChecklistColumns(block).map((col) => {
                            const commonStyle: React.CSSProperties = {
                              border: '1.5px solid #000000',
                              padding: '8px 6px',
                              fontSize: '0.8rem',
                              textAlign: col.align as any || 'left'
                            };

                            if (col.id === 'col_stt') {
                              return <td key={col.id} style={{ ...commonStyle, textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>;
                            }
                            if (col.id === 'col_item') {
                              return <td key={col.id} style={commonStyle}>{displayTitle}</td>;
                            }
                            if (col.id === 'col_unit') {
                              return <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>{field.unit || ''}</td>;
                            }
                            if (col.id === 'col_spec') {
                              let specText = '';
                              if (field.type === 'number') {
                                if (field.minSpec !== undefined && field.maxSpec !== undefined) {
                                  specText = `${field.minSpec} ~ ${field.maxSpec}`;
                                } else if (field.minSpec !== undefined) {
                                  specText = `>= ${field.minSpec}`;
                                } else if (field.maxSpec !== undefined) {
                                  specText = `<= ${field.maxSpec}`;
                                }
                              } else {
                                specText = field.targetRange || '';
                              }
                              return <td key={col.id} style={commonStyle}>{specText}</td>;
                            }
                            if (col.id === 'col_target') {
                              return (
                                <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>
                                  {(field.type === 'radio' || field.type === 'checkbox') ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      {(field.options ?? [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }]).map(opt => (
                                        <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                          <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '1.5px solid #000000', background: '#ffffff', borderRadius: '2px' }} />
                                          <span>{opt.label}</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : field.type === 'time' ? (
                                    field.timeMode === 'dual' ? (
                                      <div style={{ fontSize: '0.75rem', color: '#000000', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px' }}>
                                        Từ <span style={{ borderBottom: '1px solid #000000', width: '22px', display: 'inline-block', height: '12px' }} />:<span style={{ borderBottom: '1px solid #000000', width: '22px', display: 'inline-block', height: '12px' }} /> đến <span style={{ borderBottom: '1px solid #000000', width: '22px', display: 'inline-block', height: '12px' }} />:<span style={{ borderBottom: '1px solid #000000', width: '22px', display: 'inline-block', height: '12px' }} />
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: '0.75rem', color: '#000000', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px' }}>
                                        <span style={{ borderBottom: '1px solid #000000', width: '30px', display: 'inline-block', height: '12px' }} /> : <span style={{ borderBottom: '1px solid #000000', width: '30px', display: 'inline-block', height: '12px' }} />
                                      </div>
                                    )
                                  ) : field.type === 'number' ? (
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>..............</span>
                                  ) : (
                                    <div style={{ borderBottom: '1px dashed #94a3b8', width: '80%', height: '14px', margin: '0 auto' }} />
                                  )}
                                </td>
                              );
                            }
                            if (col.id === 'col_reaction') {
                              return <td key={col.id} style={{ ...commonStyle, color: '#64748b', fontSize: '0.75rem' }} />;
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

            {/* 3.2 DYNAMIC TABLE BLOCK */}
            {block.type === 'TABLE' && (() => {
              const titleFmt = getEffectiveTitleFormat(block);
              return (
                <div style={{ marginTop: '0' }}>
                  {titleFmt !== 'NONE' && (
                    titleFmt === 'H1' ? (
                      <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase', borderBottom: '2px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '4px', marginBottom: '6px', fontWeight: 700, fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#000000' }}>
                        {block.title}
                      </div>
                    )
                  )}
                  <table className="print-table" style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed'
                  }}>
                  <thead>
                    <tr>
                      {(block.tableColumns || []).map((col) => {
                        const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                        const hasOptions = col.type === 'checkbox' && col.options && col.options.length > 0;
                        const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : 'left'));
                        return (
                          <th key={col.id} style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', textAlign: cellAlign, width: colWidth }}>
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
                          Không có dòng nào.
                        </td>
                      </tr>
                    ) : (
                      (block.tableRows || []).map((row) => (
                        <tr key={row.id} style={{ pageBreakInside: 'avoid' }}>
                          {(block.tableColumns || []).map((col) => {
                            const hasOptions = col.type === 'checkbox' && col.options && col.options.length > 0;
                            const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : 'left'));
                            return (
                              <td key={col.id} style={{ border: '1.5px solid #000000', padding: '4px 6px', fontSize: '0.8rem', verticalAlign: 'middle', height: '28px', textAlign: cellAlign }}>
                                {col.type === 'static_text' ? (
                                  <span style={{ fontWeight: 500, display: 'block', textAlign: cellAlign }}>{block.tableData?.[row.id]?.[col.id] || ''}</span>
                                ) : col.type === 'checkbox' ? (
                                  hasOptions ? (
                                    <div style={{
                                      display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                      gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(col.options || []) : undefined,
                                      flexDirection: col.checkboxLayout === '2-column' ? undefined : 'column',
                                      gap: col.checkboxLayout === '2-column' ? '4px 12px' : '5px',
                                      alignItems: 'flex-start',
                                      padding: '4px 0',
                                      width: '100%'
                                    }}>
                                      {(col.options || []).map((opt, oIdx) => (
                                        <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#000000' }}>
                                          <span style={{
                                            display: 'inline-block',
                                            width: '12px',
                                            height: '12px',
                                            border: '1.5px solid #000000',
                                            background: '#ffffff',
                                            borderRadius: '2px',
                                            flexShrink: 0
                                          }} />
                                          <span>{opt.label}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                      <span style={{
                                        display: 'inline-block',
                                        width: '14px',
                                        height: '14px',
                                        border: '1.5px solid #000000',
                                        background: '#ffffff',
                                        borderRadius: '2px'
                                      }} />
                                    </div>
                                  )
                                ) : col.type === 'radio' ? (
                                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      width: '14px',
                                      height: '14px',
                                      border: '1.5px solid #000000',
                                      background: '#ffffff',
                                      borderRadius: '50%'
                                    }} />
                                  </div>
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {(() => {
                    const allFooterRows: { col: any; row: any; colIdx: number }[] = [];
                    (block.tableColumns || []).forEach((col, colIdx) => {
                      if (col.type === 'number' && col.summaryRows && col.summaryRows.length > 0) {
                        col.summaryRows.forEach((row) => {
                          allFooterRows.push({ col, row, colIdx });
                        });
                      }
                    });
                    if (allFooterRows.length === 0) return null;
                    const totalCols = (block.tableColumns || []).length;
                    return (
                      <tfoot>
                        {allFooterRows.map(({ col, row, colIdx }, idx) => {
                          const isFirst = idx === 0;
                          const topBorder = isFirst ? '2px solid #000000' : '1px solid #e2e8f0';
                          return (
                            <tr key={`${col.id}_${row.id}`} style={{ background: '#ffffff', fontWeight: 'bold' }}>
                              {colIdx > 0 && (
                                <td colSpan={colIdx} style={{
                                  borderTop: topBorder,
                                  borderBottom: 'none',
                                  borderLeft: 'none',
                                  borderRight: 'none',
                                  padding: '5px 8px',
                                  textAlign: 'right',
                                  fontSize: '0.82rem',
                                  color: '#000000'
                                }}>
                                  {row.label}
                                </td>
                              )}
                              <td style={{
                                borderTop: topBorder,
                                borderBottom: '1.5px solid #000000',
                                borderLeft: 'none',
                                borderRight: 'none',
                                padding: '5px 8px',
                                textAlign: 'right',
                                fontSize: '0.82rem',
                                color: '#000000',
                                letterSpacing: '1px'
                              }}>
                                 
                              </td>
                              {totalCols - 1 - colIdx > 0 && (
                                <td colSpan={totalCols - 1 - colIdx} style={{
                                  borderTop: topBorder,
                                  borderBottom: 'none',
                                  borderLeft: 'none',
                                  borderRight: 'none',
                                  padding: '5px 8px'
                                }} />
                              )}
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

            {/* 3.1 MATRIX TABLE BLOCK */}
            {block.type === 'MATRIX_TABLE' && block.matrixConfig && (() => {
              const titleFmt = getEffectiveTitleFormat(block);
              return (
                <div style={{ marginTop: '0' }}>
                  {titleFmt !== 'NONE' && (
                    titleFmt === 'H1' ? (
                      <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase', borderBottom: '2px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '4px', marginBottom: '6px', fontWeight: 700, fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#000000' }}>
                        {block.title}
                      </div>
                    )
                  )}
                  <table className="print-table" style={{
                    width: '100%',
                    borderCollapse: 'collapse'
                  }}>
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: '50px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', textAlign: 'center' }}>
                        {block.matrixConfig.rowHeader}
                      </th>
                      <th colSpan={block.matrixConfig.columns.length} style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', textAlign: 'center' }}>
                        {block.matrixConfig.columnHeader}
                      </th>
                      {block.matrixConfig.showTotalColumn && (
                        <th rowSpan={2} style={{ width: '130px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', textAlign: 'center' }}>
                          {block.matrixConfig.totalColumnHeader}
                        </th>
                      )}
                      {block.matrixConfig.showNotesColumn && (
                        <th rowSpan={2} style={{ width: '180px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 600, fontSize: '0.8rem', textAlign: 'left' }}>
                          {block.matrixConfig.notesColumnHeader}
                        </th>
                      )}
                    </tr>
                    <tr>
                      {block.matrixConfig.columns.map((colName, cIdx) => (
                        <th key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px', background: '#f8fafc', fontWeight: 600, fontSize: '0.75rem', textAlign: block.matrixConfig!.columnAlign || 'center' }}>
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
                          <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px' }}></td>
                        ))}
                        {block.matrixConfig!.showTotalColumn && (
                          <td style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px' }}></td>
                        )}
                        {block.matrixConfig!.showNotesColumn && (
                          <td style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px' }}></td>
                        )}
                      </tr>
                    ))}
                    {/* Empty Total Row */}
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold', pageBreakInside: 'avoid' }}>
                      <td style={{ border: '1.5px solid #000000', padding: '4px 6px', textAlign: 'center', fontSize: '0.8rem' }}>TỔNG</td>
                      {block.matrixConfig.columns.map((_, cIdx) => (
                        <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px' }}></td>
                      ))}
                      {block.matrixConfig.showTotalColumn && (
                        <td style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px' }}></td>
                      )}
                      {block.matrixConfig.showNotesColumn && (
                        <td style={{ border: '1.5px solid #000000', padding: '4px 6px', height: '28px' }}></td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

            {/* 4. SIGN BLOCK */}
            {block.type === 'SIGN' && (() => {
              const titleFmt = getEffectiveTitleFormat(block);
              return (
                <div style={{ marginTop: '0' }}>
                  {titleFmt !== 'NONE' && (
                    titleFmt === 'H1' ? (
                      <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase', borderBottom: '2px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '4px', marginBottom: '6px', fontWeight: 700, fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#000000' }}>
                        {block.title}
                      </div>
                    )
                  )}
                  <div style={{
                    paddingTop: '5px',
                    marginTop: '12px',
                    marginBottom: '45px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '40px'
                  }}>
                    {block.fields.map((f) => {
                      const isBlank = !f.checkItem || f.checkItem.trim() === '';
                      return (
                        <div key={f.id} style={{
                          flex: 1,
                          height: '80px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: '4px',
                          visibility: isBlank ? 'hidden' : 'visible'
                        }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center' }}>{f.checkItem}</span>
                          <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#475569', textAlign: 'center' }}>
                            {f.reactionProtocol ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`) : '(Ký và ghi rõ họ tên)'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          </div>
        );
      })}
    </div>,
    document.body
  );
}
