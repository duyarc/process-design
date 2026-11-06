import React, { useState, useEffect, useMemo } from 'react';
import type { Process } from '../types';
import { sanitizeLabel, to5SFileName, toFormSlug } from '../utils/formUtils';
import { useAuth } from '../context/AuthContext';
import { Printer, Edit2, GitBranch, Eye, ArrowLeft, FilePlus, Share2 } from 'lucide-react';
import { ShareProcessModal, type AttachedFormShareItem } from './common/ShareProcessModal';
import { generateBPMNXML, getNumRows } from '../utils/bpmnXmlGenerator';
import { BpmnViewerComponent } from './BpmnViewerComponent';
import PrintBlankForm from './print/PrintBlankForm';

interface ProcessReaderProps {
  processId: string;
  onBack: () => void;
  onEdit: (id: string, tab?: 'description' | 'workflow' | 'form', formName?: string | null) => void;
  onOpenFormFiller?: (processId: string, formName: string, preloadedTemplate?: any) => void;
  initialPrintFormName?: string | null;
  onClearPrintForm?: () => void;
  onSwitchVersion?: (id: string) => void;
  initialTriggerPrint?: boolean;
  isSharedView?: boolean;
}

const statusColors: { [key: string]: { bg: string, text: string, border: string } } = {
  'Draft': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  'Pending Review': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Active': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Superseded': { bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' },
  'Retired': { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' }
};

export const ProcessReader: React.FC<ProcessReaderProps> = ({ 
  processId, 
  onBack, 
  onEdit, 
  onOpenFormFiller,
  initialPrintFormName, 
  onClearPrintForm,
  onSwitchVersion,
  initialTriggerPrint,
  isSharedView = false
}) => {
  const [process, setProcess] = useState<Process | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [allVersions, setAllVersions] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);


  const { hasPermission } = useAuth();

  // Set document.title according to Digital 5S standard
  useEffect(() => {
    const originalTitle = document.title;
    if (process?.title) {
      document.title = `SOP_${to5SFileName(process.title)}`;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [process?.title]);

  const [printTemplateData, setPrintTemplateData] = useState<any | null>(null);
  const [isDirectPrint, setIsDirectPrint] = useState(false);
  const [allForms, setAllForms] = useState<any[]>([]);

  const handleFillForm = (targetFormId: string) => {
    const formData = (process?.workflowFormsData || {})[targetFormId] || {};
    const liveForm = allForms.find(f => (
      f.form_id === targetFormId ||
      f.form_name === targetFormId ||
      f.form_title === targetFormId ||
      (formData.formId && f.form_id === formData.formId)
    ));
    const displayName = formData.formTitle || (liveForm?.form_title || liveForm?.form_name) || targetFormId;
    const slug = toFormSlug(displayName) || targetFormId;

    if (isSharedView) {
      window.location.href = '/f/' + slug + '?fromProcess=' + encodeURIComponent(process?.id || processId);
    } else if (onOpenFormFiller) {
      onOpenFormFiller(process?.id || processId, targetFormId, liveForm || formData);
    } else {
      window.location.href = '/f/' + slug + '?fromProcess=' + encodeURIComponent(process?.id || processId);
    }
  };

  const formsLookup = useMemo(() => {
    const lookup: Record<string, { formTitle?: string; formName?: string }> = {};
    if (allForms && Array.isArray(allForms)) {
      allForms.forEach((f: any) => {
        const fid = f.form_id || f.id;
        if (fid) {
          lookup[fid] = { formTitle: f.form_title || f.title || f.name };
        }
      });
    }
    if (process?.workflowFormsData) {
      Object.entries(process.workflowFormsData).forEach(([fid, val]: [string, any]) => {
        lookup[fid] = {
          ...lookup[fid],
          formTitle: val?.formTitle || val?.form_title || lookup[fid]?.formTitle,
          formName: val?.formName || lookup[fid]?.formName
        };
      });
    }
    return lookup;
  }, [allForms, process?.workflowFormsData]);

  // Calculate workflow output forms
  const workflowForms = useMemo(() => {
    const list: string[] = [];
    (process?.steps || []).forEach((s: any) => {
      if (s.bpmnShape === 'task' && s.producesForm) {
        const names = s.formNames && s.formNames.length > 0
          ? s.formNames.map((n: string) => n.trim()).filter(Boolean)
          : (s.formName ? [s.formName.trim()] : []);
        names.forEach((name: string) => {
          if (!list.includes(name)) {
            list.push(name);
          }
        });
      }
    });
    return list;
  }, [process?.steps]);

  const modalAttachedForms: AttachedFormShareItem[] = useMemo(() => {
    const list: AttachedFormShareItem[] = [];
    workflowForms.forEach(fid => {
      const formData = (process?.workflowFormsData || {})[fid] || {};
      const liveForm = allForms.find(f => (f.form_id === fid || f.form_name === fid || f.form_title === fid || (formData.formId && f.form_id === formData.formId)));
      const fTitle = formData.formTitle || (liveForm?.form_title || liveForm?.form_name) || fid;
      const isPub = liveForm ? (liveForm.is_public === true && liveForm.public_permission !== 'internal') : (formData?.isPublic === true);
      const perm = (liveForm?.public_permission || formData.publicPermission || (isPub ? 'fill' : 'internal')) === 'view' ? 'view' : 'fill';
      list.push({
        formId: fid,
        formTitle: fTitle,
        formSlug: toFormSlug(fTitle) || fid,
        isPublic: isPub,
        publicPermission: perm
      });
    });
    return list;
  }, [workflowForms, process?.workflowFormsData, allForms]);

  const handleSaveShareSettings = async (newIsPublic: boolean, updatedForms: AttachedFormShareItem[]) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/processes/' + encodeURIComponent(processId) + '/share', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: JSON.stringify({
          isPublic: newIsPublic,
          formPermissions: updatedForms.map(f => ({
            formId: f.formId,
            isPublic: f.isPublic,
            publicPermission: f.publicPermission
          }))
        })
      });
      if (!res.ok) throw new Error('Failed to save share settings');
      if (process) {
        const updatedWfd = { ...(process.workflowFormsData || {}) };
        updatedForms.forEach(uf => {
          if (updatedWfd[uf.formId]) {
            updatedWfd[uf.formId] = {
              ...updatedWfd[uf.formId],
              isPublic: uf.isPublic,
              publicPermission: uf.publicPermission
            };
          }
        });
        setProcess({ ...process, is_public: newIsPublic, isPublic: newIsPublic, workflowFormsData: updatedWfd });
      }
      setAllForms(prev => {
        const formMap = new Map(updatedForms.map(uf => [uf.formId, uf]));
        return prev.map(f => {
          const fid = f.form_id || f.form_name;
          const updated = formMap.get(fid) || (f.form_title ? formMap.get(f.form_title) : null);
          if (updated) {
            return {
              ...f,
              is_public: updated.isPublic,
              public_permission: updated.publicPermission
            };
          }
          return f;
        });
      });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

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

  const handleDownloadPdf = async (pdfKey: string) => {
    try {
      const res = await fetch(`/api/storage/download-url?key=${encodeURIComponent(pdfKey)}`);
      if (!res.ok) throw new Error('Failed to get download URL');
      const { downloadUrl } = await res.json();
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Failed to load PDF attachment.');
    }
  };



  const fetchProcess = async () => {
    try {
      setLoading(true);
      if (isSharedView) {
        const res = await fetch('/api/processes/resolve/' + encodeURIComponent(processId));
        if (!res.ok) throw new Error('Failed to fetch process');
        const data = await res.json();
        if (data.exists && data.process) {
          setProcess(data.process);
          setAllVersions([data.process]);
          if (data.allForms) {
            setAllForms(data.allForms);
          }
        } else {
          onBack();
        }
      } else {
        const res = await fetch('/api/processes');
        if (!res.ok) throw new Error('Failed to fetch');
        const list: Process[] = await res.json();
        const found = list.find(p => p.id === processId);
        if (found) {
          setProcess(found);
          
          // Find sibling versions
          const pid = found.parentProcessId || found.id;
          const siblings = list.filter(p => p.parentProcessId === pid || p.id === pid);
          siblings.sort((a, b) => {
            const aVer = parseFloat(a.version.replace(/[^0-9.]/g, '')) || 0;
            const bVer = parseFloat(b.version.replace(/[^0-9.]/g, '')) || 0;
            return bVer - aVer;
          });
          setAllVersions(siblings);
        } else {
          onBack();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([fetchProcess(), fetchFormsList()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  useEffect(() => {
    const loadPrintTemplate = async () => {
      if (initialPrintFormName && process && process.workflowFormsData) {
        const formData = process.workflowFormsData[initialPrintFormName] || 
          Object.values(process.workflowFormsData).find((f: any) => f.formId === initialPrintFormName || f.formName === initialPrintFormName);
        if (formData && formData.formId) {
          try {
            setLoading(true);
            const res = await fetch(`/api/forms/${formData.formId}`);
            if (res.ok) {
              const liveForm = await res.json();
              const fullTemplate = {
                ...formData,
                formId: formData?.formId || liveForm.form_id || liveForm.form_name,
                formTitle: liveForm.form_title || liveForm.form_name || formData?.formTitle,
                layoutBlocks: typeof liveForm.layout_blocks === 'string' ? JSON.parse(liveForm.layout_blocks) : liveForm.layout_blocks,
                revisionHistory: typeof liveForm.revision_history === 'string' ? JSON.parse(liveForm.revision_history) : liveForm.revision_history,
                version: liveForm.version,
                status: liveForm.status,
                effectiveDate: liveForm.effective_date || (formData as any)?.effectiveDate,
                updatedAt: liveForm.updated_at || (formData as any)?.updatedAt
              };
              setPrintTemplateData(fullTemplate as any);
              setIsDirectPrint(true);
            }
          } catch (err) {
            console.error('Error loading print template:', err);
          } finally {
            setLoading(false);
          }
        }
        if (onClearPrintForm) {
          onClearPrintForm();
        }
      }
    };
    loadPrintTemplate();
  }, [initialPrintFormName, process]);
  useEffect(() => {
    if (!loading && process && initialTriggerPrint) {
      const timer = setTimeout(() => {
        window.print();
        if (onClearPrintForm) {
          onClearPrintForm();
        }
        onBack();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [loading, process, initialTriggerPrint, onClearPrintForm, onBack]);
  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading process document...</p>
      </div>
    );
  }

  if (!process) {
    return (
      <div className="paper-card" style={{ borderColor: 'var(--danger)' }}>
        <h3>Error: Process Not Found</h3>
        <button className="btn btn-secondary" onClick={onBack}>Back to Dashboard</button>
      </div>
    );
  }

  const status = process.status || 'Active';
  const colors = statusColors[status] || { bg: '#e5e7eb', text: '#4b5563', border: '#cbd5e1' };

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





  if (printTemplateData) {
    return (
      <PrintBlankForm
        template={printTemplateData}
        onClose={() => {
          setPrintTemplateData(null);
          if (isDirectPrint) {
            onBack();
          }
        }}
      />
    );
  }

  return (
    <div className="print-container">
      <style>{`
        @media print {
          .app-container,
          .main-content {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
          }
          .reader-layout-grid {
            display: block !important;
          }
          .reader-main-content {
            display: block !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .flowchart-print-card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 0 20px 0 !important;
            background: transparent !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .bpmn-viewer-card {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .bpmn-viewer-card svg {
            width: 100% !important;
            height: 100% !important;
          }
        }

        .sop-details-columns-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
          margin-top: 0;
        }
        @media (min-width: 1024px) {
          .sop-details-columns-grid {
            grid-template-columns: 1fr;
          }
        }
        .sop-print-card {
          margin-bottom: 0;
        }
        @media print {
          .sop-details-columns-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .sop-print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: none !important;
            border-radius: 6px !important;
            padding: 1rem !important;
            background: #ffffff !important;
            box-shadow: none !important;
            margin-bottom: 1.5rem !important;
          }
          .sop-print-card.full-width {
            width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .sop-print-card table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .sop-print-card th {
            background-color: #f0f0f0 !important;
            border: 1px solid #111111 !important;
            font-weight: bold !important;
            font-size: 8pt !important;
            padding: 4px 6px !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sop-print-card td {
            border: 1px solid #111111 !important;
            font-size: 8pt !important;
            padding: 4px 6px !important;
          }
        }
      `}</style>

      {/* Document Cover / Header Block */}
      <div className="paper-card accent-teal avoid-page-break" style={{ padding: '1.25rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: '1 1 300px' }}>
            <h1 style={{ 
              marginTop: '0.25rem', 
              marginBottom: '0.25rem', 
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              <button
                className="btn btn-secondary no-print"
                onClick={onBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.3rem',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  margin: '0 0.25rem 0 0',
                  transition: 'background 0.15s, color 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title="Back to Dashboard"
              >
                <ArrowLeft size={16} />
              </button>
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#475569',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                padding: '0.15rem 0.45rem',
                borderRadius: '5px',
                fontFamily: 'monospace',
                verticalAlign: 'middle',
                lineHeight: '1',
                flexShrink: 0
              }}>{process.id}</span>
              <span>{process.title}</span>
              {isSharedView && (
                <span style={{ fontSize: '0.72rem', color: '#0d9488', background: '#f0fdfa', border: '1px solid #ccfbf1', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600, verticalAlign: 'middle' }}>
                  🌐 Bản công khai
                </span>
              )}
            </h1>
            {process.description && process.description.trim() && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 0, whiteSpace: 'pre-line' }}>
                {process.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
            {allVersions.length > 1 && (
              <div className="no-print" style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem 0.6rem',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--neutral-border)',
                background: '#ffffff',
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}>
                <GitBranch size={13} style={{ marginRight: '0.3rem', color: 'var(--text-secondary)' }} />
                <select
                  value={process.id}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (onSwitchVersion) {
                      onSwitchVersion(val);
                    }
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    margin: 0,
                    width: 'auto',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: 'none'
                  }}
                >
                  {allVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      {getFormattedVersionString(v)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <span className="print-only" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>
              {getFormattedVersionString(process)}
            </span>
            <span className="print-only badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', margin: 0 }}>
              {status}
            </span>
            
            {!isSharedView && (
              status === 'Draft' && hasPermission('design_document') ? (
                <button
                  className="btn btn-secondary btn-sm no-print"
                  style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                  onClick={() => onEdit(process.id)}
                >
                  <Edit2 size={13} />
                  Edit
                </button>
              ) : (
                <button
                  className="btn btn-secondary btn-sm no-print"
                  style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                  onClick={() => onEdit(process.id)}
                  title="Xem cấu hình quy trình"
                >
                  <Eye size={13} />
                  View
                </button>
              )
            )}

            {!isSharedView && (
              <button
                className="btn btn-secondary btn-sm no-print"
                style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                onClick={() => setIsShareModalOpen(true)}
                title="Chia sẻ quy trình và biểu mẫu đính kèm"
              >
                <Share2 size={13} />
                Chia sẻ
              </button>
            )}

            <button
              className="btn btn-primary btn-sm no-print"
              style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
              onClick={handlePrint}
            >
              <Printer size={13} />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Process Swimlane Flowchart */}
      {Array.from({ length: process ? getNumRows(process.steps, process.roles) : 1 }).map((_, r) => {
        const rowXml = generateBPMNXML(process.steps, process.title, process.roles || [], r, formsLookup);
        return (
          <div 
            key={r} 
            className="avoid-page-break flowchart-print-card" 
            style={{ marginBottom: '0.25rem' }}
          >
            <div className="mermaid-print-wrapper" style={{ margin: 0 }}>
              <BpmnViewerComponent xml={rowXml} processName={process?.title || 'Quy-trinh'} />
            </div>
          </div>
        );
      })}

      <div className="reader-layout-grid">
        {/* Main Document Content */}
        <div className="reader-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
          
          {/* Document Details & Quality Controls (Printed after Flowchart) */}
          <div className="sop-details-container" style={{ marginTop: 0 }}>
            <div className="sop-details-columns-grid">
              {/* Card: Attached Forms (Full Width) */}
              <div className="paper-card sop-print-card full-width" style={{ border: '1px solid var(--neutral-border)', borderRadius: '8px', padding: '1rem 1.25rem', background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 0.75rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid var(--neutral-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                      BIỂU MẪU ĐI KÈM
                    </h3>
                    {workflowForms.length > 0 && (
                      <span style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '999px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {workflowForms.length}
                      </span>
                    )}
                  </div>
                </div>

                {workflowForms.length === 0 ? (
                  <div style={{ padding: '1.5rem', border: '1px dashed var(--neutral-border)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    No output forms are produced by this workflow.
                  </div>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    border: '1px solid var(--neutral-border)', 
                    borderRadius: '6px', 
                    overflow: 'hidden',
                    background: '#ffffff'
                  }}>
                    {workflowForms.map((formId, idx) => {
                      const formData = (process.workflowFormsData || {})[formId] || {};
                      const liveForm = allForms
                        .filter(f => f.form_id === formId || f.form_name === formId || f.form_title === formId || (formData.formId && f.form_id === formData.formId))
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
                      const hasDigitalForm = !!formId;
                      const displayName = formData.formTitle || (liveForm?.form_title || liveForm?.form_name) || formId;
                      const hasPdf = !!formData.pdfName;
                      const isFormPublic = liveForm ? (liveForm.is_public === true && liveForm.public_permission !== 'internal') : (formData?.isPublic === true);
                      const formPerm = liveForm?.public_permission || formData?.publicPermission || (isFormPublic ? 'fill' : 'internal');
                      const isInternal = isSharedView && (!isFormPublic || formPerm === 'internal');
                      const isViewOnly = isSharedView && formPerm === 'view';

                      return (
                        <div key={formId} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.65rem 1rem',
                          background: '#ffffff',
                          borderBottom: idx < workflowForms.length - 1 ? '1px solid var(--neutral-border)' : 'none',
                          fontSize: '0.85rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, marginRight: '1rem' }}>
                            {/* Form ID Badge */}
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: '#475569',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              padding: '0.18rem 0.5rem',
                              borderRadius: '5px',
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>{formId}</span>

                            {/* Form Title */}
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {displayName}
                            </span>
                            {formData.pdfName && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                • {formData.pdfName}
                              </span>
                            )}
                          </div>

                          {/* 2 Main Actions (Fill & Edit) + Optional Print (Matching Homepage) */}
                          <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            {hasDigitalForm && (
                              <>
                                {/* Action 1: Fill / View Form */}
                                {isInternal ? (
                                  <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    🔒 Nội bộ
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    title={isViewOnly ? "Xem biểu mẫu (Chỉ xem)" : "Điền biểu mẫu (Fill Form)"}
                                    onClick={() => handleFillForm(formId)}
                                    style={{ 
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      height: '32px',
                                      width: '32px',
                                      padding: 0,
                                      background: '#ffffff',
                                      border: '1px solid var(--neutral-border)', 
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      boxShadow: 'var(--shadow-sm)',
                                      margin: 0 
                                    }}
                                    className="hover-card-bg"
                                  >
                                    {isViewOnly ? (
                                      <Eye size={16} style={{ color: '#0d9488' }} />
                                    ) : (
                                      <FilePlus size={16} style={{ color: 'var(--primary)' }} />
                                    )}
                                  </button>
                                )}

                                {/* Action 2: Edit Template (Edit2 neutral) */}
                                {!isSharedView && hasPermission('design_document') && (
                                  <button
                                    type="button"
                                    title="Chỉnh sửa thiết kế (Edit Template)"
                                    onClick={() => onEdit(processId, 'form', formId)}
                                    style={{ 
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      height: '32px',
                                      width: '32px',
                                      padding: 0,
                                      color: 'var(--text-primary)', 
                                      background: '#ffffff',
                                      border: '1px solid var(--neutral-border)', 
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      boxShadow: 'var(--shadow-sm)',
                                      margin: 0 
                                    }}
                                    className="hover-card-bg"
                                  >
                                    <Edit2 size={16} style={{ color: '#334155' }} />
                                  </button>
                                )}

                                {/* Action 3: Print Blank Form */}
                                {!isInternal && (
                                  <button
                                    type="button"
                                    title="In biểu mẫu trắng (Print Blank)"
                                    onClick={async () => {
                                      if (formData && liveForm) {
                                        let fullForm = liveForm;
                                        const targetFormId = formData?.formId || liveForm.form_id || liveForm.form_name;
                                        if (!fullForm.layout_blocks && targetFormId) {
                                          try {
                                            const res = await fetch(`/api/forms/${encodeURIComponent(targetFormId)}`);
                                            if (res.ok) fullForm = await res.json();
                                          } catch (e) {
                                            console.error('Failed to load full form for print:', e);
                                          }
                                        }
                                        const rawBlocks = fullForm?.layout_blocks || formData?.layoutBlocks;
                                        const layoutBlocks = Array.isArray(rawBlocks)
                                          ? rawBlocks
                                          : typeof rawBlocks === 'string'
                                          ? JSON.parse(rawBlocks || '[]')
                                          : [];
                                        const rawRevisions = fullForm?.revision_history || formData?.revisionHistory;
                                        const revisionHistory = Array.isArray(rawRevisions)
                                          ? rawRevisions
                                          : typeof rawRevisions === 'string'
                                          ? JSON.parse(rawRevisions || '[]')
                                          : [];
                                        const fullTemplate = {
                                          ...formData,
                                          formId: targetFormId,
                                          formTitle: fullForm.form_title || fullForm.form_name || formData?.formTitle || targetFormId,
                                          layoutBlocks,
                                          revisionHistory,
                                          version: fullForm.version || formData?.version || 'V0.1',
                                          status: fullForm.status || formData?.status || 'DRAFT',
                                          effectiveDate: fullForm.effective_date || (formData as any)?.effectiveDate,
                                          updatedAt: fullForm.updated_at || (formData as any)?.updatedAt,
                                          pageSize: fullForm.page_size || (formData as any)?.pageSize || 'A4'
                                        };
                                        setPrintTemplateData(fullTemplate as any);
                                      }
                                    }}
                                    style={{ 
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      height: '32px',
                                      width: '32px',
                                      padding: 0,
                                      color: '#64748b', 
                                      background: '#ffffff',
                                      border: '1px solid var(--neutral-border)', 
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      boxShadow: 'var(--shadow-sm)',
                                      margin: 0 
                                    }}
                                    className="hover-card-bg"
                                  >
                                    <Printer size={15} style={{ color: '#64748b' }} />
                                  </button>
                                )}
                              </>
                            )}

                            {hasPdf && formData.pdfKey && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title={formData.pdfName}
                                onClick={() => handleDownloadPdf(formData.pdfKey!)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, borderRadius: '8px', height: '32px' }}
                              >
                                PDF
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Card 3: Quality Checksheet Parameters (Full Width Table) */}
            {process.formFields && process.formFields.length > 0 && (
              <div className="paper-card sop-print-card full-width" style={{ border: '1px solid var(--neutral-border)', borderRadius: '8px', padding: '1rem 1.25rem', background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
                  Quality Checksheet Parameters
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '45%' }}>Check Item / Parameter</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '20%' }}>Target Range</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '35%' }}>Reaction Protocol / Consequence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {process.formFields.map((field, index) => (
                        <tr key={field.id || index} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sanitizeLabel(field.checkItem)}</td>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{field.targetRange}</td>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{field.reactionProtocol}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isShareModalOpen && process && (
        <ShareProcessModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          processId={process.id}
          processTitle={process.title}
          initialIsPublic={process.is_public === true || (process as any).isPublic === true}
          attachedForms={modalAttachedForms}
          onSaveShareSettings={handleSaveShareSettings}
        />
      )}
    </div>
  );
};
