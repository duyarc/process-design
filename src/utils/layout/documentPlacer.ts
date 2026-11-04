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
 * Resolves human-readable form title from formsData lookup.
 * Falls back to raw formId if not found or empty.
 */
export function getFormDisplayName(formId: string, formsData?: Record<string, any>): string {
  if (!formId) return 'Completed Form';
  if (formsData) {
    const fd = formsData[formId];
    if (fd) {
      const name = fd.formTitle || fd.form_title || fd.title || fd.formName;
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }
    const found = Object.values(formsData).find((f: any) => f && (f.formId === formId || f.form_id === formId || f.id === formId));
    if (found) {
      const name = found.formTitle || found.form_title || found.title || found.formName;
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }
  }
  return formId;
}

/**
 * Truncates overly long form titles for BPMN label to prevent diagram overflow.
 */
export function formatBPMNFormLabel(name: string): string {
  if (name.length > 40) {
    return name.slice(0, 37) + '...';
  }
  return name;
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
  labelW: number,
  labelH: number = 24,
  isTopLane: boolean = false
): PositionCandidate[] {
  const staggerOffset = (idx - (numForms - 1) / 2) * 60;

  const topCand: PositionCandidate = {
    x: tx + tw / 2 - DOC_W / 2 + staggerOffset,
    y: ty - 60,
    labelX: (tx + tw / 2 + staggerOffset) - labelW / 2,
    labelY: ty - 60 - labelH - 2,
    waypointFrom: { x: tx + tw / 2, y: ty },
    waypointTo: { x: tx + tw / 2 + staggerOffset, y: ty - 10 }
  };

  const leftCand: PositionCandidate = {
    x: tx - DOC_W - 24 - idx * 50,
    y: ty + th / 2 - DOC_H / 2,
    labelX: (tx - DOC_W - 24 - idx * 50 + DOC_W / 2) - labelW / 2,
    labelY: ty + th / 2 - DOC_H / 2 - labelH - 2,
    waypointFrom: { x: tx, y: ty + th / 2 },
    waypointTo: { x: tx - 24 - idx * 50, y: ty + th / 2 }
  };

  const rightCand: PositionCandidate = {
    x: tx + tw + 24 + idx * 50,
    y: ty + th / 2 - DOC_H / 2,
    labelX: (tx + tw + 24 + idx * 50 + DOC_W / 2) - labelW / 2,
    labelY: ty + th / 2 - DOC_H / 2 - labelH - 2,
    waypointFrom: { x: tx + tw, y: ty + th / 2 },
    waypointTo: { x: tx + tw + 24 + idx * 50, y: ty + th / 2 }
  };

  const bottomCand: PositionCandidate = {
    x: tx + tw / 2 - DOC_W / 2 + staggerOffset,
    y: ty + th + 40,
    labelX: (tx + tw / 2 + staggerOffset) - labelW / 2,
    labelY: ty + th + 40 - labelH - 2,
    waypointFrom: { x: tx + tw / 2, y: ty + th },
    waypointTo: { x: tx + tw / 2 + staggerOffset, y: ty + th + 40 }
  };

  // For Top Lane (Lane 0): Top is above the pool in the margin -> Top-Center is Priority 1!
  // For other lanes: Left and Right stay 100% inside the swimlane without bleeding into the lane above -> Left/Right first!
  return isTopLane
    ? [topCand, leftCand, rightCand, bottomCand]
    : [leftCand, rightCand, topCand, bottomCand];
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
 * Test whether a document shape placed at (doX, doY) or its label would be intersected
 * by any edge segment in allEdgeSegments.
 */
function hasEdgeCollision(
  doX: number,
  doY: number,
  allEdgeSegments: EdgeSegment[],
  labelX?: number,
  labelY?: number,
  labelW?: number,
  labelH?: number
): boolean {
  for (const seg of allEdgeSegments) {
    if (segmentIntersectsRect(
      seg.x1, seg.y1, seg.x2, seg.y2,
      doX, doY, DOC_W, DOC_H,
      COLLISION_MARGIN
    )) {
      return true;
    }
    if (labelX !== undefined && labelY !== undefined && labelW !== undefined && labelH !== undefined) {
      if (segmentIntersectsRect(
        seg.x1, seg.y1, seg.x2, seg.y2,
        labelX, labelY, labelW, labelH,
        2
      )) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Returns true if a document shape placed at (doX, doY) would overlap
 * with any task node bounding box other than the current step task.
 * Margin is set to 10px to ensure a clean visual spacing.
 */
function hasTaskCollision(
  doX: number,
  doY: number,
  currentNodeId: string,
  nodePositions: Map<string, Rect>
): boolean {
  const margin = 10;
  for (const [nodeId, rect] of nodePositions.entries()) {
    if (nodeId === currentNodeId || rect.shape === 'text-annotation') continue;

    // Check intersection between document rect (DOC_W x DOC_H) and task rect
    const overlapX = doX + DOC_W + margin > rect.x && rect.x + rect.width + margin > doX;
    const overlapY = doY + DOC_H + margin > rect.y && rect.y + rect.height + margin > doY;

    if (overlapX && overlapY) {
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
  rowOffset?: number,
  formsData?: Record<string, any>,
  uniqueRoles?: string[]
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

    // ── Separate manual custom layouts from auto-positioned layouts ──
    const autoForms: { formName: string; idx: number; textW: number; labelH: number }[] = [];

    forms.forEach((formName, idx) => {
      const fullDisplayName = getFormDisplayName(formName, formsData);
      const displayName = formatBPMNFormLabel(fullDisplayName);
      const textW = Math.min(120, Math.max(70, Math.round(displayName.length * 5.8)));
      const defaultLabelH = displayName.length > 15 ? 32 : 24;

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
          labelW = fl.labelW ?? textW;
          labelH = fl.labelH ?? defaultLabelH;
        } else {
          labelW = textW;
          labelH = defaultLabelH;
          labelX = doX + DOC_W / 2 - labelW / 2;
          labelY = doY - labelH - 2;
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
          nodeId: node.id,
          formName,
          idx,
          x: Math.round(doX),
          y: Math.round(doY),
          labelX: Math.round(labelX),
          labelY: Math.round(labelY),
          labelW,
          labelH,
          waypointFrom,
          waypointTo,
        });
      } else {
        autoForms.push({ formName, idx, textW, labelH: defaultLabelH });
      }
    });

    // ── Auto position: try candidates for ALL auto-placed forms of this step ──
    if (autoForms.length > 0) {
      const roleIdx = uniqueRoles ? uniqueRoles.indexOf(node.role) : -1;
      const isTopLane = roleIdx === 0;
      const isBottomLane = uniqueRoles && uniqueRoles.length > 0 ? roleIdx === uniqueRoles.length - 1 : false;

      let chosenCandidateIndex = 0; // default fallback
      const numForms = forms.length;

      for (let cIdx = 0; cIdx < 4; cIdx++) {
        let candidateGroupIsValid = true;
        for (const item of autoForms) {
          const candidates = getCandidates(
            fromPos.x,
            fromPos.y,
            fromPos.width,
            fromPos.height,
            item.idx,
            numForms,
            item.textW,
            item.labelH,
            isTopLane
          );

          const cand = candidates[cIdx];

          // 1. Boundary check: ensure shape & label do not bleed into left lane header (x = 150)
          if (cand.x < 155 || cand.labelX < 155) {
            candidateGroupIsValid = false;
            break;
          }

          // 2. Bottom boundary: if isBottomLane and candidate is placed below the task, strictly forbid
          // to prevent penetrating the bottom page divider line
          if (isBottomLane && cand.y > fromPos.y + fromPos.height) {
            candidateGroupIsValid = false;
            break;
          }

          // 3. Collision with edges or neighboring tasks
          if (
            hasEdgeCollision(cand.x, cand.y, allEdgeSegments, cand.labelX, cand.labelY, item.textW, item.labelH) ||
            hasTaskCollision(cand.x, cand.y, node.id, nodePositions)
          ) {
            candidateGroupIsValid = false;
            break;
          }
        }

        if (candidateGroupIsValid) {
          chosenCandidateIndex = cIdx;
          break;
        }
      }

      autoForms.forEach((item) => {
        const candidates = getCandidates(
          fromPos.x,
          fromPos.y,
          fromPos.width,
          fromPos.height,
          item.idx,
          numForms,
          item.textW,
          item.labelH,
          isTopLane
        );

        const cand = candidates[chosenCandidateIndex];
        placements.push({
          nodeId: node.id,
          formName: item.formName,
          idx: item.idx,
          x: Math.round(cand.x),
          y: Math.round(cand.y),
          labelX: Math.round(cand.labelX),
          labelY: Math.round(cand.labelY),
          labelW: item.textW,
          labelH: item.labelH,
          waypointFrom: { x: Math.round(cand.waypointFrom.x), y: Math.round(cand.waypointFrom.y) },
          waypointMid: cand.waypointMid ? { x: Math.round(cand.waypointMid.x), y: Math.round(cand.waypointMid.y) } : undefined,
          waypointTo: { x: Math.round(cand.waypointTo.x), y: Math.round(cand.waypointTo.y) }
        });
      });
    }
  });

  return placements;
}
