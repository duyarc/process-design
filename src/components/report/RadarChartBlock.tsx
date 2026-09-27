import React from 'react';
import type { ReportChartItemConfig } from '../../types';
import {
  buildRadarPolygonPoints,
  resolveChartSummaryState
} from '../../utils/reportChartUtils';

interface RadarChartBlockProps {
  chart: ReportChartItemConfig;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export const RadarChartBlock: React.FC<RadarChartBlockProps> = ({
  chart,
  isSelected,
  onSelect
}) => {
  const {
    displayNum,
    displayTitle,
    activeOverallScore,
    isHeaderVisible
  } = resolveChartSummaryState(chart);

  const viewBoxWidth = 560;
  const viewBoxHeight = 360;
  const cx = viewBoxWidth / 2;
  const cy = viewBoxHeight / 2;
  const radius = 120;

  const { gridRings, axesLines, polygonPoints, dots, labels } =
    buildRadarPolygonPoints(chart.components || [], cx, cy, radius, 5);

  return (
    <div
      onClick={onSelect}
      style={{
        gridColumn: '1 / -1',
        width: '100%',
        padding: '0.25rem 0',
        background: isSelected ? 'rgba(13, 148, 136, 0.03)' : 'transparent',
        borderRadius: '6px',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background 0.15s ease'
      }}
    >
      {isHeaderVisible && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            {displayNum && (
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
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
              color: 'var(--primary)',
              flexShrink: 0
            }}
          >
            <span>{activeOverallScore.toFixed(1)}</span>
            <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.88rem' }}> / 5</span>
          </div>
        </div>
      )}

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {chart.components.length < 3 ? (
          <div
            style={{
              padding: '1.5rem',
              fontSize: '0.78rem',
              color: '#64748b',
              textAlign: 'center'
            }}
          >
            (Cần ít nhất 3 thành phần để vẽ biểu đồ Radar)
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', maxWidth: '560px', height: 'auto' }}
          >
            {gridRings.map((pts, idx) => (
              <polygon
                key={idx}
                points={pts}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            ))}
            {axesLines.map((ln, idx) => (
              <line
                key={idx}
                x1={ln.x1}
                y1={ln.y1}
                x2={ln.x2.toFixed(1)}
                y2={ln.y2.toFixed(1)}
                stroke="#cbd5e1"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
            ))}
            <polygon
              points={polygonPoints}
              fill="rgba(13, 148, 136, 0.16)"
              stroke="#0d9488"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {dots.map((d, idx) => (
              <circle
                key={idx}
                cx={d.x.toFixed(1)}
                cy={d.y.toFixed(1)}
                r="4.2"
                fill="#ffffff"
                stroke="#0d9488"
                strokeWidth="2.2"
              />
            ))}
            {labels.map((lbl, idx) => (
              <text
                key={idx}
                x={lbl.x.toFixed(1)}
                y={lbl.y.toFixed(1)}
                textAnchor={lbl.anchor}
                dy={lbl.dy}
                fontSize="11"
                fill="#0f172a"
              >
                <tspan fontWeight="700">{lbl.title}</tspan>{' '}
                <tspan fontWeight="800" fill={lbl.scoreColor}>
                  {lbl.scoreText}
                </tspan>
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
};
