import React from 'react';
import { Check, CheckSquare, Square, Circle, CircleDot, Plus } from 'lucide-react';
import type { FormFieldISO, ReportFieldRuleOverride, Submission, NumberRangeSpec } from '../../types';
import { computeFieldScoreAndPass } from '../../utils/reportScoring';
import { SmartNumberInput } from '../common/SmartNumberInput';

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

  const handleUpdateOptionScore = (optVal: string, rawVal: number | string) => {
    if (isLocked) return;
    const num = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
    const scoreVal = isNaN(num) ? 0 : num;
    const currentScores = { ...(ruleOverride?.optionScores || {}) };
    currentScores[optVal] = scoreVal;
    onUpdateRule({ optionScores: currentScores });
  };

  const isScaleType = selectedField.type === 'likert_scale' || selectedField.type === 'rating';
  const isChoiceType = selectedField.type === 'radio' || selectedField.type === 'select';
  const isCheckboxType = selectedField.type === 'checkbox';
  const isNumberType = selectedField.type === 'number';
  const isTextType = selectedField.type === 'text';

  // Number range helpers
  const numberRanges: NumberRangeSpec[] = ruleOverride?.numberRanges && ruleOverride.numberRanges.length > 0
    ? ruleOverride.numberRanges
    : [{
        id: 'r_default',
        min: ruleOverride?.customMinSpec !== undefined ? ruleOverride.customMinSpec : (selectedField.minSpec ?? undefined),
        max: ruleOverride?.customMaxSpec !== undefined ? ruleOverride.customMaxSpec : (selectedField.maxSpec ?? undefined),
        isPass: true,
        score: ruleOverride?.fixedScore !== undefined ? ruleOverride.fixedScore : 5
      }];

  const handleUpdateNumberRange = (rangeId: string, updates: Partial<NumberRangeSpec>) => {
    if (isLocked) return;
    const updated = numberRanges.map(r => r.id === rangeId ? { ...r, ...updates } : r);
    onUpdateRule({ numberRanges: updated });
  };

  const handleAddRange = () => {
    if (isLocked) return;
    const newRange: NumberRangeSpec = {
      id: 'r_' + Date.now(),
      min: undefined,
      max: undefined,
      isPass: true,
      score: 5
    };
    onUpdateRule({ numberRanges: [...numberRanges, newRange] });
  };

  const handleDeleteRange = (rangeId: string) => {
    if (isLocked) return;
    const updated = numberRanges.filter(r => r.id !== rangeId);
    onUpdateRule({ numberRanges: updated });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* 1. Unified 3-Column Matrix for Options (Scale / Choice / Checkbox) */}
      {isScaleType && (() => {
        const scaleOpts = selectedField.scaleOptions && selectedField.scaleOptions.length > 0
          ? selectedField.scaleOptions
          : ['1', '2', '3', '4', '5'];
        const numOpts = scaleOpts.length;
        const defaultScores = scaleOpts.map((_, idx) => Math.max(0, Math.round(((1 - idx / Math.max(1, numOpts - 1)) * 5) * 2) / 2));

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
                      <SmartNumberInput
                        disabled={isLocked}
                        value={optScore}
                        step={0.5}
                        onChange={(val) => handleUpdateOptionScore(opt, val)}
                        style={{
                          border: isSelected ? '1px solid #2dd4bf' : '1px solid #cbd5e1'
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
                  ?? 5;

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
                      <SmartNumberInput
                        disabled={isLocked}
                        value={optScore}
                        step={0.5}
                        onChange={(val) => handleUpdateOptionScore(optVal, val)}
                        style={{
                          border: isSelected ? '1px solid #2dd4bf' : '1px solid #cbd5e1'
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
                  ?? 2.5;

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
                      <SmartNumberInput
                        disabled={isLocked}
                        value={optScore}
                        step={0.5}
                        onChange={(val) => handleUpdateOptionScore(optVal, val)}
                        style={{
                          border: isSelected ? '1px solid #2dd4bf' : '1px solid #cbd5e1'
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

      {/* Number Type (Multi-Range Intervals) */}
      {isNumberType && (() => {
        const numVal = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
        const hasValidNum = !isNaN(numVal);
        const defPass = ruleOverride?.numberDefaultPass ?? false;
        const defScore = ruleOverride?.numberDefaultScore ?? 0;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Value Banner */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Value:</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                {rawValue !== '' ? `${rawValue} ${selectedField.unit || ''}` : '(Empty)'}
              </span>
            </div>

            {/* Multi-Range Matrix */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '5.5fr 2.5fr 2.5fr 1fr',
                padding: '6px 10px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#475569',
                alignItems: 'center'
              }}>
                <span>Range</span>
                <span style={{ textAlign: 'center', color: '#0f766e' }}>isPass</span>
                <span style={{ textAlign: 'right', color: '#4338ca' }}>Score</span>
                <span></span>
              </div>

              {/* Dynamic Range Rows */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {numberRanges.map((r) => {
                  let isMatched = false;
                  if (hasValidNum) {
                    if (r.min !== undefined && r.max !== undefined) {
                      isMatched = numVal >= r.min && numVal <= r.max;
                    } else if (r.min !== undefined) {
                      isMatched = numVal >= r.min;
                    } else if (r.max !== undefined) {
                      isMatched = numVal <= r.max;
                    }
                  }

                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '5.5fr 2.5fr 2.5fr 1fr',
                        padding: '6px 10px',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.75rem',
                        alignItems: 'center',
                        background: isMatched ? 'rgba(240, 253, 250, 0.85)' : '#ffffff',
                        borderLeft: isMatched ? '3px solid var(--primary)' : '3px solid transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={r.min !== undefined ? r.min : ''}
                          onChange={(e) => handleUpdateNumberRange(r.id, { min: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                          placeholder="Min"
                          title="Min"
                          style={{ width: '42px', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>~</span>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={r.max !== undefined ? r.max : ''}
                          onChange={(e) => handleUpdateNumberRange(r.id, { max: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                          placeholder="Max"
                          title="Max"
                          style={{ width: '42px', padding: '3px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}
                        />
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={r.isPass}
                          onChange={(e) => handleUpdateNumberRange(r.id, { isPass: e.target.checked })}
                          style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                          title="isPass"
                        />
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <SmartNumberInput
                          disabled={isLocked}
                          value={r.score}
                          step={0.5}
                          onChange={(val) => handleUpdateNumberRange(r.id, { score: val })}
                          style={{ width: '44px' }}
                        />
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          disabled={isLocked || numberRanges.length <= 1}
                          onClick={() => handleDeleteRange(r.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: numberRanges.length <= 1 ? '#e2e8f0' : '#94a3b8',
                            cursor: (isLocked || numberRanges.length <= 1) ? 'not-allowed' : 'pointer',
                            borderRadius: '4px',
                            padding: '2px 4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Delete range"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Fallback Row (Out of Range) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '5.5fr 2.5fr 2.5fr 1fr',
                    padding: '6px 10px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '0.75rem',
                    alignItems: 'center',
                    background: (hasValidNum && !numberRanges.some(r => (r.min !== undefined && r.max !== undefined && numVal >= r.min && numVal <= r.max) || (r.min !== undefined && r.max === undefined && numVal >= r.min) || (r.min === undefined && r.max !== undefined && numVal <= r.max))) ? 'rgba(255, 241, 242, 0.85)' : '#fafafa',
                    borderLeft: (hasValidNum && !numberRanges.some(r => (r.min !== undefined && r.max !== undefined && numVal >= r.min && numVal <= r.max) || (r.min !== undefined && r.max === undefined && numVal >= r.min) || (r.min === undefined && r.max !== undefined && numVal <= r.max))) ? '3px solid var(--accent-rose, #e11d48)' : '3px solid transparent',
                    color: '#64748b'
                  }}
                >
                  <span style={{ fontSize: '0.72rem', fontStyle: 'italic' }}>Out of range</span>
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={defPass}
                      onChange={(e) => onUpdateRule({ numberDefaultPass: e.target.checked })}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      title="isPass"
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <SmartNumberInput
                      disabled={isLocked}
                      value={defScore}
                      step={0.5}
                      onChange={(val) => onUpdateRule({ numberDefaultScore: val })}
                      style={{ width: '44px' }}
                    />
                  </div>
                  <div></div>
                </div>
              </div>

              {/* Add Range Button */}
              <button
                type="button"
                disabled={isLocked}
                onClick={handleAddRange}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  background: 'var(--primary-light, #f0fdfa)',
                  border: 'none',
                  borderTop: '1px dashed #ccfbf1',
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Plus size={12} /> Add Range
              </button>

              {/* SUM Preview Row */}
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
          </div>
        );
      })()}

      {/* Text / Textarea Type (Option 4: Inline Min Chars inside Condition Table) */}
      {isTextType && (() => {
        const textStr = rawValue !== undefined && rawValue !== null ? String(rawValue).trim() : '';
        const charCount = textStr.length;
        const minLen = ruleOverride?.textMinLength !== undefined ? ruleOverride.textMinLength : 10;
        const passScore = ruleOverride?.textPassScore !== undefined ? ruleOverride.textPassScore : 5;
        const shortScore = ruleOverride?.textShortScore !== undefined ? ruleOverride.textShortScore : 2.5;
        const shortPass = Boolean(ruleOverride?.textShortPass);
        const allowEmpty = Boolean(ruleOverride?.textAllowEmpty);
        const emptyScore = ruleOverride?.textEmptyScore !== undefined ? ruleOverride.textEmptyScore : 0;

        const isStandardMatch = charCount >= minLen;
        const isShortMatch = charCount > 0 && charCount < minLen;
        const isEmptyMatch = charCount === 0;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Value Banner with char counter */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Value:</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {charCount > 0 ? (
                  <>
                    <span style={{ color: '#0f766e' }}>"{textStr}"</span>{' '}
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>({charCount} chars)</span>
                  </>
                ) : (
                  '(Empty)'
                )}
              </span>
            </div>

            {/* Matrix Box */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '6.2fr 2.8fr 3fr',
                padding: '6px 10px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#475569',
                alignItems: 'center'
              }}>
                <span>Condition</span>
                <span style={{ textAlign: 'center', color: '#0f766e' }}>isPass</span>
                <span style={{ textAlign: 'right', color: '#4338ca' }}>Score</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Row 1: Standard (≥ [ minLen ]) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '6.2fr 2.8fr 3fr',
                  padding: '6px 10px',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.75rem',
                  alignItems: 'center',
                  background: isStandardMatch ? 'rgba(240, 253, 250, 0.85)' : '#ffffff',
                  borderLeft: isStandardMatch ? '3px solid var(--primary)' : '3px solid transparent'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Standard (≥</span>
                    <input
                      type="number"
                      disabled={isLocked}
                      value={minLen}
                      onChange={(e) => onUpdateRule({ textMinLength: Math.max(1, parseInt(e.target.value) || 1) })}
                      style={{ width: '36px', padding: '2px 3px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'center', fontWeight: 700 }}
                      title="Min characters for standard"
                    />
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>)</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: 'default' }}
                      title="Standard is always PASS"
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <SmartNumberInput
                      disabled={isLocked}
                      value={passScore}
                      step={0.5}
                      onChange={(val) => onUpdateRule({ textPassScore: val })}
                      style={{ width: '44px' }}
                    />
                  </div>
                </div>

                {/* Row 2: Short (< minLen) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '6.2fr 2.8fr 3fr',
                  padding: '6px 10px',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.75rem',
                  alignItems: 'center',
                  background: isShortMatch ? 'rgba(240, 253, 250, 0.85)' : '#ffffff',
                  borderLeft: isShortMatch ? '3px solid var(--primary)' : '3px solid transparent'
                }}>
                  <span style={{ color: '#475569' }}>Short (&lt; {minLen})</span>
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={shortPass}
                      onChange={(e) => onUpdateRule({ textShortPass: e.target.checked })}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      title="isPass"
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <SmartNumberInput
                      disabled={isLocked}
                      value={shortScore}
                      step={0.5}
                      onChange={(val) => onUpdateRule({ textShortScore: val })}
                      style={{ width: '44px' }}
                    />
                  </div>
                </div>

                {/* Row 3: Empty */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '6.2fr 2.8fr 3fr',
                  padding: '6px 10px',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.75rem',
                  alignItems: 'center',
                  background: isEmptyMatch ? 'rgba(240, 253, 250, 0.85)' : '#fafafa',
                  borderLeft: isEmptyMatch ? '3px solid var(--primary)' : '3px solid transparent',
                  color: '#64748b'
                }}>
                  <span>Empty</span>
                  <div style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={allowEmpty}
                      onChange={(e) => onUpdateRule({ textAllowEmpty: e.target.checked })}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                      title="Allow empty"
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <SmartNumberInput
                      disabled={isLocked}
                      value={emptyScore}
                      step={0.5}
                      onChange={(val) => onUpdateRule({ textEmptyScore: val })}
                      style={{ width: '44px' }}
                    />
                  </div>
                </div>
              </div>

              {/* SUM Preview Row */}
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
          </div>
        );
      })()}

      {/* Other Informational Fields */}
      {!isScaleType && !isChoiceType && !isCheckboxType && !isNumberType && !isTextType && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <label style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Value</label>
          <input
            type="text"
            readOnly
            value={rawValue}
            placeholder="(Empty)"
            style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.8rem', fontWeight: 600, background: '#f8fafc', color: '#0f172a' }}
          />
        </div>
      )}

      {/* 2. Structured Property Card: Row 1 [ ] isKnockout + Row 2 Weight [ xx ] % of {section} */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px 10px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        fontSize: '0.75rem'
      }}>
        {/* Row 1: isKnockout toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>Loại trực tiếp</span>
        </div>

        {/* Row 2: Weight [ xx ] % of {section} */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          paddingTop: '6px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
              Weight:
            </span>
            <SmartNumberInput
              disabled={isLocked}
              value={ruleOverride?.weight !== undefined ? ruleOverride.weight : 0}
              min={0}
              max={100}
              onChange={(val) => onUpdateRule({ weight: val })}
              style={{ width: '46px' }}
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b' }}>%</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minWidth: 0,
              fontSize: '0.7rem',
              color: '#475569',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              padding: '2px 6px'
            }}
            title={parentGroupTitle || 'Nhóm câu hỏi'}
          >
            <span style={{ color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>of</span>
            <span style={{
              fontWeight: 700,
              color: 'var(--primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {parentGroupTitle || 'Nhóm câu hỏi'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
