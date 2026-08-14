import { PDFDocument, rgb, StandardFonts, TextAlignment } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ScannedAcroField, PdfPageConfig } from './types';

export async function overlayAcroFormFields(
  pdfBuffer: ArrayBuffer,
  scannedFields: ScannedAcroField[],
  config: PdfPageConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const form = pdfDoc.getForm();
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  const { pdfPageWidth, pdfPageHeight, marginX, marginY, scaleFactor } = config;

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

    const cellWidthPt = Math.max(elWidth * scaleFactor, 10);
    const cellHeightPt = Math.max(elHeight * scaleFactor, 10);

    try {
      if (fieldType === 'checkbox' || fieldType === 'radio') {
        // X: place checkbox exactly at the visual icon's DOM position.
        // With the correct 697.7px DOM layout, relLeft * scaleFactor maps directly to PDF pt.
        // No manual X correction needed anymore (the old -14pt was compensating for wrong layout).
        const optionX = marginX + relLeft * scaleFactor;
        const cbName = `${fieldId}_opt_${index}`;
        const checkBox = form.createCheckBox(cbName);
        const cbSize = Math.min(cellWidthPt, 13);
        // Y: align checkbox top edge with the anchor element's top edge.
        // cbY is the BOTTOM-LEFT corner in pdf-lib's coordinate system (Y=0 at page bottom).
        const cbY = pdfPageHeight - marginY - (localTop * scaleFactor + cbSize);
        const clampedCbY = Math.max(marginY, Math.min(pdfPageHeight - marginY - cbSize, cbY));

        checkBox.addToPage(page, {
          x: optionX,
          y: clampedCbY,
          width: cbSize,
          height: cbSize,
          borderWidth: 1,
          borderColor: rgb(0, 0, 0),
        });
      } else {
        // Text / Number / Date Parts / Time Parts / Signature fields
        const isDateOrTimePart = fieldType === 'date_part' || fieldType === 'time_part' ||
          fieldId.endsWith('_dd') || fieldId.endsWith('_mm') || fieldId.endsWith('_yyyy') ||
          fieldId.endsWith('_hh') || fieldId.endsWith('_start_hh') || fieldId.endsWith('_start_mm') ||
          fieldId.endsWith('_end_hh') || fieldId.endsWith('_end_mm');
        
        // Exact X for Date/Time Parts (+0), +2pt left-padding for normal text/table fields
        const textX = isDateOrTimePart ? (marginX + relLeft * scaleFactor) : (marginX + relLeft * scaleFactor + 2);
        const fieldHeight = Math.min(Math.max(cellHeightPt - 4, 13), 15);
        
        // Deduct 4pt from cell width — just enough breathing room from the right border.
        // (Previously -16pt was compensating for inflated measurements in the wrong DOM layout;
        //  now that the DOM is correctly 697.7px wide, the elWidth measurement is accurate.)
        const rawWidth = isDateOrTimePart ? cellWidthPt : Math.max(10, cellWidthPt - 4);
        
        // Clamp right edge so it never exceeds (pdfPageWidth - marginX - 10pt)
        const maxAllowedWidth = Math.max(10, pdfPageWidth - marginX - 10 - textX);
        const fieldWidth = Math.min(rawWidth, maxAllowedWidth);

        // Center field vertically inside cell (Y-axis centering)
        const fieldY = pdfPageHeight - marginY - (localTop * scaleFactor + (cellHeightPt + fieldHeight) / 2);
        const clampedY = Math.max(marginY, Math.min(pdfPageHeight - marginY - fieldHeight, fieldY));

        const tfName = `${fieldId}_tf_${index}`;
        const textField = form.createTextField(tfName);

        // Set default appearance string (/Helv 10.5 Tf) before calling setFontSize to prevent pdf-lib errors
        textField.acroField.setDefaultAppearance('/Helv 10.5 Tf 0 0 0 rg');
        textField.setFontSize(10.5);

        if (isDateOrTimePart) {
          textField.setAlignment(TextAlignment.Center);
          if (fieldId.endsWith('_yyyy')) {
            textField.setMaxLength(4);
          } else {
            textField.setMaxLength(2);
          }
        }

        textField.updateAppearances(helveticaFont);

        textField.addToPage(page, {
          x: textX,
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

  return pdfDoc.save();
}
