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
      // Signature fields are intended for physical wet-ink signing after printing.
      // The visual signature area (line, box) is already captured in the html2canvas background.
      // Adding an AcroForm interactive field here would prompt users to type text — incorrect UX.
      // Best practice (PDF spec): leave the area as a visual-only placeholder; user prints & signs.
      if (fieldType === 'signature') return;

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

        // Deduct 4pt from cell width — just enough breathing room from the right border.
        const rawWidth = isDateOrTimePart ? cellWidthPt : Math.max(10, cellWidthPt - 4);
        const maxAllowedWidth = Math.max(10, pdfPageWidth - marginX - 10 - textX);
        const fieldWidth = Math.min(rawWidth, maxAllowedWidth);

        // ── Y-axis positioning ────────────────────────────────────────────────────
        // Helvetica PostScript standard metrics at fontSize 10.5pt:
        //   cap-height  = 71.8% of em → 7.539pt  (height of capital letters A-Z)
        //   descender   = 20.7% of em → 2.174pt  (depth of g, p, y below baseline)
        // Field height covers cap + descender with a small margin.
        const FONT_SIZE = 10.5;
        const CAP_HEIGHT = FONT_SIZE * 0.718; // 7.539pt
        const DESCENDER  = FONT_SIZE * 0.207; // 2.174pt
        const fieldHeight = Math.max(CAP_HEIGHT + DESCENDER + 2, 13); // ≈ 13pt

        let fieldY: number;
        // CSS `alignItems: baseline` in a flex container → an empty block-level element's
        // first baseline is its bottom margin edge.  Therefore:
        //   element bottom edge  ≡  label text baseline  in the DOM.
        // Translating to PDF Y-coordinates (Y=0 at page bottom):
        const baselineY = pdfPageHeight - marginY - (localTop * scaleFactor + cellHeightPt);

        // For TALL containers (≥ 2× fieldHeight, e.g. table cells with explicit height)
        // the element bottom is NOT the text baseline — use geometric centering instead.
        if (cellHeightPt >= fieldHeight * 1.5) {
          // Geometric center of the cell → works well for equally-padded table cells
          fieldY = baselineY + (cellHeightPt - fieldHeight) / 2;
        } else {
          // Single-line form-block field: element bottom = label text baseline.
          // Position field so the pdf-lib-rendered text aligns its visual center
          // (cap-height midpoint) with the same baseline.
          // pdf-lib centers text in the field → text_center = fieldY + fieldHeight/2
          // We want: text_center = baselineY + CAP_HEIGHT/2
          // → fieldY = baselineY + CAP_HEIGHT/2 − fieldHeight/2
          fieldY = baselineY + CAP_HEIGHT / 2 - fieldHeight / 2;
        }
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
