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
 * Maps each step to incoming source step IDs based on gateway branches and nextStepIds.
 */
function buildIncomingStepMap(steps: ProcessStep[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  steps.forEach((step, idx) => {
    if (step.bpmnShape === 'exclusive-gateway') {
      const yesId = step.branchYesTargetId || (idx < steps.length - 1 ? steps[idx + 1].id : null);
      if (yesId) {
        if (!map.has(yesId)) map.set(yesId, []);
        map.get(yesId)!.push(step.id);
      }
      const noId = step.branchNoTargetId || (idx < steps.length - 1 ? steps[idx + 1].id : null);
      if (noId) {
        if (!map.has(noId)) map.set(noId, []);
        map.get(noId)!.push(step.id);
      }
    } else if (step.bpmnShape !== 'end-event' && step.bpmnShape !== 'message-end-event') {
      const targetIds = (step.nextStepIds && step.nextStepIds.length > 0)
        ? step.nextStepIds
        : (step.nextStepId ? [step.nextStepId] : (idx < steps.length - 1 ? [steps[idx + 1].id] : []));
      targetIds.forEach((tid) => {
        if (tid) {
          if (!map.has(tid)) map.set(tid, []);
          map.get(tid)!.push(step.id);
        }
      });
    }
  });
  return map;
}

/**
 * Topologically sorts workflow steps to guarantee predecessors are positioned before successors,
 * preventing cross-page backward loops when steps are out-of-order in the array.
 */
export function topologicalSortSteps(steps: ProcessStep[]): ProcessStep[] {
  if (steps.length <= 1) return [...steps];

  const incomingMap = new Map<string, Set<string>>();
  const outgoingMap = new Map<string, Set<string>>();
  const stepMap = new Map<string, ProcessStep>();

  steps.forEach((s) => {
    stepMap.set(s.id, s);
    incomingMap.set(s.id, new Set());
    outgoingMap.set(s.id, new Set());
  });

  steps.forEach((step, idx) => {
    let targets: string[] = [];
    if (step.bpmnShape === 'exclusive-gateway') {
      if (step.branchYesTargetId) targets.push(step.branchYesTargetId);
      if (step.branchNoTargetId) targets.push(step.branchNoTargetId);
    } else if (step.bpmnShape !== 'end-event' && step.bpmnShape !== 'message-end-event') {
      targets = (step.nextStepIds && step.nextStepIds.length > 0)
        ? step.nextStepIds
        : (step.nextStepId ? [step.nextStepId] : (idx < steps.length - 1 ? [steps[idx + 1].id] : []));
    }

    targets.forEach((tid) => {
      if (tid && stepMap.has(tid) && tid !== step.id) {
        outgoingMap.get(step.id)!.add(tid);
        incomingMap.get(tid)!.add(step.id);
      }
    });
  });

  const inDegree = new Map<string, number>();
  steps.forEach((s) => {
    inDegree.set(s.id, incomingMap.get(s.id)!.size);
  });

  const queue = steps.filter((s) => inDegree.get(s.id) === 0).map((s) => s.id);
  const sorted: ProcessStep[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    queue.sort((a, b) => {
      const idxA = steps.findIndex((s) => s.id === a);
      const idxB = steps.findIndex((s) => s.id === b);
      return idxA - idxB;
    });

    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);
    sorted.push(stepMap.get(currId)!);

    outgoingMap.get(currId)!.forEach((nextId) => {
      const deg = inDegree.get(nextId)! - 1;
      inDegree.set(nextId, deg);
      if (deg === 0) {
        queue.push(nextId);
      }
    });
  }

  // Preserve any remaining steps (unlinked or cycle nodes) in original order
  steps.forEach((s) => {
    if (!visited.has(s.id)) {
      sorted.push(s);
    }
  });

  return sorted;
}

/**
 * Assigns (row, col) grid coordinates for each step in execution order,
 * taking into account graph predecessor sources for branched workflows.
 */
export function assignStepGridPositions(
  steps: ProcessStep[],
  uniqueRoles: string[] = []
): { stepRows: number[]; stepCols: number[]; numRows: number } {
  if (steps.length === 0) {
    return { stepRows: [], stepCols: [], numRows: 1 };
  }

  // Pre-sort steps in topological order so forward predecessors are always positioned before successors
  const sortedSteps = topologicalSortSteps(steps);

  const posMap = new Map<string, { row: number; col: number }>();
  const lastColInRow: { [row: number]: { [role: string]: number } } = {};
  const stepIdToIdx = new Map<string, number>();

  const effectiveRoles = uniqueRoles && uniqueRoles.length > 0
    ? uniqueRoles
    : Array.from(new Set(steps.map((s) => s.role || 'Operator')));

  const incomingMap = buildIncomingStepMap(sortedSteps);

  sortedSteps.forEach((step, idx) => {
    stepIdToIdx.set(step.id, idx);
    const role = step.role || 'Operator';

    if (idx === 0) {
      posMap.set(step.id, { row: 0, col: 0 });
      lastColInRow[0] = { [role]: 0 };
      return;
    }

    const incomingIds = incomingMap.get(step.id) || [];
    const validSources = incomingIds
      .map((id) => stepIdToIdx.get(id))
      .filter((sIdx): sIdx is number => sIdx !== undefined && sIdx < idx);

    // 1. Determine minimum target row based on all predecessors (forward row invariant)
    const sourceRows = validSources.map((sIdx) => posMap.get(sortedSteps[sIdx].id)?.row ?? 0);
    const fallbackRow = idx > 0 ? (posMap.get(sortedSteps[idx - 1].id)?.row ?? 0) : 0;
    const targetRow = sourceRows.length > 0 ? Math.max(...sourceRows) : fallbackRow;

    // 2. Identify sources on targetRow (predecessors on earlier rows arrive via Link Events at col 0)
    const sameRowSources = validSources.filter(
      (sIdx) => (posMap.get(sortedSteps[sIdx].id)?.row ?? 0) === targetRow
    );

    let primarySourceIdx = idx - 1;
    const prevRow = targetRow;
    let prevCol = 0;
    let prevRole = '';
    let forceIncrement = false;

    if (sameRowSources.length > 0) {
      sameRowSources.sort((a, b) => {
        const colA = posMap.get(sortedSteps[a].id)?.col ?? 0;
        const colB = posMap.get(sortedSteps[b].id)?.col ?? 0;
        const reqA = colA + (sortedSteps[a].role === role ? 1 : 0);
        const reqB = colB + (sortedSteps[b].role === role ? 1 : 0);
        return reqB - reqA;
      });
      primarySourceIdx = sameRowSources[0];
      prevCol = posMap.get(sortedSteps[primarySourceIdx].id)?.col ?? 0;
      prevRole = sortedSteps[primarySourceIdx].role || 'Operator';
      const prevStep = sortedSteps[primarySourceIdx];
      if (
        step.bpmnShape === 'exclusive-gateway' ||
        prevStep.bpmnShape === 'exclusive-gateway'
      ) {
        forceIncrement = true;
      }
    } else if (validSources.length > 0) {
      // All predecessors are on earlier rows; this step enters targetRow via a Catch Link Event at col 0
      prevCol = 0;
      prevRole = '';
    } else {
      // Unlinked step, fallback to predecessor in array
      primarySourceIdx = idx - 1;
      prevCol = posMap.get(sortedSteps[primarySourceIdx].id)?.col ?? 0;
      prevRole = sortedSteps[primarySourceIdx].role || 'Operator';
    }

    let col: number;
    if (!prevRole || prevCol === 0) {
      const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
      col = Math.max(1, lastColForRole + 1);
    } else if (role === prevRole || forceIncrement) {
      const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
      col = Math.max(prevCol + 1, lastColForRole + 1);
    } else {
      const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
      col = Math.max(prevCol, lastColForRole + 1);

      // If col === prevCol, check if any intermediate lane between prevRole and role is already occupied
      // Only advance if it does not force a multi-page wrap
      if (col === prevCol && effectiveRoles.length > 0 && prevCol + 1 < COLS_PER_ROW) {
        const r1 = effectiveRoles.indexOf(prevRole);
        const r2 = effectiveRoles.indexOf(role);
        if (r1 !== -1 && r2 !== -1) {
          const minR = Math.min(r1, r2);
          const maxR = Math.max(r1, r2);
          for (let rIdx = minR + 1; rIdx < maxR; rIdx++) {
            const midRole = effectiveRoles[rIdx];
            if (lastColInRow[prevRow]?.[midRole] === col) {
              col = prevCol + 1;
              break;
            }
          }
        }
      }
    }

    if (col >= COLS_PER_ROW) {
      // Wrap to a new page row; column 0 is reserved for the Catch Link Event
      const newRow = prevRow + 1;
      posMap.set(step.id, { row: newRow, col: 1 });
      if (!lastColInRow[newRow]) lastColInRow[newRow] = {};
      lastColInRow[newRow][role] = 1;
    } else {
      posMap.set(step.id, { row: prevRow, col });
      if (!lastColInRow[prevRow]) lastColInRow[prevRow] = {};
      lastColInRow[prevRow][role] = col;
    }
  });

  // Map positions back to original steps array order to preserve parallel arrays
  const stepRows = steps.map((s) => posMap.get(s.id)?.row ?? 0);
  const stepCols = steps.map((s) => posMap.get(s.id)?.col ?? 0);
  const numRows = steps.length > 0 ? Math.max(...stepRows) + 1 : 1;
  return { stepRows, stepCols, numRows };
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
  const { stepRows, stepCols, numRows } = assignStepGridPositions(steps, uniqueRoles);

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
      const targetIds = (step.nextStepIds && step.nextStepIds.length > 0)
        ? step.nextStepIds
        : (step.nextStepId ? [step.nextStepId] : (idx < steps.length - 1 ? [steps[idx + 1].id] : []));

      targetIds.forEach((targetId) => {
        if (targetId) {
          originalFlows.push({
            id: `Flow_${step.id}_${targetId}`,
            sourceId: step.id,
            targetId: targetId,
          });
        }
      });
    }
  });

  return { layoutNodes, stepRows, stepCols, numRows, originalFlows };
}

/**
 * Standalone helper — compute only the number of rows (used by the public
 * getNumRows() export in bpmnXmlGenerator.ts without importing the full result).
 */
export function computeNumRows(steps: ProcessStep[], uniqueRoles: string[] = []): number {
  return assignStepGridPositions(steps, uniqueRoles).numRows;
}
