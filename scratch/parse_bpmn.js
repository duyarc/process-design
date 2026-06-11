import * as BpmnModdleModule from 'bpmn-moddle';
import fs from 'fs';
import { generateBPMNXML } from '../src/utils/bpmnXmlGenerator.js';

const BpmnModdle = BpmnModdleModule.default || BpmnModdleModule;

const steps = [
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

const moddle = new BpmnModdle();
moddle.fromXML(xml, (err, definitions, context) => {
  if (err) {
    console.error('Error parsing XML:', err);
    return;
  }
  console.log('XML parsed successfully!');
  if (context.warnings && context.warnings.length > 0) {
    console.log('Warnings:', context.warnings);
  } else {
    console.log('No warnings.');
  }
});
