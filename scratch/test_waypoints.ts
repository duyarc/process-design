import { generateBPMNXML } from '../src/utils/bpmnXmlGenerator';
import { ProcessStep } from '../src/types';

// Let's create steps that exceed column 5 and wrap to row 1
const steps: ProcessStep[] = [
  { id: 'Step_1', role: 'Operator', action: 'Start', bpmnShape: 'start-event', nextStepId: 'Step_2' },
  { id: 'Step_2', role: 'Operator', action: 'Step 2 Task', bpmnShape: 'task', nextStepId: 'Step_3' },
  { id: 'Step_3', role: 'Operator', action: 'Step 3 Task', bpmnShape: 'task', nextStepId: 'Step_4' },
  { id: 'Step_4', role: 'Operator', action: 'Step 4 Task', bpmnShape: 'task', nextStepId: 'Step_5' },
  { id: 'Step_5', role: 'Operator', action: 'Step 5 Gateway', bpmnShape: 'exclusive-gateway', branchYesLabel: 'Y', branchYesTargetId: 'Step_6', branchNoLabel: 'N', branchNoTargetId: 'Step_7' },
  { id: 'Step_6', role: 'Operator', action: 'Step 6 Task (Y)', bpmnShape: 'task', nextStepId: 'Step_8' },
  { id: 'Step_7', role: 'Operator', action: 'Step 7 Task (N)', bpmnShape: 'task', nextStepId: 'Step_8' },
  { id: 'Step_8', role: 'Operator', action: 'End', bpmnShape: 'end-event' }
];

const xml = generateBPMNXML(steps, 'Test Process', ['Operator']);
import * as fs from 'fs';
import * as path from 'path';

fs.writeFileSync('scratch/test.xml', xml);
console.log('XML written to scratch/test.xml');

// Parse and inspect positions to check why the else if wasn't matched
const xmlContent = fs.readFileSync('scratch/test.xml', 'utf8');
const fromPosMatch = xmlContent.match(/id="Step_5_di"[\s\S]*?<dc:Bounds (x="\d+" y="\d+" width="\d+" height="\d+")/);
const toPosMatch = xmlContent.match(/id="LinkThrow_Step_5_to_Step_6_di"[\s\S]*?<dc:Bounds (x="\d+" y="\d+" width="\d+" height="\d+")/);
console.log('Step_5 Bounds:', fromPosMatch ? fromPosMatch[1] : 'not found');
console.log('LinkThrow Bounds:', toPosMatch ? toPosMatch[1] : 'not found');
