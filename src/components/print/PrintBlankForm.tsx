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

  const pageSize = template.pageSize || (template as any).page_size || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';

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
      {/* Dynamic CSS override to force portrait printing and clean page breaks */}
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
          ${isA5 ? `
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
          /* Khoảng cách giữa các block do thang .print-doc trong print.css quản. */
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

      {/* Outer Table Wrapper for Native Print Header/Footer Support */}
      <table className="print-outer-table">
        <tbody>
          <tr>
            <td>
              {/* Dynamic Blocks Rendering */}
              {template.layoutBlocks && template.layoutBlocks.map((block) => {
        return (
          <div key={block.id} className={`print-block${block.type === 'SECTION_LABEL' ? ' print-block--section' : ''} ${block.type !== 'CHECKLIST_TABLE' && block.type !== 'INFO_GRID' ? 'print-block-avoid' : ''}`}>
            
            {/* 1.1 SECTION LABEL BLOCK */}
            {block.type === 'SECTION_LABEL' && (() => {
              const titleFmt = getEffectiveTitleFormat(block);
              if (titleFmt === 'NONE') return null;
              if (titleFmt === 'H1') {
                return (
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
                      borderBottom: '2.5px solid #000000',
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
                    borderRadius: '0px',
                    marginBottom: 'var(--pw-title-gap)',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    pageBreakAfter: 'avoid',
                    breakAfter: 'avoid'
                  }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 'var(--pw-weight-heavy)', color: '#1e293b' }}>
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
                <div style={{ padding: '2px 0', marginBottom: 'var(--pw-title-gap)', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', color: '#000000' }}>
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
                      {block.title}
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
                      {block.description || ''}
                    </p>
                    {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                      <div style={{ marginTop: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                        <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                      </div>
                    )}
                  </div>
                  {block.showDate && block.datePosition === 'A' && (
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                      <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '10px 0',
                  textAlign: 'center',
                  position: 'relative'
                }}>
                  {block.showDate && block.datePosition === 'A' && (
                    <div style={{ position: 'absolute', right: 0, top: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </div>
                  )}
                  <h1 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 'var(--pw-weight-banner)', textTransform: 'uppercase', color: '#0d9488' }}>
                    {block.title}
                  </h1>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
                    {block.description || ''}
                  </p>
                  {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                    <div style={{ marginTop: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                      <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>
                    </div>
                  )}
                </div>
              )
            )}

            {/* 2. INFO GRID BLOCK */}
            {block.type === 'INFO_GRID' && (() => {
              const titleFmt = getEffectiveTitleFormat(block);

              return (
                <div style={{ padding: '0' }}>
                  {titleFmt !== 'NONE' && (
                    titleFmt === 'H1' ? (
                      <h2 style={{ display: 'inline-block', margin: '0 0 12px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#0f172a', textTransform: 'uppercase', borderBottom: '2.5px solid #0d9488', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #0d9488', borderRadius: '0px', marginBottom: '10px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#0f172a' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '8px', color: '#0f172a' }}>
                        {block.title}
                      </div>
                    )
                  )}
                  <div className="print-info-grid" style={{ gridTemplateColumns: `repeat(${block.columns}, 1fr)` }}>
                    {block.fields.map((f) => {
                          const cleanLabel = sanitizeLabel(f.checkItem);
                          const rSpan = f.type === 'subtable' ? undefined : f.rowSpan;
                          const cSpan = f.type === 'subtable' ? -1 : f.colSpan;
                          const gridItemStyle: React.CSSProperties = {
                            gridRow: rSpan && rSpan > 1 ? `span ${rSpan}` : undefined,
                            gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                            alignSelf: f.type === 'photo' ? 'stretch' : 'start',
                            height: f.type === 'photo' ? '100%' : 'auto',
                          };

                          if (f.type === 'photo') {
                            return (
                              <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', height: '100%', pageBreakInside: 'avoid' }}>
                                {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', fontSize: '0.82rem', marginBottom: '4px' }}>{cleanLabel}</span>}
                                <div style={{ flex: 1, border: '1.5px dashed #000000', borderRadius: '3px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60px', padding: '6px' }}>
                                  <span style={{ fontSize: '0.78rem', color: '#000000', fontStyle: 'italic', textAlign: 'center' }}>
                                    {f.placeholder ?? ''}
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          if (f.type === 'checkbox' || f.type === 'radio') {
                            const options = f.options ?? [{ label: 'Có', value: 'YES' }, { label: 'Không', value: 'NO' }];
                            return (
                              <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '0.85rem' }}>
                                {cleanLabel && (
                                  <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap' }}>{cleanLabel}</span>
                                )}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', alignItems: 'center', maxWidth: '100%' }}>
                                  {options.map((opt: any) => (
                                    <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }}>
                                      <span style={{
                                        display: 'inline-block',
                                        width: '13px',
                                        height: '13px',
                                        border: '1.5px solid #000000',
                                        background: '#ffffff',
                                        borderRadius: '2px',
                                        flexShrink: 0
                                      }} />
                                      <span style={{ lineHeight: '1.3' }}>{opt.label}</span>
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
                              <div key={f.id} className="subtable-print-container print-field-full" style={{ ...gridItemStyle, fontSize: '0.82rem', width: '100%', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                {cleanLabel && <div style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', marginBottom: '6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{cleanLabel}</div>}
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr>
                                      {cols.map((col: any) => {
                                        const headerAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'));
                                        return (
                                          <th key={col.id} style={{ border: '1px solid #cbd5e1', padding: '5px 6px', background: '#f8fafc', fontWeight: 'var(--pw-weight-medium)', color: '#475569', textAlign: headerAlign as any, fontSize: '0.78rem', width: col.width }}>
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
                                               <td key={col.id} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', height: '28px', textAlign: sttAlign as any, fontWeight: 'var(--pw-weight-regular)', fontSize: '0.8rem', color: '#0f172a' }}>
                                                 {f.subtableStaticData?.[rowIdx]?.[col.id] || ''}
                                               </td>
                                            );
                                          }
                                          return <td key={col.id} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', height: '28px' }} />;
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          }

                          if (f.type === 'date') {
                            return (
                              <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '0.85rem' }}>
                                {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap' }}>{cleanLabel}</span>}
                                <div style={{ fontSize: '0.85rem', color: '#0f172a', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                  <span style={{ borderBottom: '1px dotted #cbd5e1', width: '36px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} />
                                  <span style={{ color: '#000000', fontWeight: 'var(--pw-weight-regular)' }}>/</span>
                                  <span style={{ borderBottom: '1px dotted #cbd5e1', width: '36px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} />
                                  <span style={{ color: '#000000', fontWeight: 'var(--pw-weight-regular)' }}>/</span>
                                  <span style={{ borderBottom: '1px dotted #cbd5e1', width: '56px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '0.85rem' }}>
                              {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap' }}>{cleanLabel}</span>}
                              {f.type === 'time' ? (
                                f.timeMode === 'dual' ? (
                                  <div style={{ fontSize: '0.8rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Từ <span style={{ borderBottom: '1px dotted #cbd5e1', width: '32px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} /> : <span style={{ borderBottom: '1px dotted #cbd5e1', width: '32px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} /> đến <span style={{ borderBottom: '1px dotted #cbd5e1', width: '32px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} /> : <span style={{ borderBottom: '1px dotted #cbd5e1', width: '32px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} />
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.8rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ borderBottom: '1px dotted #cbd5e1', width: '36px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} /> <span style={{ color: '#475569', fontWeight: 'var(--pw-weight-regular)' }}>:</span> <span style={{ borderBottom: '1px dotted #cbd5e1', width: '36px', display: 'inline-block', minHeight: 'var(--pw-line-h)' }} />
                                  </div>
                                )
                              ) : (
                                <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', minHeight: 'var(--pw-line-h)' }} />
                              )}
                            </div>
                          );
                        })}
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
                      <h2 style={{ display: 'inline-block', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', borderBottom: '2.5px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '0px', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>
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
                            fontWeight: 'var(--pw-weight-medium)',
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
                            <td colSpan={getChecklistColumns(block).length} style={{ border: '1.5px solid #000000', padding: '4px 6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.8rem', textTransform: 'uppercase', color: '#1e293b' }}>
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
                              padding: '4px 6px',
                              fontSize: '0.8rem',
                              verticalAlign: 'middle',
                              height: '28px',
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
                                  ) : null}
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
                      <h2 style={{ display: 'inline-block', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', borderBottom: '2.5px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '0px', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>
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
                          <th key={col.id} style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.8rem', textAlign: cellAlign, width: colWidth }}>
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
                            const customCellOpts = block.cellOptionsMap?.[`${row.id}_${col.id}`];
                            const effectiveOpts = customCellOpts !== undefined ? customCellOpts : (col.options || []);
                            const hasOptions = (col.type === 'checkbox' || col.type === 'radio') && effectiveOpts.length > 0;
                            const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : 'left'));
                            return (
                              <td key={col.id} style={{ border: '1.5px solid #000000', padding: '4px 6px', fontSize: '0.8rem', verticalAlign: 'middle', height: '28px', textAlign: cellAlign }}>
                                {col.type === 'static_text' ? (
                                  <span style={{ fontWeight: 'var(--pw-weight-regular)', display: 'block', textAlign: cellAlign }}>{block.tableData?.[row.id]?.[col.id] || ''}</span>
                                ) : (col.type === 'checkbox' || col.type === 'radio') ? (
                                  hasOptions ? (
                                    <div style={{
                                      display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                      gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(effectiveOpts) : undefined,
                                      flexDirection: col.checkboxLayout === '2-column' ? undefined : 'column',
                                      gap: col.checkboxLayout === '2-column' ? '4px 12px' : '5px',
                                      alignItems: 'flex-start',
                                      padding: '4px 0',
                                      width: '100%'
                                    }}>
                                      {effectiveOpts.map((opt, oIdx) => (
                                        <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#000000' }}>
                                          <span style={{
                                            display: 'inline-block',
                                            width: '12px',
                                            height: '12px',
                                            border: '1.5px solid #000000',
                                            background: '#ffffff',
                                            borderRadius: col.type === 'radio' ? '50%' : '2px',
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
                                        borderRadius: col.type === 'radio' ? '50%' : '2px'
                                      }} />
                                    </div>
                                  )
                                ) : null}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {(() => {
                    const columns = block.tableColumns || [];
                    const totalCols = columns.length;
                    if (totalCols === 0) return null;

                    const summaryTypes: { id: string; label: string }[] = [];
                    const columnsWithSummaries: { col: any; colIdx: number; rowMap: Map<string, any> }[] = [];

                    columns.forEach((col, colIdx) => {
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
                                  border: '1.5px solid #000000',
                                  padding: '5px 8px',
                                  textAlign: 'right',
                                  fontSize: '0.82rem',
                                  color: '#000000'
                                }}>
                                  {sumType.label}
                                </td>
                              )}
                              {columns.slice(firstSumColIdx).map((col, offsetIdx) => {
                                const actualColIdx = firstSumColIdx + offsetIdx;
                                const isLabelColIfFirst = actualColIdx === 0 && firstSumColIdx === 0;

                                return (
                                  <td key={col.id} style={{
                                    border: '1.5px solid #000000',
                                    padding: '5px 8px',
                                    textAlign: 'right',
                                    fontSize: '0.82rem',
                                    color: '#000000'
                                  }}>
                                    {isLabelColIfFirst ? sumType.label : ''}
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

            {/* 3.1 MATRIX TABLE BLOCK */}
            {block.type === 'MATRIX_TABLE' && block.matrixConfig && (() => {
              const titleFmt = getEffectiveTitleFormat(block);
              return (
                <div style={{ marginTop: '0' }}>
                  {titleFmt !== 'NONE' && (
                    titleFmt === 'H1' ? (
                      <h2 style={{ display: 'inline-block', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', borderBottom: '2.5px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '0px', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>
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
                      <th rowSpan={2} style={{ width: '50px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.8rem', textAlign: 'center' }}>
                        {block.matrixConfig.rowHeader}
                      </th>
                      <th colSpan={block.matrixConfig.columns.length} style={{ border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.8rem', textAlign: 'center' }}>
                        {block.matrixConfig.columnHeader}
                      </th>
                      {block.matrixConfig.showTotalColumn && (
                        <th rowSpan={2} style={{ width: '130px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.8rem', textAlign: 'center' }}>
                          {block.matrixConfig.totalColumnHeader}
                        </th>
                      )}
                      {block.matrixConfig.showNotesColumn && (
                        <th rowSpan={2} style={{ width: '180px', border: '1.5px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.8rem', textAlign: 'left' }}>
                          {block.matrixConfig.notesColumnHeader}
                        </th>
                      )}
                    </tr>
                    <tr>
                      {block.matrixConfig.columns.map((colName, cIdx) => (
                        <th key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px', background: '#f8fafc', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.75rem', textAlign: block.matrixConfig!.columnAlign || 'center' }}>
                          {colName || `Cột ${cIdx + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: block.matrixConfig.rowCount }).map((_, rIdx) => (
                      <tr key={rIdx} style={{ pageBreakInside: 'avoid' }}>
                        <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'var(--pw-weight-regular)' }}>
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
                    <tr style={{ background: '#f8fafc', fontWeight: 'var(--pw-weight-heavy)', pageBreakInside: 'avoid' }}>
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
                      <h2 style={{ display: 'inline-block', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', borderBottom: '2.5px solid #000000', paddingBottom: '3px' }}>
                        {block.title}
                      </h2>
                    ) : titleFmt === 'H2' ? (
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderLeft: '4px solid #000000', borderRadius: '0px', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.9rem', color: '#000000' }}>
                        {block.title}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>
                        {block.title}
                      </div>
                    )
                  )}
                  <div style={{
                    paddingTop: '5px',
                    marginTop: 'var(--pw-block-gap)',
                    display: 'grid',
                    gridTemplateColumns: `repeat(${block.columns || 2}, 1fr)`,
                    gap: '20px'
                  }}>
                    {block.fields.map((f) => {
                      const isBlank = !f.checkItem || f.checkItem.trim() === '';
                      return (
                        <div key={f.id} style={{
                          height: '80px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: '4px',
                          visibility: isBlank ? 'hidden' : 'visible'
                        }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-heavy)', textAlign: 'center' }}>{f.checkItem}</span>
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
        <span>{(template as any).formId || (template as any).form_id || (template as any).formName || (template as any).id || 'N/A'}</span>
        <span>{formatFormVersion(template.version || (template as any).rawRecord?.version || 'v0.1', template.status, template.effectiveDate || (template as any).effective_date, template.updatedAt || (template as any).updated_at)}</span>
      </div>
    </div>,
    document.body
  );
}
