import { useState, useEffect } from 'react';
import type { Process, FormTemplateISO, SubmissionFieldSnapshot } from '../types';
import { formatFormVersion, getColStyleWidth } from '../types';
import { 
  ArrowLeft, 
  CheckCircle2, 
  X, 
  Camera, 
  AlertTriangle, 
  Link2 
} from 'lucide-react';

interface FormFillerProps {
  processId: string;
  formName: string;
  onBack: () => void;
}

export default function FormFiller({ processId, formName, onBack }: FormFillerProps) {
  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form Filler UI states
  const [formValues, setFormValues] = useState<{ [fieldId: string]: string }>({});
  const [fieldReactions, setFieldReactions] = useState<{ [fieldId: string]: string }>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<{ [fieldId: string]: string[] }>({}); // fieldId -> array of keys
  const [isPhotoUploading, setIsPhotoUploading] = useState<{ [fieldId: string]: boolean }>({});
  const [operatorId, setOperatorId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Fetch process details
  const fetchProcess = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/processes');
      if (!res.ok) throw new Error('Failed to fetch processes');
      const procList: Process[] = await res.json();
      const foundProc = procList.find(p => p.id === processId);
      if (foundProc) {
        setProcess(foundProc);
      }
    } catch (err) {
      console.error(err);
      alert('Error loading form details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcess();
  }, [processId]);

  // Copy share link helper
  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/?page=fill&processId=${processId}&formName=${encodeURIComponent(formName)}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        alert('Shareable link copied to clipboard!\n' + shareUrl);
      })
      .catch((err) => {
        console.error(err);
        alert('Failed to copy link.');
      });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading digital template form...</div>
      </div>
    );
  }

  if (!process || !process.workflowFormsData || !process.workflowFormsData[formName]) {
    return (
      <div className="paper-card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <X size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
        <h3>Form template not found</h3>
        <p>Could not locate the form "{formName}" in process "{process?.title || processId}".</p>
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>
    );
  }

  const formTemplate = process.workflowFormsData[formName] as FormTemplateISO;

  // Photo uploading callback
  const handlePhotoUpload = async (fieldId: string, file: File) => {
    setIsPhotoUploading(prev => ({ ...prev, [fieldId]: true }));
    try {
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId: process.id,
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

  // Submit filled form
  const handleSubmitForm = async () => {
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
          targetRange = field.options ? field.options.filter((o: any) => o.isPass).map((o: any) => o.label).join(' / ') : (field.targetRange || 'Checked & Ok');
          const selectedOpt = field.options?.find((o: any) => o.value === val);
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
      
      setSubmittedId(submissionId);
      
      // Reset states
      setFormValues({});
      setFieldReactions({});
      setUploadedPhotos({});
      setOperatorId('');
    } catch (err) {
      console.error(err);
      alert(`Failed to submit: ${err instanceof Error ? err.message : 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Submission success UI
  if (submittedId) {
    return (
      <div className="paper-card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '4rem auto', borderTop: '4px solid #10b981' }}>
        <CheckCircle2 size={56} style={{ color: '#10b981', marginBottom: '1.25rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Record Submitted Successfully!</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Your check record has been securely uploaded and cataloged.<br />
          Submission ID: <strong style={{ fontFamily: 'monospace' }}>{submittedId}</strong>
        </p>
        
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setSubmittedId(null)}
          >
            Fill Another Record
          </button>
          
          <button className="btn btn-secondary" onClick={onBack}>
            Back to Form Manager
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Standalone Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        <button 
          className="btn btn-secondary btn-sm" 
          onClick={handleCopyShareLink}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem' }}
          title="Copy link to this form"
        >
          <Link2 size={13} />
          <span>Copy Form Link</span>
        </button>
      </div>

      {/* Main Form Paper Card */}
      <div className="paper-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Title Block */}
        <div style={{ borderBottom: '1px solid var(--neutral-border)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              {formTemplate.formId || 'N/A'}
            </span>
            <span className="badge" style={{ 
              backgroundColor: formTemplate.status === 'DRAFT' ? '#fffbeb' : '#f0fdf4', 
              color: formTemplate.status === 'DRAFT' ? '#b45309' : '#15803d', 
              border: `1px solid ${formTemplate.status === 'DRAFT' ? '#fde68a' : '#bbf7d0'}`, 
              textTransform: 'uppercase', 
              fontSize: '0.65rem', 
              fontWeight: 700, 
              padding: '0.1rem 0.4rem', 
              borderRadius: '4px' 
            }}>
              {formTemplate.status || 'DRAFT'}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>{formTemplate.formTitle || formName}</h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Process Standard: <strong>{process.title}</strong> | Version: <strong>{formatFormVersion(formTemplate.version) || 'V1'}</strong>
          </p>
        </div>

        {/* Operator Identification */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          padding: '1.25rem',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>Operator ID / Attributable Signature *</span>
          </label>
          <input
            type="text"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            placeholder="Enter your Name or Badge ID (e.g. John Doe / OP-42)"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
              border: '1px solid #93c5fd',
              borderRadius: '6px',
              outline: 'none',
              background: '#ffffff'
            }}
          />
        </div>

        {/* Checklist Groups */}
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
              padding: '1.5rem',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <h4 style={{
                margin: 0,
                fontSize: '0.92rem',
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
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0' }}>{block.title}</h1>
                  <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
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
                      <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {field.checkItem}
                        </label>
                        {field.type === 'date' ? (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '36px' }}
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
                                    style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '36px' }}
                                  />
                                </div>
                                <span style={{ marginTop: '12px', color: '#cbd5e1' }}>~</span>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Đến</span>
                                  <input 
                                    type="time" 
                                    value={eTime} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormValues(prev => ({ ...prev, [field.id]: `${sTime} - ${val}` }));
                                    }}
                                    style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '36px' }}
                                  />
                                </div>
                              </div>
                            );
                          })() : (
                            <input 
                              type="time"
                              value={value}
                              onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                              style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '36px' }}
                            />
                          )
                        ) : (field.type === 'radio' || field.type === 'checkbox') ? (
                          <select
                            value={value}
                            onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '36px' }}
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
                            style={{ padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '36px' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. CHECKLIST TABLE BLOCK */}
              {block.type === 'CHECKLIST_TABLE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        background: isOutOfSpec ? '#fff5f5' : '#ffffff',
                        borderColor: isOutOfSpec ? '#fca5a5' : 'var(--neutral-border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {fIdx + 1}. {field.checkItem} {field.locationCode && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>[{field.locationCode}]</span>}
                          </span>
                          {specHint && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{specHint}</span>}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            {field.type === 'number' ? (
                              <input 
                                type="number"
                                value={value}
                                onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                placeholder={`Nhập số (${field.unit || ''})...`}
                                style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
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
                                  style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                                />
                              )
                            ) : (field.type === 'radio' || field.type === 'checkbox') ? (
                              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                {(field.options ?? [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }]).map((opt: any) => (
                                  <label key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                                    <input 
                                      type="radio" 
                                      name={field.id}
                                      value={opt.value}
                                      checked={value === opt.value}
                                      onChange={() => setFormValues(prev => ({ ...prev, [field.id]: opt.value }))}
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <input 
                                type="text"
                                value={value}
                                onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                placeholder="Nhập kết quả..."
                                style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                              />
                            )}
                          </div>

                          {/* Photo upload trigger */}
                          {isOutOfSpec && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label className="btn btn-secondary btn-sm" style={{ margin: 0, padding: '0.35rem 0.6rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                <Camera size={12} />
                                <span>Upload photo</span>
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload(field.id, e.target.files[0])}
                                  style={{ display: 'none' }}
                                  disabled={isPhotoUploading[field.id]}
                                />
                              </label>
                              
                              {isPhotoUploading[field.id] && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Uploading...</span>}

                              {uploadedPhotos[field.id] && uploadedPhotos[field.id].length > 0 && (
                                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                                  ✓ Uploaded ({uploadedPhotos[field.id].length})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action note */}
                        {isOutOfSpec && (
                          <div style={{ borderLeft: '3px solid #ef4444', paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600 }}>
                              <AlertTriangle size={12} />
                              <span>Corrective action Containment protocol required:</span>
                            </div>
                            <input 
                              type="text"
                              value={fieldReactions[field.id] || ''}
                              onChange={(e) => setFieldReactions(prev => ({ ...prev, [field.id]: e.target.value }))}
                              placeholder="Enter containment reaction protocol feedback... (e.g. Put on hold / Isolated)"
                              style={{ width: '100%', marginTop: '0.25rem', padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid #fca5a5', borderRadius: '4px', background: '#fff' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3.1 DYNAMIC TABLE BLOCK */}
              {block.type === 'TABLE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
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

              {/* 4. MATRIX TABLE BLOCK */}
              {block.type === 'MATRIX_TABLE' && block.matrixConfig && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                          {block.matrixConfig.rowHeader}
                        </th>
                        <th 
                          colSpan={block.matrixConfig.columns.length} 
                          style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}
                        >
                          {block.matrixConfig.columnHeader}
                        </th>
                        {block.matrixConfig.showTotalColumn && (
                          <th style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                            {block.matrixConfig.totalColumnHeader}
                          </th>
                        )}
                        {block.matrixConfig.showNotesColumn && (
                          <th style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                            {block.matrixConfig.notesColumnHeader}
                          </th>
                        )}
                      </tr>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ border: '1.5px solid #000000', padding: '6px' }}></th>
                        {block.matrixConfig.columns.map((colName: string, cIdx: number) => (
                          <th key={cIdx} style={{ border: '1.5px solid #000000', padding: '6px', textAlign: block.matrixConfig.columnAlign || 'center', fontWeight: 600 }}>
                            {colName}
                          </th>
                        ))}
                        {block.matrixConfig.showTotalColumn && (
                          <th style={{ border: '1.5px solid #000000', padding: '6px' }}></th>
                        )}
                        {block.matrixConfig.showNotesColumn && (
                          <th style={{ border: '1.5px solid #000000', padding: '6px' }}></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: block.matrixConfig.rowCount }).map((_, rIdx) => {
                        let rowTotal = 0;
                        block.matrixConfig.columns.forEach((_: any, cIdx: number) => {
                          const val = formValues[`${block.id}_row_${rIdx}_col_${cIdx}`] || '';
                          const num = parseInt(val, 10);
                          if (!isNaN(num)) rowTotal += num;
                        });

                        return (
                          <tr key={rIdx}>
                            <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontWeight: 'bold', background: '#f8fafc' }}>
                              {rIdx + 1}
                            </td>
                            {block.matrixConfig.columns.map((_: any, cIdx: number) => {
                              const key = `${block.id}_row_${rIdx}_col_${cIdx}`;
                              return (
                                <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px' }}>
                                  <input 
                                    type="number"
                                    value={formValues[key] || ''}
                                    onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    style={{ width: '100%', border: 'none', outline: 'none', padding: '4px', textAlign: 'right', fontSize: '0.8rem' }}
                                  />
                                </td>
                              );
                            })}
                            {block.matrixConfig.showTotalColumn && (
                              <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'right', fontWeight: 'bold', background: '#f8fafc' }}>
                                {rowTotal}
                              </td>
                            )}
                            {block.matrixConfig.showNotesColumn && (
                              <td style={{ border: '1.5px solid #000000', padding: '4px' }}>
                                <input 
                                  type="text"
                                  value={formValues[`${block.id}_row_${rIdx}_note`] || ''}
                                  onChange={(e) => setFormValues(prev => ({ ...prev, [`${block.id}_row_${rIdx}_note`]: e.target.value }))}
                                  placeholder="Ghi chú..."
                                  style={{ width: '100%', border: 'none', outline: 'none', padding: '4px', fontSize: '0.8rem' }}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. SIGN BLOCK */}
              {block.type === 'SIGN' && (
                <div style={{
                  paddingTop: '5px',
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '40px'
                }}>
                  {block.fields.map((f: any) => (
                    <div key={f.id} style={{
                      flex: 1,
                      height: '65px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: '4px'
                    }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'center' }}>{f.checkItem}</span>
                      <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center' }}>
                        {f.reactionProtocol ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`) : '(Ký và ghi rõ họ tên)'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          );
        })}

        {/* Submit Bar */}
        <div style={{
          borderTop: '1px solid var(--neutral-border)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          {onBack && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onBack}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSubmitForm}
            disabled={submitting}
            style={{ padding: '0.5rem 2rem' }}
          >
            {submitting ? 'Submitting Check...' : 'Submit Check Record'}
          </button>
        </div>

      </div>
    </div>
  );
}
