import React from 'react';

/**
 * Parses markdown-style inline formatting tokens (**bold**, *italic*, <u>underline</u>, ~underline~)
 * and newlines (\n) safely into React JSX nodes without innerHTML or external dependencies.
 */
export function renderFormattedText(text?: string | null): React.ReactNode {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);

  // Fast-path: return plain text if no format tokens exist
  if (!text.includes('*') && !text.includes('_') && !text.includes('<u>') && !text.includes('~') && !text.includes('\n') && !text.includes('•') && !text.includes('-')) {
    return text;
  }

  // Single-line fast-path without bullet list
  if (!text.includes('\n')) {
    const bulletMatch = text.match(/^(\s*)([*•\-+])\s+(.*)$/);
    if (!bulletMatch) {
      return <>{parseInlineTokens(text)}</>;
    }
  }

  const rawLines = text.split('\n');
  return (
    <div className="formatted-text-content" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {rawLines.map((line, idx) => {
        // 1. Bullet list item: starts with optional spaces + (*, •, -, +) + space
        const bulletMatch = line.match(/^(\s*)([*•\-+])\s+(.*)$/);
        if (bulletMatch) {
          const indentLevel = Math.floor(bulletMatch[1].length / 2);
          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                marginLeft: `${indentLevel * 14}px`,
                marginTop: idx === 0 ? 0 : '3px',
                marginBottom: '1px',
                lineHeight: 1.5
              }}
            >
              <span style={{ color: 'var(--primary, #0d9488)', flexShrink: 0, userSelect: 'none', fontWeight: 700 }}>•</span>
              <div style={{ flex: 1, minWidth: 0 }}>{parseInlineTokens(bulletMatch[3])}</div>
            </div>
          );
        }

        // 2. Indented continuation line (2+ spaces)
        const indentMatch = line.match(/^(\s{2,})(.*)$/);
        if (indentMatch) {
          const indentLevel = Math.max(1, Math.floor(indentMatch[1].length / 2));
          return (
            <div
              key={idx}
              style={{
                marginLeft: `${indentLevel * 14 + 10}px`,
                marginTop: '1px',
                marginBottom: '2px',
                lineHeight: 1.5
              }}
            >
              {parseInlineTokens(indentMatch[2])}
            </div>
          );
        }

        // 3. Empty line
        if (!line.trim()) {
          return <div key={idx} style={{ height: '0.45rem' }} />;
        }

        // 4. Normal paragraph line
        return (
          <div key={idx} style={{ lineHeight: 1.5, marginTop: idx === 0 ? 0 : '2px', marginBottom: '2px' }}>
            {parseInlineTokens(line)}
          </div>
        );
      })}
    </div>
  );
}

function parseInlineTokens(str: string): React.ReactNode[] {
  if (!str) return [];

  // Match bold (**...** or __...__), underline (<u>...</u> or ~...~), and italic (*...* or _..._)
  // Note: Italic opening delimiter must not be followed by whitespace: (?!\s)
  // Bold pattern handles optional leading/trailing spaces inside: \*\*(?:[^*]|\*(?!\*))+?\*\*
  const tokenRegex = /(\*\*(?:[^*]|\*(?!\*))+?\*\*|__(?:[^_]|_(?!_))+?__|<u>(?:(?!<\/u>).)*?<\/u>|~[^~]+?~|\*(?!\s)(?:[^*]+?)(?<!\s)\*|_(?!\s)(?:[^_]+?)(?<!\s)_)/g;

  const parts = str.split(tokenRegex);
  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold: **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
        (part.startsWith('__') && part.endsWith('__') && part.length >= 4)) {
      const inner = part.slice(2, -2);
      return <strong key={idx} style={{ fontWeight: 700 }}>{parseInlineTokens(inner)}</strong>;
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
  formatType: 'bold' | 'italic' | 'underline' | 'bullet',
  currentValue: string,
  onChange: (newVal: string) => void
): void {
  if (!inputEl) return;

  const start = inputEl.selectionStart ?? 0;
  const end = inputEl.selectionEnd ?? 0;

  if (formatType === 'bullet') {
    const lineStart = currentValue.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = currentValue.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = currentValue.length;

    const linesText = currentValue.substring(lineStart, lineEnd);
    const lines = linesText.split('\n');
    const hasContent = lines.some(l => l.trim().length > 0);
    const allBulleted = hasContent && lines.every(l => !l.trim() || /^\s*(\*|-|\+|•)\s/.test(l));

    let transformed: string[];
    if (allBulleted) {
      transformed = lines.map(l => l.replace(/^(\s*)(\*|-|\+|•)\s?/, '$1'));
    } else {
      transformed = lines.map(l => {
        if (/^\s*(\*|-|\+|•)\s/.test(l)) return l;
        return l.length > 0 ? `* ${l}` : '* ';
      });
      if (lines.length === 1 && lines[0] === '') {
        transformed = ['* '];
      }
    }

    const replacement = transformed.join('\n');
    const newValue = currentValue.substring(0, lineStart) + replacement + currentValue.substring(lineEnd);
    const newCursorStart = lineStart + replacement.length;
    const newCursorEnd = lineStart + replacement.length;

    onChange(newValue);
    requestAnimationFrame(() => {
      inputEl.focus();
      inputEl.setSelectionRange(newCursorStart, newCursorEnd);
    });
    return;
  }

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

/**
 * Strips inline markdown tokens (**bold**, *italic*, <u>underline</u>, ~underline~)
 * returning clean plain text suitable for native HTML attributes like placeholder or title.
 * Preserves newlines (\n) for multi-line inputs.
 */
export function stripMarkdownTokens(text?: string | null): string {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);

  if (!text.includes('*') && !text.includes('_') && !text.includes('<u>') && !text.includes('~') && !text.includes('•') && !text.includes('-')) {
    return text;
  }

  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/<\/?u>/g, '')
    .replace(/~(.*?)~/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/^(\s*)[*•\-+]\s+/gm, '$1');
}

/**
 * Inserts text at the current cursor position of an input/textarea and restores focus.
 */
export function insertTextAtCursor(
  inputEl: HTMLTextAreaElement | HTMLInputElement | null,
  textToInsert: string,
  currentValue: string,
  onChange: (newVal: string) => void
): void {
  if (!inputEl) {
    onChange(currentValue + textToInsert);
    return;
  }
  const start = inputEl.selectionStart ?? currentValue.length;
  const end = inputEl.selectionEnd ?? currentValue.length;
  const newValue = currentValue.substring(0, start) + textToInsert + currentValue.substring(end);
  onChange(newValue);
  setTimeout(() => {
    inputEl.focus();
    const newPos = start + textToInsert.length;
    inputEl.setSelectionRange(newPos, newPos);
  }, 0);
}

