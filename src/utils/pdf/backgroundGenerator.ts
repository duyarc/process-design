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

  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  // 2. Generate background PDF using jsPDF
  const pdfJs = new jsPDF({
    orientation: config.isA5 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: config.isA5 ? 'a5' : 'a4',
  });

  const imgWidth = config.printableWidthPt;
  const imgHeight = (canvas.height * config.printableWidthPt) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

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

  // Render image inside marginX, marginY
  pdfJs.addImage(imgData, 'JPEG', config.marginX, config.marginY + position, imgWidth, imgHeight);
  renderFooter();
  heightLeft -= config.printableHeightPt;

  while (heightLeft > 5) {
    position = heightLeft - imgHeight;
    pdfJs.addPage();
    pdfJs.addImage(imgData, 'JPEG', config.marginX, config.marginY + position, imgWidth, imgHeight);
    renderFooter();
    heightLeft -= config.printableHeightPt;
  }

  return pdfJs.output('arraybuffer');
}
