export interface ScannedAcroField {
  fieldId: string;
  fieldType: 'text' | 'checkbox' | 'radio' | 'rating' | 'date' | 'date_part' | 'time' | 'time_part' | 'signature' | 'signature_name' | 'number';
  radioGroup?: string;
  radioValue?: string;
  relTop: number;
  relLeft: number;
  elWidth: number;
  elHeight: number;
  targetHeight: number;
  index: number;
}

export interface PdfPageConfig {
  pageSize: 'A4' | 'A5_LANDSCAPE';
  isA5: boolean;
  pdfPageWidth: number;
  pdfPageHeight: number;
  marginX: number;
  marginY: number;
  printableWidthPt: number;
  printableHeightPt: number;
  targetWidthPx: number;
  scaleFactor: number;
}

export interface TextAnchorConfig {
  id: string;
  type: string;
  width?: number;
  height?: number;
}
