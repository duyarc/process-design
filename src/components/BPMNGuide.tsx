import React, { useState } from 'react';
import { BookOpen, Award, ShieldAlert, CheckCircle2, Info, HelpCircle } from 'lucide-react';
import { BpmnViewerComponent } from './BpmnViewerComponent';

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                  id="Definitions_OrderProcess" 
                  targetNamespace="http://bpmn.io/schema/bpmn" 
                  exporter="ProcessPortal" 
                  exporterVersion="1.0">
  <bpmn:collaboration id="Collaboration_OrderProcess">
    <bpmn:participant id="Participant_OrderProcess" name="Order Process" processRef="Process_OrderProcess" />
  </bpmn:collaboration>
  
  <bpmn:process id="Process_OrderProcess" isExecutable="false">
    <bpmn:laneSet id="LaneSet_OrderProcess">
      <bpmn:lane id="Lane_Sales" name="Sales">
        <bpmn:flowNodeRef>StartEvent_Arrive</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_ReceiveOrder</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_Fail</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Finance" name="Finance">
        <bpmn:flowNodeRef>Task_CheckCredit</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_CreditOK</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_SendInvoice</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_Complete</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Warehouse" name="Warehouse">
        <bpmn:flowNodeRef>Task_FulfillOrder</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Fulfilled</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    
    <bpmn:startEvent id="StartEvent_Arrive" name="Order Arrive">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    
    <bpmn:task id="Task_ReceiveOrder" name="Receive Order">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:task>
    
    <bpmn:task id="Task_CheckCredit" name="Check Credit">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:task>
    
    <bpmn:exclusiveGateway id="Gateway_CreditOK" name="Credit OK ?">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_CreditYes</bpmn:outgoing>
      <bpmn:outgoing>Flow_CreditNo</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:task id="Task_FulfillOrder" name="Fulfill Order">
      <bpmn:incoming>Flow_CreditYes</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:task>
    
    <bpmn:exclusiveGateway id="Gateway_Fulfilled" name="Order Fulfilled ?">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:outgoing>Flow_FulfillYes</bpmn:outgoing>
      <bpmn:outgoing>Flow_FulfillNo</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    
    <bpmn:task id="Task_SendInvoice" name="Send Invoice">
      <bpmn:incoming>Flow_FulfillYes</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:task>
    
    <bpmn:endEvent id="EndEvent_Complete" name="Order Complete">
      <bpmn:incoming>Flow_5</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:endEvent id="EndEvent_Fail" name="Order Fail">
      <bpmn:incoming>Flow_CreditNo</bpmn:incoming>
      <bpmn:incoming>Flow_FulfillNo</bpmn:incoming>
    </bpmn:endEvent>
    
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_Arrive" targetRef="Task_ReceiveOrder" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_ReceiveOrder" targetRef="Task_CheckCredit" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_CheckCredit" targetRef="Gateway_CreditOK" />
    <bpmn:sequenceFlow id="Flow_CreditYes" name="Y" sourceRef="Gateway_CreditOK" targetRef="Task_FulfillOrder" />
    <bpmn:sequenceFlow id="Flow_CreditNo" name="N" sourceRef="Gateway_CreditOK" targetRef="EndEvent_Fail" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_FulfillOrder" targetRef="Gateway_Fulfilled" />
    <bpmn:sequenceFlow id="Flow_FulfillYes" name="Y" sourceRef="Gateway_Fulfilled" targetRef="Task_SendInvoice" />
    <bpmn:sequenceFlow id="Flow_FulfillNo" name="N" sourceRef="Gateway_Fulfilled" targetRef="EndEvent_Fail" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_SendInvoice" targetRef="EndEvent_Complete" />
  </bpmn:process>
  
  <bpmndi:BPMNDiagram id="BPMNDiagram_OrderProcess">
    <bpmndi:BPMNPlane id="BPMNPlane_OrderProcess" bpmnElement="Collaboration_OrderProcess">
      <bpmndi:BPMNShape id="Participant_OrderProcess_di" bpmnElement="Participant_OrderProcess" isHorizontal="true">
        <dc:Bounds x="120" y="0" width="870" height="420" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Sales_di" bpmnElement="Lane_Sales" isHorizontal="true">
        <dc:Bounds x="150" y="0" width="840" height="140" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Finance_di" bpmnElement="Lane_Finance" isHorizontal="true">
        <dc:Bounds x="150" y="140" width="840" height="140" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Warehouse_di" bpmnElement="Lane_Warehouse" isHorizontal="true">
        <dc:Bounds x="150" y="280" width="840" height="140" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="StartEvent_Arrive_di" bpmnElement="StartEvent_Arrive">
        <dc:Bounds x="192" y="52" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="180" y="95" width="60" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Task_ReceiveOrder_di" bpmnElement="Task_ReceiveOrder">
        <dc:Bounds x="265" y="30" width="110" height="80" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Task_CheckCredit_di" bpmnElement="Task_CheckCredit">
        <dc:Bounds x="265" y="170" width="110" height="80" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Gateway_CreditOK_di" bpmnElement="Gateway_CreditOK" isMarkerVisible="true">
        <dc:Bounds x="455" y="185" width="50" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="515" y="203" width="60" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Task_FulfillOrder_di" bpmnElement="Task_FulfillOrder">
        <dc:Bounds x="425" y="310" width="110" height="80" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Gateway_Fulfilled_di" bpmnElement="Gateway_Fulfilled" isMarkerVisible="true">
        <dc:Bounds x="615" y="325" width="50" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="599" y="382" width="82" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="Task_SendInvoice_di" bpmnElement="Task_SendInvoice">
        <dc:Bounds x="705" y="170" width="110" height="80" />
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="EndEvent_Complete_di" bpmnElement="EndEvent_Complete">
        <dc:Bounds x="872" y="192" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="852" y="235" width="77" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNShape id="EndEvent_Fail_di" bpmnElement="EndEvent_Fail">
        <dc:Bounds x="872" y="52" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="866" y="95" width="49" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="228" y="70" />
        <di:waypoint x="265" y="70" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="320" y="110" />
        <di:waypoint x="320" y="170" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="375" y="210" />
        <di:waypoint x="455" y="210" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_CreditYes_di" bpmnElement="Flow_CreditYes">
        <di:waypoint x="480" y="235" />
        <di:waypoint x="480" y="310" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="486" y="253" width="8" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_CreditNo_di" bpmnElement="Flow_CreditNo">
        <di:waypoint x="480" y="185" />
        <di:waypoint x="480" y="70" />
        <di:waypoint x="872" y="70" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="486" y="153" width="9" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="535" y="350" />
        <di:waypoint x="615" y="350" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_FulfillYes_di" bpmnElement="Flow_FulfillYes">
        <di:waypoint x="665" y="350" />
        <di:waypoint x="760" y="350" />
        <di:waypoint x="760" y="250" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="686" y="353" width="8" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_FulfillNo_di" bpmnElement="Flow_FulfillNo">
        <di:waypoint x="640" y="325" />
        <di:waypoint x="640" y="70" />
        <di:waypoint x="872" y="70" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="646" y="283" width="9" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="815" y="210" />
        <di:waypoint x="872" y="210" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

interface BPMNGuideProps {}

export const BPMNGuide: React.FC<BPMNGuideProps> = () => {
  const [activeTab, setActiveTab] = useState<'elements' | 'methodology' | 'best-practices'>('elements');
  const [testInput, setTestInput] = useState('');
  const [testFeedback, setTestFeedback] = useState<{
    valid: boolean;
    verb: string;
    noun: string;
    value: string;
    tips: string[];
  } | null>(null);

  // Simple parser to demonstrate "Action-Target Formula" validation interactively
  const handleTestStep = (text: string) => {
    setTestInput(text);
    if (!text.trim()) {
      setTestFeedback(null);
      return;
    }

    const trimmed = text.trim();
    const words = trimmed.split(/\s+/);
    const firstWord = words[0]?.toLowerCase() || '';

    // Standard active action verbs in process design
    const strongVerbs = [
      'verify', 'check', 'press', 'turn', 'adjust', 'inspect', 'close', 
      'open', 'start', 'stop', 'clean', 'flush', 'fill', 'drain', 
      'record', 'measure', 'notify', 'escalate', 'isolate', 'run'
    ];

    const weakVerbs = ['should', 'must', 'try', 'please', 'is', 'are', 'was', 'were', 'go', 'do', 'process'];
    
    const isVerbStrong = strongVerbs.some(v => firstWord.startsWith(v));
    const isVerbWeak = weakVerbs.some(v => firstWord.startsWith(v));

    const tips: string[] = [];
    const verb = words[0] || '';
    const noun = words.slice(1, 3).join(' ') || '';
    const value = words.slice(3).join(' ') || '';

    if (!isVerbStrong) {
      if (isVerbWeak) {
        tips.push(`Replace weak verb "${words[0]}" with an active imperative command (e.g., "Press", "Verify", "Turn").`);
      } else {
        tips.push(`Ensure the first word "${words[0]}" is a strong action verb in imperative mood (direct command).`);
      }
    }

    if (words.length < 3) {
      tips.push('Step details are too brief. Add the target/object being acted upon and any spec value/limit.');
    }

    // Check for target specification numbers or statuses
    const hasValue = /\b(\d+|green|red|high|low|on|off|open|closed|bar|psi|ppm|°c|c)\b/i.test(trimmed);
    if (!hasValue) {
      tips.push('Tip: Include a specific limit, tolerance, or target value (e.g. "below 15°C", "to 2.0 bar").');
    }

    setTestFeedback({
      valid: tips.length === 0,
      verb: verb,
      noun: noun || '...',
      value: value || '...',
      tips: tips.length > 0 ? tips : ['Excellent! This matches the [Verb] + [Noun] + [Target] standard operating command format.']
    });
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div className="paper-card accent-teal" style={{ marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <BookOpen size={20} style={{ color: 'var(--primary)' }} />
            <span className="badge" style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>Reference Manual</span>
          </div>
          <h1 style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>Process Design Guide</h1>
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Standard operating guide for designing process swimlanes, checklists, and writing actionable workplace instructions.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--neutral-border)', marginBottom: '2rem', gap: '1rem' }}>
        <button
          onClick={() => setActiveTab('elements')}
          className="btn btn-secondary"
          style={{
            borderBottom: activeTab === 'elements' ? '3px solid var(--primary)' : 'none',
            borderRadius: '4px 4px 0 0',
            background: activeTab === 'elements' ? '#ffffff' : 'transparent',
            boxShadow: 'none',
            fontWeight: activeTab === 'elements' ? 600 : 400,
            padding: '0.75rem 1.5rem'
          }}
        >
          1. BPMN Shapes Glossary
        </button>
        <button
          onClick={() => setActiveTab('methodology')}
          className="btn btn-secondary"
          style={{
            borderBottom: activeTab === 'methodology' ? '3px solid var(--primary)' : 'none',
            borderRadius: '4px 4px 0 0',
            background: activeTab === 'methodology' ? '#ffffff' : 'transparent',
            boxShadow: 'none',
            fontWeight: activeTab === 'methodology' ? 600 : 400,
            padding: '0.75rem 1.5rem'
          }}
        >
          2. Action-Target Formula
        </button>
        <button
          onClick={() => setActiveTab('best-practices')}
          className="btn btn-secondary"
          style={{
            borderBottom: activeTab === 'best-practices' ? '3px solid var(--primary)' : 'none',
            borderRadius: '4px 4px 0 0',
            background: activeTab === 'best-practices' ? '#ffffff' : 'transparent',
            boxShadow: 'none',
            fontWeight: activeTab === 'best-practices' ? 600 : 400,
            padding: '0.75rem 1.5rem'
          }}
        >
          3. Process Design Rules
        </button>
      </div>

      {/* TAB 1: ELEMENTS GLOSSARY */}
      {activeTab === 'elements' && (
        <div>
          <div className="paper-card" style={{ padding: '1.25rem', marginBottom: '2rem', background: '#f9fafb' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Info size={18} style={{ color: 'var(--primary)' }} />
              About BPMN 2.0 inside our Process Design tool
            </h3>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', lineHeight: '1.6' }}>
              We use a clean, web-friendly rendering configuration of BPMN 2.0 elements. Whether you construct diagrams using visual modellers like <strong>bpmn-js</strong> or structural codes, each symbol represents a specific, globally standardized operational behavior.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Events Section */}
            <div>
              <h2 style={{ borderBottom: '2px solid var(--neutral-border)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>Events</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Events signal things that happen before, during, or after a process flow.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <circle cx="30" cy="30" r="18" fill="#fff" stroke="#10b981" strokeWidth="2.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Start Event</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Initiates the workflow. Every diagram must have exactly one Start Event per pathway.
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <circle cx="30" cy="30" r="18" fill="#fff" stroke="#f59e0b" strokeWidth="2" />
                    <circle cx="30" cy="30" r="14" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Intermediate Event</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Indicates a pause or trigger mid-process, such as waiting for a Timer or receiving a Message.
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <circle cx="30" cy="30" r="18" fill="#fff" stroke="#ef4444" strokeWidth="4.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>End Event</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Concludes the process line. Marks the final output or termination of the workflow.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Activities Section */}
            <div>
              <h2 style={{ borderBottom: '2px solid var(--neutral-border)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>Activities (Tasks)</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tasks represent individual blocks of work performed by operators or machines.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <rect x="10" y="15" width="40" height="30" rx="5" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Standard Task</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      A single action command block. Write with direct verb format (e.g., "Clean pump").
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <rect x="10" y="15" width="40" height="30" rx="5" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
                    {/* Tiny User Icon in top-left */}
                    <circle cx="17" cy="24" r="3" fill="none" stroke="#4b5563" strokeWidth="1.5" />
                    <path d="M12 32c0-3 2.5-4 5-4s5 1 5 4" fill="none" stroke="#4b5563" strokeWidth="1.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>User Task</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      A task performed by an operator in a software system (e.g., entering audit values into Portal).
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <rect x="10" y="15" width="40" height="30" rx="5" fill="#fff" stroke="#3b82f6" strokeWidth="2.5" />
                    {/* Small Cog/Gear icon */}
                    <circle cx="20" cy="25" r="3" fill="none" stroke="#4b5563" strokeWidth="2.0" />
                    <path d="M20 20v2M20 28v2M15 25h2M23 25h2" stroke="#4b5563" strokeWidth="1.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Service Task</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Automated action carried out by a background service (e.g., automated email alerts, saving logs).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Gateways Section */}
            <div>
              <h2 style={{ borderBottom: '2px solid var(--neutral-border)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>Gateways (Decisions)</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Gateways control the flow branch pathways based on validation checks or rules.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <path d="M30 10 L50 30 L30 50 L10 30 Z" fill="#fff" stroke="#d97706" strokeWidth="2.5" />
                    <path d="M24 24 L36 36 M36 24 L24 36" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Exclusive Gateway (XOR)</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      A strict decision split. **Only one** path can be taken based on checking conditions (e.g., Yes/No).
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <path d="M30 10 L50 30 L30 50 L10 30 Z" fill="#fff" stroke="#d97706" strokeWidth="2.5" />
                    <path d="M30 20 v20 M20 30 h20" stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Parallel Gateway (AND)</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Splits flow into multiple branches that execute simultaneously. No condition criteria needed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Connecting Objects Section */}
            <div>
              <h2 style={{ borderBottom: '2px solid var(--neutral-border)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>Connecting Flows</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Connecting lines detail how tokens pass between events, tasks, and structures.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <path d="M10 30 h35" stroke="#4b5563" strokeWidth="2" />
                    <path d="M45 26 L52 30 L45 34 Z" fill="#4b5563" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Sequence Flow</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Solid line showing standard operation order inside a single Role Swimlane or Pool.
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <circle cx="13" cy="30" r="3" fill="#fff" stroke="#8c939d" strokeWidth="1.5" />
                    <path d="M16 30 h29" stroke="#8c939d" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M45 26 L52 30 L45 34 Z" fill="none" stroke="#8c939d" strokeWidth="1.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Message Flow</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Dashed line illustrating communications or exchanges crossing separate Pool boundaries.
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <path d="M10 30 h40" stroke="#8c939d" strokeWidth="1.5" strokeDasharray="2 3" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Association</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Dotted line used to link auxiliary elements (like Notes or Data Objects) to activities.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Swimlanes & Data */}
            <div>
              <h2 style={{ borderBottom: '2px solid var(--neutral-border)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>Swimlanes & Data</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Organizes responsibilities and represents data stores.</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1rem' }}>
                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <rect x="8" y="10" width="44" height="40" fill="none" stroke="#4b5563" strokeWidth="2" />
                    <line x1="8" y1="30" x2="52" y2="30" stroke="#4b5563" strokeWidth="1.5" />
                    <line x1="20" y1="10" x2="20" y2="50" stroke="#4b5563" strokeWidth="1.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Pool & Swimlane</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Partitions actions. The Pool represents the plant/system; Swimlanes represent individual Roles.
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <path d="M18 12 h16 l10 10 v26 h-26 Z" fill="#fff" stroke="#4b5563" strokeWidth="2" />
                    <path d="M34 12 v10 h10" fill="none" stroke="#4b5563" strokeWidth="1.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Data Object</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Represents documents, checklists, or telemetry values passed into or created by a task.
                    </p>
                  </div>
                </div>

                <div className="paper-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', margin: 0 }}>
                  <svg width="60" height="60" style={{ flexShrink: 0 }}>
                    <ellipse cx="30" cy="18" rx="14" ry="5" fill="#fff" stroke="#4b5563" strokeWidth="2" />
                    <path d="M16 18 v20 a14 5 0 0 0 28 0 v-20" fill="none" stroke="#4b5563" strokeWidth="2" />
                    <path d="M16 28 a14 5 0 0 0 28 0" fill="none" stroke="#4b5563" strokeWidth="1.5" />
                  </svg>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Data Store</h4>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                      Represents a database or persistent archive where process history logs are stored.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sample BPMN Process Flowchart Section */}
            <div style={{ marginTop: '3rem' }}>
              <h2 style={{ borderBottom: '2px solid var(--neutral-border)', paddingBottom: '0.5rem', color: 'var(--text-primary)' }}>Sample BPMN Flowchart Rendering</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                This is a live example of how swimlanes, events, tasks, and gateways connect horizontally to represent a business process workflow.
              </p>
              
              <div className="paper-card" style={{ padding: '1.5rem', marginTop: '1rem', background: '#ffffff' }}>
                <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Order Process Flow</h4>
                <BpmnViewerComponent xml={sampleXml} />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: METHODOLOGY */}
      {activeTab === 'methodology' && (
        <div>
          <h2>The Action-Target Formula</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            In standard operations, vague step statements result in operator mistakes. Process standards dictate that every workflow action must be written as a direct imperative command using the formula:
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '2rem 0' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: 'linear-gradient(135deg, #0d9488 0%, #10a3a3 100%)',
              color: '#fff',
              padding: '1.5rem 2.5rem',
              borderRadius: '12px',
              fontSize: '1.25rem',
              fontWeight: 700,
              boxShadow: 'var(--shadow-md)'
            }}>
              <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.15)', borderRadius: '4px' }}>[ Verb ]</span>
              <span>+</span>
              <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.15)', borderRadius: '4px' }}>[ Noun ]</span>
              <span>+</span>
              <span style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.15)', borderRadius: '4px' }}>[ Target / Value ]</span>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: '3rem' }}>
            <div className="paper-card" style={{ borderColor: 'var(--danger)', margin: 0 }}>
              <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ❌ Avoid (Vague & Passive)
              </h3>
              <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.8', fontSize: '0.9rem' }}>
                <li>"The temperature should be monitored occasionally by the worker." (Passive voice, no clear target, no clear frequency)</li>
                <li>"Make sure pump has run." (Vague action, no specification)</li>
                <li>"Please clean the workstation." (Polite rather than direct, no standard defined)</li>
              </ul>
            </div>
            
            <div className="paper-card" style={{ borderColor: '#10b981', margin: 0 }}>
              <h3 style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ✅ Implement (Direct & Clear)
              </h3>
              <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.8', fontSize: '0.9rem' }}>
                <li><strong>"Verify coolant temperature is below 15°C."</strong> (Verb: Verify, Noun: Coolant temperature, Target: below 15°C)</li>
                <li><strong>"Run pump A for 3 minutes."</strong> (Verb: Run, Noun: Pump A, Target: for 3 minutes)</li>
                <li><strong>"Clear oil residues from drip trays using visual check sheet."</strong> (Verb: Clear, Noun: Oil residues, Target: tray area)</li>
              </ul>
            </div>
          </div>

          {/* Interactive Formula Playground */}
          <div className="paper-card accent-teal" style={{ margin: 0 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HelpCircle style={{ color: 'var(--primary)' }} />
              Direct Command Grammar Tool
            </h3>
            <p style={{ fontSize: '0.9rem' }}>
              Draft a process step action text below to check if it matches the Action-Target structure.
            </p>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <input
                type="text"
                value={testInput}
                onChange={(e) => handleTestStep(e.target.value)}
                placeholder="e.g. Verify pressure indicator is between 2.0 and 2.5 bar."
                style={{ fontSize: '1rem', padding: '0.75rem 1rem' }}
              />
            </div>

            {testFeedback && (
              <div style={{
                background: '#f9fafb',
                border: '1px solid var(--neutral-border)',
                borderRadius: '8px',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Parsed Elements:</span>
                  <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>Verb: {testFeedback.verb}</span>
                  <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>Noun: {testFeedback.noun}</span>
                  <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>Target: {testFeedback.value}</span>
                </div>
                
                <h4 style={{
                  fontSize: '0.9rem',
                  color: testFeedback.valid ? '#166534' : '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginBottom: '0.5rem'
                }}>
                  {testFeedback.valid ? (
                    <>
                      <CheckCircle2 size={16} /> Standard Validated
                    </>
                  ) : (
                    <>
                      <ShieldAlert size={16} /> Needs Improvement
                    </>
                  )}
                </h4>
                
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  {testFeedback.tips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BEST PRACTICES */}
      {activeTab === 'best-practices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <h2>Core Rules for Flow Design</h2>
            <p>Following these rules keeps your diagrams professional, readable, and ready to print.</p>
          </div>

          <div className="grid-2">
            <div className="paper-card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                <Award size={20} />
                <h3>Swimlane Alignment</h3>
              </div>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                Each Swimlane must correspond to exactly one responsible job role (e.g. "Operator A", "Shift Supervisor", "Maintenance Lead").
              </p>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li>Do not create lanes for departments. Keep them role-based.</li>
                <li>Position tasks in the lane of the role executing them.</li>
                <li>Sequence lines connecting shapes across swimlanes indicate a handoff. Minimise handoffs to prevent delays.</li>
              </ul>
            </div>

            <div className="paper-card" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary)' }}>
                <CheckCircle2 size={20} />
                <h3>Gateway Decisions</h3>
              </div>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                A decision gateway (diamond shape) splits flow paths based on checks. It must always include a clear question.
              </p>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li>Write the gateway label as a question (e.g., "Is temperature &gt; 15°C?").</li>
                <li>Ensure outgoing path lines are labelled clearly (e.g. "Yes", "No").</li>
                <li>Avoid having multiple input lines join a single gateway; use a merge junction gateway instead.</li>
              </ul>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
