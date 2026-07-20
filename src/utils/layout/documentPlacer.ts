import type { LayoutNode, Rect, EdgeSegment, DocumentPlacement } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Module 5 — Document Placer (with Collision Detection)
//
// Responsibility: Place DataObjectReference shapes (document icons) for every
// task step that producesForm=true.
//
// Algorithm (Direction A — 2-pass):
//   Pass 1 is performed upstream in edgeRouter — all edge segments are already
//   collected into allEdgeSegments[].
//
//   Pass 2 (this module): For each document shape, try a prioritised list of
//   candidate positions. Choose the first candidate whose bounding box does
//   NOT intersect any edge segment (with a 4px clearance margin).
//
// Skip collision check entirely when the user has saved a custom position
// (step.formLayouts[formName] exists) — respect the user's manual placement.
// ─────────────────────────────────────────────────────────────────────────────

/** Width and height of a DataObjectReference shape in BPMN DI */
const DOC_W = 36;
const DOC_H = 50;

/** Clearance margin added around the document rect when testing intersections */
const COLLISION_MARGIN = 4;

/**
 * Candidate position offsets relative to the default top-center position
 * (taskX + taskW/2 - DOC_W/2, taskY - 60).
 * Tried in order: the first collision-free candidate wins.
 */
const CANDIDATE_OFFSETS: { dx: number; dy: number; label: string }[] = [
  { dx: 0,    dy: 0,    label: 'top-center' },  // default (y=-60 from task top)
  { dx: 120,  dy: 30,   label: 'right'      },  // to the right of the task
  { dx: 0,    dy: 150,  label: 'below'      },  // below the task
  { dx: -120, dy: 30,   label: 'left'       },  // to the left of the task
  { dx: 60,   dy: 0,    label: 'top-right'  },  // shifted right at same height
  { dx: -60,  dy: 0,    label: 'top-left'   },  // shifted left at same height
];

// ─────────────────────────────────────────────────────────────────────────────
// Collision detection helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the line segment [x1,y1 → x2,y2] passes through the
 * axis-aligned bounding box [rx, ry, rx+rw, ry+rh] expanded by `margin`.
 *
 * Uses separate fast-path tests for vertical and horizontal segments,
 * then falls back to Cohen-Sutherland parametric clipping for diagonals.
 */
function segmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number,
  margin: number
): boolean {
  const left   = rx - margin;
  const right  = rx + rw + margin;
  const top    = ry - margin;
  const bottom = ry + rh + margin;

  const dx = x2 - x1;
  const dy = y2 - y1;

  // Fast path: vertical segment
  if (Math.abs(dx) < 2) {
    if (x1 < left || x1 > right) return false;
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return maxY > top && minY < bottom;
  }

  // Fast path: horizontal segment
  if (Math.abs(dy) < 2) {
    if (y1 < top || y1 > bottom) return false;
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    return maxX > left && minX < right;
  }

  // Diagonal: parametric Cohen-Sutherland clip
  let tMin = 0, tMax = 1;

  // Clip against left and right
  if (dx !== 0) {
    const t1 = (left - x1) / dx;
    const t2 = (right - x1) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else if (x1 < left || x1 > right) {
    return false;
  }

  // Clip against top and bottom
  if (dy !== 0) {
    const t1 = (top - y1) / dy;
    const t2 = (bottom - y1) / dy;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  } else if (y1 < top || y1 > bottom) {
    return false;
  }

  return tMin <= tMax;
}

/**
 * Test whether a document shape placed at (doX, doY) would be intersected
 * by any edge segment in allEdgeSegments.
 */
function hasEdgeCollision(
  doX: number,
  doY: number,
  allEdgeSegments: EdgeSegment[]
): boolean {
  for (const seg of allEdgeSegments) {
    if (segmentIntersectsRect(
      seg.x1, seg.y1, seg.x2, seg.y2,
      doX, doY, DOC_W, DOC_H,
      COLLISION_MARGIN
    )) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Label positioning helper (carries over from original bpmnXmlGenerator)
// ─────────────────────────────────────────────────────────────────────────────

function computeLabelPosition(
  doX: number,
  formName: string,
  idx: number,
  labelBoxes: { x: number; y: number; w: number }[]
): { labelX: number; labelY: number; labelW: number; labelH: number } {
  const textW = Math.min(100, Math.max(50, formName.length * 7));
  const currentLeft = (doX + DOC_W / 2) - textW / 2;
  const currentRight = (doX + DOC_W / 2) + textW / 2;
  let labelY = -18; // relative offset from doY (will be added by caller)

  if (idx === 1) {
    const prev1 = labelBoxes[0];
    const overlap1 = currentLeft < prev1.x + prev1.w && currentRight > prev1.x;
    labelY = overlap1 ? prev1.y - 15 : prev1.y;
  } else if (idx >= 2) {
    const prev1 = labelBoxes[idx - 1];
    const prev2 = labelBoxes[idx - 2];
    const overlap1 = currentLeft < prev1.x + prev1.w && currentRight > prev1.x;
    const overlap2 = currentLeft < prev2.x + prev2.w && currentRight > prev2.x;
    if (!overlap1) {
      labelY = prev1.y;
    } else if (!overlap2) {
      labelY = prev2.y !== prev1.y ? prev2.y : prev1.y - 15;
    } else {
      labelY = prev1.y - 15;
    }
  }

  return {
    labelX: Math.round(currentLeft),
    labelY, // caller must add doY to this
    labelW: textW,
    labelH: 24,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute collision-free positions for all document shapes associated with
 * form-producing task steps.
 *
 * @param allNodes         All LayoutNodes (steps + link events + annotations)
 * @param nodePositions    Bounding box map from nodePositioner
 * @param allEdgeSegments  All edge segments from edgeRouter
 * @param rowFilter        If set, only place documents for nodes on this row
 * @param rowOffset        Row height + spacing (needed for rowFilter Y adjustment)
 */
export function placeDocuments(
  allNodes: LayoutNode[],
  nodePositions: Map<string, Rect>,
  allEdgeSegments: EdgeSegment[],
  rowFilter?: number,
  rowOffset?: number
): DocumentPlacement[] {
  const placements: DocumentPlacement[] = [];

  allNodes.forEach((node) => {
    if (
      node.type !== 'step' ||
      !node.stepRef?.producesForm ||
      node.bpmnShape !== 'task'
    ) return;

    const fromPos = nodePositions.get(node.id);
    if (!fromPos) return;

    const forms =
      node.stepRef.formNames && node.stepRef.formNames.length > 0
        ? node.stepRef.formNames
        : node.stepRef.formName
        ? [node.stepRef.formName]
        : ['Completed Form'];

    const labelBoxes: { x: number; y: number; w: number }[] = [];

    forms.forEach((formName, idx) => {
      // ── Custom (manual) position: skip collision detection ─────────────
      if (node.stepRef?.formLayouts && node.stepRef.formLayouts[formName]) {
        const fl = node.stepRef.formLayouts[formName];
        let doX = fl.x;
        let doY = fl.y;
        if (rowFilter !== undefined && rowOffset !== undefined) {
          doY -= rowFilter * rowOffset;
        }

        let labelX: number, labelY: number, labelW: number, labelH: number;
        if (fl.labelX !== undefined && fl.labelY !== undefined) {
          labelX = fl.labelX;
          labelY = fl.labelY;
          if (rowFilter !== undefined && rowOffset !== undefined) {
            labelY -= rowFilter * rowOffset;
          }
          labelW = fl.labelW ?? 100;
          labelH = fl.labelH ?? 24;
        } else {
          labelX = doX - 32;
          labelY = doY - 18;
          labelW = 100;
          labelH = 24;
        }

        const fromX = fromPos.x + fromPos.width / 2;
        const fromY = fromPos.y;
        let waypointFrom = { x: Math.round(fromX), y: Math.round(fromY) };
        let waypointTo   = { x: Math.round(doX + DOC_W / 2), y: Math.round(doY + DOC_H) };

        if (fl.waypoints && fl.waypoints.length > 0) {
          const wps = fl.waypoints.map(wp => {
            let yVal = wp.y;
            if (rowFilter !== undefined && rowOffset !== undefined) yVal -= rowFilter * rowOffset;
            return { x: wp.x, y: yVal };
          });
          waypointFrom = wps[0];
          waypointTo   = wps[wps.length - 1];
        }

        placements.push({
          nodeId: node.id, formName, idx,
          x: Math.round(doX), y: Math.round(doY),
          labelX: Math.round(labelX), labelY: Math.round(labelY),
          labelW, labelH,
          waypointFrom, waypointTo,
        });
        return;
      }

      // ── Auto position: try candidates until collision-free ─────────────
      // Default anchor: centered above the task, 60px above the task top
      const baseX = fromPos.x + (fromPos.width / 2) - (DOC_W / 2) + (idx - (forms.length - 1) / 2) * 60;
      const baseY = fromPos.y - 60;

      let chosenX = baseX;
      let chosenY = baseY;

      for (const candidate of CANDIDATE_OFFSETS) {
        const tryX = baseX + candidate.dx;
        const tryY = baseY + candidate.dy;
        if (!hasEdgeCollision(tryX, tryY, allEdgeSegments)) {
          chosenX = tryX;
          chosenY = tryY;
          break;
        }
      }
      // If all candidates collide, fall through to the first candidate (graceful degradation)

      let doY = chosenY;
      if (rowFilter !== undefined && rowOffset !== undefined) {
        doY -= rowFilter * rowOffset;
      }
      const doX = chosenX;

      // Compute label position
      const raw = computeLabelPosition(doX, formName, idx, labelBoxes);
      const labelX = raw.labelX;
      const labelY = doY + raw.labelY; // labelY from helper is relative
      const labelW = raw.labelW;
      const labelH = raw.labelH;

      labelBoxes.push({ x: labelX, y: labelY, w: labelW });

      // Association waypoints: from task top-center to document bottom-center
      const fromX = fromPos.x + fromPos.width / 2;
      const fromY = fromPos.y;
      const doCenterX = doX + DOC_W / 2;
      const doYBottom = doY + DOC_H;

      placements.push({
        nodeId: node.id, formName, idx,
        x: Math.round(doX), y: Math.round(doY),
        labelX: Math.round(labelX), labelY: Math.round(labelY),
        labelW, labelH,
        waypointFrom: { x: Math.round(fromX), y: Math.round(fromY) },
        waypointTo:   { x: Math.round(doCenterX), y: Math.round(doYBottom) },
      });
    });
  });

  return placements;
}
