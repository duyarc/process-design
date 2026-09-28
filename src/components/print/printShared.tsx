import React from 'react';
import type { FormTemplateISO, LayoutBlockISO, ReportBlockConfig, FormFieldISO } from '../../types';
import { formatFormVersion } from '../../types';
import {
  getEffectiveTitleFormat,
  sanitizeLabel,
  getAutoCheckboxLayoutMode,
  hasLongOptions,
  isOptionSelected,
  isOtherValue,
  extractOtherText,
  formatOptionDisplay
} from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';

/**
 * Shared hook to resolve logo image (inline base64 or direct URL) before printing/exporting.
 * Used by PrintBlankForm, PrintFilledForm, and PrintScoring.
 */
export function usePrintLogo(logoKey?: string): {
  logoUrl: string;
  imgLoaded: boolean;
  setImgLoaded: React.Dispatch<React.SetStateAction<boolean>>;
} {
  const [logoUrl, setLogoUrl] = React.useState<string>('');
  const [imgLoaded, setImgLoaded] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!logoKey) {
      setLogoUrl('');
      setImgLoaded(true);
      return;
    }
    if (logoKey.startsWith('uploads/')) {
      fetch(`/api/storage/download-inline?key=${encodeURIComponent(logoKey)}`)
        .then(res => res.json())
        .then(data => {
          if (data.dataUrl) {
            setLogoUrl(data.dataUrl);
          } else {
            setImgLoaded(true);
          }
        })
        .catch(err => {
          console.error('Error fetching inline logo for print:', err);
          setImgLoaded(true);
        });
    } else {
      setLogoUrl(logoKey);
    }
  }, [logoKey]);

  return { logoUrl, imgLoaded, setImgLoaded };
}

/**
 * Shared @media print document styles for PrintBlankForm, PrintFilledForm, and PrintScoring.
 */
export function PrintDocumentStyles({ isA5 }: { isA5: boolean }) {
  return (
    <style>{`
      @media print {
        *, *::before, *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
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
        .print-table {
          table-layout: fixed !important;
          width: 100% !important;
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
  );
}

/**
 * Shared TITLE block renderer for PrintBlankForm, PrintFilledForm, and PrintScoring.
 */
export function PrintTitleBlock({
  block,
  logoUrl,
  onImgSettled,
  dateValueNode
}: {
  block: LayoutBlockISO | ReportBlockConfig | any;
  logoUrl: string;
  onImgSettled?: () => void;
  dateValueNode?: React.ReactNode;
}) {
  const defaultDateBlank = (
    <span style={{ marginLeft: '6px', color: '#475569', letterSpacing: '2px' }}>
      &nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;
    </span>
  );
  const dateNode = dateValueNode ?? defaultDateBlank;

  if (block.logo) {
    return (
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
              onLoad={onImgSettled}
              onError={onImgSettled}
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
              <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> {dateNode}
            </div>
          )}
        </div>
        {block.showDate && block.datePosition === 'A' && (
          <div style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', marginLeft: '10px', alignSelf: 'flex-start', paddingTop: '4px' }}>
            <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> {dateNode}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 0',
      textAlign: 'center',
      position: 'relative'
    }}>
      {block.showDate && block.datePosition === 'A' && (
        <div style={{ position: 'absolute', right: 0, top: '10px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> {dateNode}
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
          <span style={{ fontWeight: 'var(--pw-weight-regular)' }}>Ngày</span> {dateNode}
        </div>
      )}
    </div>
  );
}

/**
 * Shared SECTION_LABEL / Block Header renderer (H1, H2, BODY) with optional top-right badge slot.
 * Used across PrintBlankForm, PrintFilledForm, and PrintScoring.
 */
export function PrintSectionHeader({
  block,
  rightBadge,
  marginBottom = 'var(--pw-title-gap)',
  showDescription = false
}: {
  block: LayoutBlockISO | ReportBlockConfig | any;
  rightBadge?: React.ReactNode;
  marginBottom?: string;
  showDescription?: boolean;
}) {
  const titleFmt = getEffectiveTitleFormat(block);
  if (titleFmt === 'NONE') {
    if (!rightBadge) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '2px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
        {rightBadge}
      </div>
    );
  }

  if (titleFmt === 'H1') {
    return (
      <div style={{
        padding: '0',
        marginBottom,
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        pageBreakAfter: 'avoid',
        breakAfter: 'avoid'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <h2 style={{
            margin: '0 0 4px 0',
            fontSize: '1.1rem',
            fontWeight: 'var(--pw-weight-heavy)',
            color: '#000000',
            textTransform: 'uppercase',
            letterSpacing: '0.6px'
          }}>
            {renderFormattedText(block.title)}
          </h2>
          {rightBadge}
        </div>
        {showDescription && block.description && (
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#333333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {renderFormattedText(block.description)}
          </p>
        )}
      </div>
    );
  }

  if (titleFmt === 'H2') {
    return (
      <div style={{
        padding: '2px 0 2px 8px',
        background: 'transparent',
        borderLeft: '3px solid #0d9488',
        borderRadius: '0px',
        marginBottom,
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        pageBreakAfter: 'avoid',
        breakAfter: 'avoid'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 'var(--pw-weight-heavy)', color: '#000000' }}>
            {renderFormattedText(block.title)}
          </h3>
          {rightBadge}
        </div>
        {showDescription && block.description && (
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {renderFormattedText(block.description)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '2px 0', marginBottom, pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 'var(--pw-weight-medium)', color: '#000000' }}>
          {renderFormattedText(block.title)}
        </div>
        {rightBadge}
      </div>
      {showDescription && block.description && (
        <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#333333', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {renderFormattedText(block.description)}
        </p>
      )}
    </div>
  );
}

/**
 * Shared fixed print page footer (formId on left, formatted version on right).
 */
export function PrintPageFooter({ template, leftLabel }: { template: FormTemplateISO; leftLabel?: string }) {
  const resolvedLeft = leftLabel || (template as any).formId || (template as any).form_id || (template as any).formName || (template as any).id || 'N/A';
  const resolvedRight = formatFormVersion(
    template.version || (template as any).rawRecord?.version || 'v0.1',
    template.status,
    template.effectiveDate || (template as any).effective_date,
    template.updatedAt || (template as any).updated_at
  );
  return (
    <div className="print-footer">
      <span>{resolvedLeft}</span>
      <span>{resolvedRight}</span>
    </div>
  );
}

/**
 * Shared Type-Aware Field Renderer for INFO_GRID blocks.
 * Used by both PrintReport (PDF/Print) and FormReport (Screen View) ensuring 100% WYSIWYG consistency.
 */
export function renderReportField(
  fid: string,
  block: any,
  allFormFields: FormFieldISO[],
  getFieldValue: (id: string) => string
): React.ReactNode {
  const field = allFormFields.find(f => f.id === fid);
  const override = block.ruleOverrides?.[fid];
  const isLabelHidden = !!override?.hideLabel;
  const displayLabel = override?.customLabel !== undefined
    ? override.customLabel
    : (field?.checkItem || fid);
  const cleanLabel = sanitizeLabel(displayLabel);
  const val = getFieldValue(fid);

  const parsedRSpan = field?.type === 'subtable' ? undefined : (field?.rowSpan ? Number(field.rowSpan) : undefined);
  const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
  const cSpan = field?.type === 'subtable' ? -1 : (field?.colSpan ? Number(field.colSpan) : undefined);
  const gridItemStyle: React.CSSProperties = {
    gridRow: rSpan ? `span ${rSpan}` : undefined,
    gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
    alignSelf: field?.type === 'photo' ? 'stretch' : 'start',
  };

  if (field?.type === 'checkbox' || field?.type === 'radio') {
    const options = field.options ?? [{ label: 'Có', value: 'YES' }, { label: 'Không', value: 'NO' }];
    const layoutMode = getAutoCheckboxLayoutMode(field, block.columns || 2);
    const isLongOpt = hasLongOptions(field);
    const isOptionC = layoutMode === 'OPTION_C';

    return (
      <div key={fid} style={{
        ...gridItemStyle,
        display: isOptionC ? 'flex' : 'grid',
        flexDirection: isOptionC ? 'column' : undefined,
        gridTemplateColumns: !isOptionC ? ((block.columns || 2) === 1 ? 'auto 1fr' : '35% 65%') : undefined,
        gap: isOptionC ? '4px' : '8px 20px',
        alignItems: isOptionC ? undefined : 'center',
        minHeight: 'var(--pw-line-h)',
        fontSize: '0.82rem'
      }}>
        {!isLabelHidden && cleanLabel && (
          <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', lineHeight: 1.4, whiteSpace: !isOptionC && (block.columns || 2) === 1 ? 'nowrap' : 'normal' }}>
            {renderFormattedText(cleanLabel)}
          </span>
        )}
        <div style={{
          display: 'flex',
          flexDirection: isOptionC && isLongOpt ? 'column' : 'row',
          flexWrap: isOptionC && isLongOpt ? 'nowrap' : 'wrap',
          gap: isOptionC ? (isLongOpt ? '4px' : '4px 20px') : '4px 20px',
          paddingLeft: isOptionC ? (isLabelHidden ? '0' : '1.25rem') : '0',
          alignItems: isOptionC && isLongOpt ? 'flex-start' : 'center',
          maxWidth: '100%'
        }}>
          {options.map((opt: any) => {
            const selected = isOptionSelected(val, opt.value, field.type as 'radio' | 'checkbox') ||
                             isOptionSelected(val, opt.label, field.type as 'radio' | 'checkbox');
            const isOther = opt.isOther || opt.value === '__other__';
            const otherText = isOther && selected ? extractOtherText(val) : '';
            return (
              <span key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '100%' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '13px',
                  height: '13px',
                  border: '1.2px solid #000000',
                  background: '#ffffff',
                  borderRadius: field.type === 'radio' ? '50%' : '2px',
                  flexShrink: 0,
                  color: '#000000',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  lineHeight: 1,
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}>
                  {selected ? '✓' : ''}
                </span>
                <span style={{ lineHeight: '1.3' }}>
                  {opt.label}
                  {isOther && selected && otherText && (
                    <span style={{ fontWeight: 600, textDecoration: 'underline', marginLeft: '4px' }}>
                      {opt.label.trim().endsWith(':') ? otherText : `: ${otherText}`}
                    </span>
                  )}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (field?.type === 'select') {
    const displayVal = formatOptionDisplay(val, field.options);
    return (
      <div key={fid} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', minHeight: 'var(--pw-line-h)', gap: '8px', fontSize: '0.85rem' }}>
        {!isLabelHidden && cleanLabel && (
          <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
            {renderFormattedText(cleanLabel)}:
          </span>
        )}
        <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', minHeight: '16px', fontWeight: 600, color: '#0f172a' }}>
          {displayVal && displayVal !== '—' ? renderFormattedText(displayVal) : '\u00A0'}
        </div>
      </div>
    );
  }

  if (field?.type === 'date' || field?.type === 'time') {
    return (
      <div key={fid} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', minHeight: 'var(--pw-line-h)', gap: '8px', fontSize: '0.85rem' }}>
        {!isLabelHidden && cleanLabel && (
          <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
            {renderFormattedText(cleanLabel)}:
          </span>
        )}
        <span style={{ fontWeight: 600, color: '#0f172a', minWidth: field.type === 'time' ? '60px' : '80px', borderBottom: '1px dotted #cbd5e1' }}>
          {val && val !== '—' ? val : '\u00A0'}
        </span>
      </div>
    );
  }

  const displayVal = isOtherValue(val) ? formatOptionDisplay(val, field?.options) : val;
  return (
    <div key={fid} style={{ ...gridItemStyle, display: 'flex', alignItems: 'center', minHeight: 'var(--pw-line-h)', gap: '8px', fontSize: '0.85rem' }}>
      {!isLabelHidden && cleanLabel && (
        <span style={{ fontWeight: 'var(--pw-weight-regular)', color: '#0f172a', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
          {renderFormattedText(cleanLabel)}:
        </span>
      )}
      <div style={{ flex: 1, borderBottom: '1px dotted #cbd5e1', minHeight: '16px', fontWeight: 600, color: '#0f172a' }}>
        {displayVal && displayVal !== '—' ? renderFormattedText(displayVal) : '\u00A0'}
      </div>
    </div>
  );
}
