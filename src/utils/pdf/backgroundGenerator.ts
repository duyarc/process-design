import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { PdfPageConfig } from './types';

export interface PdfFooterInfo {
  leftText?: string;
  rightText?: string;
}

export async function generatePdfBackgroundCanvas(
  targetEl: HTMLElement,
  config: PdfPageConfig,
  pageBreaks?: number[],
  footerInfo?: PdfFooterInfo
): Promise<ArrayBuffer> {
  // 1. Capture HTML DOM to canvas using html2canvas at exact DOM width
  const canvas = await html2canvas(targetEl, {
    scale: 2, // 300 DPI high resolution
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    width: config.targetWidthPx,
    windowWidth: config.targetWidthPx,
  });

  // 2. Generate background PDF using jsPDF
  const pdfJs = new jsPDF({
    orientation: config.isA5 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: config.isA5 ? 'a5' : 'a4',
  });

  const renderFooter = () => {
    if (!footerInfo) return;
    pdfJs.setFont('helvetica', 'normal');
    pdfJs.setFontSize(8);
    pdfJs.setTextColor(71, 85, 105); // #475569
    const footerY = config.pdfPageHeight - 18; // 18pt from bottom (within 36pt bottom margin)
    if (footerInfo.leftText) {
      pdfJs.text(footerInfo.leftText, config.marginX, footerY);
    }
    if (footerInfo.rightText) {
      pdfJs.text(footerInfo.rightText, config.pdfPageWidth - config.marginX, footerY, { align: 'right' });
    }
  };

  const breaks = (pageBreaks && pageBreaks.length >= 2) ? pageBreaks : [0, targetEl.getBoundingClientRect().height];
  const totalPages = breaks.length - 1;

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) {
      pdfJs.addPage();
    }

    const startPx = breaks[i];
    const endPx = breaks[i + 1];
    const segHeightPx = Math.max(1, endPx - startPx);

    // Scale is 2 for html2canvas
    const sy = Math.round(startPx * 2);
    const sh = Math.round(segHeightPx * 2);
    const sw = canvas.width;

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = sw;
    pageCanvas.height = sh;
    const ctx = pageCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sw, sh);
      ctx.drawImage(canvas, 0, sy, sw, sh, 0, 0, sw, sh);
    }

    const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
    const segHeightPt = segHeightPx * config.scaleFactor;

    pdfJs.addImage(pageImgData, 'JPEG', config.marginX, config.marginY, config.printableWidthPt, segHeightPt);
    renderFooter();
  }

  return pdfJs.output('arraybuffer');
}
