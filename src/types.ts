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
    }
  };
}
