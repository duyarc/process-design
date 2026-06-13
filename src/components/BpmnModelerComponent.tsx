import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { ZoomIn, ZoomOut, Maximize2, Save, RotateCcw } from 'lucide-react';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js/dist/assets/bpmn-js.css';

interface BpmnCanvas {
  zoom: (newZoom?: string | number) => number;
  viewbox: (newViewbox?: { x: number; y: number; width: number; height: number }) => {
    inner: { x: number; y: number; width: number; height: number };
    outer: { width: number; height: number };
    scale: number;
  };
}

interface DirectEditingService {
  registerProvider: (provider: { activate: () => boolean }) => void;
}

interface ElementRegistryService {
  forEach: (callback: (element: { id: string; type: string; x: number; y: number }) => void) => void;
}

interface BpmnModelerComponentProps {
  xml: string;
  onSavePositions: (data: {
    positions: { id: string; x: number; y: number; labelX?: number; labelY?: number; labelW?: number; labelH?: number }[];
    waypoints: { id: string; sourceId: string; targetId: string; waypoints: { x: number; y: number }[] }[];
  }) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving: boolean;
}

export interface BpmnModelerRef {
  getPositions: () => {
    positions: { id: string; x: number; y: number; labelX?: number; labelY?: number; labelW?: number; labelH?: number }[];
    waypoints: { id: string; sourceId: string; targetId: string; waypoints: { x: number; y: number }[] }[];
  };
}

export const BpmnModelerComponent = forwardRef<BpmnModelerRef, BpmnModelerComponentProps>(({ 
  xml, 
  onSavePositions, 
  onReset,
  isSaving 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState<number | string>('500px');

  const fitDiagram = useCallback(() => {
    if (!modelerRef.current || !containerRef.current) return;
    try {
      const canvas = modelerRef.current.get('canvas') as BpmnCanvas;
      
      canvas.zoom(1.0);
      const viewbox = canvas.viewbox();
      const diagramHeight = viewbox.inner.height || 450;
      const diagramY = viewbox.inner.y || 0;

      const fixedMinX = 120;
      const fixedWidth = 1070; // Width of 6 horizontal shapes (columns 0 to 5)

      const containerWidth = containerRef.current.clientWidth || 1000;
      // Lock scale to fit the 1070px width (with 40px horizontal padding)
      const scale = containerWidth / (fixedWidth + 40);
      
      // Calculate target container height in pixels
      const targetHeight = (diagramHeight + 50) * scale;
      
      // Update DOM style height synchronously so canvas.viewbox() reads the correct container height
      containerRef.current.style.height = `${targetHeight}px`;
      setHeight(targetHeight);

      // Set the viewbox to align and fit perfectly
      setTimeout(() => {
        canvas.viewbox({
          x: fixedMinX - 20,
          y: diagramY - 10,
          width: fixedWidth + 40,
          height: diagramHeight + 50
        });
      }, 50);
    } catch (err) {
      console.error('Error fitting diagram:', err);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let active = true;
    setLoading(true);
    setError(null);

    // Initialize Modeler without keyboard binding and disable pan & zoom interaction modules
    const modeler = new BpmnModeler({
      container: containerRef.current,
      additionalModules: [
        {
          zoomScroll: [ 'value', null ],
          moveCanvas: [ 'value', null ]
        }
      ]
    });
    modelerRef.current = modeler;

    modeler.importXML(xml.trim())
      .then(() => {
        if (!active) return;
        setLoading(false);

        // Disable direct editing (double-clicking text to edit label name)
        try {
          const directEditing = modeler.get('directEditing') as DirectEditingService;
          if (directEditing) {
            directEditing.registerProvider({
              activate: () => false
            });
          }
        } catch (deError) {
          console.warn('Could not disable direct editing service:', deError);
        }

        // Auto zoom and resize diagram frame on load
        setTimeout(() => {
          if (active) {
            fitDiagram();
          }
        }, 100);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Error importing BPMN XML into Modeler:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Failed to initialize BPMN designer canvas.');
        setLoading(false);
      });

    // Clean up on unmount
    return () => {
      active = false;
      modeler.destroy();
    };
  }, [xml, fitDiagram]);

  // Zoom helpers
  const handleZoomIn = () => {
    if (modelerRef.current) {
      const canvas = modelerRef.current.get('canvas') as BpmnCanvas;
      canvas.zoom(canvas.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (modelerRef.current) {
      const canvas = modelerRef.current.get('canvas') as BpmnCanvas;
      canvas.zoom(canvas.zoom() * 0.8);
    }
  };

  const handleZoomReset = () => {
    fitDiagram();
  };

  const getPositions = useCallback(() => {
    if (!modelerRef.current) return { positions: [], waypoints: [] };
    try {
      const elementRegistry = modelerRef.current.get('elementRegistry') as ElementRegistryService;
      const positions: { id: string; x: number; y: number; labelX?: number; labelY?: number }[] = [];
      const waypoints: { id: string; sourceId: string; targetId: string; waypoints: { x: number; y: number }[] }[] = [];
      
      elementRegistry.forEach((element: any) => {
        // Collect coordinates for custom shapes corresponding to process steps
        if (
          element.type === 'bpmn:Task' ||
          element.type === 'bpmn:UserTask' ||
          element.type === 'bpmn:ServiceTask' ||
          element.type === 'bpmn:StartEvent' ||
          element.type === 'bpmn:EndEvent' ||
          element.type === 'bpmn:ExclusiveGateway' ||
          element.type === 'bpmn:ParallelGateway'
        ) {
          const pos: { id: string; x: number; y: number; labelX?: number; labelY?: number; labelW?: number; labelH?: number } = {
            id: element.id,
            x: element.x,
            y: element.y
          };
          if (element.label && typeof element.label.x === 'number' && typeof element.label.y === 'number') {
            pos.labelX = Math.round(element.label.x);
            pos.labelY = Math.round(element.label.y);
            pos.labelW = Math.round(element.label.width || 0);
            pos.labelH = Math.round(element.label.height || 0);
          }
          positions.push(pos);
        } else if (element.type === 'bpmn:SequenceFlow') {
          if (element.source && element.target && element.waypoints) {
            waypoints.push({
              id: element.id,
              sourceId: element.source.id,
              targetId: element.target.id,
              waypoints: element.waypoints.map((wp: any) => ({ x: Math.round(wp.x), y: Math.round(wp.y) }))
            });
          }
        }
      });
      return { positions, waypoints };
    } catch (err) {
      console.error('Error getting shapes and waypoints positions:', err);
      return { positions: [], waypoints: [] };
    }
  }, []);

  useImperativeHandle(ref, () => ({
    getPositions
  }), [getPositions]);

  const handleTriggerSave = async () => {
    const data = getPositions();
    if (data.positions.length === 0) return;
    try {
      await onSavePositions(data);
      
      // Auto zoom and resize diagram container height after successful save
      setTimeout(() => {
        fitDiagram();
      }, 50);
    } catch (err) {
      console.error('Error saving shapes positions:', err);
      alert('Failed to save layout coordinates.');
    }
  };

  return (
    <div 
      className="bpmn-viewer-card" 
      style={{ 
        position: 'relative',
        width: '100%', 
        border: '2px solid var(--primary)', 
        borderRadius: '8px', 
        overflow: 'hidden', 
        background: '#ffffff',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '1.5rem'
      }}
    >
      {/* Hide Palette and Context Pad via CSS injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        .djs-palette { display: none !important; }
        .djs-context-pad { display: none !important; }
      ` }} />

      {/* Design Header Controls */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--primary)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}
      >
        <span>🎨 Adjust Diagram Layout (Drag to reposition shapes/connectors)</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onReset}
            disabled={isSaving}
            title="Reset to default grid layout"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              padding: '4px 8px', 
              fontSize: '0.75rem', 
              background: 'rgba(255,255,255,0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.3)',
              margin: 0,
              boxShadow: 'none'
            }}
          >
            <RotateCcw size={12} /> Reset to Auto-Layout
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleTriggerSave}
            disabled={isSaving}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              padding: '4px 12px', 
              fontSize: '0.75rem', 
              background: '#ffffff',
              color: 'var(--primary)',
              border: 'none',
              margin: 0,
              fontWeight: 'bold',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Save size={12} /> {isSaving ? 'Saving...' : 'Save Layout'}
          </button>
        </div>
      </div>

      {/* Floating Zoom controls */}
      <div 
        style={{ 
          position: 'absolute', 
          top: '52px', 
          right: '12px', 
          zIndex: 10, 
          display: 'flex', 
          gap: '4px',
          background: 'rgba(255, 255, 255, 0.9)', 
          padding: '4px', 
          borderRadius: '6px',
          border: '1px solid var(--neutral-border)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}
      >
        <button 
          type="button"
          onClick={handleZoomIn} 
          className="btn btn-secondary" 
          title="Zoom In"
          style={{ padding: '6px', margin: 0, minWidth: 'auto', background: 'transparent', boxShadow: 'none' }}
        >
          <ZoomIn size={16} style={{ color: 'var(--text-primary)' }} />
        </button>
        <button 
          type="button"
          onClick={handleZoomOut} 
          className="btn btn-secondary" 
          title="Zoom Out"
          style={{ padding: '6px', margin: 0, minWidth: 'auto', background: 'transparent', boxShadow: 'none' }}
        >
          <ZoomOut size={16} style={{ color: 'var(--text-primary)' }} />
        </button>
        <button 
          type="button"
          onClick={handleZoomReset} 
          className="btn btn-secondary" 
          title="Fit to Screen"
          style={{ padding: '6px', margin: 0, minWidth: 'auto', background: 'transparent', boxShadow: 'none' }}
        >
          <Maximize2 size={16} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div 
          style={{ 
            position: 'absolute',
            top: '40px',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            color: 'var(--text-secondary)',
            background: '#ffffff',
            zIndex: 5
          }}
        >
          <p>Loading layout designer...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div 
          style={{ 
            position: 'absolute',
            top: '40px',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            color: 'var(--danger)',
            padding: '2rem',
            textAlign: 'center',
            background: '#ffffff',
            zIndex: 5
          }}
        >
          <div>
            <h4 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Designer Canvas Error</h4>
            <pre style={{ fontSize: '0.8rem', background: '#fee2e2', padding: '1rem', borderRadius: '6px', maxWidth: '100%', overflowX: 'auto' }}>
              {error}
            </pre>
          </div>
        </div>
      )}

      {/* bpmn-js canvas container */}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: typeof height === 'number' ? `${height}px` : height, 
          display: 'block'
        }} 
      />
    </div>
  );
});
