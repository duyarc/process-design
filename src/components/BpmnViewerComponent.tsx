import React, { useEffect, useRef, useState } from 'react';
import BpmnViewer from 'bpmn-js/lib/Viewer';
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
}

export const BpmnViewerComponent: React.FC<BpmnViewerComponentProps> = ({ xml }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [height, setHeight] = useState<number | string>('450px');

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
