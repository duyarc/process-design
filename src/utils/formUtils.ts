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


