import type { ScannedAcroField, PdfPageConfig } from './types';

export function getPdfPageConfig(pageSizeInput?: string): PdfPageConfig {
  const isA5 = pageSizeInput === 'A5_LANDSCAPE';
  const pdfPageWidth = isA5 ? 595.28 : 595.28;   // 595.28 pt
  const pdfPageHeight = isA5 ? 419.53 : 841.89; // A4: 841.89 pt, A5: 419.53 pt

  const marginX = 36; // 36 pt = 12.7 mm
  const marginY = 36;
  const printableWidthPt = pdfPageWidth - (marginX * 2);   // 523.28 pt
  const printableHeightPt = pdfPageHeight - (marginY * 2); // 769.89 pt

  // DOM Target Width: Set exact 697.7px (yields 0.75 pt/px scaling for 523.28pt printable width)
  const targetWidthPx = 697.7;
  const scaleFactor = printableWidthPt / targetWidthPx; // 0.75 pt/px

  return {
    pageSize: isA5 ? 'A5_LANDSCAPE' : 'A4',
    isA5,
    pdfPageWidth,
    pdfPageHeight,
    marginX,
    marginY,
    printableWidthPt,
    printableHeightPt,
    targetWidthPx,
    scaleFactor,
  };
}

export function scanDomAcroFields(targetEl: HTMLElement, config: PdfPageConfig): {
  scannedFields: ScannedAcroField[];
  restoreStyles: () => void;
} {
  // Save original inline styles to restore after scan
  const originalWidth = targetEl.style.width;
  const originalMaxWidth = targetEl.style.maxWidth;
  const originalPadding = targetEl.style.padding;
  const originalBoxSizing = targetEl.style.boxSizing;
  const originalBg = targetEl.style.background;

  // Constrain target DOM to A4 target width (697.7px)
  targetEl.style.width = `${config.targetWidthPx}px`;
  targetEl.style.maxWidth = `${config.targetWidthPx}px`;
  targetEl.style.padding = '0px';
  targetEl.style.boxSizing = 'border-box';
  targetEl.style.background = '#ffffff';

  const restoreStyles = () => {
    targetEl.style.width = originalWidth;
    targetEl.style.maxWidth = originalMaxWidth;
    targetEl.style.padding = originalPadding;
    targetEl.style.boxSizing = originalBoxSizing;
    targetEl.style.background = originalBg;
  };

  const allFieldElements = Array.from(
    targetEl.querySelectorAll<HTMLElement>('[data-acroform-field="true"], [data-acro-anchor="true"]')
  );

  const fieldElements = allFieldElements.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
  });

  const targetRect = targetEl.getBoundingClientRect();

  const scannedFields: ScannedAcroField[] = fieldElements.map((el, index) => {
    const fieldId = el.getAttribute('data-field-id') || `field_${index}`;
    const fieldType = (el.getAttribute('data-field-type') as ScannedAcroField['fieldType']) || 'text';
    const radioGroup = el.getAttribute('data-field-radiogroup') || undefined;
    const radioValue = el.getAttribute('data-field-radiovalue') || undefined;

    const elRect = el.getBoundingClientRect();
    const relTop = elRect.top - targetRect.top;
    const relLeft = elRect.left - targetRect.left;

    return {
      fieldId,
      fieldType,
      radioGroup,
      radioValue,
      relTop,
      relLeft,
      elWidth: elRect.width,
      elHeight: elRect.height,
      targetHeight: targetRect.height,
      index,
    };
  });

  return { scannedFields, restoreStyles };
}
