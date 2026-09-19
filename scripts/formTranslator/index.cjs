/**
 * FormTranslator - Main Programmatic Entry Point
 * Exposes core functions and an end-to-end translation pipeline.
 */

const { extractTranslatableStrings } = require('./extractor.cjs');
const { reconstituteForm, assertInvariants } = require('./reconstitutor.cjs');
const { translateDictionary, translateWithGlossary } = require('./llmClient.cjs');
const { buildPrompt, QC_DOMAIN_GLOSSARY, SYSTEM_PROMPT } = require('./llmInstructions.cjs');
const { loadForm, saveForm } = require('./dbAdapter.cjs');

/**
 * Executes the complete translation pipeline:
 * Load from DB -> Extract -> Translate (LLM) -> Reconstitute & Validate -> Upsert to DB.
 * 
 * @param {Object} options
 * @param {string} options.formId - Source form ID (e.g. "3S-QC/Q1.1e")
 * @param {string} [options.version] - Optional version
 * @param {string} [options.targetFormId] - Destination form ID (defaults to formId)
 * @param {string} [options.targetVersion] - Destination version (defaults to source version)
 * @param {string} [options.targetStatus] - Destination status (defaults to source status)
 * @param {string} [options.mode='auto'] - Translation mode
 * @param {Object} [options.customDictionary] - Pre-translated dictionary override
 * @param {boolean} [options.dryRun=false] - If true, skips DB upsert and returns payload
 * @returns {Promise<Object>}
 */
async function translateFormPipeline(options) {
  if (!options || !options.formId) {
    throw new Error('formId is required for translateFormPipeline');
  }

  // 1. Load form from DB
  const originalForm = await loadForm(options.formId, options.version);

  // 2. Extract translatable dictionary
  const { dictionary, metadata } = extractTranslatableStrings(originalForm);

  // 3. Translate dictionary
  const translatedDict = await translateDictionary(dictionary, {
    mode: options.mode,
    customDictionary: options.customDictionary
  });

  // 4. Reconstitute and assert invariants
  const { reconstitutedForm, stats } = reconstituteForm(originalForm, translatedDict, {
    targetFormId: options.targetFormId || options.formId,
    targetVersion: options.targetVersion || options.version,
    targetStatus: options.targetStatus || originalForm.status
  });

  // 5. Save to database if not dryRun
  let savedRecord = null;
  if (!options.dryRun) {
    savedRecord = await saveForm(reconstitutedForm);
  }

  return {
    sourceMetadata: metadata,
    stats,
    extractedDictionary: dictionary,
    translatedDictionary: translatedDict,
    reconstitutedForm,
    savedRecord,
    isDryRun: !!options.dryRun
  };
}

module.exports = {
  extractTranslatableStrings,
  reconstituteForm,
  assertInvariants,
  translateDictionary,
  translateWithGlossary,
  buildPrompt,
  QC_DOMAIN_GLOSSARY,
  SYSTEM_PROMPT,
  loadForm,
  saveForm,
  translateFormPipeline
};
