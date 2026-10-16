import React, { useState, useRef } from 'react';
import { GripVertical, Upload, Link as LinkIcon, Trash2, RefreshCw, FolderOpen } from 'lucide-react';
import type { FormFieldISO } from '../../types';
import { resolveImageSrc } from '../../utils/formUtils';
import ImageGalleryModal from './ImageGalleryModal';

export interface InCanvasImageFieldProps {
  field: FormFieldISO;
  blockId: string;
  fieldIndex: number;
  isFieldSelected: boolean;
  isLocked: boolean;
  canDrag: boolean;
  onSelectField: () => void;
  onUpdateField: (updates: Partial<FormFieldISO>) => void;
  onStartDrag: (e: React.DragEvent) => void;
  renderTypeDropdown: React.ReactNode;
}

const ASPECT_RATIO_PRESETS: { value: NonNullable<FormFieldISO['imageAspectRatio']>; label: string }[] = [
  { value: 'banner', label: 'Banner' },
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: 'auto', label: 'Auto' },
];

const WIDTH_MODE_PRESETS: { value: NonNullable<FormFieldISO['imageWidthMode']>; label: string; title: string }[] = [
  { value: 'full', label: '100% Lề', title: '100% chiều rộng theo lề văn bản' },
  { value: 'bleed', label: 'Tràn mép', title: 'Dãn tràn mép sát viền trang (Full Bleed)' },
  { value: 'fit', label: 'Thu nhỏ', title: 'Thu gọn tỷ lệ vừa phải' },
];

export const InCanvasImageField: React.FC<InCanvasImageFieldProps> = ({
  field,
  isFieldSelected: _isFieldSelected,
  isLocked,
  canDrag,
  onSelectField,
  onUpdateField,
  onStartDrag,
  renderTypeDropdown
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const currentRatio = field.imageAspectRatio || 'banner';
  const currentWidthMode = field.imageWidthMode || 'full';
  const resolvedSrc = resolveImageSrc(field.imageUrl);

  const handleFileUpload = async (file: File) => {
    if (isLocked) return;
    setIsUploading(true);
    try {
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isLogo: false
        })
      });

      if (presignRes.ok) {
        const { uploadUrl, pdfKey } = await presignRes.json();
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/jpeg' },
          body: file
        });
        if (uploadRes.ok) {
          onUpdateField({ imageUrl: pdfKey });
          setIsUploading(false);
          return;
        }
      }

      // Fallback: read as base64 data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onUpdateField({ imageUrl: dataUrl });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Storage upload error, falling back to base64 data URL:', err);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onUpdateField({ imageUrl: dataUrl });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlDraft.trim()) {
      onUpdateField({ imageUrl: urlDraft.trim() });
      setUrlDraft('');
      setShowUrlInput(false);
    }
  };

  const getImageStyle = (): React.CSSProperties => {
    const isBleed = currentWidthMode === 'bleed';
    const isFit = currentWidthMode === 'fit';

    const base: React.CSSProperties = {
      objectFit: 'contain',
      borderRadius: isBleed ? '0' : '4px',
      boxShadow: isBleed ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
      display: 'block'
    };

    if (isFit) {
      return {
        ...base,
        maxWidth: '480px',
        width: '100%',
        aspectRatio: currentRatio === '16:9' ? '16/9' : currentRatio === '4:3' ? '4/3' : currentRatio === '1:1' ? '1/1' : undefined
      };
    }

    return {
      ...base,
      width: '100%',
      height: 'auto',
      aspectRatio: currentRatio === '16:9' ? '16/9' : currentRatio === '4:3' ? '4/3' : currentRatio === '1:1' ? '1/1' : undefined
    };
  };

  return (
    <div
      onClick={onSelectField}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%'
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        disabled={isLocked || isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />

      {/* Header bar: Grip + Title "Image" + Ratio presets + Actions + FieldTypeDropdown */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          flexWrap: 'wrap'
        }}
      >
        {/* Left cluster: Drag handle + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {!isLocked && canDrag && (
            <div
              draggable
              onDragStart={onStartDrag}
              style={{
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                padding: '2px 1px',
                userSelect: 'none'
              }}
              title="Kéo để sắp xếp vị trí"
            >
              <GripVertical size={13} />
            </div>
          )}
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#1e293b' }}>
            Image
          </span>
        </div>

        {/* Center cluster: Aspect ratio pills & Width mode pills */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
          {ASPECT_RATIO_PRESETS.map((p) => {
            const isAct = currentRatio === p.value;
            return (
              <button
                key={p.value}
                type="button"
                disabled={isLocked}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateField({ imageAspectRatio: p.value });
                }}
                style={{
                  fontSize: '0.67rem',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  border: isAct ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                  background: isAct ? 'rgba(16, 163, 163, 0.08)' : '#ffffff',
                  color: isAct ? 'var(--primary)' : '#64748b',
                  fontWeight: isAct ? 600 : 400,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  transition: 'all 0.1s ease'
                }}
                title={`Đặt tỷ lệ khung hình ${p.label}`}
              >
                {p.label}
              </button>
            );
          })}
          <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>|</span>
          {WIDTH_MODE_PRESETS.map((wm) => {
            const isAct = currentWidthMode === wm.value;
            return (
              <button
                key={wm.value}
                type="button"
                disabled={isLocked}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateField({ imageWidthMode: wm.value });
                }}
                style={{
                  fontSize: '0.67rem',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  border: isAct ? '1px solid var(--primary)' : '1px solid #e2e8f0',
                  background: isAct ? 'rgba(16, 163, 163, 0.08)' : '#ffffff',
                  color: isAct ? 'var(--primary)' : '#64748b',
                  fontWeight: isAct ? 600 : 400,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  transition: 'all 0.1s ease'
                }}
                title={wm.title}
              >
                {wm.label}
              </button>
            );
          })}
        </div>

        {/* Right cluster: Change/Remove + FieldTypeDropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {resolvedSrc && !isLocked && (
            <>
              <button
                type="button"
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.68rem',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer'
                }}
                title="Tải ảnh khác thay thế"
              >
                <RefreshCw size={11} className={isUploading ? 'animate-spin' : ''} />
                <span>Đổi ảnh</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowGalleryModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.68rem',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer'
                }}
                title="Chọn ảnh từ thư viện đã tải lên"
              >
                <FolderOpen size={11} />
                <span>Thư viện</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateField({ imageUrl: '' });
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  border: '1px solid #fecaca',
                  background: '#fff1f2',
                  color: '#e11d48',
                  cursor: 'pointer'
                }}
                title="Gỡ ảnh này"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
          {renderTypeDropdown}
        </div>
      </div>

      {/* Main image content area */}
      {resolvedSrc ? (
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#fafafa',
            border: currentWidthMode === 'bleed' ? 'none' : '1px dashed #cbd5e1',
            borderRadius: currentWidthMode === 'bleed' ? '0' : '4px',
            padding: currentWidthMode === 'bleed' ? '0' : '8px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <img
            src={resolvedSrc}
            alt={field.imageCaption || field.checkItem || 'Reference image'}
            style={getImageStyle()}
          />
          {/* Caption input */}
          <input
            type="text"
            disabled={isLocked}
            value={field.imageCaption || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdateField({ imageCaption: e.target.value })}
            placeholder="[ Nhập chú thích hoặc ghi chú ảnh... ]"
            style={{
              border: 'none',
              background: 'transparent',
              textAlign: 'center',
              color: '#475569',
              fontStyle: 'italic',
              fontSize: '0.74rem',
              width: '100%',
              outline: 'none',
              marginTop: '6px',
              padding: '2px 4px'
            }}
          />
        </div>
      ) : (
        /* Dropzone / Upload state */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileUpload(file);
          }}
          style={{
            width: '100%',
            border: isDragOver ? '2px dashed var(--primary)' : '1.5px dashed #cbd5e1',
            borderRadius: '4px',
            background: isDragOver ? 'rgba(16, 163, 163, 0.05)' : '#fafafa',
            padding: '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: isLocked ? 'default' : 'pointer',
            transition: 'all 0.15s ease'
          }}
          onClick={() => {
            if (!isLocked && !showUrlInput) {
              fileInputRef.current?.click();
            }
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
            <Upload size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.76rem', fontWeight: 500 }}>
              {isUploading ? 'Đang tải ảnh...' : 'Kéo thả ảnh vào đây hoặc nhấp để tải lên'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: '#94a3b8', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span>Hỗ trợ JPG, PNG, WEBP, SVG</span>
            <span>•</span>
            <button
              type="button"
              disabled={isLocked}
              onClick={(e) => {
                e.stopPropagation();
                setShowGalleryModal(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '0',
                textDecoration: 'underline',
                fontSize: '0.7rem'
              }}
            >
              <FolderOpen size={11} />
              <span>Chọn từ thư viện</span>
            </button>
            <span>•</span>
            <button
              type="button"
              disabled={isLocked}
              onClick={(e) => {
                e.stopPropagation();
                setShowUrlInput(!showUrlInput);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '0',
                textDecoration: 'underline',
                fontSize: '0.7rem'
              }}
            >
              <LinkIcon size={11} />
              <span>{showUrlInput ? 'Ẩn ô dán link' : 'Dán liên kết ảnh'}</span>
            </button>
          </div>

          {/* Collapsible URL input */}
          {showUrlInput && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                width: '100%',
                maxWidth: '420px',
                marginTop: '4px'
              }}
            >
              <input
                type="text"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyUrl();
                }}
                placeholder="https://example.com/diagram.png hoặc tên file"
                style={{
                  flex: 1,
                  fontSize: '0.74rem',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  border: '1px solid #cbd5e1',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                style={{
                  fontSize: '0.72rem',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>
      )}

      {/* Image Gallery Modal */}
      <ImageGalleryModal
        isOpen={showGalleryModal}
        onClose={() => setShowGalleryModal(false)}
        onSelectImage={(imageUrlOrKey) => {
          onUpdateField({ imageUrl: imageUrlOrKey });
          setShowGalleryModal(false);
        }}
        currentValue={field.imageUrl}
      />
    </div>
  );
};

export default InCanvasImageField;
