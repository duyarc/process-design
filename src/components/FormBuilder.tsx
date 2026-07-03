import { useState, useEffect } from 'react';
import type { FormFieldISO, FormRevisionEntry, FormTemplateISO } from '../types';
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  CheckSquare, 
  Hash, 
  Calendar, 
  Lock, 
  Unlock, 
  Save, 
  CheckCircle, 
  X, 
  Clock, 
  Settings,
  PenTool,
  Camera,
  Printer
} from 'lucide-react';
import PrintBlankForm from './print/PrintBlankForm';

interface FormBuilderProps {
  formName: string;
  initialData?: {
    formId?: string;
    formTitle?: string;
    version?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    isoFields?: FormFieldISO[];
    revisionHistory?: FormRevisionEntry[];
  };
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function FormBuilder({ formName, initialData, onSave, onClose }: FormBuilderProps) {
  // 1. Initial State Resolution
  const [formId, setFormId] = useState(initialData?.formId || `FM-${formName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`);
  const [formTitle, setFormTitle] = useState(initialData?.formTitle || formName);
  const [version, setVersion] = useState(initialData?.version || 'v0.1 (' + new Date().toISOString().split('T')[0] + ')');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(initialData?.status || 'DRAFT');
  const [fields, setFields] = useState<FormFieldISO[]>(initialData?.isoFields || []);
  const [revisionHistory, setRevisionHistory] = useState<FormRevisionEntry[]>(initialData?.revisionHistory || []);
  
  // Editorial states
  const [changeSummary, setChangeSummary] = useState('');
  const [isLocked, setIsLocked] = useState(initialData?.status === 'ACTIVE');
  const [printPreviewData, setPrintPreviewData] = useState<FormTemplateISO | null>(null);

  useEffect(() => {
    setIsLocked(status === 'ACTIVE');
  }, [status]);

  // Extract version numbers for display logic
  const parseVersion = (vString: string) => {
    const match = vString.match(/^v(\d+)\.(\d+)/);
    if (match) {
      return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
    }
    return { major: 0, minor: 1 };
  };

  // 2. Field management
  const addField = (type: FormFieldISO['type']) => {
    if (isLocked) return;
    
    const newField: FormFieldISO = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      checkItem: '',
      locationCode: '',
      frequency: 'Once/Shift',
      reactionProtocol: '',
      unit: type === 'number' ? 'bar' : undefined,
      minSpec: type === 'number' ? 0 : undefined,
      maxSpec: type === 'number' ? 100 : undefined,
      targetRange: type === 'checkbox' ? 'Checked & Ok' : type === 'text' ? 'Ok' : undefined
    };
    
    setFields(prev => [...prev, newField]);
  };

  const updateField = (id: string, updates: Partial<FormFieldISO>) => {
    if (isLocked) return;
    setFields(prev => prev.map(field => field.id === id ? { ...field, ...updates } : field));
  };

  const removeField = (id: string) => {
    if (isLocked) return;
    setFields(prev => prev.filter(field => field.id !== id));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (isLocked) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    
    setFields(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  // 3. ISO Version Control Operations
  const handleSaveDraft = () => {
    const dateToday = new Date().toISOString().split('T')[0];
    const { major, minor } = parseVersion(version);
    
    // Kept draft version number, but update date
    const updatedVersion = `v${major}.${minor} (${dateToday})`;
    setVersion(updatedVersion);

    const savedData = {
      formId,
      formTitle,
      version: updatedVersion,
      status: 'DRAFT',
      isoFields: fields,
      revisionHistory
    };

    onSave(savedData);
    alert('Draft saved successfully!');
  };

  const handlePublish = () => {
    if (!formId.trim()) {
      alert('Please enter a Form ID (e.g. FM-QA-001) for ISO tracking.');
      return;
    }
    if (fields.length === 0) {
      alert('Please add at least one field to this form before publishing.');
      return;
    }
    if (fields.some(f => !f.checkItem.trim())) {
      alert('All fields must have a "Check Item" description.');
      return;
    }
    if (!changeSummary.trim() && revisionHistory.length > 0) {
      alert('Please enter a brief "Change Summary" describing the revision.');
      return;
    }

    const dateToday = new Date().toISOString().split('T')[0];
    const { major } = parseVersion(version);
    
    // Round to next major version upon release
    const nextMajor = revisionHistory.length === 0 ? 1 : major + 1;
    const publishedVersion = `v${nextMajor}.0 (${dateToday})`;

    // Log this release into the revision history table
    const newHistoryEntry: FormRevisionEntry = {
      version: `v${nextMajor}.0`,
      date: dateToday,
      author: 'Authorised User', // In real system, pull from AuthContext
      change: changeSummary.trim() || 'Initial release'
    };

    const updatedHistory = [...revisionHistory, newHistoryEntry];

    setVersion(publishedVersion);
    setStatus('ACTIVE');
    setRevisionHistory(updatedHistory);
    setChangeSummary('');
    setIsLocked(true);

    const publishedData = {
      formId,
      formTitle,
      version: publishedVersion,
      status: 'ACTIVE',
      isoFields: fields,
      revisionHistory: updatedHistory
    };

    onSave(publishedData);
    alert(`Form template successfully published to Production as ${publishedVersion}! Form is now locked.`);
  };

  const handleCreateNewVersion = () => {
    const { major } = parseVersion(version);
    const dateToday = new Date().toISOString().split('T')[0];
    
    // Increment minor version for drafting
    const draftVersion = `v${major}.1 (${dateToday})`;
    
    setVersion(draftVersion);
    setStatus('DRAFT');
    setIsLocked(false);
    setChangeSummary('');
    
    alert(`New draft version created: ${draftVersion}. You can now make edits. The previous version remains active in production until you publish this draft.`);
  };

  if (printPreviewData) {
    return (
      <PrintBlankForm
        template={printPreviewData}
        onClose={() => setPrintPreviewData(null)}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '82vh',
      background: '#f8fafc',
      border: '1px solid var(--neutral-border)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginTop: '1rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    }}>
      {/* 3.1 Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        background: '#ffffff',
        borderBottom: '1px solid var(--neutral-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: isLocked ? '#fef2f2' : '#ecfdf5',
            color: isLocked ? '#ef4444' : '#10b981',
            padding: '0.5rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center'
          }}>
            {isLocked ? <Lock size={20} /> : <Unlock size={20} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                disabled={isLocked}
                placeholder="Form Title"
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  border: isLocked ? 'none' : '1px solid transparent',
                  background: 'transparent',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '4px',
                  width: '300px',
                  outline: 'none',
                  color: 'var(--text-primary)'
                }}
              />
              <span className={`badge ${isLocked ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem' }}>
                {status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
              <span>ID: <strong style={{ color: 'var(--text-primary)' }}>{formId}</strong></span>
              <span>•</span>
              <span>Version: <strong style={{ color: 'var(--text-primary)' }}>{version}</strong></span>
            </div>
          </div>
        </div>
        
        <button 
          type="button" 
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: '50%'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* 3.2 Main Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Side: Element drawer */}
        <div style={{
          width: '240px',
          background: '#ffffff',
          borderRight: '1px solid var(--neutral-border)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
            Available Fields
          </h3>
          
          <button 
            type="button" 
            onClick={() => addField('number')}
            disabled={isLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              background: '#f8fafc',
              border: '1px solid var(--neutral-border)',
              borderRadius: '6px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              textAlign: 'left',
              width: '100%',
              transition: 'all 0.2s'
            }}
          >
            <Hash size={16} style={{ color: 'var(--primary)' }} />
            <span>Numeric Check</span>
          </button>
          
          <button 
            type="button" 
            onClick={() => addField('checkbox')}
            disabled={isLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              background: '#f8fafc',
              border: '1px solid var(--neutral-border)',
              borderRadius: '6px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <CheckSquare size={16} style={{ color: '#10b981' }} />
            <span>Checkbox OK/FAIL</span>
          </button>

          <button 
            type="button" 
            onClick={() => addField('text')}
            disabled={isLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              background: '#f8fafc',
              border: '1px solid var(--neutral-border)',
              borderRadius: '6px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <FileText size={16} style={{ color: '#3b82f6' }} />
            <span>Text Note Field</span>
          </button>

          <button 
            type="button" 
            onClick={() => addField('date')}
            disabled={isLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              background: '#f8fafc',
              border: '1px solid var(--neutral-border)',
              borderRadius: '6px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <Calendar size={16} style={{ color: '#f59e0b' }} />
            <span>Date Picker</span>
          </button>

          <button 
            type="button" 
            onClick={() => addField('photo')}
            disabled={isLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              background: '#f8fafc',
              border: '1px solid var(--neutral-border)',
              borderRadius: '6px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <Camera size={16} style={{ color: '#ec4899' }} />
            <span>Photo / Media Evidence</span>
          </button>

          <button 
            type="button" 
            onClick={() => addField('signature')}
            disabled={isLocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 0.75rem',
              background: '#f8fafc',
              border: '1px solid var(--neutral-border)',
              borderRadius: '6px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
              textAlign: 'left',
              width: '100%'
            }}
          >
            <PenTool size={16} style={{ color: '#8b5cf6' }} />
            <span>Operator Signature</span>
          </button>
        </div>

        {/* Center: Added Fields List */}
        <div style={{
          flex: 1,
          padding: '1.5rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {isLocked && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              color: '#b45309',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              <Lock size={16} />
              <span><strong>Form Locked:</strong> This form template is in Active production. To make edits, click <strong>Create New Version</strong> in the right panel.</span>
            </div>
          )}

          {fields.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              border: '2px dashed var(--neutral-border)',
              borderRadius: '8px',
              background: '#ffffff',
              padding: '3rem',
              color: 'var(--text-muted)'
            }}>
              <Plus size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p style={{ fontWeight: 500, margin: 0 }}>No form fields added yet</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', marginBottom: 0 }}>Click elements in the left panel to populate this checklist.</p>
            </div>
          ) : (
            fields.map((field, idx) => (
              <div 
                key={field.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--neutral-border)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  position: 'relative'
                }}
              >
                {/* Drag / reorder handles */}
                <div style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '1rem',
                  display: 'flex',
                  gap: '0.15rem'
                }}>
                  <button 
                    type="button" 
                    disabled={idx === 0 || isLocked}
                    onClick={() => moveField(idx, 'up')}
                    style={{ background: 'none', border: 'none', color: idx === 0 ? '#cbd5e1' : 'var(--text-muted)', cursor: isLocked ? 'not-allowed' : 'pointer', padding: '2px' }}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button 
                    type="button" 
                    disabled={idx === fields.length - 1 || isLocked}
                    onClick={() => moveField(idx, 'down')}
                    style={{ background: 'none', border: 'none', color: idx === fields.length - 1 ? '#cbd5e1' : 'var(--text-muted)', cursor: isLocked ? 'not-allowed' : 'pointer', padding: '2px' }}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button 
                    type="button" 
                    disabled={isLocked}
                    onClick={() => removeField(field.id)}
                    style={{ background: 'none', border: 'none', color: isLocked ? '#cbd5e1' : '#ef4444', cursor: isLocked ? 'not-allowed' : 'pointer', padding: '2px', marginLeft: '0.5rem' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Main input details */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', maxWidth: '85%' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', background: '#f1f5f9', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {idx + 1}
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 2 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Check Item / Question Name</label>
                      <input 
                        type="text"
                        value={field.checkItem}
                        onChange={(e) => updateField(field.id, { checkItem: e.target.value })}
                        disabled={isLocked}
                        placeholder="e.g. Check Hydraulic Pressure"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Location Code</label>
                      <input 
                        type="text"
                        value={field.locationCode}
                        onChange={(e) => updateField(field.id, { locationCode: e.target.value })}
                        disabled={isLocked}
                        placeholder="e.g. PG-02"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '120px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Frequency</label>
                      <select
                        value={field.frequency}
                        onChange={(e) => updateField(field.id, { frequency: e.target.value })}
                        disabled={isLocked}
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', outline: 'none', background: '#fff' }}
                      >
                        <option value="Once/Shift">Once/Shift</option>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Hourly">Hourly</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Sub-details (min/max spec or target range depending on type) */}
                <div style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px', marginLeft: '2.5rem' }}>
                  {field.type === 'number' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Min Spec</label>
                        <input 
                          type="number"
                          value={field.minSpec ?? ''}
                          onChange={(e) => updateField(field.id, { minSpec: parseFloat(e.target.value) || 0 })}
                          disabled={isLocked}
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Max Spec</label>
                        <input 
                          type="number"
                          value={field.maxSpec ?? ''}
                          onChange={(e) => updateField(field.id, { maxSpec: parseFloat(e.target.value) || 0 })}
                          disabled={isLocked}
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '80px' }}>
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Unit</label>
                        <input 
                          type="text"
                          value={field.unit || ''}
                          onChange={(e) => updateField(field.id, { unit: e.target.value })}
                          disabled={isLocked}
                          placeholder="e.g. bar"
                          style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                        />
                      </div>
                    </>
                  )}

                  {(field.type === 'checkbox' || field.type === 'text') && (
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>Target Spec / Safe Condition</label>
                      <input 
                        type="text"
                        value={field.targetRange || ''}
                        onChange={(e) => updateField(field.id, { targetRange: e.target.value })}
                        disabled={isLocked}
                        placeholder={field.type === 'checkbox' ? 'e.g. Checked & Released' : 'e.g. Clean & No leaks'}
                        style={{ padding: '0.25rem 0.4rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', background: '#fff' }}
                      />
                    </div>
                  )}

                  {field.type === 'date' && (
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      📅 Renders a Date selection field for operators at point of use.
                    </div>
                  )}
                  {field.type === 'photo' && (
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      📷 Renders a Camera button to upload photo evidence directly.
                    </div>
                  )}
                  {field.type === 'signature' && (
                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      ✍️ Renders a signature panel for the operator to sign off.
                    </div>
                  )}
                </div>

                {/* Reaction Protocol (No Check Without Consequence) */}
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '2.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', marginBottom: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Settings size={12} />
                    <span>Reaction Protocol (If Out of Specification / FAIL)</span>
                  </label>
                  <textarea 
                    value={field.reactionProtocol}
                    onChange={(e) => updateField(field.id, { reactionProtocol: e.target.value })}
                    disabled={isLocked}
                    rows={2}
                    placeholder="Describe exactly what action the operator must take if this check fails. (e.g. Halt line, isolate batch, notify lead)."
                    style={{
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.82rem',
                      border: '1px solid #fbcfe8',
                      borderRadius: '4px',
                      outline: 'none',
                      resize: 'none',
                      background: '#fffbfb'
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Side: Version Control & Revision History Log */}
        <div style={{
          width: '280px',
          background: '#ffffff',
          borderLeft: '1px solid var(--neutral-border)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto'
        }}>
          <div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
              ISO Version Control
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ISO Document Form ID</label>
                <input 
                  type="text" 
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  disabled={isLocked}
                  placeholder="e.g. FM-QA-001"
                  style={{
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.85rem',
                    border: '1px solid var(--neutral-border)',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>

            {/* Actions depending on lock state */}
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {!isLocked ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="btn btn-secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.85rem' }}
                  >
                    <Save size={16} />
                    <span>Save Draft</span>
                  </button>

                  <div style={{ borderTop: '1px solid var(--neutral-border)', margin: '0.5rem 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Change Summary (For Release)</label>
                    <textarea 
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      placeholder="Explain what was edited (e.g. Added safety guard check)..."
                      rows={3}
                      style={{
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.8rem',
                        border: '1px solid var(--neutral-border)',
                        borderRadius: '4px',
                        resize: 'none'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handlePublish}
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.85rem', background: '#10b981', borderColor: '#10b981' }}
                  >
                    <CheckCircle size={16} />
                    <span>Publish Version</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateNewVersion}
                  className="btn btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.85rem', background: 'var(--primary)', borderColor: 'var(--primary)' }}
                >
                  <Unlock size={16} />
                  <span>Create New Version</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setPrintPreviewData({
                  formId,
                  formTitle,
                  version,
                  status,
                  fields,
                  revisionHistory
                })}
                className="btn btn-secondary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', fontSize: '0.85rem', marginTop: '0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
              >
                <Printer size={16} />
                <span>Print Preview (A4)</span>
              </button>
              
              <div style={{ borderTop: '1px solid var(--neutral-border)', margin: '0.25rem 0' }} />
            </div>
          </div>

          {/* Revision History list */}
          <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={12} />
              <span>Revision History</span>
            </h3>
            
            {revisionHistory.length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                No published revisions yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {revisionHistory.map((rev, index) => (
                  <div 
                    key={index}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--neutral-border)',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      <span>{rev.version}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{rev.date}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                      {rev.change}
                    </p>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginTop: '0.25rem', textAlign: 'right' }}>
                      By: {rev.author}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
