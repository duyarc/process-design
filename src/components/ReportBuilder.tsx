import React, { useState, useEffect } from 'react';
import type {
  ReportTemplateISO,
  ReportBlockConfig,
  ReportBlockType,
  FormTemplateISO,
  FormFieldISO,
  Submission,
  ReportDataModel
} from '../types';
import { computeRecordReport } from '../utils/reportCompute';
import ConfirmModal from './common/ConfirmModal';
import PrintReport from './print/PrintReport';
import {
  FileText,
  Trash2,
  ArrowUp,
  ArrowDown,
  Printer,
  Save,
  CheckCircle,
  X,
  RotateCcw,
  Layers,
  Search
} from 'lucide-react';

interface ReportBuilderProps {
  initialReportId?: string;
  initialFormId?: string;
  onSave?: (template: ReportTemplateISO) => void;
  onClose: () => void;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  initialReportId,
  initialFormId,
  onSave,
  onClose
}) => {
  const [template, setTemplate] = useState<ReportTemplateISO>({
    reportId: initialReportId || (initialFormId ? `RP-${initialFormId}` : 'RP-NEW'),
    reportTitle: 'BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG',
    linkedFormId: initialFormId || '',
    reportType: 'RECORD',
    status: 'DRAFT',
    version: 'v1.0',
    effectiveDate: new Date().toISOString().split('T')[0],
    layoutBlocks: [],
    revisionHistory: []
  });

  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'properties' | 'versions'>('properties');
  const [availableForms, setAvailableForms] = useState<FormTemplateISO[]>([]);
  const [selectedForm, setSelectedForm] = useState<FormTemplateISO | null>(null);
  const [sampleSubmissions, setSampleSubmissions] = useState<Submission[]>([]);
  const [sampleSubmission, setSampleSubmission] = useState<Submission | null>(null);
  const [computedData, setComputedData] = useState<ReportDataModel | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [searchFieldQuery, setSearchFieldQuery] = useState<string>('');

  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [publishVersion, setPublishVersion] = useState<string>('v1.0');
  const [publishChangeSummary, setPublishChangeSummary] = useState<string>('Khởi tạo cấu hình báo cáo');
  const [publishEffectiveDate, setPublishEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const formsRes = await fetch('/api/forms');
        if (formsRes.ok) {
          const formsData = await formsRes.json();
          const map = new Map<string, FormTemplateISO>();
          formsData.forEach((f: any) => {
            const fid = f.formId || f.form_id;
            if (!map.has(fid) || f.status === 'ACTIVE') {
              map.set(fid, {
                formId: fid,
                formTitle: f.formTitle || f.form_name || fid,
                version: f.version || 'v1.0',
                status: f.status || 'DRAFT',
                layoutBlocks: f.layoutBlocks || f.layout_blocks || [],
                revisionHistory: f.revisionHistory || f.revision_history || []
              });
            }
          });
          const formList = Array.from(map.values());
          setAvailableForms(formList);

          const targetFormId = initialFormId || template.linkedFormId || (formList[0]?.formId || '');
          if (targetFormId) {
            const matched = formList.find(f => f.formId === targetFormId) || formList[0];
            setSelectedForm(matched || null);
            setTemplate(prev => ({
              ...prev,
              linkedFormId: targetFormId,
              reportId: prev.reportId === 'RP-NEW' ? `RP-${targetFormId}` : prev.reportId
            }));
            fetchSubmissionsForForm(targetFormId);
          }
        }

        if (initialReportId) {
          const repRes = await fetch(`/api/reports/${initialReportId}`);
          if (repRes.ok) {
            const repData = await repRes.json();
            setTemplate(repData);
            if (repData.linkedFormId) {
              fetchSubmissionsForForm(repData.linkedFormId);
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize ReportBuilder:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [initialReportId, initialFormId]);

  const fetchSubmissionsForForm = async (formId: string) => {
    try {
      const res = await fetch(`/api/submissions?formId=${formId}`);
      if (res.ok) {
        const data = await res.json();
        setSampleSubmissions(data);
        if (data.length > 0) {
          setSampleSubmission(data[0]);
        }
      }
    } catch (e) {
      console.warn('No sample submissions found for form:', formId);
    }
  };

  useEffect(() => {
    if (selectedForm && sampleSubmission) {
      const computed = computeRecordReport(sampleSubmission, selectedForm, template);
      setComputedData(computed);
    } else {
      setComputedData(null);
    }
  }, [template, selectedForm, sampleSubmission]);

  const getSampleValue = (fid: string): string => {
    if (!sampleSubmission?.formData) return '—';
    if (Array.isArray(sampleSubmission.formData)) {
      const item = (sampleSubmission.formData as any[]).find(s => s.id === fid);
      return item?.value !== undefined ? String(item.value) : '—';
    }
    const val = (sampleSubmission.formData as any)[fid];
    return val !== undefined ? String(val) : '—';
  };

  const sampleSubmittedAtText = (sampleSubmission as any)?.submittedAt || (sampleSubmission as any)?.submitted_at
    ? new Date((sampleSubmission as any).submittedAt || (sampleSubmission as any).submitted_at).toLocaleDateString('vi-VN')
    : '—';

  const sampleOperatorText = (sampleSubmission as any)?.operatorId || (sampleSubmission as any)?.operator_id || '—';
  const sampleSupervisorText = (sampleSubmission as any)?.supervisorSignoff?.signedBy || (sampleSubmission as any)?.supervisor_signoff?.supervisor_name || '';

  const handleAddBlock = (type: ReportBlockType) => {
    const newId = `rep_block_${Date.now()}`;
    let title = 'Tiêu đề khối';
    let boundFieldIds: string[] = [];

    if (type === 'TITLE') {
      title = template.reportTitle || 'BÁO CÁO KIỂM ĐỊNH';
    } else if (type === 'SECTION_LABEL') {
      title = '1. THÔNG TIN ĐÁNH GIÁ';
    } else if (type === 'INFO_GRID') {
      title = 'Thông tin chung';
      if (selectedForm) {
        boundFieldIds = selectedForm.layoutBlocks
          .flatMap(b => b.fields || [])
          .filter(f => f.type === 'text' || f.type === 'date' || f.type === 'time')
          .slice(0, 4)
          .map(f => f.id);
      }
    } else if (type === 'TABLE') {
      title = 'Bảng đánh giá thông số & quy cách (Specs vs Actual)';
      if (selectedForm) {
        boundFieldIds = selectedForm.layoutBlocks
          .flatMap(b => b.fields || [])
          .filter(f => f.type === 'number' || f.type === 'radio' || f.type === 'checkbox')
          .map(f => f.id);
      }
    } else if (type === 'SIGN') {
      title = 'Xác nhận & Thẩm định';
      if (selectedForm) {
        boundFieldIds = selectedForm.layoutBlocks
          .flatMap(b => b.fields || [])
          .filter(f => f.type === 'signature')
          .map(f => f.id);
      }
    }

    const newBlock: ReportBlockConfig = {
      id: newId,
      type,
      title,
      boundFieldIds,
      columns: type === 'INFO_GRID' ? 2 : 1,
      borderStyle: 'grid'
    };

    setTemplate(prev => ({
      ...prev,
      layoutBlocks: [...prev.layoutBlocks, newBlock]
    }));
    setActiveBlockId(newId);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const blocks = [...template.layoutBlocks];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const temp = blocks[index];
    blocks[index] = blocks[targetIdx];
    blocks[targetIdx] = temp;
    setTemplate(prev => ({ ...prev, layoutBlocks: blocks }));
  };

  const handleDeleteBlock = (blockId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xoá khối báo cáo',
      message: 'Bạn có chắc chắn muốn xoá khối này khỏi báo cáo?',
      onConfirm: () => {
        setTemplate(prev => ({
          ...prev,
          layoutBlocks: prev.layoutBlocks.filter(b => b.id !== blockId)
        }));
        if (activeBlockId === blockId) setActiveBlockId(null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleFormChange = (formId: string) => {
    const matched = availableForms.find(f => f.formId === formId);
    if (!matched) return;
    setSelectedForm(matched);
    setTemplate(prev => ({
      ...prev,
      linkedFormId: formId,
      reportId: prev.status === 'DRAFT' && prev.reportId.startsWith('RP-') ? `RP-${formId}` : prev.reportId
    }));
    fetchSubmissionsForForm(formId);
  };

  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save draft');
      }
      const saved = await res.json();
      setTemplate(saved);
      if (onSave) onSave(saved);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu bản nháp.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setSaving(true);
      const newEntry = {
        version: publishVersion,
        date: publishEffectiveDate,
        author: 'Quality Engineer',
        change: publishChangeSummary,
        layoutBlocks: template.layoutBlocks
      };

      const payload: ReportTemplateISO = {
        ...template,
        version: publishVersion,
        status: 'ACTIVE',
        effectiveDate: publishEffectiveDate,
        revisionHistory: [newEntry, ...template.revisionHistory]
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, allowActiveUpdate: true })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to publish');
      }

      const published = await res.json();
      setTemplate(published);
      setShowPublishModal(false);
      if (onSave) onSave(published);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xuất bản báo cáo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = (rev: any) => {
    if (!rev.layoutBlocks) return;
    setConfirmModal({
      isOpen: true,
      title: 'Khôi phục phiên bản',
      message: `Khôi phục cấu hình layout từ phiên bản ${rev.version} (${rev.date})? Các chỉnh sửa chưa lưu sẽ bị ghi đè.`,
      onConfirm: () => {
        setTemplate(prev => ({
          ...prev,
          layoutBlocks: rev.layoutBlocks,
          status: 'DRAFT'
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const activeBlock = template.layoutBlocks.find(b => b.id === activeBlockId);

  const toggleFieldInBlock = (fieldId: string) => {
    if (!activeBlock) return;
    const current = activeBlock.boundFieldIds || [];
    const updated = current.includes(fieldId)
      ? current.filter(id => id !== fieldId)
      : [...current, fieldId];

    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b =>
        b.id === activeBlock.id ? { ...b, boundFieldIds: updated } : b
      )
    }));
  };

  const updateRuleOverride = (fieldId: string, updates: any) => {
    if (!activeBlock) return;
    const overrides = { ...(activeBlock.ruleOverrides || {}) };
    overrides[fieldId] = {
      ...(overrides[fieldId] || { fieldId }),
      ...updates
    };

    setTemplate(prev => ({
      ...prev,
      layoutBlocks: prev.layoutBlocks.map(b =>
        b.id === activeBlock.id ? { ...b, ruleOverrides: overrides } : b
      )
    }));
  };

  const allFormFields: FormFieldISO[] = (selectedForm?.layoutBlocks || []).flatMap(b => b.fields || []);
  const filteredFormFields = allFormFields.filter(f =>
    (f.checkItem || f.id).toLowerCase().includes(searchFieldQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải Report Builder...</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* ── Top Action Bar ── */}
      <div style={{ height: '56px', background: '#ffffff', borderBottom: '1px solid var(--neutral-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.25rem', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem' }}>
            <FileText size={18} />
            <span>Report Builder</span>
          </div>
          <span style={{ color: 'var(--neutral-border)' }}>|</span>
          <input
            type="text"
            value={template.reportId}
            onChange={e => setTemplate({ ...template, reportId: e.target.value.toUpperCase() })}
            placeholder="Mã báo cáo (e.g. RP-QC-F01)"
            style={{ fontWeight: 600, fontSize: '0.85rem', padding: '0.2rem 0.5rem', width: '130px', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
          />
          <input
            type="text"
            value={template.reportTitle}
            onChange={e => setTemplate({ ...template, reportTitle: e.target.value })}
            placeholder="Tiêu đề báo cáo..."
            style={{ fontWeight: 600, fontSize: '0.85rem', padding: '0.2rem 0.5rem', width: '280px', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
          />
          <span className="badge" style={{
            background: template.status === 'ACTIVE' ? '#dcfce7' : '#fef9c3',
            color: template.status === 'ACTIVE' ? '#15803d' : '#854d0e',
            border: `1px solid ${template.status === 'ACTIVE' ? '#86efac' : '#fde047'}`,
            fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600
          }}>
            {template.version} {template.status}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowPrintPreview(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Printer size={14} /> In thử A4
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSaveDraft}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Save size={14} /> Lưu nháp
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowPublishModal(true)}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <CheckCircle size={14} /> Xuất bản
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '0.35rem 0.6rem' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Main 3-Panel Workspace ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* ── LEFT PANEL: Source & Field Data Tray ── */}
        <div style={{ width: '280px', background: '#ffffff', borderRight: '1px solid var(--neutral-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--neutral-border)', background: '#f8fafc' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              1. NGUỒN FORM MẪU (SOURCE FORM)
            </label>
            <select
              value={template.linkedFormId}
              onChange={e => handleFormChange(e.target.value)}
              style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
            >
              {availableForms.map(f => (
                <option key={f.formId} value={f.formId}>
                  {f.formId} - {f.formTitle}
                </option>
              ))}
            </select>
          </div>

          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--neutral-border)', background: '#ffffff' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
              2. DỮ LIỆU MẪU ĐỂ PREVIEW (SAMPLE SUBMISSION)
            </label>
            <select
              value={sampleSubmission?.id || ''}
              onChange={e => {
                const found = sampleSubmissions.find(s => s.id === e.target.value);
                if (found) setSampleSubmission(found);
              }}
              style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
            >
              {sampleSubmissions.length === 0 ? (
                <option value="">(Chưa có lượt nộp mẫu)</option>
              ) : (
                sampleSubmissions.map((s, idx) => {
                  const op = (s as any).operatorId || (s as any).operator_id || 'Operator';
                  const dt = (s as any).submittedAt || (s as any).submitted_at;
                  const dtText = dt ? new Date(dt).toLocaleDateString('vi-VN') : '';
                  return (
                    <option key={s.id} value={s.id}>
                      #{idx + 1} - {op} {dtText ? `(${dtText})` : ''}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Field Data Dictionary Tray */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                DANH MỤC TRƯỜNG DỮ LIỆU ({allFormFields.length})
              </span>
            </div>
            <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Tìm kiếm trường..."
                value={searchFieldQuery}
                onChange={e => setSearchFieldQuery(e.target.value)}
                style={{ width: '100%', padding: '0.3rem 0.5rem 0.3rem 1.6rem', fontSize: '0.75rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {filteredFormFields.map(field => {
                const isBoundToActive = activeBlock?.boundFieldIds?.includes(field.id);
                return (
                  <div
                    key={field.id}
                    onClick={() => activeBlock && toggleFieldInBlock(field.id)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: '4px',
                      border: `1px solid ${isBoundToActive ? 'var(--primary)' : 'var(--neutral-border)'}`,
                      background: isBoundToActive ? '#eff6ff' : '#ffffff',
                      cursor: activeBlock ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem'
                    }}
                    title={activeBlock ? 'Click để thêm/bớt khỏi khối đang chọn' : 'Chọn một khối ở giữa để gán trường này'}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{field.checkItem || field.id}</span>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>ID: {field.id}</div>
                    </div>
                    <span style={{
                      fontSize: '0.65rem',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '3px',
                      background: '#f1f5f9',
                      color: '#475569',
                      textTransform: 'uppercase',
                      fontWeight: 600
                    }}>
                      {field.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── CENTER PANEL: Blank A4 Layout Canvas ── */}
        <div style={{ flex: 1, background: '#f1f5f9', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* Block Adder Toolbar */}
          <div style={{ width: '100%', maxWidth: '698px', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--neutral-border)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Layers size={14} /> Thêm khối báo cáo:
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAddBlock('TITLE')} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                TITLE
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAddBlock('SECTION_LABEL')} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                SECTION
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAddBlock('INFO_GRID')} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                INFO_GRID
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAddBlock('TABLE')} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                TABLE
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleAddBlock('SIGN')} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                SIGN
              </button>
            </div>
          </div>

          {/* A4 Sheet Container */}
          <div
            className="paper-card"
            style={{
              width: '100%',
              maxWidth: '698px',
              minHeight: '842px',
              background: '#ffffff',
              padding: '1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {template.layoutBlocks.length === 0 ? (
              <div style={{ border: '2px dashed var(--neutral-border)', borderRadius: '8px', padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <FileText size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>Trang báo cáo đang trống (Blank Page)</h4>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>
                  Nhấp vào thanh công cụ bên trên để thêm khối <strong>TITLE</strong>, <strong>TABLE</strong>, hoặc <strong>SIGN</strong> vào trang.
                </p>
              </div>
            ) : (
              template.layoutBlocks.map((block, idx) => {
                const isActive = block.id === activeBlockId;
                return (
                  <div
                    key={block.id}
                    onClick={() => setActiveBlockId(block.id)}
                    style={{
                      border: `2px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                      borderRadius: '6px',
                      padding: '0.5rem',
                      position: 'relative',
                      background: isActive ? 'rgba(16, 163, 163, 0.02)' : 'transparent',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {/* Block Toolbar */}
                    {isActive && (
                      <div style={{ position: 'absolute', right: '4px', top: '-14px', background: '#ffffff', border: '1px solid var(--neutral-border)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px', zIndex: 5, boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'up'); }} disabled={idx === 0} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#64748b' }}>
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'down'); }} disabled={idx === template.layoutBlocks.length - 1} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#64748b' }}>
                          <ArrowDown size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px 4px', color: '#ef4444' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}

                    {/* Block Renderer based on Type */}
                    {block.type === 'TITLE' && (
                      <div style={{ border: '1px solid #000', padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{template.reportId}</div>
                        <h3 style={{ margin: '0.25rem 0', fontSize: '1.1rem', fontWeight: 700 }}>{block.title || template.reportTitle}</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.75rem', marginTop: '0.5rem', color: '#475569' }}>
                          <span>Form gốc: <strong>{template.linkedFormId}</strong></span>
                          <span>Ngày lập: <strong>{sampleSubmittedAtText}</strong></span>
                          <span>Người kiểm tra: <strong>{sampleOperatorText}</strong></span>
                        </div>
                      </div>
                    )}

                    {block.type === 'SECTION_LABEL' && (
                      <div style={{ background: '#f1f5f9', padding: '0.4rem 0.6rem', borderLeft: '3px solid var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                        {block.title}
                      </div>
                    )}

                    {block.type === 'INFO_GRID' && (
                      <div>
                        {block.title && <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.35rem' }}>{block.title}</div>}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${block.columns || 2}, 1fr)`, gap: '0.5rem', border: '1px solid #000', padding: '0.5rem' }}>
                          {(block.boundFieldIds || []).map(fid => {
                            const field = allFormFields.find(f => f.id === fid);
                            const val = getSampleValue(fid);
                            return (
                              <div key={fid} style={{ fontSize: '0.75rem' }}>
                                <span style={{ color: '#64748b' }}>{field?.checkItem || fid}: </span>
                                <strong>{val}</strong>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {block.type === 'TABLE' && (
                      <div>
                        {block.title && <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.35rem' }}>{block.title}</div>}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid #000' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #000' }}>
                              <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left', width: '30%' }}>Hạng mục kiểm tra</th>
                              <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '25%' }}>Quy cách / Tiêu chuẩn</th>
                              <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '20%' }}>Kết quả thực tế</th>
                              <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', width: '25%' }}>Đánh giá</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(block.boundFieldIds || []).map(fid => {
                              const field = allFormFields.find(f => f.id === fid);
                              const evalRes = computedData?.evaluations?.[fid];
                              const override = block.ruleOverrides?.[fid];
                              const min = override?.customMinSpec !== undefined ? override.customMinSpec : field?.minSpec;
                              const max = override?.customMaxSpec !== undefined ? override.customMaxSpec : field?.maxSpec;

                              let specText = field?.targetRange || '—';
                              if (min !== undefined && max !== undefined) specText = `${min} ~ ${max} ${field?.unit || ''}`;
                              else if (min !== undefined) specText = `≥ ${min} ${field?.unit || ''}`;
                              else if (max !== undefined) specText = `≤ ${max} ${field?.unit || ''}`;

                              const rawVal = getSampleValue(fid);
                              const status = evalRes?.status || 'PASS';

                              return (
                                <tr key={fid} style={{ borderBottom: '1px solid #000' }}>
                                  <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{field?.checkItem || fid}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>{specText}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{rawVal}</td>
                                  <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                                    <span style={{
                                      padding: '1px 6px',
                                      borderRadius: '3px',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      background: status === 'PASS' ? '#dcfce7' : status === 'FAIL' ? '#fee2e2' : '#f1f5f9',
                                      color: status === 'PASS' ? '#15803d' : status === 'FAIL' ? '#b91c1c' : '#475569'
                                    }}>
                                      {status === 'PASS' ? 'ĐẠT (PASS)' : status === 'FAIL' ? 'KHÔNG ĐẠT' : 'N/A'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {block.type === 'SIGN' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', border: '1px solid #000', padding: '0.75rem', textAlign: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>NGƯỜI KIỂM TRA</div>
                          <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                            {sampleOperatorText !== '—' ? `[Đã ký: ${sampleOperatorText}]` : '(Ký và ghi rõ họ tên)'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>NGƯỜI THẨM TRA (QA/QC)</div>
                          <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                            {sampleSupervisorText ? `[Thẩm tra: ${sampleSupervisorText}]` : '(Ký và ghi rõ họ tên)'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: Properties & Versions Inspector ── */}
        <div style={{ width: '320px', background: '#ffffff', borderLeft: '1px solid var(--neutral-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* Tabs header */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--neutral-border)', background: '#f8fafc' }}>
            <button
              onClick={() => setRightTab('properties')}
              style={{
                flex: 1,
                padding: '0.6rem 0',
                border: 'none',
                background: rightTab === 'properties' ? '#ffffff' : 'transparent',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: rightTab === 'properties' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: rightTab === 'properties' ? '2px solid var(--primary)' : 'none',
                cursor: 'pointer'
              }}
            >
              Thuộc tính (Properties)
            </button>
            <button
              onClick={() => setRightTab('versions')}
              style={{
                flex: 1,
                padding: '0.6rem 0',
                border: 'none',
                background: rightTab === 'versions' ? '#ffffff' : 'transparent',
                fontWeight: 600,
                fontSize: '0.8rem',
                color: rightTab === 'versions' ? 'var(--primary)' : 'var(--text-secondary)',
                borderBottom: rightTab === 'versions' ? '2px solid var(--primary)' : 'none',
                cursor: 'pointer'
              }}
            >
              Phiên bản (Versions)
            </button>
          </div>

          {/* Tab 1: Properties */}
          {rightTab === 'properties' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
              {activeBlock ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tiêu đề khối</label>
                    <input
                      type="text"
                      value={activeBlock.title}
                      onChange={e => {
                        const val = e.target.value;
                        setTemplate(prev => ({
                          ...prev,
                          layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, title: val } : b)
                        }));
                      }}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', marginTop: '0.25rem' }}
                    />
                  </div>

                  {activeBlock.type === 'INFO_GRID' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Số cột hiển thị</label>
                      <select
                        value={activeBlock.columns || 2}
                        onChange={e => {
                          const cols = parseInt(e.target.value, 10) as 1 | 2 | 3;
                          setTemplate(prev => ({
                            ...prev,
                            layoutBlocks: prev.layoutBlocks.map(b => b.id === activeBlock.id ? { ...b, columns: cols } : b)
                          }));
                        }}
                        style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', marginTop: '0.25rem' }}
                      >
                        <option value={1}>1 cột</option>
                        <option value={2}>2 cột</option>
                        <option value={3}>3 cột</option>
                      </select>
                    </div>
                  )}

                  {/* Field Rules Override Section */}
                  <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                      CẤU HÌNH QUY TẮC ĐÁNH GIÁ (HYBRID RULES)
                    </div>

                    {(activeBlock.boundFieldIds || []).map(fid => {
                      const field = allFormFields.find(f => f.id === fid);
                      const override = activeBlock.ruleOverrides?.[fid];
                      return (
                        <div key={fid} style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{field?.checkItem || fid}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                            Mặc định form: {field?.minSpec !== undefined ? `Min: ${field.minSpec}` : ''} {field?.maxSpec !== undefined ? `Max: ${field.maxSpec}` : ''} {field?.targetRange || ''}
                          </div>

                          {field?.type === 'number' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Custom Min</label>
                                <input
                                  type="number"
                                  placeholder={String(field?.minSpec ?? '')}
                                  value={override?.customMinSpec ?? ''}
                                  onChange={e => updateRuleOverride(fid, { customMinSpec: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                  style={{ width: '100%', padding: '0.2rem 0.35rem', fontSize: '0.75rem', border: '1px solid var(--neutral-border)', borderRadius: '3px' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Custom Max</label>
                                <input
                                  type="number"
                                  placeholder={String(field?.maxSpec ?? '')}
                                  value={override?.customMaxSpec ?? ''}
                                  onChange={e => updateRuleOverride(fid, { customMaxSpec: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                  style={{ width: '100%', padding: '0.2rem 0.35rem', fontSize: '0.75rem', border: '1px solid var(--neutral-border)', borderRadius: '3px' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
                  Nhấp chọn một khối trong trang canvas ở giữa để chỉnh sửa thuộc tính và quy tắc đánh giá.
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Versions */}
          {rightTab === 'versions' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                LỊCH SỬ PHIÊN BẢN (REVISION HISTORY)
              </div>
              {template.revisionHistory.length === 0 ? (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Chưa có phiên bản nào được lưu trong lịch sử.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {template.revisionHistory.map((rev, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid var(--neutral-border)', borderRadius: '4px', padding: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>{rev.version}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{rev.date}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>{rev.change || 'Không có mô tả'}</p>
                      {rev.layoutBlocks && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRestoreVersion(rev)}
                          style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <RotateCcw size={11} /> Khôi phục bản này
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Publish Modal ── */}
      {showPublishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="paper-card" style={{ width: '420px', background: '#ffffff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700 }}>Xuất bản Báo cáo chất lượng</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mã phiên bản (Version)</label>
                <input
                  type="text"
                  value={publishVersion}
                  onChange={e => setPublishVersion(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', marginTop: '0.25rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Ngày hiệu lực</label>
                <input
                  type="date"
                  value={publishEffectiveDate}
                  onChange={e => setPublishEffectiveDate(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', marginTop: '0.25rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nội dung thay đổi (Change Log)</label>
                <textarea
                  rows={3}
                  value={publishChangeSummary}
                  onChange={e => setPublishChangeSummary(e.target.value)}
                  placeholder="Mô tả tóm tắt các cập nhật trong phiên bản này..."
                  style={{ width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.85rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', marginTop: '0.25rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPublishModal(false)}>
                Huỷ
              </button>
              <button className="btn btn-primary btn-sm" onClick={handlePublish} disabled={saving}>
                Xác nhận xuất bản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Preview Portal ── */}
      {showPrintPreview && (
        <PrintReport
          template={template}
          submission={sampleSubmission || {
            id: 'SAMPLE-001',
            processId: 'PROC-001',
            formId: template.linkedFormId,
            formVersion: 'v1.0',
            operatorId: 'Operator',
            submittedAt: new Date().toISOString(),
            status: 'PASS',
            formData: []
          }}
          formTemplate={selectedForm || {
            formId: template.linkedFormId,
            formTitle: 'Source Form',
            version: 'v1.0',
            status: 'ACTIVE',
            layoutBlocks: [],
            revisionHistory: []
          }}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* ── Confirmation Modal ── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ReportBuilder;