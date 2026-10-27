import React, { useState, useEffect, useRef } from 'react';
import type { FormFieldISO } from '../../types';
import { Camera, Trash2, Maximize2, X, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

export interface PhotoFieldFillerProps {
  field: FormFieldISO;
  photoKey?: string;
  isUploading?: boolean;
  readOnly?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

/**
 * Dedicated Photo Field Filler component.
 * Features:
 * - Direct R2 image resolution with fallback
 * - Graceful onError handling (no broken image icon)
 * - Fullscreen Lightbox preview on click
 * - Subtraction Design: zero UI garbage, elegant overlay actions
 */
export const PhotoFieldFiller: React.FC<PhotoFieldFillerProps> = ({
  field,
  photoKey,
  isUploading = false,
  readOnly = false,
  onUpload,
  onRemove
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve image source whenever photoKey changes
  useEffect(() => {
    if (!photoKey) {
      setImgSrc('');
      setHasError(false);
      return;
    }

    // Direct URLs (data, blob, http)
    if (photoKey.startsWith('data:') || photoKey.startsWith('blob:') || photoKey.startsWith('http://') || photoKey.startsWith('https://')) {
      setImgSrc(photoKey);
      setHasError(false);
      return;
    }

    // R2 Key: fetch signed downloadUrl
    let isCancelled = false;
    setHasError(false);

    fetch(`/api/storage/download-url?key=${encodeURIComponent(photoKey)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to resolve URL');
        return res.json();
      })
      .then((data) => {
        if (!isCancelled && data.downloadUrl) {
          setImgSrc(data.downloadUrl);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          // Fallback to direct redirect endpoint
          setImgSrc(`/api/storage/view?key=${encodeURIComponent(photoKey)}`);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [photoKey]);

  // Handle Escape key to close Lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    if (!photoKey) return;
    setImgSrc(`/api/storage/view?key=${encodeURIComponent(photoKey)}&t=${Date.now()}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset input so re-selecting same file triggers change
    e.target.value = '';
  };

  const handleRemove = () => {
    if (photoKey && photoKey.startsWith('uploads/')) {
      fetch('/api/storage/delete-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: photoKey })
      }).catch((err) => {
        console.warn('Failed to delete photo from R2:', err);
      });
    }
    onRemove();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100px', position: 'relative' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        disabled={isUploading || readOnly}
        onChange={handleFileChange}
      />

      {photoKey ? (
        <div
          style={{
            flex: 1,
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            background: '#f8fafc',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '110px'
          }}
        >
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#64748b' }}>
              <Loader2 size={20} className="animate-spin" color="var(--primary)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Đang tải ảnh...</span>
            </div>
          ) : hasError ? (
            // Graceful Error Fallback
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px' }}>
              <AlertCircle size={22} color="#ef4444" />
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Không thể tải ảnh</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{
                    fontSize: '0.7rem',
                    padding: '3px 8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '3px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={11} /> Thử lại
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      background: '#f0fdfa',
                      border: '1px solid var(--primary)',
                      borderRadius: '3px',
                      color: 'var(--primary)',
                      cursor: 'pointer'
                    }}
                  >
                    Thay ảnh
                  </button>
                )}
              </div>
            </div>
          ) : (
            // Successfully Rendered Photo
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <img
                src={imgSrc || `/api/storage/view?key=${encodeURIComponent(photoKey)}`}
                alt="Ảnh bằng chứng"
                onError={() => setHasError(true)}
                onClick={() => setIsLightboxOpen(true)}
                style={{
                  maxWidth: '100%',
                  maxHeight: '140px',
                  objectFit: 'contain',
                  borderRadius: '3px',
                  cursor: 'zoom-in',
                  transition: 'opacity 0.15s ease'
                }}
                title="Nhấp để phóng to toàn màn hình"
              />

              {/* Action Toolbar Overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  display: 'flex',
                  gap: '4px'
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.92)',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    width: '26px',
                    height: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#334155',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                  }}
                  title="Xem toàn màn hình"
                >
                  <Maximize2 size={13} />
                </button>

                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'rgba(255, 255, 255, 0.92)',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                      }}
                      title="Thay ảnh khác"
                    >
                      <RefreshCw size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={handleRemove}
                      style={{
                        background: 'rgba(255, 241, 242, 0.92)',
                        border: '1px solid #fecdd3',
                        borderRadius: '4px',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#e11d48',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                      }}
                      title="Xoá ảnh"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Empty State: Minimalist, clean, zero UI garbage
        <div
          onClick={() => !isUploading && !readOnly && fileInputRef.current?.click()}
          style={{
            flex: 1,
            border: '1.5px dashed #cbd5e1',
            borderRadius: '4px',
            background: '#f8fafc',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: readOnly ? 'default' : 'pointer',
            minHeight: '90px',
            transition: 'border-color 0.15s ease, background 0.15s ease',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (!readOnly) {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.background = '#f0fdfa';
            }
          }}
          onMouseLeave={(e) => {
            if (!readOnly) {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.background = '#f8fafc';
            }
          }}
        >
          {isUploading ? (
            <>
              <Loader2 size={20} className="animate-spin" color="var(--primary)" />
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                Đang tải ảnh...
              </span>
            </>
          ) : (
            <>
              <Camera size={22} color="#94a3b8" />
              <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>
                {field.placeholder && field.placeholder !== '[photo]'
                  ? field.placeholder
                  : (readOnly ? 'Chưa có ảnh' : 'Chạm để chụp / tải ảnh')}
              </span>
            </>
          )}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && imgSrc && (
        <div
          onClick={() => setIsLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              style={{
                position: 'absolute',
                top: '-42px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.18)',
                border: 'none',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Đóng (Esc)"
            >
              <X size={18} />
            </button>

            <img
              src={imgSrc}
              alt="Ảnh bằng chứng toàn màn hình"
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '6px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
