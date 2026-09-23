import React from 'react';
import type { FormTemplateISO } from '../../types';
import { formatFormVersion } from '../../types';
import { getEffectiveTitleFormat, getInfoGridTemplateColumns, isSeamlessTableBlock } from '../../utils/formUtils';
import { renderFormattedText } from '../../utils/textFormatter';
import { FileText } from 'lucide-react';

interface FormReferenceCanvasProps {
  form: FormTemplateISO;
  selectedFieldId: string | null;
  activeBlockId?: string | null;
  onSelectField: (fieldId: string) => void;
  onSelectBlock?: (blockId: string) => void;
  onDeselect: () => void;
}

export const FormReferenceCanvas: React.FC<FormReferenceCanvasProps> = ({
  form,
  selectedFieldId,
  activeBlockId,
  onSelectField,
  onSelectBlock,
  onDeselect
}) => {
  const pageSize = form.pageSize || (form as any).page_size || 'A4';
  const isA5 = pageSize === 'A5_LANDSCAPE';
  const blocks = form.layoutBlocks || [];

  return (
    <div
      onClick={onDeselect}
      style={{
        flex: 1,
        background: '#f1f5f9',
        overflowY: 'auto',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: 'default',
        width: '100%'
      }}
    >
      {/* A4/A5 Sheet Container */}
      <div
        className="paper-card"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onDeselect();
          }
        }}
        style={{
          width: '100%',
          maxWidth: isA5 ? '920px' : '698px',
          minHeight: isA5 ? '580px' : '842px',
          background: '#ffffff',
          padding: '2rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          position: 'relative',
          boxSizing: 'border-box'
        }}
      >
        {blocks.length === 0 ? (
          <div style={{ border: '2px dashed var(--neutral-border)', borderRadius: '8px', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>Biểu mẫu chưa có nội dung</h4>
            <p style={{ fontSize: '0.8rem', margin: 0 }}>Form nguồn chưa thiết lập các khối layout.</p>
          </div>
        ) : (
          blocks.map((block, idx) => {
            const isBlockActive = block.id === activeBlockId;
            const prevBlock = idx > 0 ? blocks[idx - 1] : undefined;
            const isSeamless = isSeamlessTableBlock(block, prevBlock);

            // 1. TITLE BLOCK
            if (block.type === 'TITLE') {
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBlock?.(block.id);
                  }}
                  style={{
                    borderBottom: '2px solid #0f172a',
                    paddingBottom: '0.75rem',
                    marginBottom: '0.25rem',
                    cursor: 'pointer',
                    background: isBlockActive ? 'rgba(13, 148, 136, 0.04)' : 'transparent',
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    {/* Logo */}
                    <div style={{
                      width: '50px',
                      height: '50px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      color: '#64748b',
                      flexShrink: 0
                    }}>
                      LOGO
                    </div>

                    {/* Title & Subtitle */}
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', margin: '0 0 0.2rem 0', letterSpacing: '0.5px' }}>
                        {block.title || form.formTitle || form.formId}
                      </h2>
                      {block.description && (
                        <p style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic', margin: 0 }}>
                          {block.description}
                        </p>
                      )}
                    </div>

                    {/* Document Info Meta */}
                    <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.3, flexShrink: 0 }}>
                      <div>Mã số: <strong style={{ color: '#0f172a' }}>{form.formId}</strong></div>
                      <div>Phiên bản: {form.version || 'v1.0'}</div>
                      <div>Ngày: {(block as any).date || '2026-09-01'}</div>
                    </div>
                  </div>
                </div>
              );
            }

            // 2. SECTION LABEL BLOCK (H1 / H2)
            if (block.type === 'SECTION_LABEL') {
              const format = getEffectiveTitleFormat(block);
              const isH1 = format === 'H1';
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBlock?.(block.id);
                  }}
                  style={{
                    marginTop: idx > 0 ? (isH1 ? '0.75rem' : '0.4rem') : '0',
                    borderLeft: !isH1 ? '3px solid var(--primary)' : 'none',
                    borderBottom: isH1 ? '1px solid #cbd5e1' : 'none',
                    paddingLeft: !isH1 ? '0.5rem' : '0',
                    paddingBottom: isH1 ? '0.25rem' : '0',
                    cursor: 'pointer',
                    background: isBlockActive ? 'rgba(13, 148, 136, 0.04)' : 'transparent',
                    borderRadius: '2px'
                  }}
                >
                  <h3 style={{
                    fontSize: isH1 ? '0.9rem' : '0.82rem',
                    fontWeight: 700,
                    textTransform: isH1 ? 'uppercase' : 'none',
                    color: isH1 ? '#0f172a' : '#1e293b',
                    margin: 0,
                    letterSpacing: isH1 ? '0.3px' : 'normal'
                  }}>
                    {block.title || 'Tiêu đề phân mục'}
                  </h3>
                  {block.description && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                      {renderFormattedText(block.description)}
                    </div>
                  )}
                </div>
              );
            }

            // 3. INFO GRID BLOCK
            if (block.type === 'INFO_GRID') {
              const gridCols = getInfoGridTemplateColumns(block);
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBlock?.(block.id);
                  }}
                  style={{
                    border: isBlockActive ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    background: '#ffffff',
                    cursor: 'default'
                  }}
                >
                  {block.title && getEffectiveTitleFormat(block) !== 'NONE' && (
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#1e293b', marginBottom: '0.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.25rem' }}>
                      {block.title}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '0.6rem' }}>
                    {(block.fields || []).map((f) => {
                      const isFieldActive = f.id === selectedFieldId;
                      return (
                        <div
                          key={f.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectField(f.id);
                          }}
                          style={{
                            padding: '0.45rem 0.6rem',
                            borderRadius: '4px',
                            border: isFieldActive ? '1.5px solid var(--primary)' : '1px solid #e2e8f0',
                            background: isFieldActive ? 'rgba(13, 148, 136, 0.08)' : '#f8fafc',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                            {f.checkItem}:
                          </span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: isFieldActive ? 'var(--primary)' : '#0f172a' }}>
                            {f.placeholder || '(Giá trị nhập)'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // 4. TABLE BLOCK
            if (block.type === 'TABLE' || block.type === 'CHECKLIST_TABLE') {
              const tableCols = block.tableColumns || [];
              const tableRows = block.tableRows || [];
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBlock?.(block.id);
                  }}
                  style={{
                    border: isBlockActive ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                    borderRadius: isSeamless ? '0' : '4px',
                    overflow: 'hidden',
                    marginTop: isSeamless ? '-1px' : '0'
                  }}
                >
                  {block.title && getEffectiveTitleFormat(block) !== 'NONE' && (
                    <div style={{ background: '#f8fafc', padding: '0.4rem 0.6rem', borderBottom: '1px solid #cbd5e1', fontSize: '0.76rem', fontWeight: 700, color: '#1e293b' }}>
                      {block.title}
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', color: '#334155' }}>
                        {tableCols.map((col, cIdx) => (
                          <th
                            key={col.id || cIdx}
                            style={{
                              border: '1px solid #cbd5e1',
                              padding: '0.4rem 0.5rem',
                              textAlign: (col.align as any) || 'left',
                              width: col.width || 'auto',
                              fontWeight: 700,
                              fontSize: '0.72rem'
                            }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, rIdx) => {
                        const isRowActive = row.id === selectedFieldId;
                        if (row.isGroupHeader) {
                          return (
                            <tr key={row.id || rIdx} style={{ background: '#f8fafc' }}>
                              <td
                                colSpan={tableCols.length}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  padding: '0.35rem 0.5rem',
                                  fontWeight: 700,
                                  color: '#0f766e',
                                  fontSize: '0.72rem',
                                  textTransform: 'uppercase'
                                }}
                              >
                                {row.groupTitle || 'Nhóm tiêu chí'}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={row.id || rIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectField(row.id);
                            }}
                            style={{
                              background: isRowActive ? 'rgba(13, 148, 136, 0.08)' : (rIdx % 2 === 1 ? '#fafafa' : '#ffffff'),
                              cursor: 'pointer',
                              borderLeft: isRowActive ? '3px solid var(--primary)' : 'none'
                            }}
                          >
                            {tableCols.map((col, cIdx) => {
                              let cellContent: React.ReactNode = '';
                              const rowData = block.tableData?.[row.id] || {};
                              if (col.id === 'col_stt' || cIdx === 0 && col.label === 'STT') {
                                cellContent = rIdx + 1;
                              } else if (rowData[col.id]) {
                                cellContent = rowData[col.id];
                              } else {
                                cellContent = col.placeholder || '—';
                              }

                              return (
                                <td
                                  key={col.id || cIdx}
                                  style={{
                                    border: '1px solid #cbd5e1',
                                    padding: '0.4rem 0.5rem',
                                    textAlign: (col.align as any) || 'left',
                                    color: isRowActive ? '#0f766e' : '#1e293b',
                                    fontWeight: isRowActive ? 600 : 400
                                  }}
                                >
                                  {cellContent}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            }

            // 5. SIGN BLOCK
            if (block.type === 'SIGN') {
              const signFields = block.fields && block.fields.length > 0
                ? block.fields.map(f => f.checkItem || 'NGƯỜI KÝ')
                : ['KTV KIỂM TRA', 'TRƯỞNG PHÒNG QC'];
              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBlock?.(block.id);
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${signFields.length}, 1fr)`,
                    gap: '1rem',
                    textAlign: 'center',
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    background: isBlockActive ? 'rgba(13, 148, 136, 0.04)' : 'transparent',
                    borderRadius: '4px'
                  }}
                >
                  {signFields.map((roleText, rIdx) => (
                    <div key={rIdx} style={{ fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>{roleText}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2.5rem', fontStyle: 'italic' }}>
                        (Ký và ghi rõ họ tên)
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return null;
          })
        )}

        {/* Paper Footer */}
        <div style={{
          marginTop: 'auto',
          borderTop: '1px solid #334155',
          paddingTop: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.65rem',
          color: '#64748b',
          fontFamily: 'monospace'
        }}>
          <span>{form.formId}</span>
          <span>{formatFormVersion(form.version || 'v1.0', form.status || 'ACTIVE')}</span>
        </div>
      </div>
    </div>
  );
};
export default FormReferenceCanvas;
