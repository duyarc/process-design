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

          // Field placeholder
          if (typeof field.placeholder === 'string' && field.placeholder.trim()) {
            const path = `blocks[${bIdx}].fields[${fIdx}].placeholder`;
            dictionary[path] = field.placeholder.trim();
            paths.push(path);
          }

          // Field reactionProtocol (e.g. sign-off instructions)
          if (typeof field.reactionProtocol === 'string' && field.reactionProtocol.trim()) {
            const path = `blocks[${bIdx}].fields[${fIdx}].reactionProtocol`;
            dictionary[path] = field.reactionProtocol.trim();
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

          // Column options (for select, radio columns)
          if (col && Array.isArray(col.options)) {
            col.options.forEach((opt, oIdx) => {
              if (opt && typeof opt.label === 'string' && opt.label.trim()) {
                if (!/^[\.\s_-]+$/.test(opt.label.trim())) {
                  const path = `blocks[${bIdx}].tableColumns[${cIdx}].options[${oIdx}].label`;
                  dictionary[path] = opt.label.trim();
                  paths.push(path);
                }
              }
            });
          }
        });
      }

      // TABLE rows (group headers, row labels)
      if (Array.isArray(block.tableRows)) {
        block.tableRows.forEach((row, rIdx) => {
          if (!row) return;
          if (typeof row.groupTitle === 'string' && row.groupTitle.trim()) {
            const path = `blocks[${bIdx}].tableRows[${rIdx}].groupTitle`;
            dictionary[path] = row.groupTitle.trim();
            paths.push(path);
          }
          if (typeof row.label === 'string' && row.label.trim()) {
            const path = `blocks[${bIdx}].tableRows[${rIdx}].label`;
            dictionary[path] = row.label.trim();
            paths.push(path);
          }
        });
      }

      // Pre-filled TABLE data (strings that are not pure numbers)
      if (block.tableData && typeof block.tableData === 'object') {
        Object.entries(block.tableData).forEach(([rId, rowVals]) => {
          if (!rowVals || typeof rowVals !== 'object') return;
          Object.entries(rowVals).forEach(([cId, val]) => {
            if (typeof val === 'string' && val.trim() && isNaN(Number(val))) {
              const path = `blocks[${bIdx}].tableData.${rId}.${cId}`;
              dictionary[path] = val.trim();
              paths.push(path);
            }
          });
        });
      }
    });
  }

  const formId = form.formId || form.form_id || 'UNKNOWN';
  const version = form.version || 'v0.1';
  const domainProfile = detectDomainProfile(form);

  return {
    dictionary,
    metadata: {
      formId,
      version,
      domainProfile,
      totalStrings: paths.length,
      paths
    }
  };
}

/**
 * Detects the specialized manufacturing / QC / supply-chain domain profile of a form.
 * 
 * @param {Object} form - FormTemplateISO
 * @returns {'FINISHED_PRODUCT_SPECIFICATION' | 'CONTAINER_STUFFING_LOGISTICS' | 'PRODUCTION_PLANNING' | 'ORDER_MANAGEMENT' | 'GENERAL_QC'}
 */
function detectDomainProfile(form) {
  const formId = (form.formId || form.form_id || '').toUpperCase();
  const title = (form.formTitle || form.form_title || '').toLowerCase();

  if (formId.includes('Q1.2') || title.includes('tiêu chuẩn kỹ thuật') || title.includes('specification')) {
    return 'FINISHED_PRODUCT_SPECIFICATION';
  }
  if (formId.includes('Q1.3') || title.includes('đóng hàng') || title.includes('stuffing')) {
    return 'CONTAINER_STUFFING_LOGISTICS';
  }
  if (formId.includes('Q1.4') || title.includes('lịch sản xuất') || title.includes('production schedule')) {
    return 'PRODUCTION_PLANNING';
  }
  if (formId.includes('Q1.1') || title.includes('thông tin đơn hàng') || title.includes('order information')) {
    return 'ORDER_MANAGEMENT';
  }
  return 'GENERAL_QC';
}

module.exports = {
  extractTranslatableStrings,
  detectDomainProfile
};
