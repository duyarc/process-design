import React from 'react';
import { Check, CheckSquare, Square, Circle, CircleDot } from 'lucide-react';
import type { FormFieldISO, ReportFieldRuleOverride, Submission } from '../../types';
import { computeFieldScoreAndPass } from '../../utils/reportScoring';

interface FieldScoringInspectorProps {
  selectedField: FormFieldISO;
  sampleSubmission: Submission | null;
  ruleOverride?: ReportFieldRuleOverride;
  parentGroupTitle: string;
  onUpdateRule: (override: Partial<ReportFieldRuleOverride>) => void;
  isLocked?: boolean;
}

export const FieldScoringInspector: React.FC<FieldScoringInspectorProps> = ({
  selectedField,
  sampleSubmission,
  ruleOverride,
  parentGroupTitle,
  onUpdateRule,
  isLocked = false
}) => {
  // 1. Extract raw value from sample submission
  let rawValue: any = '';
  const subData = sampleSubmission?.formData || (sampleSubmission as any)?.form_data;
  if (Array.isArray(subData)) {
    const match = subData.find((item: any) => item.id === selectedField.id || item.fieldId === selectedField.id);
    if (match) rawValue = match.value !== undefined ? match.value : '';
  } else if (subData && typeof subData === 'object') {
    rawValue = subData[selectedField.id] !== undefined ? subData[selectedField.id] : '';
  }

  // 2. Compute live evaluation result
  const evalResult = computeFieldScoreAndPass(rawValue, selectedField, ruleOverride);

  // Handlers for updating overrides
  const handleToggleOptionPass = (optVal: string, defaultPass: boolean, allOptions: string[]) => {
    if (isLocked) return;
    const currentPassOpts = ruleOverride?.customPassOptions
      ? [...ruleOverride.customPassOptions]
      : allOptions.filter((_, idx) => defaultPass ? idx < Math.ceil(allOptions.length / 2) : true);

    const exists = currentPassOpts.includes(optVal);
    let updated: string[];
    if (exists) {
      updated = currentPassOpts.filter(o => o !== optVal);
    } else {
      updated = [...currentPassOpts, optVal];
    }
    onUpdateRule({ customPassOptions: updated });
  };

  const handleUpdateOptionScore = (optVal: string, scoreVal: number) => {
    if (isLocked) return;
    const currentScores = { ...(ruleOverride?.optionScores || {}) };
    currentScores[optVal] = isNaN(scoreVal) ? 0 : scoreVal;
    onUpdateRule({ optionScores: currentScores });
  };

  const isScaleType = selectedField.type === 'likert_scale' || selectedField.type === 'rating';
  const isChoiceType = selectedField.type === 'radio' || selectedField.type === 'select';
  const isCheckboxType = selectedField.type === 'checkbox';
  const isNumberType = selectedField.type === 'number';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* 1. Unified 3-Column Matrix for Options (Scale / Choice / Checkbox) */}
      {isScaleType && (() => {
        const scaleOpts = selectedField.scaleOptions && selectedField.scaleOptions.length > 0
          ? selectedField.scaleOptions
          : ['1', '2', '3', '4', '5'];
        const numOpts = scaleOpts.length;
        const defaultScores = scaleOpts.map((_, idx) => Math.max(0, Math.round((1 - idx / Math.max(1, numOpts - 1)) * 10)));

        return (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            {/* Header: Value | isPass | Score */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', alignItems: 'center' }}>
              <div style={{ gridColumn: 'span 6' }}>Value</div>
              <div style={{ gridColumn: 'span 3', textAlign: 'center', color: '#0f766e' }}>isPass</div>
              <div style={{ gridColumn: 'span 3', textAlign: 'right', color: '#4338ca' }}>Score</div>
            </div>

            {/* Option Rows */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {scaleOpts.map((opt, idx) => {
                const isSelected = opt === rawValue || String(idx + 1) === rawValue;
                const optScore = ruleOverride?.optionScores?.[opt]
                  ?? ruleOverride?.optionScores?.[String(idx + 1)]
                  ?? defaultScores[idx];

                const isPass = ruleOverride?.customPassOptions
                  ? (ruleOverride.customPassOptions.includes(opt) || ruleOverride.customPassOptions.includes(String(idx + 1)))
                  : (idx < Math.ceil(numOpts / 2));

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                      padding: '6px 10px',
                      alignItems: 'center',
                      background: isSelected ? '#f0fdfa' : '#ffffff',
                      borderBottom: idx < scaleOpts.length - 1 ? '1px solid #f1f5f9' : 'none',
                      color: isSelected ? '#0f172a' : '#475569',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    {/* Value Column */}
                    <div style={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: isSelected ? 'var(--primary)' : '#ffffff',
                        border: isSelected ? 'none' : '1px solid #cbd5e1',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {isSelected ? <Check size={10} strokeWidth={3} /> : idx + 1}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                    </div>

                    {/* isPass Column */}
                    <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={isPass}
                        onChange={() => handleToggleOptionPass(opt, true, scaleOpts)}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      />
                    </div>

                    {/* Score Column */}
                    <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={optScore}
                        onChange={(e) => handleUpdateOptionScore(opt, parseFloat(e.target.value))}
                        style={{
                          width: '46px',
                          padding: '2px 4px',
                          fontSize: '0.75rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #2dd4bf' : '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SUM Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              padding: '8px 10px',
              alignItems: 'center',
              background: evalResult.status === 'PASS' ? 'rgba(240, 253, 250, 0.7)' : 'rgba(255, 241, 242, 0.7)',
              borderTop: '1px solid #e2e8f0'
            }}>
              <div style={{ gridColumn: 'span 6' }}></div>
              <div style={{ gridColumn: 'span 3', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: evalResult.status === 'PASS' ? '#0f766e' : '#e11d48' }}>
                  {evalResult.status === 'PASS' ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                  {evalResult.score}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Choice Type (Radio / Select) */}
      {isChoiceType && (() => {
        const options = selectedField.options || [];
        const optValues = options.map(o => o.value || o.label || '');

        return (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', alignItems: 'center' }}>
              <div style={{ gridColumn: 'span 6' }}>Value</div>
              <div style={{ gridColumn: 'span 3', textAlign: 'center', color: '#0f766e' }}>isPass</div>
              <div style={{ gridColumn: 'span 3', textAlign: 'right', color: '#4338ca' }}>Score</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {options.map((opt, idx) => {
                const optVal = opt.value || opt.label || '';
                const optLabel = opt.label || opt.value || '';
                const isSelected = optVal === rawValue || optLabel === rawValue;
                const optScore = ruleOverride?.optionScores?.[optVal]
                  ?? ruleOverride?.optionScores?.[optLabel]
                  ?? (opt as any)?.score
                  ?? 10;

                const isPass = ruleOverride?.customPassOptions
                  ? (ruleOverride.customPassOptions.includes(optVal) || ruleOverride.customPassOptions.includes(optLabel))
                  : (opt.isPass !== false);

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                      padding: '6px 10px',
                      alignItems: 'center',
                      background: isSelected ? '#f0fdfa' : '#ffffff',
                      borderBottom: idx < options.length - 1 ? '1px solid #f1f5f9' : 'none',
                      color: isSelected ? '#0f172a' : '#475569',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    <div style={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      {isSelected ? <CircleDot size={14} color="var(--primary)" style={{ flexShrink: 0 }} /> : <Circle size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{optLabel}</span>
                    </div>

                    <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={isPass}
                        onChange={() => handleToggleOptionPass(optVal, true, optValues)}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={optScore}
                        onChange={(e) => handleUpdateOptionScore(optVal, parseFloat(e.target.value))}
                        style={{
                          width: '46px',
                          padding: '2px 4px',
                          fontSize: '0.75rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #2dd4bf' : '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              padding: '8px 10px',
              alignItems: 'center',
              background: evalResult.status === 'PASS' ? 'rgba(240, 253, 250, 0.7)' : 'rgba(255, 241, 242, 0.7)',
              borderTop: '1px solid #e2e8f0'
            }}>
              <div style={{ gridColumn: 'span 6' }}></div>
              <div style={{ gridColumn: 'span 3', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: evalResult.status === 'PASS' ? '#0f766e' : '#e11d48' }}>
                  {evalResult.status === 'PASS' ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                  {evalResult.score}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Checkbox Type */}
      {isCheckboxType && (() => {
        const options = selectedField.options || [];
        const rawArr = Array.isArray(rawValue)
          ? rawValue
          : (typeof rawValue === 'string' && rawValue.length > 0 ? rawValue.split(',').map(s => s.trim()) : [String(rawValue)]);

        return (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '6px 10px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', alignItems: 'center' }}>
              <div style={{ gridColumn: 'span 6' }}>Value</div>
              <div style={{ gridColumn: 'span 3', textAlign: 'center', color: '#0f766e' }}>isPass</div>
              <div style={{ gridColumn: 'span 3', textAlign: 'right', color: '#4338ca' }}>Score</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {options.map((opt, idx) => {
                const optVal = opt.value || opt.label || '';
                const optLabel = opt.label || opt.value || '';
                const isSelected = rawArr.includes(optVal) || rawArr.includes(optLabel);
                const optScore = ruleOverride?.optionScores?.[optVal]
                  ?? ruleOverride?.optionScores?.[optLabel]
                  ?? 5;

                const isPass = ruleOverride?.customPassOptions
                  ? (ruleOverride.customPassOptions.includes(optVal) || ruleOverride.customPassOptions.includes(optLabel))
                  : true;

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                      padding: '6px 10px',
                      alignItems: 'center',
                      background: isSelected ? '#f0fdfa' : '#ffffff',
                      borderBottom: idx < options.length - 1 ? '1px solid #f1f5f9' : 'none',
                      color: isSelected ? '#0f172a' : '#475569',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 600 : 400
                    }}
                  >
                    <div style={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      {isSelected ? <CheckSquare size={14} color="var(--primary)" style={{ flexShrink: 0 }} /> : <Square size={14} color="#cbd5e1" style={{ flexShrink: 0 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{optLabel}</span>
                    </div>

                    <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center' }}>
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={isPass}
                        onChange={() => handleToggleOptionPass(optVal, true, options.map(o => o.value || o.label || ''))}
                        style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={optScore}
                        onChange={(e) => handleUpdateOptionScore(optVal, parseFloat(e.target.value))}
                        style={{
                          width: '46px',
                          padding: '2px 4px',
                          fontSize: '0.75rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #2dd4bf' : '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              padding: '8px 10px',
              alignItems: 'center',
              background: evalResult.status === 'PASS' ? 'rgba(240, 253, 250, 0.7)' : 'rgba(255, 241, 242, 0.7)',
              borderTop: '1px solid #e2e8f0'
            }}>
              <div style={{ gridColumn: 'span 6' }}></div>
              <div style={{ gridColumn: 'span 3', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: evalResult.status === 'PASS' ? '#0f766e' : '#e11d48' }}>
                  {evalResult.status === 'PASS' ? 'PASS' : 'FAIL'}
                </span>
              </div>
              <div style={{ gridColumn: 'span 3', textAlign: 'right' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                  {evalResult.score}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Number Type */}
      {isNumberType && (() => {
        const targetScore = ruleOverride?.fixedScore !== undefined ? ruleOverride.fixedScore : 10;
        return (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Giá trị thực tế:</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>{rawValue !== '' ? `${rawValue} ${selectedField.unit || ''}` : '(Chưa có)'}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>Min Spec</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={ruleOverride?.customMinSpec !== undefined ? ruleOverride.customMinSpec : (selectedField.minSpec ?? '')}
                  onChange={(e) => onUpdateRule({ customMinSpec: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                  style={{ width: '100%', padding: '3px 6px', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>Max Spec</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={ruleOverride?.customMaxSpec !== undefined ? ruleOverride.customMaxSpec : (selectedField.maxSpec ?? '')}
                  onChange={(e) => onUpdateRule({ customMaxSpec: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                  style={{ width: '100%', padding: '3px 6px', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569' }}>Điểm khi đạt (Pass Score):</span>
              <input
                type="number"
                disabled={isLocked}
                value={targetScore}
                onChange={(e) => onUpdateRule({ fixedScore: parseFloat(e.target.value) || 0 })}
                style={{ width: '50px', padding: '2px 4px', fontSize: '0.75rem', textAlign: 'right', fontWeight: 700, border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: evalResult.status === 'PASS' ? '#f0fdfa' : '#fff1f2', padding: '6px 8px', borderRadius: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: evalResult.status === 'PASS' ? '#0f766e' : '#e11d48' }}>
                {evalResult.status === 'PASS' ? 'PASS' : 'FAIL'}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>
                {evalResult.score}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Other Informational Fields */}
      {!isScaleType && !isChoiceType && !isCheckboxType && !isNumberType && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Value</label>
          <input
            type="text"
            readOnly
            value={rawValue}
            placeholder="(Chưa có dữ liệu nộp)"
            style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.8rem', fontWeight: 600, background: '#f8fafc', color: '#0f172a' }}
          />
        </div>
      )}

      {/* 2. Single-Row Property Bar: [ ] isKnockout + Weight (% trong [Tên Nhóm]) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '0.75rem'
      }}>
        {/* Left: isKnockout checkbox */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: isLocked ? 'not-allowed' : 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            disabled={isLocked}
            checked={Boolean(ruleOverride?.isKnockout)}
            onChange={(e) => onUpdateRule({ isKnockout: e.target.checked })}
            style={{ width: '14px', height: '14px', accentColor: '#e11d48', cursor: isLocked ? 'not-allowed' : 'pointer' }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9f1239' }}>isKnockout</span>
        </label>

        {/* Right: Dynamic Weight % */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title={`Trọng số phần trăm của câu hỏi trong nhóm ${parentGroupTitle}`}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#334155' }}>
            Weight:
          </span>
          <input
            type="number"
            disabled={isLocked}
            value={ruleOverride?.weight !== undefined ? ruleOverride.weight : 0}
            onChange={(e) => onUpdateRule({ weight: parseFloat(e.target.value) || 0 })}
            style={{
              width: '46px',
              padding: '2px 4px',
              fontSize: '0.75rem',
              textAlign: 'right',
              fontWeight: 700,
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a'
            }}
          />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>%</span>
        </div>
      </div>
    </div>
  );
};
