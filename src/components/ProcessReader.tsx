import React, { useState, useEffect } from 'react';
import type { Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Printer, Edit2, Calendar, Plus } from 'lucide-react';
import { generateBPMNXML, getNumRows } from '../utils/bpmnXmlGenerator';
import { BpmnViewerComponent } from './BpmnViewerComponent';

interface ProcessReaderProps {
  processId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
}

const statusColors: { [key: string]: { bg: string, text: string, border: string } } = {
  'Draft': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  'Pending Review': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Active': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'Superseded': { bg: '#f9fafb', text: '#4b5563', border: '#e5e7eb' },
  'Retired': { bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5' }
};

export const ProcessReader: React.FC<ProcessReaderProps> = ({ processId, onBack, onEdit }) => {
  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [allVersions, setAllVersions] = useState<Process[]>([]);
  const { hasPermission } = useAuth();

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
      const res = await fetch('/api/processes');
      if (!res.ok) throw new Error('Failed to fetch');
      const list: Process[] = await res.json();
      const found = list.find(p => p.id === processId);
      if (found) {
        setProcess(found);

        // Find sibling versions in the same process family
        const parentId = found.parentProcessId || found.id;
        const siblings = list.filter(p => p.parentProcessId === parentId || p.id === parentId);
        siblings.sort((a, b) => {
          const aVer = parseInt(a.version, 10) || 0;
          const bVer = parseInt(b.version, 10) || 0;
          return bVer - aVer;
        });
        setAllVersions(siblings);
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching process details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProcess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  const handlePrint = () => {
    window.print();
  };

  const handleCreateNewDraft = async () => {
    if (!process) return;
    if (!window.confirm(`Create a new Draft version based on Version ${process.version}?`)) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/processes/${process.id}/new-version`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to create new draft version');
      const newDraft = await res.json();
      onEdit(newDraft.id);
    } catch (err) {
      console.error(err);
      alert('Error creating new draft version.');
      setLoading(false);
    }
  };

  const handleStatusTransition = async (newStatus: 'Pending Review' | 'Active', effectiveDate?: string) => {
    if (!process) return;
    try {
      setLoading(true);
      const updatedSop = { ...process.sopSignoffs };
      if (newStatus === 'Active') {
        updatedSop.effectiveDate = effectiveDate || new Date().toISOString().split('T')[0];
      }

      const payload = {
        ...process,
        status: newStatus,
        sopSignoffs: updatedSop
      };

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Failed to update status to ${newStatus}`);
      await fetchProcess();
    } catch (err) {
      console.error(err);
      alert(`Error updating process status: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const handleActivate = () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = window.prompt("Enter the Effective Date (YYYY-MM-DD) for this active standard:", today);
    if (dateInput === null) return; // cancelled
    
    if (!dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
      alert("Invalid date format. Please use YYYY-MM-DD.");
      return;
    }
    handleStatusTransition('Active', dateInput);
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

  // Calculate workflow output forms
  const workflowForms = Array.from(new Set(
    (process.steps || [])
      .filter(s => s.bpmnShape === 'task' && s.producesForm && s.formName?.trim())
      .map(s => s.formName!.trim())
  ));

  // Compute sign-off rows for approvals
  const signoffs = process.sopSignoffs || {};
  const reviewers = signoffs.reviewers || [];
  const authorisers = signoffs.authorisers || [];

  const approvalRows: { role: string; name: string; title: string }[] = [];
  
  approvalRows.push({
    role: 'Author',
    name: signoffs.author?.name || '',
    title: signoffs.author?.title || '',
  });

  if (reviewers.length > 0) {
    reviewers.forEach((r, idx) => {
      approvalRows.push({
        role: `Reviewer ${reviewers.length > 1 ? `#${idx + 1}` : ''}`,
        name: r.name || '',
        title: r.title || '',
      });
    });
  } else {
    approvalRows.push({
      role: 'Reviewer',
      name: '',
      title: '',
    });
  }

  if (authorisers.length > 0) {
    authorisers.forEach((a, idx) => {
      approvalRows.push({
        role: `Authoriser ${authorisers.length > 1 ? `#${idx + 1}` : ''}`,
        name: a.name || '',
        title: a.title || '',
      });
    });
  } else {
    approvalRows.push({
      role: 'Authoriser',
      name: '',
      title: '',
    });
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
          gap: 1.5rem;
          margin-top: 2rem;
        }
        @media (min-width: 1024px) {
          .sop-details-columns-grid {
            grid-template-columns: 1.15fr 0.85fr;
          }
        }
        .sop-print-card {
          margin-bottom: 1.5rem;
        }
        @media print {
          .sop-details-columns-grid {
            display: grid !important;
            grid-template-columns: 1.15fr 0.85fr !important;
            gap: 1.5rem !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .sop-print-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px solid #cccccc !important;
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

      {/* Action Header Panel */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {status === 'Draft' && hasPermission('edit_process') && (
            <>
              <button className="btn btn-secondary" onClick={() => handleStatusTransition('Pending Review')}>
                Submit for Review
              </button>
              <button className="btn btn-primary" onClick={handleActivate}>
                Activate Version
              </button>
            </>
          )}
          {status === 'Pending Review' && hasPermission('edit_process') && (
            <button className="btn btn-primary" onClick={handleActivate}>
              Activate / Sign-off
            </button>
          )}
          {hasPermission('edit_process') && (
            <button 
              className="btn btn-secondary" 
              onClick={status === 'Draft' ? (() => onEdit(process.id)) : handleCreateNewDraft}
            >
              {status === 'Draft' ? <Edit2 size={16} /> : <Plus size={16} />}
              {status === 'Draft' ? 'Edit' : 'New Version'}
            </button>
          )}
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* Document Cover / Header Block */}
      <div className="paper-card accent-teal avoid-page-break no-print" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ flex: '1 1 350px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span className="badge" style={{ backgroundColor: 'var(--primary)', color: '#ffffff', margin: 0 }}>
                Standard Operating Standard
              </span>
              <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', margin: 0 }}>
                {status}
              </span>
            </div>
            <h1 style={{ marginTop: '0.25rem', marginBottom: '0.25rem', fontSize: '1.5rem' }}>{process.title}</h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
              {process.description || 'No description provided.'}
            </p>
          </div>

          {/* Combined Horizontal Version History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '0 1 auto', minWidth: '200px' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              Version History
            </span>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {allVersions.map((v) => {
                const vStatus = v.status || 'Active';
                const vColors = statusColors[vStatus] || { bg: '#e5e7eb', text: '#4b5563', border: '#cbd5e1' };
                const isActiveVersion = v.id === process.id;

                return (
                  <div
                    key={v.id}
                    style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      border: isActiveVersion ? '2px solid var(--primary)' : '1px solid var(--neutral-border)',
                      background: isActiveVersion ? '#ffffff' : '#f9fafb',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.75rem',
                      transition: 'all 0.15s ease'
                    }}
                    className="hover-card-bg"
                    onClick={() => {
                      if (!isActiveVersion) {
                        setProcess(v);
                      }
                    }}
                  >
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>v{v.version}</span>
                    <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: vColors.text, fontWeight: 700, background: vColors.bg, padding: '0.05rem 0.2rem', borderRadius: '3px', border: `1px solid ${vColors.border}` }}>
                      {vStatus}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', flexShrink: 0, minWidth: '150px' }}>
            <div><strong>Version:</strong> v{process.version}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', justifyContent: 'flex-end' }}>
              <Calendar size={13} />
              {new Date(process.lastUpdated).toLocaleDateString()}
            </div>
            {process.sopSignoffs?.effectiveDate && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Effective: {new Date(process.sopSignoffs.effectiveDate).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Process Swimlane Flowchart */}
      {Array.from({ length: process ? getNumRows(process.steps) : 1 }).map((_, r) => {
        const rowXml = generateBPMNXML(process.steps, process.title, process.roles || [], r);
        return (
          <div 
            key={r} 
            className="avoid-page-break flowchart-print-card" 
            style={{ marginBottom: '1.5rem' }}
          >
            <div className="mermaid-print-wrapper" style={{ margin: 0 }}>
              <BpmnViewerComponent xml={rowXml} />
            </div>
          </div>
        );
      })}

      <div className="reader-layout-grid">
        {/* Main Document Content */}
        <div className="reader-main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
          
          {/* Document Details & Quality Controls (Printed after Flowchart) */}
          <div className="sop-details-container" style={{ marginTop: '1rem' }}>
            <div className="sop-details-columns-grid">
              
              {/* Card 1: Document Control & Approvals */}
              <div className="paper-card sop-print-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
                  {process.title}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Description:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{process.description || 'No description provided.'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Version & Status:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>v{process.version}</span>
                      <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px', margin: 0 }}>
                        {status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Last Updated:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{new Date(process.lastUpdated).toLocaleDateString()}</span>
                  </div>
                  {process.sopSignoffs?.effectiveDate && (
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Effective Date:</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{new Date(process.sopSignoffs.effectiveDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>


                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--neutral-border)' }}>Role</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--neutral-border)' }}>Name</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--neutral-border)' }}>Title</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid var(--neutral-border)' }}>Signature / Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                          <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{row.role}</td>
                          <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem', color: row.name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {row.name}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem', color: row.title ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {row.title}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span className="print-only" style={{ color: '#888' }}>Sign: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                            <span className="no-print" style={{ fontStyle: 'italic', fontSize: '0.7rem' }}>Pending sign-off</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Card 2: Attached Forms */}
              <div className="paper-card sop-print-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
                  FORMS
                </h3>

                {workflowForms.length === 0 ? (
                  <div style={{ padding: '1.5rem', border: '1px dashed var(--neutral-border)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    No output forms are produced by this workflow.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {workflowForms.map((formName) => {
                      const formData = (process.workflowFormsData || {})[formName] || {};
                      let attachmentText = '';
                      if (formData.pdfName) {
                        attachmentText = `PDF Attachment: ${formData.pdfName}`;
                      } else if (formData.onlineUrl) {
                        attachmentText = `Online URL Link: ${formData.onlineUrl}`;
                      } else if (formData.fields && formData.fields.length > 0) {
                        attachmentText = `Custom Form (${formData.fields.length} fields)`;
                      }

                      const hasPdf = !!formData.pdfName;
                      const hasUrl = !!formData.onlineUrl;

                      return (
                        <div key={formName} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.6rem 0.8rem',
                          background: '#f9fafb',
                          border: '1px solid var(--neutral-border)',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginRight: '1rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: attachmentText ? '0.2rem' : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formName}</span>
                            {attachmentText && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachmentText}</span>
                            )}
                          </div>
                          <div className="no-print" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                            {hasPdf && formData.pdfKey && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDownloadPdf(formData.pdfKey!)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                              >
                                View PDF
                              </button>
                            )}
                            {hasUrl && (
                              <a
                                href={formData.onlineUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                              >
                                Open Link
                              </a>
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
              <div className="paper-card sop-print-card full-width" style={{ borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
                  Quality Checksheet Parameters
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '25%' }}>Check Item / Parameter</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '15%' }}>Location Code</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '15%' }}>Target Range</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '12%' }}>Frequency</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '33%' }}>Reaction Protocol / Consequence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {process.formFields.map((field, index) => (
                        <tr key={field.id || index} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{field.checkItem}</td>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{field.locationCode}</td>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{field.targetRange}</td>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{field.frequency}</td>
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
    </div>
  );
};
