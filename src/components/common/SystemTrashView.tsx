import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trash2, RotateCcw, GitBranch, FileText, ClipboardList, BarChart2, X } from 'lucide-react';
import type { TrashEntityType, TrashItem, TrashCounts } from '../../types';
import ConfirmModal from './ConfirmModal';

interface SystemTrashViewProps {
  searchQuery: string;
  isAdmin: boolean;
  onDataChanged: () => void;
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void;
}

const ENTITY_META: Record<TrashEntityType, { label: string; bg: string; color: string; border: string; Icon: React.FC<{ size?: number }> }> = {
  process: { label: 'Process', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', Icon: GitBranch },
  form: { label: 'Form', bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4', Icon: FileText },
  submission: { label: 'Submission', bg: '#fef3c7', color: '#92400e', border: '#fde68a', Icon: ClipboardList },
  report: { label: 'Report', bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff', Icon: BarChart2 }
};

/**
 * Unified system-wide Recycle Bin table with type filters, 1-click restore,
 * and Admin-only permanent delete / empty trash controls.
 */
export default function SystemTrashView({
  searchQuery,
  isAdmin,
  onDataChanged,
  onToast
}: SystemTrashViewProps) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [counts, setCounts] = useState<TrashCounts>({ total: 0, process: 0, form: 0, submission: 0, report: 0 });
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<'all' | TrashEntityType>('all');
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [permanentTarget, setPermanentTarget] = useState<TrashItem | null>(null);
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [processingDanger, setProcessingDanger] = useState(false);

  const fetchTrash = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/trash');
      if (!res.ok) throw new Error('Unable to load Trash');
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.counts) {
        setCounts(data.counts);
      }
    } catch (err) {
      console.error(err);
      onToast({ message: err instanceof Error ? err.message : 'Failed to load Trash', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      if (!isAdmin && item.entityType === 'submission') return false;
      if (activeType !== 'all' && item.entityType !== activeType) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        (item.subtitle || '').toLowerCase().includes(q) ||
        (item.deletedBy || '').toLowerCase().includes(q)
      );
    });
  }, [items, isAdmin, activeType, searchQuery]);

  const getItemKey = (item: TrashItem) => `${item.entityType}:${item.id}:${item.version || 'all'}`;

  const handleRestore = async (item: TrashItem) => {
    const key = getItemKey(item);
    try {
      setRestoringKey(key);
      const res = await fetch('/api/trash/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: item.entityType,
          id: item.id,
          version: item.isPartialVersion ? item.version : undefined
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to restore item');
      }
      onToast({ message: `Restored "${item.title}".`, type: 'success' });
      await fetchTrash();
      onDataChanged();
    } catch (err) {
      console.error(err);
      onToast({ message: err instanceof Error ? err.message : 'Error restoring selected item', type: 'error' });
    } finally {
      setRestoringKey(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentTarget || !isAdmin) return;
    try {
      setProcessingDanger(true);
      const res = await fetch('/api/trash/permanent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: permanentTarget.entityType,
          id: permanentTarget.id,
          version: permanentTarget.isPartialVersion ? permanentTarget.version : undefined
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Unable to delete permanently');
      }
      const deletedTitle = permanentTarget.title;
      setPermanentTarget(null);
      onToast({ message: `Permanently deleted "${deletedTitle}".`, type: 'success' });
      await fetchTrash();
      onDataChanged();
    } catch (err) {
      console.error(err);
      onToast({ message: err instanceof Error ? err.message : 'Error permanently deleting item', type: 'error' });
    } finally {
      setProcessingDanger(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!isAdmin) return;
    try {
      setProcessingDanger(true);
      const res = await fetch(`/api/trash/empty?type=${encodeURIComponent(activeType)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Unable to empty Trash');
      }
      setConfirmEmptyOpen(false);
      onToast({ message: 'Trash emptied.', type: 'success' });
      await fetchTrash();
      onDataChanged();
    } catch (err) {
      console.error(err);
      onToast({ message: err instanceof Error ? err.message : 'Error emptying Trash', type: 'error' });
    } finally {
      setProcessingDanger(false);
    }
  };

  const filterTabs: Array<{ key: 'all' | TrashEntityType; label: string; count: number; adminOnly?: boolean }> = [
    { key: 'all', label: 'All', count: isAdmin ? counts.total : counts.total - counts.submission },
    { key: 'process', label: 'Processes', count: counts.process },
    { key: 'form', label: 'Forms', count: counts.form },
    { key: 'submission', label: 'Submissions', count: counts.submission, adminOnly: true },
    { key: 'report', label: 'Reports', count: counts.report }
  ];

  const getPermanentWarning = (item: TrashItem) => {
    if (item.entityType === 'process') {
      return 'Note: Permanently deleting a Process may cascade-delete directly linked submission records in the database.';
    }
    if (item.entityType === 'submission') {
      return 'Note: All attached R2 photo evidence will also be permanently deleted.';
    }
    return 'This action permanently deletes the data and cannot be undone.';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filter Pills + Admin Empty Trash Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {filterTabs
            .filter(t => !t.adminOnly || isAdmin)
            .map(tab => {
              const isActive = activeType === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveType(tab.key)}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    borderRadius: '16px',
                    padding: '0.28rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 600 : 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    margin: 0
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    opacity: isActive ? 0.9 : 0.75
                  }}>
                    ({tab.count})
                  </span>
                </button>
              );
            })}
        </div>

        {isAdmin && visibleItems.length > 0 && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setConfirmEmptyOpen(true)}
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              padding: '0.35rem 0.85rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0
            }}
          >
            <Trash2 size={13} />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {/* Main Trash Table */}
      {loading ? (
        <div className="paper-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          Loading trash...
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="paper-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Trash2 size={44} style={{ color: 'var(--text-muted)', marginBottom: '0.85rem', opacity: 0.45 }} />
          <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            Trash is empty
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {searchQuery ? 'No items match your search.' : 'Deleted items will appear here for safe recovery.'}
          </p>
        </div>
      ) : (
        <div className="paper-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--neutral-border)', marginBottom: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--neutral-border)', background: '#fafbfc', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'left', fontWeight: 600, width: '12%' }}>Type</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '16%' }}>ID</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '36%' }}>Title & Details</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, width: '18%' }}>Deleted</th>
                  <th style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 600, width: '18%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item, idx) => {
                  const meta = ENTITY_META[item.entityType];
                  const Icon = meta.Icon;
                  const itemKey = getItemKey(item);
                  const isRestoring = restoringKey === itemKey;
                  const deletedTime = item.deletedAt
                    ? new Date(item.deletedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
                    : '—';

                  return (
                    <tr
                      key={itemKey}
                      style={{ borderBottom: idx === visibleItems.length - 1 ? 'none' : '1px solid var(--neutral-border)', transition: 'background 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '0.65rem 1rem', verticalAlign: 'middle' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                          borderRadius: '4px',
                          padding: '0.15rem 0.45rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}>
                          <Icon size={12} />
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--text-muted)',
                          background: '#f1f5f9',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                          fontFamily: 'monospace'
                        }}>
                          {item.id}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            {item.subtitle}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle', fontSize: '0.78rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        <div>{deletedTime}</div>
                        {item.deletedBy && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>by {item.deletedBy}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                          <button
                            type="button"
                            disabled={isRestoring}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRestore(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.28rem 0.65rem',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              color: '#0f766e',
                              borderColor: '#99f6e4',
                              background: '#f0fdfa',
                              height: '28px',
                              margin: 0
                            }}
                          >
                            <RotateCcw size={12} />
                            <span>{isRestoring ? 'Restoring...' : 'Restore'}</span>
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Delete permanently"
                              onClick={() => setPermanentTarget(item)}
                              style={{
                                padding: 0,
                                width: '28px',
                                height: '28px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                color: '#dc2626',
                                margin: 0
                              }}
                            >
                              <X size={13} />
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
      )}

      {/* Confirm Permanent Delete (Single Item - Admin Only) */}
      <ConfirmModal
        isOpen={Boolean(permanentTarget)}
        title="Delete Permanently?"
        message={
          permanentTarget ? (
            <div>
              Are you sure you want to permanently delete <strong>{permanentTarget.title}</strong> (<code>{permanentTarget.id}</code>)?
              <p style={{ margin: '0.5rem 0 0', color: 'var(--danger)', fontWeight: 500, fontSize: '0.8rem' }}>
                {getPermanentWarning(permanentTarget)}
              </p>
            </div>
          ) : ''
        }
        confirmText="Delete Permanently"
        cancelText="Cancel"
        variant="danger"
        loading={processingDanger}
        onConfirm={handlePermanentDelete}
        onCancel={() => setPermanentTarget(null)}
      />

      {/* Confirm Empty Trash (Admin Only) */}
      <ConfirmModal
        isOpen={confirmEmptyOpen}
        title="Empty Trash?"
        message={
          <div>
            All <strong>{visibleItems.length}</strong> visible items in Trash will be permanently deleted from the database (including any attached R2 photo evidence).
            <p style={{ margin: '0.5rem 0 0', color: 'var(--danger)', fontWeight: 500, fontSize: '0.8rem' }}>
              * This action cannot be undone.
            </p>
          </div>
        }
        confirmText="Empty Trash"
        cancelText="Cancel"
        variant="danger"
        loading={processingDanger}
        onConfirm={handleEmptyTrash}
        onCancel={() => setConfirmEmptyOpen(false)}
      />
    </div>
  );
}
