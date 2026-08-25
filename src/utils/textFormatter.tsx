import React from 'react';

/**
 * Parses markdown-style inline formatting tokens (**bold**, *italic*, <u>underline</u>, ~underline~)
 * and newlines (\n) safely into React JSX nodes without innerHTML or external dependencies.
 */
export function renderFormattedText(text?: string | null): React.ReactNode {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);

  // Fast-path: return plain text if no format tokens exist
  if (!text.includes('*') && !text.includes('_') && !text.includes('<u>') && !text.includes('~') && !text.includes('\n')) {
    return text;
  }

  const lines = text.split('\n');
  return lines.map((line, lineIdx) => (
    <React.Fragment key={lineIdx}>
      {lineIdx > 0 && <br />}
      {parseInlineTokens(line)}
    </React.Fragment>
  ));
}

function parseInlineTokens(str: string): React.ReactNode[] {
  if (!str) return [];

  // Match bold (**...** or __...__), underline (<u>...</u> or ~...~), and italic (*...* or _..._)
  const tokenRegex = /(\*\*(?:[^*]+|\*(?!\*))+\*\*|__(?:[^_]+|_(?!_))+__|<u>(?:(?!<\/u>).)*<\/u>|~[^~]+~|\*(?:[^*]+)\*|_(?:[^_]+)_)/g;

  const parts = str.split(tokenRegex);
  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold: **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      const inner = part.slice(2, -2);
      return <strong key={idx} style={{ fontWeight: 600 }}>{parseInlineTokens(inner)}</strong>;
    }

    // Underline: <u>text</u> or ~text~
    if (part.startsWith('<u>') && part.endsWith('</u>') && part.length >= 7) {
      const inner = part.slice(3, -4);
      return <u key={idx} style={{ textDecoration: 'underline' }}>{parseInlineTokens(inner)}</u>;
    }
    if (part.startsWith('~') && part.endsWith('~') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return <u key={idx} style={{ textDecoration: 'underline' }}>{parseInlineTokens(inner)}</u>;
    }

    // Italic: *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
        (part.startsWith('_') && part.endsWith('_') && part.length >= 2)) {
      const inner = part.slice(1, -1);
      return <em key={idx} style={{ fontStyle: 'italic' }}>{parseInlineTokens(inner)}</em>;
    }

    return part;
  });
}

/**
 * Applies or toggles formatting tokens around current text selection in an input/textarea element.
 */
export function applyTextFormat(
  inputEl: HTMLTextAreaElement | HTMLInputElement | null,
  formatType: 'bold' | 'italic' | 'underline',
  currentValue: string,
  onChange: (newVal: string) => void
): void {
  if (!inputEl) return;

  const start = inputEl.selectionStart ?? 0;
  const end = inputEl.selectionEnd ?? 0;
  const selectedText = currentValue.substring(start, end);

  let prefix = '';
  let suffix = '';

  if (formatType === 'bold') {
    prefix = '**';
    suffix = '**';
  } else if (formatType === 'italic') {
    prefix = '*';
    suffix = '*';
  } else if (formatType === 'underline') {
    prefix = '<u>';
    suffix = '</u>';
  }

  let newValue: string;
  let newCursorStart: number;
  let newCursorEnd: number;

  if (selectedText.length > 0) {
    // Toggle off if already wrapped with this exact format
    if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix) && selectedText.length >= prefix.length + suffix.length) {
      const unwrapped = selectedText.slice(prefix.length, -suffix.length);
      newValue = currentValue.substring(0, start) + unwrapped + currentValue.substring(end);
      newCursorStart = start;
      newCursorEnd = start + unwrapped.length;
    } else {
      const wrapped = prefix + selectedText + suffix;
      newValue = currentValue.substring(0, start) + wrapped + currentValue.substring(end);
      newCursorStart = start;
      newCursorEnd = start + wrapped.length;
    }
  } else {
    // No selection: insert tokens and place cursor in the middle
    newValue = currentValue.substring(0, start) + prefix + suffix + currentValue.substring(end);
    newCursorStart = start + prefix.length;
    newCursorEnd = start + prefix.length;
  }

  onChange(newValue);

  // Restore cursor and focus on the next animation frame
  requestAnimationFrame(() => {
    inputEl.focus();
    inputEl.setSelectionRange(newCursorStart, newCursorEnd);
  });
}

/**
 * Intercepts keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U) to trigger text formatting.
 */
export function handleFormatKeyDown(
  e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  currentValue: string,
  onChange: (newVal: string) => void
): boolean {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      applyTextFormat(e.currentTarget, 'bold', currentValue, onChange);
      return true;
    }
    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      applyTextFormat(e.currentTarget, 'italic', currentValue, onChange);
      return true;
    }
    if (e.key === 'u' || e.key === 'U') {
      e.preventDefault();
      applyTextFormat(e.currentTarget, 'underline', currentValue, onChange);
      return true;
    }
  }
  return false;
}
