/**
 * FormTranslator - LLM Client Module
 * Handles sending dictionary payloads to LLM APIs (Gemini/OpenAI)
 * or resolving via context-aware domain glossaries aligned with verified international standards.
 */

const { QC_DOMAIN_GLOSSARY, getDomainGlossary, buildPrompt } = require('./llmInstructions.cjs');

/**
 * Translates a text dictionary using context-aware domain glossaries.
 * Prioritizes profile-specific industry standards (e.g. Finished Product Specification,
 * Container Stuffing, Production Planning) over naive literal translations.
 * 
 * @param {Object.<string, string>} dictionary
 * @param {string} [domainProfile='GENERAL_QC']
 * @returns {Object.<string, string>}
 */
function translateWithGlossary(dictionary, domainProfile = 'GENERAL_QC') {
  const domainGlossary = getDomainGlossary(domainProfile);
  const result = {};

  for (const [path, text] of Object.entries(dictionary)) {
    // 1. Profile-specific glossary direct match
    if (domainGlossary[text]) {
      result[path] = domainGlossary[text];
      continue;
    }

    // 2. Fallback to master QC glossary direct match
    if (QC_DOMAIN_GLOSSARY[text]) {
      result[path] = QC_DOMAIN_GLOSSARY[text];
      continue;
    }

    // 3. Trimmed match
    const trimmed = text.trim();
    if (domainGlossary[trimmed]) {
      result[path] = domainGlossary[trimmed];
      continue;
    }
    if (QC_DOMAIN_GLOSSARY[trimmed]) {
      result[path] = QC_DOMAIN_GLOSSARY[trimmed];
      continue;
    }

    // 4. Fallback heuristics for common patterns
    let translated = trimmed;
    if (trimmed.startsWith('Số ')) {
      translated = trimmed.replace('Số ', 'Quantity of ');
    } else if (trimmed === '(mỗi đơn hàng)') {
      translated = '(per order)';
    }

    result[path] = translated;
  }
  return result;
}

/**
 * Calls the Google Gemini REST API with the prompt.
 */
async function callGeminiApi(apiKey, systemInstruction, promptText) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    system_instruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Gemini API returned empty response');
  }

  return JSON.parse(textOutput);
}

/**
 * Main translation dispatcher.
 * 
 * @param {Object.<string, string>} dictionary
 * @param {Object} [options]
 * @param {string} [options.domainProfile='GENERAL_QC']
 * @param {string} [options.mode='auto'] - 'auto' | 'api' | 'glossary' | 'custom'
 * @param {Object} [options.customDictionary]
 * @returns {Promise<Object.<string, string>>}
 */
async function translateDictionary(dictionary, options = {}) {
  const domainProfile = options.domainProfile || 'GENERAL_QC';
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  const mode = options.mode || (geminiKey ? 'api' : 'glossary');

  // If custom dictionary passed (e.g. from file)
  if (options.customDictionary) {
    const merged = { ...translateWithGlossary(dictionary, domainProfile), ...options.customDictionary };
    return merged;
  }

  if (mode === 'api' && geminiKey) {
    const { systemInstruction, promptText } = buildPrompt(dictionary, domainProfile);
    try {
      const apiResult = await callGeminiApi(geminiKey, systemInstruction, promptText);
      const profileGlossary = getDomainGlossary(domainProfile);
      const validated = {};
      for (const k of Object.keys(dictionary)) {
        validated[k] = apiResult[k] || profileGlossary[dictionary[k]] || QC_DOMAIN_GLOSSARY[dictionary[k]] || dictionary[k];
      }
      return validated;
    } catch (err) {
      console.warn(`[LLMClient] API translation failed: ${err.message}. Falling back to domain glossary.`);
      return translateWithGlossary(dictionary, domainProfile);
    }
  }

  // Default / fallback: context-aware domain glossary
  return translateWithGlossary(dictionary, domainProfile);
}

module.exports = {
  translateDictionary,
  translateWithGlossary
};
