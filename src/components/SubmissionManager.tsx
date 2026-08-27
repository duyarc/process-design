import { useState, useEffect } from 'react';
import type { Submission, Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Printer, 
  Search, 
  Eye,
  CheckCircle2,
  XCircle,
  UserCheck,
  Trash2,
  FileText,
  Copy
} from 'lucide-react';
import PrintFilledForm from './print/PrintFilledForm';
import ConfirmModal from './common/ConfirmModal';
import FormFiller from './FormFiller';

interface SubmissionManagerProps {
  onBack?: () => void;
  initialFormFilter?: string | null;
  isEmbedded?: boolean;
  layoutMode?: 'grid' | 'list';
  onOpenReport?: (submissionId: string) => void;
}

export default function SubmissionManager({ onBack, initialFormFilter, isEmbedded = false, layoutMode = 'list', onOpenReport }: SubmissionManagerProps) {
  const { currentUser } = useAuth();
  
  // Data States
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected Detail View
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  
  // Read-only Full Form View State
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  // Print Mode State
  const [printSubmission, setPrintSubmission] = useState<Submission | null>(null);

  // Copy / Clone Submission State
  const [copyingSubmission, setCopyingSubmission] = useState<Submission | null>(null);
  
  // Supervisor verification states
  const [supervisorName, setSupervisorName] = useState(currentUser?.role_id === 'admin' || currentUser?.role_id === 'supervisor' ? currentUser.full_name : '');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [signingOff, setSigningOff] = useState(false);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState(initialFormFilter || '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'ABNORMALITY'>('ALL');
  const [signoffFilter, setSignoffFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');

  // Deletion States
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 1. Fetch data from backend
  const fetchData = async () => {
    try {
      setLoading(true);
      
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

      // Fetch processes to map titles
      const procRes = await fetch('/api/processes');
      if (procRes.ok) {
        const procData = await procRes.json();
        setProcesses(procData);
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching submission logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSubmission(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Map process ID to display title using Form-Centric Dynamic Resolution (current form mapping prioritized)
  const getProcessTitle = (procId: string, formId?: string) => {
    // 1. ƯU TIÊN SỐ 1: Tra cứu quy trình HIỆN TẠI đang chứa formId này (bất kể procId cũ là gì)
    if (formId) {
      const target = formId.toLowerCase();
      const linkedProc = processes.find(proc => {
        if (!proc.workflowFormsData) return false;
        return Object.entries(proc.workflowFormsData).some(([fName, fData]) => {
          return fName.toLowerCase() === target || 
                 (fData.formId && fData.formId.toLowerCase() === target) ||
                 (fData.formTitle && fData.formTitle.toLowerCase() === target);
        });
      });
      if (linkedProc) return linkedProc.title;
    }

    // 2. Fallback: Nếu form hiện tại không gắn vào quy trình nào, kiểm tra procId lịch sử
    if (procId && procId !== 'unlinked') {
      const p = processes.find(proc => proc.id === procId);
      if (p) return p.title;
    }

    // 3. Mặc định là Biểu mẫu tự do
    return 'Biểu mẫu tự do';
  };

  // 2. Filter logic
  const filteredSubmissions = submissions.filter(sub => {
    const procTitle = getProcessTitle(sub.processId, sub.formId).toLowerCase();
    const opId = sub.operatorId.toLowerCase();
    const subId = sub.id.toLowerCase();
    const fId = (sub.formId || '').toLowerCase();
    const matchSearch = procTitle.includes(searchTerm.toLowerCase()) || 
                        opId.includes(searchTerm.toLowerCase()) || 
                        subId.includes(searchTerm.toLowerCase()) ||
                        fId.includes(searchTerm.toLowerCase());
    
    const matchStatus = statusFilter === 'ALL' || sub.status === statusFilter;
    
    const matchSignoff = signoffFilter === 'ALL' || 
      (signoffFilter === 'PENDING' && !sub.supervisorSignoff) || 
      (signoffFilter === 'VERIFIED' && !!sub.supervisorSignoff);

    return matchSearch && matchStatus && matchSignoff;
  });

  // 3. Supervisor sign-off handler
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

      // Clear selected submission if it is the deleted one
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

  // Read-Only Full Online Form Viewer render bypass
  if (viewingSubmission) {
    return (
      <FormFiller
        processId={viewingSubmission.processId}
        formName={viewingSubmission.formId}
        initialSubmission={viewingSubmission}
        readOnly={true}
        onCopySubmission={(sub) => {
          setViewingSubmission(null);
          setCopyingSubmission(sub);
        }}
        onBack={() => {
          setViewingSubmission(null);
          fetchData();
        }}
      />
    );
  }

  // Copy / Clone Submission mode render bypass
  if (copyingSubmission) {
    return (
      <FormFiller
        processId={copyingSubmission.processId}
        formName={copyingSubmission.formId}
        initialSubmission={copyingSubmission}
        onBack={() => {
          setCopyingSubmission(null);
          fetchData();
        }}
      />
    );
  }

  // 4. Print Record render bypass
  if (printSubmission) {
    return (
      <PrintFilledForm
        submission={printSubmission}
        onClose={() => setPrintSubmission(null)}
      />
    );
  }

  return (
    <div style={{ 
      padding: isEmbedded ? '0' : '1.5rem', 
      background: isEmbedded ? 'transparent' : '#f8fafc', 
      minHeight: isEmbedded ? 'auto' : '88vh' 
    }}>
      
      {/* Header */}
      {!isEmbedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {onBack && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onBack}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ISO 2026 Submission Tracking Portal
              </h1>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Quality management system (QMS) audit trail and supervisor verification loop
              </span>
            </div>
          </div>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={fetchData}
            style={{ fontSize: '0.85rem' }}
          >
            Refresh Logs
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Filters Bar */}
        <div className="paper-card" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Process, Operator, ID..."
              style={{ padding: '0.45rem 0.6rem 0.45rem 2.25rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', width: '100%', outline: 'none' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', background: '#fff' }}
            >
              <option value="ALL">All Checks</option>
              <option value="PASS">Pass Only</option>
              <option value="ABNORMALITY">Abnormalities Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Verification:</span>
            <select 
              value={signoffFilter}
              onChange={(e) => setSignoffFilter(e.target.value as any)}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', background: '#fff' }}
            >
              <option value="ALL">All Reviews</option>
              <option value="PENDING">Pending Approval</option>
              <option value="VERIFIED">Verified</option>
            </select>
          </div>
        </div>

        {/* Table/Grid Container */}
        {layoutMode === 'grid' && !loading && filteredSubmissions.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {filteredSubmissions.map((sub) => {
              const hasFail = sub.status === 'FAIL' || sub.status === 'ABNORMALITY';
              const isSelected = selectedSubmission?.id === sub.id;

              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubmission(sub)}
                  className="hover-card-bg"
                  style={{
                    background: isSelected ? '#eff6ff' : '#ffffff',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--neutral-border)',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                        {sub.id}
                      </span>
                      <span className={`badge ${hasFail ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', textTransform: 'uppercase' }}>
                        {sub.status}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {getProcessTitle(sub.processId)}
                    </h4>
                    {sub.formId && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                        Template: {sub.formId}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.5rem', marginBottom: '0.75rem' }}>
                      <div><strong>Operator:</strong> {sub.operatorId}</div>
                      <div><strong>Submitted:</strong> {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      {sub.supervisorSignoff ? (
                        <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}>
                          <CheckCircle2 size={12} />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span style={{ color: '#f59e0b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}>
                          <Clock size={12} />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="View Details"
                        onClick={() => setSelectedSubmission(sub)}
                        style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                      >
                        <Eye size={13} />
                      </button>
                      {onOpenReport && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Xem Báo cáo Đánh giá (Record Report)"
                          onClick={() => onOpenReport(sub.id)}
                          style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                        >
                          <FileText size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        title="Print A4 Record"
                        onClick={() => setPrintSubmission(sub)}
                        style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                      >
                        <Printer size={13} />
                      </button>
                      {currentUser?.role_id === 'admin' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title="Delete Record (Admin)"
                          onClick={() => setSubmissionToDelete(sub)}
                          style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                        >
                          <Trash2 size={13} style={{ color: '#ef4444' }} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="paper-card" style={{ padding: '0.5rem 0', overflowX: 'auto' }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Loading audit trails...</p>
            ) : filteredSubmissions.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontStyle: 'italic' }}>No submissions matching filters.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--neutral-border)', background: '#f8fafc', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '12%' }}>Record ID</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '38%' }}>Process Name</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '12%' }}>Operator</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '18%' }}>Date/Time</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '10%' }}>QMS Status</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '10%' }}>Verification</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600, width: '8%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((sub) => {
                    const hasFail = sub.status === 'FAIL' || sub.status === 'ABNORMALITY';
                    const isSelected = selectedSubmission?.id === sub.id;

                    return (
                      <tr 
                        key={sub.id} 
                        style={{ 
                          borderBottom: '1px solid var(--neutral-border)',
                          background: isSelected ? '#eff6ff' : 'transparent',
                          transition: 'background 0.15s',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => setSelectedSubmission(sub)}
                      >
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500, fontFamily: 'monospace', verticalAlign: 'middle' }}>{sub.id}</td>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, verticalAlign: 'middle' }}>
                          <div>{getProcessTitle(sub.processId, sub.formId)}</div>
                          {sub.formId && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Template: {sub.formId}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>{sub.operatorId}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>
                          {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span 
                            className={`badge ${hasFail ? 'badge-danger' : 'badge-success'}`}
                            style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
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
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Xem toàn văn Form Online (Full Web View)"
                              onClick={() => setViewingSubmission(sub)}
                              style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, color: 'var(--primary)' }}
                            >
                              <Eye size={13} />
                            </button>
                            {onOpenReport && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Xem Báo cáo Đánh giá (Record Report)"
                                onClick={() => onOpenReport(sub.id)}
                                style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                              >
                                <FileText size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Print A4 Record"
                              onClick={() => setPrintSubmission(sub)}
                              style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                            >
                              <Printer size={13} />
                            </button>
                            {currentUser?.role_id === 'admin' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                title="Xóa bản ghi lỗi (Admin)"
                                onClick={() => setSubmissionToDelete(sub)}
                                style={{ padding: '0.25rem', height: '26px', width: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, color: '#ef4444' }}
                              >
                                <Trash2 size={13} />
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
        )}
      </div>

      {/* Slide-over Drawer Overlay */}
      {selectedSubmission && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'flex-end',
            transition: 'opacity 0.2s ease-in-out'
          }}
          onClick={() => setSelectedSubmission(null)}
        >
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
          <div 
            style={{
              width: '100%',
              maxWidth: '480px',
              height: '100%',
              background: '#ffffff',
              boxShadow: '-4px 0 15px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              overflowY: 'auto',
              position: 'relative',
              animation: 'slideIn 0.2s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Detail Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Snapshot Detail</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{getProcessTitle(selectedSubmission.processId, selectedSubmission.formId)}</h3>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '0.1rem' }}>ID: {selectedSubmission.id}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Mở toàn văn Form Online (Full Web View)"
                  onClick={() => {
                    setViewingSubmission(selectedSubmission);
                    setSelectedSubmission(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: 'var(--primary)' }}
                >
                  <Eye size={13} />
                  <span>Toàn văn</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  title="Sao chép thành phiếu mới (Copy Record)"
                  onClick={() => {
                    setCopyingSubmission(selectedSubmission);
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.78rem', marginTop: '1rem' }}>
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
            <div style={{ marginTop: '1.25rem' }}>
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
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.5rem 0' }}>
                  Photo Attachments ({selectedSubmission.mediaUrls.length})
                </h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {selectedSubmission.mediaUrls.map((key, index) => (
                    <div 
                      key={index} 
                      style={{
                        width: '60px',
                        height: '60px',
                        border: '1px solid var(--neutral-border)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        background: '#f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={async () => {
                        const res = await fetch(`/api/storage/download-url?key=${encodeURIComponent(key)}`);
                        if (res.ok) {
                          const { downloadUrl } = await res.json();
                          window.open(downloadUrl, '_blank');
                        }
                      }}
                      title="Click to view image"
                    >
                      <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>Photo {index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Supervisor sign-off loop */}
            <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '1rem', marginTop: '1.5rem' }}>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <UserCheck size={14} style={{ color: 'var(--primary)' }} />
                <span>Supervisor QMS Verification</span>
              </h4>

              {selectedSubmission.supervisorSignoff ? (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#065f46' }}>
                  <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={15} />
                    <span>Verified & Sealed</span>
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    Verified by: <strong>{selectedSubmission.supervisorSignoff.signedBy}</strong>
                  </div>
                  <div>
                    Date: {new Date(selectedSubmission.supervisorSignoff.signedAt).toLocaleString()}
                  </div>
                  {selectedSubmission.supervisorSignoff.notes && (
                    <div style={{ marginTop: '0.5rem', fontStyle: 'italic', background: '#ffffff', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #d1fae5' }}>
                      Notes: {selectedSubmission.supervisorSignoff.notes}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '0.5rem', borderRadius: '4px', display: 'flex', gap: '0.25rem' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>Pending daily verification review. Confirm values align with process control standards.</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.25rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Supervisor Signature Name *</label>
                    <input 
                      type="text" 
                      value={supervisorName}
                      onChange={(e) => setSupervisorName(e.target.value)}
                      placeholder="Enter supervisor signature name"
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Review Notes / Verification Comments</label>
                    <textarea 
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      placeholder="Optional review observations (e.g. All checks within range, containment verified)..."
                      rows={2}
                      style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', resize: 'none' }}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={signingOff}
                    onClick={() => handleSignOffSubmit(selectedSubmission.id)}
                    className="btn btn-primary"
                    style={{ width: '100%', fontSize: '0.8rem', background: 'var(--primary)', borderColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
                  >
                    <CheckCircle size={15} />
                    <span>{signingOff ? 'Signing off...' : 'Approve & Sign Off Record'}</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

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
