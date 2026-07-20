/**
 * bpmnXmlGenerator.ts — Orchestrator
 *
 * Public API (unchanged — no consumer needs to be updated):
 *   getNumRows(steps)                              → number
 *   generateBPMNXML(steps, title, roles, rowFilter?) → string
 *
 * Internal layout work is delegated to sub-modules in ./layout/:
 *   gridLayout.ts       Module 1 — grid (row/col) assignment
 *   linkEvents.ts       Module 2 — cross-row link event synthesis
 *   nodePositioner.ts   Module 3 — pixel bounding-box computation
 *   edgeRouter.ts       Module 4 — sequence-flow waypoint routing
 *   documentPlacer.ts   Module 5 — document shape placement + collision detection
 */

import type { ProcessStep } from '../types';
import { DEFAULT_LAYOUT_CONSTANTS }    from './layout/types';
import { computeGridLayout, computeNumRows } from './layout/gridLayout';
import { synthesizeLinkEvents }         from './layout/linkEvents';
import { computeNodePositions, computeMaxRightEdge } from './layout/nodePositioner';
import { routeEdges }                   from './layout/edgeRouter';
import { placeDocuments }               from './layout/documentPlacer';

// ─────────────────────────────────────────────────────────────────────────────
// XML helpers
// ─────────────────────────────────────────────────────────────────────────────

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default:  return c;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the number of page rows needed to display all steps. */
export function getNumRows(steps: ProcessStep[]): number {
  return computeNumRows(steps);
}

/**
 * Convert a ProcessStep[] into a valid BPMN 2.0 XML string, ready to be
 * imported by bpmn-js Viewer or Modeler.
 *
 * @param steps        Array of process steps in execution order
 * @param processTitle Pool / collaboration title
 * @param processRoles Ordered list of role lane names
 * @param rowFilter    If set, only render the specified page row (0-indexed)
 */
export function generateBPMNXML(
  steps: ProcessStep[],
  processTitle: string,
  processRoles: string[],
  rowFilter?: number
): string {
  const title = escapeXml(processTitle || 'Process Flow');
  const C = DEFAULT_LAYOUT_CONSTANTS;

  // Resolve unique roles (merge configured roles with roles actually used in steps)
  const uniqueRoles = Array.from(
    new Set([...processRoles, ...steps.map((s) => s.role || 'Operator')])
  ).filter(Boolean);
  if (uniqueRoles.length === 0) uniqueRoles.push('Operator');

  const rowOffset = uniqueRoles.length * C.laneHeight + C.rowSpacing;

  // ── Phase 1: Grid layout ──────────────────────────────────────────────────
  const { layoutNodes, stepRows, numRows, originalFlows } =
    computeGridLayout(steps, uniqueRoles, C);

  // ── Phase 2: Link event synthesis ─────────────────────────────────────────
  const { allNodes, finalFlows } = synthesizeLinkEvents(
    layoutNodes, steps, stepRows, originalFlows
  );

  // ── Phase 3: Node positions ────────────────────────────────────────────────
  // Compute max right edge on the FULL (un-filtered) node set for uniform pool width
  const maxRightEdge = computeMaxRightEdge(allNodes, C);
  const poolWidth = maxRightEdge - 68;

  // Filter nodes and flows for the requested page row (if any)
  let renderNodes = allNodes;
  let renderFlows = finalFlows;
  if (rowFilter !== undefined) {
    renderNodes = allNodes.filter((n) => n.row === rowFilter);
    const renderIds = new Set(renderNodes.map((n) => n.id));
    renderFlows = finalFlows.filter(
      (f) => renderIds.has(f.sourceId) && renderIds.has(f.targetId)
    );
  }

  const { nodePositions, labelPositions } = computeNodePositions(
    renderNodes, uniqueRoles, C, rowFilter
  );

  // ── Phase 4: Edge routing ─────────────────────────────────────────────────
  const { edgeWaypoints, allEdgeSegments } = routeEdges(
    renderFlows, nodePositions, renderNodes, steps, rowFilter, rowOffset
  );

  // ── Phase 5: Document placement (collision-aware) ──────────────────────────
  const docPlacements = placeDocuments(
    renderNodes, nodePositions, allEdgeSegments, rowFilter, rowOffset
  );

  // Index document placements by nodeId+idx for fast lookup during XML render
  const docPlacementMap = new Map<string, typeof docPlacements[0]>();
  docPlacements.forEach((dp) => {
    docPlacementMap.set(`${dp.nodeId}::${dp.idx}`, dp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // XML Rendering
  // ─────────────────────────────────────────────────────────────────────────

  const idSuffix = rowFilter !== undefined ? `_Row_${rowFilter}` : '';
  const totalHeight =
    rowFilter !== undefined
      ? uniqueRoles.length * C.laneHeight
      : numRows > 1
      ? numRows * uniqueRoles.length * C.laneHeight + (numRows - 1) * C.rowSpacing
      : uniqueRoles.length * C.laneHeight;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                  id="Definitions_01${idSuffix}" 
                  targetNamespace="http://bpmn.io/schema/bpmn" 
                  exporter="ProcessPortal" 
                  exporterVersion="1.0">
  <bpmn:collaboration id="Collaboration_1${idSuffix}">
    <bpmn:participant id="Participant_1${idSuffix}" name="${title}" processRef="Process_1${idSuffix}" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1${idSuffix}" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1${idSuffix}">`;

  // 1. Lane definitions
  const renderRowSet = rowFilter !== undefined
    ? [rowFilter]
    : Array.from({ length: numRows }, (_, i) => i);

  for (const r of renderRowSet) {
    uniqueRoles.forEach((role, idx) => {
      const roleId = `Lane_Role_${idx}_Row_${r}`;
      const escapedRoleName = escapeXml(role);
      xml += `
      <bpmn:lane id="${roleId}" name="${escapedRoleName}">`;

      renderNodes.forEach((node) => {
        if (
          node.type !== 'text-annotation' &&
          node.row === r &&
          node.role === role
        ) {
          xml += `
        <bpmn:flowNodeRef>${node.id}</bpmn:flowNodeRef>`;
        }
      });
      xml += `
      </bpmn:lane>`;
    });
  }

  xml += `
    </bpmn:laneSet>`;

  // 2. Flow nodes and text annotations
  renderNodes.forEach((node) => {
    if (node.type === 'text-annotation') {
      xml += `
    <bpmn:textAnnotation id="${node.id}">
      <bpmn:text>${escapeXml(node.action)}</bpmn:text>
    </bpmn:textAnnotation>`;
      return;
    }

    const shape = node.bpmnShape;
    const escapedAction = escapeXml(node.action);
    const myOutgoing = renderFlows.filter((f) => f.sourceId === node.id);
    const myIncoming = renderFlows.filter((f) => f.targetId === node.id);

    const incomingStr = myIncoming.map((f) => `\n    <bpmn:incoming>${f.id}</bpmn:incoming>`).join('');
    const outgoingStr = myOutgoing.map((f) => `\n    <bpmn:outgoing>${f.id}</bpmn:outgoing>`).join('');

    if (node.type === 'link-throw') {
      xml += `
    <bpmn:intermediateThrowEvent id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
      <bpmn:linkEventDefinition id="LinkEventDef_Throw_${node.id}" name="${escapeXml(node.linkName || '')}" />
    </bpmn:intermediateThrowEvent>`;
    } else if (node.type === 'link-catch') {
      xml += `
    <bpmn:intermediateCatchEvent id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
      <bpmn:linkEventDefinition id="LinkEventDef_Catch_${node.id}" name="${escapeXml(node.linkName || '')}" />
    </bpmn:intermediateCatchEvent>`;
    } else if (shape === 'start-event') {
      xml += `
    <bpmn:startEvent id="${node.id}" name="${escapedAction}">${outgoingStr}
    </bpmn:startEvent>`;
    } else if (shape === 'end-event') {
      xml += `
    <bpmn:endEvent id="${node.id}" name="${escapedAction}">${incomingStr}
    </bpmn:endEvent>`;
    } else if (shape === 'message-end-event') {
      xml += `
    <bpmn:endEvent id="${node.id}" name="${escapedAction}">${incomingStr}
      <bpmn:messageEventDefinition id="MessageEventDef_${node.id}" />
    </bpmn:endEvent>`;
    } else if (shape === 'intermediate-event') {
      xml += `
    <bpmn:intermediateEvent id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
    </bpmn:intermediateEvent>`;
    } else if (shape === 'exclusive-gateway') {
      xml += `
    <bpmn:exclusiveGateway id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
    </bpmn:exclusiveGateway>`;
    } else if (shape === 'parallel-gateway') {
      xml += `
    <bpmn:parallelGateway id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
    </bpmn:parallelGateway>`;
    } else if (shape === 'user-task') {
      xml += `
    <bpmn:userTask id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
    </bpmn:userTask>`;
    } else if (shape === 'service-task') {
      xml += `
    <bpmn:serviceTask id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
    </bpmn:serviceTask>`;
    } else {
      xml += `
    <bpmn:task id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}
    </bpmn:task>`;
    }
  });

  // 2.5 Data objects and associations
  renderNodes.forEach((node) => {
    if (
      node.type !== 'step' ||
      !node.stepRef?.producesForm ||
      node.bpmnShape !== 'task'
    ) return;

    const forms =
      node.stepRef.formNames && node.stepRef.formNames.length > 0
        ? node.stepRef.formNames
        : node.stepRef.formName
        ? [node.stepRef.formName]
        : ['Completed Form'];

    forms.forEach((formName, idx) => {
      const escapedFormName = escapeXml(formName);
      xml += `
    <bpmn:dataObjectReference id="DataObjectRef_${node.id}_${idx}" name="${escapedFormName}" dataObjectRef="DataObject_${node.id}_${idx}" />
    <bpmn:dataObject id="DataObject_${node.id}_${idx}" />
    <bpmn:association id="DataOutputAssoc_${node.id}_${idx}" sourceRef="${node.id}" targetRef="DataObjectRef_${node.id}_${idx}" />`;
    });
  });

  // 3. Sequence flows
  renderFlows.forEach((flow) => {
    const nameAttr = flow.label ? ` name="${escapeXml(flow.label)}"` : '';
    xml += `
    <bpmn:sequenceFlow id="${flow.id}" sourceRef="${flow.sourceId}" targetRef="${flow.targetId}"${nameAttr} />`;
  });

  xml += `
  </bpmn:process>
  
  <bpmndi:BPMNDiagram id="BPMNDiagram_1${idSuffix}">
    <bpmndi:BPMNPlane id="BPMNPlane_1${idSuffix}" bpmnElement="Collaboration_1${idSuffix}">
      <!-- Participant Pool -->
      <bpmndi:BPMNShape id="Participant_1${idSuffix}_di" bpmnElement="Participant_1${idSuffix}" isHorizontal="true">
        <dc:Bounds x="120" y="0" width="${poolWidth}" height="${totalHeight}" />
      </bpmndi:BPMNShape>`;

  // 4. Lane shapes DI
  for (const r of renderRowSet) {
    uniqueRoles.forEach((_, idx) => {
      const roleId = `Lane_Role_${idx}_Row_${r}`;
      let yStart = r * rowOffset + idx * C.laneHeight;
      if (rowFilter !== undefined) yStart -= rowFilter * rowOffset;
      xml += `
      <bpmndi:BPMNShape id="${roleId}_di" bpmnElement="${roleId}" isHorizontal="true">
        <dc:Bounds x="150" y="${yStart}" width="${poolWidth - 30}" height="${C.laneHeight}" />
      </bpmndi:BPMNShape>`;
    });
  }

  // 5. Node shapes DI
  renderNodes.forEach((node) => {
    const pos = nodePositions.get(node.id);
    const lbl = labelPositions.get(node.id);
    if (!pos || !lbl) return;

    const { x, y, width: w, height: h } = pos;

    if (node.type === 'text-annotation') {
      xml += `
      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}">
        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
      </bpmndi:BPMNShape>`;
      return;
    }

    xml += `
      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}">
        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${lbl.x}" y="${lbl.y}" width="${lbl.w}" height="${lbl.h}" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`;

    // Document shapes DI (from docPlacements)
    if (
      node.type === 'step' &&
      node.stepRef?.producesForm &&
      node.bpmnShape === 'task'
    ) {
      const forms =
        node.stepRef.formNames && node.stepRef.formNames.length > 0
          ? node.stepRef.formNames
          : node.stepRef.formName
          ? [node.stepRef.formName]
          : ['Completed Form'];

      forms.forEach((_, idx) => {
        const dp = docPlacementMap.get(`${node.id}::${idx}`);
        if (!dp) return;
        xml += `
      <bpmndi:BPMNShape id="DataObjectRef_${node.id}_${idx}_di" bpmnElement="DataObjectRef_${node.id}_${idx}">
        <dc:Bounds x="${dp.x}" y="${dp.y}" width="36" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${dp.labelX}" y="${dp.labelY}" width="${dp.labelW}" height="${dp.labelH}" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`;
      });
    }
  });

  // 6. Edge shapes DI
  renderFlows.forEach((flow) => {
    const waypoints = edgeWaypoints.get(flow.id);
    if (!waypoints || waypoints.length < 2) return;

    xml += `
      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">`;
    waypoints.forEach((wp) => {
      xml += `
        <di:waypoint x="${wp.x}" y="${wp.y}" />`;
    });

    // Edge label (for gateway branch labels Y/N)
    if (flow.label && waypoints.length >= 2) {
      const p0 = waypoints[0];
      const p1 = waypoints[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const L = Math.sqrt(dx * dx + dy * dy);
      if (L > 0) {
        const ux = dx / L, uy = dy / L;
        const px = uy, py = -ux;
        const cx = Math.round(p0.x + 18 * ux + 12 * px);
        const cy = Math.round(p0.y + 18 * uy + 12 * py);
        const W = Math.max(20, flow.label.length * 8);
        const H = 14;
        xml += `
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${cx - Math.round(W / 2)}" y="${cy - Math.round(H / 2)}" width="${W}" height="${H}" />
        </bpmndi:BPMNLabel>`;
      }
    }

    xml += `
      </bpmndi:BPMNEdge>`;
  });

  // 7. Data association edges DI
  renderNodes.forEach((node) => {
    if (
      node.type !== 'step' ||
      !node.stepRef?.producesForm ||
      node.bpmnShape !== 'task'
    ) return;

    const forms =
      node.stepRef.formNames && node.stepRef.formNames.length > 0
        ? node.stepRef.formNames
        : node.stepRef.formName
        ? [node.stepRef.formName]
        : ['Completed Form'];

    forms.forEach((_, idx) => {
      const dp = docPlacementMap.get(`${node.id}::${idx}`);
      if (!dp) return;
      xml += `
      <bpmndi:BPMNEdge id="DataOutputAssoc_${node.id}_${idx}_di" bpmnElement="DataOutputAssoc_${node.id}_${idx}">
        <di:waypoint x="${dp.waypointFrom.x}" y="${dp.waypointFrom.y}" />
        ${dp.waypointMid ? `<di:waypoint x="${dp.waypointMid.x}" y="${dp.waypointMid.y}" />` : ''}
        <di:waypoint x="${dp.waypointTo.x}" y="${dp.waypointTo.y}" />
      </bpmndi:BPMNEdge>`;
    });
  });

  xml += `
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  return xml;
}
