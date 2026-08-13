import { to5SFileName } from '../formUtils';

export function triggerBrowserDownload(pdfBytes: Uint8Array, formTitle: string): void {
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const downloadUrl = URL.createObjectURL(blob);

  const fileName = `FORM_${to5SFileName(formTitle || 'ISO_Document')}.pdf`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
