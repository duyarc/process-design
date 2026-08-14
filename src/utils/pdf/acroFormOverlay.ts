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

    const width = Math.max(elWidth * scaleFactor, 10);
    const height = Math.max(elHeight * scaleFactor, 10);

    try {
      if (fieldType === 'checkbox' || fieldType === 'radio') {
        // Shift optionX LEFT by 14pt so checkbox does NOT cover text
        const optionX = marginX + relLeft * scaleFactor - 14;
        const cbName = `${fieldId}_opt_${index}`;
        const checkBox = form.createCheckBox(cbName);
        const cbSize = Math.min(width, 13);
        // Shift cbY UPWARDS by 2.5pt to vertically center checkbox with text
        const cbY = pdfPageHeight - marginY - (localTop * scaleFactor + cbSize - 1.5);
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
        // Text / Number / Date Parts / Time / Signature fields
        const isDatePart = fieldType === 'date_part' || fieldId.endsWith('_dd') || fieldId.endsWith('_mm') || fieldId.endsWith('_yyyy');
        
        // Exact X for Date Parts, +2pt shift for normal text fields
        const textX = isDatePart ? (marginX + relLeft * scaleFactor) : (marginX + relLeft * scaleFactor + 2);
        const fieldHeight = Math.min(Math.max(height, 14), 15);
        
        // Clamp right edge so it never exceeds (pdfPageWidth - marginX - 6pt)
        const maxAllowedWidth = Math.max(12, pdfPageWidth - marginX - 6 - textX);
        const fieldWidth = Math.min(width, maxAllowedWidth);

        // Lower fieldY by 4.5pt so text baseline aligns 100% horizontally with label baseline
        const fieldY = pdfPageHeight - marginY - (localTop * scaleFactor + fieldHeight + 4.5);
        const clampedY = Math.max(marginY, Math.min(pdfPageHeight - marginY - fieldHeight, fieldY));

        const tfName = `${fieldId}_tf_${index}`;
        const textField = form.createTextField(tfName);

        // Set default appearance string (/Helv 10.5 Tf) before calling setFontSize to prevent pdf-lib errors
        textField.acroField.setDefaultAppearance('/Helv 10.5 Tf 0 0 0 rg');
        textField.setFontSize(10.5);

        if (isDatePart) {
          textField.setAlignment(TextAlignment.Center);
          if (fieldId.endsWith('_dd') || fieldId.endsWith('_mm')) {
            textField.setMaxLength(2);
          } else if (fieldId.endsWith('_yyyy')) {
            textField.setMaxLength(4);
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
