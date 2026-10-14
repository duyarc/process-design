import React, { useState, useRef } from 'react';
import { ChevronUp, Eye, Edit3 } from 'lucide-react';
import { applyTextFormat, handleFormatKeyDown, insertTextAtCursor, renderFormattedText } from '../../utils/textFormatter';

interface InCanvasGuidanceEditorProps {
  guidance: string;
  isLocked: boolean;
  onUpdateGuidance: (val: string) => void;
  onClose: () => void;
}

export const InCanvasGuidanceEditor: React.FC<InCanvasGuidanceEditorProps> = ({
  guidance,
  isLocked,
  onUpdateGuidance,
  onClose,
}) => {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: '4px',
        marginBottom: '6px',
        padding: '6px 10px',
        background: '#f8fafc',
        border: '1px solid #ccfbf1',
        borderLeft: '3px solid #0d9488',
        borderRadius: '4px',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease'
      }}
    >
      {/* Header bar: Title + Formatting Toolbar + Preview Toggle + Close */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          marginBottom: '6px',
          paddingBottom: '4px',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            💡 HƯỚNG DẪN ĐIỀN
          </span>
          {!isLocked && !isPreview && (
            <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
              <button
                type="button"
                title="In đậm (**text**)"
                onClick={() => applyTextFormat(textareaRef.current, 'bold', guidance, onUpdateGuidance)}
                style={{ width: '20px', height: '20px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                B
              </button>
              <button
                type="button"
                title="In nghiêng (*text*)"
                onClick={() => applyTextFormat(textareaRef.current, 'italic', guidance, onUpdateGuidance)}
                style={{ width: '20px', height: '20px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontStyle: 'italic', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                I
              </button>
              <button
                type="button"
                title="Gạch chân (<u>text</u>)"
                onClick={() => applyTextFormat(textareaRef.current, 'underline', guidance, onUpdateGuidance)}
                style={{ width: '20px', height: '20px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', textDecoration: 'underline', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                U
              </button>
              <button
                type="button"
                title="Chèn gạch đầu dòng (• )"
                onClick={() => insertTextAtCursor(textareaRef.current, '• ', guidance, onUpdateGuidance)}
                style={{ width: '20px', height: '20px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                •
              </button>
              <button
                type="button"
                title="Chèn biểu tượng (💡 )"
                onClick={() => insertTextAtCursor(textareaRef.current, '💡 ', guidance, onUpdateGuidance)}
                style={{ width: '20px', height: '20px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                💡
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!isLocked && (
            <button
              type="button"
              onClick={() => setIsPreview(!isPreview)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
                fontSize: '0.7rem',
                borderRadius: '3px',
                border: '1px solid #cbd5e1',
                background: isPreview ? '#e0f2fe' : '#ffffff',
                color: isPreview ? '#0369a1' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 500
              }}
              title={isPreview ? "Quay lại chế độ soạn thảo" : "Xem trước hiển thị Markdown"}
            >
              {isPreview ? <Edit3 size={11} /> : <Eye size={11} />}
              <span>{isPreview ? 'Soạn thảo' : 'Xem trước'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              borderRadius: '3px',
              border: '1px solid transparent',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer'
            }}
            title="Thu gọn khung hướng dẫn"
          >
            <ChevronUp size={12} />
            <span>Thu gọn</span>
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      {isPreview || isLocked ? (
        <div
          onClick={() => !isLocked && setIsPreview(false)}
          style={{
            fontSize: '0.78rem',
            lineHeight: 1.5,
            color: guidance ? 'var(--text-primary)' : 'var(--text-muted)',
            fontStyle: guidance ? 'normal' : 'italic',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            padding: '4px 2px',
            cursor: !isLocked ? 'pointer' : 'default',
            minHeight: '32px'
          }}
          title={!isLocked ? "Nhấp vào để chỉnh sửa" : undefined}
        >
          {guidance ? renderFormattedText(guidance) : '(Chưa có nội dung hướng dẫn. Nhấp để thêm.)'}
        </div>
      ) : (
        <div style={{ display: 'grid', width: '100%', boxSizing: 'border-box' }}>
          {/* CSS Grid Auto-Grow Mirror Span */}
          <span
            aria-hidden="true"
            style={{
              gridArea: '1 / 1 / 2 / 2',
              visibility: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.78rem',
              lineHeight: 1.45,
              fontFamily: 'inherit',
              padding: '6px 8px',
              minHeight: '60px',
              boxSizing: 'border-box'
            }}
          >
            {(guidance || '') + ' \n'}
          </span>
          <textarea
            ref={textareaRef}
            disabled={isLocked}
            value={guidance}
            placeholder="Nhập hướng dẫn điền, tiêu chí đánh giá, phương pháp thu thập bằng chứng..."
            onKeyDown={(e) => handleFormatKeyDown(e, guidance, onUpdateGuidance)}
            onChange={(e) => onUpdateGuidance(e.target.value)}
            style={{
              gridArea: '1 / 1 / 2 / 2',
              width: '100%',
              height: '100%',
              fontSize: '0.78rem',
              lineHeight: 1.45,
              fontFamily: 'inherit',
              color: 'var(--text-primary)',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              background: '#ffffff',
              outline: 'none',
              padding: '6px 8px',
              boxSizing: 'border-box',
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0d9488';
              e.target.style.boxShadow = '0 0 0 2px rgba(13, 148, 136, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#cbd5e1';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
};

export default InCanvasGuidanceEditor;
