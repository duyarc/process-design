import type { ProcessStep } from '../../types';
import type { LayoutNode, CalculatedFlow } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Module 2 — Link Event Synthesis
//
// Responsibility: When a sequence flow crosses a row boundary (i.e. the source
// step is on row R and the target is on row R+N), replace that single flow with
// a Throw Link Event at the end of row R and a Catch Link Event at the start
// of row R+N, plus two synthetic flows (step→throw, catch→step).
//
// Backward loops (target row < source row) are kept as physical curved lines —
// no link event synthesis needed.
// ─────────────────────────────────────────────────────────────────────────────

function getLinkLabel(index: number): string {
  let label = '';
  let temp = index;
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    label = String.fromCharCode(65 + mod) + label;
    temp = Math.floor((temp - mod) / 26);
  }
  return label;
}

export interface LinkEventsResult {
  /** All layout nodes including the synthesised link-throw and link-catch nodes */
  allNodes: LayoutNode[];
  /** Final flows after link-event substitution */
  finalFlows: CalculatedFlow[];
}

/**
 * Inspect every original sequence flow. For cross-row forward flows, synthesise
 * a throw/catch link event pair and split the original flow into two segments.
 */
export function synthesizeLinkEvents(
  layoutNodes: LayoutNode[],
  steps: ProcessStep[],
  stepRows: number[],
  originalFlows: CalculatedFlow[]
): LinkEventsResult {
  const finalFlows: CalculatedFlow[] = [];
  const linkNodes: LayoutNode[] = [];
  let linkCounter = 0;

  originalFlows.forEach((flow) => {
    const sourceIdx = steps.findIndex((s) => s.id === flow.sourceId);
    const targetIdx = steps.findIndex((s) => s.id === flow.targetId);

    if (sourceIdx === -1 || targetIdx === -1) {
      // One or both endpoints not in steps (shouldn't happen in practice)
      finalFlows.push(flow);
      return;
    }

    const rowA = stepRows[sourceIdx];
    const rowB = stepRows[targetIdx];

    if (rowA === rowB) {
      // Same row — pass through unchanged
      finalFlows.push(flow);
    } else if (rowA < rowB) {
      // Forward cross-row: synthesise link event pair
      linkCounter++;
      const linkName = getLinkLabel(linkCounter);

      const throwId = `LinkThrow_${flow.sourceId}_to_${flow.targetId}`;
      const catchId = `LinkCatch_${flow.sourceId}_to_${flow.targetId}`;

      // Throw Event: placed at col 6 (rightmost) of rowA, in target step's role lane
      linkNodes.push({
        id: throwId,
        type: 'link-throw',
        bpmnShape: 'intermediate-throw-event',
        role: steps[targetIdx].role || 'Operator',
        action: linkName,
        row: rowA,
        col: 6,
        linkName,
      });

      // Catch Event: placed at col 0 of rowB (reserved for catch events), in target step's role lane
      linkNodes.push({
        id: catchId,
        type: 'link-catch',
        bpmnShape: 'intermediate-catch-event',
        role: steps[targetIdx].role || 'Operator',
        action: linkName,
        row: rowB,
        col: 0,
        linkName,
      });

      // Split the original flow into two synthetic flows
      finalFlows.push({
        id: `${flow.id}_to_throw`,
        sourceId: flow.sourceId,
        targetId: throwId,
        label: flow.label,
      });
      finalFlows.push({
        id: `Flow_catch_to_${flow.targetId}`,
        sourceId: catchId,
        targetId: flow.targetId,
      });
    } else {
      // Backward loop (rowA > rowB): keep physical curved line, no synthesis
      finalFlows.push(flow);
    }
  });

  return {
    allNodes: [...layoutNodes, ...linkNodes],
    finalFlows,
  };
}
