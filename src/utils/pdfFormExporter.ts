import { formatFormVersion, type FormTemplateISO } from '../types';
import { getPdfPageConfig, scanDomAcroFields } from './pdf/domScanner';
import { generatePdfBackgroundCanvas } from './pdf/backgroundGenerator';
import { overlayAcroFormFields } from './pdf/acroFormOverlay';
import { triggerBrowserDownload } from './pdf/downloadHelper';

/**
 * Clean Facade Entry Point for Exporting Fillable PDF from HTML DOM
 */
export async function exportFillablePdfFromDOM(
  containerEl: HTMLElement,
  template: FormTemplateISO
): Promise<void> {
  try {
    const rawPageSize = template.pageSize || (template as unknown as Record<string, unknown>).page_size || 'A4';
    const pageSizeStr = typeof rawPageSize === 'string' ? rawPageSize : 'A4';
    const config = getPdfPageConfig(pageSizeStr);

    // Target the inner printable table or container
    const targetEl = containerEl.querySelector<HTMLElement>('.print-outer-table') || containerEl;

    // 1. Scan DOM elements and compute smart page break boundaries WHILE targetEl is constrained to targetWidthPx (697.7px)
    const { scannedFields, pageBreaks, restoreStyles } = scanDomAcroFields(targetEl, config);

    // Prepare vector footer info (DocCode and formatted Version)
    const leftText = (template as any).formId || (template as any).form_id || (template as any).formName || (template as any).id || '';
    const rightText = formatFormVersion(
      template.version || (template as any).rawRecord?.version || 'v0.1',
      template.status,
      template.effectiveDate || (template as any).effective_date,
      template.updatedAt || (template as any).updated_at
    );
    const footerInfo = { leftText, rightText };

    try {
      // 2. Capture background PDF canvas via html2canvas & jsPDF with smart pagination and vector footer
      const backgroundPdfBuffer = await generatePdfBackgroundCanvas(targetEl, config, pageBreaks, footerInfo);

      // 3. Overlay interactive AcroForm fields via pdf-lib aligned to smart page boundaries
      const finalPdfBytes = await overlayAcroFormFields(backgroundPdfBuffer, scannedFields, config, pageBreaks);

      // 4. Trigger browser download with 5S filename
      triggerBrowserDownload(finalPdfBytes, template.formTitle || 'ISO_Document');
    } finally {
      // Always restore DOM styles
      restoreStyles();
    }
  } catch (error) {
    console.error('Error exporting Fillable PDF:', error);
    throw error;
  }
}
