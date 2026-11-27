import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { Process, ReportTemplateISO, TrashEntityType } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, FileText, Printer, Edit2, ChevronDown, ChevronRight, SlidersHorizontal, Copy, Check, Trash2, RotateCcw, ArrowLeft, MoreHorizontal } from 'lucide-react';
import SubmissionManager from './SubmissionManager';
import { BPMNGuide } from './BPMNGuide';
import DashboardToolbar from './common/DashboardToolbar';
import ConfirmModal from './common/ConfirmModal';
import SystemTrashView from './common/SystemTrashView';
import { generateNextFormId, duplicateFormTemplate, linkDuplicatedFormToSteps } from '../utils/formUtils';

interface DashboardProps {
  onSelectProcess: (id: string) => void;
  onPrintProcess?: (id: string) => void;
  onEditProcess: (id: string | null, tab?: 'description' | 'workflow' | 'form', formName?: string | null) => void;
  onViewFormSubmissions?: (formName: string) => void;
  onOpenFormFiller?: (processId: string, formName: string, preloadedFormTemplate?: any) => void;
  onOpenReportBuilder?: (formId?: string, reportId?: string) => void;
  onOpenFormReport?: (submissionId: string) => void;
  viewMode?: 'processes' | 'submissions' | 'reports' | 'guide' | 'trash';
  onViewModeChange?: (mode: 'processes' | 'submissions' | 'reports' | 'guide' | 'trash') => void;
  initialFormFilter?: string | null;
  onClearFormFilter?: () => void;
  onViewingSubmissionChange?: (isViewing: boolean) => void;
}

const formatStandardDate = (dateInput?: string | number | null): string => {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatCleanVersion = (raw?: string): string => {
  if (!raw) return 'v0.1';
  const clean = raw.replace(/^[vV]+/, '').trim();
  return clean ? `v${clean}` : 'v0.1';
};

const renderPreattentiveVersion = (
  statusRaw?: string,
  currentVersionStr?: string,
  selectNode?: React.ReactNode,
  isParent = true
) => {
  const norm = (statusRaw || 'Active').trim().toUpperCase();
  const isDraft = norm === 'DRAFT' || norm === 'PENDING REVIEW';
  return (
    <div
      title={isDraft ? 'Draft' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.78rem',
        fontWeight: isParent ? 500 : 400,
        color: isParent ? 'var(--text-secondary)' : 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums'
      }}
    >
      <span
        aria-label={isDraft ? 'Draft' : undefined}
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          border: isDraft ? '1.5px solid var(--warning)' : '1.5px solid transparent',
          background: 'transparent',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      />
      {selectNode || <span>{formatCleanVersion(currentVersionStr)}</span>}
    </div>
  );
};

type RowActionMenuState =
  | { key: string; kind: 'process'; proc: Process; top: number; right: number; openUpward: boolean }
  | { key: string; kind: 'form'; form: any; processId: string; top: number; right: number; openUpward: boolean }
  | { key: string; kind: 'report'; report: ReportTemplateISO; top: number; right: number; openUpward: boolean };

export const Dashboard: React.FC<DashboardProps> = ({ 
  onSelectProcess, 
  onPrintProcess,
  onEditProcess, 
  onViewFormSubmissions, 
  onOpenFormFiller,
  onOpenReportBuilder,
  onOpenFormReport,
  viewMode = 'processes',
  onViewModeChange,
  initialFormFilter = null,
  onClearFormFilter,
  onViewingSubmissionChange
}) => {
  const [processes, setProcesses] = useState<Process[]>(() => {
    try {
      const cached = sessionStorage.getItem('swr_processes');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [allForms, setAllForms] = useState<any[]>(() => {
    try {
      const cached = sessionStorage.getItem('swr_forms');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [reportTemplates, setReportTemplates] = useState<ReportTemplateISO[]>(() => {
    try {
      const cached = sessionStorage.getItem('swr_reports');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [selectedFormVersions, setSelectedFormVersions] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [submissionSearchTerm, setSubmissionSearchTerm] = useState(initialFormFilter || '');
  const [submissionProcessFilter, setSubmissionProcessFilter] = useState<string>('ALL');
  const [submissionSignoffFilter, setSubmissionSignoffFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');

  useEffect(() => {
    if (initialFormFilter) {
      setSubmissionSearchTerm(initialFormFilter);
    }
  }, [initialFormFilter]);

  const [loading, setLoading] = useState(() => {
    try {
      return !sessionStorage.getItem('swr_processes');
    } catch {
      return true;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [selectedProcessVersions, setSelectedProcessVersions] = useState<Record<string, string>>({});
  const [retiredCollapsed, setRetiredCollapsed] = useState(true);
  const [isViewingSubmission, setIsViewingSubmission] = useState(false);
  const [duplicatingFormId, setDuplicatingFormId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
    undoItem?: { entityType: TrashEntityType; id: string; version?: string };
  } | null>(null);
  const [collapsedProcessGroups, setCollapsedProcessGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_collapsed_processes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [trashCount, setTrashCount] = useState<number>(0);
  const [lastActiveTab, setLastActiveTab] = useState<'processes' | 'submissions' | 'reports'>('processes');
  const [deleteTarget, setDeleteTarget] = useState<{
    entityType: 'process' | 'form' | 'report';
    id: string;
    title: string;
    version?: string;
    note?: string;
  } | null>(null);
  const [deletingTarget, setDeletingTarget] = useState(false);
  const [rowActionMenu, setRowActionMenu] = useState<RowActionMenuState | null>(null);

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

  const openRowActionMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    payload:
      | { key: string; kind: 'process'; proc: Process }
      | { key: string; kind: 'form'; form: any; processId: string }
      | { key: string; kind: 'report'; report: ReportTemplateISO }
  ) => {
    e.stopPropagation();
    if (rowActionMenu?.key === payload.key) {
      setRowActionMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const openUpward = window.innerHeight - rect.bottom < 180;
    setRowActionMenu({
      ...payload,
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

  const toggleProcessGroup = (processId: string) => {
    setCollapsedProcessGroups(prev => {
      const next = { ...prev, [processId]: !prev[processId] };
      try {
        localStorage.setItem('dashboard_collapsed_processes', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const toggleAllProcessGroups = (keys: string[], collapse: boolean) => {
    setCollapsedProcessGroups(prev => {
      const next = { ...prev };
      keys.forEach(k => {
        next[k] = collapse;
      });
      try {
        localStorage.setItem('dashboard_collapsed_processes', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  useEffect(() => {
    if (!toast) return;
    const duration = toast.undoItem ? 5000 : 3500;
    const timer = setTimeout(() => setToast(null), duration);
    return () => clearTimeout(timer);
  }, [toast]);

  const getFormattedVersionString = (proc: Process) => formatCleanVersion(proc.version);
  const { hasPermission, currentUser } = useAuth();
  const canAccessTrash = hasPermission('design_document') || currentUser?.role_id === 'admin';

  useEffect(() => {
    if (viewMode === 'processes' || viewMode === 'submissions' || viewMode === 'reports') {
      setLastActiveTab(viewMode);
    }
  }, [viewMode]);

  const fetchTrashCount = async () => {
    if (!canAccessTrash) return;
    try {
      const res = await fetch('/api/trash/count');
      if (res.ok) {
        const counts = await res.json();
        const isAdminUser = currentUser?.role_id === 'admin';
        const visibleCount = isAdminUser
          ? (counts.total || 0)
          : Math.max(0, (counts.total || 0) - (counts.submission || 0));
        setTrashCount(visibleCount);
      }
    } catch (_) {}
  };

  const fetchProcesses = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      const [procRes, formsRes, repRes] = await Promise.all([
        fetch('/api/processes?fields=list'),
        fetch('/api/forms?fields=list'),
        fetch('/api/reports')
      ]);

      if (!procRes.ok) throw new Error('Failed to fetch processes');
      const data = await procRes.json();
      setProcesses(data);
      try { sessionStorage.setItem('swr_processes', JSON.stringify(data)); } catch (e) { console.warn('Could not cache processes in sessionStorage', e); }

      if (formsRes.ok) {
        const formsData = await formsRes.json();
        setAllForms(formsData);
        try { sessionStorage.setItem('swr_forms', JSON.stringify(formsData)); } catch (e) { console.warn('Could not cache forms in sessionStorage', e); }
      }
      if (repRes.ok) {
        const repsData = await repRes.json();
        setReportTemplates(repsData);
        try { sessionStorage.setItem('swr_reports', JSON.stringify(repsData)); } catch (e) { console.warn('Could not cache reports in sessionStorage', e); }
      }
      setError(null);
    } catch (err) {
      console.error(err);
      if (!isBackground && processes.length === 0) {
        setError('Could not load processes. Please check if the backend server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const hasCache = !!sessionStorage.getItem('swr_processes');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProcesses(hasCache);
    fetchTrashCount();
  }, []);





  const handleConfirmSoftDelete = async () => {
    if (!deleteTarget) return;
    const actor = currentUser?.full_name || currentUser?.username || '';
    const deletedByParam = actor ? `deletedBy=${encodeURIComponent(actor)}` : '';
    try {
      setDeletingTarget(true);
      let url = '';
      if (deleteTarget.entityType === 'process') {
        url = `/api/processes/${encodeURIComponent(deleteTarget.id)}${deletedByParam ? `?${deletedByParam}` : ''}`;
      } else if (deleteTarget.entityType === 'form') {
        url = `/api/forms/${encodeURIComponent(deleteTarget.id)}${deletedByParam ? `?${deletedByParam}` : ''}`;
      } else {
        url = `/api/reports/${encodeURIComponent(deleteTarget.id)}${deletedByParam ? `?${deletedByParam}` : ''}`;
      }

      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Unable to move item to Trash');
      }

      // Sync local state + sessionStorage SWR caches immediately
      if (deleteTarget.entityType === 'process') {
        setProcesses(prev => {
          const next = prev.filter(p => p.id !== deleteTarget.id);
          try { sessionStorage.setItem('swr_processes', JSON.stringify(next)); } catch (_) {}
          return next;
        });
      } else if (deleteTarget.entityType === 'form') {
        setAllForms(prev => {
          const next = prev.filter(f => (f.form_id || f.formId) !== deleteTarget.id);
          try { sessionStorage.setItem('swr_forms', JSON.stringify(next)); } catch (_) {}
          return next;
        });
      } else if (deleteTarget.entityType === 'report') {
        setReportTemplates(prev => {
          const next = prev.filter(r => r.reportId !== deleteTarget.id);
          try { sessionStorage.setItem('swr_reports', JSON.stringify(next)); } catch (_) {}
          return next;
        });
      }

      const targetSnapshot = deleteTarget;
      setDeleteTarget(null);
      setToast({
        message: `Moved "${targetSnapshot.title}" to Trash.`,
        type: 'success',
        undoItem: {
          entityType: targetSnapshot.entityType,
          id: targetSnapshot.id,
          version: targetSnapshot.entityType === 'form' ? undefined : targetSnapshot.version
        }
      });
      await fetchTrashCount();
    } catch (err) {
      console.error(err);
      setToast({
        message: err instanceof Error ? err.message : 'Error deleting selected item.',
        type: 'error'
      });
    } finally {
      setDeletingTarget(false);
    }
  };

  const handleUndoSoftDelete = async () => {
    const undo = toast?.undoItem;
    if (!undo) return;
    try {
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(undo)
      });
      if (!res.ok) throw new Error('Unable to undo delete');
      setToast({ message: 'Item restored successfully.', type: 'success' });
      await Promise.all([fetchProcesses(true), fetchTrashCount()]);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Error undoing delete.', type: 'error' });
    }
  };

  // Group processes by family (parentProcessId)
  const groups: { [parentId: string]: Process[] } = {};
  processes.forEach(p => {
    const parentId = p.parentProcessId || p.id;
    if (!groups[parentId]) {
      groups[parentId] = [];
    }
    groups[parentId].push(p);
  });

  // Sort versions within each family descending by version number
  Object.keys(groups).forEach(parentId => {
    groups[parentId].sort((a, b) => {
      const aVer = parseInt(a.version, 10) || 0;
      const bVer = parseInt(b.version, 10) || 0;
      return bVer - aVer;
    });
  });

  const getRepresentative = (group: Process[]): Process => {
    const draft = group.find(p => p.status === 'Draft');
    if (draft) return draft;
    const active = group.find(p => p.status === 'Active');
    if (active) return active;
    const retired = group.find(p => p.status === 'Retired');
    return retired || group[0]; // Active version takes priority, then Retired, else latest version
  };

  const getFamilyTimestamp = (family: { representative: Process; allVersions: Process[] }) => {
    const repTime = new Date(family.representative.lastUpdated || 0).getTime();
    const maxVersionTime = Math.max(
      ...family.allVersions.map(v => new Date(v.lastUpdated || 0).getTime()),
      0
    );
    return Math.max(repTime, maxVersionTime);
  };

  const processFamilies = Object.keys(groups)
    .filter(parentId => parentId !== 'unlinked')
    .map(parentId => {
      const allVersions = groups[parentId];
      const representative = getRepresentative(allVersions);
      return {
        parentId,
        representative,
        allVersions
      };
    })
    .sort((a, b) => getFamilyTimestamp(b) - getFamilyTimestamp(a));

  // ─── Forms Tab Data: Group allForms by form_id (Memoized) ───
  const formsGroupedById: Record<string, any[]> = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    allForms.forEach(f => {
      const fId = f.form_id || f.formId;
      if (!grouped[fId]) {
        grouped[fId] = [];
      }
      grouped[fId].push(f);
    });
    return grouped;
  }, [allForms]);

  // ─── Precompute active representative processes and their set of linked form IDs (Memoized) ───
  const activeProcsWithFormIds = useMemo(() => {
    return Object.entries(groups).map(([parentId, allVersions]) => {
      if (parentId === 'unlinked') return null;
      const rep = getRepresentative(allVersions);
      if (rep.status === 'Retired') return null;

      const linkedFormIds = new Set<string>();
      allVersions.forEach(p => {
        const wfd = p.workflowFormsData
          ? (typeof p.workflowFormsData === 'string' ? JSON.parse(p.workflowFormsData) : p.workflowFormsData)
          : null;
        const steps = p.steps
          ? (typeof p.steps === 'string' ? JSON.parse(p.steps) : p.steps)
          : null;

        if (wfd && typeof wfd === 'object') {
          Object.values(wfd).forEach((fdata: any) => {
            if (fdata?.formId) linkedFormIds.add(fdata.formId);
          });
        }
        if (Array.isArray(steps)) {
          steps.forEach((s: any) => {
            if (s?.producesForm && Array.isArray(s.formNames)) {
              s.formNames.forEach((fId: string) => linkedFormIds.add(fId));
            }
          });
        }
      });

      return {
        parentId,
        id: rep.id,
        title: rep.title,
        linkedFormIds
      };
    }).filter(Boolean) as Array<{ parentId: string; id: string; title: string; linkedFormIds: Set<string> }>;
  }, [groups]);

  // Helper to extract timestamp for form sorting
  const getFormTimestamp = (form: any) => {
    const dateVal = form.rawRecord?.updated_at || form.rawRecord?.updatedAt || 0;
    return dateVal ? new Date(dateVal).getTime() : 0;
  };

  // ─── Build latest unique forms list with linked processes (Memoized) ───
  const formsList = useMemo(() => {
    const latestFormsMap = new Map();
    Object.entries(formsGroupedById).forEach(([formId, versionsList]) => {
      const sorted = [...versionsList].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      const chosenVersion = selectedFormVersions[formId];
      const matched = chosenVersion
        ? sorted.find(f => f.version === chosenVersion)
        : sorted[0];
      latestFormsMap.set(formId, matched || sorted[0]);
    });

    const list: any[] = [];
    latestFormsMap.forEach((formRecord, formId) => {
      const linkedProcesses = activeProcsWithFormIds
        .filter(p => p.linkedFormIds.has(formId))
        .map(p => ({ parentId: p.parentId, id: p.id, title: p.title }));

      const formTitle = formRecord.form_title || formRecord.form_name || formId;

      list.push({
        formName: formId,
        formTitle,
        formId,
        version: formRecord.version || 'v1.0',
        status: formRecord.status || 'DRAFT',
        linkedProcesses,
        rawRecord: formRecord
      });
    });

    list.sort((a, b) => {
      const diff = getFormTimestamp(b) - getFormTimestamp(a);
      if (diff !== 0) return diff;
      return a.formTitle.localeCompare(b.formTitle);
    });

    return list;
  }, [formsGroupedById, selectedFormVersions, activeProcsWithFormIds]);

  const formsByFamilyParentId = useMemo(() => {
    const map: Record<string, any[]> = {};
    formsList.forEach(form => {
      form.linkedProcesses.forEach((lp: { parentId: string }) => {
        if (!map[lp.parentId]) map[lp.parentId] = [];
        map[lp.parentId].push(form);
      });
    });
    Object.values(map).forEach(arr => {
      arr.sort((a, b) => getFormTimestamp(b) - getFormTimestamp(a));
    });
    return map;
  }, [formsList]);

  const standaloneForms = useMemo(() => {
    return formsList.filter(form => form.linkedProcesses.length === 0);
  }, [formsList]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const { visibleActiveTree, retiredFamilies, visibleStandaloneForms, isStandaloneExpanded } = useMemo(() => {
    const activeTree: Array<{ family: (typeof processFamilies)[number]; formsToShow: any[]; isExpanded: boolean }> = [];
    const retiredList: typeof processFamilies = [];

    processFamilies.forEach(family => {
      const selectedId = selectedProcessVersions[family.parentId];
      const currentRep = selectedId ? family.allVersions.find(v => v.id === selectedId) || family.representative : family.representative;
      const isRetired = (currentRep.status || 'Active') === 'Retired';

      const processMatches =
        !normalizedQuery ||
        family.parentId.toLowerCase().includes(normalizedQuery) ||
        currentRep.title.toLowerCase().includes(normalizedQuery) ||
        (currentRep.description || '').toLowerCase().includes(normalizedQuery) ||
        Boolean(currentRep.steps?.some(s => s.action.toLowerCase().includes(normalizedQuery))) ||
        Boolean(currentRep.formFields?.some(f => f.checkItem.toLowerCase().includes(normalizedQuery)));

      if (isRetired) {
        if (!normalizedQuery || processMatches) {
          retiredList.push(family);
        }
        return;
      }

      const familyForms = formsByFamilyParentId[family.parentId] || [];
      const matchingForms = normalizedQuery
        ? familyForms.filter(
            form =>
              form.formId.toLowerCase().includes(normalizedQuery) ||
              form.formTitle.toLowerCase().includes(normalizedQuery)
          )
        : familyForms;

      if (!normalizedQuery || processMatches || matchingForms.length > 0) {
        const formsToShow = normalizedQuery && matchingForms.length > 0 ? matchingForms : familyForms;
        const isExpanded = normalizedQuery && matchingForms.length > 0
          ? true
          : !collapsedProcessGroups[family.parentId];
        activeTree.push({ family, formsToShow, isExpanded });
      }
    });

    const filteredStandalone = normalizedQuery
      ? standaloneForms.filter(
          form =>
            form.formId.toLowerCase().includes(normalizedQuery) ||
            form.formTitle.toLowerCase().includes(normalizedQuery)
        )
      : standaloneForms;

    const standaloneExpanded = normalizedQuery
      ? filteredStandalone.length > 0
      : !collapsedProcessGroups['unlinked'];

    return {
      visibleActiveTree: activeTree,
      retiredFamilies: retiredList,
      visibleStandaloneForms: filteredStandalone,
      isStandaloneExpanded: standaloneExpanded
    };
  }, [processFamilies, selectedProcessVersions, normalizedQuery, formsByFamilyParentId, collapsedProcessGroups, standaloneForms]);

  const handleFillForProcess = (form: any, processId: string) => {
    const hasLayout = form.rawRecord?.layout_blocks && (
      Array.isArray(form.rawRecord.layout_blocks)
        ? form.rawRecord.layout_blocks.length > 0
        : form.rawRecord.layout_blocks !== '[]'
    );
    const tplToPass = hasLayout ? form.rawRecord : undefined;
    if (onOpenFormFiller) {
      onOpenFormFiller(processId || 'unlinked', form.formName, tplToPass);
    } else if (processId && processId !== 'unlinked') {
      onSelectProcess(processId);
    }
  };

  const handleDuplicateFormDirect = async (form: any, preferredProcessId?: string) => {
    if (duplicatingFormId) return;
    try {
      setDuplicatingFormId(form.formId);

      // 1. Auto-generate next Form ID
      const existingFormIds = allForms.map((f: any) => f.form_id || f.formId);
      const newFormId = generateNextFormId(form.formId, existingFormIds);
      const newFormTitle = form.formTitle || form.formName;

      // 2. Fetch full layout if needed
      let sourceTemplate = form.rawRecord;
      if (!sourceTemplate?.layout_blocks || typeof sourceTemplate.layout_blocks === 'string') {
        try {
          const res = await fetch(`/api/forms/${encodeURIComponent(form.formId)}?version=${encodeURIComponent(form.version)}`);
          if (res.ok) {
            sourceTemplate = await res.json();
          }
        } catch (e) {
          console.warn('Could not fetch single form, falling back to rawRecord', e);
        }
      }

      // 3. Duplicate block payload and clean metadata
      const authorName = currentUser?.full_name || currentUser?.username || 'Admin';
      const duplicated = duplicateFormTemplate(sourceTemplate || {}, newFormId, newFormTitle, authorName);

      // 4. Persist new form (never pass oldFormId)
      const saveFormRes = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicated)
      });

      if (!saveFormRes.ok) {
        let errText = 'Error saving duplicated form';
        try {
          const errData = await saveFormRes.json();
          if (errData?.error) errText = errData.error;
        } catch (_) {}
        throw new Error(errText);
      }

      // 5. Link into parent process & matching work step
      const targetProc =
        (preferredProcessId && preferredProcessId !== 'unlinked'
          ? processes.find(p => p.id === preferredProcessId && p.status !== 'Retired')
          : undefined) ||
        processes.find(p => {
          if (p.status === 'Retired') return false;
          const steps = p.steps ? (typeof p.steps === 'string' ? JSON.parse(p.steps) : p.steps) : [];
          const wfd = p.workflowFormsData ? (typeof p.workflowFormsData === 'string' ? JSON.parse(p.workflowFormsData) : p.workflowFormsData) : {};
          const inSteps = steps.some((s: any) => (s.formNames && s.formNames.includes(form.formId)) || s.formName === form.formId);
          const inWfd = wfd && Object.values(wfd).some((fdata: any) => fdata.formId === form.formId);
          return inSteps || inWfd;
        });

      if (targetProc) {
        const currentSteps = targetProc.steps ? (typeof targetProc.steps === 'string' ? JSON.parse(targetProc.steps) : [...targetProc.steps]) : [];
        const updatedSteps = linkDuplicatedFormToSteps(currentSteps, form.formId, newFormId);

        const currentWfd = targetProc.workflowFormsData ? (typeof targetProc.workflowFormsData === 'string' ? JSON.parse(targetProc.workflowFormsData) : { ...targetProc.workflowFormsData }) : {};
        currentWfd[newFormId] = {
          formId: newFormId,
          formTitle: newFormTitle,
          version: 'v0.1',
          status: 'DRAFT',
          effectiveDate: '',
          updatedAt: new Date().toISOString()
        };

        const updatedProc = {
          ...targetProc,
          steps: updatedSteps,
          workflowFormsData: currentWfd,
          lastUpdated: new Date().toISOString()
        };

        const saveProcRes = await fetch('/api/processes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProc)
        });

        if (!saveProcRes.ok) {
          let errText = 'Error updating parent process';
          try {
            const errData = await saveProcRes.json();
            if (errData?.error) errText = errData.error;
          } catch (_) {}
          throw new Error(errText);
        }
      }

      // 6. Refresh data & toast
      await fetchProcesses(true);
      setToast({
        message: `Duplicated form ${newFormId} successfully.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Error duplicating form:', err);
      setToast({
        message: err instanceof Error ? err.message : 'Failed to duplicate form.',
        type: 'error'
      });
    } finally {
      setDuplicatingFormId(null);
    }
  };

  const renderFormSubRow = (
    form: any,
    procId: string,
    isFirstInGroup: boolean,
    isLastInGroup: boolean,
    isLastOverallRow: boolean
  ) => {
    const rawDate = form.rawRecord?.updated_at || form.rawRecord?.updatedAt || form.rawRecord?.created_at;
    const formattedDate = formatStandardDate(rawDate);
    const menuKey = `form_${procId}_${form.formId}`;
    const isMenuOpen = rowActionMenu?.key === menuKey;
    const hasFormMenuItems = Boolean(onViewFormSubmissions || hasPermission('design_document'));
    const lastCellClass = isLastInGroup ? 'dashboard-subrow-cell-last' : undefined;

    const versionSelect = formsGroupedById[form.formId] && formsGroupedById[form.formId].length > 1 ? (
      <select
        value={form.version}
        onChange={(e) => {
          const selectedVal = e.target.value;
          setSelectedFormVersions(prev => ({
            ...prev,
            [form.formId]: selectedVal
          }));
        }}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          width: 'auto',
          fontSize: '0.78rem',
          fontWeight: 400,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          outline: 'none'
        }}
      >
        {[...formsGroupedById[form.formId]]
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .map((vOpt: any) => (
            <option key={vOpt.id || vOpt.version} value={vOpt.version}>
              {formatCleanVersion(vOpt.version)}
            </option>
          ))}
      </select>
    ) : undefined;

    return (
      <tr
        key={`${procId}_${form.formName}`}
        className="dashboard-form-subrow"
        onClick={() => handleFillForProcess(form, procId)}
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
            title={form.formId}
            style={{
              fontSize: '0.73rem',
              fontWeight: 400,
              color: 'var(--text-muted)',
              opacity: 0.85,
              fontFamily: 'monospace',
              maxWidth: '125px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block'
            }}
          >
            {form.formId}
          </span>
        </td>
        <td className={`dashboard-form-spine-cell ${isFirstInGroup ? 'is-first' : ''} ${isLastInGroup ? 'is-last' : ''}`}>
          <span style={{ fontWeight: 400, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {form.formTitle}
          </span>
        </td>
        <td
          className={lastCellClass}
          style={{ padding: '0.42rem 0.75rem', textAlign: 'left', verticalAlign: 'middle' }}
          onClick={e => e.stopPropagation()}
        >
          {renderPreattentiveVersion(form.status, form.version, versionSelect, false)}
        </td>
        <td
          className={lastCellClass}
          style={{ padding: '0.42rem 0.75rem', textAlign: 'left', verticalAlign: 'middle', fontSize: '0.76rem', fontWeight: 400, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
        >
          {formattedDate}
        </td>
        <td
          className={lastCellClass}
          style={{ padding: '0.35rem 1rem 0.35rem 0.75rem', textAlign: 'right', verticalAlign: 'middle' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              type="button"
              title="Fill"
              className="dashboard-fill-btn"
              onClick={() => handleFillForProcess(form, procId)}
            >
              Fill
            </button>
            {(hasPermission('design_document') || hasFormMenuItems) && (
              <span className={`dashboard-row-reveal ${isMenuOpen ? 'has-open-menu' : ''}`}>
                {hasPermission('design_document') && (
                  <button
                    type="button"
                    title="Edit"
                    style={ghostActionBtnStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onClick={() => onEditProcess(procId === 'unlinked' ? null : procId, 'form', form.formName)}
                  >
                    <Edit2 size={13} />
                  </button>
                )}
                {hasFormMenuItems && (
                  <button
                    type="button"
                    title="More"
                    className={`dashboard-more-trigger ${isMenuOpen ? 'is-open' : ''}`}
                    onClick={(e) => openRowActionMenu(e, { key: menuKey, kind: 'form', form, processId: procId })}
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
                )}
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderProcessTreeTable = (
    treeItems: Array<{ family: (typeof processFamilies)[number]; formsToShow: any[]; isExpanded: boolean }>,
    standaloneItems: any[],
    isRetired = false,
    headerSlot?: React.ReactNode
  ) => {
    const expandableKeys = !isRetired && !normalizedQuery
      ? [
          ...treeItems.filter(item => item.formsToShow.length > 0).map(item => item.family.parentId),
          ...(standaloneItems.length > 0 ? ['unlinked'] : [])
        ]
      : [];
    const allExpandableCollapsed =
      expandableKeys.length > 0 && expandableKeys.every(k => Boolean(collapsedProcessGroups[k]));

    return (
      <div
        className={`paper-card ${isRetired ? '' : 'accent-teal'}`}
        style={{
          padding: 0,
          overflow: 'hidden',
          borderRadius: '8px',
          border: isRetired ? '1px dashed var(--neutral-border)' : '1px solid var(--neutral-border)',
          background: isRetired ? '#fafafa' : '#ffffff',
          boxShadow: isRetired ? 'none' : undefined,
          marginBottom: 0
        }}
      >
        {headerSlot}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--neutral-border)', background: isRetired ? '#f1f5f9' : '#fafbfc', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                <th style={{ padding: '0.6rem 0.5rem 0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '14%' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {expandableKeys.length > 0 ? (
                      <button
                        type="button"
                        title={allExpandableCollapsed ? 'Expand all' : 'Collapse all'}
                        onClick={() => toggleAllProcessGroups(expandableKeys, !allExpandableCollapsed)}
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
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '52%' }}>Title</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '11%' }}>Version</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '11%' }}>Updated</th>
                <th style={{ padding: '0.6rem 1rem 0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, width: '12%' }} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {treeItems.map(({ family, formsToShow, isExpanded }, idx) => {
                const { parentId, representative, allVersions } = family;
                const selectedId = selectedProcessVersions[parentId];
                const currentRep = selectedId ? allVersions.find(v => v.id === selectedId) || representative : representative;
                const status = currentRep.status || 'Active';
                const hasDesc = Boolean(currentRep.description && currentRep.description.trim());
                const hasForms = !isRetired && formsToShow.length > 0;
                const showForms = hasForms && isExpanded;
                const isLastFamily = idx === treeItems.length - 1 && standaloneItems.length === 0;
                const procMenuKey = `proc_${currentRep.id}`;
                const isMenuOpen = rowActionMenu?.key === procMenuKey;
                const rowPadTop = showForms ? '0.8rem' : '0.75rem';
                const rowPadBottom = showForms ? '0.45rem' : '0.75rem';

                const versionSelect = allVersions.length > 1 ? (
                  <select
                    value={currentRep.id}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedProcessVersions(prev => ({ ...prev, [parentId]: val }));
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      margin: 0,
                      width: 'auto',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {allVersions.map(v => (
                      <option key={v.id} value={v.id}>
                        {getFormattedVersionString(v)}
                      </option>
                    ))}
                  </select>
                ) : undefined;

                return (
                  <React.Fragment key={parentId}>
                    <tr
                      className="dashboard-tree-row"
                      onClick={() => {
                        if (hasForms) {
                          toggleProcessGroup(parentId);
                        } else {
                          onSelectProcess(currentRep.id);
                        }
                      }}
                      style={{
                        borderBottom: showForms
                          ? 'none'
                          : isLastFamily
                            ? 'none'
                            : '1px solid var(--neutral-border)',
                        cursor: 'pointer',
                        background: isRetired ? 'transparent' : undefined
                      }}
                    >
                      <td style={{ padding: `${rowPadTop} 0.5rem ${rowPadBottom} 0.75rem`, verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {hasForms ? (
                            <span
                              aria-label={isExpanded ? 'Collapse forms' : 'Expand forms'}
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
                          ) : (
                            <span style={{ width: '18px', display: 'inline-block', flexShrink: 0 }} />
                          )}
                          <span
                            title={parentId}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              fontFamily: 'monospace',
                              maxWidth: '125px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}
                          >
                            {parentId}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: `${rowPadTop} 0.75rem ${rowPadBottom} 0.75rem`, verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="dashboard-title-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectProcess(currentRep.id);
                            }}
                            style={{ fontWeight: 600, fontSize: '0.9rem', letterSpacing: '-0.01em' }}
                          >
                            {currentRep.title}
                          </button>
                          {hasForms && (
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
                              {formsToShow.length}
                            </span>
                          )}
                        </div>
                        {hasDesc && (
                          <div style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', marginTop: '0.15rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {currentRep.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: `${rowPadTop} 0.75rem ${rowPadBottom} 0.75rem`, textAlign: 'left', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                        {renderPreattentiveVersion(status, currentRep.version, versionSelect, true)}
                      </td>
                      <td style={{ padding: `${rowPadTop} 0.75rem ${rowPadBottom} 0.75rem`, textAlign: 'left', verticalAlign: 'middle', fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
                        {formatStandardDate(currentRep.lastUpdated)}
                      </td>
                      <td style={{ padding: `${showForms ? '0.68rem' : '0.62rem'} 1rem ${showForms ? '0.32rem' : '0.62rem'} 0.75rem`, textAlign: 'right', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <span className={`dashboard-row-reveal ${isMenuOpen ? 'has-open-menu' : ''}`}>
                            {hasPermission('design_document') && (
                              <button
                                type="button"
                                title="Edit"
                                style={ghostActionBtnStyle}
                                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                onClick={() => onEditProcess(currentRep.id)}
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Print"
                              style={ghostActionBtnStyle}
                              onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                              onClick={() => onPrintProcess ? onPrintProcess(currentRep.id) : onSelectProcess(currentRep.id)}
                            >
                              <Printer size={14} />
                            </button>
                          </span>
                          <button
                            type="button"
                            title="More"
                            className={`dashboard-more-trigger ${isMenuOpen ? 'is-open' : ''}`}
                            onClick={(e) => openRowActionMenu(e, { key: procMenuKey, kind: 'process', proc: currentRep })}
                            style={{
                              ...ghostActionBtnStyle,
                              background: isMenuOpen ? '#f1f5f9' : 'transparent',
                              color: isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = isMenuOpen ? '#f1f5f9' : 'transparent';
                              e.currentTarget.style.color = isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)';
                            }}
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {showForms && formsToShow.map((form, fIdx) =>
                      renderFormSubRow(
                        form,
                        currentRep.id,
                        fIdx === 0,
                        fIdx === formsToShow.length - 1,
                        isLastFamily && fIdx === formsToShow.length - 1
                      )
                    )}
                  </React.Fragment>
                );
              })}

              {!isRetired && standaloneItems.length > 0 && (
                <>
                  <tr
                    className="dashboard-tree-row"
                    onClick={() => toggleProcessGroup('unlinked')}
                    style={{
                      borderTop: treeItems.length > 0 ? '1px solid var(--neutral-border)' : 'none',
                      borderBottom: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <td colSpan={5} style={{ padding: isStandaloneExpanded ? '0.8rem 1rem 0.45rem 0.75rem' : '0.75rem 1rem 0.75rem 0.75rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          aria-label={isStandaloneExpanded ? 'Collapse standalone forms' : 'Expand standalone forms'}
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
                          {isStandaloneExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                          Standalone forms
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
                          {standaloneItems.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {isStandaloneExpanded && standaloneItems.map((form, fIdx) =>
                    renderFormSubRow(
                      form,
                      'unlinked',
                      fIdx === 0,
                      fIdx === standaloneItems.length - 1,
                      fIdx === standaloneItems.length - 1
                    )
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const segmentedTabBtnStyle = (active: boolean): React.CSSProperties => ({
    height: '28px',
    padding: '0 1rem',
    borderRadius: '6px',
    border: 'none',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    transition: 'all 0.15s ease',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#ffffff' : 'var(--text-secondary)',
    boxShadow: active ? '0 1px 2px rgba(16, 163, 163, 0.25)' : 'none'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 145px)' }}>
      <div style={{ flex: 1 }}>
      {/* View Switcher Tabs */}
      {!(isViewingSubmission && viewMode === 'submissions') && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '36px', boxSizing: 'border-box' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#eef2f6', padding: '3px', borderRadius: '8px', border: '1px solid var(--neutral-border)', height: '36px', boxSizing: 'border-box' }}>
          <button
            type="button"
            onClick={() => { onViewModeChange && onViewModeChange('processes'); setSearchQuery(''); onClearFormFilter && onClearFormFilter(); }}
            style={segmentedTabBtnStyle(viewMode === 'processes')}
          >
            Processes
          </button>
          <button
            type="button"
            onClick={() => { onViewModeChange && onViewModeChange('submissions'); setSearchQuery(''); }}
            style={segmentedTabBtnStyle(viewMode === 'submissions')}
          >
            Submissions
          </button>
          <button
            type="button"
            onClick={() => { onViewModeChange && onViewModeChange('reports'); setSearchQuery(''); }}
            style={segmentedTabBtnStyle(viewMode === 'reports')}
          >
            Reports
          </button>
        </div>

        {viewMode !== 'guide' && canAccessTrash && (
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'trash' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              if (viewMode === 'trash') {
                onViewModeChange && onViewModeChange(lastActiveTab);
              } else {
                onViewModeChange && onViewModeChange('trash');
              }
              setSearchQuery('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '36px',
              padding: '0 0.75rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              margin: 0
            }}
            title="Open System Trash"
          >
            <Trash2 size={13} />
            <span>Trash</span>
            {trashCount > 0 && (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0 0.35rem',
                borderRadius: '10px',
                background: viewMode === 'trash' ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                color: viewMode === 'trash' ? '#ffffff' : 'var(--text-primary)'
              }}>
                {trashCount}
              </span>
            )}
          </button>
        )}
      </div>
      )}

      {viewMode === 'trash' && (
        <DashboardToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          placeholder="Search trash by ID, title, or deleted by..."
          actions={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                onViewModeChange && onViewModeChange(lastActiveTab);
                setSearchQuery('');
              }}
              style={{ margin: 0, height: '36px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <ArrowLeft size={15} />
              Back
            </button>
          }
        />
      )}

      {error && (
        <div className="paper-card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: '#fee2e2' }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600, margin: 0 }}>{error}</p>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading processes database...</p>
        </div>
      ) : viewMode === 'submissions' ? (
        <SubmissionManager
          isEmbedded={true}
          hideToolbar={true}
          headerSlot={
            <DashboardToolbar
              embedded
              searchQuery={submissionSearchTerm}
              onSearchChange={setSubmissionSearchTerm}
              placeholder="Search submissions..."
              filters={
                <>
                  <select
                    aria-label="Filter by process"
                    value={submissionProcessFilter}
                    onChange={(e) => setSubmissionProcessFilter(e.target.value)}
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
                    value={submissionSignoffFilter}
                    onChange={(e) => setSubmissionSignoffFilter(e.target.value as any)}
                    style={{ height: '36px', padding: '0 0.6rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '6px', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING">Pending Review</option>
                    <option value="VERIFIED">Verified</option>
                  </select>
                </>
              }
            />
          }
          initialFormFilter={initialFormFilter}
          cachedProcesses={processes}
          cachedForms={allForms}
          externalSearchTerm={submissionSearchTerm}
          externalProcessFilter={submissionProcessFilter}
          externalSignoffFilter={submissionSignoffFilter}
          onBack={() => {
            setSubmissionSearchTerm('');
            onClearFormFilter?.();
          }}
          onOpenReport={onOpenFormReport}
          onOpenReportBuilder={onOpenReportBuilder}
          onOpenFormFiller={onOpenFormFiller}
          onTrashChanged={fetchTrashCount}
          onViewingChange={(isViewing) => {
            setIsViewingSubmission(isViewing);
            onViewingSubmissionChange?.(isViewing);
          }}
        />
      ) : viewMode === 'trash' ? (
        <SystemTrashView
          searchQuery={searchQuery}
          isAdmin={currentUser?.role_id === 'admin'}
          onDataChanged={() => {
            fetchProcesses(true);
            fetchTrashCount();
          }}
          onToast={(t) => setToast(t)}
        />
      ) : viewMode === 'guide' ? (
        <BPMNGuide />
      ) : viewMode === 'reports' ? (
        (() => {
          const filteredReports = reportTemplates.filter(r => {
            const q = searchQuery.toLowerCase();
            return (
              (r.reportId || '').toLowerCase().includes(q) ||
              (r.reportTitle || '').toLowerCase().includes(q) ||
              (r.linkedFormId || '').toLowerCase().includes(q)
            );
          });

          const reportsToolbar = (
            <DashboardToolbar
              embedded
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              placeholder="Search reports..."
              actions={
                hasPermission('design_document') && onOpenReportBuilder ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => onOpenReportBuilder()}
                    style={{ margin: 0, height: '36px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={16} />
                    New Report
                  </button>
                ) : undefined
              }
            />
          );

          if (filteredReports.length === 0) {
            return (
              <div
                className="paper-card accent-teal"
                style={{ padding: 0, overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--neutral-border)', marginBottom: 0 }}
              >
                {reportsToolbar}
                <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <FileText size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
                  <h3>No Report Templates Found</h3>
                  <p style={{ maxWidth: '480px', margin: '0 auto 1.5rem auto', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {searchQuery
                      ? 'No report templates match your search query. Try clearing the filter or checking your spelling.'
                      : 'There are currently no report templates created. Click below to design your first report template.'}
                  </p>
                  {searchQuery ? (
                    <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>Clear Search</button>
                  ) : (
                    onOpenReportBuilder && (
                      <button className="btn btn-primary" onClick={() => onOpenReportBuilder()}>
                        <Plus size={16} /> New Report
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          }

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
              {reportsToolbar}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--neutral-border)', background: '#fafbfc', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                      <th style={{ padding: '0.6rem 0.5rem 0.6rem 1rem', textAlign: 'left', fontWeight: 600, width: '14%' }}>ID</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '44%' }}>Title</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '19%' }}>Source Form</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '11%' }}>Version</th>
                      <th style={{ padding: '0.6rem 1rem 0.6rem 0.75rem', textAlign: 'right', fontWeight: 600, width: '12%' }} aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((rep, idx) => {
                      const status = rep.status || 'DRAFT';
                      const srcForm = formsList.find(f => f.formId === rep.linkedFormId);
                      const srcTitle = srcForm?.formTitle;
                      const normSrc = (srcTitle || '').toLowerCase().replace(/[\s_-]+/g, '');
                      const normFid = (rep.linkedFormId || '').toLowerCase().replace(/[\s_-]+/g, '');
                      const repMenuKey = `rep_${rep.reportId}_${rep.version}`;
                      const isMenuOpen = rowActionMenu?.key === repMenuKey;
                      const hasReportMenuItems = Boolean(onOpenReportBuilder || hasPermission('design_document'));

                      return (
                        <tr
                          key={rep.reportId + rep.version}
                          className="dashboard-tree-row"
                          onClick={() => onOpenReportBuilder && onOpenReportBuilder(rep.linkedFormId, rep.reportId)}
                          style={{
                            borderBottom: idx === filteredReports.length - 1 ? 'none' : '1px solid var(--neutral-border)',
                            cursor: onOpenReportBuilder ? 'pointer' : 'default'
                          }}
                        >
                          <td style={{ padding: '0.75rem 0.5rem 0.75rem 1rem', verticalAlign: 'middle' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {rep.reportId}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                            {rep.reportTitle}
                          </td>
                          <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {srcTitle ? (
                                <>
                                  <span style={{ fontSize: '0.84rem', fontWeight: 400, color: 'var(--text-secondary)' }}>{srcTitle}</span>
                                  {normSrc !== normFid && rep.linkedFormId && (
                                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                      · {rep.linkedFormId}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {rep.linkedFormId}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.75rem', textAlign: 'left', verticalAlign: 'middle' }}>
                            {renderPreattentiveVersion(status, rep.version, undefined, true)}
                          </td>
                          <td style={{ padding: '0.62rem 1rem 0.62rem 0.75rem', textAlign: 'right', verticalAlign: 'middle' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {onOpenReportBuilder && (
                                <span className={`dashboard-row-reveal ${isMenuOpen ? 'has-open-menu' : ''}`}>
                                  <button
                                    type="button"
                                    style={ghostActionBtnStyle}
                                    title="Edit"
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    onClick={() => onOpenReportBuilder(rep.linkedFormId, rep.reportId)}
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </span>
                              )}
                              {hasReportMenuItems && (
                                <button
                                  type="button"
                                  title="More"
                                  className={`dashboard-more-trigger ${isMenuOpen ? 'is-open' : ''}`}
                                  onClick={(e) => openRowActionMenu(e, { key: repMenuKey, kind: 'report', report: rep })}
                                  style={{
                                    ...ghostActionBtnStyle,
                                    background: isMenuOpen ? '#f1f5f9' : 'transparent',
                                    color: isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = isMenuOpen ? '#f1f5f9' : 'transparent';
                                    e.currentTarget.style.color = isMenuOpen ? 'var(--text-primary)' : 'var(--text-secondary)';
                                  }}
                                >
                                  <MoreHorizontal size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()
      ) : (() => {
        const processesToolbar = (
          <DashboardToolbar
            embedded
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search processes or forms..."
            actions={
              hasPermission('design_document') ? (
                <button
                  className="btn btn-primary"
                  onClick={() => onEditProcess(null)}
                  style={{ margin: 0, height: '36px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Plus size={16} />
                  New Process
                </button>
              ) : undefined
            }
          />
        );

        if (visibleActiveTree.length === 0 && visibleStandaloneForms.length === 0 && retiredFamilies.length === 0) {
          return (
            <div
              className="paper-card accent-teal"
              style={{ padding: 0, overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--neutral-border)', marginBottom: 0 }}
            >
              {processesToolbar}
              <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <FileText size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
                <h3>No Processes Found</h3>
                <p style={{ maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                  {searchQuery
                    ? 'No results match your search query. Try clearing the filter or checking your spelling.'
                    : 'The repository is currently empty. Get started by creating your first process standard.'}
                </p>
                {searchQuery ? (
                  <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>Clear Search</button>
                ) : (
                  hasPermission('design_document') && (
                    <button className="btn btn-primary" onClick={() => onEditProcess(null)}>
                      <Plus size={18} />
                      New Process
                    </button>
                  )
                )}
              </div>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Single Hero Sheet: Embedded Toolbar + Active Processes & Linked Forms Tree */}
            {(visibleActiveTree.length > 0 || visibleStandaloneForms.length > 0) ? (
              renderProcessTreeTable(visibleActiveTree, visibleStandaloneForms, false, processesToolbar)
            ) : (
              <div
                className="paper-card accent-teal"
                style={{ padding: 0, overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--neutral-border)', marginBottom: 0 }}
              >
                {processesToolbar}
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: '#fcfcfc' }}>
                  No active processes available.
                </div>
              </div>
            )}

            {/* Retired Group */}
            {retiredFamilies.length > 0 && (
              <div style={{ marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setRetiredCollapsed(!retiredCollapsed)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: '0.85rem',
                    outline: 'none'
                  }}
                >
                  {retiredCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                  <span>Retired ({retiredFamilies.length})</span>
                </button>

                {!retiredCollapsed && renderProcessTreeTable(
                  retiredFamilies.map(family => ({ family, formsToShow: [], isExpanded: false })),
                  [],
                  true
                )}
              </div>
            )}
          </div>
        );
      })()}
      </div>

      {rowActionMenu && ReactDOM.createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: rowActionMenu.openUpward ? undefined : `${rowActionMenu.top}px`,
            bottom: rowActionMenu.openUpward ? `${window.innerHeight - rowActionMenu.top}px` : undefined,
            right: `${rowActionMenu.right}px`,
            zIndex: 9998,
            minWidth: '156px',
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
          {rowActionMenu.kind === 'process' ? (
            <>
              {hasPermission('design_document') && (
                <button
                  type="button"
                  onClick={() => {
                    const target = rowActionMenu.proc;
                    setRowActionMenu(null);
                    onEditProcess(target.id);
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
                  <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
                  <span>Edit</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const target = rowActionMenu.proc;
                  setRowActionMenu(null);
                  if (onPrintProcess) {
                    onPrintProcess(target.id);
                  } else {
                    onSelectProcess(target.id);
                  }
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

              {hasPermission('design_document') && (
                <>
                  <div style={{ height: '1px', background: 'var(--neutral-border)', margin: '3px 4px' }} />
                  <button
                    type="button"
                    onClick={() => {
                      const target = rowActionMenu.proc;
                      setRowActionMenu(null);
                      setDeleteTarget({
                        entityType: 'process',
                        id: target.id,
                        title: target.title,
                        version: target.version,
                        note: 'This process and its links will be stored in Trash and can be restored anytime.'
                      });
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
            </>
          ) : rowActionMenu.kind === 'form' ? (
            <>
              {onViewFormSubmissions && (
                <button
                  type="button"
                  onClick={() => {
                    const target = rowActionMenu.form;
                    setRowActionMenu(null);
                    onViewFormSubmissions(target.formName || target.formId);
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
                  <FileText size={13} style={{ color: 'var(--text-secondary)' }} />
                  <span>Submissions</span>
                </button>
              )}

              {hasPermission('design_document') && (
                <>
                  <button
                    type="button"
                    disabled={duplicatingFormId === rowActionMenu.form.formId}
                    onClick={() => {
                      const target = rowActionMenu.form;
                      const procId = rowActionMenu.processId;
                      setRowActionMenu(null);
                      handleDuplicateFormDirect(target, procId);
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
                    <span>{duplicatingFormId === rowActionMenu.form.formId ? 'Duplicating...' : 'Duplicate'}</span>
                  </button>

                  {onOpenReportBuilder && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = rowActionMenu.form;
                        setRowActionMenu(null);
                        const linkedRep = reportTemplates.find(r => r.linkedFormId === target.formId);
                        onOpenReportBuilder(target.formId, linkedRep?.reportId);
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
                      <SlidersHorizontal size={13} style={{ color: 'var(--text-secondary)' }} />
                      <span>Report</span>
                    </button>
                  )}

                  <div style={{ height: '1px', background: 'var(--neutral-border)', margin: '3px 4px' }} />

                  <button
                    type="button"
                    onClick={() => {
                      const target = rowActionMenu.form;
                      setRowActionMenu(null);
                      setDeleteTarget({
                        entityType: 'form',
                        id: target.formId,
                        title: target.formTitle || target.formId,
                        version: target.version,
                        note: target.linkedProcesses.length > 0
                          ? 'Process links, submitted records, and attached photos will be preserved; restoring this form reactivates it automatically.'
                          : 'This form will be stored in Trash and can be restored anytime.'
                      });
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
            </>
          ) : (
            <>
              {onOpenReportBuilder && (
                <button
                  type="button"
                  onClick={() => {
                    const target = rowActionMenu.report;
                    setRowActionMenu(null);
                    onOpenReportBuilder(target.linkedFormId, target.reportId);
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
                  <Edit2 size={13} style={{ color: 'var(--text-secondary)' }} />
                  <span>Edit</span>
                </button>
              )}

              {onOpenReportBuilder && hasPermission('design_document') && (
                <div style={{ height: '1px', background: 'var(--neutral-border)', margin: '3px 4px' }} />
              )}

              {hasPermission('design_document') && (
                <button
                  type="button"
                  onClick={() => {
                    const target = rowActionMenu.report;
                    setRowActionMenu(null);
                    setDeleteTarget({
                      entityType: 'report',
                      id: target.reportId,
                      title: target.reportTitle,
                      version: target.version,
                      note: 'This report template will be stored in Trash and can be restored anytime.'
                    });
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
              )}
            </>
          )}
        </div>,
        document.body
      )}

      {!(isViewingSubmission && viewMode === 'submissions') && (
        <footer className="quote-footer no-print" style={{ marginTop: '2.5rem' }}>
          <span>
            “We believe <strong>common sense</strong> and <strong>simplicity</strong> are usually better guidelines than unnecessary sophistication and complexity.”
          </span>
          <span className="quote-attribution">— AB InBev’s 7<sup>th</sup> principle</span>
        </footer>
      )}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete item?"
        message={
          deleteTarget ? (
            <div>
              Are you sure you want to delete <strong>{deleteTarget.title}</strong> (<code>{deleteTarget.id}</code>)?
              {deleteTarget.note && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {deleteTarget.note}
                </p>
              )}
            </div>
          ) : ''
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="warning"
        loading={deletingTarget}
        onConfirm={handleConfirmSoftDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          background: toast.type === 'success' ? '#0f172a' : '#991b1b',
          color: '#ffffff',
          padding: '0.65rem 1.25rem',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.85rem',
          fontWeight: 500,
          zIndex: 9999,
          animation: 'toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          {toast.type === 'success' ? <Check size={16} style={{ color: '#34d399' }} /> : <span>⚠️</span>}
          <span>{toast.message}</span>
          {toast.undoItem && (
            <button
              type="button"
              onClick={handleUndoSoftDelete}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#5eead4',
                borderRadius: '5px',
                padding: '0.2rem 0.55rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={12} />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
