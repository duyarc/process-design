import React, { useState, useEffect } from 'react';
import type { Process, SubmissionFieldSnapshot } from '../types';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Printer, Edit2, Calendar, Plus, Camera, AlertTriangle, X } from 'lucide-react';
import { generateBPMNXML, getNumRows } from '../utils/bpmnXmlGenerator';
import { BpmnViewerComponent } from './BpmnViewerComponent';
import PrintBlankForm from './print/PrintBlankForm';

interface ProcessReaderProps {
  processId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  initialPrintFormName?: string | null;
  onClearPrintForm?: () => void;
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
  initialPrintFormName, 
  onClearPrintForm 
}) => {
  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [allVersions, setAllVersions] = useState<Process[]>([]);
  const { hasPermission } = useAuth();

  // ISO Form execution states
  const [activeFormToFill, setActiveFormToFill] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<{ [fieldId: string]: string }>({});
  const [fieldReactions, setFieldReactions] = useState<{ [fieldId: string]: string }>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<{ [fieldId: string]: string[] }>({}); // fieldId -> array of keys
  const [isPhotoUploading, setIsPhotoUploading] = useState<{ [fieldId: string]: boolean }>({});
  const [operatorId, setOperatorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [printTemplateData, setPrintTemplateData] = useState<any | null>(null);
  const [isDirectPrint, setIsDirectPrint] = useState(false);

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

  const handlePhotoUpload = async (fieldId: string, file: File) => {
    if (!process || !activeFormToFill) return;
    setIsPhotoUploading(prev => ({ ...prev, [fieldId]: true }));
    try {
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId: process.id,
          formName: activeFormToFill,
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

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'image/jpeg'
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to Cloudflare storage.');
      }

      setUploadedPhotos(prev => ({
        ...prev,
        [fieldId]: [...(prev[fieldId] || []), pdfKey]
      }));

      alert('Photo evidence uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert(`Error uploading photo: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally {
      setIsPhotoUploading(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const handleSubmitForm = async (formTemplate: any) => {
    if (!process) return;
    if (!operatorId.trim()) {
      alert('Please enter your Operator ID to sign off this submission (Attributability).');
      return;
    }

    const allFields = formTemplate.layoutBlocks?.flatMap((b: any) => b.fields) || [];

    const missingFields = allFields.filter((field: any) => {
      const val = formValues[field.id];
      return val === undefined || val === '';
    });

    if (missingFields.length > 0) {
      alert(`Please fill out all check items. (${missingFields.length} remaining).`);
      return;
    }

    try {
      let isOverallPass = true;
      const snapshots: SubmissionFieldSnapshot[] = allFields.map((field: any) => {
        const val = formValues[field.id];
        let fieldStatus: 'PASS' | 'FAIL' = 'PASS';
        let targetRange = '';

        if (field.type === 'number') {
          const numVal = parseFloat(val);
          const minVal = field.minSpec ?? -Infinity;
          const maxVal = field.maxSpec ?? Infinity;
          targetRange = `${minVal} - ${maxVal} ${field.unit || ''}`;
          if (isNaN(numVal) || numVal < minVal || numVal > maxVal) {
            fieldStatus = 'FAIL';
            isOverallPass = false;
          }
        } else if (field.type === 'radio' || field.type === 'checkbox') {
          const selectedOpt = field.options?.find((o: any) => o.value === val);
          targetRange = field.options ? field.options.filter((o: any) => o.isPass).map((o: any) => o.label).join(' / ') : (field.targetRange || 'Checked & Ok');
          if (!selectedOpt?.isPass) {
            fieldStatus = 'FAIL';
            isOverallPass = false;
          }
        } else {
          targetRange = field.targetRange || 'Required';
        }

        if (fieldStatus === 'FAIL' && !fieldReactions[field.id]?.trim()) {
          throw new Error(`Corrective Action Containment log is required for failed check: "${field.checkItem}".`);
        }

        return {
          id: field.id,
          checkItem: field.checkItem,
          locationCode: field.locationCode || 'N/A',
          targetRange,
          reactionProtocol: field.reactionProtocol,
          value: val + (fieldStatus === 'FAIL' ? ` (Action: ${fieldReactions[field.id]})` : ''),
          status: fieldStatus
        };
      });

      // Collect matrix table values dynamically
      formTemplate.layoutBlocks?.forEach((block: any) => {
        if (block.type === 'MATRIX_TABLE' && block.matrixConfig) {
          const config = block.matrixConfig;
          for (let rIdx = 0; rIdx < config.rowCount; rIdx++) {
            config.columns.forEach((colName: string, cIdx: number) => {
              const key = `${block.id}_row_${rIdx}_col_${cIdx}`;
              const val = formValues[key] || '';
              snapshots.push({
                id: key,
                checkItem: `${config.rowHeader} ${rIdx + 1} - ${colName || `Cột ${cIdx + 1}`}`,
                locationCode: 'N/A',
                targetRange: 'Tally Count',
                reactionProtocol: '',
                value: val || '0',
                status: 'PASS'
              });
            });
            if (config.showNotesColumn) {
              const noteKey = `${block.id}_row_${rIdx}_note`;
              const noteVal = formValues[noteKey] || '';
              if (noteVal.trim()) {
                snapshots.push({
                  id: noteKey,
                  checkItem: `${config.rowHeader} ${rIdx + 1} - Ghi chú`,
                  locationCode: 'N/A',
                  targetRange: 'Ghi chú',
                  reactionProtocol: '',
                  value: noteVal,
                  status: 'PASS'
                });
              }
            }
          }
        }
      });

      const allMediaKeys: string[] = [];
      Object.values(uploadedPhotos).forEach(keys => {
        allMediaKeys.push(...keys);
      });

      if (!isOverallPass && allMediaKeys.length === 0) {
        throw new Error('⚠️ QMS Protocol: Photo evidence is required for out-of-specification abnormalities.');
      }

      setSubmitting(true);
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const payload = {
        id: submissionId,
        processId: process.id,
        formId: formTemplate.formId,
        formVersion: formTemplate.version,
        operatorId,
        status: isOverallPass ? 'PASS' : 'ABNORMALITY',
        formData: snapshots,
        mediaUrls: allMediaKeys
      };

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Submission server error');
      
      alert(`Record submitted successfully! ID: ${submissionId}`);
      
      setFormValues({});
      setFieldReactions({});
      setUploadedPhotos({});
      setActiveFormToFill(null);
    } catch (err) {
      console.error(err);
      alert(`Failed to submit: ${err instanceof Error ? err.message : 'Server error'}`);
    } finally {
      setSubmitting(false);
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

  useEffect(() => {
    if (initialPrintFormName && process && process.workflowFormsData) {
      const formData = process.workflowFormsData[initialPrintFormName];
      if (formData) {
        setPrintTemplateData(formData as any);
        setIsDirectPrint(true);
      }
      if (onClearPrintForm) {
        onClearPrintForm();
      }
    }
  }, [initialPrintFormName, process]);

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
  const workflowFormsList: string[] = [];
  (process.steps || []).forEach((s: any) => {
    if (s.bpmnShape === 'task' && s.producesForm) {
      const names = s.formNames && s.formNames.length > 0
        ? s.formNames.map((n: string) => n.trim()).filter(Boolean)
        : (s.formName ? [s.formName.trim()] : []);
      names.forEach((name: string) => {
        if (!workflowFormsList.includes(name)) {
          workflowFormsList.push(name);
        }
      });
    }
  });
  const workflowForms = workflowFormsList;

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
          {status === 'Draft' && hasPermission('design_document') && (
            <>
              <button className="btn btn-secondary" onClick={() => handleStatusTransition('Pending Review')}>
                Submit for Review
              </button>
              <button className="btn btn-primary" onClick={handleActivate}>
                Activate Version
              </button>
            </>
          )}
          {status === 'Pending Review' && hasPermission('design_document') && (
            <button className="btn btn-primary" onClick={handleActivate}>
              Activate / Sign-off
            </button>
          )}
          {hasPermission('design_document') && (
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
                      const hasDigitalForm = !!formData.formId;
                      
                      if (formData.pdfName) {
                        attachmentText = formData.pdfName;
                      } else if (hasDigitalForm) {
                        attachmentText = `Digital Template: ${formData.formId} (${formData.version})`;
                      } else if (formData.layoutBlocks && formData.layoutBlocks.length > 0) {
                        const totalFields = formData.layoutBlocks.flatMap((b: any) => b.fields).length;
                        attachmentText = `Custom Form (${totalFields} fields)`;
                      }

                      const hasPdf = !!formData.pdfName;

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
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', minWidth: 0, marginRight: '1rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formName}</span>
                            {attachmentText && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>({attachmentText})</span>
                            )}
                          </div>
                          <div className="no-print" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                            {hasDigitalForm && formData.layoutBlocks && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setActiveFormToFill(formName)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
                                >
                                  Fill Form
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setPrintTemplateData(formData as any)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
                                >
                                  Print Blank
                                </button>
                              </>
                            )}

                            {hasPdf && formData.pdfKey && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title={formData.pdfName}
                                onClick={() => handleDownloadPdf(formData.pdfKey!)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', margin: 0 }}
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
              <div className="paper-card sop-print-card full-width" style={{ borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
                  Quality Checksheet Parameters
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '40%' }}>Check Item / Parameter</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '15%' }}>Target Range</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '12%' }}>Frequency</th>
                        <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', width: '33%' }}>Reaction Protocol / Consequence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {process.formFields.map((field, index) => (
                        <tr key={field.id || index} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                          <td style={{ padding: '0.45rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{field.checkItem}</td>
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
      
      {activeFormToFill && (
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
          <div style={{
            width: '90%',
            maxWidth: '800px',
            background: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            {(() => {
              const formTemplate = (process.workflowFormsData || {})[activeFormToFill];
              if (!formTemplate || !formTemplate.layoutBlocks) {
                return (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <p>Digital template fields are not defined for this form.</p>
                    <button type="button" className="btn btn-secondary" onClick={() => setActiveFormToFill(null)}>Close</button>
                  </div>
                );
              }

              return (
                <>
                  <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--neutral-border)',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        📝 Fill Form: {formTemplate.formTitle || activeFormToFill}
                      </h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        Document ID: <strong>{formTemplate.formId}</strong> | Version: <strong>{formTemplate.version}</strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveFormToFill(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Body Form Fields */}
                  <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Operator identification (ALCOA+ Attributability) */}
                    <div style={{
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      padding: '1rem',
                      borderRadius: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Operator Signature / ID (Attributable Signature) *</span>
                      </label>
                      <input
                        type="text"
                        value={operatorId}
                        onChange={(e) => setOperatorId(e.target.value)}
                        placeholder="Enter your Name or Badge ID (e.g. John Doe / OP-42)"
                        style={{
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.85rem',
                          border: '1px solid #93c5fd',
                          borderRadius: '4px',
                          outline: 'none',
                          background: '#ffffff'
                        }}
                      />
                    </div>

                    {/* Field checklist grouped by Layout Blocks */}
                    {formTemplate.layoutBlocks && formTemplate.layoutBlocks.map((block: any) => {
                      if (block.fields.length === 0 && block.type !== 'TITLE') return null;

                      return (
                        <div key={block.id} style={{
                          border: '1.5px solid var(--neutral-border)',
                          borderRadius: '8px',
                          padding: '1.25rem',
                          background: '#ffffff',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}>
                          <h4 style={{
                            margin: 0,
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: 'var(--text-primary)',
                            borderBottom: '2.5px solid var(--primary)',
                            paddingBottom: '0.25rem'
                          }}>
                            {block.title}
                          </h4>

                          {/* 1. TITLE BLOCK */}
                          {block.type === 'TITLE' && (
                            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>{block.title}</h1>
                              <p style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                {block.fields[0]?.checkItem}
                              </p>
                            </div>
                          )}

                          {/* 2. INFO GRID BLOCK */}
                          {block.type === 'INFO_GRID' && (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
                              gap: '1rem'
                            }}>
                              {block.fields.map((field: any) => {
                                const value = formValues[field.id] || '';
                                return (
                                  <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      {field.checkItem}
                                    </label>
                                    {field.type === 'date' ? (
                                      <input
                                        type="date"
                                        value={value}
                                        onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                      />
                                    ) : (field.type === 'radio' || field.type === 'checkbox') ? (
                                      <select
                                        value={value}
                                        onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                      >
                                        <option value="">-- Chọn --</option>
                                        {(field.options ?? [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }]).map((opt: any) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 3. CHECKLIST TABLE BLOCK */}
                          {block.type === 'CHECKLIST_TABLE' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                              {block.fields.map((field: any, fIdx: number) => {
                                const value = formValues[field.id] || '';
                                
                                // Out of spec detection
                                let isOutOfSpec = false;
                                let specHint = '';

                                if (field.type === 'number' && value !== '') {
                                  const num = parseFloat(value);
                                  const min = field.minSpec ?? -Infinity;
                                  const max = field.maxSpec ?? Infinity;
                                  specHint = `Target: ${min} - ${max} ${field.unit || ''}`;
                                  if (isNaN(num) || num < min || num > max) {
                                    isOutOfSpec = true;
                                  }
                                } else if (field.type === 'radio' || field.type === 'checkbox') {
                                  const passLabels = field.options ? field.options.filter((o: any) => o.isPass).map((o: any) => o.label).join(' / ') : 'Đạt';
                                  specHint = `Target: ${passLabels}`;
                                  const selectedOpt = field.options?.find((o: any) => o.value === value);
                                  if (value !== '' && !selectedOpt?.isPass) {
                                    isOutOfSpec = true;
                                  }
                                } else if (field.type === 'text') {
                                  specHint = field.targetRange ? `Target: ${field.targetRange}` : '';
                                }

                                return (
                                  <div key={field.id} style={{
                                    border: '1px solid var(--neutral-border)',
                                    borderRadius: '6px',
                                    padding: '0.85rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                    background: isOutOfSpec ? '#fff5f5' : '#ffffff',
                                    borderColor: isOutOfSpec ? '#fca5a5' : 'var(--neutral-border)'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                        {fIdx + 1}. {field.checkItem}
                                      </span>
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                        {field.frequency}
                                      </span>
                                    </div>

                                    {specHint && (
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        🎯 {specHint}
                                      </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                      {field.type === 'number' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <input
                                            type="number"
                                            value={value}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                            placeholder="Enter value"
                                            style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '120px' }}
                                          />
                                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{field.unit}</span>
                                        </div>
                                      )}

                                      {(field.type === 'radio' || field.type === 'checkbox') && (
                                         <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                           {(field.options ?? [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }]).map((opt: any) => {
                                             const isSelected = value === opt.value;
                                             const activeColor = opt.isPass ? '#10b981' : '#ef4444';
                                             return (
                                               <button
                                                 key={opt.value}
                                                 type="button"
                                                 className="btn btn-sm"
                                                 onClick={() => setFormValues(prev => ({ ...prev, [field.id]: isSelected ? '' : opt.value }))}
                                                 style={{
                                                   padding: '0.4rem 1rem',
                                                   fontSize: '0.8rem',
                                                   fontWeight: 600,
                                                   borderRadius: '20px',
                                                   background: isSelected ? activeColor : '#f8fafc',
                                                   color: isSelected ? '#ffffff' : '#64748b',
                                                   borderColor: isSelected ? activeColor : '#cbd5e1',
                                                   display: 'flex',
                                                   alignItems: 'center',
                                                   gap: '4px',
                                                   transition: 'all 0.2s ease'
                                                 }}
                                               >
                                                 {isSelected && <span>{opt.isPass ? '✓' : '✗'}</span>}
                                                 {opt.label}
                                               </button>
                                             );
                                           })}
                                         </div>
                                       )}

                                      {field.type === 'text' && (
                                        <input
                                          type="text"
                                          value={value}
                                          onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                          placeholder="Enter observation note"
                                          style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', flex: 1 }}
                                        />
                                      )}

                                      {field.type === 'photo' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id={`evidence-photo-${field.id}`}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handlePhotoUpload(field.id, file);
                                            }}
                                          />
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                              type="button"
                                              className="btn btn-secondary btn-sm"
                                              disabled={isPhotoUploading[field.id]}
                                              onClick={() => document.getElementById(`evidence-photo-${field.id}`)?.click()}
                                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', height: '32px' }}
                                            >
                                              <Camera size={14} />
                                              <span>{isPhotoUploading[field.id] ? 'Uploading...' : 'Take/Upload Photo'}</span>
                                            </button>
                                            {uploadedPhotos[field.id]?.length > 0 && (
                                              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                                ✓ {uploadedPhotos[field.id].length} photo(s) attached
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {isOutOfSpec && (
                                      <div style={{
                                        background: '#fffbeb',
                                        border: '1px solid #fde68a',
                                        padding: '0.75rem',
                                        borderRadius: '4px',
                                        color: '#b45309',
                                        fontSize: '0.8rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                        marginTop: '0.25rem'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 'bold' }}>
                                          <AlertTriangle size={15} />
                                          <span>Out-of-Specification Abnormality Detected!</span>
                                        </div>
                                        <div style={{ fontStyle: 'italic' }}>
                                          <strong>Reaction Protocol:</strong> {field.reactionProtocol || 'Notify lead technician immediately.'}
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                                          <label style={{ fontWeight: 600, fontSize: '0.75rem' }}>Describe Containment Action Taken *</label>
                                          <textarea
                                            value={fieldReactions[field.id] || ''}
                                            onChange={(e) => setFieldReactions(prev => ({ ...prev, [field.id]: e.target.value }))}
                                            placeholder="Describe corrective action applied to return process to control..."
                                            rows={2}
                                            style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid #fcd34d', borderRadius: '4px', resize: 'none', background: '#ffffff' }}
                                          />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                                          <label style={{ fontWeight: 600, fontSize: '0.75rem', color: '#ef4444' }}>
                                            ⚠️ Photo Evidence Required for Fails *
                                          </label>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            id={`fail-photo-${field.id}`}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handlePhotoUpload(field.id, file);
                                            }}
                                          />
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                              type="button"
                                              className="btn btn-secondary btn-sm"
                                              disabled={isPhotoUploading[field.id]}
                                              onClick={() => document.getElementById(`fail-photo-${field.id}`)?.click()}
                                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', height: '32px', borderColor: '#fca5a5', background: '#fffbeb' }}
                                            >
                                              <Camera size={14} style={{ color: '#ef4444' }} />
                                              <span style={{ color: '#b91c1c' }}>Upload Failure Photo</span>
                                            </button>
                                            {uploadedPhotos[field.id]?.length > 0 ? (
                                              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                                ✓ Photo attached
                                              </span>
                                            ) : (
                                              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontStyle: 'italic' }}>
                                                Please attach photo of abnormality.
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 3.1 MATRIX TABLE BLOCK */}
                          {block.type === 'MATRIX_TABLE' && block.matrixConfig && (() => {
                            const config = block.matrixConfig;
                            // Pre-calculate totals for rendering
                            const rowTotals = Array.from({ length: config.rowCount }).map((_: any, rIdx: number) => {
                              return config.columns.reduce((sum: number, _: any, cIdx: number) => {
                                const val = parseInt(formValues[`${block.id}_row_${rIdx}_col_${cIdx}`] || '0', 10);
                                return sum + (isNaN(val) ? 0 : val);
                              }, 0);
                            });

                            const colTotals = config.columns.map((_: any, cIdx: number) => {
                              return Array.from({ length: config.rowCount }).reduce((sum: number, _: any, rIdx: number) => {
                                const val = parseInt(formValues[`${block.id}_row_${rIdx}_col_${cIdx}`] || '0', 10);
                                return sum + (isNaN(val) ? 0 : val);
                              }, 0);
                            });

                            const grandTotal = rowTotals.reduce((sum: number, val: number) => sum + val, 0);

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {block.title}
                                </div>
                                <div style={{ overflowX: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: '#ffffff' }}>
                                    <thead>
                                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--neutral-border)' }}>
                                        <th rowSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center', width: '60px', fontWeight: 'bold' }}>
                                          {config.rowHeader}
                                        </th>
                                        <th colSpan={config.columns.length} style={{ padding: '6px', borderRight: '1px solid var(--neutral-border)', borderBottom: '1px solid var(--neutral-border)', textAlign: 'center', fontWeight: 'bold' }}>
                                          {config.columnHeader}
                                        </th>
                                        {config.showTotalColumn && (
                                          <th rowSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center', width: '120px', fontWeight: 'bold' }}>
                                            {config.totalColumnHeader}
                                          </th>
                                        )}
                                        {config.showNotesColumn && (
                                          <th rowSpan={2} style={{ padding: '8px', textAlign: 'left', minWidth: '160px', fontWeight: 'bold' }}>
                                            {config.notesColumnHeader}
                                          </th>
                                        )}
                                      </tr>
                                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--neutral-border)' }}>
                                        {config.columns.map((colName: string, cIdx: number) => (
                                          <th key={cIdx} style={{ padding: '6px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center', fontWeight: 600 }}>
                                            {colName || `Cột ${cIdx + 1}`}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {Array.from({ length: config.rowCount }).map((_: any, rIdx: number) => (
                                        <tr key={rIdx} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                                          <td style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center', fontWeight: 'bold', background: '#f8fafc' }}>
                                            {rIdx + 1}
                                          </td>
                                          {config.columns.map((_: any, cIdx: number) => {
                                            const key = `${block.id}_row_${rIdx}_col_${cIdx}`;
                                            return (
                                              <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center' }}>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={formValues[key] || ''}
                                                  onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                  placeholder="0"
                                                  style={{
                                                    width: '100%',
                                                    border: '1px solid var(--neutral-border)',
                                                    borderRadius: '4px',
                                                    padding: '0.25rem 0.35rem',
                                                    textAlign: 'center',
                                                    fontSize: '0.8rem'
                                                  }}
                                                />
                                              </td>
                                            );
                                          })}
                                          {config.showTotalColumn && (
                                            <td style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center', background: '#f8fafc', fontWeight: 'bold', color: 'var(--primary)' }}>
                                              {rowTotals[rIdx]}
                                            </td>
                                          )}
                                          {config.showNotesColumn && (() => {
                                            const key = `${block.id}_row_${rIdx}_note`;
                                            return (
                                              <td style={{ padding: '4px' }}>
                                                <input
                                                  type="text"
                                                  value={formValues[key] || ''}
                                                  onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                  placeholder="Ghi chú..."
                                                  style={{
                                                    width: '100%',
                                                    border: '1px solid var(--neutral-border)',
                                                    borderRadius: '4px',
                                                    padding: '0.25rem 0.35rem',
                                                    fontSize: '0.8rem'
                                                  }}
                                                />
                                              </td>
                                            );
                                          })()}
                                        </tr>
                                      ))}
                                      {/* Grand Total Row */}
                                      <tr style={{ background: '#f1f5f9', fontWeight: 'bold', borderTop: '2.5px solid var(--neutral-border)' }}>
                                        <td style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center' }}>
                                          TỔNG
                                        </td>
                                        {colTotals.map((total: number, cIdx: number) => (
                                          <td key={cIdx} style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center', color: 'var(--text-primary)' }}>
                                            {total}
                                          </td>
                                        ))}
                                        {config.showTotalColumn && (
                                          <td style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'center', background: '#e2e8f0', color: 'var(--primary)' }}>
                                            {grandTotal}
                                          </td>
                                        )}
                                        {config.showNotesColumn && (
                                          <td style={{ padding: '8px' }}></td>
                                        )}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}

                          {/* 4. SIGN BLOCK */}
                          {block.type === 'SIGN' && (
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
                              gap: '1rem'
                            }}>
                              {block.fields.map((field: any) => {
                                const value = formValues[field.id] || '';
                                return (
                                  <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      {field.checkItem}
                                    </label>
                                    <input
                                      type="text"
                                      value={value}
                                      onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                      placeholder="Type full name to sign"
                                      style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', fontStyle: 'italic' }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions footer */}
                  <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid var(--neutral-border)',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem'
                  }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={submitting}
                      onClick={() => setActiveFormToFill(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={submitting}
                      onClick={() => handleSubmitForm(formTemplate)}
                      style={{ background: '#10b981', borderColor: '#10b981' }}
                    >
                      {submitting ? 'Submitting...' : 'Submit Completed Record'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
