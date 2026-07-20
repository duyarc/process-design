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

interface PositionCandidate {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  waypointFrom: { x: number; y: number };
  waypointMid?: { x: number; y: number };
  waypointTo: { x: number; y: number };
}

/**
 * Generate candidate positions and associated routing details relative to the
 * task node bounds (tx, ty, tw, th).
 */
function getCandidates(
  tx: number,
  ty: number,
  tw: number,
  th: number,
  idx: number,
  numForms: number,
  labelW: number
): PositionCandidate[] {
  const staggerOffset = (idx - (numForms - 1) / 2) * 60;

  return [
    // Candidate 1: Middle-Right (Default)
    // Document center Y aligned horizontally with task center Y.
    // Connector goes from middle-right of task to middle-left of document.
    {
      x: tx + tw + 24 + idx * 50,
      y: ty + th / 2 - DOC_H / 2,
      labelX: (tx + tw + 24 + idx * 50 + DOC_W / 2) - labelW / 2,
      labelY: ty + th / 2 - DOC_H / 2 - 18,
      waypointFrom: { x: tx + tw, y: ty + th / 2 },
      waypointTo: { x: tx + tw + 24 + idx * 50, y: ty + th / 2 }
    },
    // Candidate 2: Top-Center (Original position fallback)
    // Connector goes from top-center of task to bottom-center of document.
    {
      x: tx + tw / 2 - DOC_W / 2 + staggerOffset,
      y: ty - 60,
      labelX: (tx + tw / 2 + staggerOffset) - labelW / 2,
      labelY: ty - 60 - 18,
      waypointFrom: { x: tx + tw / 2, y: ty },
      waypointTo: { x: tx + tw / 2 + staggerOffset, y: ty - 10 }
    },
    // Candidate 3: Below-Center
    // Connector goes from bottom-center of task to top-center of document.
    {
      x: tx + tw / 2 - DOC_W / 2 + staggerOffset,
      y: ty + th + 40,
      labelX: (tx + tw / 2 + staggerOffset) - labelW / 2,
      labelY: ty + th + 40 - 18,
      waypointFrom: { x: tx + tw / 2, y: ty + th },
      waypointTo: { x: tx + tw / 2 + staggerOffset, y: ty + th + 40 }
    },
    // Candidate 4: Middle-Left
    // Connector goes from middle-left of task to middle-right of document.
    {
      x: tx - DOC_W - 24 - idx * 50,
      y: ty + th / 2 - DOC_H / 2,
      labelX: (tx - DOC_W - 24 - idx * 50 + DOC_W / 2) - labelW / 2,
      labelY: ty + th / 2 - DOC_H / 2 - 18,
      waypointFrom: { x: tx, y: ty + th / 2 },
      waypointTo: { x: tx - 24 - idx * 50, y: ty + th / 2 }
    }
  ];
}


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

// computeLabelPosition was refactored inline into getCandidates.

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
      const textW = Math.min(100, Math.max(50, formName.length * 7));
      const candidates = getCandidates(
        fromPos.x,
        fromPos.y,
        fromPos.width,
        fromPos.height,
        idx,
        forms.length,
        textW
      );

      // Default candidate fallback is candidate 0 (Middle-Right)
      let chosenCandidate = candidates[0];

      for (const cand of candidates) {
        if (!hasEdgeCollision(cand.x, cand.y, allEdgeSegments)) {
          chosenCandidate = cand;
          break;
        }
      }

      let doY = chosenCandidate.y;
      let labelY = chosenCandidate.labelY;
      let wFrom = chosenCandidate.waypointFrom;
      let wMid = chosenCandidate.waypointMid;
      let wTo = chosenCandidate.waypointTo;

      if (rowFilter !== undefined && rowOffset !== undefined) {
        doY -= rowFilter * rowOffset;
        labelY -= rowFilter * rowOffset;
        wFrom = { x: wFrom.x, y: wFrom.y - rowFilter * rowOffset };
        if (wMid) {
          wMid = { x: wMid.x, y: wMid.y - rowFilter * rowOffset };
        }
        wTo = { x: wTo.x, y: wTo.y - rowFilter * rowOffset };
      }

      labelBoxes.push({ x: chosenCandidate.labelX, y: labelY, w: textW });

      placements.push({
        nodeId: node.id,
        formName,
        idx,
        x: Math.round(chosenCandidate.x),
        y: Math.round(doY),
        labelX: Math.round(chosenCandidate.labelX),
        labelY: Math.round(labelY),
        labelW: textW,
        labelH: 24,
        waypointFrom: { x: Math.round(wFrom.x), y: Math.round(wFrom.y) },
        waypointMid: wMid ? { x: Math.round(wMid.x), y: Math.round(wMid.y) } : undefined,
        waypointTo: { x: Math.round(wTo.x), y: Math.round(wTo.y) }
      });
    });
  });

  return placements;
}
