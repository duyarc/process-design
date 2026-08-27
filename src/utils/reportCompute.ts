import type {
  Submission,
  FormTemplateISO,
  FormFieldISO,
  ReportTemplateISO,
  ReportFieldRuleOverride,
  FieldEvaluationResult,
  ReportDataModel
} from '../types';

/**
 * Evaluates an individual form field's submitted value against specifications.
 * Applies report-level rule overrides when present, falling back to form template specs.
 */
export function evaluateFieldSpec(
  rawValue: any,
  formField: FormFieldISO,
  ruleOverride?: ReportFieldRuleOverride
): FieldEvaluationResult {
  const result: FieldEvaluationResult = {
    fieldId: formField.id,
    label: formField.checkItem || formField.id,
    rawValue: rawValue,
    nominalSpec: formField.targetRange || undefined,
    minSpec: ruleOverride?.customMinSpec !== undefined ? ruleOverride.customMinSpec : formField.minSpec,
    maxSpec: ruleOverride?.customMaxSpec !== undefined ? ruleOverride.customMaxSpec : formField.maxSpec,
    unit: formField.unit,
    status: 'NA'
  };

  // If value is empty or not provided
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    result.status = 'NA';
    return result;
  }

  // 1. Numeric evaluation
  if (formField.type === 'number') {
    const num = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
    if (isNaN(num)) {
      result.status = 'FAIL';
      result.deviationText = 'Giá trị không phải số hợp lệ';
      return result;
    }

    const min = result.minSpec;
    const max = result.maxSpec;

    if (min !== undefined && max !== undefined) {
      if (num >= min && num <= max) {
        result.status = 'PASS';
      } else {
        result.status = 'FAIL';
        result.deviationText = num < min ? `Dưới giới hạn (${num} < ${min})` : `Vượt giới hạn (${num} > ${max})`;
      }
    } else if (min !== undefined) {
      if (num >= min) {
        result.status = 'PASS';
      } else {
        result.status = 'FAIL';
        result.deviationText = `Dưới giới hạn (${num} < ${min})`;
      }
    } else if (max !== undefined) {
      if (num <= max) {
        result.status = 'PASS';
      } else {
        result.status = 'FAIL';
        result.deviationText = `Vượt giới hạn (${num} > ${max})`;
      }
    } else {
      result.status = 'PASS'; // No specs defined
    }
    return result;
  }

  // 2. Radio / Options evaluation
  if (formField.type === 'radio') {
    if (ruleOverride?.customPassOptions && ruleOverride.customPassOptions.length > 0) {
      result.status = ruleOverride.customPassOptions.includes(String(rawValue)) ? 'PASS' : 'FAIL';
      if (result.status === 'FAIL') {
        result.deviationText = `Lựa chọn không đạt chuẩn: ${rawValue}`;
      }
      return result;
    }

    // Default to form field option configuration
    const matchingOpt = (formField.options || []).find(
      opt => opt.value === rawValue || opt.label === rawValue
    );
    if (matchingOpt) {
      result.status = matchingOpt.isPass === false ? 'FAIL' : 'PASS';
      if (result.status === 'FAIL') {
        result.deviationText = `Không đạt (${matchingOpt.label || rawValue})`;
      }
    } else {
      // If standard "PASS" / "Đạt" string
      const strVal = String(rawValue).toUpperCase();
      if (strVal === 'PASS' || strVal === 'ĐẠT' || strVal === 'OK') {
        result.status = 'PASS';
      } else if (strVal === 'FAIL' || strVal === 'KHÔNG ĐẠT' || strVal === 'NG') {
        result.status = 'FAIL';
        result.deviationText = `Không đạt (${rawValue})`;
      } else {
        result.status = 'PASS';
      }
    }
    return result;
  }

  // 3. Checkbox evaluation
  if (formField.type === 'checkbox') {
    if (Array.isArray(rawValue)) {
      result.status = rawValue.length > 0 ? 'PASS' : 'NA';
    } else {
      result.status = Boolean(rawValue) ? 'PASS' : 'NA';
    }
    return result;
  }

  // 4. Non-evaluated informational types (text, date, time, signature, photo)
  result.status = 'PASS';
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

  // Build field lookup dictionary from form template
  const formFieldMap = new Map<string, FormFieldISO>();
  (formTemplate.layoutBlocks || []).forEach(block => {
    (block.fields || []).forEach(field => {
      formFieldMap.set(field.id, field);
    });
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
    }
  });

  const scorePercentage = totalEvaluated > 0
    ? Math.round((passCount / totalEvaluated) * 100)
    : 100;

  const overallStatus: 'PASS' | 'FAIL' = failCount > 0 ? 'FAIL' : 'PASS';

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
    evaluations
  };
}
