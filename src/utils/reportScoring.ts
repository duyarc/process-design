import type {
  FormFieldISO,
  ReportFieldRuleOverride,
  FieldEvaluationResult,
  ReportBlockConfig,
  FormTemplateISO,
  ReportTemplateISO
} from '../types';
import { extractAllFormFields, groupFieldsByHierarchy, type FieldHierarchyGroup } from './tableFieldExtractor';
import { isOtherValue, formatOptionDisplay } from './formUtils';

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
    if (formField.type === 'text') {
      const allowEmpty = Boolean(ruleOverride?.textAllowEmpty);
      const emptyScore = ruleOverride?.textEmptyScore !== undefined ? ruleOverride.textEmptyScore : 0;
      const passScore = ruleOverride?.textPassScore !== undefined ? ruleOverride.textPassScore : 10;
      const maxScore = Math.max(passScore, emptyScore, 10);
      return {
        score: emptyScore,
        maxScore,
        status: allowEmpty ? 'PASS' : (ruleOverride?.textMinLength !== undefined ? 'FAIL' : 'NA'),
        deviationText: (!allowEmpty && ruleOverride?.textMinLength !== undefined) ? 'Chưa nhập dữ liệu' : undefined,
        weight,
        isKnockout
      };
    }
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
    // Default score gradient on 5-point scale if not explicitly overridden: [5, 2.5, 0] or [5, 4, 2.5, 1, 0]
    const defaultScores = scaleOpts.map((_, idx) => Math.max(0, Math.round(((1 - idx / Math.max(1, numOpts - 1)) * 5) * 2) / 2));
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
      return explicit !== undefined ? explicit : 5;
    }));

    const matchingOpt = options.find(opt =>
      opt.value === rawValue ||
      opt.label === rawValue ||
      ((opt.value === '__other__' || opt.label === '__other__' || (opt as any).isOther) && isOtherValue(rawValue))
    );
    if (!matchingOpt) {
      return { score: 0, maxScore: maxScore || 5, status: 'FAIL', deviationText: `Không có trong danh mục: ${rawValue}`, weight, isKnockout };
    }

    const score = ruleOverride?.optionScores?.[matchingOpt.value]
      ?? ruleOverride?.optionScores?.[matchingOpt.label]
      ?? (matchingOpt as any)?.score
      ?? 5;

    let isPass = true;
    if (ruleOverride?.customPassOptions && ruleOverride.customPassOptions.length > 0) {
      isPass = ruleOverride.customPassOptions.includes(matchingOpt.value) || ruleOverride.customPassOptions.includes(matchingOpt.label);
    } else {
      isPass = matchingOpt.isPass !== false;
    }

    return {
      score,
      maxScore: maxScore || 5,
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
      const optVal = typeof opt === 'string' ? opt : (opt.value || opt.label || '');
      const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value || '');
      const isOtherOpt = optVal === '__other__' || optLabel === '__other__' || (opt as any)?.isOther;
      const isChecked = rawArr.includes(optVal) || rawArr.includes(optLabel) || (isOtherOpt && rawArr.some(v => isOtherValue(v)));
      const optScore = ruleOverride?.optionScores?.[optVal] ?? ruleOverride?.optionScores?.[optLabel] ?? 2.5;
      totalMaxScore += optScore;

      if (isChecked) {
        earnedScore += optScore;
      }
      if (ruleOverride?.customPassOptions && ruleOverride.customPassOptions.length > 0) {
        if ((ruleOverride.customPassOptions.includes(optVal) || ruleOverride.customPassOptions.includes(optLabel)) && !isChecked) {
          isPass = false;
        }
      }
    });

    if (totalMaxScore === 0) totalMaxScore = 5;
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

  // 4. Number / Spec Multi-Range
  if (formField.type === 'number') {
    const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
    if (isNaN(num)) {
      return { score: 0, maxScore: 5, status: 'FAIL', deviationText: 'Giá trị không phải số hợp lệ', weight, isKnockout };
    }

    // A. Multi-Range Evaluation
    if (ruleOverride?.numberRanges && ruleOverride.numberRanges.length > 0) {
      const maxScore = Math.max(ruleOverride.numberDefaultScore ?? 0, ...ruleOverride.numberRanges.map(r => r.score), 5);
      const matchedRange = ruleOverride.numberRanges.find(r => {
        if (r.min !== undefined && r.max !== undefined) return num >= r.min && num <= r.max;
        if (r.min !== undefined) return num >= r.min;
        if (r.max !== undefined) return num <= r.max;
        return false;
      });

      if (matchedRange) {
        return {
          score: matchedRange.score,
          maxScore,
          status: matchedRange.isPass ? 'PASS' : 'FAIL',
          deviationText: !matchedRange.isPass ? 'Không đạt tiêu chuẩn' : undefined,
          weight,
          isKnockout
        };
      }

      const defPass = ruleOverride.numberDefaultPass ?? false;
      const defScore = ruleOverride.numberDefaultScore ?? 0;
      return {
        score: defScore,
        maxScore,
        status: defPass ? 'PASS' : 'FAIL',
        deviationText: !defPass ? 'Out of range' : undefined,
        weight,
        isKnockout
      };
    }

    // B. Legacy Min/Max Spec Fallback
    const targetScore = ruleOverride?.fixedScore !== undefined ? ruleOverride.fixedScore : 5;
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

  // 5. Text Completeness
  if (formField.type === 'text') {
    const str = String(rawValue).trim();
    const minLen = ruleOverride?.textMinLength !== undefined ? ruleOverride.textMinLength : 10;
    const passScore = ruleOverride?.textPassScore !== undefined ? ruleOverride.textPassScore : 5;
    const shortScore = ruleOverride?.textShortScore !== undefined ? ruleOverride.textShortScore : 2.5;
    const shortPass = Boolean(ruleOverride?.textShortPass);
    const allowEmpty = Boolean(ruleOverride?.textAllowEmpty);
    const emptyScore = ruleOverride?.textEmptyScore !== undefined ? ruleOverride.textEmptyScore : 0;
    const maxScore = Math.max(passScore, shortScore, emptyScore, 5);

    if (str.length === 0) {
      return {
        score: emptyScore,
        maxScore,
        status: allowEmpty ? 'PASS' : 'FAIL',
        deviationText: !allowEmpty ? 'Chưa nhập dữ liệu' : undefined,
        weight,
        isKnockout
      };
    } else if (str.length >= minLen) {
      return {
        score: passScore,
        maxScore,
        status: 'PASS',
        weight,
        isKnockout
      };
    } else {
      return {
        score: shortScore,
        maxScore,
        status: shortPass ? 'PASS' : 'FAIL',
        deviationText: !shortPass ? `Chưa đủ độ dài (${str.length} < ${minLen})` : undefined,
        weight,
        isKnockout
      };
    }
  }

  // 6. Default informational types (date, time, sign, etc.)
  return {
    score: 0,
    maxScore: 0,
    status: 'PASS',
    weight,
    isKnockout
  };
}

/**
 * Distributes an integer total (e.g. 100 or remaining %) across `count` items using Largest Remainder method.
 */
export function distributeIntegerTotal(total: number, count: number): number[] {
  if (count <= 0) return [];
  const safeTotal = Math.max(0, Math.round(total));
  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal - base * count;
  return Array.from({ length: count }, (_, idx) => (idx < remainder ? base + 1 : base));
}

/**
 * Smart Zero-Sum Auto-Balance Weight Resolver:
 * - Items with `isWeightManual === true` (or legacy `isWeightManual === undefined && weight > 0`) are locked at their stored `weight`.
 * - Unlocked (`AUTO`) items share `Math.max(0, 100 - lockedSum)` equally via `distributeIntegerTotal`.
 */
export function resolveSmartGroupWeights(
  items: { weight?: number; isWeightManual?: boolean }[]
): { weights: number[]; isManualFlags: boolean[] } {
  if (!items || items.length === 0) {
    return { weights: [], isManualFlags: [] };
  }

  const isManualFlags = items.map(it =>
    it.isWeightManual === true || (it.isWeightManual === undefined && (it.weight || 0) > 0)
  );

  const lockedSum = items.reduce(
    (sum, it, idx) => (isManualFlags[idx] ? sum + Math.max(0, Number(it.weight) || 0) : sum),
    0
  );
  const autoCount = isManualFlags.filter(flag => !flag).length;
  const remaining = Math.max(0, 100 - lockedSum);
  const autoPool = distributeIntegerTotal(remaining, autoCount);

  let autoPtr = 0;
  const weights = items.map((it, idx) =>
    isManualFlags[idx] ? Math.max(0, Math.round(Number(it.weight) || 0)) : autoPool[autoPtr++]
  );

  return { weights, isManualFlags };
}

/**
 * Pure Utility: Computes Combined Score for a Sub-section H2 / Table from its child fields.
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
  effectiveWeights: Record<string, number>;
  manualFlags: Record<string, boolean>;
} {
  if (!childFields || childFields.length === 0) {
    return {
      combinedScore: 0,
      isPass: true,
      hasKnockoutFailed: false,
      totalWeight: 0,
      effectiveWeights: {},
      manualFlags: {}
    };
  }

  const { weights, isManualFlags } = resolveSmartGroupWeights(
    childFields.map(f => ({
      weight: ruleOverrides?.[f.id]?.weight,
      isWeightManual: ruleOverrides?.[f.id]?.isWeightManual
    }))
  );

  let totalWeightedScore = 0;
  let totalWeight = 0;
  let hasFail = false;
  let hasKnockoutFailed = false;
  const effectiveWeights: Record<string, number> = {};
  const manualFlags: Record<string, boolean> = {};

  childFields.forEach((field, idx) => {
    const override = ruleOverrides?.[field.id];
    const weight = weights[idx] ?? 0;
    effectiveWeights[field.id] = weight;
    manualFlags[field.id] = isManualFlags[idx] ?? false;

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

  // If weights don't sum to 100% (e.g. all items manually set to custom total), normalize proportionally
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
    totalWeight,
    effectiveWeights,
    manualFlags
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
 * Pure Utility: Extracts immediate parent Element/Table title (Level 3) for a Field (Level 4).
 * Hierarchy chain: Field (Level 4) -> Element/Table (Level 3, locationCode) -> H2 (Level 2, sectionH2) -> H1 (Level 1, sectionH1)
 */
export function extractParentGroupTitle(field: FormFieldISO, layoutBlocks?: ReportBlockConfig[]): string {
  // 1. Check if a TABLE or INFO_GRID block in layoutBlocks explicitly binds this field
  if (layoutBlocks && layoutBlocks.length > 0) {
    for (const block of layoutBlocks) {
      if ((block.type === 'TABLE' || block.type === 'INFO_GRID') && block.boundFieldIds?.includes(field.id)) {
        if (block.title && block.title.trim().length > 0) {
          return block.title.trim();
        }
      }
    }
  }

  // 2. Use the field's Level-3 Element / Table title (locationCode)
  if (field.locationCode && field.locationCode.trim().length > 0) {
    return field.locationCode.split(' › ')[0].trim();
  }

  // 3. Fallback to H2 or H1 only if the field does not belong to any Table / Element
  if (field.sectionH2 && field.sectionH2.trim().length > 0) {
    return field.sectionH2.trim();
  }
  if (field.sectionH1 && field.sectionH1.trim().length > 0) {
    return field.sectionH1.trim();
  }

  return 'Bảng đánh giá';
}

/**
 * Pure Utility: Summarizes child H2 groups (or direct Element groups if H1 has no H2) for a Section H1 block.
 * Strictly follows the 4-tier roll-up: Field (L4) -> Table/Element (L3) -> H2 (L2) -> H1 (L1).
 */
export function summarizeH1ChildGroups(
  h1Title: string,
  hierarchyGroups: FieldHierarchyGroup[],
  layoutBlocks: ReportBlockConfig[],
  sampleSubmissionData?: any,
  templateRuleOverrides?: Record<string, ReportFieldRuleOverride>
): {
  childH2Summary: {
    h2Title: string;
    score: number;
    isPass: boolean;
    weight: number;
    isWeightManual?: boolean;
    isElement?: boolean;
    blockId?: string;
  }[];
  h1CombinedScore: { combinedScore: number; isPass: boolean; hasKnockoutFailed: boolean; totalWeight: number };
} {
  const cleanH1 = (h1Title || '').trim().toLowerCase();
  const matchingH1Group = hierarchyGroups.find(g => g.h1.trim().toLowerCase() === cleanH1);
  if (!matchingH1Group) {
    return { childH2Summary: [], h1CombinedScore: { combinedScore: 0, isPass: true, hasKnockoutFailed: false, totalWeight: 0 } };
  }

  // Case 1: H1 has real H2 sub-sections (titleFormat === 'H2')
  if (matchingH1Group.h2Groups.length > 0) {
    const rawItems = matchingH1Group.h2Groups.map(h2Group => {
      const cleanTitle = h2Group.h2.trim().toLowerCase();
      const h2SectionBlock = layoutBlocks.find(b =>
        b.type === 'SECTION_LABEL' &&
        b.titleFormat === 'H2' &&
        (b.title || '').trim().toLowerCase() === cleanTitle
      );

      const { h2CombinedScore } = summarizeH2ChildElements(
        h2Group.h2,
        hierarchyGroups,
        layoutBlocks,
        sampleSubmissionData,
        templateRuleOverrides
      );

      return {
        h2Title: h2Group.h2,
        score: h2CombinedScore.combinedScore,
        isPass: h2CombinedScore.isPass,
        storedWeight: h2SectionBlock?.weight,
        isWeightManual: h2SectionBlock?.isWeightManual,
        isKnockout: h2SectionBlock?.isKnockout ?? false,
        isElement: false,
        blockId: h2SectionBlock?.id
      };
    });

    const { weights, isManualFlags } = resolveSmartGroupWeights(
      rawItems.map(r => ({ weight: r.storedWeight, isWeightManual: r.isWeightManual }))
    );

    const childH2Summary = rawItems.map((r, idx) => ({
      h2Title: r.h2Title,
      score: r.score,
      isPass: r.isPass,
      weight: weights[idx] ?? 0,
      isWeightManual: isManualFlags[idx] ?? false,
      isKnockout: r.isKnockout,
      isElement: r.isElement,
      blockId: r.blockId
    }));

    const h1CombinedScore = computeH1CombinedScore(childH2Summary);
    return { childH2Summary, h1CombinedScore };
  }

  // Case 2: H1 has no H2 sub-sections -> Skip-Level roll up directly from child Element / Table blocks
  if (matchingH1Group.directElements && matchingH1Group.directElements.length > 0) {
    const rawItems = matchingH1Group.directElements.map(elGroup => {
      const cleanTitle = elGroup.elementTitle.trim().toLowerCase();
      const matchingBlock = layoutBlocks.find(b =>
        b.type === 'TABLE' && (
          (b.title || '').trim().toLowerCase() === cleanTitle ||
          b.boundFieldIds?.some(id => elGroup.fields.some(f => f.id === id))
        )
      );

      const evalMap: Record<string, FieldEvaluationResult> = {};
      elGroup.fields.forEach(f => {
        const subVal = sampleSubmissionData;
        const rawVal = Array.isArray(subVal)
          ? subVal.find((s: any) => s.id === f.id || s.fieldId === f.id)?.value
          : (subVal ? (subVal as any)[f.id] : undefined);
        const res = computeFieldScoreAndPass(rawVal, f, matchingBlock?.ruleOverrides?.[f.id] || templateRuleOverrides?.[f.id]);
        evalMap[f.id] = {
          fieldId: f.id,
          label: f.checkItem || f.id,
          rawValue: rawVal,
          ...res
        };
      });

      const elOverrides = matchingBlock?.ruleOverrides || templateRuleOverrides;
      const elRes = computeH2CombinedScore(elGroup.fields, evalMap, elOverrides);
      return {
        h2Title: elGroup.elementTitle,
        score: elRes.combinedScore,
        isPass: elRes.isPass,
        storedWeight: matchingBlock?.weight,
        isWeightManual: matchingBlock?.isWeightManual,
        isKnockout: matchingBlock?.isKnockout ?? false,
        isElement: true,
        blockId: matchingBlock?.id
      };
    });

    const { weights, isManualFlags } = resolveSmartGroupWeights(
      rawItems.map(r => ({ weight: r.storedWeight, isWeightManual: r.isWeightManual }))
    );

    const childH2Summary = rawItems.map((r, idx) => ({
      h2Title: r.h2Title,
      score: r.score,
      isPass: r.isPass,
      weight: weights[idx] ?? 0,
      isWeightManual: isManualFlags[idx] ?? false,
      isKnockout: r.isKnockout,
      isElement: r.isElement,
      blockId: r.blockId
    }));

    const h1CombinedScore = computeH1CombinedScore(childH2Summary);
    return { childH2Summary, h1CombinedScore };
  }

  return { childH2Summary: [], h1CombinedScore: { combinedScore: 0, isPass: true, hasKnockoutFailed: false, totalWeight: 0 } };
}

/**
 * Pure Utility: Summarizes child Element / Table blocks under a Section H2 header.
 */
export function summarizeH2ChildElements(
  h2Title: string,
  hierarchyGroups: FieldHierarchyGroup[],
  layoutBlocks: ReportBlockConfig[],
  sampleSubmissionData?: any,
  templateRuleOverrides?: Record<string, ReportFieldRuleOverride>
): {
  childElementsSummary: {
    elementTitle: string;
    fieldsCount: number;
    score: number;
    isPass: boolean;
    weight: number;
    isWeightManual?: boolean;
    blockId?: string;
  }[];
  h2CombinedScore: { combinedScore: number; isPass: boolean; hasKnockoutFailed: boolean; totalWeight: number };
} {
  const cleanH2 = (h2Title || '').trim().toLowerCase();
  let targetH2Group: FieldHierarchyGroup['h2Groups'][number] | undefined;

  for (const h1 of hierarchyGroups) {
    const found = h1.h2Groups.find(g => g.h2.trim().toLowerCase() === cleanH2);
    if (found) {
      targetH2Group = found;
      break;
    }
  }

  if (!targetH2Group || !targetH2Group.elements || targetH2Group.elements.length === 0) {
    return {
      childElementsSummary: [],
      h2CombinedScore: { combinedScore: 0, isPass: true, hasKnockoutFailed: false, totalWeight: 0 }
    };
  }

  const rawItems = targetH2Group.elements.map(elGroup => {
    const cleanElTitle = elGroup.elementTitle.trim().toLowerCase();
    const matchingBlock = layoutBlocks.find(b =>
      b.type === 'TABLE' && (
        (b.title || '').trim().toLowerCase() === cleanElTitle ||
        b.boundFieldIds?.some(id => elGroup.fields.some(f => f.id === id))
      )
    );

    const evalMap: Record<string, FieldEvaluationResult> = {};
    elGroup.fields.forEach(f => {
      const subVal = sampleSubmissionData;
      const rawVal = Array.isArray(subVal)
        ? subVal.find((s: any) => s.id === f.id || s.fieldId === f.id)?.value
        : (subVal ? (subVal as any)[f.id] : undefined);
      const res = computeFieldScoreAndPass(rawVal, f, matchingBlock?.ruleOverrides?.[f.id] || templateRuleOverrides?.[f.id]);
      evalMap[f.id] = {
        fieldId: f.id,
        label: f.checkItem || f.id,
        rawValue: rawVal,
        ...res
      };
    });

    const elOverrides = matchingBlock?.ruleOverrides || templateRuleOverrides;
    const elRes = computeH2CombinedScore(elGroup.fields, evalMap, elOverrides);
    return {
      elementTitle: elGroup.elementTitle,
      fieldsCount: elGroup.fields.length,
      score: elRes.combinedScore,
      isPass: elRes.isPass,
      storedWeight: matchingBlock?.weight,
      isWeightManual: matchingBlock?.isWeightManual,
      isKnockout: matchingBlock?.isKnockout ?? false,
      blockId: matchingBlock?.id
    };
  });

  const { weights, isManualFlags } = resolveSmartGroupWeights(
    rawItems.map(r => ({ weight: r.storedWeight, isWeightManual: r.isWeightManual }))
  );

  const childElementsSummary = rawItems.map((r, idx) => ({
    elementTitle: r.elementTitle,
    fieldsCount: r.fieldsCount,
    score: r.score,
    isPass: r.isPass,
    weight: weights[idx] ?? 0,
    isWeightManual: isManualFlags[idx] ?? false,
    isKnockout: r.isKnockout,
    blockId: r.blockId
  }));

  const h2CombinedScore = computeH1CombinedScore(childElementsSummary);
  return { childElementsSummary, h2CombinedScore };
}

/**
 * Resolves the top-level sibling groups of a Form with Skip-Level / Tier Promotion support:
 * - Scenario A (Standard H1s): When the form has multiple H1 groups (or a real H1), resolves H1 weights via `resolveSmartGroupWeights`.
 * - Scenario B (Missing H1: `Form -> H2`): When the form has only the default virtual H1 bucket (`Thông tin chung`) containing H2s,
 *   promotes the H2 sub-sections to be the top-level sibling group (`tierLabel: 'H2'`).
 * - Scenario C (Missing H1 & H2: `Form -> Bảng`): Promotes direct Element/Table blocks to top-level (`tierLabel: 'Bảng'`).
 */
export function resolveFormTopLevelGroups(
  hierarchyGroups: FieldHierarchyGroup[],
  layoutBlocks: ReportBlockConfig[],
  sampleSubmissionData?: any,
  templateRuleOverrides?: Record<string, ReportFieldRuleOverride>
): {
  tierLabel: 'H1' | 'H2' | 'Bảng';
  items: {
    fieldId: string;
    title: string;
    score: number;
    isPass: boolean;
    weight: number;
    isWeightManual: boolean;
    blockId?: string;
  }[];
  formCombinedScore: { combinedScore: number; isPass: boolean; hasKnockoutFailed: boolean; totalWeight: number };
} {
  if (!hierarchyGroups || hierarchyGroups.length === 0) {
    return {
      tierLabel: 'H1',
      items: [],
      formCombinedScore: { combinedScore: 0, isPass: true, hasKnockoutFailed: false, totalWeight: 0 }
    };
  }

  const hasExplicitH1Block = layoutBlocks.some(
    b => b.type === 'SECTION_LABEL' && (b.titleFormat === 'H1' || !b.titleFormat) && b.title.trim().toLowerCase() !== 'thông tin chung'
  );
  const isSingleVirtualH1 =
    hierarchyGroups.length === 1 &&
    hierarchyGroups[0].h1.trim().toLowerCase() === 'thông tin chung' &&
    !hasExplicitH1Block;

  // Scenario B (`Form -> H2`) or Scenario C (`Form -> Bảng`) when H1 is omitted
  if (isSingleVirtualH1) {
    const virtualH1 = hierarchyGroups[0];
    const { childH2Summary, h1CombinedScore } = summarizeH1ChildGroups(
      virtualH1.h1,
      hierarchyGroups,
      layoutBlocks,
      sampleSubmissionData,
      templateRuleOverrides
    );
    const tierLabel: 'H2' | 'Bảng' = virtualH1.h2Groups.length > 0 ? 'H2' : 'Bảng';
    return {
      tierLabel,
      items: childH2Summary.map(c => ({
        fieldId: c.blockId || c.h2Title,
        title: c.h2Title,
        score: c.score,
        isPass: c.isPass,
        weight: c.weight,
        isWeightManual: Boolean(c.isWeightManual),
        blockId: c.blockId
      })),
      formCombinedScore: h1CombinedScore
    };
  }

  // Scenario A: Standard H1 pillars at the top of the Form
  const rawH1s = hierarchyGroups.map(g => {
    const cleanTitle = g.h1.trim().toLowerCase();
    const h1Block = layoutBlocks.find(
      b =>
        b.type === 'SECTION_LABEL' &&
        (b.titleFormat === 'H1' || !b.titleFormat) &&
        (b.title || '').trim().toLowerCase() === cleanTitle
    );
    const { h1CombinedScore } = summarizeH1ChildGroups(
      g.h1,
      hierarchyGroups,
      layoutBlocks,
      sampleSubmissionData,
      templateRuleOverrides
    );
    return {
      fieldId: h1Block?.id || g.h1,
      title: g.h1,
      score: h1CombinedScore.combinedScore,
      isPass: h1CombinedScore.isPass,
      storedWeight: h1Block?.weight,
      isWeightManual: h1Block?.isWeightManual,
      isKnockout: h1Block?.isKnockout ?? false,
      blockId: h1Block?.id
    };
  });

  const { weights, isManualFlags } = resolveSmartGroupWeights(
    rawH1s.map(r => ({ weight: r.storedWeight, isWeightManual: r.isWeightManual }))
  );

  const items = rawH1s.map((r, idx) => ({
    fieldId: r.fieldId,
    title: r.title,
    score: r.score,
    isPass: r.isPass,
    weight: weights[idx] ?? 0,
    isWeightManual: isManualFlags[idx] ?? false,
    isKnockout: r.isKnockout,
    blockId: r.blockId
  }));

  const formCombinedScore = computeH1CombinedScore(items);
  return {
    tierLabel: 'H1',
    items,
    formCombinedScore
  };
}

export interface WeightBadgeSpec {
  weight: number;
  parentLabel: 'Form' | 'H1' | 'H2' | '⊞';
  isWeightManual: boolean;
  isKnockout: boolean;
}

export interface AnswerKeyItemSpec {
  label: string;
  scoreText: string;
  isPass: boolean;
  isRequired?: boolean;
}

export interface FieldBlueprintSpec {
  fieldId: string;
  weight: number;
  parentLabel: '⊞';
  isWeightManual: boolean;
  isKnockout: boolean;
  fieldType: string;
  ruleSummary?: string;
  answerKeyItems: AnswerKeyItemSpec[];
}

export interface FormScoringBlueprintMap {
  topLevelSummary: Array<{
    title: string;
    weight: number;
    parentLabel: 'Form';
    isWeightManual: boolean;
    isKnockout: boolean;
  }>;
  h1Map: Record<string, WeightBadgeSpec>;
  h2Map: Record<string, WeightBadgeSpec>;
  elementMap: Record<string, WeightBadgeSpec>;
  fieldMap: Record<string, FieldBlueprintSpec>;
}

function buildFieldAnswerKeySpec(
  field: FormFieldISO,
  override?: ReportFieldRuleOverride
): { ruleSummary?: string; answerKeyItems: AnswerKeyItemSpec[] } {
  const fType = field.type || 'text';

  if (fType === 'likert_scale' || fType === 'rating') {
    const scaleCount = field.ratingScale === 3 ? 3 : (field.scaleOptions && field.scaleOptions.length > 0 ? field.scaleOptions.length : 5);
    const minPassLevel = override?.customMinSpec !== undefined ? override.customMinSpec : Math.ceil(scaleCount / 2);
    const items: AnswerKeyItemSpec[] = [];
    for (let lvl = 1; lvl <= scaleCount; lvl++) {
      const score = override?.optionScores?.[String(lvl)] !== undefined ? override.optionScores[String(lvl)] : lvl;
      const isPass = lvl >= minPassLevel;
      const optLabel = field.scaleOptions?.[lvl - 1] ? `${lvl} (${field.scaleOptions[lvl - 1]})` : `${lvl}`;
      items.push({
        label: optLabel,
        scoreText: `${score}đ`,
        isPass
      });
    }
    return {
      ruleSummary: `Đạt ≥ Mức ${minPassLevel}`,
      answerKeyItems: items
    };
  }

  if (fType === 'radio' || fType === 'select') {
    const rawOpts = field.options && field.options.length > 0
      ? field.options
      : [{ label: 'Đạt', value: 'PASS' }, { label: 'Không Đạt', value: 'FAIL' }];
    const allValues = rawOpts.map((o: any) => typeof o === 'string' ? o : (o.value || o.label));
    const defaultPassSet = allValues.filter((_, idx) => idx < Math.ceil(allValues.length / 2));
    const passOptions = override?.customPassOptions || defaultPassSet;

    const items: AnswerKeyItemSpec[] = rawOpts.map((o: any) => {
      const val = typeof o === 'string' ? o : (o.value || o.label);
      const rawLabel = typeof o === 'string' ? o : (o.label || o.value);
      const label = formatOptionDisplay(rawLabel);
      const isPass = passOptions.includes(val);
      const score = override?.optionScores?.[val] !== undefined
        ? override.optionScores[val]
        : (isPass ? 5 : 1);
      return {
        label,
        scoreText: `${score}đ`,
        isPass
      };
    });
    return { answerKeyItems: items };
  }

  if (fType === 'checkbox') {
    const minChecked = override?.customMinSpec !== undefined ? override.customMinSpec : 1;
    const rawOpts = field.options || [];
    const reqSet = override?.customPassOptions || [];

    const items: AnswerKeyItemSpec[] = rawOpts.map((o: any) => {
      const val = typeof o === 'string' ? o : (o.value || o.label);
      const rawLabel = typeof o === 'string' ? o : (o.label || o.value);
      const label = formatOptionDisplay(rawLabel);
      const isRequired = reqSet.includes(val);
      const score = override?.optionScores?.[val] !== undefined ? override.optionScores[val] : 1;
      const prefix = score >= 0 ? '+' : '';
      return {
        label,
        scoreText: `${prefix}${score}đ`,
        isPass: true,
        isRequired
      };
    });
    return {
      ruleSummary: `Cộng dồn · Đạt ≥ ${minChecked} mục`,
      answerKeyItems: items
    };
  }

  if (fType === 'number') {
    const ranges = override?.numberRanges && override.numberRanges.length > 0
      ? override.numberRanges
      : [{
          id: 'r_default',
          min: override?.customMinSpec !== undefined ? override.customMinSpec : field.minSpec,
          max: override?.customMaxSpec !== undefined ? override.customMaxSpec : field.maxSpec,
          isPass: true,
          score: override?.fixedScore !== undefined ? override.fixedScore : 5
        }];
    const items: AnswerKeyItemSpec[] = ranges.map(r => {
      const minText = r.min !== undefined && r.min !== null ? String(r.min) : '-∞';
      const maxText = r.max !== undefined && r.max !== null ? String(r.max) : '+∞';
      const rangeLabel = (r.min === undefined || r.min === null) && (r.max === undefined || r.max === null)
        ? 'Mọi giá trị số'
        : `[${minText} .. ${maxText}]`;
      return {
        label: rangeLabel,
        scoreText: `${r.score}đ`,
        isPass: r.isPass
      };
    });
    return { answerKeyItems: items };
  }

  // text / date / time / photo / signature
  const fixedScore = override?.textPassScore !== undefined
    ? override.textPassScore
    : (override?.fixedScore !== undefined ? override.fixedScore : 5);
  const kw = override?.customTargetRange?.trim();
  const minLen = override?.textMinLength;
  return {
    answerKeyItems: [{
      label: kw
        ? `Chứa "${kw}"`
        : minLen
        ? `Tối thiểu ${minLen} ký tự`
        : 'Có nhập nội dung hợp lệ',
      scoreText: `${fixedScore}đ`,
      isPass: true
    }]
  };
}

/**
 * Pure Utility: Builds the complete 4-tier Parent-Relative Weight Map (`[X% of Form/H1/H2/Bảng]`)
 * and Inline Answer-Key specification for printing `tab Form` of ReportBuilder.
 */
export function buildFormScoringBlueprintMap(
  formTemplate: FormTemplateISO,
  reportTemplate: ReportTemplateISO
): FormScoringBlueprintMap {
  const allFormFields = extractAllFormFields(formTemplate?.layoutBlocks || []);
  const hierarchyGroups = groupFieldsByHierarchy(allFormFields);
  const layoutBlocks = reportTemplate?.layoutBlocks || [];
  const templateOverrides = reportTemplate?.ruleOverrides || {};

  const h1Map: Record<string, WeightBadgeSpec> = {};
  const h2Map: Record<string, WeightBadgeSpec> = {};
  const elementMap: Record<string, WeightBadgeSpec> = {};
  const fieldMap: Record<string, FieldBlueprintSpec> = {};

  const topLevelInfo = resolveFormTopLevelGroups(
    hierarchyGroups,
    layoutBlocks,
    undefined,
    templateOverrides
  );

  const topLevelSummary = topLevelInfo.items.map(item => {
    const cleanTitle = item.title.trim().toLowerCase();
    const matchedBlock = layoutBlocks.find(b => (b.title || '').trim().toLowerCase() === cleanTitle);
    return {
      title: item.title,
      weight: item.weight,
      parentLabel: 'Form' as const,
      isWeightManual: Boolean(item.isWeightManual),
      isKnockout: Boolean(matchedBlock?.isKnockout)
    };
  });

  const populateElementFields = (elTitle: string, fields: FormFieldISO[]) => {
    const cleanEl = elTitle.trim().toLowerCase();
    const matchingBlock = layoutBlocks.find(b =>
      (b.type === 'TABLE' || b.type === 'INFO_GRID') && (
        (b.title || '').trim().toLowerCase() === cleanEl ||
        b.boundFieldIds?.some(id => fields.some(f => f.id === id))
      )
    );
    const blockOverrides = matchingBlock?.ruleOverrides || {};

    const rawFieldWeights = fields.map(f => {
      const ov = blockOverrides[f.id] || templateOverrides[f.id];
      return {
        weight: ov?.weight,
        isWeightManual: ov?.isWeightManual
      };
    });
    const { weights, isManualFlags } = resolveSmartGroupWeights(rawFieldWeights);

    fields.forEach((f, idx) => {
      const ov = blockOverrides[f.id] || templateOverrides[f.id];
      const { ruleSummary, answerKeyItems } = buildFieldAnswerKeySpec(f, ov);
      fieldMap[f.id] = {
        fieldId: f.id,
        weight: weights[idx] ?? 0,
        parentLabel: '⊞',
        isWeightManual: isManualFlags[idx] ?? false,
        isKnockout: Boolean(ov?.isKnockout),
        fieldType: f.type || 'text',
        ruleSummary,
        answerKeyItems
      };
    });
  };

  hierarchyGroups.forEach((h1Group, h1Idx) => {
    const cleanH1 = h1Group.h1.trim().toLowerCase();
    if (topLevelInfo.tierLabel === 'H1') {
      const topItem = topLevelInfo.items[h1Idx];
      const h1Block = layoutBlocks.find(
        b => b.type === 'SECTION_LABEL' && (b.titleFormat === 'H1' || !b.titleFormat) && (b.title || '').trim().toLowerCase() === cleanH1
      );
      h1Map[cleanH1] = {
        weight: topItem?.weight ?? 0,
        parentLabel: 'Form',
        isWeightManual: Boolean(topItem?.isWeightManual),
        isKnockout: Boolean(h1Block?.isKnockout)
      };
    }

    const { childH2Summary } = summarizeH1ChildGroups(
      h1Group.h1,
      hierarchyGroups,
      layoutBlocks,
      undefined,
      templateOverrides
    );

    const h2ParentLabel: 'Form' | 'H1' = topLevelInfo.tierLabel === 'H1' ? 'H1' : 'Form';

    childH2Summary.forEach(child => {
      const cleanChild = child.h2Title.trim().toLowerCase();
      const childBlock = layoutBlocks.find(b => (b.title || '').trim().toLowerCase() === cleanChild);
      if (child.isElement) {
        elementMap[cleanChild] = {
          weight: child.weight,
          parentLabel: h2ParentLabel,
          isWeightManual: Boolean(child.isWeightManual),
          isKnockout: Boolean(childBlock?.isKnockout)
        };
      } else {
        h2Map[cleanChild] = {
          weight: child.weight,
          parentLabel: h2ParentLabel,
          isWeightManual: Boolean(child.isWeightManual),
          isKnockout: Boolean(childBlock?.isKnockout)
        };
      }
    });

    h1Group.h2Groups.forEach(h2Group => {
      const { childElementsSummary } = summarizeH2ChildElements(
        h2Group.h2,
        hierarchyGroups,
        layoutBlocks,
        undefined,
        templateOverrides
      );
      childElementsSummary.forEach(elSum => {
        const cleanElTitle = elSum.elementTitle.trim().toLowerCase();
        const elBlock = layoutBlocks.find(b => (b.title || '').trim().toLowerCase() === cleanElTitle);
        elementMap[cleanElTitle] = {
          weight: elSum.weight,
          parentLabel: 'H2',
          isWeightManual: Boolean(elSum.isWeightManual),
          isKnockout: Boolean(elBlock?.isKnockout)
        };
      });

      h2Group.elements.forEach(el => {
        populateElementFields(el.elementTitle, el.fields);
      });
    });

    h1Group.directElements.forEach(el => {
      populateElementFields(el.elementTitle, el.fields);
    });
  });

  return {
    topLevelSummary,
    h1Map,
    h2Map,
    elementMap,
    fieldMap
  };
}




