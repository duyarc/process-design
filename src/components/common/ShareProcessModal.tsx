import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, ExternalLink, QrCode } from 'lucide-react';
import { toFormSlug } from '../../utils/formUtils';

export interface AttachedFormShareItem {
  formId: string;
  formTitle: string;
  formSlug: string;
  isPublic: boolean;
  publicPermission: 'fill' | 'view';
}

interface ShareProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  processId: string;
  processTitle: string;
  initialIsPublic: boolean;
  attachedForms: AttachedFormShareItem[];
  onSaveShareSettings: (newIsPublic: boolean, updatedForms: AttachedFormShareItem[]) => Promise<void>;
}

export const ShareProcessModal: React.FC<ShareProcessModalProps> = ({
  isOpen,
  onClose,
  processId,
  processTitle,
  initialIsPublic,
  attachedForms: initialAttachedForms,
  onSaveShareSettings
}) => {
  const [isPublic, setIsPublic] = useState<boolean>(initialIsPublic);
  const [formsList, setFormsList] = useState<AttachedFormShareItem[]>(initialAttachedForms);
  const [copiedProcessLink, setCopiedProcessLink] = useState(false);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsPublic(initialIsPublic);
    setFormsList(initialAttachedForms);
  }, [initialIsPublic, initialAttachedForms, isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const origin = window.location.origin;
  const processSlug = toFormSlug(processTitle) || processId;
  const processUrl = `${origin}/p/${processSlug}`;

  const handleToggleProcessPublic = async (newVal: boolean) => {
    setIsPublic(newVal);
    try {
      setSaving(true);
      await onSaveShareSettings(newVal, formsList);
    } catch (err) {
      console.error('Failed to save process public status:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFormPermission = async (formId: string, state: 'internal' | 'view' | 'fill') => {
    const updated = formsList.map(f => {
      if (f.formId === formId) {
        if (state === 'internal') {
          return { ...f, isPublic: false, publicPermission: 'fill' as const };
        } else if (state === 'view') {
          return { ...f, isPublic: true, publicPermission: 'view' as const };
        } else {
          return { ...f, isPublic: true, publicPermission: 'fill' as const };
        }
      }
      return f;
    });

    setFormsList(updated);

    try {
      setSaving(true);
      await onSaveShareSettings(isPublic, updated);
    } catch (err) {
      console.error('Failed to save form permission:', err);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, isProcess = true, formId?: string) => {
    navigator.clipboard.writeText(text);
    if (isProcess) {
      setCopiedProcessLink(true);
      setTimeout(() => setCopiedProcessLink(false), 2000);
    } else if (formId) {
      setCopiedFormId(formId);
      setTimeout(() => setCopiedFormId(null), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div 
        className="paper-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#ffffff',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--neutral-border)'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--neutral-border)',
          background: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Share2 size={18} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Chia sẻ Quy trình & Biểu mẫu đính kèm
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', maxHeight: 'calc(85vh - 120px)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Card 1: Process URL & Sharing Scope */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--neutral-border)',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                QUYỀN TRUY CẬP QUY TRÌNH (SOP)
              </span>

              {/* 2-Way Segmented Control */}
              <div style={{
                display: 'flex',
                background: '#e2e8f0',
                borderRadius: '6px',
                padding: '2px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => handleToggleProcessPublic(false)}
                  style={{
                    border: 'none',
                    background: !isPublic ? '#ffffff' : 'transparent',
                    color: !isPublic ? '#475569' : 'var(--text-secondary)',
                    fontWeight: !isPublic ? 700 : 500,
                    fontSize: '0.74rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: !isPublic ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🔒 Nội bộ
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleProcessPublic(true)}
                  style={{
                    border: 'none',
                    background: isPublic ? '#ffffff' : 'transparent',
                    color: isPublic ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: isPublic ? 700 : 500,
                    fontSize: '0.74rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: isPublic ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🌐 Công khai
                </button>
              </div>
            </div>

            {/* URL Box */}
            <div style={{
              display: 'flex',
              alignItems: 'stretch',
              border: '1px solid var(--neutral-border)',
              borderRadius: '6px',
              background: '#ffffff',
              overflow: 'hidden',
              marginTop: '0.4rem'
            }}>
              <input
                type="text"
                readOnly
                value={processUrl}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: isPublic ? 'var(--text-primary)' : 'var(--text-muted)',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => copyToClipboard(processUrl, true)}
                style={{
                  border: 'none',
                  borderLeft: '1px solid var(--neutral-border)',
                  background: copiedProcessLink ? '#dcfce7' : '#ffffff',
                  color: copiedProcessLink ? '#15803d' : 'var(--text-primary)',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  transition: 'background 0.15s ease'
                }}
              >
                {copiedProcessLink ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedProcessLink ? 'Đã sao chép!' : 'Sao chép link SOP'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Attached Forms List & Permissions */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                BIỂU MẪU ĐÍNH KÈM VÀ QUYỀN THAO TÁC ({formsList.length} BIỂU MẪU)
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Slug bất biến <code>/f/:slug</code>
              </span>
            </div>

            {formsList.length === 0 ? (
              <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--neutral-border)', borderRadius: '6px' }}>
                Quy trình này hiện chưa có biểu mẫu nghiệp vụ nào được gắn kết.
              </div>
            ) : (
              <div style={{ border: '1px solid var(--neutral-border)', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                {formsList.map((form) => {
                  const formState = !form.isPublic ? 'internal' : (form.publicPermission === 'view' ? 'view' : 'fill');
                  const formSlug = form.formSlug || toFormSlug(form.formTitle) || form.formId;
                  const formUrl = `${origin}/f/${formSlug}`;
                  const isCopied = copiedFormId === form.formId;

                  return (
                    <div
                      key={form.formId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0.85rem',
                        borderBottom: '1px solid var(--neutral-border)',
                        gap: '1rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: '200px', flex: '1 1 200px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          📄 {form.formTitle || form.formId}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            /f/{formSlug}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(formUrl, false, form.formId)}
                            title="Sao chép link biểu mẫu này"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: '1px 4px',
                              cursor: 'pointer',
                              color: isCopied ? '#15803d' : 'var(--text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            {isCopied ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>

                      {/* 3-Way Segmented Control */}
                      <div style={{
                        display: 'flex',
                        background: '#f1f5f9',
                        border: '1px solid var(--neutral-border)',
                        borderRadius: '6px',
                        padding: '2px',
                        gap: '2px',
                        width: '240px',
                        flexShrink: 0
                      }}>
                        <button
                          type="button"
                          onClick={() => handleUpdateFormPermission(form.formId, 'internal')}
                          style={{
                            flex: 1,
                            border: 'none',
                            background: formState === 'internal' ? '#ffffff' : 'transparent',
                            color: formState === 'internal' ? '#475569' : 'var(--text-secondary)',
                            fontWeight: formState === 'internal' ? 700 : 500,
                            fontSize: '0.72rem',
                            padding: '0.35rem 0.2rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            boxShadow: formState === 'internal' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.2rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          🔒 Nội bộ
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateFormPermission(form.formId, 'view')}
                          style={{
                            flex: 1,
                            border: 'none',
                            background: formState === 'view' ? '#ffffff' : 'transparent',
                            color: formState === 'view' ? '#0284c7' : 'var(--text-secondary)',
                            fontWeight: formState === 'view' ? 700 : 500,
                            fontSize: '0.72rem',
                            padding: '0.35rem 0.2rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            boxShadow: formState === 'view' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.2rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          👁️ Chỉ xem
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateFormPermission(form.formId, 'fill')}
                          style={{
                            flex: 1,
                            border: 'none',
                            background: formState === 'fill' ? '#ffffff' : 'transparent',
                            color: formState === 'fill' ? 'var(--primary)' : 'var(--text-secondary)',
                            fontWeight: formState === 'fill' ? 700 : 500,
                            fontSize: '0.72rem',
                            padding: '0.35rem 0.2rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            boxShadow: formState === 'fill' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.2rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          📝 Cho điền
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* QR Code collapsible */}
          {showQr && (
            <div style={{
              background: '#ffffff',
              border: '1px solid var(--neutral-border)',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              animation: 'fadeIn 0.2s ease'
            }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(processUrl)}`}
                alt="QR Code"
                style={{ width: '160px', height: '160px', borderRadius: '4px' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                Quét mã để mở Quy trình trên thiết bị di động
              </span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid var(--neutral-border)',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowQr(!showQr)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            >
              <QrCode size={13} />
              <span>{showQr ? 'Ẩn mã QR' : 'Mã QR'}</span>
            </button>
            <a
              href={processUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem', textDecoration: 'none' }}
            >
              <ExternalLink size={13} />
              <span>Mở xem thử</span>
            </a>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              try {
                setSaving(true);
                await onSaveShareSettings(isPublic, formsList);
                onClose();
              } catch (e) {
                console.error(e);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
          >
            {saving ? 'Đang lưu...' : 'Hoàn tất'}
          </button>
        </div>
      </div>
    </div>
  );
};
