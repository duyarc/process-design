import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { Submission, Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  CheckCircle2,
  XCircle,
  UserCheck,
  Trash2,
  FileText,
  FilePlus,
  BarChart2,
  Copy,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Share2,
  RotateCcw
} from 'lucide-react';
import PrintFilledForm from './print/PrintFilledForm';
import ConfirmModal from './common/ConfirmModal';
import FormFiller from './FormFiller';
import DashboardToolbar from './common/DashboardToolbar';
import { toFormSlug } from '../utils/formUtils';

interface SubmissionManagerProps {
  onBack?: () => void;
  initialFormFilter?: string | null;
  isEmbedded?: boolean;
  layoutMode?: 'grid' | 'list';
  cachedProcesses?: Process[];
  cachedForms?: any[];
  hideToolbar?: boolean;
  headerSlot?: React.ReactNode;
  externalSearchTerm?: string;
  externalProcessFilter?: string;
  externalSignoffFilter?: 'ALL' | 'PENDING' | 'VERIFIED';
  onOpenReport?: (submissionId: string) => void;
  onOpenReportBuilder?: (formId: string) => void;
  onViewingChange?: (isViewing: boolean) => void;
  onOpenFormFiller?: (processId: string, formName: string) => void;
  onTrashChanged?: () => void;
}

export default function SubmissionManager({ 
  onBack, 
  initialFormFilter, 
  isEmbedded = false, 
  cachedProcesses,
  cachedForms,
  hideToolbar = false,
  headerSlot,
  externalSearchTerm,
  externalProcessFilter,
  externalSignoffFilter,
  onOpenReport, 
  onOpenReportBuilder, 
  onViewingChange, 
  onOpenFormFiller,
  onTrashChanged
}: SubmissionManagerProps) {
  const { currentUser, hasPermission } = useAuth();
  const canVerify = hasPermission('verify_records') || currentUser?.role_id === 'admin' || currentUser?.role_id === 'supervisor';
  
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
  const [forms] = useState<any[]>(() => {
    if (cachedForms && cachedForms.length > 0) return cachedForms;
    try {
      const cached = sessionStorage.getItem('swr_forms');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [loading, setLoading] = useState(() => {
    try { return !sessionStorage.getItem('swr_submissions'); }
    catch { return true; }
  });
  
  // Unified Full Form View & Verification State
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);

  // Print Mode State
  const [printSubmission, setPrintSubmission] = useState<Submission | null>(null);

  // Copy / Clone Submission State
  const [copyingSubmission, setCopyingSubmission] = useState<Submission | null>(null);

  // Direct Fill Form State (from group header)
  const [fillingForm, setFillingForm] = useState<{ processId: string; formName: string } | null>(null);

  // Group Accordion Collapse State (formKey -> boolean, persisted in localStorage)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('submissions_collapsed_forms');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Portal Overflow Menu for row actions
  const [rowActionMenu, setRowActionMenu] = useState<{
    sub: Submission;
    top: number;
    right: number;
    openUpward: boolean;
  } | null>(null);

  useEffect(() => {
    if (!rowActionMenu) return;
    const dismiss = () => setRowActionMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('click', dismiss);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [rowActionMenu]);

  const openRowActionMenu = (e: React.MouseEvent<HTMLButtonElement>, sub: Submission) => {
    e.stopPropagation();
    if (rowActionMenu?.sub.id === sub.id) {
      setRowActionMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const openUpward = window.innerHeight - rect.bottom < 160;
    setRowActionMenu({
      sub,
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
      openUpward
    });
  };

  const ghostActionBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    margin: 0,
    border: 'none',
    borderRadius: '6px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease'
  };

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; undoId?: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Copy shareable link to form
  const handleShareLink = (group: FormGroup) => {
    const slug = toFormSlug(group.formTitle) || group.formId;
    const shareUrl = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setToast({ message: 'Form share link copied to clipboard.', type: 'success' });
      })
      .catch(() => {
        setToast({ message: 'Unable to copy form share link.', type: 'error' });
      });
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undoId ? 5000 : 4000);
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
        setToast({ message: 'Unable to load submissions log. Retrying...', type: 'error' });
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

  // Open full WYSIWYG form view & verification directly
  const handleOpenSubmission = async (sub: Submission) => {
    const full = sub.formData.length > 0 ? sub : await fetchFullSubmission(sub);
    setViewingSubmission(full);
  };

  // Duplicate record with full formData loaded
  const handleDuplicateSubmission = async (sub: Submission) => {
    const full = sub.formData.length > 0 ? sub : await fetchFullSubmission(sub);
    setCopyingSubmission(full);
  };

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

  // Form ID -> Display Title lookup from cached forms
  const formMetaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of forms || []) {
      const title = f.form_title || f.formTitle || f.form_name || '';
      if (!title) continue;
      const keys = [f.form_id, f.formId, f.formName].filter(Boolean);
      for (const k of keys) {
        const keyLower = String(k).toLowerCase();
        if (!map.has(keyLower)) map.set(keyLower, title);
      }
    }
    return map;
  }, [forms]);

  // Toggle group accordion
  const toggleGroup = (formKey: string) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [formKey]: !prev[formKey] };
      try {
        localStorage.setItem('submissions_collapsed_forms', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const toggleAllGroups = (keys: string[], collapse: boolean) => {
    setCollapsedGroups(prev => {
      const next = { ...prev };
      keys.forEach(k => {
        next[k] = collapse;
      });
      try {
        localStorage.setItem('submissions_collapsed_forms', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
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
      const procTitle = linkedProc ? linkedProc.title : 'Standalone Form';

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
        const fTitle = (formMetaMap.get(fId) || '').toLowerCase();
        const pTitle = procTitle.toLowerCase();
        const match =
          subId.includes(term) ||
          opId.includes(term) ||
          fId.includes(term) ||
          fTitle.includes(term) ||
          pTitle.includes(term);
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
        const resolvedTitle = formMetaMap.get(key.toLowerCase()) || sub.formId || 'Standalone Form';
        group = {
          formKey: key,
          formId: sub.formId || 'Unknown',
          formTitle: resolvedTitle,
          formVersion: sub.formVersion || '1.0',
          processId: linkedProc ? linkedProc.id : (sub.processId || 'unlinked'),
          processTitle: linkedProc ? linkedProc.title : 'Standalone Form',
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

    // If a filter is active, include matching known forms even if 0 submissions
    const activeFilterTerm = (searchTerm || initialFormFilter || '').trim().toLowerCase();
    if (activeFilterTerm && forms && forms.length > 0) {
      for (const f of forms) {
        const fId = (f.formId || f.formName || '').toLowerCase();
        const fTitle = (f.formTitle || f.formName || '').toLowerCase();
        const key = f.formId || f.formName || 'unknown_form';
        if ((fId.includes(activeFilterTerm) || fTitle.includes(activeFilterTerm)) && !map.has(key)) {
          const linkedProc = f.linkedProcesses?.[0];
          map.set(key, {
            formKey: key,
            formId: f.formId || f.formName || 'Unknown',
            formTitle: f.formTitle || f.form_title || f.formName || 'Form',
            formVersion: f.version || '0.1',
            processId: linkedProc ? linkedProc.id : 'unlinked',
            processTitle: linkedProc ? linkedProc.title : 'Standalone Form',
            submissions: [],
            pendingCount: 0,
            verifiedCount: 0
          });
        }
      }
    }

    // Sort groups by newest submission date
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.submissions[0] ? new Date(a.submissions[0].submittedAt).getTime() : 0;
      const bTime = b.submissions[0] ? new Date(b.submissions[0].submittedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredSubmissions, processes, forms, formMetaMap, searchTerm, initialFormFilter]);

  // 3. Supervisor sign-off handler
  const handleSignOffSubmit = async (subId: string) => {
    if (!supervisorName.trim()) {
      setToast({ message: 'Please enter supervisor signature name.', type: 'error' });
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
      
      setToast({ message: 'Record verified and signed off.', type: 'success' });
      
      // Update local state & active FormFiller preview
      setSubmissions(prev => {
        const next = prev.map(sub => sub.id === subId ? { ...sub, supervisorSignoff: signoffData } : sub);
        try { sessionStorage.setItem('swr_submissions', JSON.stringify(next)); } catch (_) {}
        return next;
      });
      if (viewingSubmission && viewingSubmission.id === subId) {
        setViewingSubmission(prev => prev ? { ...prev, supervisorSignoff: signoffData } : null);
      }
      
      setVerificationNotes('');
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error verifying record.', type: 'error' });
    } finally {
      setSigningOff(false);
    }
  };

  // Delete submission record handler (soft delete -> Trash, preserves R2 media)
  const handleDeleteSubmission = async () => {
    if (!submissionToDelete) return;
    const targetId = submissionToDelete.id;
    const actor = currentUser?.full_name || currentUser?.username || '';
    const qs = actor ? `?deletedBy=${encodeURIComponent(actor)}` : '';
    try {
      setDeleting(true);
      const res = await fetch(`/api/submissions/${encodeURIComponent(targetId)}${qs}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete submission');

      setSubmissions(prev => {
        const next = prev.filter(s => s.id !== targetId);
        try { sessionStorage.setItem('swr_submissions', JSON.stringify(next)); } catch (_) {}
        return next;
      });
      setSubmissionToDelete(null);
      onTrashChanged?.();
      setToast({ message: `Moved record ${targetId} to Trash.`, type: 'success', undoId: targetId });
      await fetchData(true);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error moving record to Trash.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleUndoDeleteSubmission = async () => {
    const undoId = toast?.undoId;
    if (!undoId) return;
    try {
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'submission', id: undoId })
      });
      if (!res.ok) throw new Error('Unable to undo delete');
      setToast({ message: 'Record restored successfully.', type: 'success' });
      onTrashChanged?.();
      await fetchData(true);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error restoring record.', type: 'error' });
    }
  };

  // Unified Full WYSIWYG Form Viewer & Supervisor QMS Verification
  if (viewingSubmission) {
    return (
      <>
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
            fetchData(true);
          }}
        />

        {(viewingSubmission.supervisorSignoff || canVerify) && (
          <div
            className="paper-card no-print"
            style={{
              maxWidth: '820px',
              margin: '1rem auto 2rem auto',
              padding: '1.1rem 1.5rem',
              border: '1px solid var(--neutral-border)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--neutral-border)' }}>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <UserCheck size={14} style={{ color: 'var(--primary)' }} />
                <span>Supervisor QMS Verification</span>
              </h4>
              {viewingSubmission.supervisorSignoff ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                  <CheckCircle2 size={12} />
                  <span>Verified & Sealed</span>
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#b45309' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                  <span>Pending Review</span>
                </span>
              )}
            </div>

            {viewingSubmission.supervisorSignoff ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.5rem', alignItems: 'center' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Verified by: </span>
                  <strong>{viewingSubmission.supervisorSignoff.signedBy}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Date: </span>
                  <span>{new Date(viewingSubmission.supervisorSignoff.signedAt).toLocaleString('en-GB')}</span>
                </div>
                {viewingSubmission.supervisorSignoff.notes && (
                  <div style={{ width: '100%', background: '#f8fafc', padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--neutral-border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong>Notes:</strong> {viewingSubmission.supervisorSignoff.notes}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1.5fr) auto', gap: '0.65rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Supervisor Signature Name *</label>
                  <input
                    type="text"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    placeholder="Enter supervisor name"
                    style={{ height: '34px', padding: '0 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Review Notes (optional)</label>
                  <input
                    type="text"
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    placeholder="Review observations..."
                    style={{ height: '34px', padding: '0 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px' }}
                  />
                </div>
                <button
                  type="button"
                  disabled={signingOff}
                  onClick={() => handleSignOffSubmit(viewingSubmission.id)}
                  className="btn btn-primary btn-sm"
                  style={{ height: '34px', padding: '0 1rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', margin: 0, whiteSpace: 'nowrap' }}
                >
                  <CheckCircle size={14} />
                  <span>{signingOff ? 'Signing off...' : 'Verify & Sign Off'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {toast && (
          <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1.1rem', background: toast.type === 'success' ? '#065f46' : '#991b1b', color: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)', fontSize: '0.85rem', fontWeight: 500 }}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
            <button type="button" onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', marginLeft: '0.5rem', padding: 0, display: 'flex', alignItems: 'center' }}>
              <XCircle size={16} />
            </button>
          </div>
        )}
      </>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {(() => {
          const effectiveToolbar = headerSlot ?? (!hideToolbar ? (
            <DashboardToolbar
              embedded
              searchQuery={searchTerm}
              onSearchChange={setSearchTerm}
              placeholder="Search submissions..."
              filters={
                <>
                  <select
                    aria-label="Filter by process"
                    value={processFilter}
                    onChange={(e) => setProcessFilter(e.target.value)}
                    style={{ height: '36px', padding: '0 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', background: '#fff', maxWidth: '200px', boxSizing: 'border-box', outline: 'none' }}
                  >
                    <option value="ALL">All Processes</option>
                    {processes.filter(p => p.id !== 'unlinked').map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                    <option value="unlinked">Standalone Forms</option>
                  </select>

                  <select
                    aria-label="Filter by review status"
                    value={signoffFilter}
                    onChange={(e) => setSignoffFilter(e.target.value as any)}
                    style={{ height: '36px', padding: '0 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                </>
              }
            />
          ) : null);

          const hasActiveFilter = Boolean(searchTerm.trim() || signoffFilter !== 'ALL' || initialFormFilter);
          const expandableKeys = !hasActiveFilter ? formGroups.map(g => g.formKey) : [];
          const allExpandableCollapsed =
            expandableKeys.length > 0 && expandableKeys.every(k => Boolean(collapsedGroups[k]));

          return (
            <div
              className="paper-card accent-teal"
              style={{
                padding: 0,
                overflow: 'hidden',
                borderRadius: '8px',
                border: '1px solid var(--neutral-border)',
                marginBottom: 0
              }}
            >
              {effectiveToolbar}

              {initialFormFilter && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 1rem',
                    background: '#f8fafc',
                    borderBottom: '1px solid var(--neutral-border)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                    <span>Filtered by form:</span>
                    <strong style={{ color: 'var(--primary)' }}>{initialFormFilter}</strong>
                  </div>
                  {onBack && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSearchTerm('');
                        onBack();
                      }}
                      style={{
                        padding: '0.15rem 0.55rem',
                        fontSize: '0.75rem',
                        height: '26px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        margin: 0
                      }}
                    >
                      <XCircle size={13} />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              )}

              {loading ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ margin: 0 }}>Loading submissions log...</p>
                </div>
              ) : fetchError && submissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <AlertTriangle size={32} style={{ color: 'var(--danger)', margin: '0 auto 0.75rem', display: 'block' }} />
                  <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Unable to connect to server to load data
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Please check your connection or click retry.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => fetchData()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    Retry
                  </button>
                </div>
              ) : formGroups.length === 0 ? (
                <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem', display: 'block', opacity: 0.5 }} />
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No Submissions Found</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Try clearing the search filter or selecting &quot;All Processes&quot;.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--neutral-border)', background: '#fafbfc', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                        <th style={{ padding: '0.6rem 0.5rem 0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '16%' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {expandableKeys.length > 0 ? (
                              <button
                                type="button"
                                title={allExpandableCollapsed ? 'Expand all' : 'Collapse all'}
                                onClick={() => toggleAllGroups(expandableKeys, !allExpandableCollapsed)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '18px',
                                  height: '18px',
                                  padding: 0,
                                  margin: 0,
                                  border: 'none',
                                  borderRadius: '4px',
                                  background: 'transparent',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                              >
                                {allExpandableCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                              </button>
                            ) : (
                              <span style={{ width: '18px', display: 'inline-block', flexShrink: 0 }} />
                            )}
                            <span>ID</span>
                          </div>
                        </th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '49%' }}>Title</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '11%' }}>Version</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '12%' }}>Submitted</th>
                        <th style={{ padding: '0.6rem 1rem 0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, width: '12%' }} aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {formGroups.map((group, gIdx) => {
                        const isExpanded = hasActiveFilter ? true : !collapsedGroups[group.formKey];
                        const isLastGroup = gIdx === formGroups.length - 1;
                        const rowPadTop = isExpanded ? '0.8rem' : '0.75rem';
                        const rowPadBottom = isExpanded ? '0.45rem' : '0.75rem';
                        const latestSubmitted = group.submissions[0]
                          ? formatDateOnly(group.submissions[0].submittedAt)
                          : '—';

                        return (
                          <React.Fragment key={group.formKey}>
                            <tr
                              className="dashboard-tree-row"
                              onClick={() => toggleGroup(group.formKey)}
                              style={{
                                borderBottom: isExpanded
                                  ? 'none'
                                  : isLastGroup
                                    ? 'none'
                                    : '1px solid var(--neutral-border)',
                                cursor: 'pointer'
                              }}
                            >
                              <td style={{ padding: `${rowPadTop} 0.5rem ${rowPadBottom} 0.75rem`, verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span
                                    aria-label={isExpanded ? 'Collapse submissions' : 'Expand submissions'}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '18px',
                                      height: '18px',
                                      color: 'var(--text-muted)',
                                      flexShrink: 0
                                    }}
                                  >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </span>
                                  <span
                                    title={group.formId}
                                    style={{
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      color: 'var(--text-muted)',
                                      fontFamily: 'monospace',
                                      maxWidth: '130px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {group.formId}
                                  </span>
                                </div>
                              </td>

                              <td style={{ padding: `${rowPadTop} 0.75rem ${rowPadBottom} 0.75rem`, verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                                    {group.formTitle}
                                  </span>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      height: '18px',
                                      padding: '0 0.42rem',
                                      borderRadius: '999px',
                                      background: '#f1f5f9',
                                      color: 'var(--text-muted)',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      fontVariantNumeric: 'tabular-nums'
                                    }}
                                  >
                                    {group.submissions.length}
                                  </span>
                                  {group.processId !== 'unlinked' && (
                                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                      · {group.processTitle}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td style={{ padding: `${rowPadTop} 0.75rem ${rowPadBottom} 0.75rem`, textAlign: 'left', verticalAlign: 'middle' }}>
                                <div
                                  title={group.pendingCount > 0 ? `${group.pendingCount} pending review` : undefined}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontSize: '0.78rem',
                                    fontWeight: 500,
                                    color: 'var(--text-secondary)',
                                    fontVariantNumeric: 'tabular-nums'
                                  }}
                                >
                                  <span
                                    aria-label={group.pendingCount > 0 ? 'Pending review' : undefined}
                                    style={{
                                      width: '7px',
                                      height: '7px',
                                      borderRadius: '50%',
                                      border: group.pendingCount > 0 ? '1.5px solid var(--warning)' : '1.5px solid transparent',
                                      background: 'transparent',
                                      boxSizing: 'border-box',
                                      flexShrink: 0
                                    }}
                                  />
                                  <span>{formatVersion(group.formVersion) || 'v1.0'}</span>
                                </div>
                              </td>

                              <td style={{ padding: `${rowPadTop} 0.75rem ${rowPadBottom} 0.75rem`, textAlign: 'left', verticalAlign: 'middle', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
                                {latestSubmitted}
                              </td>

                              <td
                                style={{ padding: `${isExpanded ? '0.68rem' : '0.62rem'} 1rem ${isExpanded ? '0.32rem' : '0.62rem'} 0.75rem`, textAlign: 'right', verticalAlign: 'middle' }}
                                onClick={e => e.stopPropagation()}
                              >
                                <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <span className="dashboard-row-reveal">
                                    <button
                                      type="button"
                                      title="Share"
                                      onClick={() => handleShareLink(group)}
                                      style={ghostActionBtnStyle}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    >
                                      <Share2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Fill"
                                      onClick={() => handleFillNewRecord(group)}
                                      style={ghostActionBtnStyle}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#f0fdfa'; e.currentTarget.style.color = 'var(--primary)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    >
                                      <FilePlus size={14} />
                                    </button>
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              group.submissions.length === 0 ? (
                                <tr
                                  className="dashboard-form-subrow"
                                  style={{ borderBottom: isLastGroup ? 'none' : '1px solid var(--neutral-border)' }}
                                >
                                  <td className="dashboard-subrow-cell-last" style={{ padding: '0.42rem 0.5rem 0.42rem 2.1rem' }} />
                                  <td className="dashboard-form-spine-cell is-first is-last">
                                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      No submissions yet.
                                    </span>
                                  </td>
                                  <td className="dashboard-subrow-cell-last" />
                                  <td className="dashboard-subrow-cell-last" />
                                  <td className="dashboard-subrow-cell-last" style={{ padding: '0.35rem 1rem 0.35rem 0.75rem', textAlign: 'right', verticalAlign: 'middle' }}>
                                    <button
                                      type="button"
                                      title="Fill"
                                      className="dashboard-fill-btn"
                                      onClick={() => handleFillNewRecord(group)}
                                    >
                                      Fill
                                    </button>
                                  </td>
                                </tr>
                              ) : (
                                group.submissions.map((sub, subIdx) => {
                                  const isFirstInGroup = subIdx === 0;
                                  const isLastInGroup = subIdx === group.submissions.length - 1;
                                  const isLastOverallRow = isLastGroup && isLastInGroup;
                                  const lastCellClass = isLastInGroup ? 'dashboard-subrow-cell-last' : undefined;
                                  const isMenuOpen = rowActionMenu?.sub.id === sub.id;
                                  const isPending = !sub.supervisorSignoff;

                                  return (
                                    <tr
                                      key={sub.id}
                                      className="dashboard-form-subrow"
                                      onClick={() => handleOpenSubmission(sub)}
                                      style={{
                                        borderBottom: isLastOverallRow
                                          ? 'none'
                                          : isLastInGroup
                                            ? '1px solid var(--neutral-border)'
                                            : 'none',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <td
                                        className={lastCellClass}
                                        style={{ padding: '0.42rem 0.5rem 0.42rem 2.1rem', verticalAlign: 'middle' }}
                                      >
                                        <span
                                          title={`#${sub.id}`}
                                          style={{
                                            fontSize: '0.73rem',
                                            fontWeight: 400,
                                            color: 'var(--text-muted)',
                                            opacity: 0.85,
                                            fontFamily: 'monospace',
                                            maxWidth: '130px',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            display: 'inline-block'
                                          }}
                                        >
                                          #{sub.id}
                                        </span>
                                      </td>

                                      <td className={`dashboard-form-spine-cell ${isFirstInGroup ? 'is-first' : ''} ${isLastInGroup ? 'is-last' : ''}`}>
                                        <span style={{ fontWeight: 400, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                                          {sub.operatorId}
                                        </span>
                                      </td>

                                      <td
                                        className={lastCellClass}
                                        style={{ padding: '0.42rem 0.75rem', textAlign: 'left', verticalAlign: 'middle' }}
                                      >
                                        <div
                                          title={
                                            isPending
                                              ? 'Pending review'
                                              : `Verified by ${sub.supervisorSignoff?.signedBy || 'Supervisor'}`
                                          }
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            fontSize: '0.78rem',
                                            fontWeight: 400,
                                            color: 'var(--text-muted)',
                                            fontVariantNumeric: 'tabular-nums'
                                          }}
                                        >
                                          <span
                                            aria-label={isPending ? 'Pending review' : undefined}
                                            style={{
                                              width: '7px',
                                              height: '7px',
                                              borderRadius: '50%',
                                              border: isPending ? '1.5px solid var(--warning)' : '1.5px solid transparent',
                                              background: 'transparent',
                                              boxSizing: 'border-box',
                                              flexShrink: 0
                                            }}
                                          />
                                          <span>{formatVersion(sub.formVersion || group.formVersion) || 'v1.0'}</span>
                                        </div>
                                      </td>

                                      <td
                                        className={lastCellClass}
                                        style={{ padding: '0.42rem 0.75rem', textAlign: 'left', verticalAlign: 'middle', fontSize: '0.76rem', fontWeight: 400, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
                                      >
                                        {formatDateOnly(sub.submittedAt)}
                                      </td>

                                      <td
                                        className={lastCellClass}
                                        style={{ padding: '0.35rem 1rem 0.35rem 0.75rem', textAlign: 'right', verticalAlign: 'middle' }}
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                          {isPending && canVerify ? (
                                            <>
                                              <button
                                                type="button"
                                                title="Verify"
                                                className="dashboard-fill-btn"
                                                onClick={() => handleOpenSubmission(sub)}
                                              >
                                                Verify
                                              </button>
                                              <span className={`dashboard-row-reveal ${isMenuOpen ? 'has-open-menu' : ''}`}>
                                                {onOpenReport && (
                                                  <button
                                                    type="button"
                                                    title="Report"
                                                    onClick={() => onOpenReport(sub.id)}
                                                    style={ghostActionBtnStyle}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                  >
                                                    <BarChart2 size={14} />
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  title="More"
                                                  className={`dashboard-more-trigger ${isMenuOpen ? 'is-open' : ''}`}
                                                  onClick={(e) => openRowActionMenu(e, sub)}
                                                  style={{
                                                    ...ghostActionBtnStyle,
                                                    background: isMenuOpen ? '#e2e8f0' : 'transparent',
                                                    color: isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)'
                                                  }}
                                                  onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                  onMouseLeave={e => {
                                                    e.currentTarget.style.background = isMenuOpen ? '#e2e8f0' : 'transparent';
                                                    e.currentTarget.style.color = isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)';
                                                  }}
                                                >
                                                  <MoreHorizontal size={15} />
                                                </button>
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              {onOpenReport && (
                                                <span className={`dashboard-row-reveal ${isMenuOpen ? 'has-open-menu' : ''}`}>
                                                  <button
                                                    type="button"
                                                    title="Report"
                                                    onClick={() => onOpenReport(sub.id)}
                                                    style={ghostActionBtnStyle}
                                                    onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                  >
                                                    <BarChart2 size={14} />
                                                  </button>
                                                </span>
                                              )}
                                              <button
                                                type="button"
                                                title="More"
                                                className={`dashboard-more-trigger ${isMenuOpen ? 'is-open' : ''}`}
                                                onClick={(e) => openRowActionMenu(e, sub)}
                                                style={{
                                                  ...ghostActionBtnStyle,
                                                  background: isMenuOpen ? '#e2e8f0' : 'transparent',
                                                  color: isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                onMouseLeave={e => {
                                                  e.currentTarget.style.background = isMenuOpen ? '#e2e8f0' : 'transparent';
                                                  e.currentTarget.style.color = isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)';
                                                }}
                                              >
                                                <MoreHorizontal size={15} />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Portal Overflow Menu for Submission Row Actions */}
      {rowActionMenu && ReactDOM.createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: rowActionMenu.openUpward ? undefined : `${rowActionMenu.top}px`,
            bottom: rowActionMenu.openUpward ? `${window.innerHeight - rowActionMenu.top}px` : undefined,
            right: `${rowActionMenu.right}px`,
            zIndex: 9998,
            minWidth: '176px',
            background: '#ffffff',
            border: '1px solid var(--neutral-border)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.05)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
        >
          <button
            type="button"
            onClick={() => {
              const target = rowActionMenu.sub;
              setRowActionMenu(null);
              handleDuplicateSubmission(target);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.45rem 0.65rem',
              border: 'none',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Copy size={13} style={{ color: 'var(--text-secondary)' }} />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const target = rowActionMenu.sub;
              setRowActionMenu(null);
              const full = await fetchFullSubmission(target);
              setPrintSubmission(full);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.45rem 0.65rem',
              border: 'none',
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              textAlign: 'left',
              cursor: 'pointer'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Printer size={13} style={{ color: 'var(--text-secondary)' }} />
            <span>Print</span>
          </button>

          {currentUser?.role_id === 'admin' && (
            <>
              <div style={{ height: '1px', background: 'var(--neutral-border)', margin: '3px 4px' }} />
              <button
                type="button"
                onClick={() => {
                  const target = rowActionMenu.sub;
                  setRowActionMenu(null);
                  setSubmissionToDelete(target);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'transparent',
                  color: 'var(--danger, #dc2626)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={!!submissionToDelete}
        title="Delete record?"
        message={
          submissionToDelete ? (
            <div>
              This submission will be stored in <strong>Trash</strong> and can be restored anytime.
              <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}>
                <strong>ID:</strong> {submissionToDelete.id}<br />
                <strong>Operator:</strong> {submissionToDelete.operatorId}<br />
                <strong>Submitted:</strong> {new Date(submissionToDelete.submittedAt).toLocaleString('en-GB')}
              </div>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                * All attached photo evidence is preserved and can be restored anytime from Trash.
              </p>
            </div>
          ) : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="warning"
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
          {toast.undoId && (
            <button
              type="button"
              onClick={handleUndoDeleteSubmission}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.32)',
                color: '#ffffff',
                borderRadius: '5px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={12} />
              <span>Undo</span>
            </button>
          )}
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
