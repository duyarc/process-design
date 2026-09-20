/**
 * FormTranslator - Reconstitutor & Invariant Assertion Module
 * Deep-clones the original FormTemplateISO skeleton, merges translated strings,
 * and asserts that all structural IDs, types, and option values remain 100% intact.
 */

/**
 * Sets a value at a parsed path on the target object.
 * Supports dot and array bracket notation e.g. "blocks[1].fields[2].options[0].label"
 */
function setByPath(obj, path, value) {
  let normalized = path;
  if (normalized.startsWith('blocks[') || normalized.startsWith('blocks.')) {
    const prop = obj.layoutBlocks !== undefined ? 'layoutBlocks' : (obj.layout_blocks !== undefined ? 'layout_blocks' : 'layoutBlocks');
    normalized = normalized.replace(/^blocks/, prop);
  }

  const parts = normalized.replace(/\[(\w+)\]/g, '.$1').split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (curr[key] === undefined) {
      // Fallback for snake_case vs camelCase if needed
      if (key === 'layoutBlocks' && curr['layout_blocks'] !== undefined) {
        curr = curr['layout_blocks'];
        continue;
      }
      return false;
    }
    curr = curr[key];
  }
  const lastKey = parts[parts.length - 1];
  curr[lastKey] = value;
  return true;
}

/**
 * Asserts structural invariants between original form and reconstituted form.
 * Throws an error if any invariant is violated.
 */
function assertInvariants(original, reconstituted) {
  const origBlocks = original.layoutBlocks || original.layout_blocks || [];
  const reconBlocks = reconstituted.layoutBlocks || reconstituted.layout_blocks || [];

  if (origBlocks.length !== reconBlocks.length) {
    throw new Error(`[INVARIANT VIOLATION] Block count mismatch: original has ${origBlocks.length}, reconstituted has ${reconBlocks.length}`);
  }

  for (let bIdx = 0; bIdx < origBlocks.length; bIdx++) {
    const oBlock = origBlocks[bIdx];
    const rBlock = reconBlocks[bIdx];

    if (oBlock.id !== rBlock.id) {
      throw new Error(`[INVARIANT VIOLATION] Block ID mismatch at index ${bIdx}: '${oBlock.id}' vs '${rBlock.id}'`);
    }
    if (oBlock.type !== rBlock.type) {
      throw new Error(`[INVARIANT VIOLATION] Block type mismatch at index ${bIdx}: '${oBlock.type}' vs '${rBlock.type}'`);
    }

    // Check fields
    const oFields = oBlock.fields || [];
    const rFields = rBlock.fields || [];
    if (oFields.length !== rFields.length) {
      throw new Error(`[INVARIANT VIOLATION] Field count mismatch in block ${oBlock.id}`);
    }

    for (let fIdx = 0; fIdx < oFields.length; fIdx++) {
      const oField = oFields[fIdx];
      const rField = rFields[fIdx];

      if (oField.id !== rField.id) {
        throw new Error(`[INVARIANT VIOLATION] Field ID mismatch at block ${bIdx}, field ${fIdx}: '${oField.id}' vs '${rField.id}'`);
      }
      if (oField.type !== rField.type) {
        throw new Error(`[INVARIANT VIOLATION] Field type mismatch at field ${oField.id}`);
      }
      if (oField.locationCode !== rField.locationCode) {
        throw new Error(`[INVARIANT VIOLATION] Location code mismatch at field ${oField.id}`);
      }

      // Check options
      const oOpts = oField.options || [];
      const rOpts = rField.options || [];
      if (oOpts.length !== rOpts.length) {
        throw new Error(`[INVARIANT VIOLATION] Option count mismatch in field ${oField.id}`);
      }
      for (let oIdx = 0; oIdx < oOpts.length; oIdx++) {
        if (oOpts[oIdx].value !== rOpts[oIdx].value) {
          throw new Error(`[INVARIANT VIOLATION] Option value mismatch in field ${oField.id}, option ${oIdx}: '${oOpts[oIdx].value}' vs '${rOpts[oIdx].value}'`);
        }
      }
    }

    // Check table columns
    const oCols = oBlock.tableColumns || [];
    const rCols = rBlock.tableColumns || [];
    if (oCols.length !== rCols.length) {
      throw new Error(`[INVARIANT VIOLATION] Table column count mismatch in block ${oBlock.id}`);
    }
    for (let cIdx = 0; cIdx < oCols.length; cIdx++) {
      if (oCols[cIdx].id !== rCols[cIdx].id) {
        throw new Error(`[INVARIANT VIOLATION] Column ID mismatch in block ${oBlock.id}, col ${cIdx}`);
      }
      if (oCols[cIdx].type !== rCols[cIdx].type) {
        throw new Error(`[INVARIANT VIOLATION] Column type mismatch in block ${oBlock.id}, col ${cIdx}`);
      }
    }
  }

  return true;
}

/**
 * Reconstitutes a translated form from an original skeleton and a translated dictionary.
 * 
 * @param {Object} originalForm - The original FormTemplateISO
 * @param {Object.<string, string>} translatedDict - Key-value pair of path to translated string
 * @param {Object} [options] - Target metadata overrides
 * @returns {Object} Reconstituted and validated translated FormTemplateISO
 */
function reconstituteForm(originalForm, translatedDict, options = {}) {
  if (!originalForm || typeof originalForm !== 'object') {
    throw new Error('Invalid originalForm provided to reconstituteForm');
  }
  if (!translatedDict || typeof translatedDict !== 'object') {
    throw new Error('Invalid translatedDict provided to reconstituteForm');
  }

  // Deep clone to ensure original remains pure and untouched
  const clone = JSON.parse(JSON.stringify(originalForm));

  // Ingest translations
  let appliedCount = 0;
  for (const [path, translatedText] of Object.entries(translatedDict)) {
    if (typeof translatedText === 'string' && translatedText.trim()) {
      const ok = setByPath(clone, path, translatedText.trim());
      if (ok) {
        appliedCount++;
        // If formTitle was translated, also sync form_title for DB compatibility
        if (path === 'formTitle') {
          clone.form_title = translatedText.trim();
        }
      }
    }
  }

  // Apply optional metadata overrides
  if (options.targetFormId) {
    clone.formId = options.targetFormId;
    clone.form_id = options.targetFormId;
    clone.formName = options.targetFormId;
    clone.form_name = options.targetFormId;
    const blocks = clone.layoutBlocks || clone.layout_blocks || [];
    for (const b of blocks) {
      if (b && b.type === 'TITLE' && b.formCode) {
        b.formCode = options.targetFormId;
      }
    }
  }
  if (options.targetVersion) {
    clone.version = options.targetVersion;
  }
  if (options.targetStatus) {
    clone.status = options.targetStatus;
  }

  // Run strict invariant check against original
  assertInvariants(originalForm, clone);

  return {
    reconstitutedForm: clone,
    stats: {
      appliedCount,
      totalKeys: Object.keys(translatedDict).length
    }
  };
}

module.exports = {
  reconstituteForm,
  assertInvariants
};
