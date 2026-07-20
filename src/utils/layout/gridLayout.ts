import type { ProcessStep } from '../../types';
import type { LayoutNode, CalculatedFlow, LayoutConstants } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Module 1 — Grid Layout
//
// Responsibility: Assign each ProcessStep to a (row, col) cell in the grid.
// Wraps to a new row when a row exceeds COLS_PER_ROW columns.
// Also synthesises TextAnnotation nodes for page labels and the initial
// set of sequence flows (before link-event synthesis).
// ─────────────────────────────────────────────────────────────────────────────

const COLS_PER_ROW = 6;

export interface GridLayoutResult {
  /** All layout nodes (steps + text annotations, NO link events yet) */
  layoutNodes: LayoutNode[];
  /** Row index for each step, parallel to `steps[]` */
  stepRows: number[];
  /** Column index for each step, parallel to `steps[]` */
  stepCols: number[];
  /** Total number of page rows */
  numRows: number;
  /** Pre-link-event sequence flows derived directly from step definitions */
  originalFlows: CalculatedFlow[];
}

/**
 * Compute the grid (row, col) assignment for every ProcessStep and derive
 * the initial set of sequence flows before link-event synthesis.
 */
export function computeGridLayout(
  steps: ProcessStep[],
  uniqueRoles: string[],
  _constants?: Partial<LayoutConstants>
): GridLayoutResult {
  const stepRows: number[] = [];
  const stepCols: number[] = [];
  const lastColInRow: { [row: number]: { [role: string]: number } } = {};

  steps.forEach((step, idx) => {
    const role = step.role || 'Operator';

    if (idx === 0) {
      stepRows.push(0);
      stepCols.push(0);
      lastColInRow[0] = { [role]: 0 };
      return;
    }

    const prevRow = stepRows[idx - 1];
    const prevRole = steps[idx - 1].role || 'Operator';
    const prevCol = stepCols[idx - 1];

    // Force horizontal increment when either adjacent step is a gateway
    // (gateways always occupy their own column to keep branching readable)
    let forceIncrement = false;
    const prevStep = steps[idx - 1];
    if (
      step.bpmnShape === 'exclusive-gateway' ||
      prevStep.bpmnShape === 'exclusive-gateway'
    ) {
      forceIncrement = true;
    }

    let col: number;
    if (role === prevRole || forceIncrement) {
      const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
      col = Math.max(prevCol + 1, lastColForRole + 1);
    } else {
      const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
      col = Math.max(prevCol, lastColForRole + 1);
    }

    if (col >= COLS_PER_ROW) {
      // Wrap to a new page row; column 0 is reserved for the Catch Link Event
      const newRow = prevRow + 1;
      stepRows.push(newRow);
      stepCols.push(1);
      if (!lastColInRow[newRow]) lastColInRow[newRow] = {};
      lastColInRow[newRow][role] = 1;
    } else {
      stepRows.push(prevRow);
      stepCols.push(col);
      if (!lastColInRow[prevRow]) lastColInRow[prevRow] = {};
      lastColInRow[prevRow][role] = col;
    }
  });

  const numRows = steps.length > 0 ? Math.max(...stepRows) + 1 : 1;

  // Build step layout nodes
  const layoutNodes: LayoutNode[] = steps.map((step, idx) => ({
    id: step.id,
    type: 'step',
    bpmnShape: step.bpmnShape || 'task',
    role: step.role || 'Operator',
    action: step.action || `Step ${idx + 1}`,
    row: stepRows[idx],
    col: stepCols[idx],
    stepRef: step,
  }));

  // Add page text annotations (one per row, at col 0 of the first role)
  for (let r = 0; r < numRows; r++) {
    layoutNodes.push({
      id: `TextAnnotation_Row_${r}`,
      type: 'text-annotation',
      bpmnShape: 'text-annotation',
      role: uniqueRoles[0] || 'Operator',
      action: `Page ${r + 1}`,
      row: r,
      col: 0,
    });
  }

  // Derive original flows from step definitions
  const originalFlows: CalculatedFlow[] = [];
  steps.forEach((step, idx) => {
    if (step.bpmnShape === 'exclusive-gateway') {
      const yesTargetId =
        step.branchYesTargetId ||
        (idx < steps.length - 1 ? steps[idx + 1].id : null);
      if (yesTargetId) {
        originalFlows.push({
          id: `Flow_${step.id}_yes`,
          sourceId: step.id,
          targetId: yesTargetId,
          label: step.branchYesLabel || 'Y',
        });
      }
      const noTargetId =
        step.branchNoTargetId ||
        (idx < steps.length - 1 ? steps[idx + 1].id : null);
      if (noTargetId) {
        originalFlows.push({
          id: `Flow_${step.id}_no`,
          sourceId: step.id,
          targetId: noTargetId,
          label: step.branchNoLabel || 'N',
        });
      }
    } else if (
      step.bpmnShape !== 'end-event' &&
      step.bpmnShape !== 'message-end-event'
    ) {
      const targetId =
        step.nextStepId ||
        (idx < steps.length - 1 ? steps[idx + 1].id : null);
      if (targetId) {
        originalFlows.push({
          id: `Flow_${step.id}_${targetId}`,
          sourceId: step.id,
          targetId: targetId,
        });
      }
    }
  });

  return { layoutNodes, stepRows, stepCols, numRows, originalFlows };
}

/**
 * Standalone helper — compute only the number of rows (used by the public
 * getNumRows() export in bpmnXmlGenerator.ts without importing the full result).
 */
export function computeNumRows(steps: ProcessStep[]): number {
  if (steps.length === 0) return 1;
  const stepRows: number[] = [];
  const stepCols: number[] = [];
  const lastColInRow: { [row: number]: { [role: string]: number } } = {};

  steps.forEach((step, idx) => {
    const role = step.role || 'Operator';
    if (idx === 0) {
      stepRows.push(0);
      stepCols.push(0);
      lastColInRow[0] = { [role]: 0 };
      return;
    }
    const prevRow = stepRows[idx - 1];
    const prevRole = steps[idx - 1].role || 'Operator';
    const prevCol = stepCols[idx - 1];
    const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
    let col: number;
    if (role === prevRole) {
      col = Math.max(prevCol + 1, lastColForRole + 1);
    } else {
      col = Math.max(prevCol, lastColForRole + 1);
    }
    if (col >= COLS_PER_ROW) {
      const newRow = prevRow + 1;
      stepRows.push(newRow);
      stepCols.push(1);
      if (!lastColInRow[newRow]) lastColInRow[newRow] = {};
      lastColInRow[newRow][role] = 1;
    } else {
      stepRows.push(prevRow);
      stepCols.push(col);
      if (!lastColInRow[prevRow]) lastColInRow[prevRow] = {};
      lastColInRow[prevRow][role] = col;
    }
  });

  return Math.max(...stepRows) + 1;
}
