import React, { useState, useEffect } from 'react';
import type {
  ReportTemplateISO,
  ReportBlockConfig,
  ReportBlockType,
  ReportRevisionEntry,
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
  Grid,
  Table as TableIcon,
  PenTool,
  AlignLeft,
  Trash2,
  ArrowUp,
  ArrowDown,
  Printer,
  Save,
  Clock,
  Search,
  Sparkles,
  Plus
} from 'lucide-react';

const generateReportChangeSummary = (
  initialBlocks?: ReportBlockConfig[],
  currentBlocks?: ReportBlockConfig[],
  history?: ReportRevisionEntry[]
): string => {
  const hasActiveVersion = (history || []).some(
    h => h.status === 'ACTIVE' || h.change?.includes('Published') || h.change?.includes('Ban hành')
  );

  if (!hasActiveVersion) {
    return 'Ban hành cấu hình báo cáo lần đầu';
  }

  const current = currentBlocks || [];
  const initial = initialBlocks || [];
  const changes: string[] = [];

  const initialBlockMap = new Map<string, ReportBlockConfig>();
  initial.forEach(b => initialBlockMap.set(b.id, b));

  const currentBlockMap = new Map<string, ReportBlockConfig>();
  current.forEach(b => currentBlockMap.set(b.id, b));

  // 1. Detect added blocks
  current.forEach(b => {
    if (!initialBlockMap.has(b.id)) {
      const groupTitle = b.title || b.type;
      changes.push(`[BỔ SUNG] Bổ sung khối mới: "${groupTitle}"`);
    }
  });

  // 2. Detect removed blocks
  initial.forEach(b => {
    if (!currentBlockMap.has(b.id)) {
      const groupTitle = b.title || b.type;
      changes.push(`[XOÁ] Xoá khối: "${groupTitle}"`);
    }
  });

  // 3. Detect updated blocks / rules
  current.forEach(b => {
    const orig = initialBlockMap.get(b.id);
    if (orig) {
      if (b.title !== orig.title) {
        changes.push(`[ĐỔI TÊN] Đổi tiêu đề khối "${orig.title}" -> "${b.title}"`);
      }
      if (JSON.stringify(b.boundFieldIds) !== JSON.stringify(orig.boundFieldIds)) {
        changes.push(`[CẬP NHẬT] Cập nhật danh sách trường dữ liệu khối "${b.title || b.type}"`);
      }
      if (JSON.stringify(b.ruleOverrides) !== JSON.stringify(orig.ruleOverrides)) {
        changes.push(`[QUY TẮC] Điều chỉnh quy tắc đánh giá dung sai khối "${b.title || b.type}"`);
      }
    }
  });

  if (changes.length === 0) {
    return 'Cập nhật cấu hình và chuẩn hóa bố cục báo cáo';
  }

  return changes.slice(0, 5).join('\n');
};

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

  const [effectiveDate, setEffectiveDate] = useState<string>(template.effectiveDate || new Date().toISOString().split('T')[0]);
  const [changeSummary, setChangeSummary] = useState<string>('');
  const [viewingRevisionVersion, setViewingRevisionVersion] = useState<string | null>(null);
  const [draftBlocksSnapshot, setDraftBlocksSnapshot] = useState<ReportBlockConfig[] | null>(null);
  const [initialBlocks, setInitialBlocks] = useState<ReportBlockConfig[]>([]);

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
            setInitialBlocks(repData.layoutBlocks || []);
            if (repData.effectiveDate) setEffectiveDate(repData.effectiveDate);
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

  const verParts = (template.version || 'v1.0').replace('v', '').split('.');
  const major = parseInt(verParts[0], 10) || 1;
  const minor = parseInt(verParts[1], 10) || 0;

  const handleMajorChange = (newMajor: number) => {
    setTemplate(prev => ({
      ...prev,
      version: `v${newMajor}.${minor}`
    }));
  };

  const handleMinorChange = (newMinor: number) => {
    setTemplate(prev => ({
      ...prev,
      version: `v${major}.${newMinor}`
    }));
  };

  const handleCreateNewVersion = () => {
    const nextMinor = minor + 1;
    const nextVer = `v${major}.${nextMinor}`;
    setTemplate(prev => ({
      ...prev,
      version: nextVer,
      status: 'DRAFT'
    }));
    setChangeSummary('');
    setEffectiveDate(new Date().toISOString().split('T')[0]);
  };

  const handlePublish = async () => {
    let activeSummary = changeSummary.trim();
    if (!activeSummary) {
      activeSummary = generateReportChangeSummary(initialBlocks, template.layoutBlocks, template.revisionHistory);
      setChangeSummary(activeSummary);
    }

    if (!template.reportTitle.trim()) {
      alert('Vui lòng nhập Tiêu đề báo cáo trước khi xuất bản.');
      return;
    }

    const publishDate = effectiveDate || new Date().toISOString().split('T')[0];
    const newEntry: ReportRevisionEntry = {
      version: template.version,
      date: publishDate,
      author: 'Admin',
      change: activeSummary,
      status: 'ACTIVE',
      layoutBlocks: JSON.parse(JSON.stringify(template.layoutBlocks))
    };

    const updatedHistory = [newEntry, ...template.revisionHistory];

    try {
      setSaving(true);
      const payload: ReportTemplateISO = {
        ...template,
        status: 'ACTIVE',
        effectiveDate: publishDate,
        revisionHistory: updatedHistory
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
      setInitialBlocks(published.layoutBlocks || []);
      setChangeSummary('');
      if (onSave) onSave(published);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xuất bản báo cáo.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreRevision = (entry: ReportRevisionEntry) => {
    if (!entry.layoutBlocks || entry.layoutBlocks.length === 0) {
      alert(`Bản ghi phiên bản (${entry.version}) không có dữ liệu bố cục.`);
      return;
    }

    if (!draftBlocksSnapshot) {
      setDraftBlocksSnapshot(JSON.parse(JSON.stringify(template.layoutBlocks)));
    }
    setViewingRevisionVersion(entry.version);
    setTemplate(prev => ({
      ...prev,
      layoutBlocks: JSON.parse(JSON.stringify(entry.layoutBlocks))
    }));
  };

  const handleCommitRestore = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Khôi phục phiên bản',
      message: `Bạn có chắc muốn áp dụng toàn bộ bố cục của phiên bản ${viewingRevisionVersion} vào bản nháp hiện tại?`,
      onConfirm: () => {
        setViewingRevisionVersion(null);
        setDraftBlocksSnapshot(null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleReturnToDraft = () => {
    if (draftBlocksSnapshot) {
      setTemplate(prev => ({
        ...prev,
        layoutBlocks: draftBlocksSnapshot
      }));
    }
    setViewingRevisionVersion(null);
    setDraftBlocksSnapshot(null);
  };

  const handleDeleteRevisionEntry = (ver: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xóa phiên bản khỏi lịch sử',
      message: `Bạn có chắc chắn muốn xóa bản ghi phiên bản ${ver} khỏi lịch sử không?`,
      onConfirm: async () => {
        const nextHistory = template.revisionHistory.filter(h => h.version !== ver);
        const nextTemplate = { ...template, revisionHistory: nextHistory };
        setTemplate(nextTemplate);
        try {
          await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...nextTemplate, allowActiveUpdate: true })
          });
        } catch (e) {
          console.error(e);
        }
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
      
      {/* ── Warning banner when viewing old revision in read-only mode ── */}
      {viewingRevisionVersion && (
        <div style={{
          background: '#fffbeb',
          borderBottom: '1px solid #fde68a',
          padding: '0.5rem 1.25rem',
          fontSize: '0.82rem',
          color: '#b45309',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 500,
          flexShrink: 0
        }}>
          <span>
            ⚠️ Bạn đang xem phiên bản cũ <strong>{viewingRevisionVersion}</strong> (Chế độ chỉ đọc - Read-only).
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleCommitRestore}
              style={{
                background: '#059669',
                border: 'none',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Khôi phục thành bản nháp hiện tại
            </button>
            <button
              type="button"
              onClick={handleReturnToDraft}
              style={{
                background: '#b45309',
                border: 'none',
                color: '#ffffff',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Quay lại bản nháp hiện tại
            </button>
          </div>
        </div>
      )}

      {/* ── Top Action Bar ── */}
      <div style={{
        height: '56px',
        background: '#ffffff',
        borderBottom: '1px solid var(--neutral-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 10,
        boxSizing: 'border-box',
        flexShrink: 0
      }}>
        {/* 1. LEFT: Identity & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <FileText size={18} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>Report Builder</h2>
          {template.status !== 'DRAFT' && (
            <span className={`badge ${template.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
              {template.status}
            </span>
          )}
        </div>

        {/* 2. CENTER: Section Adders Toolbar */}
        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f8fafc', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1', gap: '2px', flexShrink: 0 }}>
          <button 
            type="button" 
            onClick={() => handleAddBlock('TITLE')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Tiêu đề báo cáo"
          >
            <FileText size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Title</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('INFO_GRID')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Lưới thông tin"
          >
            <Grid size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Info Grid</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('TABLE')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Bảng đánh giá tiêu chuẩn"
          >
            <TableIcon size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Table</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('SIGN')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Khối chữ ký"
          >
            <PenTool size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Sign</span>
          </button>

          <button 
            type="button" 
            onClick={() => handleAddBlock('SECTION_LABEL')}
            className="btn"
            style={{ padding: '3px 8px', fontSize: '0.75rem', fontWeight: 500, background: 'transparent', border: 'none', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            title="Thêm Nhãn phân cách"
          >
            <AlignLeft size={13} style={{ color: 'var(--primary)' }} />
            <span>+ Label</span>
          </button>
        </div>

        {/* 3. RIGHT: Page Setup, Print, Save, Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            background: '#f1f5f9', 
            padding: '2px', 
            borderRadius: '6px', 
            border: '1px solid #cbd5e1'
          }}>
            <span style={{
              padding: '2px 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#0f172a',
              background: '#ffffff',
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
            }}>
              A4 Dọc
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowPrintPreview(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#334155',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            title="In thử hoặc xem trước báo cáo"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          <div style={{ borderLeft: '1px solid var(--neutral-border)', height: '16px', margin: '0 0.1rem' }} />

          <button 
            type="button"
            disabled={saving}
            onClick={handleSaveDraft} 
            style={{
              background: '#0f172a',
              border: '1px solid #0f172a',
              color: '#ffffff',
              padding: '3px 12px',
              borderRadius: '4px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              transition: 'all 0.2s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
            title="Lưu lại thay đổi bản nháp"
          >
            <Save size={13} />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>

          <button 
            type="button"
            onClick={onClose} 
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              padding: '3px 10px',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
          >
            Close
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.4rem' }}>
                    THUỘC TÍNH BÁO CÁO (REPORT SETTINGS)
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Mã báo cáo (Report ID)</label>
                    <input
                      type="text"
                      value={template.reportId}
                      onChange={e => setTemplate({ ...template, reportId: e.target.value.toUpperCase() })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', fontWeight: 600 }}
                      placeholder="e.g. RP-QC-F01"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Tiêu đề báo cáo (Report Title)</label>
                    <input
                      type="text"
                      value={template.reportTitle}
                      onChange={e => setTemplate({ ...template, reportTitle: e.target.value })}
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', fontWeight: 600 }}
                      placeholder="Tiêu đề mẫu báo cáo..."
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Biểu mẫu liên kết (Linked Form)</label>
                    <input
                      type="text"
                      value={template.linkedFormId}
                      disabled
                      style={{ width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', background: '#f8fafc', color: '#64748b' }}
                    />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    💡 Bạn có thể nhấp chọn một khối cụ thể trong trang canvas ở giữa để cấu hình chi tiết hoặc quy tắc đánh giá riêng.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Versions */}
          {rightTab === 'versions' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              
              {/* Card 1: Version Control & Status */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--neutral-border, #cbd5e1)',
                borderRadius: '6px',
                padding: '0.85rem 1rem',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={13} style={{ color: '#94a3b8' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                    Version Control
                  </span>
                </div>

                {template.status === 'ACTIVE' ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {template.version}
                        </span>
                        <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', backgroundColor: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', textTransform: 'uppercase', fontWeight: 700 }}>
                          Active
                        </span>
                      </div>
                      {template.effectiveDate && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          ({template.effectiveDate})
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: '0.15rem' }}>
                      <button
                        type="button"
                        onClick={handleCreateNewVersion}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem',
                          width: '100%',
                          padding: '0.45rem 0.75rem',
                          background: '#0f172a',
                          border: '1px solid #0f172a',
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
                      >
                        <Plus size={12} /> NEW DRAFT
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>v</span>
                      <input
                        type="number"
                        min="0"
                        value={major}
                        onChange={(e) => handleMajorChange(parseInt(e.target.value, 10) || 0)}
                        style={{ width: '38px', padding: '0.2rem 0.15rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', textAlign: 'center', fontSize: '0.8rem' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>.</span>
                      <input
                        type="number"
                        min="0"
                        value={minor}
                        onChange={(e) => handleMinorChange(parseInt(e.target.value, 10) || 0)}
                        style={{ width: '38px', padding: '0.2rem 0.15rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', textAlign: 'center', fontSize: '0.8rem' }}
                      />

                      <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d', textTransform: 'uppercase', fontWeight: 700, marginLeft: '0.15rem' }}>
                        Draft
                      </span>
                    </div>

                    {!viewingRevisionVersion && (
                      <>
                        <div style={{ borderTop: '1px solid var(--neutral-border)', margin: '0.4rem 0' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Change Summary</label>
                            <button
                              type="button"
                              onClick={() => {
                                const suggested = generateReportChangeSummary(initialBlocks, template.layoutBlocks, template.revisionHistory);
                                setChangeSummary(suggested);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0d9488',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                padding: 0
                              }}
                              title="Tự động phân tích thay đổi và tạo tóm tắt"
                            >
                              <Sparkles size={11} /> Gợi ý tự động
                            </button>
                          </div>
                          <textarea 
                            value={changeSummary}
                            onChange={(e) => setChangeSummary(e.target.value)}
                            placeholder="Mô tả tóm tắt thay đổi..."
                            rows={3}
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.8rem',
                              border: '1px solid var(--neutral-border)',
                              borderRadius: '4px',
                              resize: 'none'
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Release Date & Action</label>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <input 
                              type="date"
                              value={effectiveDate}
                              onChange={(e) => setEffectiveDate(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '0.35rem 0.5rem',
                                fontSize: '0.78rem',
                                border: '1px solid var(--neutral-border)',
                                borderRadius: '4px',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                            <button 
                              type="button"
                              disabled={saving}
                              onClick={handlePublish} 
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.35rem 0.75rem',
                                background: '#10b981',
                                border: '1px solid #10b981',
                                color: '#ffffff',
                                borderRadius: '4px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: saving ? 'default' : 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#10b981'; }}
                            >
                              Publish
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Card 2: Revision History & Audit Log */}
              <div style={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--neutral-border, #cbd5e1)',
                borderRadius: '6px',
                padding: '0.85rem 1rem',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={13} style={{ color: '#94a3b8' }} />
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                    Revision History
                  </span>
                </div>

                {template.revisionHistory.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', border: '1px dashed var(--neutral-border)', borderRadius: '5px' }}>
                    No version history available.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                    {template.revisionHistory.map((h, i) => {
                      const hasLayout = !!(h.layoutBlocks && h.layoutBlocks.length > 0);
                      const isCurrentActive = h.version === template.version && template.status === 'ACTIVE';
                      const isCurrentDraft = h.version === template.version && template.status === 'DRAFT';
                      const itemStatus = isCurrentActive ? 'ACTIVE' : (isCurrentDraft || h.status === 'DRAFT' ? 'DRAFT' : (h.status || 'RETIRED'));
                      
                      const statusColor = 
                        itemStatus === 'ACTIVE' ? { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', label: 'Active' } :
                        itemStatus === 'DRAFT'  ? { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Draft' }  :
                                                  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Retired' };

                      return (
                        <div 
                          key={i} 
                          onClick={() => hasLayout && handleRestoreRevision(h)}
                          style={{ 
                            padding: '0.5rem 0.65rem', 
                            background: viewingRevisionVersion === h.version ? '#f0fdfa' : '#f9fafb', 
                            borderRadius: '6px', 
                            border: viewingRevisionVersion === h.version ? '1px solid #99f6e4' : '1px solid var(--neutral-border)', 
                            fontSize: '0.75rem',
                            cursor: hasLayout ? 'pointer' : 'default',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={e => { if (hasLayout && viewingRevisionVersion !== h.version) { e.currentTarget.style.background = '#e0f2fe'; e.currentTarget.style.borderColor = '#7dd3fc'; } }}
                          onMouseLeave={e => { if (hasLayout && viewingRevisionVersion !== h.version) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = 'var(--neutral-border)'; } }}
                          title={hasLayout ? "Click to view this version in read-only mode" : "Version log details"}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, marginBottom: h.change ? '4px' : '0px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ color: 'var(--text-primary)' }}>{h.version}</span>
                              {viewingRevisionVersion === h.version && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--primary)', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '0.01rem 0.2rem', borderRadius: '3px', textTransform: 'uppercase' }}>
                                  VIEWING
                                </span>
                              )}
                              <span className="badge" style={{ backgroundColor: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`, fontSize: '0.62rem', padding: '0.02rem 0.25rem', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 700 }}>
                                {statusColor.label}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 500 }}>{h.date}</span>
                              {!isCurrentActive && !isCurrentDraft && (
                                <button
                                  type="button"
                                  title={`Xóa phiên bản ${h.version}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteRevisionEntry(h.version);
                                  }}
                                  style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    color: '#b91c1c',
                                    borderRadius: '4px',
                                    padding: '0.1rem 0.3rem',
                                    fontSize: '0.65rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fca5a5'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {h.change && (
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', wordBreak: 'break-word', whiteSpace: 'pre-line', lineHeight: '1.25' }}>
                              {h.change}
                            </div>
                          )}
                          
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                            By: {h.author || 'Admin'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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