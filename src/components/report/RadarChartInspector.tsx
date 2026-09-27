import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type {
  ChartComponentItem,
  ReportChartItemConfig
} from '../../types';
import {
  getScoreColorHex,
  resolveChartSummaryState
} from '../../utils/reportChartUtils';
import { reorderArray } from '../../utils/formUtils';

export interface ChartDragSourcePayload {
  kind: 'field' | 'group';
  id: string;
  numLabel?: string;
  title: string;
  score: number;
  weight: number;
  children?: {
    fieldId: string;
    title: string;
    score: number;
    weight: number;
  }[];
}

interface RadarChartInspectorProps {
  chart: ReportChartItemConfig;
  isLocked?: boolean;
  onUpdateChart: (updated: ReportChartItemConfig) => void;
  onDeleteChart: () => void;
  onSyncWeightToSource: (fieldOrGroupId: string, newWeight: number) => void;
  onResolveDroppedFieldId?: (fieldId: string) => ChartDragSourcePayload | null;
}

export const RadarChartInspector: React.FC<RadarChartInspectorProps> = ({
  chart,
  isLocked,
  onUpdateChart,
  onDeleteChart,
  onSyncWeightToSource,
  onResolveDroppedFieldId
}) => {
  const [isSummaryDragOver, setIsSummaryDragOver] = useState(false);
  const [isAddDropzoneDragOver, setIsAddDropzoneDragOver] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const { combinedScore, totalWeight } = resolveChartSummaryState(chart);
  const boundField = chart.boundSummaryField || null;

  const parseDropPayload = (e: React.DragEvent): ChartDragSourcePayload | null => {
    const rawChartSource = e.dataTransfer.getData('application/x-report-chart-source');
    if (rawChartSource) {
      try {
        return JSON.parse(rawChartSource) as ChartDragSourcePayload;
      } catch {
        // fallback below
      }
    }
    const rawJson = e.dataTransfer.getData('application/json');
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed?.fieldId && onResolveDroppedFieldId) {
          return onResolveDroppedFieldId(parsed.fieldId);
        }
      } catch {
        // fallback below
      }
    }
    const plainId = e.dataTransfer.getData('text/plain');
    if (plainId && onResolveDroppedFieldId) {
      return onResolveDroppedFieldId(plainId);
    }
    return null;
  };

  // Option B + Option D: Drop into Summary Hybrid Row
  const handleSummaryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsSummaryDragOver(false);
    if (isLocked) return;
    const payload = parseDropPayload(e);
    if (!payload) return;

    if (payload.kind === 'group' && payload.children && payload.children.length > 0) {
      // Option D: Bind group to Summary + Auto-populate all child components into THÀNH PHẦN
      const newComponents: ChartComponentItem[] = payload.children.map((ch, idx) => ({
        id: `ax_${Date.now()}_${idx}`,
        fieldId: ch.fieldId,
        title: ch.title,
        score: ch.score,
        weight: ch.weight
      }));
      onUpdateChart({
        ...chart,
        numLabel: payload.numLabel !== undefined ? payload.numLabel : chart.numLabel,
        boundSummaryField: {
          fieldId: payload.id,
          title: payload.title,
          score: payload.score,
          weight: payload.weight
        },
        components: newComponents
      });
    } else {
      // Option B: Bind single field to Summary Row only
      onUpdateChart({
        ...chart,
        boundSummaryField: {
          fieldId: payload.id,
          title: payload.title,
          score: payload.score,
          weight: payload.weight
        }
      });
    }
  };

  const handleAddComponentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsAddDropzoneDragOver(false);
    if (isLocked) return;
    const payload = parseDropPayload(e);
    if (!payload) return;

    if (payload.kind === 'group' && payload.children && payload.children.length > 0) {
      const added: ChartComponentItem[] = payload.children.map((ch, idx) => ({
        id: `ax_${Date.now()}_${idx}`,
        fieldId: ch.fieldId,
        title: ch.title,
        score: ch.score,
        weight: ch.weight
      }));
      onUpdateChart({
        ...chart,
        components: [...chart.components, ...added]
      });
    } else {
      onUpdateChart({
        ...chart,
        components: [
          ...chart.components,
          {
            id: `ax_${Date.now()}`,
            fieldId: payload.id,
            title: payload.title,
            score: payload.score,
            weight: payload.weight
          }
        ]
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.82rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#0f172a'
          }}
        >
          <span>🕸</span>
          <span>RADAR CHART</span>
        </div>
        <button
          type="button"
          disabled={isLocked}
          onClick={onDeleteChart}
          style={{
            border: 'none',
            background: 'transparent',
            color: isLocked ? 'var(--text-muted)' : 'var(--danger)',
            cursor: isLocked ? 'not-allowed' : 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Xóa biểu đồ Radar"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* PHƯƠNG ÁN B + D: DÒNG HYBRID SUMMARY DROP-SLOT (Căn thẳng cột Điểm 38px | % 48px | Xóa 18px) */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsSummaryDragOver(true);
        }}
        onDragLeave={() => setIsSummaryDragOver(false)}
        onDrop={handleSummaryDrop}
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 38px 48px 18px',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.35rem 0.45rem',
          borderRadius: '6px',
          border: isSummaryDragOver
            ? '1.5px solid var(--primary)'
            : boundField
            ? '1px solid #99f6e4'
            : '1.5px dashed #94a3b8',
          background: isSummaryDragOver
            ? '#ccfbf1'
            : boundField
            ? '#f0fdfa'
            : '#f8fafc',
          transition: 'all 0.15s ease'
        }}
        title="Kéo thả 1 Field hoặc cả nhóm H1/H2 từ cây FIELDS vào đây (Phương án B + D)"
      >
        <input
          type="text"
          disabled={isLocked}
          value={chart.numLabel || ''}
          placeholder="#"
          onChange={e => onUpdateChart({ ...chart, numLabel: e.target.value })}
          style={{
            width: '100%',
            padding: '0.22rem 0.15rem',
            border: '1px solid var(--neutral-border)',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--primary)',
            textAlign: 'center',
            background: '#ffffff',
            outline: 'none'
          }}
          title="Số thứ tự (Bỏ trống để ẩn)"
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: boundField ? '#ffffff' : 'transparent',
            borderRadius: '4px',
            padding: '0.2rem 0.35rem',
            minWidth: 0
          }}
        >
          {boundField && (
            <span style={{ fontSize: '0.68rem', flexShrink: 0, color: 'var(--primary)' }}>🔗</span>
          )}
          <input
            type="text"
            disabled={isLocked}
            value={boundField ? boundField.title : chart.manualTitle || ''}
            placeholder="+ Thả Field hoặc nhập tiêu đề..."
            onChange={e => {
              const val = e.target.value;
              if (boundField) {
                onUpdateChart({
                  ...chart,
                  boundSummaryField: { ...boundField, title: val }
                });
              } else {
                onUpdateChart({ ...chart, manualTitle: val });
              }
            }}
            style={{
              width: '100%',
              border: 'none',
              padding: 0,
              fontSize: '0.73rem',
              fontWeight: 700,
              color: '#0f172a',
              background: 'transparent',
              outline: 'none',
              minWidth: 0
            }}
          />
        </div>

        {/* Cột Điểm (38px) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px' }}>
          <span
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.15rem 0',
              borderRadius: '4px',
              background: boundField ? '#f0fdfa' : '#fffbeb',
              color: boundField ? getScoreColorHex(boundField.score) : '#d97706',
              border: boundField ? '1px solid #ccfbf1' : '1px solid #fef3c7'
            }}
            title={
              boundField
                ? 'Điểm lấy trực tiếp từ Field tổng hợp'
                : 'Điểm tự động tính từ các Thành phần con'
            }
          >
            {(boundField ? boundField.score : combinedScore).toFixed(1)}
          </span>
        </div>

        {/* Cột Trọng số % (48px) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px' }}>
          {boundField ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '0.12rem 0.2rem'
              }}
              title="Thuộc tính weight (%) của Field tổng hợp (Đồng bộ 2 chiều với FIELDS)"
            >
              <input
                type="number"
                min={0}
                max={100}
                disabled={isLocked}
                value={boundField.weight}
                onChange={e => {
                  const w = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  onUpdateChart({
                    ...chart,
                    boundSummaryField: { ...boundField, weight: w }
                  });
                  onSyncWeightToSource(boundField.fieldId, w);
                }}
                style={{
                  width: '26px',
                  border: 'none',
                  background: 'transparent',
                  fontSize: '0.71rem',
                  fontWeight: 700,
                  color: '#0f766e',
                  textAlign: 'right',
                  outline: 'none',
                  padding: 0
                }}
              />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', marginLeft: '1px' }}>
                %
              </span>
            </div>
          ) : (
            <span
              style={{
                width: '100%',
                textAlign: 'center',
                fontSize: '0.71rem',
                fontWeight: 800,
                padding: '0.15rem 0',
                borderRadius: '4px',
                background: totalWeight === 100 ? '#ccfbf1' : '#fef3c7',
                color: totalWeight === 100 ? '#0f766e' : '#b45309'
              }}
            >
              {totalWeight}%
            </span>
          )}
        </div>

        {/* Cột Xóa / Gỡ liên kết (18px) */}
        {boundField ? (
          <button
            type="button"
            disabled={isLocked}
            onClick={() =>
              onUpdateChart({
                ...chart,
                manualTitle: '',
                boundSummaryField: null
              })
            }
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Gỡ liên kết Field tổng hợp (Chuyển về tự tính điểm từ Thành phần)"
          >
            ✕
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* SECTION: THÀNH PHẦN (x) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* Header Row aligned with 38px Score | 48px Weight | 18px Spacer */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 38px 48px 18px',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0 0.45rem',
            border: '1px solid transparent'
          }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#0f172a'
            }}
          >
            THÀNH PHẦN ({chart.components.length})
          </span>
          <span
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.15rem 0',
              borderRadius: '4px',
              color: '#d97706',
              background: '#fffbeb',
              border: '1px solid #fef3c7'
            }}
            title="Điểm trung bình trọng số của các thành phần"
          >
            {combinedScore.toFixed(1)}
          </span>
          <span
            style={{
              width: '100%',
              textAlign: 'center',
              fontSize: '0.71rem',
              fontWeight: 800,
              padding: '0.15rem 0',
              borderRadius: '4px',
              background: totalWeight === 100 ? '#ccfbf1' : '#fef3c7',
              color: totalWeight === 100 ? '#0f766e' : '#b45309'
            }}
            title="Tổng tỷ trọng (%) của các thành phần"
          >
            {totalWeight}%
          </span>
          <span />
        </div>

        {/* Component Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {chart.components.map((item, idx) => (
            <div
              key={item.id}
              draggable={!isLocked}
              onDragStart={e => {
                if ((e.target as HTMLElement).tagName === 'INPUT') {
                  e.preventDefault();
                  return;
                }
                setDraggedIdx(idx);
              }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  onUpdateChart({
                    ...chart,
                    components: reorderArray(chart.components, draggedIdx, idx)
                  });
                }
                setDraggedIdx(null);
              }}
              onDragEnd={() => setDraggedIdx(null)}
              style={{
                display: 'grid',
                gridTemplateColumns: '12px 16px 1fr 38px 48px 18px',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.45rem',
                background: '#ffffff',
                border: '1px solid var(--neutral-border)',
                borderRadius: '6px'
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: '0.75rem', cursor: 'grab' }}>⠿</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>
                {idx + 1}.
              </span>
              <input
                type="text"
                disabled={isLocked}
                value={item.title}
                onChange={e => {
                  const next = chart.components.map((c, i) =>
                    i === idx ? { ...c, title: e.target.value } : c
                  );
                  onUpdateChart({ ...chart, components: next });
                }}
                style={{
                  width: '100%',
                  border: '1px solid transparent',
                  borderRadius: '4px',
                  padding: '0.15rem 0.25rem',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  background: 'transparent',
                  outline: 'none'
                }}
              />
              <span
                style={{
                  width: '38px',
                  textAlign: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.15rem 0',
                  borderRadius: '4px',
                  background: '#f0fdfa',
                  color: getScoreColorHex(item.score)
                }}
              >
                {Number(item.score).toFixed(1)}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '0.12rem 0.2rem'
                }}
                title="Tỷ trọng % (Liên kết 2 chiều với thuộc tính weight của Field)"
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={isLocked}
                  value={item.weight}
                  onChange={e => {
                    const w = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    const next = chart.components.map((c, i) =>
                      i === idx ? { ...c, weight: w } : c
                    );
                    onUpdateChart({ ...chart, components: next });
                    onSyncWeightToSource(item.fieldId, w);
                  }}
                  style={{
                    width: '26px',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '0.71rem',
                    fontWeight: 700,
                    color: '#0f766e',
                    textAlign: 'right',
                    outline: 'none',
                    padding: 0
                  }}
                />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', marginLeft: '1px' }}>
                  %
                </span>
              </div>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  const next = chart.components.filter((_, i) => i !== idx);
                  onUpdateChart({ ...chart, components: next });
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: 0
                }}
                title="Xóa thành phần"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* + Thêm Dropzone */}
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsAddDropzoneDragOver(true);
          }}
          onDragLeave={() => setIsAddDropzoneDragOver(false)}
          onDrop={handleAddComponentDrop}
          style={{
            border: isAddDropzoneDragOver
              ? '1.5px dashed var(--primary)'
              : '1.5px dashed #cbd5e1',
            borderRadius: '6px',
            padding: '0.5rem',
            textAlign: 'center',
            color: 'var(--primary)',
            fontSize: '0.74rem',
            fontWeight: 700,
            background: isAddDropzoneDragOver ? '#ccfbf1' : '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            cursor: 'pointer'
          }}
        >
          <span>+</span>
          <span>Thêm</span>
        </div>
      </div>
    </div>
  );
};
