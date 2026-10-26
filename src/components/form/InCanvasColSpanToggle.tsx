import React from 'react';
import { ArrowLeftRight } from 'lucide-react';

export interface InCanvasColSpanToggleProps {
  blockColumns?: number;
  colSpan?: number;
  disabled?: boolean;
  onUpdateColSpan: (newColSpan: number) => void;
}

export const InCanvasColSpanToggle: React.FC<InCanvasColSpanToggleProps> = ({
  blockColumns = 1,
  colSpan,
  disabled = false,
  onUpdateColSpan,
}) => {
  if (blockColumns !== 2 && blockColumns !== 3) {
    return null;
  }

  const rawSpan = colSpan ? Number(colSpan) : 1;
  const isFullWidth = rawSpan === -1 || rawSpan >= blockColumns;

  let currentRatioLabel = '1/1';
  let titleTooltip = '';
  let nextSpan = 1;

  if (blockColumns === 2) {
    const isSpan2 = isFullWidth || rawSpan === 2;
    currentRatioLabel = isSpan2 ? '2/2' : '1/2';
    if (isSpan2) {
      nextSpan = 1;
      titleTooltip = 'Độ rộng: Toàn dòng (2/2) — Click để về 1 cột';
    } else {
      nextSpan = -1;
      titleTooltip = 'Độ rộng: 1 cột (1/2) — Click để mở rộng toàn dòng';
    }
  } else if (blockColumns === 3) {
    if (isFullWidth || rawSpan === 3) {
      currentRatioLabel = '3/3';
      nextSpan = 1;
      titleTooltip = 'Độ rộng: Toàn dòng (3/3) — Click để về 1/3';
    } else if (rawSpan === 2) {
      currentRatioLabel = '2/3';
      nextSpan = -1;
      titleTooltip = 'Độ rộng: 2 cột (2/3) — Click để mở rộng toàn dòng (3/3)';
    } else {
      currentRatioLabel = '1/3';
      nextSpan = 2;
      titleTooltip = 'Độ rộng: 1 cột (1/3) — Click để mở rộng sang 2/3';
    }
  }

  const isExpanded = currentRatioLabel !== '1/2' && currentRatioLabel !== '1/3';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onUpdateColSpan(nextSpan);
      }}
      title={titleTooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 6px',
        fontSize: '0.7rem',
        fontWeight: 600,
        fontFamily: 'monospace, sans-serif',
        background: isExpanded ? '#f0fdfa' : '#ffffff',
        border: `1px solid ${isExpanded ? 'var(--primary)' : '#cbd5e1'}`,
        color: isExpanded ? 'var(--primary)' : '#475569',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        flexShrink: 0,
        height: '22px',
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.borderColor = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isExpanded) e.currentTarget.style.borderColor = '#cbd5e1';
      }}
    >
      <ArrowLeftRight size={10} style={{ opacity: 0.8 }} />
      <span>{currentRatioLabel}</span>
    </button>
  );
};

export default InCanvasColSpanToggle;
