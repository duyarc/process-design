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
  layoutX?: number;
  layoutY?: number;
  layoutWaypointsMap?: { [targetId: string]: { x: number; y: number }[] };
  layoutCatchWaypoints?: { x: number; y: number }[];
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
  frequency: string;
}

export interface FormDesignerField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'signature';
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
      fields?: FormDesignerField[];
      // ISO 2026 Form Builder Additions
      formId?: string;
      formTitle?: string;
      version?: string; // vX.Y (YYYY-MM-DD)
      status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      isoFields?: FormFieldISO[];
      revisionHistory?: FormRevisionEntry[];
    }
  };
}

export interface FormFieldISO {
  id: string;
  type: 'text' | 'number' | 'date' | 'checkbox' | 'signature' | 'photo';
  checkItem: string;
  locationCode: string;
  minSpec?: number;
  maxSpec?: number;
  unit?: string;
  targetRange?: string; // For text/boolean targets e.g. "Released & functional"
  frequency: string;
  reactionProtocol: string;
}

export interface FormRevisionEntry {
  version: string;
  date: string;
  author: string;
  change: string;
}

export interface FormTemplateISO {
  formId: string;
  formTitle: string;
  version: string; // vX.Y (YYYY-MM-DD)
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  fields: FormFieldISO[];
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

