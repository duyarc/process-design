/**
 * FormTranslator - Reporter & Review Module
 * Generates minimal, clean terminology review reports (source vs. selected translation)
 * and parses user replacement/override requests.
 */

/**
 * Generates a deduplicated translation review report from extracted and translated dictionaries.
 * 
 * @param {Object.<string, string>} extractedDict - Map of path -> original source text
 * @param {Object.<string, string>} translatedDict - Map of path -> translated text
 * @param {Object} [options]
 * @param {string} [options.formId] - Optional form identifier
 * @returns {Object} Report model containing deduplicated entries with 1-based indices
 */
function generateTranslationReport(extractedDict, translatedDict, options = {}) {
  const formId = options.formId || '';
  const entriesMap = new Map();

  for (const [path, sourceText] of Object.entries(extractedDict)) {
    const translation = translatedDict[path] || sourceText;
    const cleanSource = typeof sourceText === 'string' ? sourceText.trim() : String(sourceText);
    const cleanTranslation = typeof translation === 'string' ? translation.trim() : String(translation);

    // Group by sourceText
    if (!entriesMap.has(cleanSource)) {
      entriesMap.set(cleanSource, {
        source: cleanSource,
        translation: cleanTranslation,
        paths: [path]
      });
    } else {
      const existing = entriesMap.get(cleanSource);
      existing.paths.push(path);
      // If multiple paths have different translations, preserve the latest or combine
      if (existing.translation !== cleanTranslation) {
        existing.translation = cleanTranslation;
      }
    }
  }

  // Create indexed list
  const entries = [];
  let idx = 1;
  for (const entry of entriesMap.values()) {
    entries.push({
      index: idx++,
      source: entry.source,
      translation: entry.translation,
      paths: entry.paths
    });
  }

  return {
    formId,
    entries,
    totalUniqueTerms: entries.length,
    totalAppliedPaths: Object.keys(translatedDict).length
  };
}

/**
 * Formats report into a minimal GitHub-flavored Markdown table.
 * 
 * @param {Object} report - Output of generateTranslationReport
 * @returns {string} Markdown string
 */
function formatReportMarkdown(report) {
  const title = report.formId ? `Bảng Đối soát Thuật ngữ Dịch thuật (${report.formId})` : 'Bảng Đối soát Thuật ngữ Dịch thuật';
  const lines = [
    `### 📋 ${title}`,
    '',
    `*Tổng số thuật ngữ đã dịch: **${report.totalUniqueTerms}** khái niệm duy nhất trên **${report.totalAppliedPaths}** vị trí trường.*`,
    '',
    '| # | Từ gốc (Tiếng Việt) | Từ dịch được chọn (English) | Cú pháp thay thế |',
    '|---|---|---|---|'
  ];

  for (const item of report.entries) {
    const escapedSource = item.source.replace(/\|/g, '\\|');
    const escapedTrans = item.translation.replace(/\|/g, '\\|');
    lines.push(`| ${item.index} | ${escapedSource} | **${escapedTrans}** | \`${item.index}: <từ mới>\` |`);
  }

  const sampleIdx = report.entries[0]?.index || 1;
  const sampleSrc = report.entries[0]?.source || 'từ gốc';
  lines.push('');
  lines.push('> **💡 Hướng dẫn yêu cầu thay thế:**');
  lines.push(`> - **Qua hội thoại:** Gửi phản hồi theo số thứ tự (ví dụ: \`Đổi #${sampleIdx} thành <từ mới>\`) hoặc theo từ gốc (ví dụ: \`Đổi "${sampleSrc}" thành <từ mới>\`).`);
  lines.push(`> - **Qua CLI:** Chạy lệnh kèm cờ \`--override "${sampleIdx}: <từ mới>"\` hoặc \`--override "${sampleSrc}: <từ mới>"\`.`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Formats report into a minimal fixed-width ASCII console table.
 * 
 * @param {Object} report - Output of generateTranslationReport
 * @returns {string} Console table string
 */
function formatReportConsole(report) {
  const title = report.formId ? `BẢNG ĐỐI SOÁT THUẬT NGỮ DỊCH THUẬT [${report.formId}]` : 'BẢNG ĐỐI SOÁT THUẬT NGỮ DỊCH THUẬT';
  const lines = [];
  lines.push(`\n=== ${title} ===`);
  lines.push(`(Tổng số: ${report.totalUniqueTerms} thuật ngữ / ${report.totalAppliedPaths} vị trí)\n`);

  const colIdxWidth = 4;
  const colSrcWidth = 32;
  const colTransWidth = 34;

  const header = ` ${'#'.padEnd(colIdxWidth)} ${'Từ gốc (Tiếng Việt)'.padEnd(colSrcWidth)} ${'Từ dịch được chọn (English)'.padEnd(colTransWidth)} Cú pháp thay thế`;
  const sep = ` ${'-'.repeat(colIdxWidth)} ${'-'.repeat(colSrcWidth)} ${'-'.repeat(colTransWidth)} ------------------`;

  lines.push(header);
  lines.push(sep);

  for (const item of report.entries) {
    const idxStr = String(item.index).padEnd(colIdxWidth);
    const srcStr = (item.source.length > colSrcWidth - 2 ? item.source.slice(0, colSrcWidth - 5) + '...' : item.source).padEnd(colSrcWidth);
    const transStr = (item.translation.length > colTransWidth - 2 ? item.translation.slice(0, colTransWidth - 5) + '...' : item.translation).padEnd(colTransWidth);
    lines.push(` ${idxStr} ${srcStr} ${transStr} ${item.index}: <từ mới>`);
  }

  lines.push(sep);
  lines.push('>> Để thay thế: truyền cờ --override "<# hoặc từ gốc>: <từ mới>" (Ví dụ: --override "3: New Term")\n');

  return lines.join('\n');
}

/**
 * Parses user override input (CLI string or structured object) and maps to dictionary replacements.
 * 
 * Supported formats:
 * - String: "3: Passive Export"
 * - Multi string: "3: Passive Export; 5: Verified By" or "3: Passive Export, 5: Verified By"
 * - Term string: "XK bị động: Passive Export"
 * - Object: { "3": "Passive Export" } or { "XK bị động": "Passive Export" }
 * - JSON String: '{"3": "Passive Export"}'
 * 
 * @param {string|Object} overrideInput
 * @param {Object} report - Output of generateTranslationReport
 * @returns {{ overrides: Object.<string, string>, appliedCount: number, overriddenEntries: Array<Object> }}
 */
function parseOverrideInput(overrideInput, report) {
  if (!overrideInput || !report || !Array.isArray(report.entries)) {
    return { overrides: {}, appliedCount: 0, overriddenEntries: [] };
  }

  let rawMap = {};

  if (typeof overrideInput === 'object' && !Array.isArray(overrideInput)) {
    rawMap = overrideInput;
  } else if (typeof overrideInput === 'string') {
    const trimmed = overrideInput.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        rawMap = JSON.parse(trimmed);
      } catch {
        rawMap = {};
      }
    } else {
      // Split by semicolon or comma if multiple
      const statements = trimmed.split(/[;,]/);
      for (const st of statements) {
        const colonIdx = st.indexOf(':');
        const eqIdx = st.indexOf('=');
        const splitIdx = colonIdx !== -1 ? colonIdx : eqIdx;
        if (splitIdx !== -1) {
          const key = st.slice(0, splitIdx).trim();
          const val = st.slice(splitIdx + 1).trim();
          if (key && val) {
            rawMap[key] = val;
          }
        }
      }
    }
  }

  const overrides = {};
  const overriddenEntries = [];

  for (const [rawKey, replacement] of Object.entries(rawMap)) {
    const cleanKey = String(rawKey).trim().replace(/^#/, '');
    const cleanReplacement = String(replacement).trim();

    // Check if cleanKey is numeric index
    const numericIndex = parseInt(cleanKey, 10);
    let matchedEntry = null;

    if (!isNaN(numericIndex) && String(numericIndex) === cleanKey) {
      matchedEntry = report.entries.find(e => e.index === numericIndex);
    }

    // Fallback: match by source text
    if (!matchedEntry) {
      const lowerKey = cleanKey.toLowerCase();
      matchedEntry = report.entries.find(e => e.source.toLowerCase() === lowerKey);
    }

    if (matchedEntry) {
      for (const p of matchedEntry.paths) {
        overrides[p] = cleanReplacement;
      }
      overriddenEntries.push({
        index: matchedEntry.index,
        source: matchedEntry.source,
        oldTranslation: matchedEntry.translation,
        newTranslation: cleanReplacement,
        pathsCount: matchedEntry.paths.length
      });
    }
  }

  return {
    overrides,
    appliedCount: Object.keys(overrides).length,
    overriddenEntries
  };
}

module.exports = {
  generateTranslationReport,
  formatReportMarkdown,
  formatReportConsole,
  parseOverrideInput
};
