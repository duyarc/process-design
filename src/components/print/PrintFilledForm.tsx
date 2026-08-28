import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Star } from 'lucide-react';
import type { Submission, FormTemplateISO, LayoutBlockISO, TableColumnConfig } from '../../types';
import { formatFormVersion, getColStyleWidth } from '../../types';
import { sanitizeLabel, getEffectiveTitleFormat, to5SFileName, getAutoCheckboxLayoutMode, hasLongOptions, canTableOptionsFitInline, getCheckboxGridTemplate, isSeamlessTableBlock, getInfoGridTemplateColumns } from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';

// ─── Helpers (mirrored from PrintBlankForm) ───────────────────────────────────

/** Derive CHECKLIST_TABLE visible columns — falls back to columnLabels for backward compat */
function getChecklistColumns(block: LayoutBlockISO): TableColumnConfig[] {
  let cols: TableColumnConfig[];
  if (block.tableColumns && block.tableColumns.length > 0) {
    cols = block.tableColumns;
  } else if (block.columnLabels) {
    cols = [
      { id: 'col_stt',      label: block.columnLabels.stt      || 'STT',                          width: '40px',  type: 'static_text', locked: true },
      { id: 'col_item',     label: block.columnLabels.item     || 'Chi tiết kiểm tra',            width: 'auto',  type: 'static_text', locked: true },
      { id: 'col_target',   label: block.columnLabels.target   || 'Đạt / Không Đạt',             width: '130px', type: 'radio',       align: 'center',
        options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
      { id: 'col_reaction', label: block.columnLabels.reaction || 'Mô tả cụ thể nếu Không đạt', width: '220px', type: 'text' }
    ];
  } else {
    cols = [
      { id: 'col_stt',      label: 'STT',            width: '5%',   type: 'static_text', locked: true },
      { id: 'col_item',     label: 'Tiêu chí',       width: '35%',  type: 'static_text', locked: true },
      { id: 'col_unit',     label: 'Đơn vị',         width: '10%',  type: 'static_text', locked: true },
      { id: 'col_spec',     label: 'Tiêu chuẩn',     width: '20%',  type: 'static_text', locked: true },
      { id: 'col_target',   label: 'Kết quả',        width: '15%',  type: 'radio',       align: 'center', locked: true,
        options: [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }] },
      { id: 'col_reaction', label: 'Ghi chú',        width: '15%',  type: 'text' }
    ];
  }
  if (block.hideSTT) {
    cols = cols.map(c => c.id === 'col_stt' ? { ...c, hidden: true } : c);
  }
  return cols.filter(c => !c.hidden);
}


// ─── Filled-mode Helpers ─────────────────────────────────────────────────────

/** Check whether a stored field value means a specific option is selected */
function isOptionSelected(fieldValue: string, optValue: string, colType: 'radio' | 'checkbox'): boolean {
  if (!fieldValue) return false;
  if (colType === 'radio') return fieldValue.trim() === optValue;
  return fieldValue.split(',').map(v => v.trim()).includes(optValue);
}

/** Parse a signature snapshot value: "Name [Xác thực: timestamp]" */
function parseSignature(value: string): { name: string; timestamp: string } {
  const m = value.match(/^(.*?) \[Xác thực: (.*?)\]$/);
  if (m) return { name: m[1].trim(), timestamp: m[2].trim() };
  return { name: value, timestamp: '' };
}

/** Reconstruct TABLE rows from formData snapshots (safer than trusting block.tableRows for dynamic submissions) */
function buildTableRowMap(
  blockId: string,
  formData: Submission['formData'],
  tableColumns: TableColumnConfig[]
): Array<{ rowId: string; cells: Map<string, string> }> {
  const prefix = blockId + '_';
  const knownColIds = new Set(tableColumns.map(c => c.id));
  const rowOrder: string[] = [];
  const rowCells = new Map<string, Map<string, string>>();

  formData.forEach(s => {
    if (!s.id.startsWith(prefix)) return;
    const rest = s.id.slice(prefix.length);
    for (const colId of knownColIds) {
      if (rest.endsWith('_' + colId)) {
        const rowId = rest.slice(0, rest.length - colId.length - 1);
        if (!rowCells.has(rowId)) {
          rowCells.set(rowId, new Map());
          rowOrder.push(rowId);
        }
        rowCells.get(rowId)!.set(colId, s.value);
        break;
      }
    }
  });

  return rowOrder.map(rowId => ({ rowId, cells: rowCells.get(rowId)! }));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PrintFilledFormProps {
  submission: Submission;
  /** Optional — pass if caller already has the template (FormManager). If omitted, self-fetched from /api/forms/:formId */
  formTemplate?: FormTemplateISO;
  onClose: () => void;
}

export default function PrintFilledForm({ submission, formTemplate: propTemplate, onClose }: PrintFilledFormProps) {
  const [template, setTemplate] = useState<FormTemplateISO | null>(propTemplate ?? null);
  const [loading, setLoading]     = useState(!propTemplate);
  const [fetchError, setFetchError] = useState(false);

  const [logoUrl, setLogoUrl]     = useState('');
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imageUrls, setImageUrls]         = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // 1. Fetch FormTemplateISO if prop not provided (SubmissionManager path)
  useEffect(() => {
    if (propTemplate) { setTemplate(propTemplate); setLoading(false); return; }
    fetch(`/api/forms/${encodeURIComponent(submission.formId)}`)
      .then(res => res.ok ? res.json() : Promise.reject('not found'))
      .then((data: any) => {
        const layoutBlocks = typeof data.layout_blocks === 'string'
          ? JSON.parse(data.layout_blocks)
          : (data.layout_blocks || []);
        setTemplate({
          formId:        data.form_id     || data.formId     || submission.formId,
          formTitle:     data.form_title  || data.formTitle  || submission.formId,
          version:       data.version     || 'v0.1',
          status:        data.status      || 'ACTIVE',
          effectiveDate: data.effective_date || data.effectiveDate,
          updatedAt:     data.updated_at     || data.updatedAt,
          layoutBlocks,
          pageSize:      data.page_size   || data.pageSize   || 'A4',
        } as FormTemplateISO);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [submission.formId, propTemplate]);

  // 2. Fetch logo (runs after template is set)
  useEffect(() => {
    if (!template) return;
    const titleBlock = template.layoutBlocks?.find(b => b.type === 'TITLE');
    const logoKey = titleBlock?.logo;
    if (!logoKey) { setImgLoaded(true); return; }
    if (logoKey.startsWith('uploads/')) {
      fetch(`/api/storage/download-inline?key=${encodeURIComponent(logoKey)}`)
        .then(r => r.json())
        .then(d => { if (d.dataUrl) setLogoUrl(d.dataUrl); else setImgLoaded(true); })
        .catch(() => setImgLoaded(true));
    } else {
      setLogoUrl(logoKey);
    }
  }, [template]);

  // 3. Fetch photo evidence presigned URLs
  useEffect(() => {
    if (!submission.mediaUrls || submission.mediaUrls.length === 0) return;
    setLoadingImages(true);
    Promise.all(
      submission.mediaUrls.map(key =>
        fetch(`/api/storage/download-url?key=${encodeURIComponent(key)}`)
          .then(r => r.json())
          .then((d: any) => d.downloadUrl as string)
          .catch(() => '')
      )
    )
      .then(urls => setImageUrls(urls.filter(Boolean)))
      .finally(() => setLoadingImages(false));
  }, [submission]);

  // 4. Trigger print after everything is ready
  useEffect(() => {
    if (loading || loadingImages || !imgLoaded || !template) return;
    const handleAfterPrint = () => onClose();
    window.addEventListener('afterprint', handleAfterPrint);
    const timer = setTimeout(() => window.print(), 200);
    return () => { window.removeEventListener('afterprint', handleAfterPrint); clearTimeout(timer); };
  }, [loading, loadingImages, imgLoaded, template, onClose]);

  // 5. Document title — REC_{YYYYMMDD}_{FORMNAME}
  useEffect(() => {
    if (!template) return;
    const orig = document.title;
    const datePart = submission.submittedAt?.split('T')[0]?.replace(/-/g, '') || '';
    document.title = `REC_${datePart}_${to5SFileName(template.formTitle || submission.formId)}`;
    return () => { document.title = orig; };
  }, [template, submission.submittedAt, submission.formId]);

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: '#64748b' }}>
      Đang tải template biểu mẫu…
    </div>,
    document.body
  );

  if (fetchError || !template) return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <p style={{ color: '#ef4444' }}>Không tải được template biểu mẫu "{submission.formId}".</p>
      <button type="button" className="btn btn-secondary" onClick={onClose}>Đóng</button>
    </div>,
    document.body
  );

  // ── Build valueMap ────────────────────────────────────────────────────────
  const valueMap = new Map<string, string>();
  submission.formData.forEach(s => valueMap.set(s.id, s.value));
  const getVal = (id: string) => valueMap.get(id) ?? '';

  const pageSize = template.pageSize || (template as any).page_size || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';

  const submittedDateStr = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString('vi-VN')
    : '';

  // ─────────────────────────────────────────────────────────────────────────
  return ReactDOM.createPortal(
    <div className="print-container print-doc" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 99999, background: '#ffffff', color: '#000000',
      fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, sans-serif",
      padding: '20px', overflowY: 'auto'
    }}>
      {/* Dynamic CSS — same @page rules as PrintBlankForm */}
      <style>{`
        @media print {
          #root { display: none !important; }
          .print-container {
            position: static !important; width: 100% !important;
            height: auto !important; overflow: visible !important;
            padding: 0 !important; margin: 0 !important;
            box-sizing: border-box !important;
          }
          @page { size: ${isA5 ? 'A5 landscape' : 'A4 portrait'}; margin: ${isA5 ? '8mm 10mm 10mm 10mm' : '12mm 15mm 15mm 15mm'}; }
          ${isA5 ? `.print-doc { gap: 0.4rem !important; } .print-block-avoid { margin-bottom: 0.35rem !important; }` : ''}
          body { background: #ffffff !important; color: #000000 !important; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-block-avoid { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          .print-table {
            table-layout: fixed !important;
            width: 100% !important;
          }
          .print-table tfoot td { background: transparent !important; }
          .print-footer {
            position: fixed; bottom: 0; left: 0; right: 0; height: 20px;
            display: flex !important; align-items: center; justify-content: space-between;
            font-size: 0.75rem; font-family: inherit; color: #475569;
          }
          .print-footer-spacer { height: 20px; display: block; }
        }
      `}</style>

      {/* Preview bar — screen only */}
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: '1rem', borderBottom: '1px solid #cbd5e1', marginBottom: '2rem'
      }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 600 }}>● Filled Record Preview</span>
          <h2 style={{ margin: '2px 0 0', fontSize: '1.15rem' }}>{template.formTitle}</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            Operator: <strong>{submission.operatorId}</strong>&nbsp;|&nbsp;
            Submitted: <strong>{submittedDateStr}</strong>&nbsp;|&nbsp;
            Status: <strong style={{ color: submission.status === 'PASS' ? '#10b981' : '#ef4444' }}>
              {submission.status}
            </strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
            Print Record
          </button>
          <button type="button" className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
            Back
          </button>
        </div>
      </div>

      {/* Outer table wrapper — for native print header/footer support */}
      <table className="print-outer-table">
        <tbody>
          <tr>
            <td>
              {template.layoutBlocks && template.layoutBlocks.map((block, index) => {
                const prevBlock = index > 0 ? template.layoutBlocks[index - 1] : undefined;
                const isSeamless = isSeamlessTableBlock(block, prevBlock);
                return (
                <div
                  key={block.id}
                  className={`print-block${block.type === 'SECTION_LABEL' ? ' print-block--section' : ''}${isSeamless ? ' print-block--seamless-table' : ''} ${block.type !== 'CHECKLIST_TABLE' && block.type !== 'INFO_GRID' && block.type !== 'TABLE' ? 'print-block-avoid' : ''}`}
                >

                  {/* ── SECTION_LABEL ── */}
                  {block.type === 'SECTION_LABEL' && (() => {
                    const titleFmt = getEffectiveTitleFormat(block);
                    if (titleFmt === 'NONE') return null;
                    if (titleFmt === 'H1') return (
                      <div style={{ padding: '0', marginBottom: 'var(--pw-title-gap)', pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                        <h2 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                          {renderFormattedText(block.title)}
                        </h2>
                        {block.description && <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#333333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{renderFormattedText(block.description)}</p>}
                      </div>
                    );
                    if (titleFmt === 'H2') return (
                      <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid #0d9488', marginBottom: 'var(--pw-title-gap)', pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000' }}>{renderFormattedText(block.title)}</h3>
                        {block.description && <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{renderFormattedText(block.description)}</p>}
                      </div>
                    );
                    return (
                      <div style={{ padding: '2px 0', marginBottom: 'var(--pw-title-gap)', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', color: '#000000' }}>{renderFormattedText(block.title)}</div>
                        {block.description && <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#333333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{renderFormattedText(block.description)}</p>}
                      </div>
                    );
                  })()}

                  {/* ── TITLE ── (static layout — no fill data) */}
                  {block.type === 'TITLE' && (
                    block.logo ? (
                      <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', position: 'relative' }}>
                        {logoUrl && (
                          <div style={{ marginRight: '20px', display: 'flex', alignItems: 'center', height: '65px' }}>
                            <img
                              src={logoUrl} alt="Logo"
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
                          <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>{block.description || ''}</p>
                          {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                            <div style={{ marginTop: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                              <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span>{' '}
                              <span style={{ marginLeft: '6px', fontWeight: 600 }}>
                                {submission.submittedAt
                                  ? new Date(submission.submittedAt).toLocaleDateString('vi-VN')
                                  : <span style={{ color: '#94a3b8', letterSpacing: '2px' }}>&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;</span>}
                              </span>
                            </div>
                          )}
                        </div>
                        {block.showDate && block.datePosition === 'A' && (
                          <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
                            <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span>{' '}
                            <span style={{ marginLeft: '6px', fontWeight: 600 }}>
                              {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString('vi-VN') : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '10px 0', textAlign: 'center', position: 'relative' }}>
                        {block.showDate && block.datePosition === 'A' && (
                          <div style={{ position: 'absolute', right: 0, top: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                            <span>Ngày</span>{' '}
                            <span style={{ marginLeft: '6px', fontWeight: 600 }}>
                              {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString('vi-VN') : ''}
                            </span>
                          </div>
                        )}
                        <h1 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: 'var(--pw-weight-banner)', textTransform: 'uppercase', color: '#0d9488' }}>
                          {block.title}
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>{block.description || ''}</p>
                        {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                          <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                            <span>Ngày</span>{' '}
                            <span style={{ marginLeft: '6px', fontWeight: 600 }}>
                              {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString('vi-VN') : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* ── INFO_GRID — with filled values ── */}
                  {block.type === 'INFO_GRID' && (() => {
                    const titleFmt = getEffectiveTitleFormat(block);
                    return (
                      <div style={{ padding: '0' }}>
                        {titleFmt !== 'NONE' && (
                          titleFmt === 'H1' ? (
                            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{renderFormattedText(block.title)}</h2>
                          ) : titleFmt === 'H2' ? (
                            <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid #0d9488', marginBottom: '8px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.92rem', color: '#0f172a' }}>{renderFormattedText(block.title)}</div>
                          ) : (
                            <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '8px', color: '#0f172a' }}>{renderFormattedText(block.title)}</div>
                          )
                        )}
                        <div className="print-info-grid" style={{ gridTemplateColumns: getInfoGridTemplateColumns(block) }}>
                          {block.fields.map((f) => {
                            const cleanLabel = sanitizeLabel(f.checkItem);
                            const val = getVal(f.id);
                            const parsedRSpan = f.type === 'subtable' ? undefined : (f.rowSpan ? Number(f.rowSpan) : undefined);
                            const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
                            const cSpan = f.type === 'subtable' ? -1 : (f.colSpan ? Number(f.colSpan) : undefined);
                            const gridItemStyle: React.CSSProperties = {
                              gridRow: rSpan ? `span ${rSpan}` : undefined,
                              gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                              alignSelf: f.type === 'photo' ? 'stretch' : 'start',
                            };

                            if (f.type === 'label') {
                              return (
                                <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', fontSize: '0.82rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', pageBreakInside: 'avoid', lineHeight: 1.5 }}>
                                  <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a' }}>{renderFormattedText(cleanLabel)}</span>
                                </div>
                              );
                            }

                            if (f.type === 'likert_scale' || f.type === 'rating') {
                              const isStars = f.likertVariant === 'stars' || f.type === 'rating';
                              if (isStars) {
                                const scale = f.ratingScale === 3 ? 3 : 5;
                                const currentRating = parseInt(val, 10) || 0;
                                return (
                                  <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', pageBreakInside: 'avoid' }}>
                                    {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a' }}>{renderFormattedText(cleanLabel)}</span>}
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

                              const scales = f.scaleOptions && f.scaleOptions.length > 0 ? f.scaleOptions : ['1', '2', '3', '4', '5'];
                              return (
                                <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem', pageBreakInside: 'avoid' }}>
                                  {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a' }}>{renderFormattedText(cleanLabel)}</span>}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', minHeight: '22px', paddingTop: '2px' }}>
                                    {scales.map((opt: string, idx: number) => {
                                      const isSelected = val === opt;
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

                            if (f.type === 'photo') {
                              const singleUrl = imageUrls[0];
                              return (
                                <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', width: '100%', pageBreakInside: 'avoid' }}>
                                  {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', fontSize: '0.82rem', marginBottom: '4px' }}>{renderFormattedText(cleanLabel)}</span>}
                                  <div style={{ flex: 1, width: '100%', border: '1px solid #cbd5e1', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px', padding: '4px', boxSizing: 'border-box', background: '#f8fafc' }}>
                                    {singleUrl ? (
                                      <img src={singleUrl} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>(Không có ảnh đính kèm)</span>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            if (f.type === 'checkbox' || f.type === 'radio') {
                              const options = f.options ?? [{ label: 'Có', value: 'YES' }, { label: 'Không', value: 'NO' }];
                              const layoutMode = getAutoCheckboxLayoutMode(f, block.columns);
                              const isLongOpt = hasLongOptions(f);

                              if (layoutMode === 'OPTION_C') {
                                return (
                                  <div key={f.id} style={{ ...gridItemStyle, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.82rem' }}>
                                    {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a' }}>{renderFormattedText(cleanLabel)}</span>}
                                    <div style={{
                                      display: 'flex',
                                      flexDirection: isLongOpt ? 'column' : 'row',
                                      flexWrap: isLongOpt ? 'nowrap' : 'wrap',
                                      gap: isLongOpt ? '4px' : '4px 20px',
                                      paddingLeft: '1.25rem',
                                      alignItems: isLongOpt ? 'flex-start' : 'center'
                                    }}>
                                      {options.map((opt: any) => {
                                        const selected = isOptionSelected(val, opt.value, f.type as 'radio' | 'checkbox');
                                        return (
                                          <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }}>
                                            <span style={{
                                              display: 'inline-block', width: '13px', height: '13px',
                                              border: '1px solid #000000',
                                              background: selected ? '#000000' : '#ffffff',
                                              borderRadius: f.type === 'radio' ? '50%' : '2px', flexShrink: 0,
                                              color: '#ffffff', fontSize: '10px', lineHeight: '13px', textAlign: 'center',
                                              marginTop: isLongOpt ? '2px' : '0'
                                            }}>
                                              {selected ? '✓' : ''}
                                            </span>
                                            <span style={{ lineHeight: '1.3' }}>{opt.label}</span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={f.id} style={{
                                  ...gridItemStyle,
                                  display: 'grid',
                                  gridTemplateColumns: block.columns === 1 ? 'auto 1fr' : '35% 65%',
                                  gap: '8px 20px',
                                  alignItems: 'center',
                                  minHeight: 'var(--pw-line-h)',
                                  fontSize: '0.82rem'
                                }}>
                                  {cleanLabel && (
                                    <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', lineHeight: 1.4, whiteSpace: block.columns === 1 ? 'nowrap' : 'normal' }}>
                                      {renderFormattedText(cleanLabel)}
                                    </span>
                                  )}
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', alignItems: 'center', maxWidth: '100%' }}>
                                    {options.map((opt: any) => {
                                      const selected = isOptionSelected(val, opt.value, f.type as 'radio' | 'checkbox');
                                      return (
                                        <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }}>
                                          <span style={{
                                            display: 'inline-block', width: '13px', height: '13px',
                                            border: '1px solid #000000',
                                            background: selected ? '#000000' : '#ffffff',
                                            borderRadius: f.type === 'radio' ? '50%' : '2px', flexShrink: 0,
                                            color: '#ffffff', fontSize: '10px', lineHeight: '13px', textAlign: 'center'
                                          }}>
                                            {selected ? '✓' : ''}
                                          </span>
                                          <span style={{ lineHeight: '1.3' }}>{opt.label}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            if (f.type === 'subtable') {
                              const cols = f.subtableColumns ?? [];
                              let rows: any[] = [];
                              try { rows = JSON.parse(val || '[]'); } catch { /* fallback to blank rows */ }
                              const renderRows = rows.length > 0 ? rows : Array.from({ length: f.subtableDefaultRows ?? 3 }).map(() => ({}));
                              return (
                                <div key={f.id} className="subtable-print-container print-field-full" style={{ ...gridItemStyle, fontSize: '0.82rem', width: '100%', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  {cleanLabel && <div style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', marginBottom: '6px' }}>{renderFormattedText(cleanLabel)}</div>}
                                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                      <tr>
                                        {cols.map((col: any) => {
                                          const hAlign = col.align || (col.type === 'number' ? 'right' : col.type === 'date' || col.type === 'time' ? 'center' : 'left');
                                          return <th key={col.id} style={{ border: '1px solid #cbd5e1', padding: '5px 6px', background: '#f8fafc', fontWeight: 'var(--pw-weight-medium)', color: '#475569', textAlign: hAlign as any, fontSize: '0.78rem', width: col.width }}>{col.label}</th>;
                                        })}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {renderRows.map((row: any, rowIdx: number) => (
                                        <tr key={rowIdx}>
                                          {cols.map((col: any) => {
                                            const cAlign = col.align || (col.type === 'number' ? 'right' : col.type === 'date' || col.type === 'time' ? 'center' : 'left');
                                            if (col.type === 'static_text') {
                                              return <td key={col.id} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', height: '28px', textAlign: cAlign as any, fontWeight: 'var(--pw-weight-regular)', fontSize: '0.8rem', color: '#0f172a' }}>{f.subtableStaticData?.[rowIdx]?.[col.id] || ''}</td>;
                                            }
                                            const cellVal = row[col.id] ?? '';
                                            return <td key={col.id} style={{ border: '1px solid #cbd5e1', padding: '4px 6px', height: '28px', fontSize: '0.8rem', textAlign: cAlign as any }}>{cellVal}</td>;
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            }

                            // date / time / text / number — render value with underline line preserved
                            if (f.type === 'date') {
                              return (
                                <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', minHeight: 'var(--pw-line-h)', gap: '8px', fontSize: '0.85rem' }}>
                                  {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{renderFormattedText(cleanLabel)}</span>}
                                  <span style={{ fontWeight: 600, color: '#0f172a', minWidth: '80px', borderBottom: '1px dotted #cbd5e1' }}>{val || '\u00A0'}</span>
                                </div>
                              );
                            }

                            if (f.type === 'time') {
                              return (
                                <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', minHeight: 'var(--pw-line-h)', gap: '8px', fontSize: '0.85rem' }}>
                                  {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{renderFormattedText(cleanLabel)}</span>}
                                  <span style={{ fontWeight: 600, color: '#0f172a', minWidth: '60px', borderBottom: '1px dotted #cbd5e1' }}>{val || '\u00A0'}</span>
                                </div>
                              );
                            }

                            // default: text / number
                            return (
                              <div key={f.id} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', minHeight: 'var(--pw-line-h)', gap: '8px', fontSize: '0.85rem' }}>
                                {cleanLabel && <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{renderFormattedText(cleanLabel)}</span>}
                                <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', minHeight: '16px', fontWeight: 600, color: '#0f172a' }}>{val || '\u00A0'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── CHECKLIST_TABLE — with filled values ── */}
                  {block.type === 'CHECKLIST_TABLE' && (() => {
                    const titleFmt = getEffectiveTitleFormat(block);
                    const cols = getChecklistColumns(block);
                    return (
                      <div style={{ marginTop: '0' }}>
                        {titleFmt !== 'NONE' && (
                          titleFmt === 'H1' ? (
                            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{renderFormattedText(block.title)}</h2>
                          ) : titleFmt === 'H2' ? (
                            <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid #0d9488', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.92rem', color: '#000000' }}>{renderFormattedText(block.title)}</div>
                          ) : (
                            <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>{renderFormattedText(block.title)}</div>
                          )
                        )}
                        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              {cols.map(col => (
                                <th key={col.id} style={{ width: col.width, border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: (col.align || (col.id === 'col_stt' ? 'center' : 'left')) as any }}>
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
                              if (matchHeader) { sectionHeader = matchHeader[1]; displayTitle = matchHeader[2]; }

                              const renderRows = [];

                              const prevField = block.fields[idx - 1];
                              const prevMatch = prevField?.checkItem.match(/^\[(.*?)\]/);
                              const prevSection = prevMatch ? prevMatch[1] : '';

                              if (sectionHeader && sectionHeader !== prevSection) {
                                renderRows.push(
                                  <tr key={`sec_${field.id}`} style={{ background: '#f8fafc', pageBreakInside: 'avoid' }}>
                                    <td colSpan={cols.length} style={{ border: '1px solid #000000', padding: '4px 6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.8rem', textTransform: 'uppercase', color: '#1e293b' }}>
                                      {sectionHeader}
                                    </td>
                                  </tr>
                                );
                              }

                              // Get the stored value for this field
                              const fieldVal = getVal(field.id);

                              renderRows.push(
                                <tr key={field.id} style={{ pageBreakInside: 'avoid' }}>
                                  {cols.map(col => {
                                    const commonStyle: React.CSSProperties = {
                                      border: '1px solid #000000', padding: '4px 6px',
                                      fontSize: '0.8rem', verticalAlign: 'middle', height: '28px',
                                      textAlign: (col.align as any) || 'left'
                                    };
                                    if (col.id === 'col_stt') return <td key={col.id} style={{ ...commonStyle, textAlign: 'center', fontWeight: 'var(--pw-weight-regular)' }}>{idx + 1}</td>;
                                    if (col.id === 'col_item') return <td key={col.id} style={commonStyle}><span style={{ fontWeight: 'var(--pw-weight-regular)', display: 'block' }}>{displayTitle}</span></td>;
                                    if (col.id === 'col_unit') return <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>{field.unit || ''}</td>;
                                    if (col.id === 'col_spec') {
                                      let specText = '';
                                      if (field.type === 'number') {
                                        if (field.minSpec !== undefined && field.maxSpec !== undefined) specText = `${field.minSpec} ~ ${field.maxSpec}`;
                                        else if (field.minSpec !== undefined) specText = `>= ${field.minSpec}`;
                                        else if (field.maxSpec !== undefined) specText = `<= ${field.maxSpec}`;
                                      } else { specText = field.targetRange || ''; }
                                      return <td key={col.id} style={commonStyle}>{specText}</td>;
                                    }
                                    if (col.id === 'col_target') {
                                      if (field.type === 'radio' || field.type === 'checkbox') {
                                        const opts = field.options
                                          ?? [{ label: 'Đ', value: 'PASS', isPass: true }, { label: 'KĐ', value: 'FAIL', isPass: false }];
                                        return (
                                          <td key={col.id} style={{ ...commonStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
                                              {opts.map((opt: any) => {
                                                const selected = isOptionSelected(fieldVal, opt.value, field.type as 'radio' | 'checkbox');
                                                return (
                                                  <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                                    <span style={{
                                                      display: 'inline-block', width: '14px', height: '14px',
                                                      border: '1px solid #000000',
                                                      background: selected ? '#000000' : '#ffffff',
                                                      borderRadius: '2px',
                                                      color: '#ffffff', fontSize: '10px', lineHeight: '14px', textAlign: 'center'
                                                    }}>
                                                      {selected ? '✓' : ''}
                                                    </span>
                                                    <span>{opt.label}</span>
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </td>
                                        );
                                      }
                                    }
                                    if (field.type === 'number' || field.type === 'text') {
                                        return <td key={col.id} style={{ ...commonStyle, textAlign: 'center', fontWeight: 600 }}>{fieldVal}</td>;
                                      }
                                      if (col.id === 'col_reaction') {
                                        return <td key={col.id} style={{ ...commonStyle, fontSize: '0.75rem', color: '#1e293b' }}>{fieldVal}</td>;
                                      }
                                      return <td key={col.id} style={commonStyle}>{fieldVal}</td>;
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

                  {/* ── TABLE (dynamic) — reconstruct rows from snapshot ── */}
                  {block.type === 'TABLE' && (() => {
                    const bStyle = block.borderStyle || 'grid';
                    const titleFmt = getEffectiveTitleFormat(block);
                    const tableBorder = bStyle === 'borderless' ? 'none' : bStyle === 'horizontal_only' ? 'none' : '1px solid #000000';
                    const tableBorderTop = isSeamless ? 'none' : (bStyle === 'horizontal_only' ? '1px solid #000000' : undefined);
                    const cellBorder = bStyle === 'borderless' ? 'none' : bStyle === 'horizontal_only' ? 'none' : '1px solid #000000';
                    const cellBorderBottom = bStyle === 'horizontal_only' ? '1px solid #000000' : (bStyle === 'borderless' ? 'none' : '1px solid #000000');
                    const tableCols: TableColumnConfig[] = block.tableColumns || [];
                    const reconstructedRows = buildTableRowMap(block.id, submission.formData, tableCols);
                    // Fall back to template rows (static) if no snapshot rows found
                    const useTemplateRows = reconstructedRows.length === 0;
                    return (
                      <div style={{ marginTop: '0' }}>
                        {titleFmt !== 'NONE' && (
                          titleFmt === 'H1' ? <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{renderFormattedText(block.title)}</h2>
                          : titleFmt === 'H2' ? <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid #0d9488', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.92rem', color: '#000000', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{renderFormattedText(block.title)}</div>
                          : <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{renderFormattedText(block.title)}</div>
                        )}
                        <table
                          className={`print-table ${bStyle === 'borderless' ? 'print-table--borderless' : bStyle === 'horizontal_only' ? 'print-table--horizontal' : ''}`}
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            tableLayout: 'fixed',
                            pageBreakInside: 'auto',
                            border: tableBorder,
                            borderTop: tableBorderTop
                          }}
                        >
                          <colgroup>
                            {tableCols.map(col => {
                              const colWidth = getColStyleWidth(col.id, col.width, tableCols);
                              return <col key={col.id} style={{ width: colWidth }} />;
                            })}
                          </colgroup>
                          {!block.hideHeader && (
                            <thead>
                              <tr style={{ background: bStyle === 'borderless' ? 'transparent' : '#f1f5f9' }}>
                                {tableCols.map(col => {
                                  const colWidth = getColStyleWidth(col.id, col.width, tableCols);
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
                                        textAlign: cellAlign as any,
                                        width: colWidth
                                      }}
                                    >
                                      {col.type === 'likert_scale' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(col.scaleOptions || []).length || 3}, 1fr)`, gap: '4px', textAlign: 'center', width: '100%' }}>
                                          {(col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer']).map((opt, sIdx) => (
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
                          {useTemplateRows ? (() => {
                            const rawRows = block.tableRows || [];
                            if (rawRows.length === 0) {
                              return (
                                <tbody className="print-table-group" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                  <tr><td colSpan={tableCols.length} style={{ border: cellBorder, padding: '8px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>Không có dữ liệu.</td></tr>
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
                                {/* Anchor row: invisible zero-height row so Chrome uses individual
                                    cell widths (not the colSpan group header) when this tbody
                                    starts on a new print page. */}
                                <tr aria-hidden="true" style={{ height: 0, lineHeight: 0, overflow: 'hidden' }}>
                                  {tableCols.map((col) => {
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
                                        background: bStyle === 'borderless' ? 'transparent' : '#f8fafc',
                                        fontWeight: 'var(--pw-weight-regular)',
                                        fontSize: 'var(--pw-font-body)',
                                        lineHeight: 1.45,
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
                                {grp.rows.map(row => (
                                  <tr key={row.id} style={{ pageBreakInside: 'avoid' }}>
                                    {tableCols.map(col => {
                                      const colWidth = getColStyleWidth(col.id, col.width, tableCols);
                                      const hasOptions = col.type === 'checkbox' && col.options && col.options.length > 0;
                                      const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : col.type === 'likert_scale' ? 'center' : 'left'));
                                      const snapKey = `${block.id}_${row.id}_${col.id}`;
                                      const cellVal = getVal(snapKey);
                                      const staticVal = block.tableData?.[row.id]?.[col.id];
                                      const isStaticLabel = (col.type === 'static_text' || col.type === 'text') && staticVal !== undefined && staticVal !== null && staticVal.toString().trim() !== '';
                                      
                                      if (col.type === 'likert_scale') {
                                        const scaleOptions = col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                        return (
                                          <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.82rem', verticalAlign: 'middle', height: '28px', textAlign: 'center', width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scaleOptions.length}, 1fr)`, gap: '4px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                              {scaleOptions.map((opt, sIdx) => {
                                                const isSelected = cellVal === opt;
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
                                          </td>
                                        );
                                      }

                                      if (col.type === 'rating') {
                                        const scale = col.ratingScale === 3 ? 3 : 5;
                                        const currentRating = parseInt(cellVal, 10) || 0;
                                        return (
                                          <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.82rem', verticalAlign: 'middle', height: '28px', textAlign: 'center', width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
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
                                          </td>
                                        );
                                      }

                                      if (col.type === 'radio') {
                                        const customOpts = (block as any).cellOptionsMap?.[row.id]?.[col.id];
                                        const opts = (customOpts && customOpts.length > 0) ? customOpts : (col.options || []);
                                        if (opts.length > 0) {
                                          const isInline = canTableOptionsFitInline(opts, col.width, col.checkboxLayout);
                                          return (
                                            <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.82rem', verticalAlign: 'middle', minHeight: '28px', textAlign: cellAlign as any, width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                              <div style={{
                                                display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                                gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(opts) : undefined,
                                                flexDirection: col.checkboxLayout === '2-column' ? undefined : isInline ? 'row' : 'column',
                                                flexWrap: isInline ? 'wrap' : undefined,
                                                gap: col.checkboxLayout === '2-column' ? '4px 12px' : isInline ? '4px 12px' : '5px',
                                                alignItems: 'center',
                                                justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                                padding: '2px 0',
                                                width: '100%'
                                              }}>
                                                {opts.map((opt: any, oIdx: number) => {
                                                  const isChecked = cellVal === (opt.value || opt.label);
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
                                                      <span style={{ color: isChecked ? '#000000' : '#64748b', lineHeight: 1.3, whiteSpace: isInline ? 'nowrap' : 'pre-wrap', wordBreak: isInline ? 'normal' : 'break-word', flex: isInline ? undefined : 1 }}>{renderFormattedText(opt.label)}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </td>
                                          );
                                        }
                                      }

                                      if (col.type === 'checkbox') {
                                        const customOpts = (block as any).cellOptionsMap?.[row.id]?.[col.id];
                                        const opts = (customOpts && customOpts.length > 0) ? customOpts : (col.options || []);
                                        if (opts.length > 0) {
                                          const isInline = canTableOptionsFitInline(opts, col.width, col.checkboxLayout);
                                          const currentValues = cellVal ? cellVal.split(',').filter(Boolean) : [];
                                          return (
                                            <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.82rem', verticalAlign: 'middle', minHeight: '28px', textAlign: cellAlign as any, width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                              <div style={{
                                                display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                                gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(opts) : undefined,
                                                flexDirection: col.checkboxLayout === '2-column' ? undefined : isInline ? 'row' : 'column',
                                                flexWrap: isInline ? 'wrap' : undefined,
                                                gap: col.checkboxLayout === '2-column' ? '4px 12px' : isInline ? '4px 12px' : '5px',
                                                alignItems: 'center',
                                                justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                                padding: '2px 0',
                                                width: '100%'
                                              }}>
                                                {opts.map((opt: any, oIdx: number) => {
                                                  const isChecked = currentValues.includes(opt.value || opt.label);
                                                  return (
                                                    <div key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#000000', width: isInline ? 'auto' : '100%', whiteSpace: isInline ? 'nowrap' : undefined }}>
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
                                                        marginTop: 0
                                                      }}>
                                                        {isChecked ? '✓' : ''}
                                                      </span>
                                                      <span style={{ color: isChecked ? '#000000' : '#64748b', lineHeight: 1.3, whiteSpace: isInline ? 'nowrap' : 'pre-wrap', wordBreak: isInline ? 'normal' : 'break-word', flex: isInline ? undefined : 1 }}>{renderFormattedText(opt.label)}</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </td>
                                          );
                                        }
                                      }

                                      return (
                                        <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.82rem', verticalAlign: 'middle', minHeight: '28px', textAlign: cellAlign as any, width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                          {isStaticLabel ? (
                                            <span style={{ fontWeight: 'var(--pw-weight-regular)', display: 'block', textAlign: cellAlign as any, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.82rem', lineHeight: 1.4 }}>
                                              {renderFormattedText(staticVal)}
                                            </span>
                                          ) : cellVal}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            ));
                          })() : (
                            <tbody className="print-table-group" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                              {reconstructedRows.map(({ rowId, cells }) => (
                                <tr key={rowId} style={{ pageBreakInside: 'avoid' }}>
                                  {tableCols.map(col => {
                                    const colWidth = getColStyleWidth(col.id, col.width, tableCols);
                                    const hasOptions = col.type === 'checkbox' && col.options && col.options.length > 0;
                                    const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : col.type === 'likert_scale' ? 'center' : 'left'));
                                    const cellVal = cells.get(col.id) ?? '';
                                    // static_text: try to find value from template tableData (static rows only)
                                    const templateRow = (block.tableRows || []).find((r: any) => r.id === rowId);
                                    if (col.type === 'static_text') {
                                      return <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.8rem', verticalAlign: 'middle', height: '28px', textAlign: cellAlign as any, width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                        <span style={{ fontWeight: 'var(--pw-weight-regular)', display: 'block' }}>{templateRow ? (block.tableData?.[rowId]?.[col.id] || '') : cellVal}</span>
                                      </td>;
                                    }
                                    if (col.type === 'likert_scale') {
                                      const scaleOptions = col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                      return (
                                        <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.8rem', verticalAlign: 'middle', height: '28px', textAlign: 'center', width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scaleOptions.length}, 1fr)`, gap: '4px', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                            {scaleOptions.map((opt, sIdx) => {
                                              const isSelected = cellVal === opt;
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
                                        </td>
                                      );
                                    }
                                    if (col.type === 'rating') {
                                      const scale = col.ratingScale === 3 ? 3 : 5;
                                      const currentRating = parseInt(cellVal, 10) || 0;
                                      return (
                                        <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.8rem', verticalAlign: 'middle', height: '28px', textAlign: 'center', width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
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
                                        </td>
                                      );
                                    }
                                    if (col.type === 'radio' && col.options && col.options.length > 0) {
                                      const opts = col.options;
                                      const isInline = canTableOptionsFitInline(opts, col.width, col.checkboxLayout);
                                      return (
                                        <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.82rem', verticalAlign: 'middle', minHeight: '28px', textAlign: cellAlign as any, width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                          <div style={{
                                            display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                            gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(opts) : undefined,
                                            flexDirection: col.checkboxLayout === '2-column' ? undefined : isInline ? 'row' : 'column',
                                            flexWrap: isInline ? 'wrap' : undefined,
                                            gap: col.checkboxLayout === '2-column' ? '4px 12px' : isInline ? '4px 12px' : '5px',
                                            alignItems: 'center',
                                            justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                            padding: '2px 0',
                                            width: '100%'
                                          }}>
                                            {opts.map((opt: any, oIdx: number) => {
                                              const isChecked = cellVal === (opt.value || opt.label);
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
                                        </td>
                                      );
                                    }
                                    if (col.type === 'checkbox' && col.options && col.options.length > 0) {
                                      const opts = col.options;
                                      const isInline = canTableOptionsFitInline(opts, col.width, col.checkboxLayout);
                                      const currentValues = cellVal ? cellVal.split(',').filter(Boolean) : [];
                                      return (
                                        <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.82rem', verticalAlign: 'middle', minHeight: '28px', textAlign: cellAlign as any, width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                          <div style={{
                                            display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                            gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(opts) : undefined,
                                            flexDirection: col.checkboxLayout === '2-column' ? undefined : isInline ? 'row' : 'column',
                                            flexWrap: isInline ? 'wrap' : undefined,
                                            gap: col.checkboxLayout === '2-column' ? '4px 12px' : isInline ? '4px 12px' : '5px',
                                            alignItems: 'center',
                                            justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                            padding: '2px 0',
                                            width: '100%'
                                          }}>
                                            {opts.map((opt: any, oIdx: number) => {
                                              const isChecked = currentValues.includes(opt.value || opt.label);
                                              return (
                                                <div key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#000000', width: isInline ? 'auto' : '100%', whiteSpace: isInline ? 'nowrap' : undefined }}>
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
                                                    marginTop: 0
                                                  }}>
                                                    {isChecked ? '✓' : ''}
                                                  </span>
                                                  <span style={{ color: isChecked ? '#000000' : '#64748b', lineHeight: 1.3, whiteSpace: isInline ? 'nowrap' : 'pre-wrap', wordBreak: isInline ? 'normal' : 'break-word', flex: isInline ? undefined : 1 }}>{opt.label}</span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </td>
                                      );
                                    }
                                    return (
                                      <td key={col.id} style={{ border: cellBorder, borderBottom: cellBorderBottom, padding: '4px 6px', fontSize: '0.8rem', verticalAlign: 'middle', minHeight: '28px', textAlign: cellAlign as any, width: colWidth, maxWidth: colWidth, boxSizing: 'border-box' }}>
                                        <span style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: cellAlign as any }}>{cellVal}</span>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          )}
                          {/* Summary footer rows — labels from template, values blank (not stored in snapshot) */}
                          {(() => {
                            const columns = block.tableColumns || [];
                            const summaryTypes: { id: string; label: string }[] = [];
                            const columnsWithSummaries: { col: any; colIdx: number }[] = [];
                            columns.forEach((col: any, colIdx: number) => {
                              if (col.type === 'number' && col.summaryRows && col.summaryRows.length > 0) {
                                col.summaryRows.forEach((row: any) => {
                                  if (!summaryTypes.some(s => s.label === row.label)) summaryTypes.push({ id: row.id, label: row.label || 'Cộng:' });
                                });
                                columnsWithSummaries.push({ col, colIdx });
                              }
                            });
                            if (columnsWithSummaries.length === 0) return null;
                            const firstSumColIdx = Math.min(...columnsWithSummaries.map(c => c.colIdx));
                            return (
                              <tfoot>
                                {summaryTypes.map((sumType, idx) => (
                                  <tr key={sumType.id || idx} style={{ background: '#ffffff', fontWeight: 'var(--pw-weight-heavy)' }}>
                                    {firstSumColIdx > 0 && <td colSpan={firstSumColIdx} style={{ border: '1px solid #000000', padding: '5px 8px', textAlign: 'right', fontSize: '0.82rem' }}>{sumType.label}</td>}
                                    {columns.slice(firstSumColIdx).map((col: any, offsetIdx: number) => {
                                      const isLabelColIfFirst = firstSumColIdx + offsetIdx === 0 && firstSumColIdx === 0;
                                      return <td key={col.id} style={{ border: '1px solid #000000', padding: '5px 8px', textAlign: 'right', fontSize: '0.82rem' }}>{isLabelColIfFirst ? sumType.label : ''}</td>;
                                    })}
                                  </tr>
                                ))}
                              </tfoot>
                            );
                          })()}
                        </table>
                      </div>
                    );
                  })()}

                  {/* ── MATRIX_TABLE — with filled cells ── */}
                  {block.type === 'MATRIX_TABLE' && block.matrixConfig && (() => {
                    const titleFmt = getEffectiveTitleFormat(block);
                    const cfg = block.matrixConfig;
                    // Build cell and note maps from valueMap
                    const cellMap: { [r: number]: { [c: number]: string } } = {};
                    const noteMap: { [r: number]: string } = {};
                    const prefix = block.id + '_row_';
                    submission.formData.forEach(s => {
                      if (!s.id.startsWith(prefix)) return;
                      const rest = s.id.slice(prefix.length);
                      const colMatch = rest.match(/^(\d+)_col_(\d+)$/);
                      if (colMatch) {
                        const r = parseInt(colMatch[1], 10), c = parseInt(colMatch[2], 10);
                        if (!cellMap[r]) cellMap[r] = {};
                        cellMap[r][c] = s.value;
                        return;
                      }
                      const noteMatch = rest.match(/^(\d+)_note$/);
                      if (noteMatch) { noteMap[parseInt(noteMatch[1], 10)] = s.value; }
                    });
                    const rowCount = cfg.rowCount;
                    return (
                      <div style={{ marginTop: '0' }}>
                        {titleFmt !== 'NONE' && (
                          titleFmt === 'H1' ? <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{renderFormattedText(block.title)}</h2>
                          : titleFmt === 'H2' ? <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid #0d9488', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.92rem', color: '#000000' }}>{renderFormattedText(block.title)}</div>
                          : <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>{renderFormattedText(block.title)}</div>
                        )}
                        <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th rowSpan={2} style={{ width: '50px', border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'center' }}>{cfg.rowHeader}</th>
                              <th colSpan={cfg.columns.length} style={{ border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'center' }}>{cfg.columnHeader}</th>
                              {cfg.showTotalColumn && <th rowSpan={2} style={{ width: '130px', border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'center' }}>{cfg.totalColumnHeader}</th>}
                              {cfg.showNotesColumn && <th rowSpan={2} style={{ width: '180px', border: '1px solid #000000', padding: '6px', background: '#f1f5f9', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.82rem', color: '#000000', textAlign: 'left' }}>{cfg.notesColumnHeader}</th>}
                            </tr>
                            <tr>
                              {cfg.columns.map((colName: string, cIdx: number) => (
                                <th key={cIdx} style={{ border: '1px solid #000000', padding: '4px', background: '#f8fafc', fontWeight: 'var(--pw-weight-medium)', fontSize: '0.75rem', textAlign: cfg.columnAlign || 'center' }}>
                                  {colName || `Cột ${cIdx + 1}`}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: rowCount }).map((_, rIdx) => (
                              <tr key={rIdx} style={{ pageBreakInside: 'avoid' }}>
                                <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'var(--pw-weight-regular)' }}>{rIdx + 1}</td>
                                {cfg.columns.map((_: any, cIdx: number) => (
                                  <td key={cIdx} style={{ border: '1px solid #000000', padding: '4px 6px', height: '28px', fontSize: '0.8rem', textAlign: cfg.columnAlign || 'center' }}>
                                    {cellMap[rIdx]?.[cIdx] ?? ''}
                                  </td>
                                ))}
                                {cfg.showTotalColumn && <td style={{ border: '1px solid #000000', padding: '4px 6px', height: '28px' }} />}
                                {cfg.showNotesColumn && <td style={{ border: '1px solid #000000', padding: '4px 6px', height: '28px', fontSize: '0.8rem' }}>{noteMap[rIdx] ?? ''}</td>}
                              </tr>
                            ))}
                            {/* TỔNG row — always blank (totals are computed, not stored in snapshot) */}
                            <tr style={{ background: '#f8fafc', fontWeight: 'var(--pw-weight-heavy)', pageBreakInside: 'avoid' }}>
                              <td style={{ border: '1px solid #000000', padding: '4px 6px', textAlign: 'center', fontSize: '0.8rem' }}>TỔNG</td>
                              {cfg.columns.map((_: any, cIdx: number) => <td key={cIdx} style={{ border: '1px solid #000000', padding: '4px 6px', height: '28px' }} />)}
                              {cfg.showTotalColumn && <td style={{ border: '1px solid #000000', padding: '4px 6px', height: '28px' }} />}
                              {cfg.showNotesColumn && <td style={{ border: '1px solid #000000', padding: '4px 6px', height: '28px' }} />}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* ── SIGN — with filled signature ── */}
                  {block.type === 'SIGN' && (() => {
                    const titleFmt = getEffectiveTitleFormat(block);
                    return (
                      <div style={{ marginTop: '0' }}>
                        {titleFmt !== 'NONE' && (
                          titleFmt === 'H1' ? <h2 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{renderFormattedText(block.title)}</h2>
                          : titleFmt === 'H2' ? <div style={{ padding: '2px 0 2px 8px', background: 'transparent', borderLeft: '3px solid #0d9488', marginBottom: '6px', fontWeight: 'var(--pw-weight-heavy)', fontSize: '0.92rem', color: '#000000' }}>{renderFormattedText(block.title)}</div>
                          : <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', marginBottom: '6px', color: '#000000' }}>{renderFormattedText(block.title)}</div>
                        )}
                        <div style={{ paddingTop: '5px', marginTop: 'var(--pw-block-gap)', display: 'grid', gridTemplateColumns: `repeat(${block.columns || 2}, 1fr)`, gap: '20px' }}>
                          {block.fields.map(f => {
                            const isBlank = !f.checkItem || f.checkItem.trim() === '';
                            const signVal = getVal(f.id);
                            const { name: signerName, timestamp: signedAt } = parseSignature(signVal);
                            return (
                              <div key={f.id} style={{ height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: '4px', visibility: isBlank ? 'hidden' : 'visible' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-heavy)', textAlign: 'center' }}>{f.checkItem}</span>
                                {signVal ? (
                                  <>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', marginTop: '8px', color: '#0f172a' }}>{signerName}</span>
                                    {signedAt && <span style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#475569', textAlign: 'center' }}>{signedAt}</span>}
                                  </>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#94a3b8', textAlign: 'center', marginTop: '12px' }}>
                                    {f.reactionProtocol ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`) : '(Chưa ký)'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Supervisor sign-off badge */}
                        {submission.supervisorSignoff && (
                          <div style={{ marginTop: '12px', padding: '6px 10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px', fontSize: '0.78rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>✓</span>
                            <span>
                              Đã xác nhận bởi <strong>{submission.supervisorSignoff.signedBy}</strong>
                              {submission.supervisorSignoff.signedAt && ` — ${new Date(submission.supervisorSignoff.signedAt).toLocaleString('vi-VN')}`}
                              {submission.supervisorSignoff.notes && ` | Ghi chú: ${submission.supervisorSignoff.notes}`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              );
            })}

              {/* ── Photo Evidence Section ── */}
              {imageUrls.length > 0 && (
                <div className="print-block print-block-avoid" style={{ marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 8px 0', textTransform: 'uppercase', borderBottom: '1px solid #000000', paddingBottom: '4px', color: '#000000' }}>
                    Ảnh bằng chứng
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {imageUrls.map((url, i) => (
                      <img
                        key={i} src={url}
                        alt={`Evidence ${i + 1}`}
                        style={{ maxWidth: '45%', maxHeight: '200px', objectFit: 'contain', border: '1px solid #cbd5e1' }}
                      />
                    ))}
                  </div>
                </div>
              )}

            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr><td><div className="print-footer-spacer" /></td></tr>
        </tfoot>
      </table>

      <div className="print-footer">
        <span>{template.formId || submission.formId}</span>
        <span>{formatFormVersion(
          template.version || 'v0.1',
          template.status,
          template.effectiveDate || (template as any).effective_date,
          template.updatedAt || (template as any).updated_at
        )}</span>
      </div>
    </div>,
    document.body
  );
}
