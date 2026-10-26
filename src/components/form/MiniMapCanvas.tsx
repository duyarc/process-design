import React, { useEffect, useRef, useState } from 'react';

export interface MiniMapCanvasProps {
  lat: number;
  lng: number;
  zoom?: number;
  height?: number;
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
 * Pure HTML5 Canvas OSM Tile Stitcher Mini Map.
 * Renders an OpenStreetMap thumbnail without any external GIS libraries or API keys.
 * Fully compatible with React 19, mobile touch scrolling (no scroll trap), and print/PDF export.
 */
export const MiniMapCanvas: React.FC<MiniMapCanvasProps> = ({
  lat,
  lng,
  zoom = 15,
  height = 130,
  className,
  style,
  onClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    const renderMap = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const width = container.clientWidth || 320;
      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

      // Scale canvas for high-DPI retina screens while keeping CSS dimensions constant
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      // Web Mercator calculation for target center point
      const tileSize = 256;
      const centerTile = latLonToTileFraction(lat, lng, zoom);
      const centerPixelX = centerTile.x * tileSize;
      const centerPixelY = centerTile.y * tileSize;

      const topLeftPixelX = centerPixelX - width / 2;
      const topLeftPixelY = centerPixelY - height / 2;

      const minTileX = Math.floor(topLeftPixelX / tileSize);
      const maxTileX = Math.floor((topLeftPixelX + width) / tileSize);
      const minTileY = Math.floor(topLeftPixelY / tileSize);
      const maxTileY = Math.floor((topLeftPixelY + height) / tileSize);

      const maxNumTiles = Math.pow(2, zoom);

      // Clear previous canvas
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, width, height);

      setIsLoading(true);

      const tilePromises: Promise<void>[] = [];

      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          const wrappedX = ((x % maxNumTiles) + maxNumTiles) % maxNumTiles;
          if (y >= 0 && y < maxNumTiles) {
            const tileUrl = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
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
      const markerY = height / 2;

      // Pulse aura circle
      ctx.beginPath();
      ctx.arc(markerX, markerY, 14, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.fill();

      // Outer white ring
      ctx.beginPath();
      ctx.arc(markerX, markerY, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      // Inner red pin dot
      ctx.beginPath();
      ctx.arc(markerX, markerY, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      // OSM attribution badge
      const attrText = '© OpenStreetMap';
      ctx.font = '9px system-ui, -apple-system, sans-serif';
      const textWidth = ctx.measureText(attrText).width;
      const badgeW = textWidth + 8;
      const badgeH = 14;
      const badgeX = width - badgeW - 4;
      const badgeY = height - badgeH - 4;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.fillStyle = '#475569';
      ctx.fillText(attrText, badgeX + 4, badgeY + 10);
    };

    renderMap();

    // Re-render on container resize
    const handleResize = () => {
      renderMap();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
    };
  }, [lat, lng, zoom, height]);

  return (
    <div
      ref={containerRef}
      className={className}
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%',
        height: `${height}px`,
        borderRadius: '4px',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
        background: '#f1f5f9',
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
      title={onClick ? 'Nhấp để xem bản đồ lớn' : undefined}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {isLoading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(248, 250, 252, 0.6)',
          fontSize: '0.72rem',
          color: '#64748b'
        }}>
          Đang tải bản đồ...
        </div>
      )}
    </div>
  );
};
