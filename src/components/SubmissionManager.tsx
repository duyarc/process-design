import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { Submission, Process } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  Printer, 
  Eye,
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

  // Group Accordion Collapse State (formKey -> boolean)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
                    <option value="ALL">All Statuses</option>
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
            <p style={{ margin: 0 }}>Loading submissions log...</p>
          </div>
        ) : fetchError && submissions.length === 0 ? (
          <div className="paper-card" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
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
          <div className="paper-card" style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>No submissions match your search criteria</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Try clearing the search filter or selecting "All Processes".</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(initialFormFilter || (searchTerm && onBack)) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.6rem 1rem',
                background: '#f8fafc',
                border: '1px solid var(--neutral-border)',
                borderRadius: '8px',
                fontSize: '0.82rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                  <span>Filtered by form:</span>
                  <strong style={{ color: 'var(--primary)' }}>{initialFormFilter || searchTerm}</strong>
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
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.75rem',
                      height: '26px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <XCircle size={13} />
                    <span>Show all forms</span>
                  </button>
                )}
              </div>
            )}

            {formGroups.map((group) => {
              const isCollapsed = Boolean(collapsedGroups[group.formKey]);

              return (
                <div 
                  key={group.formKey} 
                  className="paper-card accent-teal"
                  style={{
                    padding: 0,
                    overflow: 'visible',
                    borderRadius: '8px',
                    border: '1px solid var(--neutral-border)',
                    position: 'relative',
                    zIndex: 1
                  }}
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
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <FileText size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {group.formTitle}
                        </span>
                        {group.formTitle.toLowerCase() !== group.formId.toLowerCase() && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: '#ffffff', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 600 }}>
                            {group.formId}
                          </span>
                        )}
                        {group.formVersion && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                            {formatVersion(group.formVersion)}
                          </span>
                        )}
                      </div>

                      <span style={{ color: '#cbd5e1' }}>•</span>

                      <span style={{ 
                        fontSize: '0.76rem',
                        fontWeight: 600, 
                        color: group.processId === 'unlinked' ? 'var(--text-muted)' : 'var(--text-secondary)',
                        background: '#f1f5f9',
                        padding: '0.12rem 0.45rem',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {group.processTitle}
                      </span>

                      <span style={{ color: '#cbd5e1' }}>•</span>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {group.submissions.length} {group.submissions.length === 1 ? 'record' : 'records'}
                        </span>
                        {group.pendingCount > 0 && (
                          <span style={{ color: '#b45309', fontWeight: 600 }}>
                            • {group.pendingCount} pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleShareLink(group)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.78rem',
                          padding: '0.3rem 0.65rem',
                          background: '#ffffff',
                          fontWeight: 600,
                          borderColor: 'var(--neutral-border)',
                          color: 'var(--text-secondary)',
                          margin: 0
                        }}
                        title="Copy shareable form link"
                      >
                        <Share2 size={13} />
                        <span>Share Link</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleFillNewRecord(group)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.78rem',
                          padding: '0.3rem 0.7rem',
                          background: '#f0fdfa',
                          fontWeight: 600,
                          borderColor: 'rgba(16, 163, 163, 0.3)',
                          color: 'var(--primary)',
                          margin: 0
                        }}
                        title="Fill a new record for this form"
                      >
                        <FilePlus size={13} />
                        <span>Fill Form</span>
                      </button>
                    </div>
                  </div>

                  {/* Group Submissions Table */}
                  {!isCollapsed && (
                    group.submissions.length === 0 ? (
                      <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <FileText size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.4, display: 'block' }} />
                        <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          No submissions yet for this form.
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem' }}>
                          Click "Fill Form" above to record a new submission.
                        </p>
                      </div>
                    ) : (
                    <div style={{ overflow: 'visible' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--neutral-border)', background: '#fafbfc', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            <th style={{ width: '18%', padding: '0.6rem 0.75rem 0.6rem 1rem', textAlign: 'left', fontWeight: 600 }}>Record ID</th>
                            <th style={{ width: '16%', padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Date</th>
                            <th style={{ width: '30%', padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Operator</th>
                            <th style={{ width: '20%', padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                            <th style={{ width: '16%', padding: '0.6rem 1rem 0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.submissions.map((sub) => {
                            return (
                              <tr 
                                key={sub.id} 
                                style={{
                                  borderBottom: '1px solid var(--neutral-border)',
                                  background: 'transparent',
                                  transition: 'background 0.15s',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                onClick={() => handleOpenSubmission(sub)}
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

                                {/* Col 4: Status */}
                                <td style={{ padding: '0.65rem 0.75rem', textAlign: 'left', verticalAlign: 'middle' }}>
                                  {sub.supervisorSignoff ? (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.18rem 0.5rem',
                                      borderRadius: '12px',
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      background: '#f0fdf4',
                                      color: '#15803d',
                                      border: '1px solid #bbf7d0'
                                    }}>
                                      <CheckCircle2 size={12} />
                                      <span>Verified</span>
                                    </span>
                                  ) : (
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      fontSize: '0.78rem',
                                      fontWeight: 600,
                                      color: '#b45309'
                                    }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                                      <span>Pending Review</span>
                                    </span>
                                  )}
                                </td>

                                {/* Col 5: Actions (Ghost Cluster + Portal Menu) */}
                                <td style={{ padding: '0.55rem 1rem 0.55rem 0.75rem', textAlign: 'right', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button
                                      type="button"
                                      title={sub.supervisorSignoff ? 'View record' : 'View & verify record'}
                                      onClick={() => handleOpenSubmission(sub)}
                                      style={ghostActionBtnStyle}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#f0fdfa'; e.currentTarget.style.color = 'var(--primary)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    >
                                      <Eye size={14} style={{ color: !sub.supervisorSignoff ? 'var(--primary)' : undefined }} />
                                    </button>

                                    {onOpenReport && (
                                      <button
                                        type="button"
                                        title="View evaluation report"
                                        onClick={() => onOpenReport(sub.id)}
                                        style={ghostActionBtnStyle}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                      >
                                        <BarChart2 size={14} />
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      title="More actions"
                                      onClick={(e) => openRowActionMenu(e, sub)}
                                      style={{
                                        ...ghostActionBtnStyle,
                                        background: rowActionMenu?.sub.id === sub.id ? '#f1f5f9' : 'transparent',
                                        color: rowActionMenu?.sub.id === sub.id ? 'var(--text-primary)' : 'var(--text-secondary)'
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                      onMouseLeave={e => {
                                        const isOpen = rowActionMenu?.sub.id === sub.id;
                                        e.currentTarget.style.background = isOpen ? '#f1f5f9' : 'transparent';
                                        e.currentTarget.style.color = isOpen ? 'var(--text-primary)' : 'var(--text-secondary)';
                                      }}
                                    >
                                      <MoreHorizontal size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
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
            <span>Duplicate as New</span>
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
            <span>Print A4</span>
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
                <span>Move to Trash</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={!!submissionToDelete}
        title="Move record to Trash?"
        message={
          submissionToDelete ? (
            <div>
              This submission will be moved to <strong>Trash</strong> for safe keeping.
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
        confirmText="Move to Trash"
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
