import React, { useEffect, useRef, useState } from 'react';

export interface MiniMapCanvasProps {
  lat: number;
  lng: number;
  zoom?: number;
  height?: number;
  mapType?: 'roadmap' | 'satellite';
  allowToggleType?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/**
 * Converts latitude and longitude to fractional tile coordinates using standard Web Mercator math.
 */
function latLonToTileFraction(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = n * ((lon + 180) / 360);
  const latRad = (lat * Math.PI) / 180;
  const y = n * (1 - (Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI)) / 2;
  return { x, y };
}

/**
 * Loads a tile image with crossOrigin="anonymous" to ensure PDF/html2canvas compatibility.
 */
function loadTileImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
    img.src = url;
  });
}

/**
 * Pure HTML5 Canvas OSM & Satellite Tile Stitcher Mini Map.
 * Renders standard OpenStreetMap tiles or high-resolution Esri World Imagery satellite tiles.
 * Fully compatible with React 19, mobile touch scrolling (no scroll trap), and print/PDF export.
 */
export const MiniMapCanvas: React.FC<MiniMapCanvasProps> = ({
  lat,
  lng,
  zoom = 15,
  height,
  mapType = 'roadmap',
  allowToggleType = true,
  className,
  style,
  onClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeType, setActiveType] = useState<'roadmap' | 'satellite'>(mapType || 'roadmap');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync internal activeType when prop changes
  useEffect(() => {
    if (mapType) {
      setActiveType(mapType);
    }
  }, [mapType]);

  useEffect(() => {
    let isCancelled = false;

    const renderMap = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const width = container.clientWidth || 320;
      const heightPx = (height && height > 0) ? height : (container.clientHeight || 120);
      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

      // Scale canvas for high-DPI retina screens while keeping CSS dimensions fluid via container
      canvas.width = width * dpr;
      canvas.height = heightPx * dpr;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      // Web Mercator calculation for target center point
      const tileSize = 256;
      const centerTile = latLonToTileFraction(lat, lng, zoom);
      const centerPixelX = centerTile.x * tileSize;
      const centerPixelY = centerTile.y * tileSize;

      const topLeftPixelX = centerPixelX - width / 2;
      const topLeftPixelY = centerPixelY - heightPx / 2;

      const minTileX = Math.floor(topLeftPixelX / tileSize);
      const maxTileX = Math.floor((topLeftPixelX + width) / tileSize);
      const minTileY = Math.floor(topLeftPixelY / tileSize);
      const maxTileY = Math.floor((topLeftPixelY + heightPx) / tileSize);

      const maxNumTiles = Math.pow(2, zoom);

      // Background placeholder tone: darker slate for satellite, light slate for roadmap
      ctx.fillStyle = activeType === 'satellite' ? '#1e293b' : '#e2e8f0';
      ctx.fillRect(0, 0, width, heightPx);

      setIsLoading(true);

      const tilePromises: Promise<void>[] = [];

      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          const wrappedX = ((x % maxNumTiles) + maxNumTiles) % maxNumTiles;
          if (y >= 0 && y < maxNumTiles) {
            // Esri World Imagery uses tile/{z}/{y}/{x} with CORS enabled; OSM uses tile/{z}/{x}/{y}.png
            const tileUrl = activeType === 'satellite'
              ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${wrappedX}`
              : `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;

            const drawX = (x * tileSize) - topLeftPixelX;
            const drawY = (y * tileSize) - topLeftPixelY;

            const p = loadTileImage(tileUrl)
              .then((img) => {
                if (!isCancelled && ctx) {
                  ctx.drawImage(img, drawX, drawY, tileSize, tileSize);
                }
              })
              .catch(() => {
                // Ignore missing tile errors gracefully
              });

            tilePromises.push(p);
          }
        }
      }

      await Promise.allSettled(tilePromises);
      if (isCancelled) return;

      setIsLoading(false);

      // Draw red location marker pin in the exact center
      const markerX = width / 2;
      const markerY = heightPx / 2;

      // Pulse aura circle
      ctx.beginPath();
      ctx.arc(markerX, markerY, 14, 0, 2 * Math.PI);
      ctx.fillStyle = activeType === 'satellite' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.2)';
      ctx.fill();

      // Outer white ring
      ctx.beginPath();
      ctx.arc(markerX, markerY, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = activeType === 'satellite' ? '#0f172a' : '#cbd5e1';
      ctx.stroke();

      // Inner red pin dot
      ctx.beginPath();
      ctx.arc(markerX, markerY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // Attribution badge
      const attrText = activeType === 'satellite' ? '© Esri, Maxar' : '© OpenStreetMap';
      ctx.font = '9px system-ui, -apple-system, sans-serif';
      const textWidth = ctx.measureText(attrText).width;
      const badgeW = textWidth + 8;
      const badgeH = 14;
      const badgeX = width - badgeW - 4;
      const badgeY = heightPx - badgeH - 4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.fillStyle = '#334155';
      ctx.fillText(attrText, badgeX + 4, badgeY + 10);
    };

    renderMap();

    // Re-render on container resize & before printing
    const handleResize = () => {
      renderMap();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeprint', handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        renderMap();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeprint', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [lat, lng, zoom, height, activeType]);

  return (
    <div
      ref={containerRef}
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%',
        height: height ? `${height}px` : '100%',
        flex: height ? undefined : 1,
        minHeight: '75px',
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
        background: activeType === 'satellite' ? '#0f172a' : '#f1f5f9',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      title={onClick ? 'Nhấp để xem bản đồ lớn' : undefined}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Layer switch pill toggle (Roadmap vs Satellite) */}
      {allowToggleType && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(4px)',
            borderRadius: '4px',
            padding: '1px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            zIndex: 10,
            fontSize: '0.68rem',
            fontWeight: 600,
            userSelect: 'none'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveType('roadmap')}
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              border: 'none',
              background: activeType === 'roadmap' ? 'var(--primary)' : 'transparent',
              color: activeType === 'roadmap' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
          >
            Bản đồ
          </button>
          <button
            type="button"
            onClick={() => setActiveType('satellite')}
            style={{
              padding: '2px 6px',
              borderRadius: '3px',
              border: 'none',
              background: activeType === 'satellite' ? 'var(--primary)' : 'transparent',
              color: activeType === 'satellite' ? '#ffffff' : '#475569',
              cursor: 'pointer',
              fontSize: '0.68rem',
              fontWeight: 600,
              transition: 'all 0.15s ease'
            }}
          >
            Vệ tinh
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: activeType === 'satellite' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(248, 250, 252, 0.6)',
          fontSize: '0.72rem',
          color: activeType === 'satellite' ? '#94a3b8' : '#64748b'
        }}>
          Đang tải {activeType === 'satellite' ? 'ảnh vệ tinh' : 'bản đồ'}...
        </div>
      )}
    </div>
  );
};
