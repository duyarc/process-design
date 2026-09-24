import React, { useState, useRef, useEffect } from 'react';

export interface SmartNumberInputProps {
  value: number | '' | undefined;
  onChange: (val: number) => void;
  disabled?: boolean;
  presets?: number[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * SmartNumberInput — Spinless numeric input with instant auto-select on focus,
 * natural Backspace editing (local draft state), keyboard arrow stepping,
 * and optional Focus-Only Quick-Select Pill Bar (used for Weight %).
 */
export const SmartNumberInput: React.FC<SmartNumberInputProps> = ({
  value,
  onChange,
  disabled = false,
  presets,
  min,
  max,
  step = 1,
  placeholder,
  title,
  style
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState<string>(value !== undefined && value !== '' ? String(value) : '0');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value !== undefined && value !== '' ? String(value) : '0');
    }
  }, [value, isFocused]);

  const clampValue = (num: number): number => {
    let res = num;
    if (min !== undefined) res = Math.max(min, res);
    if (max !== undefined) res = Math.min(max, res);
    return Math.round(res * 100) / 100;
  };

  const commitValue = (rawStr: string) => {
    const parsed = parseFloat(rawStr);
    const finalNum = isNaN(parsed) ? 0 : clampValue(parsed);
    setDraft(String(finalNum));
    onChange(finalNum);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-' || /^-?\d*\.?\d*$/.test(raw)) {
      setDraft(raw);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(clampValue(parsed));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(draft);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value !== undefined && value !== '' ? String(value) : '0');
      inputRef.current?.blur();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseFloat(draft) || 0;
      const delta = (e.shiftKey ? 5 : step) * (e.key === 'ArrowUp' ? 1 : -1);
      const next = clampValue(current + delta);
      setDraft(String(next));
      onChange(next);
    }
  };

  const numericCurrent = parseFloat(draft);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {isFocused && !disabled && presets && presets.length > 0 && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 5px)',
            left: 0,
            background: '#ffffff',
            border: '1px solid #99f6e4',
            padding: '2px',
            borderRadius: '6px',
            display: 'inline-flex',
            gap: '2px',
            zIndex: 60,
            boxShadow: '0 6px 16px rgba(15, 23, 42, 0.14)',
            whiteSpace: 'nowrap'
          }}
        >
          {presets.map((p) => {
            const isActive = !isNaN(numericCurrent) && numericCurrent === p;
            return (
              <button
                key={p}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const clamped = clampValue(p);
                  setDraft(String(clamped));
                  onChange(clamped);
                  setIsFocused(false);
                  inputRef.current?.blur();
                }}
                style={{
                  border: 'none',
                  background: isActive ? 'var(--primary, #0f766e)' : '#f8fafc',
                  color: isActive ? '#ffffff' : '#334155',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  padding: '2px 5px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.1s'
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={isFocused ? draft : (value !== undefined && value !== '' ? String(value) : '0')}
        placeholder={placeholder}
        title={title}
        onFocus={(e) => {
          setIsFocused(true);
          setDraft(value !== undefined && value !== '' ? String(value) : '0');
          const target = e.currentTarget;
          requestAnimationFrame(() => target.select());
        }}
        onBlur={() => {
          commitValue(draft);
          setIsFocused(false);
        }}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          width: '46px',
          height: '24px',
          padding: '2px 4px',
          fontSize: '0.75rem',
          textAlign: 'center',
          fontWeight: 700,
          borderRadius: '4px',
          border: isFocused ? '1px solid var(--primary, #0f766e)' : '1px solid #cbd5e1',
          boxShadow: isFocused ? '0 0 0 2px rgba(15, 118, 110, 0.15)' : 'none',
          background: disabled ? '#f1f5f9' : '#ffffff',
          color: '#0f172a',
          outline: 'none',
          fontVariantNumeric: 'tabular-nums',
          transition: 'border-color 0.12s, box-shadow 0.12s',
          ...style
        }}
      />
    </div>
  );
};
