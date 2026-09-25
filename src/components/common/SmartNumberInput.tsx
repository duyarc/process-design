import React, { useState, useRef, useEffect } from 'react';

export interface SmartNumberInputProps {
  value: number | '' | undefined;
  onChange: (val: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  title?: string;
  style?: React.CSSProperties;
}

/**
 * SmartNumberInput — Spinless numeric input with instant auto-select on focus,
 * natural Backspace editing (local draft state), and keyboard arrow stepping.
 */
export const SmartNumberInput: React.FC<SmartNumberInputProps> = ({
  value,
  onChange,
  disabled = false,
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

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
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
