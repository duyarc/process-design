import React, { useState, useEffect } from 'react';
import type { Submission } from '../../types';

interface PrintRecordProps {
  submission: Submission;
  processTitle: string;
  onClose: () => void;
}

export default function PrintRecord({ submission, processTitle, onClose }: PrintRecordProps) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);

  // 1. Fetch presigned download URLs for photo evidence on mount
  useEffect(() => {
    const fetchImages = async () => {
      if (!submission.mediaUrls || submission.mediaUrls.length === 0) return;
      try {
        setLoadingImages(true);
        const resolvedUrls = await Promise.all(
          submission.mediaUrls.map(async (key) => {
            const res = await fetch(`/api/storage/download-url?key=${encodeURIComponent(key)}`);
            if (!res.ok) throw new Error('Failed to resolve image URL');
            const { downloadUrl } = await res.json();
            return downloadUrl;
          })
        );
        setImageUrls(resolvedUrls);
      } catch (err) {
        console.error('Error loading photo evidence:', err);
      } finally {
        setLoadingImages(false);
      }
    };

    fetchImages();
  }, [submission]);

  // 2. Trigger print dialog after images loaded
  useEffect(() => {
    if (!loadingImages) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [loadingImages]);

  const hasAbnormality = submission.status === 'FAIL' || submission.status === 'ABNORMALITY';

  return (
    <div className="print-container" style={{
      padding: '20px',
      background: '#ffffff',
      color: '#000000',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Dynamic CSS override to force portrait printing */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 15mm !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Close button (only visible on screen) */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '1rem',
        borderBottom: '1px solid #cbd5e1',
        marginBottom: '2rem'
      }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Print Record View</span>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Checksheet Record ID: {submission.id}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Print Record
          </button>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Back
          </button>
        </div>
      </div>

      {/* ISO ZONE 1: Header Block */}
      <div style={{
        border: '2px solid #000000',
        padding: '12px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>QUALITY CONTROL COMPLIANCE RECORD</span>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase' }}>
            Process: {processTitle}
          </h1>
        </div>
        <div style={{
          textAlign: 'right',
          fontSize: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <div>Form ID: <strong>{submission.formId}</strong></div>
          <div>Form Rev: <strong>{submission.formVersion}</strong></div>
          <div>Record Status: <span style={{ fontWeight: 'bold', color: hasAbnormality ? '#ef4444' : '#10b981' }}>{submission.status}</span></div>
        </div>
      </div>

      {/* ISO ZONE 1.1: Verification & Audit Metadata */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: '20px',
        marginBottom: '25px',
        fontSize: '0.85rem',
        background: '#f8fafc',
        padding: '10px',
        border: '1px solid #e2e8f0',
        borderRadius: '4px'
      }}>
        <div>
          <div style={{ marginBottom: '4px' }}>Submission ID: <strong>{submission.id}</strong></div>
          <div>Operator ID: <strong>{submission.operatorId}</strong></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: '4px' }}>Submitted Time: <strong>{new Date(submission.submittedAt).toLocaleString()}</strong></div>
          <div>Supervisor Sign-off: <strong>{submission.supervisorSignoff ? 'VERIFIED' : 'PENDING REVIEW'}</strong></div>
        </div>
      </div>

      {/* ISO ZONE 2: Core Checks Table (Displays Snapshot) */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '25px'
      }}>
        <thead>
          <tr>
            <th style={{ width: '40px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>No.</th>
            <th style={{ border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'left' }}>Check Item</th>
            <th style={{ width: '90px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Location</th>
            <th style={{ width: '150px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'left' }}>Target Specification</th>
            <th style={{ width: '150px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Entered Value</th>
            <th style={{ width: '100px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {submission.formData && submission.formData.map((row, idx) => {
            const rowFailed = row.status === 'FAIL';
            return (
              <React.Fragment key={row.id}>
                <tr style={{ pageBreakInside: 'avoid', background: rowFailed ? '#fef2f2' : 'transparent' }}>
                  <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #000000', padding: '8px', fontWeight: 600 }}>{row.checkItem}</td>
                  <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center' }}>{row.locationCode || 'N/A'}</td>
                  <td style={{ border: '1px solid #000000', padding: '8px' }}>{row.targetRange}</td>
                  <td style={{ border: '1px solid #000000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{row.value}</td>
                  <td style={{ 
                    border: '1px solid #000000', 
                    padding: '8px', 
                    textAlign: 'center', 
                    fontWeight: 'bold',
                    color: rowFailed ? '#ef4444' : '#10b981'
                  }}>
                    {row.status}
                  </td>
                </tr>
                {/* Expand Reaction Logs Inline if failed */}
                {rowFailed && (
                  <tr style={{ pageBreakInside: 'avoid' }}>
                    <td colSpan={6} style={{ border: '1px solid #000000', padding: '10px 15px', background: '#fffbeb' }}>
                      <div style={{ fontSize: '0.8rem', color: '#b45309' }}>
                        <div style={{ marginBottom: '4px' }}>
                          <strong>⚠️ Target Violation Reaction Protocol:</strong> {row.reactionProtocol}
                        </div>
                        <div>
                          <strong>Operator Containment Log:</strong> {row.value === 'FAIL' ? 'Critical check failed.' : `Value [${row.value}] violates specs. Corrective actions applied.`}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {/* ISO ZONE 3: Photo Evidence Log (Images from Cloud R2) */}
      {imageUrls.length > 0 && (
        <div style={{ marginBottom: '30px', pageBreakInside: 'avoid' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Attached Photo Evidence Log
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            border: '1px solid #e2e8f0',
            padding: '15px',
            borderRadius: '6px'
          }}>
            {imageUrls.map((url, index) => (
              <div key={index} style={{ textAlign: 'center' }}>
                <img 
                  src={url} 
                  alt={`Photo Evidence ${index + 1}`} 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '180px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    objectFit: 'contain'
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                  Figure {index + 1}: Non-conformance log photo
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ISO ZONE 4: Document Signatures & Sign-off Block */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '40px',
        marginTop: '30px',
        marginBottom: '30px',
        pageBreakInside: 'avoid'
      }}>
        {/* Operator signature (Attributable) */}
        <div style={{
          border: '1px solid #000000',
          padding: '12px',
          height: '90px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Operator Verification</span>
          <div style={{ fontSize: '0.85rem' }}>
            User Name: <strong>{submission.operatorId}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
            <span>Sign: [Electronically Verified]</span>
            <span>Date: {new Date(submission.submittedAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        {/* Supervisor Sign-off */}
        <div style={{
          border: '1px solid #000000',
          padding: '12px',
          height: '90px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: submission.supervisorSignoff ? 'transparent' : '#fafafa'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Supervisor Sign-off & Verification</span>
          {submission.supervisorSignoff ? (
            <>
              <div style={{ fontSize: '0.82rem' }}>
                Name: <strong>{submission.supervisorSignoff.signedBy}</strong>
                {submission.supervisorSignoff.notes && (
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginLeft: '0.5rem' }}>
                    ({submission.supervisorSignoff.notes})
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b' }}>
                <span>Sign: [Verified Cloud Approval]</span>
                <span>Date: {new Date(submission.supervisorSignoff.signedAt).toLocaleDateString()}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
              Pending daily review & sign-off
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
