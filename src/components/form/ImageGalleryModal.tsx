import React, { useState, useEffect } from 'react';
import { X, Search, Image as ImageIcon, Upload, Check } from 'lucide-react';

interface StorageImageItem {
  key: string;
  name: string;
  size?: number;
  lastModified?: string;
}

interface ImageGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrlOrKey: string) => void;
  currentValue?: string;
}

export const ImageGalleryModal: React.FC<ImageGalleryModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  currentValue = ''
}) => {
  const [images, setImages] = useState<StorageImageItem[]>([]);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    fetch('/api/storage/images')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        const list: StorageImageItem[] = Array.isArray(data.images) ? data.images : [];
        setImages(list);

        // Resolve download URLs for images
        list.forEach(item => {
          if (!resolvedUrls[item.key]) {
            fetch(`/api/storage/download-url?key=${encodeURIComponent(item.key)}`)
              .then(res => res.json())
              .then(urlData => {
                if (urlData.downloadUrl && isMounted) {
                  setResolvedUrls(prev => ({ ...prev, [item.key]: urlData.downloadUrl }));
                }
              })
              .catch(err => console.error('Error resolving image download URL:', err));
          }
        });
      })
      .catch(err => {
        console.error('Error fetching gallery images:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredImages = images.filter(img =>
    img.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    img.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Request presigned upload URL
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLogo: false,
          processId: 'global',
          formName: 'gallery',
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        })
      });

      if (!presignRes.ok) {
        throw new Error('Failed to obtain upload URL');
      }

      const { uploadUrl, key } = await presignRes.json();

      // 2. Upload file directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // 3. Confirm upload
      await fetch('/api/storage/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          fileSize: file.size,
          processId: 'global',
          formName: 'gallery'
        })
      });

      // 4. Select the newly uploaded image immediately
      onSelectImage(key);
      onClose();
    } catch (err) {
      console.error('Error uploading image to gallery:', err);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '680px',
        maxHeight: '82vh',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--neutral-border)',
          paddingBottom: '0.6rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ImageIcon size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Thư viện ảnh đã tải lên (Image Gallery)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar: Search + Quick Upload */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px 6px 28px',
                fontSize: '0.82rem',
                border: '1px solid var(--neutral-border)',
                borderRadius: '4px',
                outline: 'none'
              }}
            />
          </div>

          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '6px 12px',
            fontSize: '0.82rem',
            fontWeight: 600,
            background: 'var(--primary)',
            color: '#ffffff',
            borderRadius: '4px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.7 : 1,
            whiteSpace: 'nowrap'
          }}>
            <Upload size={14} />
            <span>{uploading ? 'Đang tải...' : 'Tải ảnh mới'}</span>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {/* Gallery Content Area */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          minHeight: '260px',
          maxHeight: '52vh',
          padding: '0.25rem'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Đang tải danh sách ảnh từ hệ thống...
            </div>
          ) : filteredImages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              border: '1px dashed var(--neutral-border)',
              borderRadius: '6px'
            }}>
              <ImageIcon size={32} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
              <div>{searchQuery ? 'Không tìm thấy ảnh phù hợp với từ khóa.' : 'Chưa có ảnh nào trong thư viện. Bấm "Tải ảnh mới" để thêm.'}</div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '0.75rem'
            }}>
              {filteredImages.map(img => {
                const resolvedUrl = resolvedUrls[img.key];
                const isSelected = currentValue === img.key || (resolvedUrl && currentValue === resolvedUrl);

                return (
                  <div
                    key={img.key}
                    onClick={() => {
                      onSelectImage(img.key);
                      onClose();
                    }}
                    style={{
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--neutral-border)',
                      borderRadius: '6px',
                      padding: '0.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: isSelected ? '#f0fdf4' : '#f8fafc',
                      transition: 'all 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.background = '#f0fdf4';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--neutral-border)';
                        e.currentTarget.style.background = '#f8fafc';
                      }
                    }}
                    title={img.name}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                      }}>
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}

                    <div style={{
                      width: '100%',
                      height: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#ffffff',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      border: '1px solid var(--neutral-border)'
                    }}>
                      {resolvedUrl ? (
                        <img
                          src={resolvedUrl}
                          alt={img.name}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <ImageIcon size={22} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </div>

                    <div style={{ width: '100%', textAlign: 'center' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {img.name}
                      </div>
                      {img.size ? (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {formatFileSize(img.size)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          borderTop: '1px solid var(--neutral-border)',
          paddingTop: '0.6rem'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{
              padding: '5px 14px',
              fontSize: '0.82rem',
              border: '1px solid var(--neutral-border)',
              borderRadius: '4px',
              background: '#ffffff',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageGalleryModal;
