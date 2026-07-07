import React, { useState, useEffect } from 'react';
import type { Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, FileText, Eye, Calendar, Printer, History, PenTool, Edit2, GitBranch } from 'lucide-react';
import SubmissionManager from './SubmissionManager';
import { BPMNGuide } from './BPMNGuide';
import PrintBlankForm from './print/PrintBlankForm';

interface DashboardProps {
  onSelectProcess: (id: string) => void;
  onEditProcess: (id: string | null, tab?: 'description' | 'workflow' | 'form', formName?: string) => void;
  onViewFormSubmissions?: (formName: string) => void;
  onPrintForm?: (processId: string, formName: string) => void;
  onOpenFormManager?: (processId: string, formName: string) => void;
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
  onEditProcess, 
  onViewFormSubmissions, 
  onOpenFormManager,
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
    const active = group.find(p => p.status === 'Active');
    return active || group[0]; // Active version takes priority, else latest version
  };

  const processFamilies = Object.keys(groups).map(parentId => {
    const allVersions = groups[parentId];
    const representative = getRepresentative(allVersions);
    return {
      parentId,
      representative,
      allVersions
    };
  });

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

  const groupedForms: { [processId: string]: { processTitle: string, forms: any[] } } = {};

  latestFormsMap.forEach((formRecord, formId) => {
    let linkedProc = processes.find(proc => {
      const parentId = proc.parentProcessId || proc.id;
      const allVersions = groups[parentId] || [];
      const rep = getRepresentative(allVersions);
      
      if (proc.id === rep.id) {
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
      }
      return false;
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

    const formItem = {
      formName: formId, // Holds Form ID to keep prop interfaces intact
      formTitle: formTitle,
      formId: formId,
      version: formRecord.version || 'v1.0',
      status: formRecord.status || 'DRAFT',
      blocksCount,
      blockTypes,
      processId: linkedProc ? linkedProc.id : null,
      isLinked: !!linkedProc,
      rawRecord: formRecord // Store database record for print template
    };

    if (linkedProc) {
      if (!groupedForms[linkedProc.id]) {
        groupedForms[linkedProc.id] = {
          processTitle: linkedProc.title,
          forms: []
        };
      }
      groupedForms[linkedProc.id].forms.push(formItem);
    } else {
      const unlinkedKey = 'unlinked';
      if (!groupedForms[unlinkedKey]) {
        groupedForms[unlinkedKey] = {
          processTitle: 'Biểu mẫu tự do (Không liên kết quy trình)',
          forms: []
        };
      }
      groupedForms[unlinkedKey].forms.push(formItem);
    }
  });

  // Apply search query filter
  const q = searchQuery.toLowerCase();
  const filteredGroupedForms: { [processId: string]: { processTitle: string, forms: any[] } } = {};

  Object.entries(groupedForms).forEach(([procId, group]) => {
    const matchedForms = group.forms.filter(form => {
      return form.formTitle.toLowerCase().includes(q) || 
             form.formId.toLowerCase().includes(q) || 
             group.processTitle.toLowerCase().includes(q);
    });

    if (matchedForms.length > 0) {
      filteredGroupedForms[procId] = {
        processTitle: group.processTitle,
        forms: matchedForms
      };
    }
  });

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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.75rem' }}>
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
        <button
          className={`btn btn-sm ${viewMode === 'guide' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { onViewModeChange && onViewModeChange('guide'); setSearchQuery(''); onClearFormFilter && onClearFormFilter(); }}
          style={{ borderRadius: '20px', padding: '0.35rem 1.25rem' }}
        >
          Guide
        </button>
      </div>

      {viewMode !== 'submissions' && viewMode !== 'guide' && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem' }}>
          <div className="search-wrapper" style={{ flex: 1, marginBottom: 0 }}>
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder={viewMode === 'processes' ? "Search processes by title, description or checks..." : "Search forms by name, form ID, or linked process..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {hasPermission('design_document') && viewMode === 'processes' && (
            <button 
              className="btn btn-primary" 
              onClick={() => onEditProcess(null)}
              style={{ flexShrink: 0 }}
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
        />
      ) : viewMode === 'guide' ? (
        <BPMNGuide />
      ) : viewMode === 'forms' ? (() => {
        const hasAnyForm = Object.values(filteredGroupedForms).some(g => g.forms.length > 0);
        if (!hasAnyForm) {
          return (
            <div className="paper-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <FileText size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
              <h3>No Form Templates Found</h3>
              <p style={{ maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                {searchQuery 
                  ? 'No results match your search query. Try clearing the filter or checking your spelling.'
                  : 'There are currently no form templates created in your processes. Design a process and add forms to get started.'}
              </p>
              {searchQuery && (
                <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>Clear Search</button>
              )}
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {Object.entries(filteredGroupedForms).map(([procId, { processTitle, forms }]) => {
              if (forms.length === 0) return null;
              return (
                <div key={procId} className="paper-card accent-teal" style={{ padding: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 700 }}>
                    <FileText size={18} style={{ color: 'var(--primary)' }} />
                    {processTitle}
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
                    {forms.map((form) => {
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
                            
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {form.formTitle}
                            </h4>
                          </div>

                          <div>
                            <div style={{ display: 'flex', gap: '0.35rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title="Fill Form"
                                onClick={() => onOpenFormManager ? onOpenFormManager(form.processId || 'unlinked', form.formName) : onSelectProcess(form.processId || 'unlinked')}
                              >
                                <PenTool size={13} style={{ flexShrink: 0 }} />
                                Fill
                              </button>
                              
                              <button 
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title="Print Blank Form"
                                onClick={() => {
                                  const raw = form.rawRecord;
                                  const fullTemplate = {
                                    ...raw,
                                    formTitle: form.formTitle,
                                    layoutBlocks: typeof raw.layout_blocks === 'string' ? JSON.parse(raw.layout_blocks) : (raw.layout_blocks || []),
                                    revisionHistory: typeof raw.revision_history === 'string' ? JSON.parse(raw.revision_history) : (raw.revision_history || []),
                                    version: form.version,
                                    status: form.status
                                  };
                                  setPrintTemplateData(fullTemplate);
                                }}
                              >
                                <Printer size={13} style={{ flexShrink: 0 }} />
                                Print
                              </button>
                              
                              {hasPermission('design_document') && (
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  title="Edit Template"
                                  onClick={() => onEditProcess(form.processId, 'form', form.formName)}
                                >
                                  <Edit2 size={13} style={{ flexShrink: 0 }} />
                                  Edit
                                </button>
                              )}
                              
                              <button 
                                className="btn btn-secondary btn-sm"
                                style={{ flex: 1, padding: '0.3rem 0.4rem', fontSize: '0.75rem', margin: 0, gap: '0.2rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                title="View Submissions"
                                onClick={() => {
                                  if (form.processId && onOpenFormManager) {
                                    onOpenFormManager(form.processId, form.formName);
                                  } else if (onViewFormSubmissions) {
                                    onViewFormSubmissions(form.formName);
                                  }
                                }}
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
                </div>
              );
            })}
          </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1rem' }}>
          {filteredFamilies.map(({ parentId, representative, allVersions }) => {
            const selectedId = selectedProcessVersions[parentId];
            const currentRep = selectedId ? allVersions.find(v => v.id === selectedId) || representative : representative;
            const status = currentRep.status || 'Active';
            const colors = statusColors[status] || { bg: '#e5e7eb', text: '#4b5563', border: '#cbd5e1' };

            return (
              <div 
                key={parentId} 
                style={{ 
                  background: '#ffffff', 
                  border: '1px solid var(--neutral-border)', 
                  borderRadius: '8px', 
                  padding: '1.25rem 1rem 1rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer'
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
                      width: '100%',
                      margin: 0
                    }}
                    onClick={() => onSelectProcess(currentRep.id)}
                  >
                    <Eye size={12} /> View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {printTemplateData && (
        <PrintBlankForm
          template={printTemplateData}
          onClose={() => setPrintTemplateData(null)}
        />
      )}
    </div>
  );
};
