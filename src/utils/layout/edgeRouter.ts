import type { ProcessStep } from '../../types';
import type { LayoutNode, CalculatedFlow, Rect, EdgeSegment } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Module 4 — Edge Router
//
// Responsibility: Compute waypoints for every sequence flow (CalculatedFlow).
// Five routing strategies are applied based on the relative position of the
// source and target nodes:
//
//   1. backward-loop   — target row < source row (curved loop around bottom)
//   2. vertical-aligned — source and target share the same X center (±35px)
//   3. forward-horizontal-straight — left-to-right, same Y center (±5px)
//   4. forward-horizontal-elbow — left-to-right, different Y center
//   5. backward-horizontal — source to the right of target (fallback loop)
//
// Also extracts all EdgeSegment[] (waypoint-to-waypoint line segments) from
// the resolved waypoints — used by documentPlacer for collision detection.
// ─────────────────────────────────────────────────────────────────────────────

export interface EdgeRouterResult {
  /** Map from flowId → ordered waypoint array */
  edgeWaypoints: Map<string, { x: number; y: number }[]>;
  /**
   * Flat list of all edge segments (one entry per consecutive waypoint pair
   * across all flows). Used by documentPlacer for collision detection.
   */
  allEdgeSegments: EdgeSegment[];
}

/**
 * Route all sequence flows and collect edge segments.
 */
export function routeEdges(
  finalFlows: CalculatedFlow[],
  nodePositions: Map<string, Rect>,
  allNodes: LayoutNode[],
  steps: ProcessStep[],
  rowFilter?: number,
  rowOffset?: number
): EdgeRouterResult {
  const edgeWaypoints = new Map<string, { x: number; y: number }[]>();
  const allEdgeSegments: EdgeSegment[] = [];

  finalFlows.forEach((flow) => {
    const fromPos = nodePositions.get(flow.sourceId);
    const toPos = nodePositions.get(flow.targetId);
    if (!fromPos || !toPos) return;

    const startX = Math.round(fromPos.x + fromPos.width);
    const startY = Math.round(fromPos.y + fromPos.height / 2);
    const endX = Math.round(toPos.x);
    const endY = Math.round(toPos.y + toPos.height / 2);

    let waypoints: { x: number; y: number }[] = [];

    // ── Check for custom waypoints stored on the step ──────────────────────
    let customWaypoints: { x: number; y: number }[] | undefined;
    if (flow.sourceId.startsWith('LinkCatch_')) {
      const targetStep = steps.find((s) => s.id === flow.targetId);
      customWaypoints = targetStep?.layoutCatchWaypoints;
    } else {
      const sourceStep = steps.find((s) => s.id === flow.sourceId);
      customWaypoints = sourceStep?.layoutWaypointsMap?.[flow.targetId];
    }

    if (customWaypoints && customWaypoints.length >= 2) {
      waypoints = customWaypoints.map((wp) => {
        let yVal = wp.y;
        if (rowFilter !== undefined && rowOffset !== undefined) yVal -= rowFilter * rowOffset;
        return { x: Math.round(wp.x), y: Math.round(yVal) };
      });
    } else {
      // ── Compute waypoints from geometry ─────────────────────────────────
      const fromNode = allNodes.find((n) => n.id === flow.sourceId);
      const toNode = allNodes.find((n) => n.id === flow.targetId);
      const fromCenterX = fromPos.x + fromPos.width / 2;
      const toCenterX = toPos.x + toPos.width / 2;

      if (fromNode && toNode && toNode.row < fromNode.row) {
        // Strategy 1: backward loop
        const p1_x = startX + 20, p1_y = startY;
        const p2_x = p1_x;
        const p2_y = Math.max(fromPos.y + fromPos.height + 40, toPos.y + toPos.height + 40);
        const p3_x = endX - 20, p3_y = p2_y;
        const p4_x = p3_x, p4_y = endY;
        waypoints = [
          { x: startX, y: startY },
          { x: p1_x, y: p1_y },
          { x: p2_x, y: p2_y },
          { x: p3_x, y: p3_y },
          { x: p4_x, y: p4_y },
          { x: endX, y: endY },
        ];
      } else if (Math.abs(fromCenterX - toCenterX) < 35) {
        // Strategy 2: vertical-aligned
        let hasCollision = false;
        if (fromNode && toNode) {
          const minRow = Math.min(fromNode.row, toNode.row);
          const maxRow = Math.max(fromNode.row, toNode.row);
          hasCollision = allNodes.some(
            (node) =>
              node.type === 'step' &&
              node.id !== fromNode.id &&
              node.id !== toNode.id &&
              node.col === fromNode.col &&
              node.row > minRow &&
              node.row < maxRow
          );
        }

        if (hasCollision) {
          const gutterX = Math.max(fromPos.x + fromPos.width, toPos.x + toPos.width) + 30;
          waypoints = [
            { x: fromPos.x + fromPos.width, y: fromPos.y + fromPos.height / 2 },
            { x: gutterX, y: fromPos.y + fromPos.height / 2 },
            { x: gutterX, y: toPos.y + toPos.height / 2 },
            { x: toPos.x + toPos.width, y: toPos.y + toPos.height / 2 },
          ];
        } else {
          const commonX = Math.round((fromCenterX + toCenterX) / 2);
          let sY = fromPos.y + fromPos.height / 2;
          let eY = toPos.y + toPos.height / 2;
          if (fromPos.y + fromPos.height <= toPos.y) {
            sY = fromPos.y + fromPos.height;
            eY = toPos.y;
          } else if (toPos.y + toPos.height <= fromPos.y) {
            sY = fromPos.y;
            eY = toPos.y + toPos.height;
          }
          const midY = Math.round((sY + eY) / 2);
          waypoints = [
            { x: commonX, y: sY },
            { x: commonX, y: midY },
            { x: commonX, y: eY },
          ];
        }
      } else if (fromPos.x + fromPos.width <= toPos.x) {
        if (Math.abs(startY - endY) < 5) {
          // Strategy 3: forward-horizontal-straight (check for obstacles)
          let hasHorizontalCollision = false;
          if (fromNode && toNode) {
            const minCol = Math.min(fromNode.col, toNode.col);
            const maxCol = Math.max(fromNode.col, toNode.col);
            hasHorizontalCollision = allNodes.some(
              (node) =>
                node.type === 'step' &&
                node.id !== fromNode.id &&
                node.id !== toNode.id &&
                node.row === fromNode.row &&
                node.role === fromNode.role &&
                node.col > minCol &&
                node.col < maxCol
            );
          }
          if (hasHorizontalCollision) {
            const routeY = fromPos.y - 25;
            waypoints = [
              { x: Math.round(fromPos.x + fromPos.width / 2), y: Math.round(fromPos.y) },
              { x: Math.round(fromPos.x + fromPos.width / 2), y: Math.round(routeY) },
              { x: Math.round(toPos.x + toPos.width / 2), y: Math.round(routeY) },
              { x: Math.round(toPos.x + toPos.width / 2), y: Math.round(toPos.y) },
            ];
          } else {
            waypoints = [{ x: startX, y: startY }, { x: endX, y: endY }];
          }
        } else {
          // Strategy 4: forward-horizontal-elbow (different Y, handle gateways)
          if (fromNode?.bpmnShape?.includes('gateway')) {
            const fromCenterXG = Math.round(fromPos.x + fromPos.width / 2);
            const toCenterY = Math.round(toPos.y + toPos.height / 2);
            if (toCenterY < startY) {
              waypoints = [
                { x: fromCenterXG, y: Math.round(fromPos.y) },
                { x: fromCenterXG, y: toCenterY },
                { x: Math.round(toPos.x), y: toCenterY },
              ];
            } else {
              waypoints = [
                { x: fromCenterXG, y: Math.round(fromPos.y + fromPos.height) },
                { x: fromCenterXG, y: toCenterY },
                { x: Math.round(toPos.x), y: toCenterY },
              ];
            }
          } else {
            const midX = Math.round((startX + endX) / 2);
            waypoints = [
              { x: startX, y: startY },
              { x: midX, y: startY },
              { x: midX, y: endY },
              { x: endX, y: endY },
            ];
          }
        }
      } else {
        // Strategy 5: backward-horizontal (source to the right of target)
        const p1_x = startX + 20, p1_y = startY;
        const p2_x = p1_x;
        const p2_y = Math.max(fromPos.y + fromPos.height + 40, toPos.y + toPos.height + 40);
        const p3_x = endX - 20, p3_y = p2_y;
        const p4_x = p3_x, p4_y = endY;
        waypoints = [
          { x: startX, y: startY },
          { x: p1_x, y: p1_y },
          { x: p2_x, y: p2_y },
          { x: p3_x, y: p3_y },
          { x: p4_x, y: p4_y },
          { x: endX, y: endY },
        ];
      }
    }

    edgeWaypoints.set(flow.id, waypoints);

    // Extract edge segments for collision detection
    for (let i = 0; i < waypoints.length - 1; i++) {
      allEdgeSegments.push({
        flowId: flow.id,
        x1: waypoints[i].x,
        y1: waypoints[i].y,
        x2: waypoints[i + 1].x,
        y2: waypoints[i + 1].y,
      });
    }
  });

  return { edgeWaypoints, allEdgeSegments };
}
