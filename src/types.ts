export interface ProcessStep {
  id: string;
  role: string;
  action: string;
  bpmnShape?: 'task' | 'exclusive-gateway' | 'start-event' | 'end-event' | 'message-end-event';
  nextStepId?: string;
  branchYesLabel?: string;
  branchYesTargetId?: string;
  branchNoLabel?: string;
  branchNoTargetId?: string;
  producesForm?: boolean;
  formName?: string;
  formNames?: string[];
  layoutX?: number;
  layoutY?: number;
  layoutWaypointsMap?: { [targetId: string]: { x: number; y: number }[] };
  layoutCatchWaypoints?: { x: number; y: number }[];
  formLayouts?: Record<string, { x: number; y: number; waypoints?: { x: number; y: number }[]; labelX?: number; labelY?: number; labelW?: number; labelH?: number }>;
  labelX?: number;
  labelY?: number;
  labelW?: number;
  labelH?: number;
}

export interface FormField {
  id: string;
  checkItem: string;
  locationCode: string;
  targetRange: string;
  reactionProtocol: string;
  frequency?: string;
}

export interface RadioOption {
  label: string;   // Nhãn hiển thị — ví dụ: "Đạt", "Loại B"
  value: string;   // Giá trị lưu   — ví dụ: "PASS", "GRADE_B"
  isPass: boolean; // Lựa chọn này có được tính là đạt không?
}

export interface FormDesignerField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature';
  options?: string[];
}

export interface SOPSignOff {
  name: string;
  title: string;
}

export interface SOPSignOffs {
  author?: SOPSignOff;
  reviewers?: SOPSignOff[];
  authorisers?: SOPSignOff[];
  effectiveDate?: string;
}

export interface Process {
  id: string;
  parentProcessId: string;
  status: 'Draft' | 'Pending Review' | 'Active' | 'Superseded' | 'Retired';
  title: string;
  description: string;
  version: string;
  lastUpdated: string;
  roles: string[];
  steps: ProcessStep[];
  formFields: FormField[];
  sopSignoffs?: SOPSignOffs;
  workflowFormsData?: {
    [formName: string]: {
      pdfName?: string;
      pdfUrl?: string;
      pdfKey?: string;
      pdfSize?: number;
      // ISO 2026 Form Builder Additions
      formId?: string;
      formTitle?: string;
      version?: string; // vX.Y (YYYY-MM-DD)
      status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      layoutBlocks?: LayoutBlockISO[];
      revisionHistory?: FormRevisionEntry[];
    }
  };
}

export interface SubtableColumn {
  id: string;
  label: string;
  type: 'static_text' | 'text' | 'number' | 'date' | 'time';
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface FormFieldISO {
  id: string;
  type: 'text' | 'number' | 'date' | 'time' | 'checkbox' | 'radio' | 'signature' | 'photo' | 'subtable';
  checkItem: string;
  locationCode: string;
  minSpec?: number;
  maxSpec?: number;
  unit?: string;
  targetRange?: string; // For text/boolean targets e.g. "Released & functional"
  options?: RadioOption[]; // For radio type: list of selectable options
  frequency?: string;
  reactionProtocol: string;
  timeMode?: 'single' | 'dual';
  subtableColumns?: SubtableColumn[];
  subtableDefaultRows?: number;
  subtableStaticData?: Record<number, Record<string, string>>;
}

export interface FormRevisionEntry {
  version: string;
  date: string;
  author: string;
  change: string;
  layoutBlocks?: LayoutBlockISO[];
  status?: string;
}

export interface MatrixConfigISO {
  rowHeader: string;         // Tiêu đề dòng (e.g. "Lớp")
  rowCount: number;          // Số lượng dòng (e.g. 17)
  columnHeader: string;      // Tiêu đề nhóm cột (e.g. "Tên hàng, quy cách")
  columns: string[];         // Danh sách tên cột sản phẩm (e.g. ["SP 1", "SP 2", "SP 3"])
  showTotalColumn: boolean;  // Có hiện cột tính tổng dòng không
  totalColumnHeader: string; // Tiêu đề cột tổng (e.g. "Tổng mỗi lớp")
  showNotesColumn: boolean;  // Có hiện cột ghi chú không
  notesColumnHeader: string; // Tiêu đề cột ghi chú (e.g. "Ghi chú")
  columnAlign?: 'left' | 'center'; // Canh lề cột (trái hoặc giữa)
}

export interface ColumnSummaryRowConfig {
  id: string;
  label: string;
  type: 'sum' | 'manual' | 'percentage' | 'sum_all';
  percentageValue?: number;
  percentageOfId?: string;
  sumRowIds?: string[];
}

export interface TableColumnConfig {
  id: string;
  label: string;
  width: string; // e.g. "20%" or "150px"
  type: 'static_text' | 'text' | 'number' | 'checkbox' | 'radio' | 'date' | 'time';
  options?: RadioOption[];
  align?: 'left' | 'center' | 'right';
  checkboxLayout?: '1-column' | '2-column';
  summaryRows?: ColumnSummaryRowConfig[];
  locked?: boolean; // If true: cannot delete or change type (used for structural cols in CHECKLIST_TABLE)
  hidden?: boolean; // If true: do not render in canvas/print layout
}

export interface TableRowConfig {
  id: string;
}

export type TitleFormatISO = 'H1' | 'H2' | 'BODY' | 'NONE';

export interface LayoutBlockISO {
  id: string;
  type: 'TITLE' | 'INFO_GRID' | 'CHECKLIST_TABLE' | 'MATRIX_TABLE' | 'SIGN' | 'TABLE' | 'SECTION_LABEL';
  columns: 1 | 2 | 3;
  title: string;
  fields: FormFieldISO[];
  logo?: string;
  description?: string;
  sectionFormat?: 'H1' | 'H2';
  titleFormat?: TitleFormatISO;
  columnLabels?: {
    stt: string;
    item: string;
    target: string;
    reaction: string;
  };
  matrixConfig?: MatrixConfigISO;
  tableColumns?: TableColumnConfig[];
  tableRows?: TableRowConfig[];
  tableData?: { [rowId: string]: { [colId: string]: string } };
  showDate?: boolean;
  datePosition?: 'A' | 'B';
  hideSTT?: boolean;
}

export interface FormTemplateISO {
  formId: string;
  formTitle: string;
  version: string; // clean semver: "v0.1", "v1.2"
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  effectiveDate?: string; // ISO date string "YYYY-MM-DD", set on publish
  updatedAt?: string; // ISO timestamp or simple date, set on save
  pageSize?: 'A4' | 'A5_LANDSCAPE';
  layoutBlocks: LayoutBlockISO[];
  revisionHistory: FormRevisionEntry[];
}

export interface SubmissionFieldSnapshot {
  id: string;
  checkItem: string;
  locationCode: string;
  targetRange: string;
  reactionProtocol: string;
  value: string;
  status: 'PASS' | 'FAIL';
}

export interface Submission {
  id: string;
  processId: string;
  formId: string;
  formVersion: string;
  operatorId: string;
  submittedAt: string;
  status: 'PASS' | 'FAIL' | 'ABNORMALITY';
  formData: SubmissionFieldSnapshot[];
  mediaUrls?: string[];
  supervisorSignoff?: {
    signedBy: string;
    signedAt: string;
    notes?: string;
  } | null;
}

/**
 * Formats a clean version string for display.
 * @param version - clean semver string, e.g. "v0.1"
 * @param status  - form status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
 * @param effectiveDate - ISO date string "YYYY-MM-DD", set on publish
 * @param updatedAt - ISO timestamp or simple date, set on save (used as date for DRAFT)
 */
export function formatFormVersion(version: string, status?: string, effectiveDate?: string, updatedAt?: string): string {
  if (!version) return '';
  // Normalize: strip any legacy suffix still in DB during transition
  const clean = version.replace(/\s*\([^)]*\)/g, '').trim();
  const display = clean.startsWith('v') ? 'V' + clean.slice(1) : clean; // "v0.1" -> "V0.1"

  if (status === 'DRAFT') {
    if (updatedAt) {
      const datePart = updatedAt.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        return `${display}-${dd}.${mm}.${yyyy} (draft)`; // "V0.1-10.07.2026 (draft)"
      }
    }
    return `${display} (draft)`;
  }
  if (status === 'ACTIVE') {
    const targetDate = effectiveDate || updatedAt;
    if (targetDate) {
      const datePart = targetDate.split('T')[0]; // handle ISO "2026-07-29T00:00:00.000Z"
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        return `${display}-${dd}.${mm}.${yyyy}`; // "V1.0-29.07.2026"
      }
    }
  }

  // Fallback for legacy embedded dates (e.g. in older submissions)
  const matchWithDate = version.match(/v?(\d+)(?:\.\d+)?\s*\((\d{4})-(\d{2})-(\d{2})\)/i);
  if (matchWithDate) {
    const year = matchWithDate[2];
    const month = matchWithDate[3];
    const day = matchWithDate[4];
    return `${display}-${day}.${month}.${year}`;
  }

  return display; // ARCHIVED or unknown: "V0.1"
}

export function getColStyleWidth(colId: string, colWidth: string, tableColumns: any[]): string {
  const cleanWidth = (colWidth || '').trim();
  const isPercent = cleanWidth.endsWith('%') || !isNaN(parseFloat(cleanWidth));
  if (!isPercent) return cleanWidth; // e.g. "120px"
  
  const index = (tableColumns || []).findIndex(c => c.id === colId);
  const isLast = index !== -1 && index === tableColumns.length - 1;
  
  if (isLast && tableColumns.length > 1) {
    // Calculate the sum of all columns BEFORE the last one
    const sumOtherPercent = tableColumns
      .slice(0, tableColumns.length - 1)
      .filter(c => c.width && (c.width.endsWith('%') || !isNaN(parseFloat(c.width))))
      .reduce((sum, c) => sum + parseFloat(c.width), 0);
    
    const remainder = 100 - sumOtherPercent;
    return `${remainder > 0 ? remainder : 10}%`;
  }
  
  const val = parseFloat(cleanWidth);
  return `${isNaN(val) ? 10 : val}%`;
}

