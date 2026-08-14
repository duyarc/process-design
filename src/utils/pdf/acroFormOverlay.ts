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
        // Text / Number / Date Parts / Time Parts / Signature Name fields
        const isDateOrTimePart = fieldType === 'date_part' || fieldType === 'time_part' ||
          fieldId.endsWith('_dd') || fieldId.endsWith('_mm') || fieldId.endsWith('_yyyy') ||
          fieldId.endsWith('_hh') || fieldId.endsWith('_start_hh') || fieldId.endsWith('_start_mm') ||
          fieldId.endsWith('_end_hh') || fieldId.endsWith('_end_mm');
        const isSignatureName = fieldType === 'signature_name';
        
        // Exact X for Date/Time Parts and Signature Names (+0), +2pt left-padding for normal text/table fields
        const textX = (isDateOrTimePart || isSignatureName) ? (marginX + relLeft * scaleFactor) : (marginX + relLeft * scaleFactor + 2);

        // Deduct 4pt from cell width for normal text fields; use exact cellWidthPt for date/time/signature
        const rawWidth = (isDateOrTimePart || isSignatureName) ? cellWidthPt : Math.max(10, cellWidthPt - 4);
        const maxAllowedWidth = Math.max(10, pdfPageWidth - marginX - 10 - textX);
        const fieldWidth = Math.min(rawWidth, maxAllowedWidth);

        // Helvetica PostScript metrics at 10.5pt:
        //   cap-height  = 71.8% of em → 7.539pt
        //   descender   = 20.7% of em → 2.174pt
        const FONT_SIZE = 10.5;
        const CAP_HEIGHT = FONT_SIZE * 0.718; // 7.539pt
        const DESCENDER  = FONT_SIZE * 0.207; // 2.174pt
        const fieldHeight = Math.max(CAP_HEIGHT + DESCENDER + 2, 13); // ≈ 13pt

        // ── Multi-line cell detection ─────────────────────────────────────────
        // A single TABLE row is 28px DOM → ~23.9pt in PDF (28 * scaleFactor).
        // Threshold 30pt catches any cell with lineCount ≥ 2 while ignoring
        // the slightly-taller single-line INFO_GRID cells (≈ 22px → 18.8pt).
        const isMultiLineCell = !isDateOrTimePart && !isSignatureName && cellHeightPt > 30;

        let finalFieldHeight: number;
        let fieldY: number;
        let useMultiline: boolean;

        if (isMultiLineCell) {
          // Multiline: field fills the full cell with 2pt padding top & bottom.
          finalFieldHeight = Math.max(cellHeightPt - 4, fieldHeight);
          // PDF Y=0 is at the page bottom. Field bottom-left y:
          //   = pageHeight - marginY - (localTop * scale + cellHeightPt) + 2
          fieldY = pdfPageHeight - marginY - (localTop * scaleFactor + cellHeightPt - 2);
          useMultiline = true;
        } else {
          // Single-line: existing baseline-anchored or geometric-center logic.
          finalFieldHeight = fieldHeight;
          const baselineY = pdfPageHeight - marginY - (localTop * scaleFactor + cellHeightPt);
          // For TALL single-line containers (≥ 1.5× fieldHeight, e.g. INFO_GRID label rows)
          // use geometric centering; otherwise use baseline alignment.
          if (cellHeightPt >= fieldHeight * 1.5) {
            fieldY = baselineY + (cellHeightPt - fieldHeight) / 2;
          } else {
            // pdf-lib centers text in the field → text_center = fieldY + fieldHeight/2
            // We want: text_center = baselineY + CAP_HEIGHT/2
            fieldY = baselineY + CAP_HEIGHT / 2 - fieldHeight / 2;
          }
          useMultiline = false;
        }

        const clampedY = Math.max(marginY, Math.min(pdfPageHeight - marginY - finalFieldHeight, fieldY));

        const tfName = `${fieldId}_tf_${index}`;
        const textField = form.createTextField(tfName);

        // Set default appearance string before setFontSize to prevent pdf-lib errors.
        textField.acroField.setDefaultAppearance('/Helv 10.5 Tf 0 0 0 rg');
        textField.setFontSize(10.5);

        if (useMultiline) {
          textField.enableMultiline();
        }

        if (isDateOrTimePart || isSignatureName) {
          textField.setAlignment(TextAlignment.Center);
          if (fieldId.endsWith('_yyyy')) {
            textField.setMaxLength(4);
          } else if (isDateOrTimePart) {
            textField.setMaxLength(2);
          }
        }

        textField.updateAppearances(helveticaFont);

        textField.addToPage(page, {
          x: textX,
          y: clampedY,
          width: fieldWidth,
          height: finalFieldHeight,
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
