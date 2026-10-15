import React, { useRef } from 'react';
import { GripVertical, ChevronDown, ChevronUp, Plus, Eye, Edit3 } from 'lucide-react';
import type { FormFieldISO } from '../../types';
import { applyTextFormat, handleFormatKeyDown, renderFormattedText } from '../../utils/textFormatter';
import { InCanvasGuidanceEditor } from './InCanvasGuidanceEditor';

export interface InCanvasLabelFieldProps {
  field: FormFieldISO;
  blockId: string;
  fieldIndex: number;
  isFieldSelected: boolean;
  isLocked: boolean;
  canDrag: boolean;
  isPreview: boolean;
  onTogglePreview: () => void;
  onSelectField: () => void;
  onUpdateField: (val: string) => void;
  onStartDrag: (e: React.DragEvent) => void;
  isGuidanceExpanded: boolean;
  onToggleGuidance: () => void;
  onUpdateGuidance: (val: string) => void;
  renderTypeDropdown: React.ReactNode;
}

export const InCanvasLabelField: React.FC<InCanvasLabelFieldProps> = ({
  field,
  isFieldSelected,
  isLocked,
  canDrag,
  isPreview,
  onTogglePreview,
  onSelectField,
  onUpdateField,
  onStartDrag,
  isGuidanceExpanded,
  onToggleGuidance,
  onUpdateGuidance,
  renderTypeDropdown
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleApplyFormat = (formatType: 'bold' | 'italic' | 'underline' | 'bullet') => {
    if (isLocked) return;
    if (isPreview) {
      onTogglePreview();
      setTimeout(() => {
        applyTextFormat(textareaRef.current, formatType, field.checkItem, onUpdateField);
      }, 50);
    } else {
      applyTextFormat(textareaRef.current, formatType, field.checkItem, onUpdateField);
    }
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelectField();
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: '4px',
        boxSizing: 'border-box'
      }}
    >
      {/* Responsive Top Toolbar: Fits in 1 single row when wide, wraps gracefully when narrow */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          width: '100%',
          flexWrap: 'wrap'
        }}
      >
        {/* Left Section: Drag Handle + Formatting Buttons + Preview Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {!isLocked && canDrag && (
            <div
              draggable={true}
              onDragStart={onStartDrag}
              style={{
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                padding: '2px 1px',
                borderRadius: '2px',
                flexShrink: 0,
                userSelect: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.background = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.background = 'transparent';
              }}
              title="Kéo để đổi thứ tự trường"
            >
              <GripVertical size={13} style={{ pointerEvents: 'none' }} />
            </div>
          )}

          {/* Inline Text Formatting Buttons (B, I, U, •) */}
          <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
            <button
              type="button"
              title="In đậm (**text** hoặc Ctrl+B)"
              disabled={isLocked}
              onClick={(e) => {
                e.stopPropagation();
                handleApplyFormat('bold');
              }}
              style={{
                width: '22px',
                height: '22px',
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                fontWeight: 700,
                fontSize: '0.72rem',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)'
              }}
            >
              B
            </button>
            <button
              type="button"
              title="In nghiêng (*text* hoặc Ctrl+I)"
              disabled={isLocked}
              onClick={(e) => {
                e.stopPropagation();
                handleApplyFormat('italic');
              }}
              style={{
                width: '22px',
                height: '22px',
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                fontStyle: 'italic',
                fontSize: '0.72rem',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)'
              }}
            >
              I
            </button>
            <button
              type="button"
              title="Gạch chân (<u>text</u> hoặc Ctrl+U)"
              disabled={isLocked}
              onClick={(e) => {
                e.stopPropagation();
                handleApplyFormat('underline');
              }}
              style={{
                width: '22px',
                height: '22px',
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                textDecoration: 'underline',
                fontSize: '0.72rem',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)'
              }}
            >
              U
            </button>
            <button
              type="button"
              title="Danh sách gạch đầu dòng (* mục hoặc • mục)"
              disabled={isLocked}
              onClick={(e) => {
                e.stopPropagation();
                handleApplyFormat('bullet');
              }}
              style={{
                width: '22px',
                height: '22px',
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                fontSize: '0.85rem',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-primary)'
              }}
            >
              •
            </button>
          </div>

          {/* Preview / Edit Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePreview();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: isPreview ? '#e0f2fe' : '#f8fafc',
              color: isPreview ? '#0369a1' : '#475569',
              border: `1px solid ${isPreview ? '#7dd3fc' : '#cbd5e1'}`,
              borderRadius: '4px',
              padding: '2px 7px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
            title={isPreview ? 'Chuyển sang chế độ soạn thảo' : 'Xem trước định dạng WYSIWYG'}
          >
            {isPreview ? <Edit3 size={11} /> : <Eye size={11} />}
            <span>{isPreview ? 'Soạn thảo' : 'Xem trước'}</span>
          </button>
        </div>

        {/* Right Section: Guidance Button + FieldTypeDropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {field.guidance ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectField();
                onToggleGuidance();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                background: isGuidanceExpanded ? '#f0fdfa' : '#f8fafc',
                border: `1px solid ${isGuidanceExpanded ? '#0d9488' : '#cbd5e1'}`,
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.72rem',
                color: isGuidanceExpanded ? '#0f766e' : '#475569',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              title={isGuidanceExpanded ? 'Thu gọn hướng dẫn' : 'Xem/sửa hướng dẫn'}
            >
              <span>💡</span>
              <span>Hướng dẫn</span>
              {isGuidanceExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          ) : (
            (isFieldSelected || isGuidanceExpanded) && (
              <button
                type="button"
                disabled={isLocked}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectField();
                  onToggleGuidance();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  background: 'transparent',
                  border: '1px dashed #0d9488',
                  borderRadius: '4px',
                  padding: '2px 5px',
                  fontSize: '0.7rem',
                  color: '#0d9488',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  opacity: 0.85,
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                title="Thêm hướng dẫn cho nhãn này"
              >
                <Plus size={10} />
                <span>💡 Hướng dẫn</span>
              </button>
            )
          )}
          {renderTypeDropdown}
        </div>
      </div>

      {/* In-Canvas Guidance Editor Accordion */}
      {isGuidanceExpanded && (
        <InCanvasGuidanceEditor
          guidance={field.guidance || ''}
          isLocked={isLocked}
          onUpdateGuidance={onUpdateGuidance}
          onClose={onToggleGuidance}
        />
      )}

      {/* Content Area: WYSIWYG Formatted View OR Auto-Grow Textarea */}
      {isPreview ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectField();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!isLocked) onTogglePreview();
          }}
          title={isLocked ? undefined : 'Nhấp đúp hoặc bấm nút Soạn thảo để chỉnh sửa'}
          style={{
            width: '100%',
            minHeight: '26px',
            padding: '4px 6px',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            fontFamily: 'inherit',
            color: field.checkItem ? 'var(--text-primary)' : '#94a3b8',
            background: 'transparent',
            borderRadius: '4px',
            border: '1px dashed transparent',
            boxSizing: 'border-box',
            cursor: isLocked ? 'default' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!isLocked) e.currentTarget.style.borderColor = '#cbd5e1';
          }}
          onMouseLeave={(e) => {
            if (!isLocked) e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          {field.checkItem ? (
            renderFormattedText(field.checkItem)
          ) : (
            <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
              [ Nhấp để nhập nội dung nhãn... ]
            </span>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', width: '100%', minHeight: '36px', boxSizing: 'border-box' }}>
          <span
            aria-hidden="true"
            style={{
              gridArea: '1 / 1 / 2 / 2',
              visibility: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              fontFamily: 'inherit',
              padding: '4px 6px',
              minHeight: '36px'
            }}
          >
            {(field.checkItem || '') + '\n '}
          </span>
          <textarea
            ref={textareaRef}
            disabled={isLocked}
            value={field.checkItem}
            placeholder="Nhập nội dung nhãn (hỗ trợ **in đậm**, *in nghiêng*, <u>gạch chân</u>, danh sách gạch đầu dòng * hoặc •)..."
            onClick={(e) => {
              e.stopPropagation();
              onSelectField();
            }}
            onKeyDown={(e) => handleFormatKeyDown(e, field.checkItem, onUpdateField)}
            onChange={(e) => onUpdateField(e.target.value)}
            style={{
              gridArea: '1 / 1 / 2 / 2',
              width: '100%',
              height: '100%',
              fontSize: '0.82rem',
              lineHeight: 1.5,
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              background: '#ffffff',
              outline: 'none',
              padding: '4px 6px',
              margin: 0,
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: isLocked ? 'default' : 'text'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16, 163, 163, 0.15)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
};

export default InCanvasLabelField;
