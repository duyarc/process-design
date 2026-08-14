import React, { useState, useEffect } from 'react';
import type { Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, FileText, Eye, Calendar, Printer, History, PenTool, Edit2, GitBranch, ChevronDown, ChevronUp, Grid, List } from 'lucide-react';
import SubmissionManager from './SubmissionManager';
import { BPMNGuide } from './BPMNGuide';
import PrintBlankForm from './print/PrintBlankForm';

interface DashboardProps {
  onSelectProcess: (id: string) => void;
  onPrintProcess?: (id: string) => void;
  onEditProcess: (id: string | null, tab?: 'description' | 'workflow' | 'form', formName?: string | null) => void;
  onViewFormSubmissions?: (formName: string) => void;
  onPrintForm?: (processId: string, formName: string) => void;
  onOpenFormManager?: (processId: string, formName: string) => void;
  onOpenFormFiller?: (processId: string, formName: string) => void;
  viewMode?: 'processes' | 'forms' | 'submissions' | 'guide';
  onViewModeChange?: (mode: 'processes' | 'forms' | 'submissions' | 'guide') => void;
  initialFormFilter?: string | null;
  onClearFormFilter?: () => void;
}

const statusColors: { [key: string]: { bg: string, text: string, border: string } } = {
  'Draft': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  'Pending Review': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Active': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Superseded': { bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' },
  'Retired': { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' }
};

export const Dashboard: React.FC<DashboardProps> = ({ 
  onSelectProcess, 
  onPrintProcess,
  onEditProcess, 
  onViewFormSubmissions, 
  onOpenFormManager,
  onOpenFormFiller,
  viewMode = 'processes',
  onViewModeChange,
  initialFormFilter = null,
  onClearFormFilter
}) => {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [allForms, setAllForms] = useState<any[]>([]);
  const [selectedFormVersions, setSelectedFormVersions] = useState<Record<string, string>>({});
  const [printTemplateData, setPrintTemplateData] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProcessVersions, setSelectedProcessVersions] = useState<Record<string, string>>({});
  const [retiredCollapsed, setRetiredCollapsed] = useState(true);
  const [processSelectDialog, setProcessSelectDialog] = useState<{ form: any; action: 'fill' | 'audit' } | null>(null);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('dashboard_layout_mode');
    return (saved === 'grid' || saved === 'list') ? saved : 'list';
  });

  const handleLayoutModeChange = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    localStorage.setItem('dashboard_layout_mode', mode);
  };
  
  const getFormattedVersionString = (proc: Process) => {
    const rawVersion = proc.version || '0.1';
    const cleanVersion = /^[vV]/.test(rawVersion) ? rawVersion.trim().slice(1) : rawVersion.trim();
    const dateSource = proc.sopSignoffs?.effectiveDate || proc.lastUpdated;
    if (!dateSource) return `V${cleanVersion}`;
    try {
      const d = new Date(dateSource);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `V${cleanVersion}-${day}.${month}.${year}`;
    } catch (e) {
      return `V${cleanVersion}`;
    }
  };
  const { hasPermission } = useAuth();

  const fetchProcesses = async () => {
    try {
      setLoading(true);
      const [procRes, formsRes] = await Promise.all([
        fetch('/api/processes'),
        fetch('/api/forms')
      ]);

      if (!procRes.ok) throw new Error('Failed to fetch processes');
      const data = await procRes.json();
      setProcesses(data);

      if (formsRes.ok) {
        const formsData = await formsRes.json();
        setAllForms(formsData);
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not load processes. Please check if the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProcesses();
  }, []);





  // Group processes by family (parentProcessId)
  const groups: { [parentId: string]: Process[] } = {};
  processes.forEach(p => {
    const parentId = p.parentProcessId || p.id;
    if (!groups[parentId]) {
      groups[parentId] = [];
    }
    groups[parentId].push(p);
  });

  // Sort versions within each family descending by version number
  Object.keys(groups).forEach(parentId => {
    groups[parentId].sort((a, b) => {
      const aVer = parseInt(a.version, 10) || 0;
      const bVer = parseInt(b.version, 10) || 0;
      return bVer - aVer;
    });
  });

  const getRepresentative = (group: Process[]): Process => {
    const draft = group.find(p => p.status === 'Draft');
    if (draft) return draft;
    const active = group.find(p => p.status === 'Active');
    if (active) return active;
    const retired = group.find(p => p.status === 'Retired');
    return retired || group[0]; // Active version takes priority, then Retired, else latest version
  };

  const getFamilyTimestamp = (family: { representative: Process; allVersions: Process[] }) => {
    const repTime = new Date(family.representative.lastUpdated || 0).getTime();
    const maxVersionTime = Math.max(
      ...family.allVersions.map(v => new Date(v.lastUpdated || 0).getTime()),
      0
    );
    return Math.max(repTime, maxVersionTime);
  };

  const processFamilies = Object.keys(groups)
    .filter(parentId => parentId !== 'unlinked')
    .map(parentId => {
      const allVersions = groups[parentId];
      const representative = getRepresentative(allVersions);
      return {
        parentId,
        representative,
        allVersions
      };
    })
    .sort((a, b) => getFamilyTimestamp(b) - getFamilyTimestamp(a));

  const filteredFamilies = processFamilies.filter(family => {
    const q = searchQuery.toLowerCase();
    // Search across representative title/description
    const repMatches = family.representative.title.toLowerCase().includes(q) ||
                       family.representative.description.toLowerCase().includes(q);
    
    // Or if any specific steps or fields match
    const stepMatches = family.representative.steps?.some(s => s.action.toLowerCase().includes(q));
    const fieldMatches = family.representative.formFields?.some(f => f.checkItem.toLowerCase().includes(q));

    return repMatches || stepMatches || fieldMatches;
  });

  // Group allForms by form_id
  const formsGroupedById: Record<string, any[]> = {};
  allForms.forEach(f => {
    if (!formsGroupedById[f.form_id]) {
      formsGroupedById[f.form_id] = [];
    }
    formsGroupedById[f.form_id].push(f);
  });

  // Group allForms by form_id and get unique list of forms with selected or latest version records
  const latestFormsMap = new Map();
  Object.entries(formsGroupedById).forEach(([formId, versionsList]) => {
    const sorted = [...versionsList].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    const chosenVersion = selectedFormVersions[formId];
    const matched = chosenVersion 
      ? sorted.find(f => f.version === chosenVersion) 
      : sorted[0];
    latestFormsMap.set(formId, matched || sorted[0]);
  });

  const formsList: any[] = [];
  latestFormsMap.forEach((formRecord, formId) => {
    const linkedProcs = processes.filter(proc => {
      const parentId = proc.parentProcessId || proc.id;
      const allVersions = groups[parentId] || [];
      const rep = getRepresentative(allVersions);
      
      if (proc.id !== rep.id || rep.status === 'Retired') {
        return false;
      }

      return allVersions.some(p => {
        const wfd = p.workflowFormsData
          ? (typeof p.workflowFormsData === 'string' ? JSON.parse(p.workflowFormsData) : p.workflowFormsData)
          : null;
        const steps = p.steps
          ? (typeof p.steps === 'string' ? JSON.parse(p.steps) : p.steps)
          : null;
        
        const hasInWfd = wfd && Object.values(wfd).some((fdata: any) => fdata.formId === formId);
        const hasInSteps = steps && steps.some((s: any) => s.producesForm && (s.formNames || []).includes(formId));
        return hasInWfd || hasInSteps;
      });
    });

    const formTitle = formRecord.form_title || formRecord.form_name || formId;
    const blocksCount = typeof formRecord.layout_blocks === 'string'
      ? JSON.parse(formRecord.layout_blocks).length
      : (formRecord.layout_blocks?.length || 0);

    const blockTypesList = (typeof formRecord.layout_blocks === 'string'
      ? JSON.parse(formRecord.layout_blocks)
      : (formRecord.layout_blocks || [])).map((b: any) => {
        if (b.type === 'TITLE') return 'Title';
        if (b.type === 'INFO_GRID') return 'Info Grid';
        if (b.type === 'CHECKLIST_TABLE') return 'Table';
        if (b.type === 'MATRIX_TABLE') return 'Matrix Table';
        if (b.type === 'SIGN') return 'Sign';
        return b.type;
      }) || [];
    const blockTypes = Array.from(new Set(blockTypesList)).join(', ');

    const linkedProcesses = linkedProcs.map(p => ({ id: p.id, title: p.title }));

    formsList.push({
      formName: formId,
      formTitle: formTitle,
      formId: formId,
      version: formRecord.version || 'v1.0',
      status: formRecord.status || 'DRAFT',
      blocksCount,
      blockTypes,
      linkedProcesses,
      rawRecord: formRecord
    });
  });

  // Sort formsList descending by latest update timestamp (updated_at)
  const getFormTimestamp = (form: any) => {
    const dateVal = form.rawRecord?.updated_at || form.rawRecord?.updatedAt || 0;
    return dateVal ? new Date(dateVal).getTime() : 0;
  };

  formsList.sort((a, b) => {
    const diff = getFormTimestamp(b) - getFormTimestamp(a);
    if (diff !== 0) return diff;
    return a.formTitle.localeCompare(b.formTitle);
  });

  const q = searchQuery.toLowerCase();
  const filteredFormsList = formsList.filter(form => {
    return form.formTitle.toLowerCase().includes(q) || 
           form.formId.toLowerCase().includes(q) || 
           form.linkedProcesses.some((lp: any) => lp.title.toLowerCase().includes(q));
  });
  const activeFamilies = filteredFamilies.filter(f => {
    const selectedId = selectedProcessVersions[f.parentId];
    const currentRep = selectedId ? f.allVersions.find(v => v.id === selectedId) || f.representative : f.representative;
    return (currentRep.status || 'Active') !== 'Retired';
  });

  const retiredFamilies = filteredFamilies.filter(f => {
    const selectedId = selectedProcessVersions[f.parentId];
    const currentRep = selectedId ? f.allVersions.find(v => v.id === selectedId) || f.representative : f.representative;
    return (currentRep.status || 'Active') === 'Retired';
  });

  const renderProcessCard = (family: typeof filteredFamilies[0], isRetired = false) => {
    const { parentId, representative, allVersions } = family;
    const selectedId = selectedProcessVersions[parentId];
    const currentRep = selectedId ? allVersions.find(v => v.id === selectedId) || representative : representative;
    const status = currentRep.status || 'Active';
    const colors = statusColors[status] || { bg: '#e5e7eb', text: '#4b5563', border: '#cbd5e1' };

    return (
      <div 
        key={parentId} 
        style={{ 
          background: isRetired ? '#fafafa' : '#ffffff', 
          border: isRetired ? '1px dashed var(--neutral-border)' : '1px solid var(--neutral-border)', 
          borderRadius: '8px', 
          padding: '1.25rem 1rem 1rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: isRetired ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          cursor: 'pointer',
          opacity: isRetired ? 0.85 : 1
        }}
        className="hover-card-bg"
        onClick={() => onSelectProcess(currentRep.id)}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              {parentId}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.15rem 0.4rem',
                fontSize: '0.72rem',
                borderRadius: '4px',
                border: '1px solid var(--neutral-border)',
                background: '#ffffff',
                color: 'var(--text-primary)',
                fontWeight: 600,
                height: '22px'
              }}>
                <GitBranch size={11} style={{ marginRight: '0.2rem', color: 'var(--text-secondary)' }} />
                {allVersions.length > 1 ? (
                  <select
                    value={currentRep.id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedProcessVersions(prev => ({ ...prev, [parentId]: val }));
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      margin: 0,
                      width: 'auto',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {allVersions.map(v => (
                      <option key={v.id} value={v.id}>
                        {getFormattedVersionString(v)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span style={{ color: 'var(--text-primary)' }}>{getFormattedVersionString(currentRep)}</span>
                )}
              </div>

              <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', height: '22px', display: 'inline-flex', alignItems: 'center', margin: 0 }}>
                {status}
              </span>
            </div>
          </div>

          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {currentRep.title}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '2.55rem', lineHeight: 1.5 }}>
            {currentRep.description || 'No description provided.'}
          </p>
        </div>

        <div>
          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <Calendar size={11} /> {new Date(currentRep.lastUpdated).toLocaleDateString('vi-VN')}
            </span>
            <span>•</span>
            <span>{currentRep.steps?.length || 0} Steps</span>
            <span>•</span>
            <span>{currentRep.formFields?.length || 0} Params</span>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }} onClick={e => e.stopPropagation()}>
            <button 
              className="btn btn-secondary btn-sm"
              title="View Process"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                height: '28px',
                flex: 1,
                margin: 0
              }}
              onClick={() => onSelectProcess(currentRep.id)}
            >
              <Eye size={12} /> View
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              title="Print Process"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                height: '28px',
                flex: 1,
                margin: 0
              }}
              onClick={() => onPrintProcess ? onPrintProcess(currentRep.id) : onSelectProcess(currentRep.id)}
            >
              <Printer size={12} /> Print
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProcessListTable = (familiesList: typeof filteredFamilies, isRetired = false) => {
    return (
      <div className={`paper-card ${isRetired ? '' : 'accent-teal'}`} style={{ padding: '1.5rem', background: isRetired ? '#fafafa' : '#ffffff', border: isRetired ? '1px dashed var(--neutral-border)' : 'none', boxShadow: isRetired ? 'none' : undefined }}>

        <div style={{ overflowX: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--neutral-border)', background: isRetired ? '#f1f5f9' : '#f8fafc', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '15%' }}>Process ID</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '35%' }}>Title & Description</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '18%' }}>Version</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '12%' }}>Status</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '12%' }}>Last update</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '8%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {familiesList.map((family) => {
                const { parentId, representative, allVersions } = family;
                const selectedId = selectedProcessVersions[parentId];
                const currentRep = selectedId ? allVersions.find(v => v.id === selectedId) || representative : representative;
                const status = currentRep.status || 'Active';
                const colors = statusColors[status] || { bg: '#e5e7eb', text: '#4b5563', border: '#cbd5e1' };

                return (
                  <tr 
                    key={parentId} 
                    style={{ borderBottom: '1px solid var(--neutral-border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                        {parentId}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem', marginBottom: '0.15rem' }}>{currentRep.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{currentRep.description || 'No description provided.'}</div>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '0.15rem 0.4rem',
                        fontSize: '0.72rem',
                        borderRadius: '4px',
                        border: '1px solid var(--neutral-border)',
                        background: '#ffffff',
                        color: 'var(--text-primary)',
                        fontWeight: 600,
                        height: '22px'
                      }}>
                        <GitBranch size={11} style={{ marginRight: '0.2rem', color: 'var(--text-secondary)' }} />
                        {allVersions.length > 1 ? (
                          <select
                            value={currentRep.id}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedProcessVersions(prev => ({ ...prev, [parentId]: val }));
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              margin: 0,
                              width: 'auto',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {allVersions.map(v => (
                              <option key={v.id} value={v.id}>
                                {getFormattedVersionString(v)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: 'var(--text-primary)' }}>{getFormattedVersionString(currentRep)}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', margin: 0 }}>
                        {status}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                       <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                         <Calendar size={11} /> {new Date(currentRep.lastUpdated).toLocaleDateString('vi-VN')}
                       </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          title="View Process"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            height: '26px',
                            margin: 0
                          }}
                          onClick={() => onSelectProcess(currentRep.id)}
                        >
                          <Eye size={12} />
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          title="Print Process"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            height: '26px',
                            margin: 0
                          }}
                          onClick={() => onPrintProcess ? onPrintProcess(currentRep.id) : onSelectProcess(currentRep.id)}
                        >
                          <Printer size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="quote-card">
        <p className="quote-text">
          We believe <span className="highlight">common sense</span> and <span className="highlight">simplicity</span> are usually better guidelines than unnecessary sophistication and complexity.
        </p>
        <p className="quote-author">
          — AB Inbev’s 7<sup>th</sup> principle
        </p>
      </div>

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${viewMode === 'processes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { onViewModeChange && onViewModeChange('processes'); setSearchQuery(''); onClearFormFilter && onClearFormFilter(); }}
            style={{ borderRadius: '20px', padding: '0.35rem 1.25rem' }}
          >
            Processes
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'forms' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { onViewModeChange && onViewModeChange('forms'); setSearchQuery(''); onClearFormFilter && onClearFormFilter(); }}
            style={{ borderRadius: '20px', padding: '0.35rem 1.25rem' }}
          >
            Forms
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'submissions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { onViewModeChange && onViewModeChange('submissions'); setSearchQuery(''); }}
            style={{ borderRadius: '20px', padding: '0.35rem 1.25rem' }}
          >
            Submissions
          </button>
        </div>

        {viewMode !== 'guide' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#f1f5f9', padding: '2px', borderRadius: '6px', border: '1px solid var(--neutral-border)' }}>
            <button
              type="button"
              onClick={() => handleLayoutModeChange('list')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                border: 'none',
                background: layoutMode === 'list' ? '#ffffff' : 'transparent',
                color: layoutMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: layoutMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
              title="List View"
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => handleLayoutModeChange('grid')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                border: 'none',
                background: layoutMode === 'grid' ? '#ffffff' : 'transparent',
                color: layoutMode === 'grid' ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: layoutMode === 'grid' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.15s ease'
              }}
              title="Grid View"
            >
              <Grid size={15} />
            </button>
          </div>
        )}
      </div>

      {viewMode !== 'submissions' && viewMode !== 'guide' && (
        <div className="paper-card" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={viewMode === 'processes' ? "Search processes by title, description or checks..." : "Search forms by name, form ID, or linked process..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '0.45rem 0.6rem 0.45rem 2.25rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', width: '100%', outline: 'none', background: '#fff' }}
            />
          </div>
          {hasPermission('design_document') && viewMode === 'processes' && (
            <button 
              className="btn btn-primary" 
              onClick={() => onEditProcess(null)}
              style={{ flexShrink: 0, margin: 0 }}
            >
              <Plus size={18} />
              New Process
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="paper-card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: '#fee2e2' }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading processes database...</p>
        </div>
      ) : viewMode === 'submissions' ? (
        <SubmissionManager 
          isEmbedded={true} 
          initialFormFilter={initialFormFilter} 
          onBack={onClearFormFilter} 
          layoutMode={layoutMode}
        />
      ) : viewMode === 'guide' ? (
        <BPMNGuide />
      ) : viewMode === 'forms' ? (() => {
        const handleFillAction = (form: any) => {
          if (form.linkedProcesses.length > 1) {
            setProcessSelectDialog({ form, action: 'fill' });
          } else if (form.linkedProcesses.length === 1) {
            if (onOpenFormFiller) {
              onOpenFormFiller(form.linkedProcesses[0].id, form.formName);
            } else if (onOpenFormManager) {
              onOpenFormManager(form.linkedProcesses[0].id, form.formName);
            } else {
              onSelectProcess(form.linkedProcesses[0].id);
            }
          } else {
            if (onOpenFormFiller) {
              onOpenFormFiller('unlinked', form.formName);
            } else if (onOpenFormManager) {
              onOpenFormManager('unlinked', form.formName);
            } else {
              onSelectProcess('unlinked');
            }
          }
        };

        const handleAuditAction = (form: any) => {
          if (form.linkedProcesses.length > 1) {
            setProcessSelectDialog({ form, action: 'audit' });
          } else if (form.linkedProcesses.length === 1) {
            if (onOpenFormManager) {
              onOpenFormManager(form.linkedProcesses[0].id, form.formName);
            } else if (onViewFormSubmissions) {
              onViewFormSubmissions(form.formName);
            }
          } else {
            if (onViewFormSubmissions) {
              onViewFormSubmissions(form.formName);
            }
          }
        };

        if (filteredFormsList.length === 0) {
          return (
            <div className="paper-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <FileText size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
              <h3>No Form Templates Found</h3>
              <p style={{ maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                {searchQuery 
                  ? 'No results match your search query. Try clearing the filter or checking your spelling.'
                  : 'There are currently no form templates created. Create a process and add forms to get started.'}
              </p>
              {searchQuery && (
                <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>Clear Search</button>
              )}
            </div>
          );
        }

        return (
          <>
            {layoutMode === 'list' ? (
              <div className="paper-card accent-teal" style={{ padding: '1.5rem' }}>
                <div style={{ overflowX: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--neutral-border)', background: '#f8fafc', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '12%' }}>Form ID</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '30%' }}>Form Title</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '28%' }}>Linked Process</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '15%' }}>Version</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '8%' }}>Status</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '7%' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFormsList.map((form) => {
                        const status = form.status || 'DRAFT';
                        const colors = status === 'ACTIVE' 
                          ? { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' } 
                          : { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
                        const displayStatus = status;

                        return (
                          <tr 
                            key={form.formName} 
                            style={{ borderBottom: '1px solid var(--neutral-border)', transition: 'background 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                                {form.formId}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {form.formTitle}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle', fontSize: '0.8rem' }}>
                              {form.linkedProcesses.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                  {form.linkedProcesses.map((lp: any) => (
                                    <span 
                                      key={lp.id} 
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        padding: '0.15rem 0.4rem', 
                                        fontSize: '0.72rem', 
                                        borderRadius: '4px', 
                                        background: '#f1f5f9', 
                                        color: 'var(--text-primary)', 
                                        border: '1px solid #e2e8f0',
                                        fontWeight: 500
                                      }}
                                    >
                                      {lp.title}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Biểu mẫu tự do (Không liên kết)</span>
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              {formsGroupedById[form.formId] && (
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '0.15rem 0.4rem',
                                  fontSize: '0.72rem',
                                  borderRadius: '4px',
                                  border: '1px solid var(--neutral-border)',
                                  background: '#ffffff',
                                  color: 'var(--text-primary)',
                                  fontWeight: 600,
                                  height: '22px'
                                }}>
                                  <GitBranch size={11} style={{ marginRight: '0.2rem', color: 'var(--text-secondary)' }} />
                                  {formsGroupedById[form.formId].length > 1 ? (
                                    <select
                                      value={form.version}
                                      onChange={(e) => {
                                        const selectedVal = e.target.value;
                                        setSelectedFormVersions(prev => ({
                                          ...prev,
                                          [form.formId]: selectedVal
                                        }));
                                      }}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        padding: 0,
                                        margin: 0,
                                        width: 'auto',
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        outline: 'none'
                                      }}
                                    >
                                      {formsGroupedById[form.formId]
                                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                                        .map((vOpt: any) => {
                                          let displayOptVersion = vOpt.version;
                                          try {
                                            const updateDate = new Date(vOpt.updated_at).toLocaleDateString('vi-VN');
                                            displayOptVersion = `${vOpt.version} (${updateDate})`;
                                          } catch (_) {}
                                          return (
                                            <option key={vOpt.id || vOpt.version} value={vOpt.version}>
                                              {displayOptVersion}
                                            </option>
                                          );
                                        })
                                      }
                                    </select>
                                  ) : (() => {
                                    const singleForm = formsGroupedById[form.formId][0];
                                    let displaySingleVersion = singleForm.version;
                                    try {
                                      const updateDate = new Date(singleForm.updated_at).toLocaleDateString('vi-VN');
                                      displaySingleVersion = `${singleForm.version} (${updateDate})`;
                                    } catch (_) {}
                                    return <span style={{ color: 'var(--text-primary)' }}>{displaySingleVersion}</span>;
                                  })()}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', margin: 0 }}>
                                {displayStatus}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '26px' }}
                                  title="Fill Form"
                                  onClick={() => handleFillAction(form)}
                                >
                                  <PenTool size={12} />
                                </button>
                                
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '26px' }}
                                  title="Print Blank Form"
                                  onClick={() => {
                                    const raw = form.rawRecord || {};
                                    const fullTemplate = {
                                      ...raw,
                                      formId: form.formId || form.formName || raw.form_id,
                                      formTitle: form.formTitle || raw.form_title || raw.form_name,
                                      layoutBlocks: typeof raw.layout_blocks === 'string' ? JSON.parse(raw.layout_blocks) : (raw.layout_blocks || []),
                                      revisionHistory: typeof raw.revision_history === 'string' ? JSON.parse(raw.revision_history) : (raw.revision_history || []),
                                      version: form.version || raw.version,
                                      status: form.status || raw.status,
                                      effectiveDate: raw.effective_date || raw.effectiveDate || raw.created_at,
                                      updatedAt: raw.updated_at || raw.updatedAt || raw.created_at
                                    };
                                    setPrintTemplateData(fullTemplate);
                                  }}
                                >
                                  <Printer size={12} />
                                </button>
                                
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '26px' }}
                                  title="Export PDF"
                                  onClick={() => {
                                    const raw = form.rawRecord || {};
                                    const fullTemplate = {
                                      ...raw,
                                      formId: form.formId || form.formName || raw.form_id,
                                      formTitle: form.formTitle || raw.form_title || raw.form_name,
                                      layoutBlocks: typeof raw.layout_blocks === 'string' ? JSON.parse(raw.layout_blocks) : (raw.layout_blocks || []),
                                      revisionHistory: typeof raw.revision_history === 'string' ? JSON.parse(raw.revision_history) : (raw.revision_history || []),
                                      version: form.version || raw.version,
                                      status: form.status || raw.status,
                                      effectiveDate: raw.effective_date || raw.effectiveDate || raw.created_at,
                                      updatedAt: raw.updated_at || raw.updatedAt || raw.created_at,
                                      autoExportPdf: true
                                    };
                                    setPrintTemplateData(fullTemplate);
                                  }}
                                >
                                  <FileText size={12} />
                                </button>
                                
                                {hasPermission('design_document') && (
                                  <button 
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '26px' }}
                                    title="Edit Template"
                                    onClick={() => onEditProcess(form.linkedProcesses[0]?.id || null, 'form', form.formName)}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                )}
                                
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '26px' }}
                                  title="View Submissions"
                                  onClick={() => handleAuditAction(form)}
                                >
                                  <History size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
                {filteredFormsList.map((form) => {
                  const status = form.status || 'DRAFT';
                  const colors = status === 'ACTIVE' 
                    ? { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' } 
                    : { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
                  const displayStatus = status;

                  return (
                    <div 
                      key={form.formName} 
                      style={{ 
                        background: '#ffffff', 
                        border: '1px solid var(--neutral-border)', 
                        borderRadius: '8px', 
                        padding: '1.25rem 1rem 1rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                      }}
                      className="hover-card-bg"
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                            {form.formId}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {formsGroupedById[form.formId] && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.15rem 0.4rem',
                                fontSize: '0.72rem',
                                borderRadius: '4px',
                                border: '1px solid var(--neutral-border)',
                                background: '#ffffff',
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                                height: '22px'
                              }}>
                                <GitBranch size={11} style={{ marginRight: '0.2rem', color: 'var(--text-secondary)' }} />
                                {formsGroupedById[form.formId].length > 1 ? (
                                  <select
                                    value={form.version}
                                    onChange={(e) => {
                                      const selectedVal = e.target.value;
                                      setSelectedFormVersions(prev => ({
                                        ...prev,
                                        [form.formId]: selectedVal
                                      }));
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      padding: 0,
                                      margin: 0,
                                      width: 'auto',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      color: 'var(--text-primary)',
                                      cursor: 'pointer',
                                      outline: 'none'
                                    }}
                                  >
                                    {formsGroupedById[form.formId]
                                      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                                      .map((vOpt: any) => {
                                        let displayOptVersion = vOpt.version;
                                        try {
                                          const updateDate = new Date(vOpt.updated_at).toLocaleDateString('vi-VN');
                                          displayOptVersion = `${vOpt.version} (${updateDate})`;
                                        } catch (_) {}
                                        return (
                                          <option key={vOpt.id || vOpt.version} value={vOpt.version}>
                                            {displayOptVersion}
                                          </option>
                                        );
                                      })
                                    }
                                  </select>
                                ) : (() => {
                                  const singleForm = formsGroupedById[form.formId][0];
                                  let displaySingleVersion = singleForm.version;
                                  try {
                                    const updateDate = new Date(singleForm.updated_at).toLocaleDateString('vi-VN');
                                    displaySingleVersion = `${singleForm.version} (${updateDate})`;
                                  } catch (_) {}
                                  return <span style={{ color: 'var(--text-primary)' }}>{displaySingleVersion}</span>;
                                })()}
                              </div>
                            )}
                            <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', height: '22px', display: 'inline-flex', alignItems: 'center', margin: 0 }}>
                              {displayStatus}
                            </span>
                          </div>
                        </div>
                        
                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                          {form.formTitle}
                        </h4>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          Linked Processes: {form.linkedProcesses.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                              {form.linkedProcesses.map((lp: any) => (
                                <span 
                                  key={lp.id} 
                                  style={{ 
                                    display: 'inline-flex', 
                                    padding: '0.1rem 0.35rem', 
                                    fontSize: '0.7rem', 
                                    borderRadius: '4px', 
                                    background: '#f1f5f9', 
                                    color: 'var(--text-primary)', 
                                    border: '1px solid #e2e8f0',
                                    fontWeight: 500
                                  }}
                                >
                                  {lp.title}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <strong style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Biểu mẫu tự do (Không liên kết)</strong>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', gap: '0.35rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title="Fill Form"
                            onClick={() => handleFillAction(form)}
                          >
                            <PenTool size={13} style={{ flexShrink: 0 }} />
                            Fill
                          </button>
                          
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title="Print Blank Form"
                            onClick={() => {
                              const raw = form.rawRecord || {};
                              const fullTemplate = {
                                ...raw,
                                formId: form.formId || form.formName || raw.form_id,
                                formTitle: form.formTitle || raw.form_title || raw.form_name,
                                layoutBlocks: typeof raw.layout_blocks === 'string' ? JSON.parse(raw.layout_blocks) : (raw.layout_blocks || []),
                                revisionHistory: typeof raw.revision_history === 'string' ? JSON.parse(raw.revision_history) : (raw.revision_history || []),
                                version: form.version || raw.version,
                                status: form.status || raw.status,
                                effectiveDate: raw.effective_date || raw.effectiveDate || raw.created_at,
                                updatedAt: raw.updated_at || raw.updatedAt || raw.created_at
                              };
                              setPrintTemplateData(fullTemplate);
                            }}
                          >
                            <Printer size={13} style={{ flexShrink: 0 }} />
                            Print
                          </button>

                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title="Export PDF"
                            onClick={() => {
                              const raw = form.rawRecord || {};
                              const fullTemplate = {
                                ...raw,
                                formId: form.formId || form.formName || raw.form_id,
                                formTitle: form.formTitle || raw.form_title || raw.form_name,
                                layoutBlocks: typeof raw.layout_blocks === 'string' ? JSON.parse(raw.layout_blocks) : (raw.layout_blocks || []),
                                revisionHistory: typeof raw.revision_history === 'string' ? JSON.parse(raw.revision_history) : (raw.revision_history || []),
                                version: form.version || raw.version,
                                status: form.status || raw.status,
                                effectiveDate: raw.effective_date || raw.effectiveDate || raw.created_at,
                                updatedAt: raw.updated_at || raw.updatedAt || raw.created_at,
                                autoExportPdf: true
                              };
                              setPrintTemplateData(fullTemplate);
                            }}
                          >
                            <FileText size={13} style={{ flexShrink: 0 }} />
                            PDF
                          </button>
                          
                          {hasPermission('design_document') && (
                            <button 
                              className="btn btn-secondary btn-sm"
                              style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              title="Edit Template"
                              onClick={() => onEditProcess(form.linkedProcesses[0]?.id || null, 'form', form.formName)}
                            >
                              <Edit2 size={13} style={{ flexShrink: 0 }} />
                              Edit
                            </button>
                          )}
                          
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title="View Submissions"
                            onClick={() => handleAuditAction(form)}
                          >
                            <History size={13} style={{ flexShrink: 0 }} />
                            Audit
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {processSelectDialog && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                backdropFilter: 'blur(4px)'
              }}>
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  width: '100%',
                  maxWidth: '480px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                  padding: '1.75rem',
                  border: '1px solid var(--neutral-border)'
                }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Chọn quy trình liên kết
                  </h4>
                  <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Biểu mẫu này được liên kết với nhiều quy trình đang hoạt động. Vui lòng chọn quy trình bạn muốn thực hiện thao tác:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
                    {processSelectDialog.form.linkedProcesses.map((lp: any) => (
                      <button
                        key={lp.id}
                        onClick={() => {
                          const action = processSelectDialog.action;
                          const form = processSelectDialog.form;
                          setProcessSelectDialog(null);
                          if (action === 'fill') {
                            if (onOpenFormFiller) {
                              onOpenFormFiller(lp.id, form.formName);
                            } else if (onOpenFormManager) {
                              onOpenFormManager(lp.id, form.formName);
                            } else {
                              onSelectProcess(lp.id);
                            }
                          } else {
                            if (onOpenFormManager) {
                              onOpenFormManager(lp.id, form.formName);
                            } else if (onViewFormSubmissions) {
                              onViewFormSubmissions(form.formName);
                            }
                          }
                        }}
                        className="btn btn-secondary"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          padding: '0.75rem 1rem',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          border: '1px solid var(--neutral-border)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <FileText size={16} style={{ color: 'var(--primary)' }} />
                        {lp.title}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setProcessSelectDialog(null)}
                      className="btn"
                      style={{
                        background: '#f1f5f9',
                        color: 'var(--text-secondary)',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        fontWeight: 600,
                        fontSize: '0.85rem'
                      }}
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })() : filteredFamilies.length === 0 ? (
        <div className="paper-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <FileText size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
          <h3>No Processes Found</h3>
          <p style={{ maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
            {searchQuery 
              ? 'No results match your search query. Try clearing the filter or checking your spelling.'
              : 'The repository is currently empty. Get started by creating your first process standard.'}
          </p>
          {searchQuery ? (
            <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>Clear Search</button>
          ) : (
            hasPermission('design_document') && (
              <button className="btn btn-primary" onClick={() => onEditProcess(null)}>
                <Plus size={18} />
                New Process
              </button>
            )
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Active Processes Group */}
          {activeFamilies.length > 0 ? (
            layoutMode === 'list' ? (
              renderProcessListTable(activeFamilies, false)
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
                {activeFamilies.map((family) => renderProcessCard(family, false))}
              </div>
            )
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--neutral-border)', borderRadius: '8px', background: '#fcfcfc' }}>
              No active processes available.
            </div>
          )}

          {/* Retired Processes Group */}
          {retiredFamilies.length > 0 && (
            <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '1.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setRetiredCollapsed(!retiredCollapsed)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: '1rem',
                  outline: 'none'
                }}
              >
                {retiredCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <span>Retired Processes ({retiredFamilies.length})</span>
              </button>

              {!retiredCollapsed && (
                layoutMode === 'list' ? (
                  renderProcessListTable(retiredFamilies, true)
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
                    {retiredFamilies.map((family) => renderProcessCard(family, true))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
      {printTemplateData && (
        <PrintBlankForm
          template={printTemplateData}
          autoExportPdf={!!printTemplateData.autoExportPdf}
          exportMode={!!printTemplateData.autoExportPdf}
          onClose={() => setPrintTemplateData(null)}
        />
      )}
    </div>
  );
};
