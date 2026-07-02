import React from 'react';
import type { FormTemplateISO } from '../../types';

interface PrintBlankFormProps {
  template: FormTemplateISO;
  onClose: () => void;
}

export default function PrintBlankForm({ template, onClose }: PrintBlankFormProps) {
  // Trigger print dialog immediately on mount
  React.useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Print Preview Mode</span>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Blank Form: {template.formTitle}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            Print Form
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
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>QUALITY CONTROL DOCUMENT</span>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase' }}>{template.formTitle}</h1>
        </div>
        <div style={{
          textAlign: 'right',
          fontSize: '0.8rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <div>Document ID: <strong>{template.formId}</strong></div>
          <div>Version Status: <strong>{template.version}</strong></div>
          <div>Status: <span style={{ fontWeight: 'bold' }}>{template.status}</span></div>
        </div>
      </div>

      {/* ISO ZONE 1.1: Physical Filling Metadata (Blank) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '25px',
        fontSize: '0.9rem',
        padding: '0 5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span>Operator Name:</span>
          <div style={{ flex: 1, borderBottom: '1px solid #000000', minHeight: '20px' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span>Date:</span>
            <div style={{ flex: 1, borderBottom: '1px solid #000000', minHeight: '20px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span>Shift:</span>
            <div style={{ flex: 1, borderBottom: '1px solid #000000', minHeight: '20px' }} />
          </div>
        </div>
      </div>

      {/* ISO ZONE 2: Core Checks Table */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '30px'
      }}>
        <thead>
          <tr>
            <th style={{ width: '40px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>No.</th>
            <th style={{ border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'left' }}>Check Item</th>
            <th style={{ width: '90px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Location</th>
            <th style={{ width: '100px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Frequency</th>
            <th style={{ width: '150px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'left' }}>Specification / Target</th>
            <th style={{ width: '150px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Actual State</th>
            <th style={{ width: '100px', border: '1px solid #000000', padding: '8px', background: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {template.fields && template.fields.map((field, idx) => {
            let specLabel = '';
            if (field.type === 'number') {
              specLabel = `${field.minSpec} - ${field.maxSpec} ${field.unit}`;
            } else {
              specLabel = field.targetRange || 'Standard';
            }

            return (
              <tr key={field.id} style={{ pageBreakInside: 'avoid' }}>
                <td style={{ border: '1px solid #000000', padding: '10px 8px', textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000000', padding: '10px 8px', fontWeight: 600 }}>{field.checkItem}</td>
                <td style={{ border: '1px solid #000000', padding: '10px 8px', textAlign: 'center' }}>{field.locationCode || 'N/A'}</td>
                <td style={{ border: '1px solid #000000', padding: '10px 8px', textAlign: 'center' }}>{field.frequency}</td>
                <td style={{ border: '1px solid #000000', padding: '10px 8px' }}>{specLabel}</td>
                <td style={{ border: '1px solid #000000', padding: '10px 8px', textAlign: 'center' }}>
                  {field.type === 'checkbox' ? (
                    <span style={{ fontSize: '0.8rem' }}>[  ] OK &nbsp;&nbsp; [  ] FAIL</span>
                  ) : field.type === 'photo' ? (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Photo logged [  ]</span>
                  ) : (
                    <div style={{ borderBottom: '1px dashed #94a3b8', width: '80%', height: '14px', margin: '0 auto' }} />
                  )}
                </td>
                <td style={{ border: '1px solid #000000', padding: '10px 8px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8' }}>
                  P / F
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ISO ZONE 3: Reaction Protocols (No Check Without Consequence) */}
      <div style={{
        border: '1px solid #000000',
        padding: '12px',
        marginBottom: '30px',
        pageBreakInside: 'avoid'
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#b45309' }}>
          ⚠️ Immediate Reaction Protocol (If any actual check fails)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
          {template.fields && template.fields.map((field, idx) => (
            <div key={field.id} style={{ display: 'flex', gap: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>{idx + 1}.</span>
              <div>
                <strong>{field.checkItem} ({field.locationCode || 'N/A'}):</strong>{' '}
                <span style={{ fontStyle: 'italic' }}>{field.reactionProtocol || 'Notify supervisor immediately.'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ISO ZONE 4: Physical Sign-off Blocks */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '40px',
        marginTop: '40px',
        marginBottom: '40px',
        pageBreakInside: 'avoid'
      }}>
        <div style={{
          border: '1px solid #000000',
          padding: '15px',
          height: '80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Operator Signature</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
            <span>Sign: ________________________</span>
            <span>Date: ____ / ____ / ________</span>
          </div>
        </div>
        
        <div style={{
          border: '1px solid #000000',
          padding: '15px',
          height: '80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Supervisor Sign-off & Verification</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b' }}>
            <span>Sign: ________________________</span>
            <span>Date: ____ / ____ / ________</span>
          </div>
        </div>
      </div>

      {/* ISO ZONE 5: Document Revision History Table */}
      <div style={{ borderTop: '2px solid #000000', paddingTop: '15px', pageBreakInside: 'avoid' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
          Document Revision History Log
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.75rem', background: '#f8fafc' }}>Version</th>
              <th style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.75rem', background: '#f8fafc' }}>Effective Date</th>
              <th style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.75rem', background: '#f8fafc' }}>Author</th>
              <th style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.75rem', background: '#f8fafc' }}>Change Description</th>
            </tr>
          </thead>
          <tbody>
            {template.revisionHistory && template.revisionHistory.length > 0 ? (
              template.revisionHistory.map((rev, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.7rem', textAlign: 'center' }}>{rev.version}</td>
                  <td style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.7rem', textAlign: 'center' }}>{rev.date}</td>
                  <td style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.7rem' }}>{rev.author}</td>
                  <td style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.7rem' }}>{rev.change}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ border: '1px solid #000000', padding: '5px', fontSize: '0.7rem', textAlign: 'center', color: '#64748b' }}>
                  No published revisions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
