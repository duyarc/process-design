import type { LayoutNode, Rect, LayoutConstants } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Module 3 — Node Positioner
//
// Responsibility: Compute the pixel bounding-box (x, y, width, height) for
// every LayoutNode. Supports both auto-layout (grid-derived coordinates) and
// custom/drag-and-drop layout (coordinates stored on ProcessStep.layoutX/Y).
//
// Also computes label bounds (labelX, labelY, labelW, labelH) for use in
// BPMNShape DI elements.
// ─────────────────────────────────────────────────────────────────────────────

export interface NodePositionResult {
  /** Map from node ID → bounding box */
  nodePositions: Map<string, Rect>;
  /**
   * Map from node ID → label bounds
   * Note: label bounds are only needed for the DI XML generation step.
   */
  labelPositions: Map<string, { x: number; y: number; w: number; h: number }>;
}

/**
 * Compute pixel positions for all nodes.
 *
 * @param allNodes    All LayoutNodes (steps + link events + text annotations)
 * @param uniqueRoles Ordered list of role names (defines lane Y ordering)
 * @param constants   Layout dimension constants
 * @param rowFilter   If set, only nodes on this row are positioned (single-page render mode)
 */
export function computeNodePositions(
  allNodes: LayoutNode[],
  uniqueRoles: string[],
  constants: LayoutConstants,
  rowFilter?: number
): NodePositionResult {
  const {
    laneHeight,
    rowSpacing,
    nodeWidth,
    nodeHeight,
    circleSize,
    gatewaySize,
    startX,
    spacingX,
  } = constants;

  const rowOffset = laneHeight * uniqueRoles.length + rowSpacing;

  const nodePositions = new Map<string, Rect>();
  const labelPositions = new Map<string, { x: number; y: number; w: number; h: number }>();

  // Count how many nodes share the same (row, role, col) cell to handle stacking
  const groupCounts: { [key: string]: number } = {};
  const groupIndices: { [key: string]: number } = {};

  allNodes.forEach((node) => {
    if (node.type !== 'text-annotation') {
      const key = `${node.row}_${node.role}_${node.col}`;
      groupCounts[key] = (groupCounts[key] || 0) + 1;
    }
  });

  allNodes.forEach((node) => {
    // ── Text Annotations (page labels) ────────────────────────────────────
    if (node.type === 'text-annotation') {
      let yRaw = node.row * rowOffset + 10;
      if (rowFilter !== undefined) yRaw -= rowFilter * rowOffset;
      const x = 170;
      const y = Math.round(yRaw);
      const w = 100;
      const h = 30;
      nodePositions.set(node.id, { x, y, width: w, height: h, shape: 'text-annotation' });
      labelPositions.set(node.id, { x, y, w, h });
      return;
    }

    // ── Regular Nodes ──────────────────────────────────────────────────────
    const shape = node.bpmnShape;
    const rIdx = Math.max(0, uniqueRoles.indexOf(node.role));

    // Vertical sub-index within a shared cell (to prevent overlap)
    const key = `${node.row}_${node.role}_${node.col}`;
    const N = groupCounts[key] || 1;
    if (groupIndices[key] === undefined) groupIndices[key] = 0;
    const nodeSubIdx = groupIndices[key];
    groupIndices[key]++;

    let offsetY = 0;
    if (N > 1) {
      offsetY = Math.round((nodeSubIdx - (N - 1) / 2) * 45);
    }

    const yCenter = (() => {
      let raw = node.row * rowOffset + rIdx * laneHeight + laneHeight / 2 + offsetY;
      if (rowFilter !== undefined) raw -= rowFilter * rowOffset;
      return raw;
    })();
    const xCenter = startX + node.col * spacingX;

    let x: number, y: number, w: number, h: number;

    if (shape.includes('event')) {
      w = circleSize; h = circleSize;
      x = Math.round(
        node.type === 'step' && node.stepRef?.layoutX !== undefined
          ? node.stepRef.layoutX
          : xCenter - circleSize / 2
      );
      let yRaw =
        node.type === 'step' && node.stepRef?.layoutY !== undefined
          ? node.stepRef.layoutY
          : yCenter - circleSize / 2;
      if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.layoutY !== undefined) {
        yRaw -= rowFilter * rowOffset;
      }
      y = Math.round(yRaw);
    } else if (shape.includes('gateway')) {
      w = gatewaySize; h = gatewaySize;
      x = Math.round(
        node.type === 'step' && node.stepRef?.layoutX !== undefined
          ? node.stepRef.layoutX
          : xCenter - gatewaySize / 2
      );
      let yRaw =
        node.type === 'step' && node.stepRef?.layoutY !== undefined
          ? node.stepRef.layoutY
          : yCenter - gatewaySize / 2;
      if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.layoutY !== undefined) {
        yRaw -= rowFilter * rowOffset;
      }
      y = Math.round(yRaw);
    } else {
      w = nodeWidth; h = nodeHeight;
      x = Math.round(
        node.type === 'step' && node.stepRef?.layoutX !== undefined
          ? node.stepRef.layoutX
          : xCenter - nodeWidth / 2
      );
      let yRaw =
        node.type === 'step' && node.stepRef?.layoutY !== undefined
          ? node.stepRef.layoutY
          : yCenter - nodeHeight / 2;
      if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.layoutY !== undefined) {
        yRaw -= rowFilter * rowOffset;
      }
      y = Math.round(yRaw);
    }

    nodePositions.set(node.id, { x, y, width: w, height: h, shape });

    // Label bounds
    const labelXVal = Math.round(
      node.type === 'step' && node.stepRef?.labelX !== undefined
        ? node.stepRef.labelX
        : x - 20
    );
    let labelYRaw =
      node.type === 'step' && node.stepRef?.labelY !== undefined
        ? node.stepRef.labelY
        : shape.includes('task')
        ? y + 25
        : y + h + 8;
    if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.labelY !== undefined) {
      labelYRaw -= rowFilter * rowOffset;
    }
    const labelYVal = Math.round(labelYRaw);
    const labelWVal = Math.round(
      node.type === 'step' && node.stepRef?.labelW !== undefined ? node.stepRef.labelW : w + 40
    );
    const labelHVal = Math.round(
      node.type === 'step' && node.stepRef?.labelH !== undefined ? node.stepRef.labelH : 14
    );

    labelPositions.set(node.id, { x: labelXVal, y: labelYVal, w: labelWVal, h: labelHVal });
  });

  return { nodePositions, labelPositions };
}

/**
 * Compute the maximum right edge across all nodes (used to determine pool width).
 * Must be run on the FULL (un-filtered) node set so all pages share the same pool width.
 */
export function computeMaxRightEdge(
  allNodes: LayoutNode[],
  constants: LayoutConstants
): number {
  const { nodeWidth, circleSize, gatewaySize, startX, spacingX } = constants;
  let maxRightEdge = 0;

  allNodes.forEach((node) => {
    if (node.type === 'text-annotation') return;

    let rightEdge = 0;
    if (node.type === 'step' && node.stepRef?.layoutX !== undefined) {
      let w = nodeWidth;
      if (node.bpmnShape.includes('event')) w = circleSize;
      else if (node.bpmnShape.includes('gateway')) w = gatewaySize;
      rightEdge = node.stepRef.layoutX + w;
    } else {
      const xCenter = startX + node.col * spacingX;
      let w = nodeWidth;
      if (node.bpmnShape.includes('event')) w = circleSize;
      else if (node.bpmnShape.includes('gateway')) w = gatewaySize;
      rightEdge = xCenter + w / 2;
    }

    if (rightEdge > maxRightEdge) maxRightEdge = rightEdge;
  });

  return maxRightEdge;
}
