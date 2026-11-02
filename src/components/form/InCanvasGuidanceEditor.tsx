import React, { useRef } from 'react';
import { applyTextFormat, handleFormatKeyDown, insertTextAtCursor } from '../../utils/textFormatter';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: '4px',
        marginBottom: '4px',
        padding: '6px 8px',
        background: '#f8fafc',
        border: '1px solid #ccfbf1',
        borderLeft: '3px solid #0d9488',
        borderRadius: '4px',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease'
      }}
    >
      {/* Top micro toolbar: 💡 icon + format tools (B, I, U, •) + Close */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          marginBottom: '4px'
        }}
      >
        <span style={{ fontSize: '0.8rem', lineHeight: 1, userSelect: 'none' }}>💡</span>
        {!isLocked && (
          <div style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
            <button
              type="button"
              title="In đậm (**text**)"
              onClick={() => applyTextFormat(textareaRef.current, 'bold', guidance, onUpdateGuidance)}
              style={{ width: '19px', height: '19px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              B
            </button>
            <button
              type="button"
              title="In nghiêng (*text*)"
              onClick={() => applyTextFormat(textareaRef.current, 'italic', guidance, onUpdateGuidance)}
              style={{ width: '19px', height: '19px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontStyle: 'italic', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              I
            </button>
            <button
              type="button"
              title="Gạch chân (<u>text</u>)"
              onClick={() => applyTextFormat(textareaRef.current, 'underline', guidance, onUpdateGuidance)}
              style={{ width: '19px', height: '19px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', textDecoration: 'underline', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              U
            </button>
            <button
              type="button"
              title="Chèn gạch đầu dòng (• )"
              onClick={() => insertTextAtCursor(textareaRef.current, '• ', guidance, onUpdateGuidance)}
              style={{ width: '19px', height: '19px', border: '1px solid #cbd5e1', borderRadius: '3px', background: '#ffffff', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              •
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng hướng dẫn"
              style={{ width: '19px', height: '19px', border: 'none', borderRadius: '3px', background: 'transparent', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '2px' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Editor Content Area: Auto-Grow Textarea */}
      <div style={{ display: 'grid', width: '100%', boxSizing: 'border-box' }}>
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
            padding: '4px 6px',
            minHeight: '44px',
            boxSizing: 'border-box'
          }}
        >
          {(guidance || '') + ' \n'}
        </span>
        <textarea
          ref={textareaRef}
          disabled={isLocked}
          value={guidance}
          placeholder="Nhập tiêu chí đánh giá, hướng dẫn điền, minh chứng..."
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
            padding: '4px 6px',
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
    </div>
  );
};

export default InCanvasGuidanceEditor;
