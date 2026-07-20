import type { ProcessStep } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal types used across BPMN auto-layout sub-modules.
// These are NOT exported from bpmnXmlGenerator.ts — they are layout-engine
// implementation details only.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A node in the layout grid — represents a BPMN element that needs to be
 * positioned. Can be a process step, a link throw/catch event (synthesized
 * to connect cross-row flows), or a text annotation (page label).
 */
export interface LayoutNode {
  id: string;
  type: 'step' | 'link-throw' | 'link-catch' | 'text-annotation';
  bpmnShape: string;
  role: string;
  action: string;
  row: number;
  col: number;
  /** Only present when type === 'step' */
  stepRef?: ProcessStep;
  /** Only present when type === 'link-throw' | 'link-catch' */
  linkName?: string;
}

/**
 * A sequence flow after link-event synthesis. May be a direct flow from the
 * original process steps, or a synthetic segment (step → throw, catch → step).
 */
export interface CalculatedFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

/**
 * Bounding box of a BPMN shape in the DI (diagram interchange) canvas.
 * Coordinates follow BPMN DI convention: x/y = top-left corner.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The bpmnShape string of the element (e.g. 'task', 'exclusive-gateway') */
  shape: string;
}

/**
 * A single straight line segment of a sequence flow edge.
 * Derived from consecutive waypoint pairs after edge routing.
 * Used by documentPlacer to detect collisions.
 */
export interface EdgeSegment {
  /** ID of the CalculatedFlow this segment belongs to */
  flowId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * The resolved placement of one DataObjectReference (document shape)
 * associated with a task step.
 */
export interface DocumentPlacement {
  /** The task step node ID */
  nodeId: string;
  /** The formId / form name */
  formName: string;
  /** Index within the step's formNames[] array */
  idx: number;
  /** Top-left corner of the 36×50 document shape */
  x: number;
  y: number;
  /** Label bounding box */
  labelX: number;
  labelY: number;
  labelW: number;
  labelH: number;
  /** Association edge waypoints: task → document */
  waypointFrom: { x: number; y: number };
  waypointTo: { x: number; y: number };
}

/**
 * Layout dimension constants shared across all sub-modules.
 * Centralised here so any tuning propagates everywhere automatically.
 */
export interface LayoutConstants {
  laneHeight: number;      // px height of a single role lane
  rowSpacing: number;      // px gap between page rows
  nodeWidth: number;       // px width of a task box
  nodeHeight: number;      // px height of a task box
  circleSize: number;      // px diameter of event circles
  gatewaySize: number;     // px size of gateway diamonds
  startX: number;          // px x-offset of column 0 from pool left edge
  spacingX: number;        // px horizontal gap between columns
}

/** Default values — used by all sub-modules unless overridden */
export const DEFAULT_LAYOUT_CONSTANTS: LayoutConstants = {
  laneHeight: 160,
  rowSpacing: 80,
  nodeWidth: 110,
  nodeHeight: 80,
  circleSize: 36,
  gatewaySize: 50,
  startX: 220,
  spacingX: 180,
};
