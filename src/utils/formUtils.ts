import type { FormFieldISO, TitleFormatISO } from '../types';

/**
 * Automatically determines whether a checkbox or radio field should render using
 * Option A (2-Column Fixed Grid with 35% left column) or Option C (Top-Aligned Label + Indented Options).
 */
export function getAutoCheckboxLayoutMode(field: FormFieldISO): 'OPTION_A' | 'OPTION_C' {
  const labelLength = (field.checkItem || '').trim().length;
  const options = field.options || [];

  // 1. Long Label Rule: If label text exceeds 35 characters
  if (labelLength > 35) return 'OPTION_C';

  // 2. Long Option Text Rule: If any option description exceeds 40 characters
  const hasLongOptionText = options.some(opt => (opt.label || '').length > 40);
  if (hasLongOptionText) return 'OPTION_C';

  // 3. High Option Density Rule: More than 4 stacked options with medium text length (>20 chars)
  const isHighDensity = options.length >= 4 && options.some(opt => (opt.label || '').length > 20);
  if (isHighDensity) return 'OPTION_C';

  // Default to Option A (Clean 2-Column Grid)
  return 'OPTION_A';
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


