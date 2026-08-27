import { useState, useEffect } from 'react';
import type { Submission, Process, FormTemplateISO } from '../types';
import { formatFormVersion } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  FileText, 
  Plus, 
  Search, 
  Eye, 
  Printer, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Share2,
  Trash2,
  Copy
} from 'lucide-react';
import PrintFilledForm from './print/PrintFilledForm';
import FormFiller from './FormFiller';
import ConfirmModal from './common/ConfirmModal';

interface FormManagerProps {
  processId: string;
  formName: string;
  onOpenFormFiller: (processId: string, formName: string) => void;
  onBack: () => void;
}

export default function FormManager({ processId, formName, onOpenFormFiller, onBack }: FormManagerProps) {
  const { currentUser } = useAuth();
  
  // Data States
  const [process, setProcess] = useState<Process | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected Detail View
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  
  // Print Mode State
  const [printSubmission, setPrintSubmission] = useState<Submission | null>(null);
  
  // Supervisor verification states
  const [supervisorName, setSupervisorName] = useState(currentUser?.role_id === 'admin' || currentUser?.role_id === 'supervisor' ? currentUser.full_name : '');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [signingOff, setSigningOff] = useState(false);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'ABNORMALITY'>('ALL');
  const [signoffFilter, setSignoffFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');
  
  // Copy Submission State
  const [copySubmission, setCopySubmission] = useState<Submission | null>(null);

  // Deletion States
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch process details and form submissions
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch processes
      const procRes = await fetch('/api/processes');
      if (!procRes.ok) throw new Error('Failed to fetch processes');
      const procList: Process[] = await procRes.json();
      const foundProc = procList.find(p => p.id === processId);
      if (foundProc) {
        setProcess(foundProc);
      }

      // Fetch submissions
      const subRes = await fetch('/api/submissions');
      if (!subRes.ok) throw new Error('Failed to fetch submissions');
      const subData: Submission[] = await subRes.json();
      
      // Parse JSON columns and normalize snake_case properties from DB
      const parsedSubs: Submission[] = subData.map((sub: any) => {
        const formDataRaw = sub.formData || sub.form_data;
        const mediaUrlsRaw = sub.mediaUrls || sub.media_urls;
        const signoffRaw = sub.supervisorSignoff || sub.supervisor_signoff;

        return {
          id: sub.id,
          processId: sub.processId || sub.process_id,
          formId: sub.formId || sub.form_id,
          formVersion: sub.formVersion || sub.form_version,
          operatorId: sub.operatorId || sub.operator_id || 'N/A',
          status: sub.status,
          submittedAt: sub.submittedAt || sub.submitted_at,
          formData: typeof formDataRaw === 'string' ? JSON.parse(formDataRaw) : (formDataRaw || []),
          mediaUrls: typeof mediaUrlsRaw === 'string' ? JSON.parse(mediaUrlsRaw) : (mediaUrlsRaw || []),
          supervisorSignoff: typeof signoffRaw === 'string' ? JSON.parse(signoffRaw) : signoffRaw
        };
      });
      setSubmissions(parsedSubs);
    } catch (err) {
      console.error(err);
      alert('Error loading form management details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [processId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading form details...</p>
      </div>
    );
  }

  if (!process || !process.workflowFormsData || !process.workflowFormsData[formName]) {
    return (
      <div className="paper-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <h3>Form template not found</h3>
        <p>Could not locate the form "{formName}" in process "{process?.title || processId}".</p>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const formTemplate = process.workflowFormsData[formName] as FormTemplateISO;

  // Filter submissions for this specific form Id
  const formSubmissions = submissions.filter(sub => {
    const rawFormId = sub.formId;
    const isThisForm = rawFormId === formTemplate.formId || rawFormId === formName;
    if (!isThisForm) return false;

    // Filter states
    const matchSearch = (sub.operatorId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        sub.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = statusFilter === 'ALL' || 
      (statusFilter === 'PASS' && sub.status === 'PASS') ||
      (statusFilter === 'ABNORMALITY' && (sub.status === 'FAIL' || sub.status === 'ABNORMALITY'));
      
    const matchSignoff = signoffFilter === 'ALL' || 
      (signoffFilter === 'PENDING' && !sub.supervisorSignoff) || 
      (signoffFilter === 'VERIFIED' && !!sub.supervisorSignoff);

    return matchSearch && matchStatus && matchSignoff;
  });



  // Supervisor sign-off handler
  const handleSignOffSubmit = async (subId: string) => {
    if (!supervisorName.trim()) {
      alert('Please enter your supervisor verification signature name.');
      return;
    }

    try {
      setSigningOff(true);
      const res = await fetch(`/api/submissions/${subId}/signoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedBy: supervisorName,
          notes: verificationNotes
        })
      });

      if (!res.ok) throw new Error('Failed to verify record');
      const { signoffData } = await res.json();
      
      alert('Submission record verified and signed off successfully!');
      
      // Update local state
      setSubmissions(prev => prev.map(sub => sub.id === subId ? { ...sub, supervisorSignoff: signoffData } : sub));
      if (selectedSubmission && selectedSubmission.id === subId) {
        setSelectedSubmission(prev => prev ? { ...prev, supervisorSignoff: signoffData } : null);
      }
      
      setVerificationNotes('');
    } catch (err) {
      console.error(err);
      alert('Error signing off verification.');
    } finally {
      setSigningOff(false);
    }
  };

  // Delete submission record handler
  const handleDeleteSubmission = async () => {
    if (!submissionToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/submissions/${submissionToDelete.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete submission');

      // Reset selected submission if it is the deleted one
      if (selectedSubmission && selectedSubmission.id === submissionToDelete.id) {
        setSelectedSubmission(null);
      }
      setSubmissionToDelete(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error deleting submission record.');
    } finally {
      setDeleting(false);
    }
  };



  // Handle direct print trigger closure
  if (printSubmission) {
    return (
      <PrintFilledForm
        submission={printSubmission}
        formTemplate={formTemplate}
        onClose={() => setPrintSubmission(null)}
      />
    );
  }

  // Handle Copy / Clone Submission mode transition
  if (copySubmission) {
    return (
      <FormFiller
        processId={processId}
        formName={formName}
        initialSubmission={copySubmission}
        onBack={() => {
          setCopySubmission(null);
          fetchData();
        }}
      />
    );
  }

  const isFormDraft = formTemplate.status === 'DRAFT';
  const colors = isFormDraft 
    ? { bg: '#fffbeb', text: '#b45309', border: '#fde68a' } 
    : { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              const shareUrl = `${window.location.origin}/?page=fill&processId=${processId}&formName=${encodeURIComponent(formName)}`;
              navigator.clipboard.writeText(shareUrl)
                .then(() => alert('Shareable link copied to clipboard!\n' + shareUrl))
                .catch(() => alert('Failed to copy link.'));
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', height: '38px' }}
            title="Copy shareable link to clipboard"
          >
            <Share2 size={16} /> Share Link
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={() => onOpenFormFiller(processId, formName)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', height: '38px' }}
          >
            <Plus size={16} /> Fill New Form
          </button>
        </div>
      </div>

      {/* Form Details Card */}
      <div className="paper-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                {formTemplate.formId || 'N/A'}
              </span>
              <span className="badge" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', margin: 0 }}>
                {formTemplate.status || 'DRAFT'}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>{formTemplate.formTitle || formName}</h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Linked Process: <strong>{process.title}</strong> (Version: v{process.version})
            </p>
          </div>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
            <div>Form Version: <strong>{formatFormVersion(formTemplate.version) || 'V1'}</strong></div>
            <div>Revision Date: <strong>{formTemplate.revisionHistory?.[formTemplate.revisionHistory.length - 1]?.date || 'N/A'}</strong></div>
          </div>
        </div>
      </div>

      {/* Submissions Filter Toolbar */}
      <div className="paper-card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Search by Operator ID or Submission ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 1rem 0.45rem 2.25rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', cursor: 'pointer' }}
          >
            <option value="ALL">All Results</option>
            <option value="PASS">Pass Only</option>
            <option value="ABNORMALITY">Abnormality Only</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Signoff:</span>
          <select 
            value={signoffFilter}
            onChange={(e) => setSignoffFilter(e.target.value as any)}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', cursor: 'pointer' }}
          >
            <option value="ALL">All Sign-offs</option>
            <option value="PENDING">Pending Review</option>
            <option value="VERIFIED">Verified Only</option>
          </select>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* Left Side: Submission List Table */}
        <div className="paper-card" style={{ flex: '2 1 500px', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--neutral-border)', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Submission Log Records ({formSubmissions.length})
            </h3>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            {formSubmissions.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No submissions logged match the filters.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--neutral-border)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>ID</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left', fontWeight: 600 }}>Operator</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left', fontWeight: 600 }}>Submitted At</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600 }}>Sign-off</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formSubmissions.map((sub) => {
                    const hasFail = sub.status === 'FAIL' || sub.status === 'ABNORMALITY';
                    const isSelected = selectedSubmission?.id === sub.id;
                    return (
                      <tr 
                        key={sub.id} 
                        style={{ 
                          borderBottom: '1px solid var(--neutral-border)',
                          background: isSelected ? 'rgba(16, 163, 163, 0.03)' : 'transparent',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedSubmission(sub)}
                        className="hover-card-bg"
                      >
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
                          {sub.id.substring(4, 12)}
                        </td>
                        <td style={{ padding: '0.6rem' }}>{sub.operatorId}</td>
                        <td style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>
                          {new Date(sub.submittedAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                          <span 
                            className={`badge ${hasFail ? 'badge-danger' : 'badge-success'}`}
                            style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                          {sub.supervisorSignoff ? (
                            <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.78rem' }}>
                              <CheckCircle2 size={13} />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', fontSize: '0.78rem' }}>
                              <Clock size={13} />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.6rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="View Details"
                              onClick={() => setSelectedSubmission(sub)}
                              style={{ padding: '0.25rem', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Print A4 Record"
                              onClick={() => setPrintSubmission(sub)}
                              style={{ padding: '0.25rem', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Printer size={14} />
                            </button>
                            {currentUser?.role_id === 'admin' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Delete Record (Admin)"
                                onClick={() => setSubmissionToDelete(sub)}
                                style={{ padding: '0.25rem', height: '28px', width: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Submission view & Verification Drawer */}
        <div style={{ flex: 1, minWidth: '320px' }}>
          {!selectedSubmission ? (
            <div className="paper-card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileText size={32} style={{ margin: '0 auto 0.5rem auto', color: 'var(--text-muted)' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>Select a record from the list to display details and verification audit parameters.</p>
            </div>
          ) : (
            <div className="paper-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: '1rem' }}>
              
              {/* Detail Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Snapshot Detail</span>
                  <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{process.title}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '0.1rem' }}>ID: {selectedSubmission.id}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="Sao chép thành phiếu mới (Copy Record)"
                    onClick={() => {
                      setCopySubmission(selectedSubmission);
                      setSelectedSubmission(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    <Copy size={13} />
                    <span>Sao chép</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    title="In biểu mẫu (Print)"
                    onClick={() => setPrintSubmission(selectedSubmission)}
                    style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Printer size={13} />
                  </button>
                  {currentUser?.role_id === 'admin' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      title="Xóa bản ghi lỗi (Admin)"
                      onClick={() => {
                        setSubmissionToDelete(selectedSubmission);
                        setSelectedSubmission(null);
                      }}
                      style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={() => setSelectedSubmission(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', outline: 'none', padding: '0.2rem', marginLeft: '0.25rem' }}
                  >
                    <XCircle size={18} />
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Operator ID</div>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedSubmission.operatorId}</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Form ID/Version</div>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedSubmission.formId} ({selectedSubmission.formVersion})</strong>
                </div>
              </div>

              {/* Checklist Snapshot list */}
              <div>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0' }}>
                  Recorded Checklist Values
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {selectedSubmission.formData && selectedSubmission.formData.map((row, idx) => {
                    const rowFailed = row.status === 'FAIL';
                    return (
                      <div 
                        key={row.id || idx}
                        style={{
                          padding: '0.5rem 0.75rem',
                          background: rowFailed ? '#fff5f5' : '#f8fafc',
                          border: `1px solid ${rowFailed ? '#fca5a5' : 'var(--neutral-border)'}`,
                          borderRadius: '6px',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '0.2rem' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{idx + 1}. {row.checkItem}</span>
                          <span style={{ color: rowFailed ? '#ef4444' : '#10b981' }}>{row.status}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span>Target: {row.targetRange}</span>
                          <span>Value: <strong>{row.value}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Photo Evidence attachments thumbnail */}
              {selectedSubmission.mediaUrls && selectedSubmission.mediaUrls.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0' }}>
                    Photo Attachments ({selectedSubmission.mediaUrls.length})
                  </h4>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedSubmission.mediaUrls.map((key, index) => (
                      <a 
                        key={key} 
                        href={`/api/storage/download-url?key=${encodeURIComponent(key)}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '4px', 
                          border: '1px solid var(--neutral-border)',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f1f5f9'
                        }}
                        title={`Evidence photo ${index + 1}`}
                      >
                        <img 
                          src={`/api/storage/download-url?key=${encodeURIComponent(key)}`}
                          alt="Evidence thumbnail"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
                          }}
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Supervisor sign-off card */}
              <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <UserCheck size={14} />
                  <span>Supervisor Sign-off Audit</span>
                </h4>

                {selectedSubmission.supervisorSignoff ? (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Verified By:</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedSubmission.supervisorSignoff.signedBy}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Verification Date:</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(selectedSubmission.supervisorSignoff.signedAt).toLocaleString()}</span>
                    </div>
                    {selectedSubmission.supervisorSignoff.notes && (
                      <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', borderTop: '1px dashed #bbf7d0', paddingTop: '0.35rem', color: '#166534', fontStyle: 'italic' }}>
                        "{selectedSubmission.supervisorSignoff.notes}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Supervisor Signature Name *</label>
                      <input 
                        type="text" 
                        value={supervisorName}
                        onChange={(e) => setSupervisorName(e.target.value)}
                        placeholder="Enter supervisor signature name"
                        disabled={signingOff}
                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', outline: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Verification Notes / Corrective Feedback</label>
                      <textarea 
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        placeholder="Enter audit notes or feedback..."
                        disabled={signingOff}
                        rows={2}
                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.78rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', resize: 'none', outline: 'none' }}
                      />
                    </div>
                    <button 
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleSignOffSubmit(selectedSubmission.id)}
                      disabled={signingOff}
                      style={{ fontSize: '0.75rem', padding: '0.45rem', marginTop: '0.25rem', width: '100%', justifyContent: 'center' }}
                    >
                      {signingOff ? 'Verifying...' : 'Sign Off & Verify Record'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!submissionToDelete}
        title="Xác nhận xóa bản ghi"
        message={
          submissionToDelete ? (
            <div>
              Bạn có chắc chắn muốn xóa vĩnh viễn bản ghi này không?
              <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}>
                <strong>ID:</strong> {submissionToDelete.id}<br />
                <strong>Operator:</strong> {submissionToDelete.operatorId}<br />
                <strong>Ngày gửi:</strong> {new Date(submissionToDelete.submittedAt).toLocaleString('vi-VN')}
              </div>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--danger)', fontWeight: 500 }}>* Hành động này không thể hoàn tác.</p>
            </div>
          ) : ''
        }
        confirmText="Xóa vĩnh viễn"
        cancelText="Hủy"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteSubmission}
        onCancel={() => setSubmissionToDelete(null)}
      />
    </div>
  );
}
