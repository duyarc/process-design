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

    // Target the printable content wrapper / table
    const targetEl = containerEl.querySelector<HTMLElement>('.print-outer-table') || containerEl;

    // Standard PDF page dimensions (in points):
    // A4: 595.28 pt x 841.89 pt
    const pdfJs = new jsPDF({
      orientation: isA5 ? 'landscape' : 'portrait',
      unit: 'pt',
      format: isA5 ? 'a5' : 'a4',
    });

    const pdfPageWidth = pdfJs.internal.pageSize.getWidth();   // 595.28 pt
    const pdfPageHeight = pdfJs.internal.pageSize.getHeight(); // 841.89 pt

    // PDF Page Margins (36 pt = 12.7 mm = 0.5 inch clean margin on all sides)
    const marginX = 36;
    const marginY = 36;
    const printableWidthPt = pdfPageWidth - (marginX * 2);   // 523.28 pt
    const printableHeightPt = pdfPageHeight - (marginY * 2); // 769.89 pt

    // DOM Target Width: Set exact 697.7px (yields 0.75 pt/px scaling for 523.28pt printable width)
    const targetWidthPx = 697.7;

    // Save original inline styles to restore after capture & measurement
    const originalWidth = targetEl.style.width;
    const originalMaxWidth = targetEl.style.maxWidth;
    const originalPadding = targetEl.style.padding;
    const originalBoxSizing = targetEl.style.boxSizing;
    const originalBg = targetEl.style.background;

    targetEl.style.width = `${targetWidthPx}px`;
    targetEl.style.maxWidth = `${targetWidthPx}px`;
    targetEl.style.padding = '0px';
    targetEl.style.boxSizing = 'border-box';
    targetEl.style.background = '#ffffff';

    // 1. Capture HTML DOM to canvas using html2canvas at exact DOM width
    const canvas = await html2canvas(targetEl, {
      scale: 2, // 300 DPI high resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: targetWidthPx,
      windowWidth: targetWidthPx,
    });

    // 2. Scan and measure all field bounding boxes WHILE targetEl is still constrained to targetWidthPx (697.7px)!
    const allFieldElements = Array.from(targetEl.querySelectorAll<HTMLElement>('[data-acroform-field="true"]'));
    const fieldElements = allFieldElements.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
    });

    const targetRect = targetEl.getBoundingClientRect();
    const scaleFactor = printableWidthPt / targetWidthPx; // Exact 523.28 / 697.7 = 0.75 pt/px

    // Pre-calculate field positions relative to targetRect at targetWidthPx
    const scannedFields = fieldElements.map((el, index) => {
      const fieldId = el.getAttribute('data-field-id') || `field_${index}`;
      const fieldType = el.getAttribute('data-field-type') || 'text';
      const elRect = el.getBoundingClientRect();

      const relTop = elRect.top - targetRect.top;
      const relLeft = elRect.left - targetRect.left;

      return {
        fieldId,
        fieldType,
        relTop,
        relLeft,
        elWidth: elRect.width,
        elHeight: elRect.height,
        targetHeight: targetRect.height,
        index
      };
    });

    // NOW restore original styles immediately after taking DOM measurements!
    targetEl.style.width = originalWidth;
    targetEl.style.maxWidth = originalMaxWidth;
    targetEl.style.padding = originalPadding;
    targetEl.style.boxSizing = originalBoxSizing;
    targetEl.style.background = originalBg;

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // Scale canvas image into printable width
    const imgWidth = printableWidthPt;
    const imgHeight = (canvas.height * printableWidthPt) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // Render image inside marginX, marginY
    pdfJs.addImage(imgData, 'JPEG', marginX, marginY + position, imgWidth, imgHeight);
    heightLeft -= printableHeightPt;

    while (heightLeft > 5) {
      position = heightLeft - imgHeight;
      pdfJs.addPage();
      pdfJs.addImage(imgData, 'JPEG', marginX, marginY + position, imgWidth, imgHeight);
      heightLeft -= printableHeightPt;
    }

    const pdfArrayBuffer = pdfJs.output('arraybuffer');

    // 3. Load PDF into pdf-lib & register fontkit
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    pdfDoc.registerFontkit(fontkit);

    const form = pdfDoc.getForm();
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // 4. Place AcroForm fields onto PDF pages using pre-calculated scannedFields
    scannedFields.forEach((item) => {
      const { fieldId, fieldType, relTop, relLeft, elWidth, elHeight, targetHeight, index } = item;

      // Determine which page this field belongs to
      const domPageHeight = targetHeight / totalPages;
      let pageIdx = Math.floor(relTop / domPageHeight);
      if (pageIdx >= totalPages) pageIdx = totalPages - 1;
      if (pageIdx < 0) pageIdx = 0;

      const page = pages[pageIdx];
      const pageTopOffset = pageIdx * domPageHeight;
      const localTop = relTop - pageTopOffset;

      const x = marginX + (relLeft * scaleFactor);
      const width = Math.max(elWidth * scaleFactor, 10);
      const height = Math.max(elHeight * scaleFactor, 10);

      try {
        if (fieldType === 'checkbox' || fieldType === 'radio') {
          // Discrete CheckBox widget for options to prevent ghost radio buttons on PDF margin
          const cbName = `${fieldId}_opt_${index}`;
          const checkBox = form.createCheckBox(cbName);
          const cbSize = Math.min(width, 13);
          const cbY = pdfPageHeight - marginY - ((localTop * scaleFactor) + cbSize + 1);
          const clampedCbY = Math.max(marginY, Math.min(pdfPageHeight - marginY - cbSize, cbY));

          checkBox.addToPage(page, {
            x,
            y: clampedCbY,
            width: cbSize,
            height: cbSize,
            borderWidth: 1,
            borderColor: rgb(0, 0, 0),
          });
        } else {
          // Text / Number / Date / Time / Signature fields
          const fieldHeight = Math.min(height, 13);
          // Clamp right edge so it never exceeds (pdfPageWidth - marginX - 6pt)
          const maxAllowedWidth = Math.max(20, (pdfPageWidth - marginX - 6) - x);
          const fieldWidth = Math.min(width, maxAllowedWidth);

          // Align Y to text baseline
          const fieldY = pdfPageHeight - marginY - ((localTop * scaleFactor) + fieldHeight + 2);
          const clampedY = Math.max(marginY, Math.min(pdfPageHeight - marginY - fieldHeight, fieldY));

          const tfName = `${fieldId}_tf_${index}`;
          const textField = form.createTextField(tfName);
          textField.addToPage(page, {
            x,
            y: clampedY,
            width: fieldWidth,
            height: fieldHeight,
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
