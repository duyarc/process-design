import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { FormTemplateISO } from '../types';
import { to5SFileName } from './formUtils';

export async function exportFillablePdfFromDOM(
  containerEl: HTMLElement,
  template: FormTemplateISO
): Promise<void> {
  try {
    const pageSize = template.pageSize || (template as unknown as Record<string, unknown>).page_size || 'A4';
    const isA5 = pageSize === 'A5_LANDSCAPE';

    // Target the inner printable table if available, or the container
    const targetEl = containerEl.querySelector<HTMLElement>('.print-outer-table') || containerEl;

    // Save original inline styles to restore after capture
    const originalWidth = targetEl.style.width;
    const originalMaxWidth = targetEl.style.maxWidth;
    const originalPadding = targetEl.style.padding;
    const originalBoxSizing = targetEl.style.boxSizing;
    const originalBg = targetEl.style.background;

    // ISO 216 Dimensions at 96 DPI:
    // A4 Portrait: 210mm = 793.7px wide. Padding matches @page margin (12mm top/bottom, 15mm left/right -> 45px 56px)
    // A5 Landscape: 210mm = 793.7px wide
    const targetWidthPx = 793.7;

    targetEl.style.width = `${targetWidthPx}px`;
    targetEl.style.maxWidth = `${targetWidthPx}px`;
    targetEl.style.padding = isA5 ? '30px 38px' : '45px 56px';
    targetEl.style.boxSizing = 'border-box';
    targetEl.style.background = '#ffffff';

    // 1. Capture HTML DOM to canvas using html2canvas at exact A4 width
    const canvas = await html2canvas(targetEl, {
      scale: 2, // 300 DPI high resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: targetWidthPx,
      windowWidth: targetWidthPx,
    });

    // Restore original styles immediately
    targetEl.style.width = originalWidth;
    targetEl.style.maxWidth = originalMaxWidth;
    targetEl.style.padding = originalPadding;
    targetEl.style.boxSizing = originalBoxSizing;
    targetEl.style.background = originalBg;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // 2. Generate background PDF using jsPDF
    const pdfJs = new jsPDF({
      orientation: isA5 ? 'landscape' : 'portrait',
      unit: 'pt',
      format: isA5 ? 'a5' : 'a4',
    });

    const pdfPageWidth = pdfJs.internal.pageSize.getWidth();   // 595.28 pt for A4
    const pdfPageHeight = pdfJs.internal.pageSize.getHeight(); // 841.89 pt for A4

    // Scale canvas image onto PDF page(s)
    const imgWidth = pdfPageWidth;
    const imgHeight = (canvas.height * pdfPageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdfJs.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfPageHeight;

    while (heightLeft > 5) {
      position = heightLeft - imgHeight;
      pdfJs.addPage();
      pdfJs.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfPageHeight;
    }

    const pdfArrayBuffer = pdfJs.output('arraybuffer');

    // 3. Load PDF into pdf-lib & register fontkit
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    pdfDoc.registerFontkit(fontkit);

    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // 4. Scan data-acroform-field elements in target element
    const fieldElements = targetEl.querySelectorAll<HTMLElement>('[data-acroform-field="true"]');
    const targetRect = targetEl.getBoundingClientRect();
    const scaleFactor = pdfPageWidth / targetWidthPx; // Exact 595.28 / 793.7 = 0.75 pt/px

    fieldElements.forEach((el, index) => {
      const fieldId = el.getAttribute('data-field-id') || `field_${index}`;
      const fieldType = el.getAttribute('data-field-type') || 'text';
      const radioGroup = el.getAttribute('data-field-radiogroup');
      const radioValue = el.getAttribute('data-field-radiovalue');

      const elRect = el.getBoundingClientRect();

      // Relative top position within full container height
      const relTop = elRect.top - targetRect.top;
      const relLeft = elRect.left - targetRect.left;

      // Determine which page this field belongs to
      const totalDomHeight = targetRect.height;
      const domPageHeight = totalDomHeight / totalPages;
      let pageIdx = Math.floor(relTop / domPageHeight);
      if (pageIdx >= totalPages) pageIdx = totalPages - 1;
      if (pageIdx < 0) pageIdx = 0;

      const page = pages[pageIdx];
      const pageTopOffset = pageIdx * domPageHeight;
      const localTop = relTop - pageTopOffset;

      // Calculate PDF Cartesian coordinates (y from bottom of page)
      const x = relLeft * scaleFactor;
      const width = Math.max(elRect.width * scaleFactor, 10);
      const height = Math.max(elRect.height * scaleFactor, 10);
      const y = pdfPageHeight - ((localTop + elRect.height) * scaleFactor);

      // Clamp y coordinates within printable page
      const clampedY = Math.max(5, Math.min(pdfPageHeight - height - 5, y));

      try {
        if (fieldType === 'checkbox') {
          const cbName = `${fieldId}_cb_${index}`;
          const checkBox = form.createCheckBox(cbName);
          checkBox.addToPage(page, {
            x,
            y: clampedY,
            width: Math.min(width, 14),
            height: Math.min(height, 14),
            borderWidth: 1,
            borderColor: rgb(0, 0, 0),
          });
        } else if (fieldType === 'radio' && radioGroup && radioValue) {
          let rg;
          try {
            rg = form.getRadioGroup(radioGroup);
          } catch {
            rg = form.createRadioGroup(radioGroup);
          }
          rg.addOptionToPage(radioValue, page, {
            x,
            y: clampedY,
            width: Math.min(width, 14),
            height: Math.min(height, 14),
            borderWidth: 1,
            borderColor: rgb(0, 0, 0),
          });
        } else {
          // Text / Number / Date / Time / Signature fields
          const tfName = `${fieldId}_tf_${index}`;
          const textField = form.createTextField(tfName);
          textField.addToPage(page, {
            x,
            y: clampedY,
            width,
            height,
            borderWidth: 0.5,
            borderColor: rgb(0.8, 0.8, 0.8),
          });
        }
      } catch (err) {
        console.warn(`Failed to create AcroForm field ${fieldId}:`, err);
      }
    });

    // 5. Save PDF bytes and trigger browser download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);

    const fileName = `FORM_${to5SFileName(template.formTitle || 'ISO_Document')}.pdf`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Error exporting Fillable PDF:', error);
    throw error;
  }
}
