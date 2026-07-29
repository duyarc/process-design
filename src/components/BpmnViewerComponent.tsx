import React, { useEffect, useRef, useState } from 'react';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import { Copy, Download, Check } from 'lucide-react';
import { copyBpmnToClipboard, downloadBpmnVectorFile } from '../utils/bpmnExportUtils';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

interface BpmnCanvas {
  zoom: (newZoom?: string | number) => number;
  viewbox: (newViewbox?: { x: number; y: number; width: number; height: number }) => {
    inner: { x: number; y: number; width: number; height: number };
    outer: { width: number; height: number };
    scale: number;
  };
}

interface BpmnViewerComponentProps {
  xml: string;
  processName?: string;
  showExportControls?: boolean;
}

export const BpmnViewerComponent: React.FC<BpmnViewerComponentProps> = ({ 
  xml, 
  processName = 'Diagram',
  showExportControls = true 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState<number | string>('450px');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const handleCopy = async () => {
    if (!viewerRef.current) return;
    const res = await copyBpmnToClipboard(viewerRef.current);
    if (res.success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDownload = async () => {
    if (!viewerRef.current) return;
    const res = await downloadBpmnVectorFile(viewerRef.current, processName);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  useEffect(() => {
    if (!containerRef.current) return;

    let active = true;
    let beforePrintCleanup: (() => void) | null = null;
    let afterPrintCleanup: (() => void) | null = null;

    setLoading(true);
    setError(null);

    // Initialize base bpmn-js Viewer and disable pan & zoom interaction modules
    const viewer = new BpmnViewer({
      container: containerRef.current,
      additionalModules: [
        {
          zoomScroll: [ 'value', null ],
          moveCanvas: [ 'value', null ]
        }
      ]
    });
    viewerRef.current = viewer;

    viewer.importXML(xml.trim())
      .then(() => {
        if (!active) return;
        setLoading(false);
        
        const canvas = viewer.get('canvas') as BpmnCanvas;
        
        // Parse y bounds to find the exact vertical bounding box of the diagram
        let minY = Infinity;
        let maxY = -Infinity;

        const boundsRegex = /<dc:Bounds[^>]*?y="(-?\d+)"[^>]*?height="(\d+)"/g;
        let match;
        while ((match = boundsRegex.exec(xml)) !== null) {
          const y = parseInt(match[1], 10);
          const h = parseInt(match[2], 10);
          if (y < minY) minY = y;
          if (y + h > maxY) maxY = y + h;
        }

        // Fallback if parsing failed
        if (minY === Infinity) {
          minY = 0;
          maxY = 450;
        }

        const fixedMinX = 120;
        const fixedWidth = 1250; // Width of pool up to Column 6 (Throw Event)
        const exactHeight = maxY - minY;

        const containerWidth = containerRef.current?.clientWidth || 1000;
        // Lock scale to fit the 1250px width (with 16px padding)
        const scale = containerWidth / (fixedWidth + 16);
        
        // Calculate target container height in pixels
        const targetHeight = (exactHeight + 16) * scale;
        
        // Update DOM style height synchronously so canvas.viewbox() reads the correct container height
        if (containerRef.current) {
          containerRef.current.style.height = `${targetHeight}px`;
        }
        setHeight(targetHeight);

        // 2. Draw page divider lines if layout is wrapped
        try {
          const laneBounds: { role: number; row: number; y: number; h: number }[] = [];
          let match;
          const laneRegex = /bpmnElement="Lane_Role_(\d+)_Row_(\d+)"[\s\S]*?<dc:Bounds[^>]*y="(\d+)"[^>]*height="(\d+)"/g;
          while ((match = laneRegex.exec(xml)) !== null) {
            laneBounds.push({
              role: parseInt(match[1], 10),
              row: parseInt(match[2], 10),
              y: parseInt(match[3], 10),
              h: parseInt(match[4], 10)
            });
          }
          if (laneBounds.length > 0) {
            const uniqueRows = Array.from(new Set(laneBounds.map(l => l.row)));
            const numRows = uniqueRows.length;
            if (numRows > 1) {
              // Extract pool width from XML or default
              let poolWidth = 1320;
              const poolMatch = /bpmnElement="Participant_1(?:_Row_\d+)?"[\s\S]*?<dc:Bounds[^>]*width="(\d+)"/.exec(xml);
              if (poolMatch) {
                poolWidth = parseInt(poolMatch[1], 10);
              }

              const viewport = containerRef.current?.querySelector('.viewport');
              if (viewport) {
                for (let r = 0; r < numRows - 1; r++) {
                  const rowRLanes = laneBounds.filter(l => l.row === r);
                  const yEnd = Math.max(...rowRLanes.map(l => l.y + l.h));

                  const rowR1Lanes = laneBounds.filter(l => l.row === r + 1);
                  const yStart = Math.min(...rowR1Lanes.map(l => l.y));

                  const yDivider = (yEnd + yStart) / 2;

                  const svgLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                  svgLine.setAttribute('x1', '120');
                  svgLine.setAttribute('y1', yDivider.toString());
                  svgLine.setAttribute('x2', poolWidth.toString());
                  svgLine.setAttribute('y2', yDivider.toString());
                  svgLine.setAttribute('stroke', '#cbd5e1'); // border separator color
                  svgLine.setAttribute('stroke-width', '2');
                  svgLine.setAttribute('stroke-dasharray', '8,8');
                  viewport.appendChild(svgLine);
                }
              }
            }
          }
        } catch (laneErr) {
          console.error('Error drawing page divider lines:', laneErr);
        }

        // 3. Set the viewbox to align and fit perfectly with 8px margin
        setTimeout(() => {
          if (active) {
            canvas.viewbox({
              x: fixedMinX - 8,
              y: minY - 8,
              width: fixedWidth + 16,
              height: exactHeight + 16
            });
          }
        }, 50);

        // 4. Handle printing events to dynamically scale diagram for A4 Landscape print size
        const handleBeforePrint = () => {
          document.body.classList.add('printing-active');
          if (containerRef.current) {
            // Force container width to exact print width (approx 1020px) to prevent over-zooming on wider screens
            containerRef.current.style.width = '1020px';
            
            // Dynamically calculate the printable height based on A4 landscape print width (1020px)
            const printScale = 1020 / (fixedWidth + 16);
            const printHeight = (exactHeight + 16) * printScale;
            containerRef.current.style.height = `${printHeight}px`;

            // Force synchronous layout reflow
            void containerRef.current.offsetHeight;
          }
          canvas.viewbox({
            x: fixedMinX - 8,
            y: minY - 8,
            width: fixedWidth + 16,
            height: exactHeight + 16
          });
        };

        const handleAfterPrint = () => {
          document.body.classList.remove('printing-active');
          if (containerRef.current) {
            containerRef.current.style.width = '100%';
            containerRef.current.style.height = `${targetHeight}px`;
            // Force synchronous layout reflow
            void containerRef.current.offsetHeight;
          }
          canvas.viewbox({
            x: fixedMinX - 8,
            y: minY - 8,
            width: fixedWidth + 16,
            height: exactHeight + 16
          });
        };

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        beforePrintCleanup = () => {
          window.removeEventListener('beforeprint', handleBeforePrint);
        };
        afterPrintCleanup = () => {
          window.removeEventListener('afterprint', handleAfterPrint);
        };
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Error importing BPMN XML:', err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Failed to render BPMN flowchart.');
        setLoading(false);
      });

    // Clean up on unmount
    return () => {
      active = false;
      viewer.destroy();
      if (beforePrintCleanup) beforePrintCleanup();
      if (afterPrintCleanup) afterPrintCleanup();
    };
  }, [xml]);

  return (
    <div 
      className="bpmn-viewer-card" 
      style={{ 
        position: 'relative',
        width: '100%', 
        border: 'none', 
        borderRadius: '8px', 
        overflow: 'hidden', 
        background: '#ffffff',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: '1.5rem'
      }}
    >
      {/* Loading state */}
      {loading && (
        <div 
          style={{ 
            position: 'absolute',
            top: 0,
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
          <p>Generating process flowchart...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div 
          style={{ 
            position: 'absolute',
            top: 0,
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
            <h4 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Failed to Render BPMN Chart</h4>
            <pre style={{ fontSize: '0.8rem', background: '#fee2e2', padding: '1rem', borderRadius: '6px', maxWidth: '100%', overflowX: 'auto' }}>
              {error}
            </pre>
          </div>
        </div>
      )}

      {/* Export Action Controls */}
      {showExportControls && !loading && !error && (
        <div 
          className="no-print"
          style={{
            position: 'absolute',
            top: '8px',
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
        </div>
      )}

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

      {/* bpmn-js canvas */}
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
};
