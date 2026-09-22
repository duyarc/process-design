import type {
  Submission,
  FormTemplateISO,
  FormFieldISO,
  ReportTemplateISO,
  ReportFieldRuleOverride,
  FieldEvaluationResult,
  ReportDataModel
} from '../types';
import { extractAllFormFields } from './tableFieldExtractor';
import { computeFieldScoreAndPass } from './reportScoring';

/**
 * Evaluates an individual form field's submitted value against specifications and scoring rules.
 * Applies report-level rule overrides when present, falling back to form template specs.
 */
export function evaluateFieldSpec(
  rawValue: any,
  formField: FormFieldISO,
  ruleOverride?: ReportFieldRuleOverride
): FieldEvaluationResult {
  const scoreEval = computeFieldScoreAndPass(rawValue, formField, ruleOverride);

  const result: FieldEvaluationResult = {
    fieldId: formField.id,
    label: formField.checkItem || formField.id,
    rawValue: rawValue,
    nominalSpec: formField.targetRange || undefined,
    minSpec: ruleOverride?.customMinSpec !== undefined ? ruleOverride.customMinSpec : formField.minSpec,
    maxSpec: ruleOverride?.customMaxSpec !== undefined ? ruleOverride.customMaxSpec : formField.maxSpec,
    unit: formField.unit,
    status: scoreEval.status,
    deviationText: scoreEval.deviationText,
    score: scoreEval.score,
    maxScore: scoreEval.maxScore,
    weight: scoreEval.weight,
    isKnockout: scoreEval.isKnockout
  };

  return result;
}

/**
 * Computes full Record Report Data Model for a given submission and report template.
 */
export function computeRecordReport(
  submission: Submission,
  formTemplate: FormTemplateISO,
  reportTemplate: ReportTemplateISO
): ReportDataModel {
  const evaluations: Record<string, FieldEvaluationResult> = {};

  // Build field lookup dictionary from form template (including table fields)
  const formFieldMap = new Map<string, FormFieldISO>();
  const allFields = extractAllFormFields(formTemplate.layoutBlocks || []);
  allFields.forEach(field => {
    formFieldMap.set(field.id, field);
  });

  // Collect all rule overrides from report template
  const ruleOverrides: Record<string, ReportFieldRuleOverride> = {};
  (reportTemplate.layoutBlocks || []).forEach(block => {
    if (block.ruleOverrides) {
      Object.assign(ruleOverrides, block.ruleOverrides);
    }
  });

  // Extract raw submission values from formData
  let totalEvaluated = 0;
  let passCount = 0;
  let failCount = 0;
  let knockoutFailed = false;
  let totalWeightedScore = 0;
  let totalWeight = 0;

  const extractValue = (fid: string): any => {
    if (!submission.formData) return undefined;
    if (Array.isArray(submission.formData)) {
      const snap = submission.formData.find((s: any) => s.id === fid);
      return snap ? snap.value : undefined;
    }
    return (submission.formData as any)[fid];
  };

  // Evaluate all fields present in either form template or bound in report blocks
  formFieldMap.forEach((field, fieldId) => {
    const rawVal = extractValue(fieldId);
    const override = ruleOverrides[fieldId];
    const evalResult = evaluateFieldSpec(rawVal, field, override);
    evaluations[fieldId] = evalResult;

    if (evalResult.status === 'PASS') {
      totalEvaluated++;
      passCount++;
    } else if (evalResult.status === 'FAIL') {
      totalEvaluated++;
      failCount++;
      if (evalResult.isKnockout) {
        knockoutFailed = true;
      }
    }

    if (evalResult.weight && evalResult.weight > 0 && evalResult.score !== undefined) {
      totalWeight += evalResult.weight;
      totalWeightedScore += evalResult.score * (evalResult.weight / 100);
    }
  });

  const scorePercentage = totalEvaluated > 0
    ? Math.round((passCount / totalEvaluated) * 100)
    : 100;

  const overallCombinedScore = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 1000) / 10
    : (totalEvaluated > 0 ? Math.round((passCount / totalEvaluated) * 100) / 10 : 10);

  const overallStatus: 'PASS' | 'FAIL' = (failCount > 0 || knockoutFailed) ? 'FAIL' : 'PASS';

  return {
    reportId: reportTemplate.reportId,
    reportTitle: reportTemplate.reportTitle,
    submissionId: submission.id,
    formId: (submission as any).formId || (submission as any).form_id || formTemplate.formId,
    operatorName: (submission as any).operatorId || (submission as any).operator_id || 'Operator',
    submittedAt: (submission as any).submittedAt || (submission as any).submitted_at || new Date().toISOString(),
    overallStatus,
    totalEvaluated,
    passCount,
    failCount,
    scorePercentage,
    overallCombinedScore,
    evaluations
  };
}
