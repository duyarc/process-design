import React, { useState, useEffect } from 'react';
import type { Submission } from '../types';
import FormFiller from './FormFiller';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

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
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
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

      {/* Viewer Header Navigation Bar */}
      <div style={{
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--neutral-border)',
        borderRadius: '8px',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onBack || (() => { window.location.href = `/f/${encodeURIComponent(formName)}`; })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={14} /> Về biểu mẫu
          </button>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Phiếu <code style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>{submission.id}</code>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
              • Nộp lúc: {new Date(submission.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}, {new Date(submission.submittedAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {submission.supervisorSignoff ? (
            <span style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              background: 'var(--neutral-bg, #f8fafc)',
              border: '1px solid var(--neutral-border)',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 500
            }}>
              🔒 Đã ký xác nhận ({submission.supervisorSignoff.signedBy})
            </span>
          ) : isEditing ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsEditing(false)}
            >
              Hủy chỉnh sửa
            </button>
          ) : canEdit ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsEditing(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              ✏️ Điều chỉnh phiếu
            </button>
          ) : null}
        </div>
      </div>

      {/* Editing Notice Banner */}
      {isEditing && (
        <div style={{
          background: 'var(--primary-light, #eff6ff)',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '0.75rem 1.25rem',
          fontSize: '0.85rem',
          color: '#1e40af',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>
            ✏️ Bạn đang ở chế độ <strong>điều chỉnh thông tin phiếu</strong>. Hãy cập nhật các trường và nhấn nút lưu ở cuối biểu mẫu.
          </span>
        </div>
      )}

      {/* Render FormFiller */}
      <FormFiller
        processId={effectiveProcessId}
        formName={formName}
        initialSubmission={submission}
        editSubmissionId={isEditing ? submission.id : undefined}
        editToken={isEditing ? token : undefined}
        readOnly={!isEditing}
        isPublicGuestMode={true}
        onSubmitSuccess={async () => {
          setToastMessage('Đã cập nhật dữ liệu phiếu thành công!');
          setIsEditing(false);
          await fetchSubmission();
        }}
      />
    </div>
  );
};

export default SubmissionViewer;
