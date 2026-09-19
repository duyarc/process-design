/**
 * FormTranslator - LLM Client Module
 * Handles sending dictionary payloads to LLM APIs (Gemini/OpenAI)
 * or resolving via high-fidelity domain glossary and agentic translation map.
 */

const { QC_DOMAIN_GLOSSARY, buildPrompt } = require('./llmInstructions.cjs');

/**
 * Translates a text dictionary using a built-in domain glossary and rules.
 * Serves as the zero-dependency, deterministic agentic engine when no external API key is set.
 */
function translateWithGlossary(dictionary) {
  const result = {};
  for (const [path, text] of Object.entries(dictionary)) {
    // 1. Direct glossary match
    if (QC_DOMAIN_GLOSSARY[text]) {
      result[path] = QC_DOMAIN_GLOSSARY[text];
      continue;
    }

    // 2. Case-insensitive / trimmed match
    const trimmed = text.trim();
    if (QC_DOMAIN_GLOSSARY[trimmed]) {
      result[path] = QC_DOMAIN_GLOSSARY[trimmed];
      continue;
    }

    // 3. Fallback heuristics for common suffixes / patterns
    let translated = trimmed;
    if (trimmed.startsWith('Số ')) {
      translated = trimmed.replace('Số ', 'Number of ');
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
 * @param {string} [options.mode='auto'] - 'auto' | 'api' | 'glossary' | 'custom'
 * @param {Object} [options.customDictionary]
 * @returns {Promise<Object.<string, string>>}
 */
async function translateDictionary(dictionary, options = {}) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  const mode = options.mode || (geminiKey ? 'api' : 'glossary');

  // If custom dictionary passed (e.g. from file)
  if (options.customDictionary) {
    const merged = { ...translateWithGlossary(dictionary), ...options.customDictionary };
    return merged;
  }

  if (mode === 'api' && geminiKey) {
    const { systemInstruction, promptText } = buildPrompt(dictionary);
    try {
      const apiResult = await callGeminiApi(geminiKey, systemInstruction, promptText);
      // Validate that all original keys exist
      const validated = {};
      for (const k of Object.keys(dictionary)) {
        validated[k] = apiResult[k] || QC_DOMAIN_GLOSSARY[dictionary[k]] || dictionary[k];
      }
      return validated;
    } catch (err) {
      console.warn(`[LLMClient] API translation failed: ${err.message}. Falling back to domain glossary.`);
      return translateWithGlossary(dictionary);
    }
  }

  // Default / fallback: high-fidelity glossary
  return translateWithGlossary(dictionary);
}

module.exports = {
  translateDictionary,
  translateWithGlossary
};
