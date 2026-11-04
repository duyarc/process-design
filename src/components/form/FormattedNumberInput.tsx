import React, { useState, useEffect } from 'react';
import { formatIsoNumber } from '../../utils/formUtils';

export interface FormattedNumberInputProps {
  value: string | number | undefined | null;
  placeholder?: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  placeholder,
  onChange,
  style,
  className,
  disabled = false
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localVal, setLocalVal] = useState<string>(() => value != null ? String(value) : '');

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(value != null ? String(value) : '');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Khi focus: chuyển về chuỗi số thô không chứa khoảng cách để dễ gõ/xóa
    const raw = (value != null ? String(value) : '').replace(/[\s\u00A0]/g, '');
    setLocalVal(raw);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const clean = localVal.replace(/[\s\u00A0]/g, '');
    if (clean !== (value != null ? String(value) : '')) {
      onChange(clean);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);
    const clean = raw.replace(/[\s\u00A0]/g, '');
    onChange(clean);
  };

  const displayValue = isFocused
    ? localVal
    : (localVal !== '' && localVal != null ? formatIsoNumber(localVal) : '');

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className={className}
      style={{
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        ...style
      }}
    />
  );
};

export default FormattedNumberInput;
