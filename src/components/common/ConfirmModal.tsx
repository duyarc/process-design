import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertTriangle, Trash2, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;      // Default: "Xác nhận"
  cancelText?: string;       // Default: "Hủy"
  variant?: 'danger' | 'warning' | 'info'; // Default: 'danger'
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {

  // Escape key handler to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  // Variant styles configuration
  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          icon: <AlertTriangle size={24} style={{ color: '#d97706' }} />,
          iconBg: '#fffbeb',
          confirmBtnClass: 'btn-primary', // uses orange/teal primary state depending on layout
          confirmBtnBg: 'var(--warning, #d97706)'
        };
      case 'info':
        return {
          icon: <HelpCircle size={24} style={{ color: '#0d9488' }} />,
          iconBg: '#f0fdfa',
          confirmBtnClass: 'btn-primary',
          confirmBtnBg: 'var(--primary)'
        };
      case 'danger':
      default:
        return {
          icon: <Trash2 size={24} style={{ color: '#dc2626' }} />,
          iconBg: '#fef2f2',
          confirmBtnClass: 'btn-danger',
          confirmBtnBg: 'var(--danger, #dc2626)'
        };
    }
  };

  const vStyles = getVariantStyles();

  return ReactDOM.createPortal(
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '1rem',
        animation: 'confirm-fade-in 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <style>{`
        @keyframes confirm-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes confirm-scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .confirm-modal-card {
          animation: confirm-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div 
        className="paper-card confirm-modal-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '1.5rem',
          borderRadius: 'var(--container-radius, 16px)',
          boxShadow: 'var(--shadow-lg, 0 20px 25px -5px rgba(0, 0, 0, 0.15))',
          backgroundColor: 'var(--neutral-card, #ffffff)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
      >
        {/* Header/Top Right Close Button */}
        {!loading && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #8c939d)',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={18} />
          </button>
        )}

        {/* Modal content layout */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          {/* Icon Circle */}
          <div 
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: vStyles.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {vStyles.icon}
          </div>

          {/* Text content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <h3 
              style={{ 
                margin: 0, 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: 'var(--text-primary, #1f2937)',
                lineHeight: '1.4'
              }}
            >
              {title}
            </h3>
            <div 
              style={{ 
                fontSize: '0.875rem', 
                color: 'var(--text-secondary, #4b5563)',
                lineHeight: '1.5',
                whiteSpace: 'normal',
                wordBreak: 'break-word'
              }}
            >
              {message}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{ 
              padding: '0.5rem 1rem', 
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${vStyles.confirmBtnClass}`}
            onClick={onConfirm}
            disabled={loading}
            style={{ 
              padding: '0.5rem 1.25rem', 
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: variant === 'warning' || variant === 'danger' ? vStyles.confirmBtnBg : undefined,
              borderColor: variant === 'warning' || variant === 'danger' ? vStyles.confirmBtnBg : undefined
            }}
          >
            {loading && (
              <span 
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'confirm-spin 0.6s linear infinite'
                }}
              />
            )}
            <style>{`
              @keyframes confirm-spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
