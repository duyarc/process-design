import React, { useState, useEffect, useRef } from 'react';
import type { Process, ProcessStep, FormField, FormDesignerField, SOPSignOff, SOPSignOffs } from '../types';
import { ArrowLeft, Save, Plus, Trash2, ArrowUp, ArrowDown, Upload, Link as LinkIcon } from 'lucide-react';
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
    if (shape !== 'end-event') {
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
    if (shape !== 'task') {
      producesForm = undefined;
      formName = undefined;
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
      formName
    };
  });
};

interface ProcessEditorProps {
  processId: string | null; // null means create new
  onCancel: () => void;
  onSaveSuccess: (id: string) => void;
}

export const ProcessEditor: React.FC<ProcessEditorProps> = ({ processId, onCancel, onSaveSuccess }) => {
  const { hasPermission } = useAuth();
  const modelerRef = useRef<BpmnModelerRef | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'workflow' | 'form'>('description');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1');
  const [status, setStatus] = useState<'Draft' | 'Pending Review' | 'Active' | 'Superseded' | 'Retired'>('Draft');
  const [parentProcessId, setParentProcessId] = useState<string>('');
  const [roles, setRoles] = useState<string[]>(['Operator']);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [sopSignoffs, setSopSignoffs] = useState<SOPSignOffs>({
    author: { name: '', title: '' },
    reviewers: [{ name: '', title: '' }],
    authorisers: [{ name: '', title: '' }],
    effectiveDate: ''
  });
  const [workflowFormsData, setWorkflowFormsData] = useState<{
    [formName: string]: {
      pdfName?: string;
      pdfUrl?: string;
      onlineUrl?: string;
      fields?: FormDesignerField[];
    }
  }>({});

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bpmnViewMode, setBpmnViewMode] = useState<'auto' | 'custom'>('auto');
  const [savingBpmn, setSavingBpmn] = useState(false);

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
          effectiveDate: loadedSop.effectiveDate || ''
        });
        setWorkflowFormsData(proc.workflowFormsData || {});
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load process data.');
    } finally {
      setLoading(false);
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
    setSteps(prev => enforceStepShapes(prev.filter((_, i) => i !== index)));
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
    setSteps(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return enforceStepShapes(updated);
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

  const handleSave = async () => {
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
      workflowFormsData
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
    } else {
      // Initialize with two default empty steps (Start and End) and one form field
      setStatus('Draft');
      setParentProcessId('');
      setVersion('1');
      const step1: ProcessStep = {
        id: 'step_start_' + Math.random().toString(36).substr(2, 5),
        role: 'Operator',
        action: 'Start Process',
        bpmnShape: 'start-event'
      };
      const step2: ProcessStep = {
        id: 'step_end_' + Math.random().toString(36).substr(2, 5),
        role: 'Operator',
        action: 'End Process',
        bpmnShape: 'end-event'
      };
      setSteps([step1, step2]);
      handleAddFormField();
    }
  }, [processId]);



  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading process editor...</p>
      </div>
    );
  }

  const workflowForms = Array.from(new Set(
    steps
      .filter(s => s.bpmnShape === 'task' && s.producesForm && s.formName?.trim())
      .map(s => s.formName!.trim())
  ));

  return (
    <div>
      {/* Editor Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={onCancel}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {processId && hasPermission('delete_process') && !isReadOnly && (
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
        {isReadOnly && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#b45309' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <div>
              <strong>Read-only Version:</strong> This version is currently <strong>{status}</strong>. Only <strong>Draft</strong> versions can be edited. To make changes, please return to the Dashboard/Reader and select <strong>"Create New Draft"</strong>.
            </div>
          </div>
        )}
        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--neutral-border)', marginBottom: '1.5rem', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('description')}
            className="btn btn-secondary"
            style={{
              borderBottom: activeTab === 'description' ? '2px solid var(--primary)' : 'none',
              borderRadius: '4px 4px 0 0',
              background: activeTab === 'description' ? '#ffffff' : 'transparent',
              boxShadow: 'none',
              fontWeight: activeTab === 'description' ? 600 : 400
            }}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('workflow')}
            className="btn btn-secondary"
            style={{
              borderBottom: activeTab === 'workflow' ? '2px solid var(--primary)' : 'none',
              borderRadius: '4px 4px 0 0',
              background: activeTab === 'workflow' ? '#ffffff' : 'transparent',
              boxShadow: 'none',
              fontWeight: activeTab === 'workflow' ? 600 : 400
            }}
          >
            Workflow ({steps.length})
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className="btn btn-secondary"
            style={{
              borderBottom: activeTab === 'form' ? '2px solid var(--primary)' : 'none',
              borderRadius: '4px 4px 0 0',
              background: activeTab === 'form' ? '#ffffff' : 'transparent',
              boxShadow: 'none',
              fontWeight: activeTab === 'form' ? 600 : 400
            }}
          >
            Form ({workflowForms.length})
          </button>
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }} disabled={isReadOnly}>
        {/* TAB 1: DESCRIPTION */}
        {activeTab === 'description' && (
          <div className="paper-card accent-teal">
            <h2 style={{ borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>Process Description & Metadata</h2>
            
            <div className="grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Process Title*</label>
                <input
                  type="text"
                  placeholder="e.g. Cleaning-in-Place (CIP) Fermentation Tank"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Version Code</label>
                <input
                  type="text"
                  style={{ width: '150px', background: '#f3f4f6', cursor: 'not-allowed' }}
                  value={version}
                  disabled
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Lifecycle Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  disabled={isReadOnly}
                  style={{ width: '200px', padding: '0.45rem 0.6rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', background: '#ffffff', fontSize: '0.875rem' }}
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending Review">Pending Review</option>
                </select>
              </div>
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
                      padding: '0.25rem 0.5rem', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '0.25rem',
                      textTransform: 'none',
                      fontWeight: 500,
                      fontSize: '0.8rem'
                    }}
                  >
                    {role}
                    {!isReadOnly && (
                      <button 
                        type="button" 
                        onClick={() => handleDeleteRole(role)}
                        style={{ 
                          border: 'none', 
                          background: 'transparent', 
                          color: 'rgba(255, 255, 255, 0.8)', 
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

            {/* AUTHORIZATION METADATA SECTION */}
            <div style={{ borderTop: '1px dashed var(--neutral-border)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>Standardized SOP Sign-off Setup</h3>
              
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
                      <td style={{ padding: '0.75rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                        Author
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                        <input
                          type="text"
                          placeholder="Enter author name"
                          value={sopSignoffs.author?.name || ''}
                          onChange={(e) => {
                            setSopSignoffs(prev => ({
                              ...prev,
                              author: { ...(prev.author || { name: '', title: '' }), name: e.target.value }
                            }));
                          }}
                          style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                        <input
                          type="text"
                          placeholder="Enter author work title"
                          value={sopSignoffs.author?.title || ''}
                          onChange={(e) => {
                            setSopSignoffs(prev => ({
                              ...prev,
                              author: { ...(prev.author || { name: '', title: '' }), title: e.target.value }
                            }));
                          }}
                          style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }}
                        />
                      </td>
                      <td style={{ width: '40px' }}></td>
                    </tr>

                    {/* Reviewers Rows */}
                    {(sopSignoffs.reviewers || []).map((rev, idx) => (
                      <tr key={`reviewer-${idx}`} style={{ borderTop: '1px solid rgba(0, 0, 0, 0.05)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                          Reviewer {sopSignoffs.reviewers && sopSignoffs.reviewers.length > 1 ? `#${idx + 1}` : ''}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            placeholder="Enter reviewer name"
                            value={rev.name || ''}
                            onChange={(e) => {
                              const list = [...(sopSignoffs.reviewers || [])];
                              list[idx] = { ...list[idx], name: e.target.value };
                              setSopSignoffs(prev => ({ ...prev, reviewers: list }));
                            }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            placeholder="Enter reviewer work title"
                            value={rev.title || ''}
                            onChange={(e) => {
                              const list = [...(sopSignoffs.reviewers || [])];
                              list[idx] = { ...list[idx], title: e.target.value };
                              setSopSignoffs(prev => ({ ...prev, reviewers: list }));
                            }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }}
                          />
                        </td>
                        <td style={{ width: '40px', padding: '0.75rem 0 0.75rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {!isReadOnly && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                const list = (sopSignoffs.reviewers || []).filter((_, i) => i !== idx);
                                setSopSignoffs(prev => ({ ...prev, reviewers: list }));
                              }}
                              style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* Authorisers Rows */}
                    {(sopSignoffs.authorisers || []).map((auth, idx) => (
                      <tr key={`authoriser-${idx}`} style={{ borderTop: '1px solid rgba(0, 0, 0, 0.05)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', verticalAlign: 'middle' }}>
                          Authoriser {sopSignoffs.authorisers && sopSignoffs.authorisers.length > 1 ? `#${idx + 1}` : ''}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            placeholder="Enter authoriser name"
                            value={auth.name || ''}
                            onChange={(e) => {
                              const list = [...(sopSignoffs.authorisers || [])];
                              list[idx] = { ...list[idx], name: e.target.value };
                              setSopSignoffs(prev => ({ ...prev, authorisers: list }));
                            }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', verticalAlign: 'middle' }}>
                          <input
                            type="text"
                            placeholder="Enter authoriser work title"
                            value={auth.title || ''}
                            onChange={(e) => {
                              const list = [...(sopSignoffs.authorisers || [])];
                              list[idx] = { ...list[idx], title: e.target.value };
                              setSopSignoffs(prev => ({ ...prev, authorisers: list }));
                            }}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', margin: 0, width: '100%', background: '#ffffff' }}
                          />
                        </td>
                        <td style={{ width: '40px', padding: '0.75rem 0 0.75rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          {!isReadOnly && (
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                const list = (sopSignoffs.authorisers || []).filter((_, i) => i !== idx);
                                setSopSignoffs(prev => ({ ...prev, authorisers: list }));
                              }}
                              style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Addition controls */}
                {!isReadOnly && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSopSignoffs(prev => ({
                          ...prev,
                          reviewers: [...(prev.reviewers || []), { name: '', title: '' }]
                        }));
                      }}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Plus size={14} /> Add Reviewer
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSopSignoffs(prev => ({
                          ...prev,
                          authorisers: [...(prev.authorisers || []), { name: '', title: '' }]
                        }));
                      }}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <Plus size={14} /> Add Authoriser
                    </button>
                  </div>
                )}

                {/* Effective Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Effective Date:
                  </label>
                  <input
                    type="date"
                    value={sopSignoffs.effectiveDate || ''}
                    onChange={(e) => setSopSignoffs(prev => ({ ...prev, effectiveDate: e.target.value }))}
                    style={{ padding: '0.45rem 0.6rem', fontSize: '0.875rem', width: '200px', margin: 0, background: '#ffffff' }}
                  />
                </div>
              </div>
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
                    xml={generateBPMNXML(steps, title || 'Untitled Process', roles || [])}
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
                  <BpmnViewerComponent xml={generateBPMNXML(steps, title || 'Untitled Process', roles || [])} />
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
              <div>Action Command (Verb + Noun + Target)*</div>
              <div>Responsible Role</div>
              <div>BPMN Shape</div>
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
                } else if (step.bpmnShape === 'end-event') {
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
                            placeholder="e.g. Turn valve A..."
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
                          {hasFormOption && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {!step.producesForm ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleStepChange(index, 'producesForm', true)}
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
                                    marginTop: '2px'
                                  }}
                                >
                                  <Plus size={12} /> Add form
                                </button>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', width: '100%', marginTop: '2px' }}>
                                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Form:</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. Tank CIP Checklist"
                                    value={step.formName || ''}
                                    onChange={(e) => handleStepChange(index, 'formName', e.target.value)}
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
                                      setSteps(prev => {
                                        const updated = [...prev];
                                        updated[index] = { 
                                          ...updated[index], 
                                          producesForm: false, 
                                          formName: '' 
                                        };
                                        return enforceStepShapes(updated);
                                      });
                                    }}
                                    style={{ padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24px', cursor: 'pointer' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Responsible Role Select */}
                        <div>
                          <select
                            value={step.role}
                            onChange={(e) => handleStepChange(index, 'role', e.target.value)}
                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: 0 }}
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
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: 0 }}
                            >
                              <option value="task">Task</option>
                              <option value="exclusive-gateway">Gateway (XOR)</option>
                              <option value="end-event">End</option>
                            </select>
                          )}
                        </div>

                        {/* Connects to Step Select */}
                        <div>
                          {(isStart || step.bpmnShape === 'task' || !step.bpmnShape) ? (
                            <select
                              value={step.nextStepId || ''}
                              onChange={(e) => handleStepChange(index, 'nextStepId', e.target.value)}
                              style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: '100%', margin: 0 }}
                            >
                              {steps.map((s, sIdx) => (
                                s.id !== step.id && (
                                  <option key={s.id} value={s.id}>
                                    #{sIdx + 1}: {s.bpmnShape === 'start-event' ? 'Start' : s.bpmnShape === 'end-event' ? 'End' : (s.action ? (s.action.slice(0, 20) + (s.action.length > 20 ? '...' : '')) : `Untitled (${s.bpmnShape || 'task'})`)}
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
                                      #{sIdx + 1}: {s.bpmnShape === 'start-event' ? 'Start' : s.bpmnShape === 'end-event' ? 'End' : (s.action ? (s.action.slice(0, 20) + (s.action.length > 20 ? '...' : '')) : `Untitled (${s.bpmnShape || 'task'})`)}
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
                                      #{sIdx + 1}: {s.bpmnShape === 'start-event' ? 'Start' : s.bpmnShape === 'end-event' ? 'End' : (s.action ? (s.action.slice(0, 20) + (s.action.length > 20 ? '...' : '')) : `Untitled (${s.bpmnShape || 'task'})`)}
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
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {/* File input (hidden) */}
                          <input 
                            type="file" 
                            accept=".pdf" 
                            style={{ display: 'none' }} 
                            id={`pdf-file-${formName}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setWorkflowFormsData(prev => ({
                                  ...prev,
                                  [formName]: {
                                    ...prev[formName] || {},
                                    pdfName: file.name
                                  }
                                }));
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              padding: '0.35rem 0.75rem', 
                              fontSize: '0.8rem',
                              height: '32px',
                              background: '#ffffff',
                              border: '1px solid var(--neutral-border)'
                            }}
                            onClick={() => document.getElementById(`pdf-file-${formName}`)?.click()}
                          >
                            <Upload size={13} />
                            Upload PDF
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.35rem', 
                              padding: '0.35rem 0.75rem', 
                              fontSize: '0.8rem',
                              height: '32px',
                              background: '#ffffff',
                              border: '1px solid var(--neutral-border)'
                            }}
                            onClick={() => {
                              const currentUrl = workflowFormsData[formName]?.onlineUrl || '';
                              const url = window.prompt(`Enter URL for ${formName} online version:`, currentUrl);
                              if (url !== null) {
                                setWorkflowFormsData(prev => ({
                                  ...prev,
                                  [formName]: {
                                    ...prev[formName] || {},
                                    onlineUrl: url.trim()
                                  }
                                }));
                              }
                            }}
                          >
                            <LinkIcon size={13} />
                            Link Online Form
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Status badges */}
                    {(workflowFormsData[formName]?.pdfName || workflowFormsData[formName]?.onlineUrl) && (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {workflowFormsData[formName]?.pdfName && (
                          <div style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            padding: '0.25rem 0.5rem', 
                            background: '#eff6ff', 
                            border: '1px solid #bfdbfe', 
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#1e40af'
                          }}>
                            <span>PDF Attachment: <strong>{workflowFormsData[formName].pdfName}</strong></span>
                            {!isReadOnly && (
                              <button 
                                type="button" 
                                style={{ 
                                  border: 'none', 
                                  background: 'none', 
                                  padding: 0, 
                                  cursor: 'pointer', 
                                  color: '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: '0.9rem',
                                  fontWeight: 'bold',
                                  marginLeft: '0.25rem'
                                }} 
                                onClick={() => {
                                  setWorkflowFormsData(prev => {
                                    const copy = { ...prev };
                                    if (copy[formName]) {
                                      const { pdfName, ...rest } = copy[formName];
                                      copy[formName] = rest;
                                    }
                                    return copy;
                                  });
                                }}
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        )}

                        {workflowFormsData[formName]?.onlineUrl && (
                          <div style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            padding: '0.25rem 0.5rem', 
                            background: '#f0fdf4', 
                            border: '1px solid #bbf7d0', 
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#166534'
                          }}>
                            <span>Online URL: <a href={workflowFormsData[formName].onlineUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#166534', fontWeight: 600 }}>{workflowFormsData[formName].onlineUrl}</a></span>
                            {!isReadOnly && (
                              <button 
                                type="button" 
                                style={{ 
                                  border: 'none', 
                                  background: 'none', 
                                  padding: 0, 
                                  cursor: 'pointer', 
                                  color: '#ef4444',
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: '0.9rem',
                                  fontWeight: 'bold',
                                  marginLeft: '0.25rem'
                                }} 
                                onClick={() => {
                                  setWorkflowFormsData(prev => {
                                    const copy = { ...prev };
                                    if (copy[formName]) {
                                      const { onlineUrl, ...rest } = copy[formName];
                                      copy[formName] = rest;
                                    }
                                    return copy;
                                  });
                                }}
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </fieldset>
      </div>
    </div>
  );
};
