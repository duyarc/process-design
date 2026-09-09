import React, { useState, useEffect } from 'react';
import type { Submission } from '../types';
import FormFiller from './FormFiller';
import { CheckCircle2 } from 'lucide-react';

export interface SubmissionViewerProps {
  formName: string;
  submissionId: string;
  token: string;
  initialEditMode?: boolean;
  onBack?: () => void;
}

export const SubmissionViewer: React.FC<SubmissionViewerProps> = ({
  formName,
  submissionId,
  token,
  initialEditMode = false,
  onBack
}) => {
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchSubmission = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/submissions/view/${encodeURIComponent(submissionId)}?token=${encodeURIComponent(token)}`);
      if (res.status === 403 || res.status === 404) {
        // Access denied or not found -> redirect to fill form
        window.location.replace(`/f/${encodeURIComponent(formName)}`);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load submission');
      }
      const data = await res.json();
      setSubmission(data);
      setCanEdit(Boolean(data.canEdit));
      if (!data.canEdit && isEditing) {
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error fetching submission view:', err);
      window.location.replace(`/f/${encodeURIComponent(formName)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, token]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Đang xác thực và tải bản ghi phiếu...
        </div>
      </div>
    );
  }

  if (!submission) {
    return null;
  }

  const effectiveProcessId = submission.processId || 'unlinked';

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0f172a',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem'
        }}>
          <CheckCircle2 size={16} style={{ color: '#10b981' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FormFiller handles the unified executive toolbar & minimalist form canvas */}
      <FormFiller
        processId={effectiveProcessId}
        formName={formName}
        initialSubmission={submission}
        editSubmissionId={submission.id}
        editToken={token}
        canEditSubmission={canEdit}
        initialEditMode={initialEditMode}
        readOnly={true}
        isPublicGuestMode={true}
        onBack={onBack || (() => { window.location.href = `/f/${encodeURIComponent(formName)}`; })}
        onSubmitSuccess={async () => {
          setToastMessage('Đã cập nhật dữ liệu phiếu thành công!');
          await fetchSubmission();
        }}
      />
    </div>
  );
};

export default SubmissionViewer;
