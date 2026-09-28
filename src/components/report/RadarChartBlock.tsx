import React from 'react';
import type { ReportChartItemConfig } from '../../types';
import {
  buildRadarPolygonPoints,
  resolveChartSummaryState,
  sanitizeDemoChartConfig,
  wrapSvgAxisLabel
} from '../../utils/reportChartUtils';

interface RadarChartBlockProps {
  chart: ReportChartItemConfig;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export const RadarChartBlock: React.FC<RadarChartBlockProps> = ({
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

  const viewBoxWidth = 640;
  const viewBoxHeight = 360;
  const cx = viewBoxWidth / 2;
  const cy = viewBoxHeight / 2;
  const radius = 115;

  const { gridRings, axesLines, polygonPoints, dots, labels } =
    buildRadarPolygonPoints(chart.components || [], cx, cy, radius, 5);

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
            🕸 Radar Chart ({chart.components.length}/3 thành phần tối thiểu — Kéo thả Field/Nhóm vào Properties)
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', maxWidth: '640px', height: 'auto', overflow: 'visible' }}
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
            {labels.map((lbl, idx) => {
              const lines = wrapSvgAxisLabel(lbl.title, lbl.scoreText, 20);
              const xStr = lbl.x.toFixed(1);
              const yStr = lbl.y.toFixed(1);
              const firstLineDy =
                lines.length > 1
                  ? lbl.dy === '1.0em'
                    ? '0.55em'
                    : lbl.dy === '-0.4em'
                    ? '-1.1em'
                    : '-0.25em'
                  : lbl.dy;

              return (
                <text
                  key={idx}
                  x={xStr}
                  y={yStr}
                  textAnchor={lbl.anchor}
                  fontSize="11"
                  fill="#0f172a"
                >
                  {lines.length === 1 ? (
                    <tspan x={xStr} dy={firstLineDy}>
                      <tspan fontWeight="700">{lines[0]}</tspan>{' '}
                      <tspan fontWeight="800" fill={lbl.scoreColor}>
                        {lbl.scoreText}
                      </tspan>
                    </tspan>
                  ) : (
                    <>
                      <tspan x={xStr} dy={firstLineDy} fontWeight="700">
                        {lines[0]}
                      </tspan>
                      <tspan x={xStr} dy="1.25em">
                        <tspan fontWeight="700">{lines[1]}</tspan>{' '}
                        <tspan fontWeight="800" fill={lbl.scoreColor}>
                          {lbl.scoreText}
                        </tspan>
                      </tspan>
                    </>
                  )}
                </text>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};
