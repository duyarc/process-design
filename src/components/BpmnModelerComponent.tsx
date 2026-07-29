import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import { ZoomIn, ZoomOut, Maximize2, Save, Copy, Download, Check } from 'lucide-react';
import { copyBpmnToClipboard, downloadBpmnVectorFile } from '../utils/bpmnExportUtils';
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
  filter: (callback: (element: any) => boolean) => any[];
}

interface BpmnModelerComponentProps {
  xml: string;
  onSavePositions: (data: {
    positions: { id: string; x: number; y: number; labelX?: number; labelY?: number; labelW?: number; labelH?: number }[];
    waypoints: { id: string; sourceId: string; targetId: string; waypoints: { x: number; y: number }[] }[];
  }) => Promise<void>;
  onReset: () => Promise<void>;
  isSaving: boolean;
  processName?: string;
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
  isSaving,
  processName = 'Diagram'
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState<number | string>('500px');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleCopy = async () => {
    if (!modelerRef.current) return;
    const res = await copyBpmnToClipboard(modelerRef.current);
    if (res.success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDownload = async () => {
    if (!modelerRef.current) return;
    const res = await downloadBpmnVectorFile(modelerRef.current, processName);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const fitDiagram = useCallback(() => {
    if (!modelerRef.current || !containerRef.current) return;
    try {
      const canvas = modelerRef.current.get('canvas') as BpmnCanvas;
      
      canvas.zoom(1.0);
      const viewbox = canvas.viewbox();
      const diagramHeight = viewbox.inner.height || 450;
      const diagramY = viewbox.inner.y || 0;

      const fixedMinX = 120;
      const fixedWidth = 1250; // Width of pool up to Column 6 (Throw Event)

      const containerWidth = containerRef.current.clientWidth || 1000;
      // Lock scale to fit the 1250px width (with 40px horizontal padding)
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
          element.type === 'bpmn:ParallelGateway' ||
          element.type === 'bpmn:DataObjectReference'
        ) {
          const pos: { id: string; x: number; y: number; labelX?: number; labelY?: number; labelW?: number; labelH?: number } = {
            id: element.id,
            x: element.x,
            y: element.y
          };
          const labelShape = element.label || 
                             (element.labels && element.labels.length > 0 ? element.labels[0] : null) ||
                             elementRegistry.filter((e: any) => e.labelTarget && e.labelTarget.id === element.id)[0];
          if (labelShape && typeof labelShape.x === 'number' && typeof labelShape.y === 'number') {
            pos.labelX = Math.round(labelShape.x);
            pos.labelY = Math.round(labelShape.y);
            pos.labelW = Math.round(labelShape.width || 0);
            pos.labelH = Math.round(labelShape.height || 0);
          }
          positions.push(pos);
        } else if (element.type === 'bpmn:SequenceFlow' || element.type === 'bpmn:Association') {
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

      {/* Floating Zoom & Export controls */}
      <div 
        className="no-print"
        style={{ 
          position: 'absolute', 
          top: '52px', 
          right: '12px', 
          zIndex: 10, 
          display: 'flex', 
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255, 255, 255, 0.92)', 
          backdropFilter: 'blur(4px)',
          padding: '4px 8px', 
          borderRadius: '6px',
          border: '1px solid var(--neutral-border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{
            padding: '0.25rem 0.55rem',
            fontSize: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            height: '26px',
            color: isCopied ? '#059669' : '#0d9488',
            borderColor: isCopied ? '#6ee7b7' : '#99f6e4',
            background: isCopied ? '#ecfdf5' : '#f0fdf4'
          }}
          title="Sao chép ảnh sơ đồ (nền trắng) để dán Ctrl+V trực tiếp vào Word / Google Docs"
          onClick={handleCopy}
        >
          {isCopied ? <Check size={12} /> : <Copy size={12} />}
          <span>{isCopied ? 'Đã sao chép' : 'Copy'}</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{
            padding: '0.25rem 0.55rem',
            fontSize: '0.75rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            height: '26px',
            color: '#0284c7',
            borderColor: '#bae6fd',
            background: '#f0f9ff'
          }}
          title="Tải tệp sơ đồ chất lượng cao (.svg) về máy tính"
          onClick={handleDownload}
        >
          <Download size={12} />
          <span>Download</span>
        </button>

        <div style={{ width: '1px', height: '16px', background: '#cbd5e1', margin: '0 2px' }} />

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

      {/* Toast feedback notification */}
      {toast && (
        <div
          className="no-print"
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            background: toast.type === 'success' ? '#0f172a' : '#991b1b',
            color: '#ffffff',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {toast.type === 'success' && <Check size={14} style={{ color: '#34d399' }} />}
          <span>{toast.message}</span>
        </div>
      )}

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
