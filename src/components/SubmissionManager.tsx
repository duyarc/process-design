import { useState, useEffect, useMemo } from 'react';
import type { Submission, Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Printer, 
  Eye,
  CheckCircle2,
  XCircle,
  UserCheck,
  Trash2,
  FileText,
  Copy,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  PenTool
} from 'lucide-react';
import PrintFilledForm from './print/PrintFilledForm';
import ConfirmModal from './common/ConfirmModal';
import FormFiller from './FormFiller';
import DashboardToolbar from './common/DashboardToolbar';

interface SubmissionManagerProps {
  onBack?: () => void;
  initialFormFilter?: string | null;
  isEmbedded?: boolean;
  layoutMode?: 'grid' | 'list';
  cachedProcesses?: Process[];
  hideToolbar?: boolean;
  externalSearchTerm?: string;
  externalProcessFilter?: string;
  externalSignoffFilter?: 'ALL' | 'PENDING' | 'VERIFIED';
  onOpenReport?: (submissionId: string) => void;
  onOpenReportBuilder?: (formId: string) => void;
  onViewingChange?: (isViewing: boolean) => void;
  onOpenFormFiller?: (processId: string, formName: string) => void;
}

export default function SubmissionManager({ 
  onBack, 
  initialFormFilter, 
  isEmbedded = false, 
  cachedProcesses, 
  hideToolbar = false,
  externalSearchTerm,
  externalProcessFilter,
  externalSignoffFilter,
  onOpenReport, 
  onOpenReportBuilder, 
  onViewingChange, 
  onOpenFormFiller 
}: SubmissionManagerProps) {
  const { currentUser } = useAuth();
  
  // Data States — SWR: init from cache for instant render, revalidate in background
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    try {
      const cached = sessionStorage.getItem('swr_submissions');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [processes] = useState<Process[]>(() => {
    if (cachedProcesses && cachedProcesses.length > 0) return cachedProcesses;
    try {
      const cached = sessionStorage.getItem('swr_processes');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(() => {
    try { return !sessionStorage.getItem('swr_submissions'); }
    catch { return true; }
  });
  
  // Selected Detail View
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  
  // Read-only Full Form View State
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  // Print Mode State
  const [printSubmission, setPrintSubmission] = useState<Submission | null>(null);

  // Copy / Clone Submission State
  const [copyingSubmission, setCopyingSubmission] = useState<Submission | null>(null);

  // Direct Fill Form State (from group header)
  const [fillingForm, setFillingForm] = useState<{ processId: string; formName: string } | null>(null);

  // Group Accordion Collapse State (formKey -> boolean)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Active Context Menu for row actions
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Auto-close action menu when clicking outside
  useEffect(() => {
    if (!activeActionMenuId) return;
    const handleOutsideClick = () => setActiveActionMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeActionMenuId]);

  // Notify parent container (e.g. Dashboard) when full-screen form view is active
  useEffect(() => {
    onViewingChange?.(Boolean(viewingSubmission || copyingSubmission || printSubmission || fillingForm));
    return () => {
      onViewingChange?.(false);
    };
  }, [viewingSubmission, copyingSubmission, printSubmission, fillingForm, onViewingChange]);
  
  // Supervisor verification states
  const [supervisorName, setSupervisorName] = useState(currentUser?.role_id === 'admin' || currentUser?.role_id === 'supervisor' ? currentUser.full_name : '');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [signingOff, setSigningOff] = useState(false);
  
  // Filter States — prioritize external props when hoisted, fallback to internal states
  const [internalSearchTerm, setInternalSearchTerm] = useState(initialFormFilter || '');
  const [internalSignoffFilter, setInternalSignoffFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');
  const [internalProcessFilter, setInternalProcessFilter] = useState<string>('ALL');

  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = setInternalSearchTerm;
  const signoffFilter = externalSignoffFilter !== undefined ? externalSignoffFilter : internalSignoffFilter;
  const setSignoffFilter = setInternalSignoffFilter;
  const processFilter = externalProcessFilter !== undefined ? externalProcessFilter : internalProcessFilter;
  const setProcessFilter = setInternalProcessFilter;

  // Deletion States
  const [submissionToDelete, setSubmissionToDelete] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast and Error States
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 1. Fetch data from backend (light endpoint — no form_data blob)
  const fetchData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      setFetchError(null);
      
      const subRes = await fetch('/api/submissions');
      if (!subRes.ok) throw new Error('Failed to fetch submissions');
      const subData: any[] = await subRes.json();
      
      // Parse/normalize — light response: no formData, mediaUrls, accessToken
      const parsedSubs: Submission[] = subData.map((sub: any) => {
        const signoffRaw = sub.supervisorSignoff || sub.supervisor_signoff;
        return {
          id: sub.id,
          processId: sub.processId || sub.process_id,
          formId: sub.formId || sub.form_id,
          formVersion: sub.formVersion || sub.form_version,
          operatorId: sub.operatorId || sub.operator_id || 'N/A',
          status: sub.status,
          submittedAt: sub.submittedAt || sub.submitted_at,
          formData: [],
          mediaUrls: [],
          supervisorSignoff: typeof signoffRaw === 'string' ? JSON.parse(signoffRaw) : signoffRaw
        };
      });
      setSubmissions(parsedSubs);
      try { sessionStorage.setItem('swr_submissions', JSON.stringify(parsedSubs)); } catch (e) { /* quota */ }
    } catch (err: any) {
      console.error(err);
      setFetchError(err?.message || 'Error fetching submission logs');
      if (!isBackground) {
        setToast({ message: 'Không thể tải nhật ký phiếu. Đang thử kết nối lại...', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasCache = !!sessionStorage.getItem('swr_submissions');
    fetchData(hasCache);
  }, []);

  // Lazy-fetch full submission (with formData) for detail/print/copy
  const fetchFullSubmission = async (sub: Submission): Promise<Submission> => {
    try {
      const res = await fetch(`/api/submissions/${encodeURIComponent(sub.id)}`);
      if (!res.ok) throw new Error('Failed to fetch submission detail');
      const full = await res.json();
      return {
        ...sub,
        formData: full.formData || [],
        mediaUrls: full.mediaUrls || [],
        accessToken: full.accessToken || full.access_token
      };
    } catch {
      return sub; // fallback to light object
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedSubmission(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lazy-fetch formData when detail panel is opened (light list has formData=[])
  useEffect(() => {
    if (!selectedSubmission || selectedSubmission.formData.length > 0) return;
    let cancelled = false;
    fetchFullSubmission(selectedSubmission).then(full => {
      if (!cancelled) setSelectedSubmission(full);
    });
    return () => { cancelled = true; };
  }, [selectedSubmission?.id]);

  // Date format helper: DD/MM/YYYY only (no time)
  const formatDateOnly = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  };

  // O4: Pre-build formId→Process lookup map (parse workflowFormsData once)
  const processLookupMap = useMemo(() => {
    const map = new Map<string, Process>();
    const idMap = new Map<string, Process>();
    for (const proc of processes) {
      if (proc.id === 'unlinked') continue;
      idMap.set(proc.id, proc);
      let wfd = proc.workflowFormsData;
      if (typeof wfd === 'string') {
        try { wfd = JSON.parse(wfd); } catch { continue; }
      }
      if (!wfd) continue;
      for (const [fName, fDataRaw] of Object.entries(wfd)) {
        const fData = fDataRaw as { formId?: string; formTitle?: string };
        map.set(fName.toLowerCase(), proc);
        if (fData.formId) map.set(fData.formId.toLowerCase(), proc);
        if (fData.formTitle) map.set(fData.formTitle.toLowerCase(), proc);
      }
    }
    // Also index by process ID for fallback
    for (const [id, proc] of idMap) map.set(`__pid__${id}`, proc);
    return map;
  }, [processes]);

  // Find linked Process object — O(1) via lookup map
  const getLinkedProcess = (procId: string, formId?: string): Process | null => {
    if (formId) {
      const found = processLookupMap.get(formId.toLowerCase());
      if (found) return found;
    }
    if (procId && procId !== 'unlinked') {
      return processLookupMap.get(`__pid__${procId}`) || null;
    }
    return null;
  };

  // Map process ID to display title
  const getProcessTitle = (procId: string, formId?: string) => {
    const p = getLinkedProcess(procId, formId);
    return p ? p.title : 'Biểu mẫu tự do';
  };

  // Toggle group accordion
  const toggleGroup = (formKey: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [formKey]: !prev[formKey]
    }));
  };

  // Open FormFiller to create a new submission record for this form
  const handleFillNewRecord = (group: { processId: string; formId: string }) => {
    if (onOpenFormFiller) {
      onOpenFormFiller(group.processId, group.formId);
    } else {
      setFillingForm({ processId: group.processId, formName: group.formId });
    }
  };

  // Format version to avoid double 'v' (e.g. vv0.2 -> v0.2)
  const formatVersion = (v?: string) => {
    if (!v) return '';
    const clean = v.replace(/^[vV]+/, '').trim();
    return clean ? `v${clean}` : '';
  };

  // 2. Filter logic
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      const linkedProc = getLinkedProcess(sub.processId, sub.formId);
      const procId = linkedProc ? linkedProc.id : 'unlinked';
      const procTitle = linkedProc ? linkedProc.title : 'Biểu mẫu tự do';

      // 1. Process filter
      if (processFilter !== 'ALL') {
        if (processFilter === 'unlinked') {
          if (procId !== 'unlinked') return false;
        } else {
          if (procId !== processFilter) return false;
        }
      }

      // 2. Signoff filter
      if (signoffFilter === 'PENDING' && sub.supervisorSignoff) return false;
      if (signoffFilter === 'VERIFIED' && !sub.supervisorSignoff) return false;

      // 3. Search text
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const opId = (sub.operatorId || '').toLowerCase();
        const subId = (sub.id || '').toLowerCase();
        const fId = (sub.formId || '').toLowerCase();
        const pTitle = procTitle.toLowerCase();
        const match = subId.includes(term) || opId.includes(term) || fId.includes(term) || pTitle.includes(term);
        if (!match) return false;
      }

      return true;
    });
  }, [submissions, processes, processFilter, signoffFilter, searchTerm]);

  // Form Group Model
  interface FormGroup {
    formKey: string;
    formId: string;
    formTitle: string;
    formVersion: string;
    processId: string;
    processTitle: string;
    submissions: Submission[];
    pendingCount: number;
    verifiedCount: number;
  }

  // 3. Group filtered submissions by Form Template
  const formGroups = useMemo<FormGroup[]>(() => {
    const map = new Map<string, FormGroup>();

    for (const sub of filteredSubmissions) {
      const key = sub.formId || 'unknown_form';
      let group = map.get(key);
      if (!group) {
        const linkedProc = getLinkedProcess(sub.processId, sub.formId);
        group = {
          formKey: key,
          formId: sub.formId || 'Unknown',
          formTitle: sub.formId || 'Biểu mẫu tự do',
          formVersion: sub.formVersion || '1.0',
          processId: linkedProc ? linkedProc.id : (sub.processId || 'unlinked'),
          processTitle: linkedProc ? linkedProc.title : 'Biểu mẫu tự do',
          submissions: [],
          pendingCount: 0,
          verifiedCount: 0
        };
        map.set(key, group);
      }
      group.submissions.push(sub);
      if (sub.supervisorSignoff) {
        group.verifiedCount++;
      } else {
        group.pendingCount++;
      }
    }

    // Sort submissions inside each group (newest first)
    for (const grp of map.values()) {
      grp.submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }

    // Sort groups by newest submission date
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.submissions[0] ? new Date(a.submissions[0].submittedAt).getTime() : 0;
      const bTime = b.submissions[0] ? new Date(b.submissions[0].submittedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredSubmissions, processes]);

  // 3. Supervisor sign-off handler
  const handleSignOffSubmit = async (subId: string) => {
    if (!supervisorName.trim()) {
      setToast({ message: 'Vui lòng nhập họ tên người ký xác nhận.', type: 'error' });
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
      
      setToast({ message: 'Đã ký xác nhận bản ghi thành công!', type: 'success' });
      
      // Update local state
      setSubmissions(prev => prev.map(sub => sub.id === subId ? { ...sub, supervisorSignoff: signoffData } : sub));
      if (selectedSubmission && selectedSubmission.id === subId) {
        setSelectedSubmission(prev => prev ? { ...prev, supervisorSignoff: signoffData } : null);
      }
      
      setVerificationNotes('');
    } catch (err) {
      console.error(err);
      setToast({ message: 'Lỗi khi ký xác nhận bản ghi.', type: 'error' });
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
      setToast({ message: 'Đã xóa bản ghi phiếu thành công!', type: 'success' });
      await fetchData();
    } catch (err) {
      console.error(err);
      setToast({ message: 'Lỗi khi xóa bản ghi phiếu.', type: 'error' });
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
        editSubmissionId={viewingSubmission.id}
        editToken={viewingSubmission.accessToken || (viewingSubmission as any).access_token}
        canEditSubmission={!viewingSubmission.supervisorSignoff}
        readOnly={true}
        onOpenReportBuilder={onOpenReportBuilder}
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

  // Direct Fill Form mode render bypass
  if (fillingForm) {
    return (
      <FormFiller
        processId={fillingForm.processId}
        formName={fillingForm.formName}
        onOpenReportBuilder={onOpenReportBuilder}
        onBack={() => {
          setFillingForm(null);
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
            onClick={() => fetchData()}
            style={{ fontSize: '0.85rem' }}
          >
            Refresh Logs
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        {/* Filters & Actions Toolbar (rendered only if not hoisted by parent Dashboard frame) */}
        {!hideToolbar && (
          <DashboardToolbar
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
            placeholder="Search submissions by ID, operator, or form..."
            filters={
              <>
                {/* Process Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Process:</span>
                  <select 
                    value={processFilter}
                    onChange={(e) => setProcessFilter(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', background: '#fff', maxWidth: '200px' }}
                  >
                    <option value="ALL">All Processes</option>
                    {processes.filter(p => p.id !== 'unlinked').map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                    <option value="unlinked">Standalone Forms</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
                  <select 
                    value={signoffFilter}
                    onChange={(e) => setSignoffFilter(e.target.value as any)}
                    style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', background: '#fff' }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                </div>
              </>
            }
          />
        )}

        {/* Submissions Grouped by Form Template */}
        {loading ? (
          <div className="paper-card" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0 }}>Đang tải nhật ký phiếu kiểm tra...</p>
          </div>
        ) : fetchError && submissions.length === 0 ? (
          <div className="paper-card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <AlertTriangle size={32} style={{ color: 'var(--danger)', margin: '0 auto 0.75rem', display: 'block' }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
              Không thể kết nối đến máy chủ để tải dữ liệu
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Vui lòng kiểm tra đường truyền hoặc bấm thử lại.
            </p>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => fetchData()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              Thử lại
            </button>
          </div>
        ) : formGroups.length === 0 ? (
          <div className="paper-card" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>Không có bản ghi nào khớp với điều kiện lọc</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Thử đổi từ khóa tìm kiếm hoặc chọn "Tất cả quy trình".</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formGroups.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.formKey]);

              return (
                <div 
                  key={group.formKey} 
                  className="paper-card"
                  style={{ padding: 0, overflow: 'visible', borderRadius: '8px', border: '1px solid var(--neutral-border)' }}
                >
                  {/* Group Accordion Header */}
                  <div 
                    onClick={() => toggleGroup(group.formKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      background: '#f8fafc',
                      borderBottom: isCollapsed ? 'none' : '1px solid var(--neutral-border)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderTopLeftRadius: '8px',
                      borderTopRightRadius: '8px',
                      borderBottomLeftRadius: isCollapsed ? '8px' : '0',
                      borderBottomRightRadius: isCollapsed ? '8px' : '0',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                      <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileText size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {group.formTitle}
                        </span>
                        {group.formVersion && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            {formatVersion(group.formVersion)}
                          </span>
                        )}
                      </div>

                      <span style={{ color: '#cbd5e1' }}>•</span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <span>Quy trình:</span>
                        <span style={{ 
                          fontWeight: 600, 
                          color: group.processId === 'unlinked' ? 'var(--text-muted)' : 'var(--primary)',
                          background: group.processId === 'unlinked' ? '#f1f5f9' : '#f0fdf4',
                          padding: '0.12rem 0.45rem',
                          borderRadius: '4px',
                          border: `1px solid ${group.processId === 'unlinked' ? '#e2e8f0' : '#bbf7d0'}`
                        }}>
                          {group.processTitle}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleFillNewRecord(group)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.78rem',
                          padding: '0.3rem 0.65rem',
                          background: '#ffffff',
                          fontWeight: 600,
                          borderColor: '#bae6fd',
                          color: '#0284c7'
                        }}
                        title="Điền phiếu mới cho biểu mẫu này"
                      >
                        <PenTool size={13} />
                        <span>Điền phiếu mới</span>
                      </button>
                    </div>
                  </div>

                  {/* Group Submissions Table */}
                  {!isCollapsed && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--neutral-border)', background: '#fafbfc', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            <th style={{ width: '18%', padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Record ID</th>
                            <th style={{ width: '18%', padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Date</th>
                            <th style={{ width: '26%', padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Operator</th>
                            <th style={{ width: '18%', padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>Status</th>
                            <th style={{ width: '20%', padding: '0.6rem 0.75rem', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.submissions.map((sub) => {
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
                                {/* Cột 1: Mã phiếu */}
                                <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                                  <span style={{ 
                                    fontWeight: 600, 
                                    fontFamily: 'monospace', 
                                    fontSize: '0.82rem',
                                    color: 'var(--text-primary)',
                                    background: '#f1f5f9',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                    #{sub.id}
                                  </span>
                                </td>

                                {/* Cột 2: Ngày */}
                                <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', verticalAlign: 'middle', fontSize: '0.82rem', fontWeight: 500 }}>
                                  {formatDateOnly(sub.submittedAt)}
                                </td>

                                {/* Cột 3: Người lập */}
                                <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                    {sub.operatorId}
                                  </span>
                                </td>

                                {/* Cột 4: Trạng thái */}
                                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                  {sub.supervisorSignoff ? (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '12px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      background: '#ecfdf5',
                                      color: '#059669',
                                      border: '1px solid #a7f3d0'
                                    }}>
                                      <CheckCircle2 size={12} />
                                      <span>Đã xác nhận</span>
                                    </span>
                                  ) : (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '12px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      background: '#fffbeb',
                                      color: '#d97706',
                                      border: '1px solid #fde68a'
                                    }}>
                                      <Clock size={12} />
                                      <span>Chờ duyệt</span>
                                    </span>
                                  )}
                                </td>

                                {/* Cột 5: Thao tác */}
                                <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      title={sub.supervisorSignoff ? "Xem chi tiết phiếu" : "Xem chi tiết & Ký duyệt"}
                                      onClick={() => setSelectedSubmission(sub)}
                                      style={{ padding: 0, width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                    >
                                      <Eye size={13} style={{ color: !sub.supervisorSignoff ? 'var(--primary)' : undefined }} />
                                    </button>

                                    {onOpenReport && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        title="Xem Báo cáo Đánh giá (Record Report)"
                                        onClick={() => onOpenReport(sub.id)}
                                        style={{ padding: 0, width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                      >
                                        <FileText size={13} />
                                      </button>
                                    )}

                                    {/* Action Dropdown Menu */}
                                    <div style={{ position: 'relative' }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        title="Thao tác khác"
                                        onClick={() => setActiveActionMenuId(prev => prev === sub.id ? null : sub.id)}
                                        style={{ padding: 0, width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                                      >
                                        <MoreHorizontal size={14} />
                                      </button>

                                      {activeActionMenuId === sub.id && (
                                        <div 
                                          style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: '100%',
                                            marginTop: '4px',
                                            background: '#ffffff',
                                            borderRadius: '6px',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                                            border: '1px solid var(--neutral-border)',
                                            zIndex: 100,
                                            minWidth: '180px',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column'
                                          }}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setViewingSubmission(sub);
                                              setActiveActionMenuId(null);
                                            }}
                                            style={{
                                              padding: '0.5rem 0.75rem',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.5rem',
                                              fontSize: '0.78rem',
                                              border: 'none',
                                              background: 'transparent',
                                              cursor: 'pointer',
                                              color: 'var(--text-primary)',
                                              textAlign: 'left',
                                              width: '100%'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                          >
                                            <Eye size={13} style={{ color: 'var(--primary)' }} />
                                            <span>Xem toàn văn Web</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCopyingSubmission(sub);
                                              setActiveActionMenuId(null);
                                            }}
                                            style={{
                                              padding: '0.5rem 0.75rem',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.5rem',
                                              fontSize: '0.78rem',
                                              border: 'none',
                                              background: 'transparent',
                                              cursor: 'pointer',
                                              color: 'var(--text-primary)',
                                              textAlign: 'left',
                                              width: '100%'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                          >
                                            <Copy size={13} />
                                            <span>Sao chép tạo phiếu</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={async () => {
                                              setActiveActionMenuId(null);
                                              const full = await fetchFullSubmission(sub);
                                              setPrintSubmission(full);
                                            }}
                                            style={{
                                              padding: '0.5rem 0.75rem',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.5rem',
                                              fontSize: '0.78rem',
                                              border: 'none',
                                              background: 'transparent',
                                              cursor: 'pointer',
                                              color: 'var(--text-primary)',
                                              textAlign: 'left',
                                              width: '100%'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                          >
                                            <Printer size={13} />
                                            <span>In biểu mẫu A4</span>
                                          </button>

                                          {currentUser?.role_id === 'admin' && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSubmissionToDelete(sub);
                                                setActiveActionMenuId(null);
                                              }}
                                              style={{
                                                padding: '0.5rem 0.75rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.78rem',
                                                border: 'none',
                                                borderTop: '1px solid var(--neutral-border)',
                                                background: 'transparent',
                                                cursor: 'pointer',
                                                color: '#ef4444',
                                                textAlign: 'left',
                                                width: '100%'
                                              }}
                                              onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                              <Trash2 size={13} />
                                              <span>Xóa bản ghi (Admin)</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
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
                  onClick={async () => {
                    if (selectedSubmission) {
                      const full = selectedSubmission.formData.length > 0 ? selectedSubmission : await fetchFullSubmission(selectedSubmission);
                      setPrintSubmission(full);
                    }
                  }}
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

      {/* Floating Toast Notification */}
      {toast && (
        <div 
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1.1rem',
            background: toast.type === 'success' ? '#065f46' : '#991b1b',
            color: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            fontSize: '0.85rem',
            fontWeight: 500,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              marginLeft: '0.5rem',
              padding: 0,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <XCircle size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
