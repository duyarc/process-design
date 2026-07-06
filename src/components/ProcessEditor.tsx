import React, { useState, useEffect, useRef } from 'react';
import type { Process, ProcessStep, FormField, FormDesignerField, SOPSignOff, SOPSignOffs } from '../types';
import { ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, Upload, Edit2, Eye, PenTool, CheckCircle, Clock, GitBranch, XCircle, Shield, Calendar, AlertTriangle } from 'lucide-react';
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
  initialTab?: 'description' | 'workflow' | 'form';
  initialFormToBuild?: string | null;
  onClearInitialEditOpts?: () => void;
}

export const ProcessEditor: React.FC<ProcessEditorProps> = ({ 
  processId, 
  onCancel, 
  onSaveSuccess,
  initialTab,
  initialFormToBuild,
  onClearInitialEditOpts
}) => {
  const { hasPermission } = useAuth();
  const modelerRef = useRef<BpmnModelerRef | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'workflow' | 'form' | 'versions'>('description');
  const [activeFormToBuild, setActiveFormToBuild] = useState<string | null>(null);
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

  const fetchProcess = async (id: string) => {
    try {
      setLoading(true);
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
        const loadedRoles = proc.roles && proc.roles.length > 0 ? proc.roles : ['Operator'];
        setRoles(loadedRoles);
        const loadedSteps = enforceStepShapes(proc.steps || []);
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
        setWorkflowFormsData(proc.workflowFormsData || {});

        // Load sibling versions for the Versions tab
        const pid = proc.parentProcessId || proc.id;
        const siblings = list.filter(p => p.parentProcessId === pid || p.id === pid);
        siblings.sort((a, b) => (parseInt(b.version, 10) || 0) - (parseInt(a.version, 10) || 0));
        setAllVersions(siblings);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load process data.');
    } finally {
      setLoading(false);
    }
  };

  // Version lifecycle handlers (centralised here, removed from ProcessReader)
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
    if (!window.confirm(`Create a new Draft version based on Version ${version}?`)) return;
    try {
      setVersionActionLoading(true);
      const res = await fetch(`/api/processes/${processId}/new-version`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create new draft version');
      const newDraft = await res.json();
      onSaveSuccess(newDraft.id);
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

  const handleSave = async (customFormsData?: Record<string, any>) => {
    if (!title.trim()) {
      alert('Please enter a process title.');
      return;
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

    const processPayload = {
      id: processId || undefined,
      parentProcessId: parentProcessId || undefined,
      status,
      title,
      description,
      version,
      roles,
      steps: stepsToSave,
      formFields: filteredFields,
      sopSignoffs,
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
      onSaveSuccess(saved.id);
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
    } else {
      // Initialize with default Start step and one form field
      setStatus('Draft');
      setParentProcessId('');
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
        ? s.formNames.map(n => n.trim()).filter(Boolean)
        : (s.formName ? [s.formName.trim()] : []);
      names.forEach(name => {
        if (!workflowForms.includes(name)) {
          workflowForms.push(name);
        }
      });
    }
  });

  return (
    <div>
      {/* Editor Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={onCancel}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {processId && hasPermission('version_document') && !isReadOnly && (
            <button 
              className="btn btn-outline-danger" 
              onClick={handleDeleteProcess} 
              disabled={saving}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--neutral-border)', marginBottom: '1.5rem', gap: '0.25rem' }}>
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
                  gap: '0.35rem'
                }}
              >
                {tab === 'versions' && <GitBranch size={14} />}
                {tabLabels[tab]}
              </button>
            );
          })}
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }} disabled={isReadOnly}>
        {/* TAB 1: DESCRIPTION */}
        {activeTab === 'description' && (
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
        )}

        {/* TAB 4: VERSIONS */}
        {activeTab === 'versions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Section A: Version Card + Lifecycle Actions */}             <div className="paper-card accent-teal" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem' }}>{title || 'Untitled Process'}</h2>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span className="badge" style={{
                      backgroundColor:
                        status === 'Draft' ? '#f3f4f6' :
                        status === 'Pending Review' ? '#fef3c7' :
                        status === 'Active' ? '#d1fae5' :
                        status === 'Retired' ? '#fee2e2' : '#f3f4f6',
                      color:
                        status === 'Draft' ? '#4b5563' :
                        status === 'Pending Review' ? '#92400e' :
                        status === 'Active' ? '#065f46' :
                        status === 'Retired' ? '#991b1b' : '#4b5563',
                      border:
                        status === 'Draft' ? '1px solid #d1d5db' :
                        status === 'Pending Review' ? '1px solid #fcd34d' :
                        status === 'Active' ? '1px solid #6ee7b7' :
                        status === 'Retired' ? '1px solid #fca5a5' : '1px solid #d1d5db',
                      textTransform: 'uppercase', fontWeight: 700, fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px'
                    }}>
                      {status === 'Draft' && <><Clock size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />Draft</>}
                      {status === 'Pending Review' && <><AlertTriangle size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />Pending Review</>}
                      {status === 'Active' && <><CheckCircle size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />Active</>}
                      {status === 'Retired' && <><XCircle size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />Retired</>}
                      {status === 'Superseded' && <><XCircle size={11} style={{ marginRight: '3px', verticalAlign: 'middle' }} />Superseded</>}
                    </span>

                    {/* Version input */}
                    {(status === 'Draft' || status === 'Pending Review') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Version:</span>
                        <input 
                          type="text" 
                          value={version} 
                          onChange={(e) => setVersion(e.target.value)} 
                          style={{ 
                            width: '50px', 
                            padding: '0.15rem 0.35rem', 
                            fontSize: '0.8rem', 
                            border: '1px solid var(--neutral-border)', 
                            borderRadius: '4px',
                            textAlign: 'center',
                            fontWeight: 700
                          }} 
                        />
                      </div>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Version {version}</span>
                    )}

                    {/* Effective Date input */}
                    {(status === 'Draft' || status === 'Pending Review') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Effective Date:</span>
                        <input 
                          type="date" 
                          value={sopSignoffs.effectiveDate || ''} 
                          onChange={(e) => setSopSignoffs(prev => ({ ...prev, effectiveDate: e.target.value }))} 
                          style={{ 
                            padding: '0.15rem 0.35rem', 
                            fontSize: '0.8rem', 
                            border: '1px solid var(--neutral-border)', 
                            borderRadius: '4px',
                            outline: 'none',
                            color: 'var(--text-primary)'
                          }} 
                        />
                      </div>
                    ) : (
                      sopSignoffs.effectiveDate && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          Effective Date: <strong style={{ color: 'var(--text-secondary)' }}>{sopSignoffs.effectiveDate}</strong>
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Contextual lifecycle action buttons */}
                {processId && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {status === 'Draft' && (
                      <>
                        <button
                          className="btn btn-secondary"
                          onClick={handleSubmitForReview}
                          disabled={versionActionLoading}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Clock size={15} />
                          Submit for Review
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={handleActivateVersion}
                          disabled={versionActionLoading}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <CheckCircle size={15} />
                          Activate Version
                        </button>
                      </>
                    )}
                    {status === 'Pending Review' && (
                      <button
                        className="btn btn-primary"
                        onClick={handleActivateVersion}
                        disabled={versionActionLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <CheckCircle size={15} />
                        Activate / Sign-off
                      </button>
                    )}
                    {(status === 'Active' || status === 'Pending Review') && (
                      <button
                        className="btn btn-secondary"
                        onClick={handleCreateNewDraftEditor}
                        disabled={versionActionLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Plus size={15} />
                        New Version
                      </button>
                    )}
                    {status === 'Active' && (
                      <button
                        className="btn btn-outline-danger"
                        onClick={handleRetireVersion}
                        disabled={versionActionLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <XCircle size={15} />
                        Retire
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Lifecycle flow diagram */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--neutral-border)', fontSize: '0.78rem', flexWrap: 'wrap' }}>
                {(['Draft', 'Pending Review', 'Active', 'Retired'] as const).map((s, i) => (
                  <React.Fragment key={s}>
                    <span style={{ padding: '0.2rem 0.55rem', borderRadius: '4px', fontWeight: status === s ? 700 : 500, background: status === s ? 'var(--primary)' : '#e2e8f0', color: status === s ? '#ffffff' : '#64748b', fontSize: '0.75rem' }}>
                      {s}
                    </span>
                    {i < 3 && <span style={{ color: '#94a3b8' }}>→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Section B: Sign-off Setup */}
            <div className="paper-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={16} /> Sign-off Setup
              </h3>

              <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--neutral-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: '0.75rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '20%' }}>ROLE</th>
                      <th style={{ textAlign: 'left', paddingBottom: '0.75rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '37.5%', paddingLeft: '0.5rem' }}>NAME</th>
                      <th style={{ textAlign: 'left', paddingBottom: '0.75rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '37.5%', paddingLeft: '0.5rem' }}>WORK TITLE</th>
                      <th style={{ textAlign: 'center', paddingBottom: '0.75rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', width: '5%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Author Row */}
                    <tr>
                      <td style={{ padding: '0.75rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', verticalAlign: 'middle' }}>Author</td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                        <input type="text" placeholder="Enter author name" value={sopSignoffs.author?.name || ''}
                          onChange={(e) => setSopSignoffs(prev => ({ ...prev, author: { ...(prev.author || { name: '', title: '' }), name: e.target.value } }))}
                          style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }} />
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                        <input type="text" placeholder="Enter author work title" value={sopSignoffs.author?.title || ''}
                          onChange={(e) => setSopSignoffs(prev => ({ ...prev, author: { ...(prev.author || { name: '', title: '' }), title: e.target.value } }))}
                          style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }} />
                      </td>
                      <td style={{ width: '40px' }}></td>
                    </tr>
                    {/* Reviewers */}
                    {(sopSignoffs.reviewers || []).map((rev, idx) => (
                      <tr key={`reviewer-${idx}`} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                          Reviewer {sopSignoffs.reviewers && sopSignoffs.reviewers.length > 1 ? `#${idx + 1}` : ''}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input type="text" placeholder="Enter reviewer name" value={rev.name || ''}
                            onChange={(e) => { const list = [...(sopSignoffs.reviewers || [])]; list[idx] = { ...list[idx], name: e.target.value }; setSopSignoffs(prev => ({ ...prev, reviewers: list })); }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }} />
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input type="text" placeholder="Enter reviewer work title" value={rev.title || ''}
                            onChange={(e) => { const list = [...(sopSignoffs.reviewers || [])]; list[idx] = { ...list[idx], title: e.target.value }; setSopSignoffs(prev => ({ ...prev, reviewers: list })); }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }} />
                        </td>
                        <td style={{ width: '40px', padding: '0.75rem 0 0.75rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button type="button" className="btn btn-danger btn-sm"
                            onClick={() => { const list = (sopSignoffs.reviewers || []).filter((_, i) => i !== idx); setSopSignoffs(prev => ({ ...prev, reviewers: list })); }}
                            style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Authorisers */}
                    {(sopSignoffs.authorisers || []).map((auth, idx) => (
                      <tr key={`authoriser-${idx}`} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                          Authoriser {sopSignoffs.authorisers && sopSignoffs.authorisers.length > 1 ? `#${idx + 1}` : ''}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input type="text" placeholder="Enter authoriser name" value={auth.name || ''}
                            onChange={(e) => { const list = [...(sopSignoffs.authorisers || [])]; list[idx] = { ...list[idx], name: e.target.value }; setSopSignoffs(prev => ({ ...prev, authorisers: list })); }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }} />
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input type="text" placeholder="Enter authoriser work title" value={auth.title || ''}
                            onChange={(e) => { const list = [...(sopSignoffs.authorisers || [])]; list[idx] = { ...list[idx], title: e.target.value }; setSopSignoffs(prev => ({ ...prev, authorisers: list })); }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }} />
                        </td>
                        <td style={{ width: '40px', padding: '0.75rem 0 0.75rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <button type="button" className="btn btn-danger btn-sm"
                            onClick={() => { const list = (sopSignoffs.authorisers || []).filter((_, i) => i !== idx); setSopSignoffs(prev => ({ ...prev, authorisers: list })); }}
                            style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Add controls */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => setSopSignoffs(prev => ({ ...prev, reviewers: [...(prev.reviewers || []), { name: '', title: '' }] }))}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus size={14} /> Add Reviewer
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => setSopSignoffs(prev => ({ ...prev, authorisers: [...(prev.authorisers || []), { name: '', title: '' }] }))}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Plus size={14} /> Add Authoriser
                  </button>
                </div>
              </div>
            </div>

            {/* Section C: Version History */}
            <div className="paper-card" style={{ padding: '1.5rem', borderLeft: '4px solid #94a3b8' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitBranch size={16} /> Version History
              </h3>
              {allVersions.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--neutral-border)', borderRadius: '6px' }}>
                  No version history available.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', background: isCurrent ? '#f0fdfa' : '#f9fafb', borderRadius: '6px', border: isCurrent ? '1px solid #99f6e4' : '1px solid var(--neutral-border)', fontSize: '0.82rem', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>v{v.version}</span>
                          {isCurrent && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--primary)', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '0.05rem 0.35rem', borderRadius: '3px' }}>CURRENT</span>}
                          <span className="badge" style={{ backgroundColor: vColors.bg, color: vColors.text, border: `1px solid ${vColors.border}`, fontSize: '0.68rem', padding: '0.1rem 0.4rem', textTransform: 'uppercase', fontWeight: 700 }}>{vStatus}</span>
                          <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Updated: {new Date(v.lastUpdated).toLocaleDateString()}
                          </span>
                          {v.sopSignoffs?.effectiveDate && (
                            <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Calendar size={12} /> Effective: {new Date(v.sopSignoffs.effectiveDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {!isCurrent && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', margin: 0, whiteSpace: 'nowrap' }}
                            onClick={() => onSaveSuccess(v.id)}
                          >
                            Open
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: WORKFLOW BUILDER */}
        {activeTab === 'workflow' && (
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
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                      Form{currentFormNames.length > 1 ? ` #${fIdx + 1}` : ''}:
                                    </span>
                                    <input
                                      type="text"
                                      placeholder="e.g. Tank CIP Checklist"
                                      value={formName || ''}
                                      onChange={(e) => {
                                        const updatedNames = [...currentFormNames];
                                        updatedNames[fIdx] = e.target.value;
                                        setSteps(prev => {
                                          const updated = [...prev];
                                          updated[index] = {
                                            ...updated[index],
                                            formName: updatedNames[0],
                                            formNames: updatedNames
                                          };
                                          return enforceStepShapes(updated);
                                        });
                                      }}
                                      style={{ 
                                        flex: 1, 
                                        padding: '2px 6px', 
                                        fontSize: '0.75rem',
                                        margin: 0,
                                        height: '24px'
                                      }}
                                    />
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
        )}

        {/* TAB 3: FORM */}
        {activeTab === 'form' && (
          <div className="paper-card accent-teal">

            {quota && quota.isConfigured && (
              <div className="quota-container" style={{
                background: '#f8fafc',
                border: '1px solid var(--neutral-border)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ☁️ Cloud Storage Quota (2 GB Limit)
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: parseFloat(quota.percentage) > 85 ? '#ef4444' : 'var(--primary)' }}>
                    {formatBytes(quota.totalSize)} / {formatBytes(quota.quotaLimit)} ({quota.percentage}%)
                  </span>
                </div>
                <div style={{
                  background: '#e2e8f0',
                  borderRadius: '9999px',
                  height: '8px',
                  overflow: 'hidden',
                  width: '100%'
                }}>
                  <div style={{
                    background: parseFloat(quota.percentage) > 85 ? '#ef4444' : 'linear-gradient(90deg, var(--primary) 0%, #10b981 100%)',
                    height: '100%',
                    width: `${Math.min(parseFloat(quota.percentage), 100)}%`,
                    borderRadius: '9999px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                {parseFloat(quota.percentage) > 85 && (
                  <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.4rem', marginBottom: 0, fontWeight: 500 }}>
                    ⚠️ Storage quota is running low. Please remove unused PDF attachments before uploading new ones.
                  </p>
                )}
              </div>
            )}

            {workflowForms.length === 0 ? (
              <div style={{ padding: '2.5rem', border: '1px dashed var(--neutral-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: '#fafafa' }}>
                No output forms are currently declared in the workflow.
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', marginBottom: 0 }}>
                  To declare a form, go to the <strong>Workflow</strong> tab, select a Task step, and check "Produces Form".
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {workflowForms.map((formName) => (
                  <div 
                    key={formName} 
                    style={{ 
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      padding: '1rem', 
                      background: '#f8fafc', 
                      border: '1px solid var(--neutral-border)', 
                      borderRadius: '6px' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{formName}</span>
                      
                      {!isReadOnly && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {/* File input (hidden) */}
                          <input 
                            type="file" 
                            accept=".pdf" 
                            style={{ display: 'none' }} 
                            id={`pdf-file-${formName}`}
                            disabled={isUploading[formName]}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handlePdfUpload(formName, file);
                              }
                            }}
                          />

                          {/* PDF Upload / View / Replace / Remove Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {!workflowFormsData[formName]?.pdfName ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={isUploading[formName] || !processId}
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.35rem', 
                                  padding: '0.35rem 0.75rem', 
                                  fontSize: '0.8rem',
                                  height: '32px',
                                  background: '#ffffff',
                                  border: '1px solid var(--neutral-border)',
                                  color: 'inherit'
                                }}
                                onClick={() => {
                                  if (!processId) {
                                    alert('Please save the process document as a draft first before uploading files.');
                                    return;
                                  }
                                  document.getElementById(`pdf-file-${formName}`)?.click();
                                }}
                              >
                                {isUploading[formName] ? 'Working...' : 'PDF'}
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  title={workflowFormsData[formName].pdfName}
                                  disabled={isUploading[formName]}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '0.35rem', 
                                    padding: '0.35rem 0.75rem', 
                                    fontSize: '0.8rem',
                                    height: '32px',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    color: '#1e40af'
                                  }}
                                  onClick={async () => {
                                    const pdfKey = workflowFormsData[formName]?.pdfKey;
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
                                  <Eye size={13} />
                                  PDF
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  title="Replace PDF"
                                  disabled={isUploading[formName]}
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    height: '32px',
                                    width: '32px',
                                    minWidth: '32px',
                                    padding: 0,
                                    border: '1px solid var(--neutral-border)',
                                    background: '#ffffff'
                                  }}
                                  onClick={() => document.getElementById(`pdf-file-${formName}`)?.click()}
                                >
                                  <Upload size={13} />
                                </button>

                                <button
                                  type="button"
                                  title="Remove PDF"
                                  disabled={isUploading[formName]}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '32px',
                                    width: '32px',
                                    minWidth: '32px',
                                    padding: 0,
                                    border: '1px solid #fca5a5',
                                    background: '#fee2e2',
                                    borderRadius: '6px',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold'
                                  }}
                                  onClick={() => handlePdfDelete(formName, workflowFormsData[formName].pdfKey || '')}
                                >
                                  &times;
                                </button>
                              </>
                            )}

                            {!processId && (
                              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '0.25rem' }}>
                                (Save draft first to upload)
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* ISO 2026 Digital Form builder row */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginTop: '0.5rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px dashed #e2e8f0',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <PenTool size={14} />
                        {workflowFormsData[formName]?.formId ? (
                           <span>
                             <strong>{workflowFormsData[formName].formId}</strong>
                             {(() => {
                               const rawVersion = (workflowFormsData[formName].version || '').trim();
                               let normalizedVersion = rawVersion;
                               const dateRegex = /(\d{4})-(\d{2})-(\d{2})/;
                               const dateMatch = normalizedVersion.match(dateRegex);
                               if (dateMatch) {
                                 const [_, yyyy, mm, dd] = dateMatch;
                                 const formattedDate = `${dd}.${mm}.${yyyy}`;
                                 normalizedVersion = normalizedVersion.replace(/\s*\([^)]*\)/g, '').replace(dateRegex, '').trim();
                                 normalizedVersion = `${normalizedVersion}-${formattedDate}`;
                               }
                               if (normalizedVersion.startsWith('v')) {
                                 normalizedVersion = 'V' + normalizedVersion.slice(1);
                               }
                               return normalizedVersion ? ` • ${normalizedVersion}` : '';
                             })()} - {' '}
                             <span className={`badge ${workflowFormsData[formName].status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>
                               {workflowFormsData[formName].status}
                             </span>
                           </span>
                         ) : (
                          <span style={{ fontStyle: 'italic' }}>No digital form configured yet</span>
                        )}
                      </div>
                      
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem',
                          height: '28px',
                          background: workflowFormsData[formName]?.formId ? '#f0fdf4' : '#f8fafc',
                          borderColor: workflowFormsData[formName]?.formId ? '#bbf7d0' : '#cbd5e1',
                          color: workflowFormsData[formName]?.formId ? '#15803d' : 'inherit'
                        }}
                        onClick={() => {
                          if (!processId) {
                            alert('Please save the process document as a draft first to enable the form builder.');
                            return;
                          }
                          setActiveFormToBuild(formName);
                        }}
                      >
                        {workflowFormsData[formName]?.formId ? 'Edit Digital Form' : 'Build Form Online'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </fieldset>
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
              initialData={workflowFormsData[activeFormToBuild]}
              onSave={(savedFormData) => {
                const nextFormsData = {
                  ...workflowFormsData,
                  [activeFormToBuild]: {
                    ...workflowFormsData[activeFormToBuild],
                    ...savedFormData
                  }
                };
                setWorkflowFormsData(nextFormsData);
                setActiveFormToBuild(null);
                handleSave(nextFormsData);
              }}
              onClose={() => setActiveFormToBuild(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
