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

export function calculatePageBreaks(targetEl: HTMLElement, config: PdfPageConfig): number[] {
  const targetRect = targetEl.getBoundingClientRect();
  const maxPageHeightPx = config.printableHeightPt / config.scaleFactor;
  // Reserve ~24px for bottom spacing (footer zone)
  const effectiveMaxHeightPx = maxPageHeightPx - 24;

  if (targetRect.height <= maxPageHeightPx) {
    return [0, targetRect.height];
  }

  // Find all atomic candidate elements that should avoid breaking inside
  const atomicElements = Array.from(
    targetEl.querySelectorAll<HTMLElement>('.print-block-avoid, tr, .subtable-print-container, .print-title-block')
  ).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && getComputedStyle(el).display !== 'none';
  });

  // Sort by top offset
  atomicElements.sort((a, b) => {
    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  });

  const rawBreaks: number[] = [0];
  let currentPageTop = 0;

  for (const el of atomicElements) {
    const r = el.getBoundingClientRect();
    const elTop = r.top - targetRect.top;
    const elBottom = r.bottom - targetRect.top;

    if (elBottom - currentPageTop > effectiveMaxHeightPx) {
      // Element exceeds current page budget
      // Place a page break at the start of this element if it's not at the very top of current page
      if (elTop > currentPageTop + 30) {
        rawBreaks.push(elTop);
        currentPageTop = elTop;
      }
    }
  }

  rawBreaks.push(targetRect.height);

  // Clean up and ensure minimum spacing between break points
  const cleanBreaks: number[] = [0];
  for (let i = 1; i < rawBreaks.length; i++) {
    const brk = rawBreaks[i];
    if (brk - cleanBreaks[cleanBreaks.length - 1] > 30) {
      cleanBreaks.push(brk);
    }
  }

  if (cleanBreaks[cleanBreaks.length - 1] < targetRect.height) {
    cleanBreaks.push(targetRect.height);
  }

  return cleanBreaks;
}

export function scanDomAcroFields(targetEl: HTMLElement, config: PdfPageConfig): {
  scannedFields: ScannedAcroField[];
  pageBreaks: number[];
  restoreStyles: () => void;
} {
  // Constrain target DOM to A4 target width — must use setProperty(..., 'important') because
  // print.css declares `width: 100% !important` on .print-outer-table, and a plain inline-style
  // assignment would be overridden by that CSS !important rule.  An inline style with its own
  // !important flag wins the cascade (higher specificity origin) and ensures the table actually
  // renders at targetWidthPx during both getBoundingClientRect measurement and html2canvas capture.
  targetEl.style.setProperty('width', `${config.targetWidthPx}px`, 'important');
  targetEl.style.setProperty('max-width', `${config.targetWidthPx}px`, 'important');
  targetEl.style.setProperty('padding', '0px', 'important');
  targetEl.style.setProperty('margin', '0px', 'important');
  targetEl.style.setProperty('box-sizing', 'border-box', 'important');
  // Enable PDF export mode flag to temporarily hide static borders during html2canvas capture
  targetEl.classList.add('exporting-pdf-mode');

  const restoreStyles = () => {
    targetEl.classList.remove('exporting-pdf-mode');
    // Remove our forced !important inline properties so CSS rules take over again
    targetEl.style.removeProperty('width');
    targetEl.style.removeProperty('max-width');
    targetEl.style.removeProperty('padding');
    targetEl.style.removeProperty('margin');
    targetEl.style.removeProperty('box-sizing');
  };

  const allFieldElements = Array.from(
    targetEl.querySelectorAll<HTMLElement>('[data-acroform-field="true"], [data-acro-anchor="true"]')
  );

  const fieldElements = allFieldElements.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).display !== 'none';
  });

  const targetRect = targetEl.getBoundingClientRect();
  const pageBreaks = calculatePageBreaks(targetEl, config);

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

  return { scannedFields, pageBreaks, restoreStyles };
}
