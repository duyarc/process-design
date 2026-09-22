import type {
  FormFieldISO,
  ReportFieldRuleOverride,
  FieldEvaluationResult,
  ReportBlockConfig
} from '../types';

/**
 * Pure Utility: Computes score, maxScore, and pass/fail evaluation for an individual form field.
 */
export function computeFieldScoreAndPass(
  rawValue: any,
  formField: FormFieldISO,
  ruleOverride?: ReportFieldRuleOverride
): {
  score: number;
  maxScore: number;
  status: 'PASS' | 'FAIL' | 'NA';
  deviationText?: string;
  weight: number;
  isKnockout: boolean;
} {
  const weight = ruleOverride?.weight !== undefined ? ruleOverride.weight : 0;
  const isKnockout = Boolean(ruleOverride?.isKnockout);

  // If value is empty or not provided
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return {
      score: 0,
      maxScore: 0,
      status: 'NA',
      weight,
      isKnockout
    };
  }

  // 1. Scale / Likert / Rating
  if (formField.type === 'likert_scale' || formField.type === 'rating') {
    const scaleOpts = formField.scaleOptions && formField.scaleOptions.length > 0
      ? formField.scaleOptions
      : ['1', '2', '3', '4', '5'];

    const numOpts = scaleOpts.length;
    // Default score gradient if not explicitly overridden: [10, 8, 6, 4, 2] or [10, 6, 2]
    const defaultScores = scaleOpts.map((_, idx) => Math.max(0, Math.round((1 - idx / Math.max(1, numOpts - 1)) * 10)));
    const maxScore = Math.max(...scaleOpts.map((opt, idx) => {
      const explicit = ruleOverride?.optionScores?.[opt] ?? ruleOverride?.optionScores?.[String(idx + 1)];
      return explicit !== undefined ? explicit : defaultScores[idx];
    }));

    const selectedIdx = scaleOpts.findIndex((opt, idx) => opt === rawValue || String(idx + 1) === rawValue);
    if (selectedIdx === -1) {
      return { score: 0, maxScore, status: 'FAIL', deviationText: `Giá trị không hợp lệ: ${rawValue}`, weight, isKnockout };
    }

    const selectedOpt = scaleOpts[selectedIdx];
    const score = ruleOverride?.optionScores?.[selectedOpt]
      ?? ruleOverride?.optionScores?.[String(selectedIdx + 1)]
      ?? defaultScores[selectedIdx];

    // Determine pass status
    let isPass = true;
    if (ruleOverride?.customPassOptions && ruleOverride.customPassOptions.length > 0) {
      isPass = ruleOverride.customPassOptions.includes(selectedOpt) || ruleOverride.customPassOptions.includes(String(selectedIdx + 1));
    } else {
      // Default: upper half passes
      isPass = selectedIdx < Math.ceil(numOpts / 2);
    }

    return {
      score,
      maxScore,
      status: isPass ? 'PASS' : 'FAIL',
      deviationText: !isPass ? `Không đạt (${selectedOpt})` : undefined,
      weight,
      isKnockout
    };
  }

  // 2. Radio / Select
  if (formField.type === 'radio' || formField.type === 'select') {
    const options = formField.options || [];
    const maxScore = Math.max(0, ...options.map(opt => {
      const explicit = ruleOverride?.optionScores?.[opt.value] ?? ruleOverride?.optionScores?.[opt.label];
      return explicit !== undefined ? explicit : 10;
    }));

    const matchingOpt = options.find(opt => opt.value === rawValue || opt.label === rawValue);
    if (!matchingOpt) {
      return { score: 0, maxScore: maxScore || 10, status: 'FAIL', deviationText: `Không có trong danh mục: ${rawValue}`, weight, isKnockout };
    }

    const score = ruleOverride?.optionScores?.[matchingOpt.value]
      ?? ruleOverride?.optionScores?.[matchingOpt.label]
      ?? (matchingOpt as any)?.score
      ?? 10;

    let isPass = true;
    if (ruleOverride?.customPassOptions && ruleOverride.customPassOptions.length > 0) {
      isPass = ruleOverride.customPassOptions.includes(matchingOpt.value) || ruleOverride.customPassOptions.includes(matchingOpt.label);
    } else {
      isPass = matchingOpt.isPass !== false;
    }

    return {
      score,
      maxScore: maxScore || 10,
      status: isPass ? 'PASS' : 'FAIL',
      deviationText: !isPass ? `Không đạt (${matchingOpt.label || matchingOpt.value})` : undefined,
      weight,
      isKnockout
    };
  }

  // 3. Checkbox
  if (formField.type === 'checkbox') {
    const options = formField.options || [];
    const rawArr = Array.isArray(rawValue)
      ? rawValue
      : (typeof rawValue === 'string' && rawValue.length > 0 ? rawValue.split(',').map(s => s.trim()) : [String(rawValue)]);

    let earnedScore = 0;
    let totalMaxScore = 0;
    let isPass = true;

    options.forEach(opt => {
      const optScore = ruleOverride?.optionScores?.[opt.value] ?? ruleOverride?.optionScores?.[opt.label] ?? 5;
      totalMaxScore += optScore;

      const isChecked = rawArr.includes(opt.value) || rawArr.includes(opt.label);
      if (isChecked) {
        earnedScore += optScore;
      }
      if (ruleOverride?.customPassOptions && ruleOverride.customPassOptions.length > 0) {
        if (ruleOverride.customPassOptions.includes(opt.value) && !isChecked) {
          isPass = false;
        }
      }
    });

    if (totalMaxScore === 0) totalMaxScore = 10;
    if (!ruleOverride?.customPassOptions) {
      isPass = rawArr.length > 0;
    }

    return {
      score: earnedScore,
      maxScore: totalMaxScore,
      status: isPass ? 'PASS' : 'FAIL',
      weight,
      isKnockout
    };
  }

  // 4. Number / Spec
  if (formField.type === 'number') {
    const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
    const targetScore = ruleOverride?.fixedScore !== undefined ? ruleOverride.fixedScore : 10;

    if (isNaN(num)) {
      return { score: 0, maxScore: targetScore, status: 'FAIL', deviationText: 'Giá trị không phải số hợp lệ', weight, isKnockout };
    }

    const min = ruleOverride?.customMinSpec !== undefined ? ruleOverride.customMinSpec : formField.minSpec;
    const max = ruleOverride?.customMaxSpec !== undefined ? ruleOverride.customMaxSpec : formField.maxSpec;

    let isPass = true;
    let devText: string | undefined;

    if (min !== undefined && max !== undefined) {
      if (num < min || num > max) {
        isPass = false;
        devText = num < min ? `Dưới giới hạn (${num} < ${min})` : `Vượt giới hạn (${num} > ${max})`;
      }
    } else if (min !== undefined) {
      if (num < min) {
        isPass = false;
        devText = `Dưới giới hạn (${num} < ${min})`;
      }
    } else if (max !== undefined) {
      if (num > max) {
        isPass = false;
        devText = `Vượt giới hạn (${num} > ${max})`;
      }
    }

    return {
      score: isPass ? targetScore : 0,
      maxScore: targetScore,
      status: isPass ? 'PASS' : 'FAIL',
      deviationText: devText,
      weight,
      isKnockout
    };
  }

  // 5. Default informational types (text, date, time, sign, etc.)
  return {
    score: 0,
    maxScore: 0,
    status: 'PASS',
    weight,
    isKnockout
  };
}

/**
 * Pure Utility: Computes Combined Score for a Sub-section H2 from its child fields.
 * Formula: Combined Score = sum(Score_i * (Weight_i / 100))
 */
export function computeH2CombinedScore(
  childFields: FormFieldISO[],
  evaluations: Record<string, FieldEvaluationResult>,
  ruleOverrides?: Record<string, ReportFieldRuleOverride>
): {
  combinedScore: number;
  isPass: boolean;
  hasKnockoutFailed: boolean;
  totalWeight: number;
} {
  if (!childFields || childFields.length === 0) {
    return { combinedScore: 0, isPass: true, hasKnockoutFailed: false, totalWeight: 0 };
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;
  let hasFail = false;
  let hasKnockoutFailed = false;

  childFields.forEach(field => {
    const override = ruleOverrides?.[field.id];
    const weight = override?.weight !== undefined ? override.weight : 0;
    const isKnockout = Boolean(override?.isKnockout);
    const evalRes = evaluations[field.id];

    const score = evalRes?.score !== undefined ? evalRes.score : 0;

    totalWeight += weight;
    totalWeightedScore += score * (weight / 100);

    if (evalRes && evalRes.status === 'FAIL') {
      hasFail = true;
      if (isKnockout) {
        hasKnockoutFailed = true;
      }
    }
  });

  // If weights don't sum to 100% (e.g. partial setup), normalize proportionally
  let finalScore = totalWeightedScore;
  if (totalWeight > 0 && totalWeight !== 100) {
    finalScore = (totalWeightedScore / totalWeight) * 100;
  }

  // Round to 1 decimal place
  const roundedScore = Math.round(finalScore * 10) / 10;
  const isPass = !hasKnockoutFailed && !hasFail;

  return {
    combinedScore: roundedScore,
    isPass,
    hasKnockoutFailed,
    totalWeight
  };
}

/**
 * Pure Utility: Computes Combined Score for Section H1 from child H2 blocks.
 * Formula: Combined Score = sum(Score_H2_j * (Weight_j / 100))
 */
export function computeH1CombinedScore(
  h2Blocks: { score: number; isPass: boolean; weight: number; isKnockout?: boolean }[]
): {
  combinedScore: number;
  isPass: boolean;
  hasKnockoutFailed: boolean;
  totalWeight: number;
} {
  if (!h2Blocks || h2Blocks.length === 0) {
    return { combinedScore: 0, isPass: true, hasKnockoutFailed: false, totalWeight: 0 };
  }

  let totalWeightedScore = 0;
  let totalWeight = 0;
  let hasFail = false;
  let hasKnockoutFailed = false;

  h2Blocks.forEach(h2 => {
    const weight = h2.weight || 0;
    totalWeight += weight;
    totalWeightedScore += (h2.score || 0) * (weight / 100);

    if (!h2.isPass) {
      hasFail = true;
      if (h2.isKnockout) {
        hasKnockoutFailed = true;
      }
    }
  });

  let finalScore = totalWeightedScore;
  if (totalWeight > 0 && totalWeight !== 100) {
    finalScore = (totalWeightedScore / totalWeight) * 100;
  }

  const roundedScore = Math.round(finalScore * 10) / 10;
  const isPass = !hasKnockoutFailed && !hasFail;

  return {
    combinedScore: roundedScore,
    isPass,
    hasKnockoutFailed,
    totalWeight
  };
}

/**
 * Pure Utility: Extracts intuitive parent group title from field's sectionH2 or blocks.
 */
export function extractParentGroupTitle(field: FormFieldISO, layoutBlocks?: ReportBlockConfig[]): string {
  if (field.sectionH2 && field.sectionH2.trim().length > 0) {
    return field.sectionH2.trim();
  }

  if (layoutBlocks && layoutBlocks.length > 0) {
    for (const block of layoutBlocks) {
      if (block.boundFieldIds?.includes(field.id)) {
        if (block.title && block.title.trim().length > 0) {
          return block.title.trim();
        }
      }
    }
  }

  return 'Nhóm câu hỏi';
}
