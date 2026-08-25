import type { FormFieldISO, TitleFormatISO } from '../types';

/**
 * Automatically determines whether a checkbox or radio field should render using
 * Option A (Inline 1-line or 2-Column Grid) or Option C (Top-Aligned Label + Options underneath).
 * Takes into account the number of columns in the parent layout block (blockColumns) or field colSpan.
 */
export function getAutoCheckboxLayoutMode(field: FormFieldISO, blockColumns: number = 2): 'OPTION_A' | 'OPTION_C' {
  const labelLength = (field.checkItem || '').trim().length;
  const options = field.options || [];

  // Effective columns: if field has colSpan spanning full width, treat as 1 column
  const effectiveCols = (field.colSpan && field.colSpan >= blockColumns) ? 1 : blockColumns;

  // 1. Long Option Text Rule: If any option description exceeds 40 characters -> must be Option C
  const hasLongOptionText = options.some(opt => (opt.label || '').length > 40);
  if (hasLongOptionText) return 'OPTION_C';

  // 2. High Option Density Rule: More than 4 stacked options with medium text length (>20 chars)
  const isHighDensity = options.length >= 4 && options.some(opt => (opt.label || '').length > 20);
  if (isHighDensity) return 'OPTION_C';

  // 3. Context-Aware Label & Total Length Thresholds:
  const totalOptionsLength = options.reduce((sum, opt) => sum + (opt.label || '').length, 0);

  if (effectiveCols === 1) {
    // In 1-column layout (~698px width), questions up to 65 chars with short options easily fit on 1 line.
    // Also if label + options total <= 85 characters, stay Option A (Inline).
    if (labelLength > 65 && totalOptionsLength > 25) return 'OPTION_C';
    if (labelLength > 75) return 'OPTION_C';
    return 'OPTION_A';
  }

  if (effectiveCols === 2) {
    // In 2-column layout (~340px width)
    if (labelLength > 45 && totalOptionsLength > 15) return 'OPTION_C';
    if (labelLength > 55) return 'OPTION_C';
    return 'OPTION_A';
  }

  // In 3+ column layout (~220px width)
  if (labelLength > 30) return 'OPTION_C';
  return 'OPTION_A';
}

/**
 * Checks whether options within a field are long or dense, requiring vertical stacking (column).
 * If false, options can be displayed horizontally inline with flex-direction: row.
 */
export function hasLongOptions(field: FormFieldISO): boolean {
  const options = field.options || [];
  if (options.some(opt => (opt.label || '').length > 30)) return true;
  if (options.length >= 4 && options.some(opt => (opt.label || '').length > 15)) return true;
  if (options.length > 5) return true;
  return false;
}

/**
 * Sanitizes field labels by stripping trailing colons and extra whitespace.
 */
export const sanitizeLabel = (label?: string): string => {
  if (!label) return '';
  return label.replace(/:+$/, '').trim();
};

/**
 * Calculates the effective title format for a block with fallback defaults.
 * SECTION_LABEL defaults to 'H1', all other content blocks default to 'NONE'.
 */
export const getEffectiveTitleFormat = (block: { type: string; titleFormat?: TitleFormatISO; sectionFormat?: 'H1' | 'H2' }): TitleFormatISO => {
  if (block.titleFormat) return block.titleFormat;
  if (block.type === 'SECTION_LABEL') return block.sectionFormat || 'NONE';
  return 'NONE';
};

/**
 * Normalizes any title string to follow Digital 5S naming conventions:
 * 1. Remove Vietnamese diacritics (accents)
 * 2. Strip special characters (except alphanumeric, spaces, and underscores)
 * 3. Replace spaces with underscores and remove duplicate underscores
 */
export function to5SFileName(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[đđ]/g, 'd')
    .replace(/[ĐĐ]/g, 'D')
    .replace(/[^a-zA-Z0-9\s_]/g, '') // strip special chars
    .trim()
    .replace(/\s+/g, '_') // space to underscore
    .replace(/_+/g, '_'); // duplicate underscores to single
}

export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Modular Form Submission Validation Handler.
 * 
 * Note for future sessions:
 * The hardcoded all-fields completion check ("Please fill out all check items") has been removed.
 * Use this function as the central entry point to plug in domain-specific validation rules
 * (e.g. required field flags, custom spec constraints, or step-based criteria).
 */
export const validateFormSubmission = (
  _formTemplate: any,
  _formValues: Record<string, any>
): FormValidationResult => {
  // Default: bypass arbitrary completion checks
  return {
    isValid: true,
    errors: []
  };
};


