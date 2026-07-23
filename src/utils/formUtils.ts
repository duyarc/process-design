import type { TitleFormatISO } from '../types';

/**
 * Sanitizes field labels by stripping trailing colons and extra whitespace.
 */
export const sanitizeLabel = (label?: string): string => {
  if (!label) return '';
  return label.replace(/:+$/, '').trim();
};

/**
 * Calculates the effective title format for a block with fallback defaults.
 * SECTION_LABEL defaults to 'H1', all other content blocks default to 'BODY'.
 */
export const getEffectiveTitleFormat = (block: { type: string; titleFormat?: TitleFormatISO; sectionFormat?: 'H1' | 'H2' }): TitleFormatISO => {
  if (block.titleFormat) return block.titleFormat;
  if (block.type === 'SECTION_LABEL') return block.sectionFormat || 'H1';
  return 'BODY';
};
