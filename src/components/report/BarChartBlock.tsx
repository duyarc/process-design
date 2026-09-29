import React from 'react';
import type { ReportChartItemConfig } from '../../types';
import {
  getScoreColorHex,
  resolveChartSummaryState,
  resolveScoreRangeComment,
  sanitizeDemoChartConfig
} from '../../utils/reportChartUtils';

interface BarChartBlockProps {
  chart: ReportChartItemConfig;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export const BarChartBlock: React.FC<BarChartBlockProps> = ({
  chart: rawChart,
  isSelected,
  onSelect
}) => {
  const chart = sanitizeDemoChartConfig(rawChart);
  const {
    displayNum,
    displayTitle,
    activeOverallScore,
    isHeaderVisible
  } = resolveChartSummaryState(chart);

  const overallPercent = Math.min(100, Math.max(0, (activeOverallScore / 5) * 100));
  const overallColorHex = getScoreColorHex(activeOverallScore);
  const activeRange = resolveScoreRangeComment(activeOverallScore, chart.commentRanges);

  return (
    <div
      onClick={onSelect}
      style={{
        width: '100%',
        minWidth: 0,
        padding: '0.25rem 0',
        background: isSelected ? 'rgba(13, 148, 136, 0.03)' : 'transparent',
        borderRadius: '6px',
        cursor: onSelect ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        transition: 'background 0.15s ease'
      }}
    >
      {/* 1. Header: Pill + Title + Overall Score */}
      {isHeaderVisible && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            {displayNum && (
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: overallColorHex,
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {displayNum}
              </div>
            )}
            {displayTitle && (
              <div
                style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.01em'
                }}
              >
                {displayTitle}
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: overallColorHex,
              flexShrink: 0
            }}
          >
            <span>{activeOverallScore.toFixed(1)}</span>
            <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.88rem' }}> / 5</span>
          </div>
        </div>
      )}

      {/* 2. Overall Progress Bar */}
      {(isHeaderVisible || (chart.components && chart.components.length > 0)) && (
        <div
          style={{
            width: '100%',
            height: '8px',
            background: '#e2e8f0',
            borderRadius: '99px',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${overallPercent}%`,
              height: '100%',
              background: overallColorHex,
              borderRadius: '99px',
              transition: 'width 0.25s ease'
            }}
          />
        </div>
      )}

      {/* 3. Commentary Box (Synchronized with active score range) */}
      {activeRange && activeRange.commentText && (
        <div
          style={{
            background: '#f8fafc',
            borderLeft: `3px solid ${overallColorHex}`,
            borderRadius: '0 6px 6px 0',
            padding: '0.55rem 0.75rem',
            fontSize: '0.77rem',
            color: '#334155',
            lineHeight: 1.5
          }}
        >
          {activeRange.commentText}
        </div>
      )}

      {/* 4. Sub-criteria Progress Bars (2-Col Grid) or Empty Placeholder */}
      {!isHeaderVisible && (!chart.components || chart.components.length === 0) ? (
        <div
          style={{
            width: '100%',
            padding: '1.25rem 1rem',
            border: isSelected ? '1.5px dashed var(--primary)' : '1.5px dashed #cbd5e1',
            borderRadius: '6px',
            background: isSelected ? '#f0fdfa' : '#f8fafc',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: isSelected ? 'var(--primary)' : '#64748b',
            textAlign: 'center'
          }}
        >
          📊 Bar Chart (Chưa có dữ liệu thành phần — Kéo thả Field/Nhóm vào Properties)
        </div>
      ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          columnGap: '1.4rem',
          rowGap: '0.7rem',
          marginTop: '0.15rem'
        }}
      >
        {(chart.components || []).map(item => {
          const scoreVal = Number(item.score) || 0;
          const colorHex = getScoreColorHex(scoreVal);
          const pct = Math.min(100, Math.max(0, (scoreVal / 5) * 100));
          return (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}
              >
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ fontSize: '0.65rem', color: '#64748b' }}>•</span>
                  <span>{item.title}</span>
                </span>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    color: colorHex,
                    flexShrink: 0
                  }}
                >
                  {scoreVal.toFixed(1)} / 5
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '5px',
                  background: '#e2e8f0',
                  borderRadius: '99px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: colorHex,
                    borderRadius: '99px',
                    transition: 'width 0.25s ease'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
