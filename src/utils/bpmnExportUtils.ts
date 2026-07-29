/**
 * Utility module for exporting BPMN diagrams to Clipboard (PNG with white background)
 * and downloading as Vector SVG files.
 */

export interface ExportResult {
  success: boolean;
  message: string;
}

/**
 * Ensures the SVG string has an explicit white background rectangle
 * so that when copied/pasted into Microsoft Word, it does not display black transparency artifacts.
 */
function addWhiteBackgroundToSvg(svgString: string): string {
  // If a rect fill="#ffffff" or similar background is already present, return as is
  if (svgString.includes('rect id="bg_white_layer"')) {
    return svgString;
  }

  // Extract viewBox width and height from SVG tag
  const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/);
  let x = 0, y = 0, width = 1000, height = 600;
  if (viewBoxMatch && viewBoxMatch[1]) {
    const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      [x, y, width, height] = parts;
    }
  } else {
    const widthMatch = svgString.match(/width="(\d+)"/);
    const heightMatch = svgString.match(/height="(\d+)"/);
    if (widthMatch) width = parseInt(widthMatch[1], 10);
    if (heightMatch) height = parseInt(heightMatch[1], 10);
  }

  const whiteRect = `<rect id="bg_white_layer" x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffff" />`;
  
  // Insert rect right after <svg ...> closing bracket
  return svgString.replace(/(<svg[^>]*>)/i, `$1\n  ${whiteRect}`);
}

/**
 * Renders SVG string onto an HTML5 Canvas at 2x High-DPI resolution and returns PNG Blob.
 */
function svgToPngBlob(svgString: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgWithBg = addWhiteBackgroundToSvg(svgString);

    // Extract SVG dimensions
    let width = 1000;
    let height = 600;
    const viewBoxMatch = svgWithBg.match(/viewBox="([^"]+)"/);
    if (viewBoxMatch && viewBoxMatch[1]) {
      const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
      if (parts.length === 4 && !parts.some(isNaN)) {
        width = parts[2];
        height = parts[3];
      }
    }

    const scale = 2; // 2x High-DPI (300 DPI equivalent)
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(100, Math.round(width * scale));
    canvas.height = Math.max(100, Math.round(height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    // Fill canvas background with solid white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const blobSvg = new Blob([svgWithBg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blobSvg);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob from canvas'));
        }
      }, 'image/png');
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Copies the BPMN diagram as a high-resolution PNG image with solid white background to the system Clipboard.
 * Ready for 1-Click Ctrl+V paste directly into Microsoft Word / Google Docs.
 */
export async function copyBpmnToClipboard(viewerOrModeler: any): Promise<ExportResult> {
  if (!viewerOrModeler) {
    return { success: false, message: 'BPMN Engine chưa sẵn sàng' };
  }

  try {
    let svgString = '';
    if (typeof viewerOrModeler.saveSVG === 'function') {
      const result = await viewerOrModeler.saveSVG({ format: true });
      svgString = result.svg;
    } else {
      return { success: false, message: 'Không thể trích xuất mã SVG từ sơ đồ' };
    }

    const pngBlob = await svgToPngBlob(svgString);

    // Try Clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.write === 'function') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      return {
        success: true,
        message: 'Đã sao chép sơ đồ! Bạn có thể dán (Ctrl+V) trực tiếp vào Word.'
      };
    } else {
      // Fallback download if clipboard is restricted
      const url = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bpmn-diagram.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return {
        success: true,
        message: 'Đã tải ảnh sơ đồ (.png) về máy tính do trình duyệt hạn chế bộ nhớ tạm.'
      };
    }
  } catch (err: any) {
    console.error('Error copying BPMN to clipboard:', err);
    return {
      success: false,
      message: `Không thể sao chép sơ đồ: ${err?.message || 'Lỗi không xác định'}`
    };
  }
}

/**
 * Downloads the BPMN diagram as a vector SVG file (.svg).
 */
export async function downloadBpmnVectorFile(viewerOrModeler: any, processName?: string): Promise<ExportResult> {
  if (!viewerOrModeler) {
    return { success: false, message: 'BPMN Engine chưa sẵn sàng' };
  }

  try {
    let svgString = '';
    if (typeof viewerOrModeler.saveSVG === 'function') {
      const result = await viewerOrModeler.saveSVG({ format: true });
      svgString = result.svg;
    } else {
      return { success: false, message: 'Không thể trích xuất mã SVG từ sơ đồ' };
    }

    const svgWithBg = addWhiteBackgroundToSvg(svgString);
    const blob = new Blob([svgWithBg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const safeName = (processName || 'so-do-quy-trinh').replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: 'Đã tải tệp sơ đồ (.svg) về máy tính thành công!'
    };
  } catch (err: any) {
    console.error('Error downloading BPMN SVG file:', err);
    return {
      success: false,
      message: `Không thể tải tệp SVG: ${err?.message || 'Lỗi không xác định'}`
    };
  }
}
