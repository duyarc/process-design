import { useState, useEffect } from 'react';
import type { Submission, Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Printer, 
  FileText, 
  Search, 
  Eye,
  CheckCircle2,
  XCircle,
  UserCheck
} from 'lucide-react';
import PrintRecord from './print/PrintRecord';

interface SubmissionManagerProps {
  onBack: () => void;
  initialFormFilter?: string | null;
}

export default function SubmissionManager({ onBack, initialFormFilter }: SubmissionManagerProps) {
  const { currentUser } = useAuth();
  
  // Data States
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected Detail View
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  
  // Print Mode State
  const [printSubmission, setPrintSubmission] = useState<Submission | null>(null);
  
  // Supervisor verification states
  const [supervisorName, setSupervisorName] = useState(currentUser.role === 'admin' ? 'Supervisor Lead' : '');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [signingOff, setSigningOff] = useState(false);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState(initialFormFilter || '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'ABNORMALITY'>('ALL');
  const [signoffFilter, setSignoffFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');

  // 1. Fetch data from backend
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch submissions
      const subRes = await fetch('/api/submissions');
      if (!subRes.ok) throw new Error('Failed to fetch submissions');
      const subData: Submission[] = await subRes.json();
      
      // Parse JSON columns in case they are returned as string from CockroachDB (pg client sometimes does this if not auto-parsed)
      const parsedSubs = subData.map(sub => {
        return {
          ...sub,
          formData: typeof sub.formData === 'string' ? JSON.parse(sub.formData) : sub.formData,
          mediaUrls: typeof sub.mediaUrls === 'string' ? JSON.parse(sub.mediaUrls) : (sub.mediaUrls || []),
          supervisorSignoff: typeof sub.supervisorSignoff === 'string' ? JSON.parse(sub.supervisorSignoff) : sub.supervisorSignoff
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

  // Map process ID to title
  const getProcessTitle = (procId: string) => {
    const found = processes.find(p => p.id === procId);
    return found ? found.title : `Process ID: ${procId}`;
  };

  // Map process ID to form logo
  const getProcessLogo = (procId: string, formId?: string) => {
    const found = processes.find(p => p.id === procId);
    if (!found || !found.workflowFormsData || !formId) return '';
    const formData = Object.values(found.workflowFormsData).find((f: any) => f.formId === formId) as any;
    if (!formData || !formData.layoutBlocks) return '';
    const titleBlock = formData.layoutBlocks.find((b: any) => b.type === 'TITLE');
    return titleBlock?.logo || '';
  };

  // Map process ID to form description
  const getProcessDescription = (procId: string, formId?: string) => {
    const found = processes.find(p => p.id === procId);
    if (!found || !found.workflowFormsData || !formId) return '';
    const formData = Object.values(found.workflowFormsData).find((f: any) => f.formId === formId) as any;
    if (!formData || !formData.layoutBlocks) return '';
    const titleBlock = formData.layoutBlocks.find((b: any) => b.type === 'TITLE');
    return titleBlock?.fields?.[0]?.checkItem || '';
  };

  // Map process ID to checklist table column labels
  const getProcessColumnLabels = (procId: string, formId?: string) => {
    const found = processes.find(p => p.id === procId);
    if (!found || !found.workflowFormsData || !formId) return undefined;
    const formData = Object.values(found.workflowFormsData).find((f: any) => f.formId === formId) as any;
    if (!formData || !formData.layoutBlocks) return undefined;
    const tableBlock = formData.layoutBlocks.find((b: any) => b.type === 'CHECKLIST_TABLE');
    return tableBlock?.columnLabels;
  };

  // 2. Filter logic
  const filteredSubmissions = submissions.filter(sub => {
    const procTitle = getProcessTitle(sub.processId).toLowerCase();
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

  // 4. Print Record render bypass
  if (printSubmission) {
    return (
      <PrintRecord 
        submission={printSubmission} 
        processTitle={getProcessTitle(printSubmission.processId)} 
        logoText={getProcessLogo(printSubmission.processId, printSubmission.formId)}
        descriptionText={getProcessDescription(printSubmission.processId, printSubmission.formId)}
        columnLabels={getProcessColumnLabels(printSubmission.processId, printSubmission.formId)}
        onClose={() => setPrintSubmission(null)} 
      />
    );
  }

  return (
    <div style={{ padding: '1.5rem', background: '#f8fafc', minHeight: '88vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onBack}
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.4rem 0.75rem' }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
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

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        
        {/* Left Side: Filter and Submission Table List */}
        <div style={{ flex: 2, minWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Filters Bar */}
          <div className="paper-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
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

          {/* Table Container */}
          <div className="paper-card" style={{ padding: '1rem', overflowX: 'auto' }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Loading audit trails...</p>
            ) : filteredSubmissions.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0', fontStyle: 'italic' }}>No submissions matching filters.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--neutral-border)', background: '#f8fafc' }}>
                    <th style={{ padding: '0.6rem', textAlign: 'left', fontWeight: 600 }}>Record ID</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left', fontWeight: 600 }}>Process Name</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600 }}>Operator</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600 }}>Date/Time</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600 }}>QMS Status</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600 }}>Verification</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((sub) => {
                    const hasFail = sub.status === 'FAIL' || sub.status === 'ABNORMALITY';
                    return (
                      <tr 
                        key={sub.id} 
                        style={{ 
                          borderBottom: '1px solid var(--neutral-border)',
                          background: selectedSubmission?.id === sub.id ? '#eff6ff' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '0.6rem', fontWeight: 500, fontFamily: 'monospace' }}>{sub.id}</td>
                        <td style={{ padding: '0.6rem', fontWeight: 600 }}>
                          {getProcessTitle(sub.processId)}
                          {sub.formId && (
                            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Template: {sub.formId}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.6rem', textAlign: 'center' }}>{sub.operatorId}</td>
                        <td style={{ padding: '0.6rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          {new Date(sub.submittedAt).toLocaleDateString()} {new Date(sub.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                        <td style={{ padding: '0.6rem', textAlign: 'center' }}>
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

        {/* Right Side: Detailed Submission view & Verification Sign-off Drawer */}
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
                  <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1rem', color: 'var(--text-primary)' }}>{getProcessTitle(selectedSubmission.processId)}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '0.1rem' }}>ID: {selectedSubmission.id}</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedSubmission(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <XCircle size={18} />
                </button>
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
              <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '1rem' }}>
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
          )}
        </div>

      </div>
    </div>
  );
}
