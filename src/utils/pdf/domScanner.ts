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
  // Calibrated to exactly match browser @page print margins (12mm/15mm for A4 = 765.36pt -> 1020px, 8mm/10mm for A5 = 368.5pt -> 490px)
  const effectiveMaxHeightPx = config.isA5 ? 490 : 1020;

  if (targetRect.height <= effectiveMaxHeightPx) {
    return [0, targetRect.height];
  }

  // Find all atomic candidate elements that define natural page break boundaries:
  // - Atomic block wrappers (.print-block-avoid, .print-block--section)
  // - Table groups (.print-table-group, tbody) & Table rows (tr)
  // - Inner grid rows / items inside INFO_GRID ([style*="grid"] > div, .info-grid > div)
  // - Subtable containers (.subtable-print-container)
  // - Title blocks (.print-title-block, h1, h2)
  // - Signature blocks (.print-signature-grid, .print-signature-card)
  const candidateElements = Array.from(
    targetEl.querySelectorAll<HTMLElement>(
      '.print-block-avoid, .print-block--section, .print-table-group, tbody, [style*="grid"] > div, .info-grid > div, tr, .subtable-print-container, .print-title-block, .print-signature-grid, .print-signature-card'
    )
  ).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
  });

  // Sort strictly by top offset in ascending order, then by element height in descending order
  candidateElements.sort((a, b) => {
    const rA = a.getBoundingClientRect();
    const rB = b.getBoundingClientRect();
    if (Math.abs(rA.top - rB.top) > 1) {
      return rA.top - rB.top;
    }
    return rB.height - rA.height;
  });

  const isHeadingElement = (el: HTMLElement): boolean => {
    return (
      el.classList.contains('print-block--section') ||
      el.classList.contains('print-title-block') ||
      el.tagName === 'H1' ||
      el.tagName === 'H2' ||
      el.tagName === 'H3' ||
      el.querySelector('h1, h2, h3, .print-block--section') !== null
    );
  };

  const rawBreaks: number[] = [0];
  let currentPageTop = 0;

  for (let i = 0; i < candidateElements.length; i++) {
    const el = candidateElements[i];
    const r = el.getBoundingClientRect();
    const elTop = r.top - targetRect.top;
    const elBottom = r.bottom - targetRect.top;

    const isHeading = isHeadingElement(el);
    // A heading must have at least 60px of space after it on the same page (emulating break-after: avoid)
    const requiredBottom = isHeading ? elBottom + 60 : elBottom;

    if (requiredBottom - currentPageTop > effectiveMaxHeightPx) {
      // Determine the best break point
      let breakPoint = elTop;

      // If this is a normal element whose preceding sibling was an orphan heading within 80px, break before the heading
      if (!isHeading && i > 0) {
        const prevEl = candidateElements[i - 1];
        const prevR = prevEl.getBoundingClientRect();
        const prevTop = prevR.top - targetRect.top;
        if (isHeadingElement(prevEl) && elTop - prevTop < 80 && prevTop > currentPageTop + 25) {
          breakPoint = prevTop;
        }
      }

      if (breakPoint > currentPageTop + 25) {
        rawBreaks.push(breakPoint);
        currentPageTop = breakPoint;
      }
    }
  }

  rawBreaks.push(targetRect.height);

  // Clean up and ensure minimum spacing between break points
  const cleanBreaks: number[] = [0];
  for (let i = 1; i < rawBreaks.length; i++) {
    const brk = rawBreaks[i];
    if (brk - cleanBreaks[cleanBreaks.length - 1] > 25) {
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
