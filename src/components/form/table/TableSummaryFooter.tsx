import { useState } from 'react';
import type { LayoutBlockISO, FormFieldISO, ColumnSummaryRowConfig } from '../../../types';
import { buildTableSummaryTypes, calculateTableColumnSummary, formatIsoNumber } from '../../../utils/formUtils';
import { GripVertical, Split, Columns3, Trash2 } from 'lucide-react';
import FooterFieldsTray from './FooterFieldsTray';

interface TableSummaryFooterProps {
  block: LayoutBlockISO;
  bStyle: 'grid' | 'borderless' | 'horizontal_only';
  isLocked: boolean;
  handleReorderTableSummaryRows: (blockId: string, fromIndex: number, toIndex: number, summaryTypes: { id: string }[]) => void;
  handleToggleMergeLeadingEmpty: (blockId: string, summaryId: string, currentMerged: boolean) => void;
  handleRenameTableSummaryRow: (blockId: string, summaryId: string, newLabel: string) => void;
  handleDeleteTableSummaryRow: (blockId: string, summaryId: string) => void;
  handleSetTableColumnSummaryConfig: (
    blockId: string,
    colId: string,
    summaryId: string,
    label: string,
    type: 'sum' | 'percentage' | 'manual' | 'manual_number' | 'manual_text' | 'multiply' | 'sum_all' | 'none',
    extra?: Partial<ColumnSummaryRowConfig>
  ) => void;
  handleAddFooterField: (blockId: string, summaryId: string, type: 'text' | 'select' | 'number' | 'date') => void;
  handleUpdateFooterField: (blockId: string, summaryId: string, fieldId: string, updates: Partial<FormFieldISO>) => void;
  handleDeleteFooterField: (blockId: string, summaryId: string, fieldId: string) => void;
}

/** Hàng chân bảng (tfoot) của khối TABLE trên Canvas: cộng/nhân/tỷ lệ/nhập tay, kéo thả đổi thứ tự, khay Footer Fields. */
export default function TableSummaryFooter({
  block,
  bStyle,
  isLocked,
  handleReorderTableSummaryRows,
  handleToggleMergeLeadingEmpty,
  handleRenameTableSummaryRow,
  handleDeleteTableSummaryRow,
  handleSetTableColumnSummaryConfig,
  handleAddFooterField,
  handleUpdateFooterField,
  handleDeleteFooterField,
}: TableSummaryFooterProps) {
  const [draggedSummaryRow, setDraggedSummaryRow] = useState<{ blockId: string; summaryId: string; index: number } | null>(null);
  const [dragOverSummaryRow, setDragOverSummaryRow] = useState<{ blockId: string; summaryId: string; index: number } | null>(null);
  const [hoveredSummaryRowKey, setHoveredSummaryRowKey] = useState<string | null>(null);
  const [hoveredSummaryCellKey, setHoveredSummaryCellKey] = useState<string | null>(null);
  const [activeAddFooterFieldSummaryId, setActiveAddFooterFieldSummaryId] = useState<string | null>(null);

  const columns = block.tableColumns || [];
  const { summaryTypes, columnsWithSummaries, fallbackColIdx } = buildTableSummaryTypes(columns);
  if (summaryTypes.length === 0) return null;

  return (
    <tfoot style={{ borderTop: bStyle === 'horizontal_only' ? '1.5px solid #0f172a' : bStyle === 'borderless' ? '1px solid #e2e8f0' : '1.5px solid #94a3b8' }}>
      {summaryTypes.map((sumType, idx) => {
        const isLastSummaryRow = idx === summaryTypes.length - 1;
        const rowKey = `${block.id}_${sumType.id}`;
        const isHoveredRow = hoveredSummaryRowKey === rowKey;
        const isDraggingThisRow = draggedSummaryRow?.blockId === block.id && draggedSummaryRow.summaryId === sumType.id;
        const isDragOverThisRow = dragOverSummaryRow?.blockId === block.id && dragOverSummaryRow.summaryId === sumType.id;
        const dragBorderTop = isDragOverThisRow && draggedSummaryRow && draggedSummaryRow.index > idx ? '2px solid var(--primary)' : undefined;
        const rowBorderBottom = isDragOverThisRow && draggedSummaryRow && draggedSummaryRow.index < idx 
          ? '2px solid var(--primary)' 
          : (isLastSummaryRow 
              ? (bStyle === 'horizontal_only' ? '1.5px solid #0f172a' : bStyle === 'borderless' ? '1px solid #e2e8f0' : '1.5px solid #94a3b8')
              : (bStyle === 'horizontal_only' ? '1px solid #e2e8f0' : '1px solid #cbd5e1'));

        const isMergeEnabled = sumType.mergeLeadingEmpty !== false;
        const firstActiveColIdx = columns.findIndex((col: any) => {
          const targetRow = (col.summaryRows || []).find((r: any) => r.id === sumType.id || r.label === sumType.label);
          return targetRow && targetRow.type !== 'none';
        });
        const effectiveFirstSumColIdx = (isMergeEnabled && firstActiveColIdx >= 0)
          ? firstActiveColIdx
          : fallbackColIdx;
        const canToggleMerge = firstActiveColIdx > fallbackColIdx || !isMergeEnabled;

        return (
          <tr
            key={sumType.id || idx}
            onDragOver={(e) => {
              if (draggedSummaryRow?.blockId === block.id) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDragEnter={() => {
              if (draggedSummaryRow?.blockId === block.id) {
                setDragOverSummaryRow({ blockId: block.id, summaryId: sumType.id, index: idx });
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggedSummaryRow?.blockId === block.id && draggedSummaryRow.index !== idx) {
                handleReorderTableSummaryRows(block.id, draggedSummaryRow.index, idx, summaryTypes);
              }
              setDraggedSummaryRow(null);
              setDragOverSummaryRow(null);
            }}
            onDragEnd={() => {
              setDraggedSummaryRow(null);
              setDragOverSummaryRow(null);
            }}
            onMouseEnter={() => !isLocked && setHoveredSummaryRowKey(rowKey)}
            onMouseLeave={() => setHoveredSummaryRowKey(null)}
            style={{
              background: isHoveredRow ? '#f1f5f9' : '#f8fafc',
              fontWeight: 'bold',
              opacity: isDraggingThisRow ? 0.4 : 1,
              height: '34px',
              transition: 'background 0.15s ease, opacity 0.15s ease'
            }}
          >
            {effectiveFirstSumColIdx > 0 && (
              <td colSpan={effectiveFirstSumColIdx} style={{
                position: 'relative',
                padding: '6px 8px',
                paddingLeft: !isLocked ? '24px' : '8px',
                borderRight: bStyle === 'grid' ? '1px solid #cbd5e1' : 'none',
                borderTop: dragBorderTop,
                borderBottom: rowBorderBottom,
                textAlign: 'right',
                color: 'var(--text-secondary)',
                fontSize: '0.82rem'
              }}>
                {!isLocked && (isHoveredRow || isDraggingThisRow) && (
                  <div
                    draggable={summaryTypes.length > 1}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDraggedSummaryRow({ blockId: block.id, summaryId: sumType.id, index: idx });
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    style={{
                      position: 'absolute',
                      left: '4px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 15,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: summaryTypes.length > 1 ? 'grab' : 'default',
                      color: '#64748b',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '3px',
                      padding: '2px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      userSelect: 'none'
                    }}
                    title="Kéo để đổi thứ tự hàng chân bảng"
                  >
                    <GripVertical size={12} style={{ pointerEvents: 'none' }} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }}>
                  {/* Vùng trái: Khay chứa Footer Fields (Tiền tệ, Tỷ giá...) */}
                  <FooterFieldsTray
                    blockId={block.id}
                    sumType={sumType}
                    isLocked={isLocked}
                    isHoveredRow={isHoveredRow}
                    isAddMenuOpen={activeAddFooterFieldSummaryId === sumType.id}
                    onToggleAddMenu={() => setActiveAddFooterFieldSummaryId(activeAddFooterFieldSummaryId === sumType.id ? null : sumType.id)}
                    onCloseAddMenu={() => setActiveAddFooterFieldSummaryId(null)}
                    onAddField={handleAddFooterField}
                    onUpdateField={handleUpdateFooterField}
                    onDeleteField={handleDeleteFooterField}
                  />

                  {/* Vùng phải: Nút tách/gộp & Nhãn hàng cộng */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {!isLocked && canToggleMerge && (
                      <button
                        type="button"
                        onClick={() => handleToggleMergeLeadingEmpty(block.id, sumType.id, isMergeEnabled)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isMergeEnabled ? 'var(--primary)' : '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '3px',
                          opacity: isHoveredRow ? 1 : 0,
                          pointerEvents: isHoveredRow ? 'auto' : 'none',
                          transition: 'opacity 0.15s ease, color 0.15s ease'
                        }}
                        title={isMergeEnabled 
                          ? "Đang gộp các ô trống phía trước. Bấm để tách ô (thêm công thức vào cột trước)" 
                          : "Bấm để gộp các ô trống phía trước vào ô nhãn"}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = isMergeEnabled ? 'var(--primary)' : '#94a3b8'}
                      >
                        {isMergeEnabled ? <Split size={12} /> : <Columns3 size={12} />}
                      </button>
                    )}
                    {!isLocked ? (
                      <input
                        type="text"
                        value={sumType.label}
                        onChange={(e) => handleRenameTableSummaryRow(block.id, sumType.id, e.target.value)}
                        style={{
                          border: 'none',
                          borderBottom: isHoveredRow ? '1px dashed #94a3b8' : '1px dashed transparent',
                          background: 'transparent',
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: '#0f172a',
                          fontSize: '0.82rem',
                          outline: 'none',
                          padding: '1px 2px',
                          transition: 'border-color 0.15s ease'
                        }}
                        placeholder="Nhãn hàng cộng..."
                        title="Nhấp để sửa nhãn hàng cộng"
                      />
                    ) : (
                      <span>{sumType.label}</span>
                    )}
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleDeleteTableSummaryRow(block.id, sumType.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '3px',
                          opacity: isHoveredRow ? 1 : 0,
                          pointerEvents: isHoveredRow ? 'auto' : 'none',
                          transition: 'opacity 0.15s ease'
                        }}
                        title="Xóa hàng cộng tổng này"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>                                            </td>
            )}
            {columns.slice(effectiveFirstSumColIdx).map((col: any, offsetIdx: number) => {
              const actualColIdx = effectiveFirstSumColIdx + offsetIdx;
              const colSumData = columnsWithSummaries.find(c => c.colIdx === actualColIdx);
              const targetRow = colSumData ? (colSumData.rowMap.get(sumType.id) || Array.from(colSumData.rowMap.values()).find((r: any) => r.id === sumType.id)) : null;
              const isLabelColIfFirst = actualColIdx === 0 && effectiveFirstSumColIdx === 0;
              const cellKey = `${block.id}_${sumType.id}_${col.id}`;
              const isHoveredCell = hoveredSummaryCellKey === cellKey;

              if (!targetRow) {
                return (
                  <td
                    key={col.id}
                    onMouseEnter={() => !isLocked && setHoveredSummaryCellKey(cellKey)}
                    onMouseLeave={() => setHoveredSummaryCellKey(null)}
                    style={{
                      position: 'relative',
                      padding: '6px 8px',
                      borderRight: bStyle === 'grid' ? '1px solid #cbd5e1' : 'none',
                      borderTop: dragBorderTop,
                      borderBottom: rowBorderBottom,
                      fontSize: '0.8rem',
                      textAlign: 'right'
                    }}
                  >
                    {isLabelColIfFirst ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        {!isLocked && (isHoveredRow || isDraggingThisRow) && (
                          <div
                            draggable={summaryTypes.length > 1}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              setDraggedSummaryRow({ blockId: block.id, summaryId: sumType.id, index: idx });
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            style={{
                              position: 'absolute',
                              left: '4px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              zIndex: 15,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: summaryTypes.length > 1 ? 'grab' : 'default',
                              color: '#64748b',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '3px',
                              padding: '2px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                              userSelect: 'none'
                            }}
                            title="Kéo để đổi thứ tự hàng chân bảng"
                          >
                            <GripVertical size={12} style={{ pointerEvents: 'none' }} />
                          </div>
                        )}
                        {!isLocked ? (
                          <input
                            type="text"
                            value={sumType.label}
                            onChange={(e) => handleRenameTableSummaryRow(block.id, sumType.id, e.target.value)}
                            style={{
                              border: 'none',
                              borderBottom: isHoveredRow ? '1px dashed #94a3b8' : '1px dashed transparent',
                              background: 'transparent',
                              textAlign: 'right',
                              fontWeight: 'bold',
                              color: '#0f172a',
                              fontSize: '0.82rem',
                              outline: 'none',
                              padding: '1px 2px'
                            }}
                            placeholder="Nhãn hàng cộng..."
                          />
                        ) : (
                          <span>{sumType.label}</span>
                        )}
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTableSummaryRow(block.id, sumType.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '2px',
                              opacity: isHoveredRow ? 1 : 0,
                              pointerEvents: isHoveredRow ? 'auto' : 'none'
                            }}
                            title="Xóa hàng cộng tổng này"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ) : (
                      col.type === 'number' && !isLocked ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: '20px' }}>
                          {isHoveredCell ? (
                            <button
                              type="button"
                              onClick={() => handleSetTableColumnSummaryConfig(block.id, col.id, sumType.id, sumType.label, 'sum')}
                              style={{
                                background: '#ffffff',
                                border: '1px dashed #0d9488',
                                borderRadius: '3px',
                                fontSize: '0.65rem',
                                color: '#0f766e',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '1px 5px',
                                lineHeight: 1.2
                              }}
                              title={`Bấm để cộng cột ${col.label}`}
                            >
                              + ∑
                            </button>
                          ) : (
                            <span style={{ color: '#cbd5e1', userSelect: 'none' }}>—</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1', userSelect: 'none' }}>—</span>
                      )
                    )}
                  </td>
                );
              }

              const dummyVal = calculateTableColumnSummary(col, targetRow, col.summaryRows || [], block.tableRows || [], (rId, cId) => {
                  if (rId === '__footer_field__') {
                    const allFooterFields = (block.tableColumns || []).flatMap((c: any) => (c.summaryRows || []).flatMap((r: any) => r.footerFields || []));
                    const ff = allFooterFields.find((f: any) => f.id === cId);
                    if (ff) {
                      const ph = ff.placeholder ? parseFloat(String(ff.placeholder).replace(/[\s\u00A0,]/g, '')) : 0;
                      return !isNaN(ph) && ph > 0 ? ph : 1;
                    }
                    return 1;
                  }
                  return block.tableData?.[rId]?.[cId];
                });
              const isManualText = targetRow.type === 'manual_text';
              const isManualNumber = targetRow.type === 'manual_number' || targetRow.type === 'manual';
              const cellUnitVal = targetRow.unit || block.cellUnitMap?.[col.id] || col.unit || '';
              const badgeIconText = (targetRow.type === 'manual_text')
                ? 'T'
                : (targetRow.type === 'manual_number' || targetRow.type === 'manual')
                  ? '#'
                  : targetRow.type === 'percentage'
                    ? '%'
                    : targetRow.type === 'multiply'
                      ? '×'
                      : targetRow.type === 'none'
                        ? '—'
                        : '∑';

              const badgeColor = targetRow.type === 'none'
                ? '#94a3b8'
                : (targetRow.type === 'manual_text' || targetRow.type === 'manual_number' || targetRow.type === 'manual')
                  ? '#475569'
                  : '#0f766e';

              return (
                <td key={col.id} style={{
                  padding: '4px 8px',
                  borderRight: bStyle === 'grid' ? '1px solid #cbd5e1' : 'none',
                  borderTop: dragBorderTop,
                  borderBottom: rowBorderBottom,
                  textAlign: 'right',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  verticalAlign: 'middle',
                  height: '34px',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', width: '100%', height: '100%' }}>
                    {!isLocked && (
                      <div
                        style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: '3px',
                          width: '26px',
                          height: '20px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          flexShrink: 0,
                          transition: 'background 0.15s ease, border-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                        title="Đổi công thức tính hoặc kiểu nhập cho ô này"
                      >
                        <span style={{ fontFamily: 'Consolas, "Segoe UI Mono", monospace', fontSize: '0.74rem', fontWeight: 700, color: badgeColor, marginRight: '1px', lineHeight: 1 }}>
                          {badgeIconText}
                        </span>
                        <span style={{ fontSize: '0.48rem', color: '#94a3b8', lineHeight: 1 }}>▾</span>
                        <select
                          value={targetRow.type === 'sum_all' ? 'sum' : targetRow.type}
                          onChange={(e) => {
                            let newType = e.target.value as any;
                            if (newType === 'sum' && idx > 0) {
                              newType = 'sum_all';
                            }
                            handleSetTableColumnSummaryConfig(block.id, col.id, sumType.id, sumType.label, newType);
                          }}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: 0,
                            cursor: 'pointer',
                            width: '100%',
                            height: '100%',
                            zIndex: 2,
                            fontFamily: 'Consolas, "Segoe UI Mono", monospace'
                          }}
                          title="Đổi công thức tính hoặc kiểu nhập cho ô này"
                        >
                          <option value="sum">∑  Cộng</option>
                          <option value="multiply">×  Nhân</option>
                          <option value="percentage">%  Tỷ lệ</option>
                          <option value="manual_number">#  Number</option>
                          <option value="manual_text">T  Text</option>
                          <option value="none">—  Bỏ qua</option>
                        </select>
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '4px',
                      flex: 1,
                      overflow: 'hidden',
                      textAlign: 'right'
                    }}>
                      {targetRow.type === 'none' ? null : isManualText ? (
                        <span style={{ fontWeight: 500, fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                          {targetRow.manualPlaceholder || 'USD, EUR...'}
                        </span>
                      ) : (
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: isManualNumber ? '#64748b' : '#0f172a',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap'
                        }}>
                          {isManualNumber
                            ? (targetRow.manualPlaceholder || '0')
                            : (dummyVal !== null ? formatIsoNumber(dummyVal) : '—')
                          }
                        </span>
                      )}
                      {cellUnitVal && targetRow.type !== 'none' && dummyVal !== null && (
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500, flexShrink: 0 }}>
                          {cellUnitVal}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
              );
            })}
          </tr>
        );
      })}
    </tfoot>
  );
}
