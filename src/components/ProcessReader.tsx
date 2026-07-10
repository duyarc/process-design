import React, { useState, useEffect } from 'react';
import type { Process, SubmissionFieldSnapshot } from '../types';
import { formatFormVersion, getColStyleWidth } from '../types';
import { useAuth } from '../context/AuthContext';
import { Printer, Edit2, Camera, AlertTriangle, X, PenTool, GitBranch, Eye, ArrowLeft } from 'lucide-react';
import { generateBPMNXML, getNumRows } from '../utils/bpmnXmlGenerator';
import { BpmnViewerComponent } from './BpmnViewerComponent';
import PrintBlankForm from './print/PrintBlankForm';

interface ProcessReaderProps {
  processId: string;
  onBack: () => void;
  onEdit: (id: string, tab?: 'description' | 'workflow' | 'form', formName?: string | null) => void;
  initialPrintFormName?: string | null;
  onClearPrintForm?: () => void;
  onSwitchVersion?: (id: string) => void;
  initialTriggerPrint?: boolean;
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
  onClearPrintForm,
  onSwitchVersion,
  initialTriggerPrint
}) => {
  const [process, setProcess] = useState<Process | null>(null);
  const [allVersions, setAllVersions] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);


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
          const hasMin = field.minSpec !== undefined && field.minSpec !== null;
          const hasMax = field.maxSpec !== undefined && field.maxSpec !== null;
          if (hasMin && hasMax) {
            targetRange = `${field.minSpec} - ${field.maxSpec} ${field.unit || ''}`;
          } else if (hasMin) {
            targetRange = `>= ${field.minSpec} ${field.unit || ''}`;
          } else if (hasMax) {
            targetRange = `<= ${field.maxSpec} ${field.unit || ''}`;
          } else {
            targetRange = field.unit ? `Unit: ${field.unit}` : '';
          }
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

      // Collect regular table values dynamically
      formTemplate.layoutBlocks?.forEach((block: any) => {
        if (block.type === 'TABLE' && block.tableColumns && block.tableRows) {
          block.tableRows.forEach((row: any, rIdx: number) => {
            const staticCols = block.tableColumns.filter((c: any) => c.type === 'static_text');
            const rowLabel = staticCols.length > 0 
              ? staticCols.map((c: any) => block.tableData?.[row.id]?.[c.id] || '').join(' ') 
              : `Dòng ${rIdx + 1}`;

            block.tableColumns.forEach((col: any) => {
              if (col.type !== 'static_text') {
                const key = `${block.id}_${row.id}_${col.id}`;
                const val = formValues[key] || '';
                snapshots.push({
                  id: key,
                  checkItem: `${rowLabel} - ${col.label}`,
                  locationCode: 'N/A',
                  targetRange: 'Nhập liệu',
                  reactionProtocol: '',
                  value: val,
                  status: 'PASS'
                });
              }
            });
          });
        }
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
        alert('Không tìm thấy quy trình. Bạn sẽ được chuyển hướng về Dashboard.');
        onBack();
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
    fetchFormsList();
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
                formTitle: liveForm.form_title || liveForm.form_name,
                layoutBlocks: typeof liveForm.layout_blocks === 'string' ? JSON.parse(liveForm.layout_blocks) : liveForm.layout_blocks,
                revisionHistory: typeof liveForm.revision_history === 'string' ? JSON.parse(liveForm.revision_history) : liveForm.revision_history,
                version: liveForm.version,
                status: liveForm.status
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
          gap: 0.5rem;
          margin-top: 0;
        }
        @media (min-width: 1024px) {
          .sop-details-columns-grid {
            grid-template-columns: 1.15fr 0.85fr;
          }
        }
        .sop-print-card {
          margin-bottom: 0;
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
            </h1>
            {process.description && process.description.trim() && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
                {process.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.25rem 0.6rem',
              fontSize: '0.78rem',
              borderRadius: '6px',
              border: '1px solid var(--neutral-border)',
              background: '#ffffff',
              color: 'var(--text-primary)',
              fontWeight: 600
            }}>
              <GitBranch size={13} style={{ marginRight: '0.3rem', color: 'var(--text-secondary)' }} />
              <select
                className="no-print"
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
                {(allVersions.length > 0 ? allVersions : [process]).map(v => {
                  return (
                    <option key={v.id} value={v.id}>
                      {getFormattedVersionString(v)}
                    </option>
                  );
                })}
              </select>
              <span className="print-only" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                {getFormattedVersionString(process)}
              </span>
            </div>

            <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '4px', margin: 0 }}>
              {status}
            </span>
            
            {status === 'Draft' && hasPermission('design_document') ? (
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
      {Array.from({ length: process ? getNumRows(process.steps) : 1 }).map((_, r) => {
        const rowXml = generateBPMNXML(process.steps, process.title, process.roles || [], r);
        return (
          <div 
            key={r} 
            className="avoid-page-break flowchart-print-card" 
            style={{ marginBottom: '0.25rem' }}
          >
            <div className="mermaid-print-wrapper" style={{ margin: 0 }}>
              <BpmnViewerComponent xml={rowXml} />
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
              {/* Card 2: Attached Forms */}
              <div className="paper-card sop-print-card" style={{ borderLeft: '4px solid var(--primary)', padding: '0.85rem 1rem' }}>
                <h3 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.4rem' }}>
                  FORMS
                </h3>

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
                        .filter(f => f.form_id === formId)
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
                      const hasDigitalForm = !!formId;
                      const liveVersion = liveForm ? liveForm.version : (formData.version || '');
                      const liveLayoutBlocks = liveForm ? (typeof liveForm.layout_blocks === 'string' ? JSON.parse(liveForm.layout_blocks) : liveForm.layout_blocks) : null;
                      const hasLayoutBlocks = liveLayoutBlocks && liveLayoutBlocks.length > 0;
                      const displayName = formData.formTitle || (liveForm?.form_title || liveForm?.form_name) || formId;

                      const hasPdf = !!formData.pdfName;

                      return (
                        <div key={formId} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.45rem 0.65rem',
                          background: '#ffffff',
                          borderBottom: idx < workflowForms.length - 1 ? '1px solid var(--neutral-border)' : 'none',
                          fontSize: '0.78rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, marginRight: '1rem', flexWrap: 'nowrap' }}>
                            {/* Form ID Badge */}
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: '#475569',
                              background: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap',
                              flexShrink: 0
                            }}>{formId}</span>

                            {/* Version Badge (only for digital forms) */}
                            {!formData.pdfName && (() => {
                              const cleanVersion = formatFormVersion(liveVersion, liveForm?.status, liveForm?.effective_date, liveForm?.updated_at);
                              if (!cleanVersion) return null;
                              return (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  color: 'var(--text-primary)',
                                  background: '#ffffff',
                                  border: '1px solid var(--neutral-border)',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}>
                                  <GitBranch size={11} style={{ color: 'var(--text-secondary)' }} />
                                  {cleanVersion}
                                </span>
                              );
                            })()}

                            {/* Status Badge (only for digital forms) */}
                            {!formData.pdfName && (() => {
                              const formStatus = (liveForm?.status || formData.status || 'DRAFT').toUpperCase();
                              const getStatusStyles = (status: string) => {
                                switch (status) {
                                  case 'ACTIVE':
                                    return { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' };
                                  case 'PENDING REVIEW':
                                  case 'PENDING_REVIEW':
                                    return { color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' };
                                  case 'DRAFT':
                                  default:
                                    return { color: '#b45309', bg: '#fffbeb', border: '#fde68a' };
                                }
                              };
                              const statusStyle = getStatusStyles(formStatus);
                              return (
                                <span style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.5px',
                                  color: statusStyle.color,
                                  background: statusStyle.bg,
                                  border: `1px solid ${statusStyle.border}`,
                                  padding: '0.05rem 0.3rem',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap',
                                  textTransform: 'uppercase',
                                  flexShrink: 0
                                }}>
                                  {formStatus}
                                </span>
                              );
                            })()}

                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</span>
                            {formData.pdfName && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>• {formData.pdfName}</span>
                            )}
                          </div>
                          <div className="no-print" style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                            {hasDigitalForm && (
                              <>
                                {hasPermission('design_document') && (
                                  <button
                                    type="button"
                                    title="Design"
                                    onClick={() => onEdit(processId, 'form', formId)}
                                    style={{ 
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      height: '28px',
                                      width: '28px',
                                      padding: 0,
                                      color: 'var(--text-primary)', 
                                      background: '#ffffff',
                                      border: '1px solid var(--neutral-border)', 
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      margin: 0 
                                    }}
                                    className="hover-card-bg"
                                  >
                                    <Edit2 size={13} style={{ color: 'var(--text-primary)' }} />
                                  </button>
                                )}

                                {hasLayoutBlocks && (
                                  <>
                                    <button
                                      type="button"
                                      title="Fill"
                                      onClick={() => setActiveFormToFill(formId)}
                                      style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '28px',
                                        width: '28px',
                                        padding: 0,
                                        color: 'var(--text-primary)', 
                                        background: '#ffffff',
                                        border: '1px solid var(--neutral-border)', 
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        margin: 0 
                                      }}
                                      className="hover-card-bg"
                                    >
                                      <PenTool size={13} style={{ color: 'var(--text-primary)' }} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Print"
                                      onClick={() => {
                                        if (formData && liveForm) {
                                          const fullTemplate = {
                                            ...formData,
                                            formTitle: liveForm.form_title || liveForm.form_name,
                                            layoutBlocks: typeof liveForm.layout_blocks === 'string' ? JSON.parse(liveForm.layout_blocks) : liveForm.layout_blocks,
                                            revisionHistory: typeof liveForm.revision_history === 'string' ? JSON.parse(liveForm.revision_history) : liveForm.revision_history,
                                            version: liveForm.version,
                                            status: liveForm.status
                                          };
                                          setPrintTemplateData(fullTemplate as any);
                                        }
                                      }}
                                      style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '28px',
                                        width: '28px',
                                        padding: 0,
                                        color: 'var(--text-primary)', 
                                        background: '#ffffff',
                                        border: '1px solid var(--neutral-border)', 
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        margin: 0 
                                      }}
                                      className="hover-card-bg"
                                    >
                                      <Printer size={13} style={{ color: 'var(--text-primary)' }} />
                                    </button>
                                  </>
                                )}
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

              {/* Card 1: Document Control & Approvals */}
              <div className="paper-card sop-print-card" style={{ borderLeft: '4px solid var(--primary)', padding: '0.85rem 1rem' }}>
                <h3 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.4rem' }}>
                  APPROVALS
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.25rem' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', borderBottom: '1px solid var(--neutral-border)' }}>Role</th>
                        <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', borderBottom: '1px solid var(--neutral-border)' }}>Name</th>
                        <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', borderBottom: '1px solid var(--neutral-border)' }}>Title</th>
                        <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 600, fontSize: '0.72rem', borderBottom: '1px solid var(--neutral-border)' }}>Signature / Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                          <td style={{ padding: '0.3rem 0.4rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-primary)' }}>{row.role}</td>
                          <td style={{ padding: '0.3rem 0.4rem', fontSize: '0.72rem', color: row.name ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {row.name}
                          </td>
                          <td style={{ padding: '0.3rem 0.4rem', fontSize: '0.72rem', color: row.title ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {row.title}
                          </td>
                          <td style={{ padding: '0.3rem 0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span className="print-only" style={{ color: '#888' }}>Sign: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                            <span className="no-print" style={{ fontStyle: 'italic', fontSize: '0.7rem' }}>Pending sign-off</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              const formData = (process.workflowFormsData || {})[activeFormToFill];
              const liveForm = allForms
                .filter(f => f.form_id === activeFormToFill)
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
              
              const formTemplate = formData && liveForm ? {
                ...formData,
                formTitle: liveForm.form_title || liveForm.form_name,
                layoutBlocks: typeof liveForm.layout_blocks === 'string' ? JSON.parse(liveForm.layout_blocks) : liveForm.layout_blocks,
                revisionHistory: typeof liveForm.revision_history === 'string' ? JSON.parse(liveForm.revision_history) : liveForm.revision_history,
                version: liveForm.version,
                status: liveForm.status,
                effectiveDate: liveForm.effective_date,
                updatedAt: liveForm.updated_at
              } : null;

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
                        Document ID: <strong>{formTemplate.formId}</strong> | Version: <strong>{formatFormVersion(formTemplate.version || '', formTemplate.status, formTemplate.effectiveDate || (formTemplate as any).effective_date, formTemplate.updatedAt)}</strong>
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
                      if (block.fields.length === 0 && block.type !== 'TITLE' && block.type !== 'SECTION_LABEL' && block.type !== 'TABLE') return null;

                      if (block.type === 'SECTION_LABEL') {
                        return (
                          <div key={block.id} style={{
                            padding: '0.75rem 1rem',
                            background: '#f1f5f9',
                            borderLeft: '4px solid var(--primary)',
                            borderRadius: '6px',
                            marginTop: '1.25rem',
                            marginBottom: '0.5rem'
                          }}>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.0rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {block.title}
                            </h3>
                            {block.description && (
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                                {block.description}
                              </p>
                            )}
                          </div>
                        );
                      }

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
                                    ) : field.type === 'time' ? (
                                      field.timeMode === 'dual' ? (() => {
                                        const parts = (value || '').split(' - ');
                                        const sTime = parts[0] || '';
                                        const eTime = parts[1] || '';
                                        return (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Từ</span>
                                              <input 
                                                type="time" 
                                                value={sTime} 
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setFormValues(prev => ({ ...prev, [field.id]: `${val} - ${eTime}` }));
                                                }}
                                                style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                              />
                                            </div>
                                            <span style={{ marginTop: '10px', color: '#cbd5e1' }}>~</span>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Đến</span>
                                              <input 
                                                type="time" 
                                                value={eTime} 
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  setFormValues(prev => ({ ...prev, [field.id]: `${sTime} - ${val}` }));
                                                }}
                                                style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                              />
                                            </div>
                                          </div>
                                        );
                                      })() : (
                                        <input 
                                          type="time"
                                          value={value}
                                          onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                          style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                        />
                                      )
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
                                  const hasMin = field.minSpec !== undefined && field.minSpec !== null;
                                  const hasMax = field.maxSpec !== undefined && field.maxSpec !== null;
                                  const min = field.minSpec ?? -Infinity;
                                  const max = field.maxSpec ?? Infinity;
                                  if (hasMin && hasMax) {
                                    specHint = `Target: ${field.minSpec} - ${field.maxSpec} ${field.unit || ''}`;
                                  } else if (hasMin) {
                                    specHint = `Target: >= ${field.minSpec} ${field.unit || ''}`;
                                  } else if (hasMax) {
                                    specHint = `Target: <= ${field.maxSpec} ${field.unit || ''}`;
                                  } else {
                                    specHint = field.unit ? `Unit: ${field.unit}` : '';
                                  }
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

                                       {field.type === 'time' && (
                                         field.timeMode === 'dual' ? (() => {
                                           const parts = (value || '').split(' - ');
                                           const sTime = parts[0] || '';
                                           const eTime = parts[1] || '';
                                           return (
                                             <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                                               <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                 <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Từ</span>
                                                 <input 
                                                   type="time" 
                                                   value={sTime} 
                                                   onChange={(e) => {
                                                     const val = e.target.value;
                                                     setFormValues(prev => ({ ...prev, [field.id]: `${val} - ${eTime}` }));
                                                   }}
                                                   style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                                 />
                                               </div>
                                               <span style={{ marginTop: '10px', color: '#cbd5e1' }}>~</span>
                                               <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                 <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Đến</span>
                                                 <input 
                                                   type="time" 
                                                   value={eTime} 
                                                   onChange={(e) => {
                                                     const val = e.target.value;
                                                     setFormValues(prev => ({ ...prev, [field.id]: `${sTime} - ${val}` }));
                                                   }}
                                                   style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                                 />
                                               </div>
                                             </div>
                                           );
                                         })() : (
                                           <input 
                                             type="time"
                                             value={value}
                                             onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                             style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '120px' }}
                                           />
                                         )
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

                           {/* 3.2 DYNAMIC TABLE BLOCK */}
                           {block.type === 'TABLE' && (
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', marginTop: '1rem' }}>
                               <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                 {block.title}
                               </div>
                               <div style={{ overflowX: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '6px' }}>
                                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', background: '#ffffff', tableLayout: 'fixed' }}>
                                   <thead>
                                     <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--neutral-border)' }}>
                                       {(block.tableColumns || []).map((col: any) => {
                                         const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                         return (
                                           <th key={col.id} style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'left', width: colWidth, fontWeight: 'bold' }}>
                                             {col.label}
                                           </th>
                                         );
                                       })}
                                     </tr>
                                   </thead>
                                   <tbody>
                                     {(block.tableRows || []).length === 0 ? (
                                       <tr>
                                         <td colSpan={(block.tableColumns || []).length} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                           Không có dòng nào.
                                         </td>
                                       </tr>
                                     ) : (
                                       (block.tableRows || []).map((row: any) => (
                                         <tr key={row.id} style={{ borderBottom: '1px solid var(--neutral-border)' }}>
                                           {(block.tableColumns || []).map((col: any) => {
                                             const cellKey = `${block.id}_${row.id}_${col.id}`;
                                             const cellValue = formValues[cellKey] || '';
                                             const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? 'center' : 'left'));
                                             return (
                                               <td key={col.id} style={{ padding: '6px', borderRight: '1px solid var(--neutral-border)', verticalAlign: 'middle', textAlign: cellAlign }}>
                                                 {col.type === 'static_text' ? (
                                                   <span style={{ fontWeight: 500, display: 'block', textAlign: cellAlign }}>{block.tableData?.[row.id]?.[col.id] || ''}</span>
                                                 ) : col.type === 'checkbox' ? (
                                                   <div style={{ textAlign: 'center' }}>
                                                     <input 
                                                       type="checkbox" 
                                                       checked={cellValue === 'true'} 
                                                       onChange={(e) => setFormValues(prev => ({ ...prev, [cellKey]: e.target.checked ? 'true' : 'false' }))} 
                                                       style={{ transform: 'scale(1.1)', cursor: 'pointer' }}
                                                     />
                                                   </div>
                                                 ) : col.type === 'radio' ? (
                                                   <div style={{ textAlign: 'center' }}>
                                                     <input 
                                                       type="radio" 
                                                       checked={cellValue === 'true'} 
                                                       onChange={() => setFormValues(prev => ({ ...prev, [cellKey]: 'true' }))} 
                                                       style={{ transform: 'scale(1.1)', cursor: 'pointer' }}
                                                     />
                                                   </div>
                                                 ) : col.type === 'date' ? (
                                                   <input 
                                                     type="date" 
                                                     value={cellValue} 
                                                     onChange={(e) => setFormValues(prev => ({ ...prev, [cellKey]: e.target.value }))} 
                                                     style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', textAlign: cellAlign }}
                                                   />
                                                 ) : col.type === 'time' ? (
                                                   <input 
                                                     type="time" 
                                                     value={cellValue} 
                                                     onChange={(e) => setFormValues(prev => ({ ...prev, [cellKey]: e.target.value }))} 
                                                     style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', textAlign: cellAlign }}
                                                   />
                                                 ) : col.type === 'number' ? (
                                                   <input 
                                                     type="number" 
                                                     value={cellValue} 
                                                     onChange={(e) => setFormValues(prev => ({ ...prev, [cellKey]: e.target.value }))} 
                                                     placeholder="Nhập số..."
                                                     style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', textAlign: cellAlign }}
                                                   />
                                                 ) : (
                                                   <input 
                                                     type="text" 
                                                     value={cellValue} 
                                                     onChange={(e) => setFormValues(prev => ({ ...prev, [cellKey]: e.target.value }))} 
                                                     placeholder="Nhập chữ..."
                                                     style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', textAlign: cellAlign }}
                                                   />
                                                 )}
                                               </td>
                                             );
                                           })}
                                         </tr>
                                       ))
                                     )}
                                   </tbody>
                                 </table>
                               </div>
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
                                          <th key={cIdx} style={{ padding: '6px', borderRight: '1px solid var(--neutral-border)', textAlign: config.columnAlign || 'center', fontWeight: 600 }}>
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
                                              <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid var(--neutral-border)', textAlign: 'right' }}>
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
                                                    textAlign: 'right',
                                                    fontSize: '0.8rem'
                                                  }}
                                                />
                                              </td>
                                            );
                                          })}
                                          {config.showTotalColumn && (
                                            <td style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'right', background: '#f8fafc', fontWeight: 'bold', color: 'var(--primary)' }}>
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
                                          <td key={cIdx} style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'right', color: 'var(--text-primary)' }}>
                                            {total}
                                          </td>
                                        ))}
                                        {config.showTotalColumn && (
                                          <td style={{ padding: '8px', borderRight: '1px solid var(--neutral-border)', textAlign: 'right', background: '#e2e8f0', color: 'var(--primary)' }}>
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
