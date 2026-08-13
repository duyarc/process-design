import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { PdfPageConfig } from './types';

export async function generatePdfBackgroundCanvas(
  targetEl: HTMLElement,
  config: PdfPageConfig
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

  // Render image inside marginX, marginY
  pdfJs.addImage(imgData, 'JPEG', config.marginX, config.marginY + position, imgWidth, imgHeight);
  heightLeft -= config.printableHeightPt;

  while (heightLeft > 5) {
    position = heightLeft - imgHeight;
    pdfJs.addPage();
    pdfJs.addImage(imgData, 'JPEG', config.marginX, config.marginY + position, imgWidth, imgHeight);
    heightLeft -= config.printableHeightPt;
  }

  return pdfJs.output('arraybuffer');
}
