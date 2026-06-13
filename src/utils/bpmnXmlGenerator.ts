import type { ProcessStep } from '../types';

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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

export function getNumRows(steps: ProcessStep[]): number {
  if (steps.length === 0) return 1;
  const stepRows: number[] = [];
  const stepCols: number[] = [];
  const lastColInRow: { [row: number]: { [role: string]: number } } = {};

  steps.forEach((step, idx) => {
    const role = step.role || 'Operator';
    if (idx === 0) {
      stepRows.push(0);
      stepCols.push(0);
      lastColInRow[0] = { [role]: 0 };
      return;
    }

    const prevRow = stepRows[idx - 1];
    const prevRole = steps[idx - 1].role || 'Operator';
    const prevCol = stepCols[idx - 1];
    let col: number;
    if (role === prevRole) {
      const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
      col = Math.max(prevCol + 1, lastColForRole + 1);
    } else {
      const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
      col = Math.max(prevCol, lastColForRole + 1);
    }

    if (col >= 6) {
      const newRow = prevRow + 1;
      stepRows.push(newRow);
      stepCols.push(1);
      if (!lastColInRow[newRow]) {
        lastColInRow[newRow] = {};
      }
      lastColInRow[newRow][role] = 1;
    } else {
      stepRows.push(prevRow);
      stepCols.push(col);
      if (!lastColInRow[prevRow]) {
        lastColInRow[prevRow] = {};
      }
      lastColInRow[prevRow][role] = col;
    }
  });

  return Math.max(...stepRows) + 1;
}

export function generateBPMNXML(
  steps: ProcessStep[],
  processTitle: string,
  processRoles: string[],
  rowFilter?: number
): string {
  const title = escapeXml(processTitle || 'Process Flow');
  
  // Find unique roles actually present in the steps, merged with configured roles
  const uniqueRoles = Array.from(new Set([
    ...processRoles,
    ...steps.map(s => s.role || 'Operator')
  ])).filter(Boolean);

  if (uniqueRoles.length === 0) {
    uniqueRoles.push('Operator');
  }

  // -------------------------------------------------------------
  // AUTOMATIC WRAPPING LAYOUT LOGIC (With Link Event Off-Page Connectors)
  // -------------------------------------------------------------
    const stepRows: number[] = [];
    const stepCols: number[] = [];
    const lastColInRow: { [row: number]: { [role: string]: number } } = {};

    steps.forEach((step, idx) => {
      const role = step.role || 'Operator';
      if (idx === 0) {
        stepRows.push(0);
        stepCols.push(0);
        lastColInRow[0] = { [role]: 0 };
        return;
      }

      const prevRow = stepRows[idx - 1];
      const prevRole = steps[idx - 1].role || 'Operator';
      const prevCol = stepCols[idx - 1];
      let col: number;
      if (role === prevRole) {
        const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
        col = Math.max(prevCol + 1, lastColForRole + 1);
      } else {
        const lastColForRole = lastColInRow[prevRow]?.[role] ?? -1;
        col = Math.max(prevCol, lastColForRole + 1);
      }

      if (col >= 6) {
        // Wrap to the next row
        const newRow = prevRow + 1;
        stepRows.push(newRow);
        stepCols.push(1); // column 0 is reserved for the Catch Link Event
        if (!lastColInRow[newRow]) {
          lastColInRow[newRow] = {};
        }
        lastColInRow[newRow][role] = 1;
      } else {
        stepRows.push(prevRow);
        stepCols.push(col);
        if (!lastColInRow[prevRow]) {
          lastColInRow[prevRow] = {};
        }
        lastColInRow[prevRow][role] = col;
      }
    });

    const numRows = steps.length > 0 ? Math.max(...stepRows) + 1 : 1;

    // Dimensions
    const laneHeight = 160;
    const rowSpacing = 80;
    const rowHeight = uniqueRoles.length * laneHeight;
    const rowOffset = rowHeight + rowSpacing;
    
    const nodeWidth = 110;
    const nodeHeight = 80;
    const circleSize = 36;
    const gatewaySize = 50;
    
    const startX = 220;
    const spacingX = 180;
    const totalHeight = rowFilter !== undefined ? rowHeight : (numRows > 1 ? numRows * rowHeight + (numRows - 1) * rowSpacing : rowHeight);

    // Define Layout Node and Flow interfaces
    interface LayoutNode {
      id: string;
      type: 'step' | 'link-throw' | 'link-catch' | 'text-annotation';
      bpmnShape: string;
      role: string;
      action: string;
      row: number;
      col: number;
      stepRef?: ProcessStep;
      linkName?: string;
    }

    let layoutNodes: LayoutNode[] = steps.map((step, idx) => ({
      id: step.id,
      type: 'step',
      bpmnShape: step.bpmnShape || 'task',
      role: step.role || 'Operator',
      action: step.action || `Step ${idx + 1}`,
      row: stepRows[idx],
      col: stepCols[idx],
      stepRef: step
    }));

    // Add visual Page text annotations
    for (let r = 0; r < numRows; r++) {
      layoutNodes.push({
        id: `TextAnnotation_Row_${r}`,
        type: 'text-annotation',
        bpmnShape: 'text-annotation',
        role: uniqueRoles[0],
        action: `Page ${r + 1}`,
        row: r,
        col: 0
      });
    }



    interface CalculatedFlow {
      id: string;
      sourceId: string;
      targetId: string;
      label?: string;
    }

    const originalFlows: CalculatedFlow[] = [];
    steps.forEach((step, idx) => {
      if (step.bpmnShape === 'exclusive-gateway') {
        const yesTargetId = step.branchYesTargetId || (idx < steps.length - 1 ? steps[idx + 1].id : null);
        if (yesTargetId) {
          originalFlows.push({
            id: `Flow_${step.id}_yes`,
            sourceId: step.id,
            targetId: yesTargetId,
            label: step.branchYesLabel || 'Y'
          });
        }
        const noTargetId = step.branchNoTargetId || (idx < steps.length - 1 ? steps[idx + 1].id : null);
        if (noTargetId) {
          originalFlows.push({
            id: `Flow_${step.id}_no`,
            sourceId: step.id,
            targetId: noTargetId,
            label: step.branchNoLabel || 'N'
          });
        }
      } else {
        if (step.bpmnShape !== 'end-event' && step.bpmnShape !== 'message-end-event') {
          const targetId = step.nextStepId || (idx < steps.length - 1 ? steps[idx + 1].id : null);
          if (targetId) {
            originalFlows.push({
              id: `Flow_${step.id}_${targetId}`,
              sourceId: step.id,
              targetId: targetId
            });
          }
        }
      }
    });

    let finalFlows: CalculatedFlow[] = [];
    let linkCounter = 0;

    originalFlows.forEach((flow) => {
      const sourceIdx = steps.findIndex(s => s.id === flow.sourceId);
      const targetIdx = steps.findIndex(s => s.id === flow.targetId);

      if (sourceIdx === -1 || targetIdx === -1) {
        finalFlows.push(flow);
        return;
      }

      const rowA = stepRows[sourceIdx];
      const rowB = stepRows[targetIdx];

      if (rowA === rowB) {
        finalFlows.push(flow);
      } else if (rowA < rowB) {
        // Synthesize a link throw and catch pair
        linkCounter++;
        const linkName = getLinkLabel(linkCounter);
        
        const throwId = `LinkThrow_${flow.sourceId}_to_${flow.targetId}`;
        const catchId = `LinkCatch_${flow.sourceId}_to_${flow.targetId}`;

        // Throw Event is placed at column 6 of rowA
        layoutNodes.push({
          id: throwId,
          type: 'link-throw',
          bpmnShape: 'intermediate-throw-event',
          role: steps[targetIdx].role || 'Operator',
          action: linkName,
          row: rowA,
          col: 6,
          linkName: linkName
        });

        // Catch Event is placed at column 0 of rowB in the target step's role/lane
        layoutNodes.push({
          id: catchId,
          type: 'link-catch',
          bpmnShape: 'intermediate-catch-event',
          role: steps[targetIdx].role || 'Operator',
          action: linkName,
          row: rowB,
          col: 0,
          linkName: linkName
        });

        // Split flows
        finalFlows.push({
          id: `${flow.id}_to_throw`,
          sourceId: flow.sourceId,
          targetId: throwId,
          label: flow.label
        });

        finalFlows.push({
          id: `Flow_catch_to_${flow.targetId}`,
          sourceId: catchId,
          targetId: flow.targetId
        });
      } else {
        // Loop backward across rows (rowA > rowB): keep the physical flow line as is
        finalFlows.push(flow);
      }
    });

    // Calculate global maxRightEdge before filtering nodes by rowFilter to ensure all rows have uniform pool width and zoom scale
    let maxRightEdge = 0;
    layoutNodes.forEach(node => {
      if (node.type !== 'text-annotation') {
        let rightEdge = 0;
        if (node.type === 'step' && node.stepRef?.layoutX !== undefined) {
          let w = nodeWidth;
          if (node.bpmnShape.includes('event')) {
            w = circleSize;
          } else if (node.bpmnShape.includes('gateway')) {
            w = gatewaySize;
          }
          rightEdge = node.stepRef.layoutX + w;
        } else {
          const xCenter = startX + node.col * spacingX;
          let w = nodeWidth;
          if (node.bpmnShape.includes('event')) {
            w = circleSize;
          } else if (node.bpmnShape.includes('gateway')) {
            w = gatewaySize;
          }
          rightEdge = xCenter + w / 2;
        }
        if (rightEdge > maxRightEdge) {
          maxRightEdge = rightEdge;
        }
      }
    });

    if (rowFilter !== undefined) {
      layoutNodes = layoutNodes.filter(n => n.row === rowFilter);
      const nodeIds = new Set(layoutNodes.map(n => n.id));
      finalFlows = finalFlows.filter(f => nodeIds.has(f.sourceId) && nodeIds.has(f.targetId));
    }

    const idSuffix = rowFilter !== undefined ? `_Row_${rowFilter}` : '';
    const poolWidth = maxRightEdge - 68;

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

    // 1. Generate Lanes for each Row
    for (let r = 0; r < numRows; r++) {
      if (rowFilter !== undefined && r !== rowFilter) continue;
      uniqueRoles.forEach((role, idx) => {
        const roleId = `Lane_Role_${idx}_Row_${r}`;
        const escapedRoleName = escapeXml(role);
        xml += `
      <bpmn:lane id="${roleId}" name="${escapedRoleName}">`;

        layoutNodes.forEach(node => {
          if (node.type !== 'text-annotation' && node.row === r && node.role === role) {
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

    // 2. Generate Flow Nodes and Text Annotations
    layoutNodes.forEach((node) => {
      if (node.type === 'text-annotation') {
        const escapedText = escapeXml(node.action);
        xml += `
    <bpmn:textAnnotation id="${node.id}">
      <bpmn:text>${escapedText}</bpmn:text>
    </bpmn:textAnnotation>`;
        return;
      }

      const shape = node.bpmnShape;
      const escapedAction = escapeXml(node.action);

      const myOutgoing = finalFlows.filter(f => f.sourceId === node.id);
      const myIncoming = finalFlows.filter(f => f.targetId === node.id);

      let incomingStr = '';
      myIncoming.forEach(flow => {
        incomingStr += `\n    <bpmn:incoming>${flow.id}</bpmn:incoming>`;
      });

      let outgoingStr = '';
      myOutgoing.forEach(flow => {
        outgoingStr += `\n    <bpmn:outgoing>${flow.id}</bpmn:outgoing>`;
      });

      let associationStr = '';
      if (node.type === 'step' && node.stepRef?.producesForm && shape === 'task') {
        associationStr = `
      <bpmn:dataOutputAssociation id="DataOutputAssoc_${node.id}">
        <bpmn:targetRef>DataObjectRef_${node.id}</bpmn:targetRef>
      </bpmn:dataOutputAssociation>`;
      }

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
    <bpmn:userTask id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}${associationStr}
    </bpmn:userTask>`;
      } else if (shape === 'service-task') {
        xml += `
    <bpmn:serviceTask id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}${associationStr}
    </bpmn:serviceTask>`;
      } else {
        xml += `
    <bpmn:task id="${node.id}" name="${escapedAction}">${incomingStr}${outgoingStr}${associationStr}
    </bpmn:task>`;
      }
    });

    // 2.5 Generate Data Objects
    layoutNodes.forEach(node => {
      if (node.type === 'step' && node.stepRef?.producesForm && node.bpmnShape === 'task') {
        const formName = node.stepRef.formName || 'Completed Form';
        const escapedFormName = escapeXml(formName);
        xml += `
    <bpmn:dataObjectReference id="DataObjectRef_${node.id}" name="${escapedFormName}" dataObjectRef="DataObject_${node.id}" />
    <bpmn:dataObject id="DataObject_${node.id}" />`;
      }
    });

    // 3. Generate Sequence Flows
    finalFlows.forEach(flow => {
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

    // 4. Generate Lane Shapes DI
    for (let r = 0; r < numRows; r++) {
      if (rowFilter !== undefined && r !== rowFilter) continue;
      uniqueRoles.forEach((_, idx) => {
        const roleId = `Lane_Role_${idx}_Row_${r}`;
        let yStart = r * rowOffset + idx * laneHeight;
        if (rowFilter !== undefined) {
          yStart -= rowFilter * rowOffset;
        }
        xml += `
      <bpmndi:BPMNShape id="${roleId}_di" bpmnElement="${roleId}" isHorizontal="true">
        <dc:Bounds x="150" y="${yStart}" width="${poolWidth - 30}" height="${laneHeight}" />
      </bpmndi:BPMNShape>`;
      });
    }

    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number; shape: string }>();

    // Group count tracking to prevent overlap for link events
    const groupCounts: { [key: string]: number } = {};
    const groupIndices: { [key: string]: number } = {};

    layoutNodes.forEach(node => {
      if (node.type !== 'text-annotation') {
        const key = `${node.row}_${node.role}_${node.col}`;
        groupCounts[key] = (groupCounts[key] || 0) + 1;
      }
    });

    // 5. Generate Node Shapes DI
    layoutNodes.forEach((node) => {
      if (node.type === 'text-annotation') {
        let yRaw = node.row * rowOffset + 10;
        if (rowFilter !== undefined) {
          yRaw -= rowFilter * rowOffset;
        }
        const y = Math.round(yRaw);
        const x = 170;
        const w = 100;
        const h = 30;
        nodePositions.set(node.id, { x, y, width: w, height: h, shape: 'text-annotation' });
        xml += `
      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}">
        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
      </bpmndi:BPMNShape>`;
        return;
      }

      const shape = node.bpmnShape;
      const rIdx = Math.max(0, uniqueRoles.indexOf(node.role));

      // Calculate vertical offset in case of multiple shapes in same lane & col
      const key = `${node.row}_${node.role}_${node.col}`;
      const N = groupCounts[key] || 1;
      if (groupIndices[key] === undefined) {
        groupIndices[key] = 0;
      }
      const nodeSubIdx = groupIndices[key];
      groupIndices[key]++;

      let offsetY = 0;
      if (N > 1) {
        offsetY = Math.round((nodeSubIdx - (N - 1) / 2) * 45);
      }

      let yCenter = node.row * rowOffset + rIdx * laneHeight + laneHeight / 2 + offsetY;
      if (rowFilter !== undefined) {
        yCenter -= rowFilter * rowOffset;
      }
      const xCenter = startX + node.col * spacingX;

      let x: number;
      let y: number;
      let w: number;
      let h: number;

      if (shape.includes('event')) {
        w = circleSize;
        h = circleSize;
        x = Math.round((node.type === 'step' && node.stepRef?.layoutX !== undefined) ? node.stepRef.layoutX : xCenter - circleSize / 2);
        let yRaw = (node.type === 'step' && node.stepRef?.layoutY !== undefined) ? node.stepRef.layoutY : yCenter - circleSize / 2;
        if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.layoutY !== undefined) {
          yRaw -= rowFilter * rowOffset;
        }
        y = Math.round(yRaw);
      } else if (shape.includes('gateway')) {
        w = gatewaySize;
        h = gatewaySize;
        x = Math.round((node.type === 'step' && node.stepRef?.layoutX !== undefined) ? node.stepRef.layoutX : xCenter - gatewaySize / 2);
        let yRaw = (node.type === 'step' && node.stepRef?.layoutY !== undefined) ? node.stepRef.layoutY : yCenter - gatewaySize / 2;
        if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.layoutY !== undefined) {
          yRaw -= rowFilter * rowOffset;
        }
        y = Math.round(yRaw);
      } else {
        w = nodeWidth;
        h = nodeHeight;
        x = Math.round((node.type === 'step' && node.stepRef?.layoutX !== undefined) ? node.stepRef.layoutX : xCenter - nodeWidth / 2);
        let yRaw = (node.type === 'step' && node.stepRef?.layoutY !== undefined) ? node.stepRef.layoutY : yCenter - nodeHeight / 2;
        if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.layoutY !== undefined) {
          yRaw -= rowFilter * rowOffset;
        }
        y = Math.round(yRaw);
      }

      nodePositions.set(node.id, { x, y, width: w, height: h, shape });

      const labelXVal = Math.round((node.type === 'step' && node.stepRef?.labelX !== undefined) ? node.stepRef.labelX : x - 20);
      let labelYRaw = (node.type === 'step' && node.stepRef?.labelY !== undefined) ? node.stepRef.labelY : (shape.includes('task') ? y + 25 : y + h + 8);
      if (rowFilter !== undefined && node.type === 'step' && node.stepRef?.labelY !== undefined) {
        labelYRaw -= rowFilter * rowOffset;
      }
      const labelYVal = Math.round(labelYRaw);
      const labelWVal = Math.round((node.type === 'step' && node.stepRef?.labelW !== undefined) ? node.stepRef.labelW : w + 40);
      const labelHVal = Math.round((node.type === 'step' && node.stepRef?.labelH !== undefined) ? node.stepRef.labelH : 14);

      xml += `
      <bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}">
        <dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${labelXVal}" y="${labelYVal}" width="${labelWVal}" height="${labelHVal}" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`;

      if (node.type === 'step' && node.stepRef?.producesForm && shape === 'task') {
        const doX = x + w - 18;
        const doY = y - 60;
        xml += `
      <bpmndi:BPMNShape id="DataObjectRef_${node.id}_di" bpmnElement="DataObjectRef_${node.id}">
        <dc:Bounds x="${doX}" y="${doY}" width="36" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${doX - 32}" y="${doY - 35}" width="100" height="30" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>`;
      }
    });

    // 6. Generate Edge DI
    finalFlows.forEach(flow => {
      const fromPos = nodePositions.get(flow.sourceId);
      const toPos = nodePositions.get(flow.targetId);

      if (!fromPos || !toPos) return;

      const startX = Math.round(fromPos.x + fromPos.width);
      const startY = Math.round(fromPos.y + fromPos.height / 2);

      const endX = Math.round(toPos.x);
      const endY = Math.round(toPos.y + toPos.height / 2);

      xml += `
      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">`;

      let edgeWaypoints: { x: number; y: number }[] = [];
      let customWaypoints: { x: number; y: number }[] | undefined = undefined;
      if (flow.sourceId.startsWith('LinkCatch_')) {
        const targetStep = steps.find(s => s.id === flow.targetId);
        customWaypoints = targetStep?.layoutCatchWaypoints;
      } else {
        const sourceStep = steps.find(s => s.id === flow.sourceId);
        customWaypoints = sourceStep?.layoutWaypointsMap?.[flow.targetId];
      }

      if (customWaypoints && customWaypoints.length >= 2) {
        edgeWaypoints = customWaypoints.map(wp => {
          let yVal = wp.y;
          if (rowFilter !== undefined) {
            yVal -= rowFilter * rowOffset;
          }
          return { x: Math.round(wp.x), y: Math.round(yVal) };
        });
      } else {
        const fromNode = layoutNodes.find(n => n.id === flow.sourceId);
        const toNode = layoutNodes.find(n => n.id === flow.targetId);
        const fromCenterX = fromPos.x + fromPos.width / 2;
        const toCenterX = toPos.x + toPos.width / 2;

        if (flow.id.includes('throw')) {
          console.log('DEBUG Flow:', flow.id);
          console.log('fromPos.x + fromPos.width:', fromPos.x + fromPos.width);
          console.log('toPos.x:', toPos.x);
          console.log('Evaluation:', fromPos.x + fromPos.width <= toPos.x);
        }

        if (fromNode && toNode && toNode.row < fromNode.row) {
          // Loop backward across pages!
          const p1_x = startX + 20;
          const p1_y = startY;
          const p2_x = p1_x;
          const p2_y = Math.max(fromPos.y + fromPos.height + 40, toPos.y + toPos.height + 40);
          const p3_x = endX - 20;
          const p3_y = p2_y;
          const p4_x = p3_x;
          const p4_y = endY;

          edgeWaypoints = [
            { x: startX, y: startY },
            { x: p1_x, y: p1_y },
            { x: p2_x, y: p2_y },
            { x: p3_x, y: p3_y },
            { x: p4_x, y: p4_y },
            { x: endX, y: endY }
          ];
        } else if (Math.abs(fromCenterX - toCenterX) < 35) {
          // Vertically aligned!
          let hasCollision = false;
          if (fromNode && toNode) {
            const minRow = Math.min(fromNode.row, toNode.row);
            const maxRow = Math.max(fromNode.row, toNode.row);
            hasCollision = layoutNodes.some(node =>
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
            const startXCoord = fromPos.x + fromPos.width;
            const startYCoord = fromPos.y + fromPos.height / 2;
            const endXCoord = toPos.x + toPos.width;
            const endYCoord = toPos.y + toPos.height / 2;

            edgeWaypoints = [
              { x: startXCoord, y: startYCoord },
              { x: gutterX, y: startYCoord },
              { x: gutterX, y: endYCoord },
              { x: endXCoord, y: endYCoord }
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
            edgeWaypoints = [
              { x: commonX, y: sY },
              { x: commonX, y: midY },
              { x: commonX, y: eY }
            ];
          }
        } else if (fromPos.x + fromPos.width <= toPos.x) {
          if (Math.abs(startY - endY) < 5) {
            edgeWaypoints = [
              { x: startX, y: startY },
              { x: endX, y: endY }
            ];
          } else {
            const midX = Math.round((startX + endX) / 2);
            edgeWaypoints = [
              { x: startX, y: startY },
              { x: midX, y: startY },
              { x: midX, y: endY },
              { x: endX, y: endY }
            ];
          }
        } else {
          const p1_x = startX + 20;
          const p1_y = startY;
          const p2_x = p1_x;
          const p2_y = Math.max(fromPos.y + fromPos.height + 40, toPos.y + toPos.height + 40);
          const p3_x = endX - 20;
          const p3_y = p2_y;
          const p4_x = p3_x;
          const p4_y = endY;

          edgeWaypoints = [
            { x: startX, y: startY },
            { x: p1_x, y: p1_y },
            { x: p2_x, y: p2_y },
            { x: p3_x, y: p3_y },
            { x: p4_x, y: p4_y },
            { x: endX, y: endY }
          ];
        }
      }

      edgeWaypoints.forEach(wp => {
        xml += `
        <di:waypoint x="${wp.x}" y="${wp.y}" />`;
      });

      if (flow.label && edgeWaypoints.length >= 2) {
        const p0 = edgeWaypoints[0];
        const p1 = edgeWaypoints[1];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const L = Math.sqrt(dx * dx + dy * dy);
        if (L > 0) {
          const ux = dx / L;
          const uy = dy / L;
          // Perpendicular right-hand direction (uy, -ux)
          const px = uy;
          const py = -ux;

          // Compute label center along first segment
          // Distance along segment = 18px, offset from line = 12px
          const cx = Math.round(p0.x + 18 * ux + 12 * px);
          const cy = Math.round(p0.y + 18 * uy + 12 * py);

          const W = Math.max(20, flow.label.length * 8);
          const H = 14;
          const labelX = cx - Math.round(W / 2);
          const labelY = cy - Math.round(H / 2);

          xml += `
        <bpmndi:BPMNLabel>
          <dc:Bounds x="${labelX}" y="${labelY}" width="${W}" height="${H}" />
        </bpmndi:BPMNLabel>`;
        }
      }

      xml += `
      </bpmndi:BPMNEdge>`;
    });

    // 7. Generate Data Association Edges DI
    layoutNodes.forEach(node => {
      if (node.type === 'step' && node.stepRef?.producesForm && node.bpmnShape === 'task') {
        const fromPos = nodePositions.get(node.id);
        if (fromPos) {
          const fromX = fromPos.x + 85;
          const fromY = fromPos.y;
          const doCenterX = fromPos.x + 110;
          const doYBottom = fromPos.y - 10;

          xml += `
      <bpmndi:BPMNEdge id="DataOutputAssoc_${node.id}_di" bpmnElement="DataOutputAssoc_${node.id}">
        <di:waypoint x="${fromX}" y="${fromY}" />
        <di:waypoint x="${doCenterX}" y="${doYBottom}" />
      </bpmndi:BPMNEdge>`;
        }
      }
    });

    xml += `
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  return xml;
}
