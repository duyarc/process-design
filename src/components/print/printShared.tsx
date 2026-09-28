import React from 'react';
import type { FormTemplateISO, LayoutBlockISO, ReportBlockConfig } from '../../types';
import { formatFormVersion } from '../../types';
import { getEffectiveTitleFormat } from '../../utils/formUtils';
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
  onImgSettled: () => void;
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
