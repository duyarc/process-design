/**
 * FormTranslator - Extractor Module
 * Pure utility to extract human-facing translatable strings from FormTemplateISO
 * while strictly shielding all structural identifiers, types, coordinates, and option values.
 */

/**
 * Traverses a FormTemplateISO object and returns a flat dictionary of translatable texts.
 * 
 * Path notation examples:
 * - "formTitle"
 * - "blocks[0].title"
 * - "blocks[0].description"
 * - "blocks[1].fields[2].checkItem"
 * - "blocks[1].fields[2].options[0].label"
 * - "blocks[5].tableColumns[1].label"
 * 
 * @param {Object} form - The FormTemplateISO object
 * @returns {{ dictionary: Object.<string, string>, metadata: Object }}
 */
function extractTranslatableStrings(form) {
  if (!form || typeof form !== 'object') {
    throw new Error('Invalid form object provided to extractTranslatableStrings');
  }

  const dictionary = {};
  const paths = [];

  // 1. Form title
  const formTitle = form.formTitle || form.form_title;
  if (typeof formTitle === 'string' && formTitle.trim()) {
    dictionary['formTitle'] = formTitle.trim();
    paths.push('formTitle');
  }

  // 2. Layout blocks
  const blocks = form.layoutBlocks || form.layout_blocks || [];
  if (Array.isArray(blocks)) {
    blocks.forEach((block, bIdx) => {
      if (!block) return;

      // Block title
      if (typeof block.title === 'string' && block.title.trim()) {
        const path = `blocks[${bIdx}].title`;
        dictionary[path] = block.title.trim();
        paths.push(path);
      }

      // Block formTitle (on TITLE blocks)
      if (typeof block.formTitle === 'string' && block.formTitle.trim()) {
        const path = `blocks[${bIdx}].formTitle`;
        dictionary[path] = block.formTitle.trim();
        paths.push(path);
      }

      // Block description (e.g. TITLE description, SECTION_LABEL)
      if (typeof block.description === 'string' && block.description.trim()) {
        const path = `blocks[${bIdx}].description`;
        dictionary[path] = block.description.trim();
        paths.push(path);
      }

      // Legacy CHECKLIST_TABLE custom columnLabels
      if (block.columnLabels && typeof block.columnLabels === 'object') {
        ['stt', 'item', 'target', 'reaction'].forEach(colKey => {
          if (typeof block.columnLabels[colKey] === 'string' && block.columnLabels[colKey].trim()) {
            const path = `blocks[${bIdx}].columnLabels.${colKey}`;
            dictionary[path] = block.columnLabels[colKey].trim();
            paths.push(path);
          }
        });
      }

      // Fields
      if (Array.isArray(block.fields)) {
        block.fields.forEach((field, fIdx) => {
          if (!field) return;

          // Field checkItem / label
          if (typeof field.checkItem === 'string' && field.checkItem.trim()) {
            const path = `blocks[${bIdx}].fields[${fIdx}].checkItem`;
            dictionary[path] = field.checkItem.trim();
            paths.push(path);
          }

          // Field targetRange description
          if (typeof field.targetRange === 'string' && field.targetRange.trim()) {
            const path = `blocks[${bIdx}].fields[${fIdx}].targetRange`;
            dictionary[path] = field.targetRange.trim();
            paths.push(path);
          }

          // Field options (for radio, checkbox, select)
          if (Array.isArray(field.options)) {
            field.options.forEach((opt, oIdx) => {
              if (opt && typeof opt.label === 'string' && opt.label.trim()) {
                // Ignore placeholder dot lines like "......................"
                if (!/^[\.\s_-]+$/.test(opt.label.trim())) {
                  const path = `blocks[${bIdx}].fields[${fIdx}].options[${oIdx}].label`;
                  dictionary[path] = opt.label.trim();
                  paths.push(path);
                }
              }
            });
          }
        });
      }

      // Dynamic TABLE columns
      if (Array.isArray(block.tableColumns)) {
        block.tableColumns.forEach((col, cIdx) => {
          if (col && typeof col.label === 'string' && col.label.trim()) {
            const path = `blocks[${bIdx}].tableColumns[${cIdx}].label`;
            dictionary[path] = col.label.trim();
            paths.push(path);
          }
        });
      }
    });
  }

  const formId = form.formId || form.form_id || 'UNKNOWN';
  const version = form.version || 'v0.1';

  return {
    dictionary,
    metadata: {
      formId,
      version,
      totalStrings: paths.length,
      paths
    }
  };
}

module.exports = {
  extractTranslatableStrings
};
