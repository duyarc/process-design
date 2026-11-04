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
  const catchMap = new Map<string, { catchId: string; linkName: string }>();

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
    } else {
      // Cross-row flow (forward or inter-page loop): synthesise link event pair
      // Deduplicate Catch events: if multiple flows from rowA target the same step on rowB,
      // they share a single Catch event with the same link label.
      const catchKey = `${rowA}_to_${rowB}_${flow.targetId}`;
      let catchInfo = catchMap.get(catchKey);

      if (!catchInfo) {
        linkCounter++;
        const linkName = getLinkLabel(linkCounter);
        const catchId = `LinkCatch_${rowA}_to_${flow.targetId}`;

        // Catch Event: placed at col 0 of rowB, in TARGET step's role lane
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

        // Synthetic flow from Catch event to target step
        finalFlows.push({
          id: `Flow_catch_to_${flow.targetId}`,
          sourceId: catchId,
          targetId: flow.targetId,
        });

        catchInfo = { catchId, linkName };
        catchMap.set(catchKey, catchInfo);
      }

      // Throw Event: placed at col 6 of rowA, in SOURCE step's role lane
      const throwId = `LinkThrow_${flow.sourceId}_to_${flow.targetId}`;
      linkNodes.push({
        id: throwId,
        type: 'link-throw',
        bpmnShape: 'intermediate-throw-event',
        role: steps[sourceIdx].role || 'Operator',
        action: catchInfo.linkName,
        row: rowA,
        col: 6,
        linkName: catchInfo.linkName,
      });

      // Synthetic flow from source step to Throw event
      finalFlows.push({
        id: `${flow.id}_to_throw`,
        sourceId: flow.sourceId,
        targetId: throwId,
        label: flow.label,
      });
    }
  });

  return {
    allNodes: [...layoutNodes, ...linkNodes],
    finalFlows,
  };
}
