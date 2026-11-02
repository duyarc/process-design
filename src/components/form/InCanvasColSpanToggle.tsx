import React from 'react';

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

  let currentRatioLabel = '½';
  let titleTooltip = '';
  let nextSpan = 1;

  if (blockColumns === 2) {
    const isSpan2 = isFullWidth || rawSpan === 2;
    currentRatioLabel = isSpan2 ? '2/2' : '½';
    if (isSpan2) {
      nextSpan = 1;
      titleTooltip = 'Độ rộng: Toàn dòng (2/2) — Click để về 1/2 cột';
    } else {
      nextSpan = -1;
      titleTooltip = 'Độ rộng: Chiếm 1/2 dòng — Click để mở rộng toàn dòng';
    }
  } else if (blockColumns === 3) {
    if (isFullWidth || rawSpan === 3) {
      currentRatioLabel = '3/3';
      nextSpan = 1;
      titleTooltip = 'Độ rộng: Toàn dòng (3/3) — Click để về 1/3 cột';
    } else if (rawSpan === 2) {
      currentRatioLabel = '⅔';
      nextSpan = -1;
      titleTooltip = 'Độ rộng: Chiếm 2/3 dòng — Click để mở rộng toàn dòng (3/3)';
    } else {
      currentRatioLabel = '⅓';
      nextSpan = 2;
      titleTooltip = 'Độ rộng: Chiếm 1/3 dòng — Click để mở rộng sang 2/3 cột';
    }
  }

  const isExpanded = currentRatioLabel !== '½' && currentRatioLabel !== '⅓';

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
        justifyContent: 'center',
        width: '22px',
        height: '22px',
        padding: 0,
        fontSize: currentRatioLabel.length > 1 ? '0.62rem' : '0.8rem',
        fontWeight: 700,
        fontFamily: 'inherit',
        background: isExpanded ? '#f0fdfa' : '#ffffff',
        border: `1px solid ${isExpanded ? 'var(--primary)' : '#cbd5e1'}`,
        color: isExpanded ? 'var(--primary)' : '#475569',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        userSelect: 'none',
        flexShrink: 0,
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isExpanded) e.currentTarget.style.borderColor = 'var(--primary)';
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isExpanded) e.currentTarget.style.borderColor = '#cbd5e1';
      }}
    >
      <span>{currentRatioLabel}</span>
    </button>
  );
};

export default InCanvasColSpanToggle;
