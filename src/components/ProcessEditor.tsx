import React, { useState, useEffect, useRef } from 'react';
import type { Process, ProcessStep, FormField, FormDesignerField, SOPSignOff, SOPSignOffs } from '../types';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Upload, Edit2, Eye, Printer, GitBranch, XCircle, Shield, Calendar } from 'lucide-react';
import FormBuilder from './FormBuilder';
import { generateBPMNXML } from '../utils/bpmnXmlGenerator';
import { useAuth } from '../context/AuthContext';
import { BpmnViewerComponent } from './BpmnViewerComponent';
import { BpmnModelerComponent } from './BpmnModelerComponent';
import type { BpmnModelerRef } from './BpmnModelerComponent';

const enforceStepShapes = (stepsList: ProcessStep[]): ProcessStep[] => {
  if (stepsList.length === 0) return stepsList;
  const ids = new Set(stepsList.map(s => s.id));
  return stepsList.map((step, idx) => {
    let shape = step.bpmnShape;
    if (idx === 0) {
      shape = 'start-event';
    } else {
      if (shape === 'start-event' || !shape) {
        shape = 'task';
      }
    }
    
    // Get the ID of the next sequential step if available
    const nextSeqId = idx < stepsList.length - 1 ? stepsList[idx + 1].id : undefined;
    
    let nextStepId = step.nextStepId;
    if (shape !== 'end-event' && shape !== 'message-end-event') {
      if (!nextStepId || !ids.has(nextStepId)) {
        nextStepId = nextSeqId;
      }
    } else {
      nextStepId = undefined;
    }

    let branchYesLabel = step.branchYesLabel;
    let branchYesTargetId = step.branchYesTargetId;
    let branchNoLabel = step.branchNoLabel;
    let branchNoTargetId = step.branchNoTargetId;

    if (shape === 'exclusive-gateway') {
      if (branchYesLabel === undefined) branchYesLabel = 'Y';
      if (branchNoLabel === undefined) branchNoLabel = 'N';
      if (!branchYesTargetId || !ids.has(branchYesTargetId)) {
        branchYesTargetId = nextSeqId;
      }
      if (!branchNoTargetId || !ids.has(branchNoTargetId)) {
        branchNoTargetId = nextSeqId;
      }
    } else {
      branchYesLabel = undefined;
      branchYesTargetId = undefined;
      branchNoLabel = undefined;
      branchNoTargetId = undefined;
    }

    let producesForm = step.producesForm;
    let formName = step.formName;
    let formNames = step.formNames;
    if (shape !== 'task') {
      producesForm = undefined;
      formName = undefined;
      formNames = undefined;
    }
    
    return { 
      ...step, 
      bpmnShape: shape, 
      nextStepId,
      branchYesLabel, 
      branchYesTargetId,
      branchNoLabel, 
      branchNoTargetId,
      producesForm,
      formName,
      formNames
    };
  });
};

const updateSequentialConnections = (oldSteps: ProcessStep[], newSteps: ProcessStep[]): ProcessStep[] => {
  const oldIndexMap = new Map<string, number>();
  oldSteps.forEach((s, idx) => oldIndexMap.set(s.id, idx));

  return newSteps.map((step, idx) => {
    const oldIdx = oldIndexMap.get(step.id);
    if (oldIdx === undefined) {
      return {
        ...step,
        nextStepId: idx < newSteps.length - 1 ? newSteps[idx + 1].id : undefined
      };
    }

    const wasSequential = oldIdx < oldSteps.length - 1 && oldSteps[oldIdx].nextStepId === oldSteps[oldIdx + 1].id;
    if (wasSequential || !step.nextStepId) {
      return {
        ...step,
        nextStepId: idx < newSteps.length - 1 ? newSteps[idx + 1].id : undefined
      };
    }

    return step;
  });
};

interface ProcessEditorProps {
  processId: string | null; // null means create new
  onCancel: () => void;
  onSaveSuccess: (id: string) => void;
  onOpenDraft?: (id: string) => void;
  initialTab?: 'description' | 'workflow' | 'form' | 'versions';
  initialFormToBuild?: string | null;
  onClearInitialEditOpts?: () => void;
  exitOnCloseForm?: boolean;
}

export const ProcessEditor: React.FC<ProcessEditorProps> = ({ 
  processId, 
  onCancel, 
  onSaveSuccess,
  onOpenDraft,
  initialTab,
  initialFormToBuild,
  onClearInitialEditOpts,
  exitOnCloseForm
}) => {
  const { hasPermission } = useAuth();
  const formatDMY = (dateInput: any) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };
  const modelerRef = useRef<BpmnModelerRef | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'workflow' | 'form' | 'versions'>('description');
  const [activeFormToBuild, setActiveFormToBuild] = useState<string | null>(null);
  const [processCode, setProcessCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1');
  const [status, setStatus] = useState<'Draft' | 'Pending Review' | 'Active' | 'Superseded' | 'Retired'>('Draft');
  const [parentProcessId, setParentProcessId] = useState<string>('');
  const [allVersions, setAllVersions] = useState<Process[]>([]);
  const [versionActionLoading, setVersionActionLoading] = useState(false);
  const [roles, setRoles] = useState<string[]>(['Operator']);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [sopSignoffs, setSopSignoffs] = useState<SOPSignOffs>({
    author: { name: '', title: '' },
    reviewers: [{ name: '', title: '' }],
    authorisers: [{ name: '', title: '' }],
    effectiveDate: new Date().toISOString().split('T')[0]
  });
  // Flat editable sign-off rows (UI representation)
  const [signoffRows, setSignoffRows] = useState<Array<{role: string; name: string; title: string}>>(
    [{ role: 'Author', name: '', title: '' }, { role: 'Reviewer', name: '', title: '' }, { role: 'Authoriser', name: '', title: '' }]
  );
  const [workflowFormsData, setWorkflowFormsData] = useState<{
    [formName: string]: {
      pdfName?: string;
      pdfUrl?: string;
      pdfKey?: string;
      pdfSize?: number;
      fields?: FormDesignerField[];
      formId?: string;
      formTitle?: string;
      version?: string;
      status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      layoutBlocks?: any[];
      revisionHistory?: any[];
    }
  }>({});

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bpmnViewMode, setBpmnViewMode] = useState<'auto' | 'custom'>('auto');
  const [savingBpmn, setSavingBpmn] = useState(false);
  const [quota, setQuota] = useState<{ totalSize: number; quotaLimit: number; percentage: string; isConfigured: boolean } | null>(null);
  const [isUploading, setIsUploading] = useState<{ [formName: string]: boolean }>({});
  const [debouncedXml, setDebouncedXml] = useState('');
  const [allForms, setAllForms] = useState<any[]>([]);

  const fetchFormsList = async () => {
    try {
      const res = await fetch('/api/forms');
      if (res.ok) {
        const data = await res.json();
        setAllForms(data);
      }
    } catch (err) {
      console.error('Error fetching forms list:', err);
    }
  };

  // Handle initial tab / form builder redirection
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (initialFormToBuild) {
      setActiveFormToBuild(initialFormToBuild);
    }
    if (onClearInitialEditOpts) {
      onClearInitialEditOpts();
    }
  }, [initialTab, initialFormToBuild]);

  // Debounce diagram updates to prevent flickering when typing step action commands
  useEffect(() => {
    const xml = generateBPMNXML(steps, title || 'Untitled Process', roles || []);
    
    // If it's the first time generating XML, apply it immediately to avoid mount delay
    setDebouncedXml(prev => {
      if (!prev) {
        return xml;
      }
      return prev;
    });

    const timer = setTimeout(() => {
      setDebouncedXml(xml);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [steps, title, roles]);

  const isReadOnly = status !== 'Draft';

  const handleDeleteProcess = async () => {
    if (!processId) return;
    if (!window.confirm('Are you sure you want to delete this draft version? This action is permanent.')) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/processes/${processId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete draft version');
      alert('Draft version deleted successfully.');
      onCancel();
    } catch (err) {
      console.error(err);
      alert('Error deleting draft version.');
    } finally {
      setSaving(false);
    }
  };

  const fetchQuotaStatus = async () => {
    try {
      const res = await fetch('/api/storage/quota-status');
      if (res.ok) {
        const data = await res.json();
        setQuota(data);
      }
    } catch (err) {
      console.error('Error fetching quota status:', err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handlePdfUpload = async (formName: string, file: File) => {
    if (!processId) {
      alert('Please save the process document as a draft first before uploading files.');
      return;
    }

    setIsUploading(prev => ({ ...prev, [formName]: true }));

    try {
      // 1. Get presigned upload URL
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId,
          formName,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        })
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json();
        throw new Error(errData.error || 'Failed to get secure upload URL.');
      }

      const { uploadUrl, pdfKey } = await presignRes.json();

      // 2. Perform direct upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/pdf'
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to Cloudflare storage.');
      }

      // 3. Confirm upload with backend
      const confirmRes = await fetch('/api/storage/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId,
          formName,
          pdfName: file.name,
          pdfKey,
          pdfSize: file.size
        })
      });

      if (!confirmRes.ok) {
        throw new Error('Failed to save file references to the database.');
      }

      // 4. Update local state
      setWorkflowFormsData(prev => ({
        ...prev,
        [formName]: {
          ...prev[formName] || {},
          pdfName: file.name,
          pdfKey,
          pdfSize: file.size
        }
      }));

      // 5. Refresh quota usage
      fetchQuotaStatus();

      alert(`Successfully uploaded PDF for "${formName}".`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'An error occurred during file upload.');
    } finally {
      setIsUploading(prev => ({ ...prev, [formName]: false }));
    }
  };

  const handlePdfDelete = async (formName: string, pdfKey: string) => {
    if (!window.confirm(`Are you sure you want to delete the PDF attachment for "${formName}"? This will permanently delete the file.`)) return;

    setIsUploading(prev => ({ ...prev, [formName]: true }));

    try {
      const res = await fetch('/api/storage/delete-file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId,
          formName,
          pdfKey
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete file.');
      }

      // Update local state
      setWorkflowFormsData(prev => {
        const copy = { ...prev };
        if (copy[formName]) {
          const { pdfName, pdfKey: k, pdfSize: s, ...rest } = copy[formName];
          copy[formName] = rest;
        }
        return copy;
      });

      // Refresh quota usage
      fetchQuotaStatus();

      alert(`Successfully deleted PDF for "${formName}".`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'An error occurred while deleting the file.');
    } finally {
      setIsUploading(prev => ({ ...prev, [formName]: false }));
    }
  };


  const handleAddRole = () => {
    const trimmed = newRoleInput.trim();
    if (!trimmed) return;
    if (roles.includes(trimmed)) {
      alert('Role already exists.');
      return;
    }
    setRoles(prev => [...prev, trimmed]);
    setNewRoleInput('');
  };

  const handleDeleteRole = (roleToDelete: string) => {
    if (roles.length <= 1) {
      alert('At least one role is required.');
      return;
    }
    const stepWithRole = steps.find(s => s.role === roleToDelete);
    if (stepWithRole) {
      const stepIndex = steps.indexOf(stepWithRole) + 1;
      alert(`Cannot delete role "${roleToDelete}" because it is assigned to Step #${stepIndex}. Please re-assign that step first.`);
      return;
    }
    setRoles(prev => prev.filter(r => r !== roleToDelete));
  };

  const handleRenameRole = (oldRoleName: string) => {
    const newRoleName = window.prompt(`Rename role "${oldRoleName}" to:`, oldRoleName);
    if (!newRoleName) return;
    const trimmed = newRoleName.trim();
    if (!trimmed || trimmed === oldRoleName) return;

    if (roles.includes(trimmed)) {
      alert('A role with this name already exists.');
      return;
    }

    setRoles(prev => prev.map(r => r === oldRoleName ? trimmed : r));
    setSteps(prev => prev.map(s => s.role === oldRoleName ? { ...s, role: trimmed } : s));
  };

  // Helper to migrate legacy form-name keys to strictly formId keys
  const normalizeProcessFormsData = (proc: any, allFormsList: any[]) => {
    if (!proc || !proc.workflowFormsData) return { formsData: {}, steps: proc?.steps || [] };
    
    const formsData: Record<string, any> = {};
    const nameToIdMap: Record<string, string> = {};

    // Step 1: Normalize keys of workflowFormsData to be formId
    Object.entries(proc.workflowFormsData).forEach(([key, val]: [string, any]) => {
      if (val && typeof val === 'object') {
        const formId = val.formId || key;
        nameToIdMap[key] = formId;
        formsData[formId] = {
          ...val,
          formId,
          formTitle: val.formTitle || val.formName || key
        };
      }
    });

    // Step 2: Normalize steps to store formId instead of formName
    const steps = (proc.steps || []).map((step: any) => {
      if (step.producesForm) {
        const names = step.formNames && step.formNames.length > 0 
          ? step.formNames 
          : (step.formName ? [step.formName] : []);
          
        const normalizedNames = names.map((name: string) => {
          if (!name) return '';
          const isId = allFormsList.some(f => f.form_id === name) || name.includes('/') || name.startsWith('FM-');
          if (isId) return name;
          return nameToIdMap[name] || name;
        });

        return {
          ...step,
          formName: normalizedNames[0] || '',
          formNames: normalizedNames
        };
      }
      return step;
    });

    return { formsData, steps };
  };

  const fetchProcess = async (id: string) => {
    try {
      setLoading(true);
      // Fetch latest forms list first for normalization
      let formsList: any[] = [];
      const formsRes = await fetch('/api/forms');
      if (formsRes.ok) {
        formsList = await formsRes.json();
        setAllForms(formsList);
      }

      const res = await fetch('/api/processes');
      if (!res.ok) throw new Error('Failed to fetch');
      const list: Process[] = await res.json();
      const proc = list.find(p => p.id === id);
      if (proc) {
        setTitle(proc.title);
        setDescription(proc.description);
        setVersion(proc.version);
        setStatus(proc.status || 'Active');
        setParentProcessId(proc.parentProcessId || proc.id);
        setProcessCode(proc.parentProcessId || proc.id);
        const loadedRoles = proc.roles && proc.roles.length > 0 ? proc.roles : ['Operator'];
        setRoles(loadedRoles);

        // Normalize legacy form names to formId linkage
        const { formsData: normalizedFormsData, steps: normalizedStepsList } = normalizeProcessFormsData(proc, formsList);

        const loadedSteps = enforceStepShapes(normalizedStepsList);
        setSteps(loadedSteps);
        const hasCustomLayout = loadedSteps.some(s => s.layoutX !== undefined);
        setBpmnViewMode(hasCustomLayout ? 'custom' : 'auto');

        setFormFields(proc.formFields || []);
        const loadedSop = (proc.sopSignoffs || {}) as SOPSignOffs & { reviewer?: SOPSignOff; authoriser?: SOPSignOff };
        setSopSignoffs({
          author: loadedSop.author || { name: '', title: '' },
          reviewers: loadedSop.reviewers || (loadedSop.reviewer ? [loadedSop.reviewer] : [{ name: '', title: '' }]),
          authorisers: loadedSop.authorisers || (loadedSop.authoriser ? [loadedSop.authoriser] : [{ name: '', title: '' }]),
          effectiveDate: loadedSop.effectiveDate || new Date().toISOString().split('T')[0]
        });
        setWorkflowFormsData(normalizedFormsData);

        // Convert sopSignoffs to flat rows for UI
        const loadedSop2 = (proc.sopSignoffs || {}) as SOPSignOffs & { reviewer?: SOPSignOff; authoriser?: SOPSignOff };
        const flatRows: Array<{role: string; name: string; title: string}> = [];
        if (loadedSop2.author?.name || loadedSop2.author?.title) {
          flatRows.push({ role: 'Author', name: loadedSop2.author.name || '', title: loadedSop2.author.title || '' });
        }
        (loadedSop2.reviewers || (loadedSop2.reviewer ? [loadedSop2.reviewer] : [])).forEach(r => {
          flatRows.push({ role: 'Reviewer', name: r.name || '', title: r.title || '' });
        });
        (loadedSop2.authorisers || (loadedSop2.authoriser ? [loadedSop2.authoriser] : [])).forEach(a => {
          flatRows.push({ role: 'Authoriser', name: a.name || '', title: a.title || '' });
        });
        if (flatRows.length === 0) {
          flatRows.push({ role: 'Author', name: '', title: '' }, { role: 'Reviewer', name: '', title: '' }, { role: 'Authoriser', name: '', title: '' });
        }
        setSignoffRows(flatRows);

        // Load sibling versions for the Versions tab
        const pid = proc.parentProcessId || proc.id;
        const siblings = list.filter(p => p.parentProcessId === pid || p.id === pid);
        siblings.sort((a, b) => (parseInt(b.version, 10) || 0) - (parseInt(a.version, 10) || 0));
        setAllVersions(siblings);
      } else {
        console.error(`Process with ID ${id} not found in the loaded list.`, list);
        alert(`Không tìm thấy quy trình với ID: ${id}. Bạn sẽ được chuyển hướng về Dashboard.`);
        onCancel();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load process data.');
    } finally {
      setLoading(false);
    }
  };

  // Version lifecycle handlers (centralised here, removed from ProcessReader)
  const parseVersion = (vString: string) => {
    const match = vString.match(/v(\d+)\.(\d+)/);
    if (match) {
      return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
    }
    const num = parseInt(vString, 10);
    if (!isNaN(num)) {
      return { major: num, minor: 0 };
    }
    return { major: 0, minor: 1 };
  };

  const handleSubmitForReview = async () => {
    if (!processId) return;
    if (!window.confirm('Submit this Draft for review? Status will change to Pending Review.')) return;
    try {
      setVersionActionLoading(true);
      const payload = { id: processId, title, description, version, roles, steps, formFields: formFields.filter(f => f.checkItem.trim() !== ''), sopSignoffs, workflowFormsData, status: 'Pending Review', parentProcessId: parentProcessId || undefined };
      const res = await fetch('/api/processes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to submit for review');
      setStatus('Pending Review');
      await fetchProcess(processId);
    } catch (err) {
      console.error(err);
      alert('Error submitting for review.');
    } finally {
      setVersionActionLoading(false);
    }
  };

  const handleActivateVersion = async () => {
    if (!processId) return;
    if (!sopSignoffs.effectiveDate) {
      alert('Please set an Effective Date in the Sign-off Setup before activating.');
      return;
    }
    if (!window.confirm('Activate this version? This will mark it as the active standard.')) return;
    try {
      setVersionActionLoading(true);
      const payload = { id: processId, title, description, version, roles, steps, formFields: formFields.filter(f => f.checkItem.trim() !== ''), sopSignoffs, workflowFormsData, status: 'Active', parentProcessId: parentProcessId || undefined };
      const res = await fetch('/api/processes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to activate');
      setStatus('Active');
      await fetchProcess(processId);
    } catch (err) {
      console.error(err);
      alert('Error activating version.');
    } finally {
      setVersionActionLoading(false);
    }
  };

  const handleCreateNewDraftEditor = async () => {
    if (!processId) return;
    try {
      setVersionActionLoading(true);
      const res = await fetch(`/api/processes/${processId}/new-version`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create new draft version');
      const newDraft = await res.json();
      // Navigate directly into the new draft's editor (not back to prevPage)
      if (onOpenDraft) {
        onOpenDraft(newDraft.id);
      } else {
        onSaveSuccess(newDraft.id);
      }
    } catch (err) {
      console.error(err);
      alert('Error creating new draft version.');
    } finally {
      setVersionActionLoading(false);
    }
  };

  const handleRetireVersion = async () => {
    if (!processId) return;
    if (!window.confirm('Retire this version? It will be marked as Retired and no longer used.')) return;
    try {
      setVersionActionLoading(true);
      const payload = { id: processId, title, description, version, roles, steps, formFields: formFields.filter(f => f.checkItem.trim() !== ''), sopSignoffs, workflowFormsData, status: 'Retired', parentProcessId: parentProcessId || undefined };
      const res = await fetch('/api/processes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error('Failed to retire');
      setStatus('Retired');
      await fetchProcess(processId);
    } catch (err) {
      console.error(err);
      alert('Error retiring version.');
    } finally {
      setVersionActionLoading(false);
    }
  };

  const handleAddStep = () => {
    const newStep: ProcessStep = {
      id: 'step_' + Date.now() + Math.random().toString(36).substr(2, 5),
      role: roles[0] || 'Operator',
      action: '',
      bpmnShape: 'task'
    };
    setSteps(prev => enforceStepShapes([...prev, newStep]));
  };

  const handleRemoveStep = (index: number) => {
    setSteps(prev => {
      const oldSteps = [...prev];
      const removedStepId = prev[index]?.id;
      const filtered = prev.filter((_, i) => i !== index);
      const connected = updateSequentialConnections(oldSteps, filtered);

      const resetStepIds = new Set<string>();
      if (removedStepId) {
        resetStepIds.add(removedStepId);
      }

      const updated = connected.map((step, idx) => {
        if (idx >= index) {
          const resetStep = { ...step };
          delete resetStep.layoutX;
          delete resetStep.layoutY;
          delete resetStep.layoutWaypointsMap;
          delete resetStep.layoutCatchWaypoints;
          delete resetStep.labelX;
          delete resetStep.labelY;
          delete resetStep.labelW;
          delete resetStep.labelH;
          resetStepIds.add(resetStep.id);
          return resetStep;
        }
        return step;
      });

      const finalSteps = updated.map((step, idx) => {
        if (idx < index && step.layoutWaypointsMap) {
          const newMap = { ...step.layoutWaypointsMap };
          let changed = false;
          for (const targetId in newMap) {
            if (resetStepIds.has(targetId)) {
              delete newMap[targetId];
              changed = true;
            }
          }
          if (changed) {
            return {
              ...step,
              layoutWaypointsMap: Object.keys(newMap).length > 0 ? newMap : undefined
            };
          }
        }
        return step;
      });

      return enforceStepShapes(finalSteps);
    });
  };

  const handleStepChange = (index: number, field: keyof ProcessStep, value: string | boolean) => {
    setSteps(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return enforceStepShapes(updated);
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === steps.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const minIdx = Math.min(index, targetIndex);

    setSteps(prev => {
      const oldSteps = [...prev];
      const swapped = [...prev];
      const temp = swapped[index];
      swapped[index] = swapped[targetIndex];
      swapped[targetIndex] = temp;

      const connected = updateSequentialConnections(oldSteps, swapped);

      const resetStepIds = new Set<string>();
      const updated = connected.map((step, idx) => {
        if (idx >= minIdx) {
          const resetStep = { ...step };
          delete resetStep.layoutX;
          delete resetStep.layoutY;
          delete resetStep.layoutWaypointsMap;
          delete resetStep.layoutCatchWaypoints;
          delete resetStep.labelX;
          delete resetStep.labelY;
          delete resetStep.labelW;
          delete resetStep.labelH;
          resetStepIds.add(resetStep.id);
          return resetStep;
        }
        return step;
      });

      const finalSteps = updated.map((step, idx) => {
        if (idx < minIdx && step.layoutWaypointsMap) {
          const newMap = { ...step.layoutWaypointsMap };
          let changed = false;
          for (const targetId in newMap) {
            if (resetStepIds.has(targetId)) {
              delete newMap[targetId];
              changed = true;
            }
          }
          if (changed) {
            return {
              ...step,
              layoutWaypointsMap: Object.keys(newMap).length > 0 ? newMap : undefined
            };
          }
        }
        return step;
      });

      return enforceStepShapes(finalSteps);
    });
  };

  const handleAddFormField = () => {
    const newField: FormField = {
      id: 'field_' + Date.now() + Math.random().toString(36).substr(2, 5),
      checkItem: '',
      locationCode: '',
      targetRange: '',
      reactionProtocol: '',
      frequency: 'Once/Shift'
    };
    setFormFields(prev => [...prev, newField]);
  };



  const handleSaveBpmnPositions = async (data: {
    positions: { id: string; x: number; y: number; labelX?: number; labelY?: number; labelW?: number; labelH?: number }[];
    waypoints: { id: string; sourceId: string; targetId: string; waypoints: { x: number; y: number }[] }[];
  }) => {
    if (!processId) {
      alert('Please save the process first to enable custom layout saving.');
      return;
    }
    try {
      setSavingBpmn(true);
      const { positions, waypoints } = data;
      const updatedSteps = steps.map(step => {
        const match = positions.find(pos => pos.id === step.id);
        const stepWaypoints = waypoints.filter(wp => wp.sourceId === step.id);
        const layoutWaypointsMap: { [targetId: string]: { x: number; y: number }[] } = {};
        stepWaypoints.forEach(wp => {
          layoutWaypointsMap[wp.targetId] = wp.waypoints;
        });
        const incomingCatchFlow = waypoints.find(wp => wp.targetId === step.id && wp.sourceId.startsWith('LinkCatch_'));

        const updatedStep = { ...step };
        if (match) {
          updatedStep.layoutX = Math.round(match.x);
          updatedStep.layoutY = Math.round(match.y);
          if (match.labelX !== undefined && match.labelY !== undefined) {
            updatedStep.labelX = match.labelX;
            updatedStep.labelY = match.labelY;
            updatedStep.labelW = match.labelW;
            updatedStep.labelH = match.labelH;
          } else {
            delete updatedStep.labelX;
            delete updatedStep.labelY;
            delete updatedStep.labelW;
            delete updatedStep.labelH;
          }
        }
        if (Object.keys(layoutWaypointsMap).length > 0) {
          updatedStep.layoutWaypointsMap = layoutWaypointsMap;
        } else {
          delete updatedStep.layoutWaypointsMap;
        }
        if (incomingCatchFlow) {
          updatedStep.layoutCatchWaypoints = incomingCatchFlow.waypoints;
        } else {
          delete updatedStep.layoutCatchWaypoints;
        }
        return updatedStep;
      });
      setSteps(updatedSteps);

      // Save updated steps structure to process database
      const processPayload = {
        id: processId,
        title,
        description,
        version,
        roles,
        steps: updatedSteps,
        formFields: formFields.filter(f => f.checkItem.trim() !== ''),
        sopSignoffs,
        workflowFormsData
      };

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processPayload)
      });

      if (!res.ok) throw new Error('Failed to save layout');
    } catch (err) {
      console.error('Failed to save layout:', err);
      alert('Failed to save diagram layout.');
    } finally {
      setSavingBpmn(false);
    }
  };

  const handleResetBpmnPositions = async () => {
    if (!processId) return;
    if (!window.confirm('Are you sure you want to discard your custom layout and reset to the auto-generated layout? All manual spacing will be lost.')) {
      return;
    }
    try {
      setSavingBpmn(true);
      const updatedSteps = steps.map(step => {
        const copy = { ...step };
        delete copy.layoutX;
        delete copy.layoutY;
        delete copy.layoutWaypointsMap;
        delete copy.layoutCatchWaypoints;
        delete copy.labelX;
        delete copy.labelY;
        delete copy.labelW;
        delete copy.labelH;
        return copy;
      });
      setSteps(updatedSteps);

      // Save updated steps structure to process database
      const processPayload = {
        id: processId,
        title,
        description,
        version,
        roles,
        steps: updatedSteps,
        formFields: formFields.filter(f => f.checkItem.trim() !== ''),
        sopSignoffs,
        workflowFormsData
      };

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processPayload)
      });

      if (!res.ok) throw new Error('Failed to reset layout');
      setBpmnViewMode('auto');
    } catch (err) {
      console.error('Failed to reset layout:', err);
      alert('Failed to reset diagram layout.');
    } finally {
      setSavingBpmn(false);
    }
  };

  const handleSave = async (customFormsData?: Record<string, any>, isSilent: boolean = false) => {
    if (!title.trim()) {
      alert('Please enter a process title.');
      return;
    }

    const cleanCode = processCode.trim();
    if (!cleanCode) {
      alert('Please enter a process ID.');
      return;
    }
    const idRegex = /^[a-zA-Z0-9_-]+$/;
    if (!idRegex.test(cleanCode)) {
      alert('Process ID can only contain alphanumeric characters, underscores, and hyphens (no spaces, slashes, or special characters).');
      return;
    }

    // Uniqueness validation (check-id)
    const currentFamilyId = parentProcessId || processId;
    try {
      const checkRes = await fetch(`/api/processes/check-id?id=${encodeURIComponent(cleanCode)}${currentFamilyId ? '&exclude=' + encodeURIComponent(currentFamilyId) : ''}`);
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.available) {
          alert('Process ID already in use. Please choose a different one.');
          return;
        }
      }
    } catch (err) {
      console.error('Error checking ID uniqueness:', err);
    }

    // Filter out steps with empty actions
    const filteredSteps = steps.filter(s => s.action.trim() !== '');
    if (filteredSteps.length === 0) {
      alert('Please add at least one workflow step with an action.');
      return;
    }

    // Filter out empty form fields
    const filteredFields = formFields.filter(f => f.checkItem.trim() !== '');

    // Update positions from modeler if custom layout is active and modeler is mounted
    let stepsToSave = filteredSteps;
    if (bpmnViewMode === 'custom' && modelerRef.current) {
      const { positions, waypoints } = modelerRef.current.getPositions();
      stepsToSave = filteredSteps.map(step => {
        const match = positions.find(pos => pos.id === step.id);
        const stepWaypoints = waypoints.filter(wp => wp.sourceId === step.id);
        const layoutWaypointsMap: { [targetId: string]: { x: number; y: number }[] } = {};
        stepWaypoints.forEach(wp => {
          layoutWaypointsMap[wp.targetId] = wp.waypoints;
        });
        const incomingCatchFlow = waypoints.find(wp => wp.targetId === step.id && wp.sourceId.startsWith('LinkCatch_'));

        const updatedStep = { ...step };
        if (match) {
          updatedStep.layoutX = Math.round(match.x);
          updatedStep.layoutY = Math.round(match.y);
          if (match.labelX !== undefined && match.labelY !== undefined) {
            updatedStep.labelX = match.labelX;
            updatedStep.labelY = match.labelY;
            updatedStep.labelW = match.labelW;
            updatedStep.labelH = match.labelH;
          } else {
            delete updatedStep.labelX;
            delete updatedStep.labelY;
            delete updatedStep.labelW;
            delete updatedStep.labelH;
          }
        }
        if (Object.keys(layoutWaypointsMap).length > 0) {
          updatedStep.layoutWaypointsMap = layoutWaypointsMap;
        } else {
          delete updatedStep.layoutWaypointsMap;
        }
        if (incomingCatchFlow) {
          updatedStep.layoutCatchWaypoints = incomingCatchFlow.waypoints;
        } else {
          delete updatedStep.layoutCatchWaypoints;
        }
        return updatedStep;
      });
      // Update steps state to match what we are saving
      setSteps(stepsToSave);
    }

    // Clean up workflowFormsData by only keeping forms currently declared in steps
    const activeFormNames: string[] = [];
    stepsToSave.forEach(s => {
      if (s.bpmnShape === 'task' && s.producesForm) {
        const names = s.formNames && s.formNames.length > 0
          ? s.formNames.map(n => n.trim()).filter(Boolean)
          : (s.formName ? [s.formName.trim()] : []);
        names.forEach(name => {
          if (!activeFormNames.includes(name)) {
            activeFormNames.push(name);
          }
        });
      }
    });

    const cleanedFormsData: Record<string, any> = {};
    activeFormNames.forEach(name => {
      const dataSrc = customFormsData || workflowFormsData;
      if (name && dataSrc[name]) {
        cleanedFormsData[name] = dataSrc[name];
      }
    });

    // Convert flat signoffRows to legacy sopSignoffs structure for API compatibility
    const authorRow = signoffRows.find(r => r.role.toLowerCase() === 'author');
    const reviewerRowsList = signoffRows.filter(r => r.role.toLowerCase() === 'reviewer' || r.role.toLowerCase() === 'reviewers');
    const authoriserRowsList = signoffRows.filter(r => r.role.toLowerCase() === 'authoriser' || r.role.toLowerCase() === 'authorisers');
    const otherRows = signoffRows.filter(r => !['author','reviewer','reviewers','authoriser','authorisers'].includes(r.role.toLowerCase()));
    // Other roles become extra reviewers
    const allReviewers = [...reviewerRowsList, ...otherRows];
    const sopSignoffsToSave: SOPSignOffs = {
      author: authorRow ? { name: authorRow.name, title: authorRow.title } : { name: '', title: '' },
      reviewers: allReviewers.map(r => ({ name: r.name, title: r.title })),
      authorisers: authoriserRowsList.map(r => ({ name: r.name, title: r.title })),
      effectiveDate: sopSignoffs.effectiveDate
    };

    const isFamilyRename = processId && cleanCode !== currentFamilyId;

    const processPayload = {
      id: processId || cleanCode,
      parentProcessId: parentProcessId || cleanCode,
      oldParentProcessId: isFamilyRename ? currentFamilyId : undefined,
      newParentProcessId: isFamilyRename ? cleanCode : undefined,
      status,
      title,
      description,
      version,
      roles,
      steps: stepsToSave,
      formFields: filteredFields,
      sopSignoffs: sopSignoffsToSave,
      workflowFormsData: cleanedFormsData
    };

    try {
      setSaving(true);
      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processPayload)
      });

      if (!res.ok) throw new Error('Failed to save');
      const saved = await res.json();
      if (!isSilent) {
        onSaveSuccess(saved.id);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save process. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (processId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchProcess(processId);
      fetchQuotaStatus();
      fetchFormsList();
    } else {
      // Initialize with default Start step and one form field
      setStatus('Draft');
      setParentProcessId('');
      setProcessCode('proc_' + Date.now());
      setVersion('1');
      const step1: ProcessStep = {
        id: 'step_start_' + Math.random().toString(36).substr(2, 5),
        role: 'Operator',
        action: 'Order received',
        bpmnShape: 'start-event'
      };
      setSteps([step1]);
      handleAddFormField();
      fetchQuotaStatus();
      fetchFormsList();

      if (initialFormToBuild) {
        (async () => {
          try {
            const res = await fetch(`/api/forms/${encodeURIComponent(initialFormToBuild)}`);
            if (res.ok) {
              const formRecord = await res.json();
              const layoutBlocks = typeof formRecord.layout_blocks === 'string'
                ? JSON.parse(formRecord.layout_blocks)
                : (formRecord.layout_blocks || []);
              
              setWorkflowFormsData({
                [initialFormToBuild]: {
                  formId: initialFormToBuild,
                  formTitle: formRecord.form_title || formRecord.form_name || initialFormToBuild,
                  version: formRecord.version || 'v0.1',
                  status: formRecord.status || 'DRAFT',
                  layoutBlocks
                }
              });

              // Add a Task step that produces this form
              const step2: ProcessStep = {
                id: 'step_task_' + Math.random().toString(36).substr(2, 5),
                role: 'Operator',
                action: 'Điền biểu mẫu ' + (formRecord.form_title || formRecord.form_name || initialFormToBuild),
                bpmnShape: 'task',
                producesForm: true,
                formNames: [initialFormToBuild]
              };
              setSteps([step1, step2]);
            }
          } catch (err) {
            console.error('Error preloading unlinked form template:', err);
          }
        })();
      }
    }
  }, [processId]);

  useEffect(() => {
    if (activeTab === 'form') {
      fetchQuotaStatus();
    }
  }, [activeTab]);



  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading process editor...</p>
      </div>
    );
  }

  const workflowForms: string[] = [];
  steps.forEach(s => {
    if (s.bpmnShape === 'task' && s.producesForm) {
      const names = s.formNames && s.formNames.length > 0
        ? s.formNames.map((n: string) => n.trim()).filter(Boolean)
        : (s.formName ? [s.formName.trim()] : []);
      names.forEach((name: string) => {
        // Only match by form_id — no legacy name matching
        if (name && !workflowForms.includes(name)) {
          workflowForms.push(name);
        }
      });
    }
  });


  const { major, minor } = parseVersion(version);

  return (
    <div>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Tab Selection Row containing Actions */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid var(--neutral-border)', 
          marginBottom: '1.5rem', 
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '-1px' }}>
            {(['description', 'workflow', 'form', 'versions'] as const).map((tab) => {
              const tabLabels: Record<string, string> = {
                description: 'Description',
                workflow: `Workflow (${steps.length})`,
                form: `Form (${workflowForms.length})`,
                versions: 'Versions'
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="btn btn-secondary"
                  style={{
                    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                    borderRadius: '4px 4px 0 0',
                    background: activeTab === tab ? '#ffffff' : 'transparent',
                    boxShadow: 'none',
                    fontWeight: activeTab === tab ? 600 : 400,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.82rem',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none'
                  }}
                >
                  {tab === 'versions' && <GitBranch size={13} />}
                  {tabLabels[tab]}
                </button>
              );
            })}
          </div>

          {/* Compact Action Buttons on the right side of the Tab Row */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', paddingBottom: '0.3rem' }}>
            {processId && hasPermission('version_document') && !isReadOnly && (
              <button 
                className="btn btn-outline-danger btn-sm" 
                onClick={handleDeleteProcess} 
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                title="Delete this draft version"
              >
                <Trash2 size={13} />
                Delete
              </button>
            )}
            {!isReadOnly && (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleSave} 
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.6rem', fontSize: '0.75rem', margin: 0 }}
              >
                <Save size={13} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: DESCRIPTION */}
        {activeTab === 'description' && (
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }} disabled={isReadOnly}>
            <div className="paper-card accent-teal">
            <h2 style={{ borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Process Description &amp; Metadata</h2>



            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Process Title*</label>
              <input
                type="text"
                placeholder="e.g. Cleaning-in-Place (CIP) Fermentation Tank"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Process Description</label>
              <textarea
                rows={3}
                placeholder="Summarize the core goal of this workflow and when it should be executed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem', borderTop: '1px dashed var(--neutral-border)', paddingTop: '1.5rem' }}>
              <label className="form-label">Involved Roles*</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.5rem', border: '1px solid var(--neutral-border)', borderRadius: 'var(--component-radius)', minHeight: '42px', background: '#f9fafb' }}>
                {roles.map((role) => (
                  <span 
                    key={role} 
                    className="badge" 
                    style={{ 
                      backgroundColor: 'var(--primary)', 
                      color: '#ffffff', 
                      padding: '0.25rem 0.55rem', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.4rem',
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.8rem',
                      borderRadius: '4px'
                    }}
                  >
                    <span>{role}</span>
                    {!isReadOnly && (
                      <button 
                        type="button" 
                        onClick={() => handleRenameRole(role)}
                        title="Rename role"
                        style={{ 
                          border: 'none', 
                          background: 'transparent', 
                          color: 'rgba(255, 255, 255, 0.75)', 
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                    {!isReadOnly && (
                      <button 
                        type="button" 
                        onClick={() => handleDeleteRole(role)}
                        title="Delete role"
                        style={{ 
                          border: 'none', 
                          background: 'transparent', 
                          color: 'rgba(255, 255, 255, 0.75)', 
                          cursor: 'pointer',
                          padding: 0,
                          lineHeight: 1,
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '400px' }}>
                  <input
                    type="text"
                    placeholder="e.g. Supervisor"
                    value={newRoleInput}
                    onChange={(e) => setNewRoleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRole();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleAddRole}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

          </div>
          </fieldset>
        )}

        {/* TAB 4: VERSIONS */}
        {activeTab === 'versions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Section A: Version Card + Lifecycle Actions */}             {/* Gộp toàn bộ thành một Toolbar ngang duy nhất */}
             <div style={{
               display: 'flex',
               justifyContent: 'space-between',
               alignItems: 'center',
               padding: '0.65rem 1rem',
               background: '#f8fafc',
               border: '1px solid var(--neutral-border)',
               borderRadius: '8px',
               gap: '1rem',
               flexWrap: 'wrap'
             }}>
               {/* Bên trái: Các trường nhập liệu nhanh (Version & Effective Date) */}
               <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                 {/* Phiên bản */}
                 {(status === 'Draft' || status === 'Pending Review') ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                     <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>V</span>
                     <input 
                       type="number" 
                       min="0"
                       value={major} 
                       onChange={(e) => setVersion(`v${parseInt(e.target.value, 10) || 0}.${minor}`)} 
                       style={{ 
                         width: '40px', 
                         padding: '0.15rem 0.25rem', 
                         fontSize: '0.8rem', 
                         border: '1px solid var(--neutral-border)', 
                         borderRadius: '4px',
                         textAlign: 'center',
                         fontWeight: 700
                       }} 
                     />
                     <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>.</span>
                     <input 
                       type="number" 
                       min="0"
                       value={minor} 
                       onChange={(e) => setVersion(`v${major}.${parseInt(e.target.value, 10) || 0}`)} 
                       style={{ 
                         width: '40px', 
                         padding: '0.15rem 0.25rem', 
                         fontSize: '0.8rem', 
                         border: '1px solid var(--neutral-border)', 
                         borderRadius: '4px',
                         textAlign: 'center',
                         fontWeight: 700
                       }} 
                     />
                   </div>
                 ) : (
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {/^[vV]/.test(version || '') ? 'V' + (version || '').trim().slice(1) : 'V' + (version || '').trim()}
                    </span>
                 )}

                 {/* Ngày hiệu lực */}
                 {(status === 'Draft' || status === 'Pending Review') ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                     <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                     <input 
                       type="date" 
                       value={sopSignoffs.effectiveDate || ''} 
                       onChange={(e) => setSopSignoffs(prev => ({ ...prev, effectiveDate: e.target.value }))} 
                       style={{ 
                         padding: '0.15rem 0.25rem', 
                         fontSize: '0.8rem', 
                         border: 'none',
                         background: 'transparent',
                         outline: 'none',
                         color: 'var(--text-primary)',
                         width: '115px'
                       }} 
                     />
                   </div>
                 ) : (
                   sopSignoffs.effectiveDate && (
                     <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                       <Calendar size={12} />
                       Effective: <strong style={{ color: 'var(--text-secondary)' }}>{new Date(sopSignoffs.effectiveDate).toLocaleDateString()}</strong>
                     </span>
                   )
                 )}
               </div>

               {/* Bên phải: Luồng trạng thái tích hợp các hành động nhỏ gọn */}
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                 {/* DRAFT */}
                 <span style={{
                   padding: '0.2rem 0.45rem',
                   borderRadius: '4px',
                   fontWeight: 700,
                   fontSize: '0.68rem',
                   textTransform: 'uppercase',
                   background: status === 'Draft' ? '#fffbeb' : '#f1f5f9',
                   color: status === 'Draft' ? '#b45309' : '#94a3b8',
                   border: status === 'Draft' ? '1px solid #fde68a' : '1px solid #e2e8f0',
                   letterSpacing: '0.5px'
                 }}>
                   Draft
                 </span>

                 <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                   {status === 'Draft' ? (
                     <button
                       className="btn btn-primary btn-sm hover-card-bg"
                       onClick={handleSubmitForReview}
                       disabled={versionActionLoading}
                       style={{
                         padding: '0.2rem 0.5rem',
                         fontSize: '0.68rem',
                         margin: '0 0.25rem',
                         display: 'inline-flex',
                         alignItems: 'center',
                         gap: '0.2rem',
                         background: 'var(--primary)',
                         border: '1px solid var(--primary)',
                         color: '#ffffff',
                         borderRadius: '4px',
                         boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                         fontWeight: 700,
                         textTransform: 'uppercase',
                         letterSpacing: '0.5px'
                       }}
                     >
                       Submit →
                     </button>
                   ) : (
                     '→'
                   )}
                 </span>

                 {/* PENDING REVIEW */}
                 <span style={{
                   padding: '0.2rem 0.45rem',
                   borderRadius: '4px',
                   fontWeight: 700,
                   fontSize: '0.68rem',
                   textTransform: 'uppercase',
                   background: status === 'Pending Review' ? '#eff6ff' : '#f1f5f9',
                   color: status === 'Pending Review' ? '#1d4ed8' : '#94a3b8',
                   border: status === 'Pending Review' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                   letterSpacing: '0.5px'
                 }}>
                   Review
                 </span>

                 <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                   {(status === 'Draft' || status === 'Pending Review') ? (
                     <button
                       className="btn btn-primary btn-sm hover-card-bg"
                       onClick={handleActivateVersion}
                       disabled={versionActionLoading}
                       style={{
                         padding: '0.2rem 0.5rem',
                         fontSize: '0.68rem',
                         margin: '0 0.25rem',
                         display: 'inline-flex',
                         alignItems: 'center',
                         gap: '0.2rem',
                         background: 'var(--primary)',
                         border: '1px solid var(--primary)',
                         color: '#ffffff',
                         borderRadius: '4px',
                         boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                         fontWeight: 700,
                         textTransform: 'uppercase',
                         letterSpacing: '0.5px'
                       }}
                     >
                       Activate →
                     </button>
                   ) : (
                     '→'
                   )}
                 </span>

                 {/* ACTIVE */}
                 <span style={{
                   padding: '0.2rem 0.45rem',
                   borderRadius: '4px',
                   fontWeight: 700,
                   fontSize: '0.68rem',
                   textTransform: 'uppercase',
                   background: status === 'Active' ? '#ecfdf5' : '#f1f5f9',
                   color: status === 'Active' ? '#047857' : '#94a3b8',
                   border: status === 'Active' ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                   letterSpacing: '0.5px'
                 }}>
                   Active
                 </span>

                 <span style={{ color: '#94a3b8' }}>→</span>

                 {/* RETIRED */}
                 <span style={{
                   padding: '0.2rem 0.45rem',
                   borderRadius: '4px',
                   fontWeight: 700,
                   fontSize: '0.68rem',
                   textTransform: 'uppercase',
                   background: status === 'Retired' ? '#fef2f2' : '#f1f5f9',
                   color: status === 'Retired' ? '#b91c1c' : '#94a3b8',
                   border: status === 'Retired' ? '1px solid #fecaca' : '1px solid #e2e8f0',
                   letterSpacing: '0.5px'
                 }}>
                   Retired
                 </span>

                 {/* Các nút hành động đặc biệt ở cuối nếu cần (New Version/Retire) */}
                 {processId && (
                   <div style={{ display: 'flex', gap: '0.35rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.5rem', marginLeft: '0.25rem' }}>
                     {(status === 'Active' || status === 'Pending Review') && (
                       <button
                         className="btn btn-secondary btn-sm"
                         onClick={handleCreateNewDraftEditor}
                         disabled={versionActionLoading}
                         style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.45rem', fontSize: '0.68rem', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}
                       >
                         <Plus size={11} /> New Draft
                       </button>
                     )}
                     {status === 'Active' && (
                       <button
                         className="btn btn-outline-danger btn-sm"
                         onClick={handleRetireVersion}
                         disabled={versionActionLoading}
                         style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.45rem', fontSize: '0.68rem', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}
                       >
                         <XCircle size={11} /> Retire
                       </button>
                     )}
                   </div>
                 )}
               </div>
             </div>

            {/* Section B+C: Sign-off Setup + Version History (merged) */}
            <div style={{
              backgroundColor: 'var(--neutral-card)',
              border: '1px solid var(--neutral-border)',
              borderLeft: '4px solid var(--primary)',
              borderRadius: 'var(--card-radius)',
              padding: '1rem',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                <Shield size={13} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Sign-off Setup</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: '0.35rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '22%' }}>Role</th>
                      <th style={{ textAlign: 'left', paddingBottom: '0.35rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '35%', paddingLeft: '0.4rem' }}>Name</th>
                      <th style={{ textAlign: 'left', paddingBottom: '0.35rem', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingLeft: '0.4rem' }}>Work Title</th>
                      <th style={{ width: '30px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                  {signoffRows.map((row, idx) => (
                    <tr key={idx} style={{ borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)' }}>
                      <td style={{ padding: '0.25rem 0', verticalAlign: 'middle' }}>
                        <input
                          type="text"
                          placeholder="e.g. Author"
                          value={row.role}
                          onChange={(e) => {
                            const next = [...signoffRows];
                            next[idx] = { ...next[idx], role: e.target.value };
                            setSignoffRows(next);
                          }}
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', margin: 0, width: '100%', background: '#ffffff', fontWeight: 600 }}
                        />
                      </td>
                      <td style={{ padding: '0.25rem 0.35rem', verticalAlign: 'middle' }}>
                        <input
                          type="text"
                          placeholder="Full name"
                          value={row.name}
                          onChange={(e) => {
                            const next = [...signoffRows];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setSignoffRows(next);
                          }}
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', margin: 0, width: '100%' }}
                        />
                      </td>
                      <td style={{ padding: '0.25rem 0.35rem', verticalAlign: 'middle' }}>
                        <input
                          type="text"
                          placeholder="Work title"
                          value={row.title}
                          onChange={(e) => {
                            const next = [...signoffRows];
                            next[idx] = { ...next[idx], title: e.target.value };
                            setSignoffRows(next);
                          }}
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', margin: 0, width: '100%' }}
                        />
                      </td>
                      <td style={{ width: '30px', padding: '0.25rem 0 0.25rem 0.3rem', textAlign: 'center', verticalAlign: 'middle' }}>
                        {signoffRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSignoffRows(prev => prev.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.15rem', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                            title="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSignoffRows(prev => [...prev, { role: '', name: '', title: '' }])}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Plus size={12} /> Add Row
              </button>
              <div style={{ borderTop: '1px solid var(--neutral-border)', margin: '0.85rem 0 0.7rem' }} />

              {/* Side-by-side Grid Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', alignItems: 'start', marginTop: '0.5rem' }}>
                {/* Left Column: Process ID */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    <GitBranch size={13} style={{ color: 'var(--text-secondary)' }} />
                    Process ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. shipping_process"
                    value={processCode}
                    onChange={(e) => setProcessCode(e.target.value)}
                    disabled={status !== 'Draft' || isReadOnly}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      padding: '0.35rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--neutral-border)',
                      width: '100%',
                      boxSizing: 'border-box',
                      backgroundColor: (status !== 'Draft' || isReadOnly) ? '#f1f5f9' : '#ffffff'
                    }}
                  />
                </div>

                {/* Right Column: Version History */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem' }}>
                    <GitBranch size={13} style={{ color: '#94a3b8' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Version History</span>
                  </div>

                  {allVersions.length === 0 ? (
                    <div style={{ padding: '0.65rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--neutral-border)', borderRadius: '5px' }}>
                      No version history available.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {allVersions.map((v) => {
                        const vStatus = v.status || 'Active';
                        const isCurrent = v.id === processId;
                        const vColors = {
                          'Draft': { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' },
                          'Pending Review': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
                          'Active': { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
                          'Retired': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
                          'Superseded': { bg: '#e5e7eb', text: '#374151', border: '#d1d5db' },
                        }[vStatus] || { bg: '#e5e7eb', text: '#4b5563', border: '#cbd5e1' };
                        return (
                          <div
                            key={v.id}
                            onClick={!isCurrent ? () => onOpenDraft ? onOpenDraft(v.id) : onSaveSuccess(v.id) : undefined}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.4rem 0.7rem',
                              background: isCurrent ? '#f0fdfa' : '#f9fafb',
                              borderRadius: '5px',
                              border: isCurrent ? '1px solid #99f6e4' : '1px solid var(--neutral-border)',
                              fontSize: '0.78rem',
                              cursor: isCurrent ? 'default' : 'pointer',
                              transition: 'background 0.15s, border-color 0.15s',
                            }}
                            onMouseEnter={e => { if (!isCurrent) { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.borderColor = '#7dd3fc'; } }}
                            onMouseLeave={e => { if (!isCurrent) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = 'var(--neutral-border)'; } }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {/^[vV]/.test(v.version || '') ? 'V' + (v.version || '').trim().slice(1) : 'V' + (v.version || '').trim()}
                              </span>
                              {isCurrent && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '0.05rem 0.3rem', borderRadius: '3px', textTransform: 'uppercase' }}>Current</span>}
                              <span className="badge" style={{ backgroundColor: vColors.bg, color: vColors.text, border: `1px solid ${vColors.border}`, fontSize: '0.65rem', padding: '0.05rem 0.35rem', textTransform: 'uppercase', fontWeight: 700 }}>{vStatus}</span>
                               {v.sopSignoffs?.effectiveDate ? (
                                <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.2rem' }} title="Effective Date">
                                  <Calendar size={11} /> {formatDMY(v.sopSignoffs.effectiveDate)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  Updated: {formatDMY(v.lastUpdated)}
                                </span>
                              )}
                            </div>
                            {!isCurrent && (
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem', marginLeft: '0.5rem', flexShrink: 0 }}>→</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WORKFLOW BUILDER */}
        {activeTab === 'workflow' && (
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }} disabled={isReadOnly}>
            <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Process Flowchart
                </span>
                {processId ? (
                  <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <button
                      type="button"
                      onClick={() => setBpmnViewMode('auto')}
                      className={`btn btn-sm ${bpmnViewMode === 'auto' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ margin: 0, padding: '4px 8px', fontSize: '0.75rem', border: 'none', boxShadow: bpmnViewMode === 'auto' ? undefined : 'none', background: bpmnViewMode === 'auto' ? undefined : 'transparent' }}
                    >
                      Auto-Layout
                    </button>
                    <button
                      type="button"
                      onClick={() => setBpmnViewMode('custom')}
                      className={`btn btn-sm ${bpmnViewMode === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ margin: 0, padding: '4px 8px', fontSize: '0.75rem', border: 'none', boxShadow: bpmnViewMode === 'custom' ? undefined : 'none', background: bpmnViewMode === 'custom' ? undefined : 'transparent' }}
                    >
                      Custom Layout
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    (Save process first to enable custom layout designer)
                  </span>
                )}
              </div>

              {bpmnViewMode === 'custom' && processId && !isReadOnly ? (
                <div>
                  <BpmnModelerComponent
                    ref={modelerRef}
                    xml={debouncedXml}
                    onSavePositions={handleSaveBpmnPositions}
                    onReset={handleResetBpmnPositions}
                    isSaving={savingBpmn}
                  />
                  <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef3c7', border: '1px solid #fcd34d', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
                    <span>⚠️</span>
                    <span>
                      <strong>Custom layout active.</strong> Changes to the steps checklist/roles below will not automatically update this custom diagram. To sync again, you can edit the diagram manually or click <strong>Reset to Auto-Layout</strong> to re-align dynamically.
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                   <BpmnViewerComponent xml={debouncedXml} />
                </div>
              )}
            </div>

            <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
              Define sequential actions. Each step generates a swimlane block representing task handoffs.
            </p>
            {/* Header Row */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '50px 1fr 180px 150px 180px 120px', 
              background: '#f8fafc', 
              border: '1px solid #cbd5e1',
              borderRadius: '6px', 
              padding: '0.6rem 0.75rem',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '0.5rem',
              gap: '0.5rem'
            }}>
              <div>#</div>
              <div>Action Command*</div>
              <div>Responsible Role</div>
              <div>Shape</div>
              <div>Connects to</div>
              <div style={{ textAlign: 'center' }}>Actions</div>
            </div>

            {/* Rows list */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {steps.map((step, index) => {
                const isGateway = step.bpmnShape === 'exclusive-gateway';
                const hasFormOption = step.bpmnShape === 'task' || !step.bpmnShape;
                const isStart = step.bpmnShape === 'start-event';

                let borderLeftColor = '#10a3a3'; // Default task (Teal)
                if (step.bpmnShape === 'start-event') {
                  borderLeftColor = '#10b981'; // Start (Emerald Green)
                } else if (step.bpmnShape === 'exclusive-gateway') {
                  borderLeftColor = '#f59e0b'; // Gateway (Amber Gold)
                } else if (step.bpmnShape === 'end-event' || step.bpmnShape === 'message-end-event') {
                  borderLeftColor = '#ef4444'; // End (Rose/Red)
                }

                return (
                  <React.Fragment key={step.id}>
                    {/* Individual Step Card */}
                    <div style={{
                      border: '1px solid #cbd5e1',
                      borderLeft: `3.5px solid ${borderLeftColor}`,
                      borderRadius: '6px',
                      background: '#ffffff',
                      marginBottom: '0.5rem',
                      overflow: 'hidden',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                      {/* Main Row */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '50px 1fr 180px 150px 180px 120px', 
                        padding: '0.4rem 0.75rem',
                        alignItems: 'center',
                        background: '#ffffff',
                        gap: '0.5rem'
                      }} className="step-table-row">
                        {/* Step Number */}
                        <div style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          #{index + 1}
                        </div>

                        {/* Action Command Input */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <input
                            type="text"
                            placeholder={
                              step.bpmnShape === 'start-event' || step.bpmnShape === 'end-event' || step.bpmnShape === 'message-end-event'
                                ? '[Noun] [Passive Verb]'
                                : step.bpmnShape === 'exclusive-gateway'
                                  ? '[Question]'
                                  : '[Verb] [Noun] [Target]'
                            }
                            value={step.action}
                            onChange={(e) => handleStepChange(index, 'action', e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '0.35rem 0.5rem', 
                              fontSize: '0.9rem', 
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              borderRadius: '4px',
                              border: '1px solid var(--neutral-border)',
                              margin: 0
                            }}
                          />
                          {/* Form Button/Input inside the Action column, rendered inline right below it */}
                          {hasFormOption && (() => {
                            const currentFormNames = step.formNames && step.formNames.length > 0 
                              ? step.formNames 
                              : (step.formName ? [step.formName] : []);

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', marginTop: '2px' }}>
                                {step.producesForm && currentFormNames.map((formName, fIdx) => (
                                  <div key={fIdx} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', width: '100%' }}>
                                    <select
                                      value={formName || ''}
                                      onChange={(e) => {
                                        const selectedValue = e.target.value;
                                        if (selectedValue === 'NEW_FORM') {
                                          const newId = prompt("Nhập mã Form ID mới (ví dụ: 3S-QC/F05):");
                                          if (!newId) return;
                                          const trimmedId = newId.trim();
                                          if (!trimmedId) return;
                                          
                                          const idExists = allForms.some(f => f.form_id === trimmedId) || !!workflowFormsData[trimmedId];
                                          if (idExists) {
                                            alert("Mã Form ID này đã tồn tại trong hệ thống!");
                                            return;
                                          }

                                          const newTitle = prompt("Nhập tên biểu mẫu mới:");
                                          if (!newTitle) return;
                                          const trimmedTitle = newTitle.trim();
                                          if (!trimmedTitle) return;

                                          setWorkflowFormsData(prev => ({
                                            ...prev,
                                            [trimmedId]: {
                                              formId: trimmedId,
                                              formTitle: trimmedTitle,
                                              status: 'DRAFT',
                                              version: 'v0.1',
                                              layoutBlocks: []
                                            }
                                          }));

                                          const updatedNames = [...currentFormNames];
                                          updatedNames[fIdx] = trimmedId;
                                          setSteps(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              formName: updatedNames[0],
                                              formNames: updatedNames
                                            };
                                            return enforceStepShapes(updated);
                                          });
                                        } else {
                                          const updatedNames = [...currentFormNames];
                                          updatedNames[fIdx] = selectedValue;
                                          setSteps(prev => {
                                            const updated = [...prev];
                                            updated[index] = {
                                              ...updated[index],
                                              formName: updatedNames[0],
                                              formNames: updatedNames
                                            };
                                            return enforceStepShapes(updated);
                                          });
                                        }
                                      }}
                                      style={{ 
                                        flex: 1, 
                                        padding: '2px 6px', 
                                        fontSize: '0.75rem',
                                        margin: 0,
                                        height: '24px'
                                      }}
                                    >
                                      <option value="">-- Chọn biểu mẫu liên kết --</option>
                                      {(() => {
                                        const uniqueFormsMap = new Map();
                                        allForms.forEach(f => {
                                          const existing = uniqueFormsMap.get(f.form_id);
                                          if (!existing || new Date(f.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
                                            uniqueFormsMap.set(f.form_id, f);
                                          }
                                        });
                                        Object.entries(workflowFormsData).forEach(([fid, fdata]: [string, any]) => {
                                          if (!uniqueFormsMap.has(fid)) {
                                            uniqueFormsMap.set(fid, {
                                              form_id: fid,
                                              form_title: fdata.formTitle || fdata.formName || fid,
                                              form_name: fdata.formName || fid
                                            });
                                          }
                                        });
                                        return Array.from(uniqueFormsMap.values()).map((f: any) => (
                                          <option key={f.form_id} value={f.form_id}>
                                            {f.form_id} - {f.form_title || f.form_name}
                                          </option>
                                        ));
                                      })()}
                                      <option value="NEW_FORM" style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                                        + Tạo mới
                                      </option>
                                    </select>
                                    <button
                                      type="button"
                                      className="step-delete-btn"
                                      onClick={() => {
                                        const updatedNames = currentFormNames.filter((_, idx) => idx !== fIdx);
                                        setSteps(prev => {
                                          const updated = [...prev];
                                          if (updatedNames.length === 0) {
                                            updated[index] = { 
                                              ...updated[index], 
                                              producesForm: false, 
                                              formName: '',
                                              formNames: []
                                            };
                                          } else {
                                            updated[index] = { 
                                              ...updated[index], 
                                              formName: updatedNames[0],
                                              formNames: updatedNames
                                            };
                                          }
                                          return enforceStepShapes(updated);
                                        });
                                      }}
                                      style={{ padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', cursor: 'pointer' }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}

                                {/* Add Form button - always show if not producesForm or producesForm is true */}
                                <div style={{ display: 'flex' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => {
                                      setSteps(prev => {
                                        const updated = [...prev];
                                        const newFormNames = step.producesForm ? [...currentFormNames, ''] : [''];
                                        updated[index] = {
                                          ...updated[index],
                                          producesForm: true,
                                          formName: newFormNames[0],
                                          formNames: newFormNames
                                        };
                                        return enforceStepShapes(updated);
                                      });
                                    }}
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '0.25rem',
                                      padding: '2px 6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      background: 'transparent',
                                      border: '1px dashed #cbd5e1',
                                      boxShadow: 'none',
                                      color: 'var(--text-secondary)',
                                      marginTop: '1px'
                                    }}
                                  >
                                    <Plus size={12} /> Add form
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Responsible Role Select */}
                        <div>
                          <select
                            value={step.role}
                            onChange={(e) => handleStepChange(index, 'role', e.target.value)}
                            style={{ padding: '0.35rem 1.5rem 0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: 0 }}
                          >
                            {(roles.includes(step.role) ? roles : [...roles, step.role].filter(Boolean)).map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>

                        {/* BPMN Shape Select */}
                        <div>
                          {index === 0 ? (
                            <div style={{ padding: '0.35rem 0.5rem', background: '#f1f5f9', border: '1px solid var(--neutral-border)', borderRadius: '4px', fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                              Start
                            </div>
                          ) : (
                            <select
                              value={step.bpmnShape || 'task'}
                              onChange={(e) => handleStepChange(index, 'bpmnShape', e.target.value)}
                              style={{ padding: '0.35rem 1.5rem 0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: 0 }}
                            >
                              <option value="task">Task</option>
                              <option value="exclusive-gateway">Gateway (XOR)</option>
                              <option value="end-event">End</option>
                              <option value="message-end-event">Message End</option>
                            </select>
                          )}
                        </div>

                        {/* Connects to Step Select */}
                        <div>
                          {(isStart || step.bpmnShape === 'task' || !step.bpmnShape) ? (
                            <select
                              value={step.nextStepId || ''}
                              onChange={(e) => handleStepChange(index, 'nextStepId', e.target.value)}
                              style={{ padding: '0.35rem 1.5rem 0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: 0 }}
                            >
                              {steps.map((s, sIdx) => (
                                s.id !== step.id && (
                                  <option key={s.id} value={s.id}>
                                    #{sIdx + 1}: {s.bpmnShape === 'start-event' ? 'Start' : (s.bpmnShape === 'end-event' || s.bpmnShape === 'message-end-event') ? 'End' : (s.action ? (s.action.slice(0, 20) + (s.action.length > 20 ? '...' : '')) : `Untitled (${s.bpmnShape || 'task'})`)}
                                  </option>
                                )
                              ))}
                            </select>
                          ) : isGateway ? (
                            <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-secondary)', textAlign: 'center' }}>
                              Configured in branches
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
                              None (End)
                            </div>
                          )}
                        </div>

                        {/* Action Buttons Column */}
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.35rem', margin: 0 }} disabled={index === 0 || isReadOnly} onClick={() => moveStep(index, 'up')}>
                            <ArrowUp size={13} />
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.35rem', margin: 0 }} disabled={index === steps.length - 1 || isReadOnly} onClick={() => moveStep(index, 'down')}>
                            <ArrowDown size={13} />
                          </button>
                          {!isReadOnly && (
                            <button className="step-delete-btn" style={{ padding: '0.25rem 0.35rem', margin: 0, cursor: 'pointer' }} onClick={() => handleRemoveStep(index)}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Sub-row for Gateway Branches */}
                      {isGateway && (
                        <div style={{ 
                          borderTop: '1px solid #f1f5f9',
                          background: '#ffffff',
                          padding: '0.35rem 0.75rem 0.4rem 50px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* YES Branch */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Yes Path:</span>
                              <input 
                                type="text"
                                value={step.branchYesLabel || 'Y'}
                                placeholder="Y"
                                onChange={(e) => handleStepChange(index, 'branchYesLabel', e.target.value)}
                                style={{ 
                                  padding: '2px 6px', 
                                  fontSize: '0.75rem', 
                                  width: '32px', 
                                  textAlign: 'center', 
                                  border: '1px solid #e2e8f0', 
                                  borderRadius: '4px', 
                                  margin: 0,
                                  height: '24px'
                                }}
                              />
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '0.2rem' }}>connects to</span>
                              <select
                                value={step.branchYesTargetId || ''}
                                onChange={(e) => handleStepChange(index, 'branchYesTargetId', e.target.value)}
                                style={{ 
                                  padding: '2px 6px', 
                                  fontSize: '0.75rem', 
                                  flex: 1, 
                                  border: '1px solid #e2e8f0', 
                                  borderRadius: '4px', 
                                  margin: 0,
                                  height: '24px'
                                }}
                              >
                                {steps.map((s, sIdx) => (
                                  s.id !== step.id && (
                                    <option key={s.id} value={s.id}>
                                      #{sIdx + 1}: {s.bpmnShape === 'start-event' ? 'Start' : (s.bpmnShape === 'end-event' || s.bpmnShape === 'message-end-event') ? 'End' : (s.action ? (s.action.slice(0, 20) + (s.action.length > 20 ? '...' : '')) : `Untitled (${s.bpmnShape || 'task'})`)}
                                    </option>
                                  )
                                ))}
                              </select>
                            </div>

                            {/* NO Branch */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>No Path:</span>
                              <input 
                                type="text"
                                value={step.branchNoLabel || 'N'}
                                placeholder="N"
                                onChange={(e) => handleStepChange(index, 'branchNoLabel', e.target.value)}
                                style={{ 
                                  padding: '2px 6px', 
                                  fontSize: '0.75rem', 
                                  width: '32px', 
                                  textAlign: 'center', 
                                  border: '1px solid #e2e8f0', 
                                  borderRadius: '4px', 
                                  margin: 0,
                                  height: '24px'
                                }}
                              />
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '0.2rem' }}>connects to</span>
                              <select
                                value={step.branchNoTargetId || ''}
                                onChange={(e) => handleStepChange(index, 'branchNoTargetId', e.target.value)}
                                style={{ 
                                  padding: '2px 6px', 
                                  fontSize: '0.75rem', 
                                  flex: 1, 
                                  border: '1px solid #e2e8f0', 
                                  borderRadius: '4px', 
                                  margin: 0,
                                  height: '24px'
                                }}
                              >
                                {steps.map((s, sIdx) => (
                                  s.id !== step.id && (
                                    <option key={s.id} value={s.id}>
                                      #{sIdx + 1}: {s.bpmnShape === 'start-event' ? 'Start' : (s.bpmnShape === 'end-event' || s.bpmnShape === 'message-end-event') ? 'End' : (s.action ? (s.action.slice(0, 20) + (s.action.length > 20 ? '...' : '')) : `Untitled (${s.bpmnShape || 'task'})`)}
                                    </option>
                                  )
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Add Step Button */}
            {!isReadOnly && (
              <button 
                type="button"
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', boxShadow: 'none', background: '#ffffff' }} 
                onClick={handleAddStep}
              >
                <Plus size={14} /> Add step
              </button>
            )}
          </div>
          </fieldset>
        )}

        {/* TAB 3: FORM */}
        {activeTab === 'form' && (
          <div style={{
            backgroundColor: 'var(--neutral-card)',
            border: '1px solid var(--neutral-border)',
            borderRadius: 'var(--card-radius)',
            padding: '1.25rem 1.5rem',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            overflow: 'hidden',
            borderTop: '3px solid var(--primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>

            {workflowForms.length === 0 ? (
              <div style={{ padding: '2.5rem', border: '1px dashed var(--neutral-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: '#fafafa' }}>
                No output forms are currently declared in the workflow.
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
                  To declare a form, go to the <strong>Workflow</strong> tab, select a Task step, and check "Produces Form".
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {workflowForms.map((formId) => {
                  const formData = workflowFormsData[formId];
                  // Form versioning is independent: always show the latest version of the linked form_id
                  const liveForm = allForms
                    .filter(f => f.form_id === formId)
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
                  const activeVersion = liveForm ? liveForm.version : (formData?.version || '');
                  const activeStatus = liveForm ? liveForm.status : (formData?.status || 'DRAFT');
                  
                  const displayName = formData?.formTitle || (liveForm?.form_title || liveForm?.form_name) || formId;

                  let normalizedVersion = '';
                  if (formId) {
                    const rawVersion = (activeVersion || '').trim();
                    normalizedVersion = rawVersion;
                    const dateRegex = /(\d{4})-(\d{2})-(\d{2})/;
                    const dateMatch = normalizedVersion.match(dateRegex);
                    if (dateMatch) {
                      const [_, yyyy, mm, dd] = dateMatch;
                      normalizedVersion = normalizedVersion.replace(/\s*\([^)]*\)/g, '').replace(dateRegex, '').trim();
                      normalizedVersion = `${normalizedVersion}-${dd}.${mm}.${yyyy}`;
                    }
                    if (normalizedVersion.startsWith('v')) {
                      normalizedVersion = 'V' + normalizedVersion.slice(1);
                    }
                  }

                  return (
                    <div 
                      key={formId} 
                      style={{ 
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.65rem 0.85rem', 
                        background: '#f8fafc', 
                        border: '1px solid var(--neutral-border)', 
                        borderRadius: '6px',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      {/* Left: Form ID badge + Form Name + Version status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#0369a1',
                          background: '#e0f2fe',
                          border: '1px solid #bae6fd',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '3px',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>{formId}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{displayName}</span>
                        {(() => {
                          const isFormActive = formId && activeStatus === 'ACTIVE';
                          const displayVersion = normalizedVersion.replace(/\s*\(draft\)/gi, '').trim();
                          
                          if (formId) {
                            return (
                              <span style={{ 
                                fontSize: '0.72rem', 
                                color: isFormActive ? '#047857' : '#b45309', 
                                background: isFormActive ? '#ecfdf5' : '#fffbeb', 
                                border: isFormActive ? '1px solid #a7f3d0' : '1px solid #fde68a', 
                                padding: '0.05rem 0.35rem', 
                                borderRadius: '3px', 
                                fontWeight: 600,
                                textTransform: 'uppercase'
                              }}>
                                {displayVersion || 'DIGITAL'} - {activeStatus}
                              </span>
                            );
                          } else {
                            return (
                              <span style={{ 
                                fontSize: '0.72rem', 
                                color: '#b45309', 
                                background: '#fffbeb', 
                                border: '1px solid #fde68a', 
                                padding: '0.05rem 0.35rem', 
                                borderRadius: '3px', 
                                fontWeight: 600, 
                                textTransform: 'uppercase' 
                              }}>
                                V0.1 - DRAFT
                              </span>
                            );
                          }
                        })()}
                      </div>
                      
                      {(() => {
                        const canEditForm = !isReadOnly && hasPermission('design_document') && activeStatus === 'DRAFT';
                        const hasPdf = !!formData?.pdfName;
                        const hasDigitalForm = !!formId;

                        if (!canEditForm && !hasPdf && !hasDigitalForm) {
                          return null;
                        }

                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                            
                            {/* File input (hidden) - only if editable */}
                            {canEditForm && (
                              <input 
                                type="file" 
                                accept=".pdf" 
                                style={{ display: 'none' }} 
                                id={`pdf-file-${formId}`}
                                disabled={isUploading[formId]}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handlePdfUpload(formId, file);
                                  }
                                }}
                              />
                            )}

                            {/* PDF Upload / View group */}
                            {(canEditForm || hasPdf) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {!hasPdf ? (
                                  canEditForm && (
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      disabled={isUploading[formId] || !processId}
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.3rem', 
                                        padding: '0.25rem 0.6rem', 
                                        fontSize: '0.78rem',
                                        height: '28px',
                                        background: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        color: '#0f4c81',
                                        fontWeight: 500,
                                        borderRadius: '6px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                        margin: 0
                                      }}
                                      onClick={() => {
                                        if (!processId) {
                                          alert('Please save the process document as a draft first before uploading files.');
                                          return;
                                        }
                                        document.getElementById(`pdf-file-${formId}`)?.click();
                                      }}
                                    >
                                      <Upload size={12} /> Upload PDF
                                    </button>
                                  )
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      title={formData.pdfName}
                                      disabled={isUploading[formId]}
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '0.3rem', 
                                        padding: '0.25rem 0.6rem', 
                                        fontSize: '0.78rem',
                                        height: '28px',
                                        background: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        color: '#0f4c81',
                                        fontWeight: 500,
                                        borderRadius: '6px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                        margin: 0
                                      }}
                                      onClick={async () => {
                                        const pdfKey = formData?.pdfKey;
                                        if (pdfKey) {
                                          try {
                                            const res = await fetch(`/api/storage/download-url?key=${encodeURIComponent(pdfKey)}`);
                                            if (!res.ok) throw new Error('Failed to get download URL');
                                            const { downloadUrl } = await res.json();
                                            window.open(downloadUrl, '_blank');
                                          } catch (err) {
                                            console.error(err);
                                            alert('Failed to load PDF attachment.');
                                          }
                                        }
                                      }}
                                    >
                                      <Printer size={12} /> Print
                                    </button>

                                    {/* Edit PDF actions - only if editable */}
                                    {canEditForm && (
                                      <>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          title="Replace PDF"
                                          disabled={isUploading[formId]}
                                          style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            height: '28px',
                                            width: '28px',
                                            padding: 0,
                                            border: '1px solid #e2e8f0',
                                            background: '#ffffff',
                                            borderRadius: '6px',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                            color: '#0f4c81',
                                            margin: 0
                                          }}
                                          onClick={() => document.getElementById(`pdf-file-${formId}`)?.click()}
                                        >
                                          <Upload size={11} />
                                        </button>

                                        <button
                                          type="button"
                                          title="Remove PDF"
                                          disabled={isUploading[formId]}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '28px',
                                            width: '28px',
                                            padding: 0,
                                            border: '1px solid #fca5a5',
                                            background: '#fee2e2',
                                            borderRadius: '6px',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 'bold',
                                            margin: 0
                                          }}
                                          onClick={() => handlePdfDelete(formId, formData.pdfKey || '')}
                                        >
                                          &times;
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Digital Form Action Button (Edit or View) */}
                            {canEditForm ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.25rem 0.6rem',
                                  fontSize: '0.78rem',
                                  height: '28px',
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  color: '#0f4c81',
                                  fontWeight: 500,
                                  borderRadius: '6px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                  margin: 0
                                }}
                                onClick={() => {
                                  if (!processId) {
                                    alert('Please save the process document as a draft first to enable the form builder.');
                                    return;
                                  }
                                  setActiveFormToBuild(formId);
                                }}
                              >
                                <Edit2 size={12} /> Edit
                              </button>
                            ) : (
                              hasDigitalForm && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.78rem',
                                    height: '28px',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    color: '#0f4c81',
                                    fontWeight: 500,
                                    borderRadius: '6px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                    margin: 0
                                  }}
                                  onClick={() => setActiveFormToBuild(formId)}
                                >
                                  <Eye size={12} /> View
                                </button>
                              )
                            )}

                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quota indicator moved to the bottom as a tiny footer note */}
            {quota && quota.isConfigured && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--neutral-border)',
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginTop: '0.5rem'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ☁️ Cloud Storage Quota: <strong>{formatBytes(quota.totalSize)}</strong> used of {formatBytes(quota.quotaLimit)} ({quota.percentage}%)
                </span>
                {parseFloat(quota.percentage) > 85 && (
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>
                    ⚠️ Storage running low. Remove unused PDFs.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {activeFormToBuild && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{ width: '95%', maxWidth: '1200px', background: '#ffffff', borderRadius: '8px', overflow: 'hidden' }}>
            <FormBuilder
              formName={activeFormToBuild}
              initialData={(() => {
                // Primary: look up the latest version of this form_id directly from allForms (DB)
                const live = allForms
                  .filter(f => f.form_id === activeFormToBuild)
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
                
                if (live) {
                  return {
                    formId: live.form_id,
                    formTitle: live.form_title || live.form_name,
                    version: live.version,
                    status: live.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
                    layoutBlocks: typeof live.layout_blocks === 'string'
                      ? JSON.parse(live.layout_blocks)
                      : (live.layout_blocks || []),
                    revisionHistory: typeof live.revision_history === 'string'
                      ? JSON.parse(live.revision_history)
                      : (live.revision_history || []),
                  };
                }

                // Fallback: try workflowFormsData[activeFormToBuild] if form is not yet saved to DB
                const fd = workflowFormsData[activeFormToBuild];
                if (fd) return { ...fd };

                // Last resort: new blank form with the declared form_id
                return {
                  formId: activeFormToBuild,
                  formTitle: activeFormToBuild,
                  status: 'DRAFT' as const,
                  version: 'v0.1',
                  layoutBlocks: [],
                  revisionHistory: [],
                };
              })()}
              onSave={async (savedFormData) => {
                const nextFormsData = {
                  ...workflowFormsData,
                  [activeFormToBuild]: {
                    ...workflowFormsData[activeFormToBuild],
                    ...savedFormData
                  }
                };
                setWorkflowFormsData(nextFormsData);
                // Only auto-save the process data silently if it is a real process (not unlinked)
                if (processId && processId !== 'unlinked') {
                  await handleSave(nextFormsData, true);
                }
                fetchFormsList();
                if (exitOnCloseForm) {
                  onCancel();
                } else {
                  setActiveFormToBuild(null);
                }
              }}
              onClose={() => {
                if (exitOnCloseForm) {
                  onCancel();
                } else {
                  setActiveFormToBuild(null);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
