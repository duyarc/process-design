import { useState, useEffect } from 'react';
import type { FormFieldISO, FormRevisionEntry, FormTemplateISO, LayoutBlockISO, RadioOption, MatrixConfigISO } from '../types';
import { formatFormVersion } from '../types';
import { 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  ListChecks,
  Hash, 
  Calendar, 
  X, 
  Clock, 
  PenTool, 
  Camera, 
  Grid,
  Copy,
  AlignLeft,
  AlignCenter
} from 'lucide-react';
import PrintBlankForm from './print/PrintBlankForm';

interface FormBuilderProps {
  formName: string;
  initialData?: {
    formId?: string;
    formTitle?: string;
    version?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    layoutBlocks?: LayoutBlockISO[];
    revisionHistory?: FormRevisionEntry[];
  };
  onSave: (data: any) => void;
  onClose: () => void;
}

export default function FormBuilder({ formName, initialData, onSave, onClose }: FormBuilderProps) {
  // 1. Core Layout State
  const [formId, setFormId] = useState(initialData?.formId || `FM-${formName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-001`);
  const [formTitle, setFormTitle] = useState(initialData?.formTitle || formName);
  const [version, setVersion] = useState(initialData?.version || 'v0.1 (' + new Date().toISOString().split('T')[0] + ')');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>(initialData?.status || 'DRAFT');
  
  // Default blocks if none provided
  const defaultBlocks: LayoutBlockISO[] = [
    {
      id: "b_title",
      type: "TITLE",
      columns: 1,
      title: formName.toUpperCase(),
      fields: [
        {
          id: "f_title_desc",
          type: "text",
          checkItem: "(kiểm tra trước khi thực hiện)",
          locationCode: "TITLE-DESC",
          frequency: "Once/Shift",
          reactionProtocol: ""
        }
      ]
    },
    {
      id: "b_info",
      type: "INFO_GRID",
      columns: 2,
      title: "Thông tin chung",
      fields: [
        { id: "f_info_date", type: "date", checkItem: "Ngày", locationCode: "INFO-DATE", frequency: "Once/Shift", reactionProtocol: "" },
        { id: "f_info_cont", type: "text", checkItem: "Số Container", locationCode: "INFO-CONT", frequency: "Once/Shift", reactionProtocol: "" }
      ]
    },
    {
      id: "b_checklist",
      type: "CHECKLIST_TABLE",
      columns: 1,
      title: "Chi tiết kiểm tra chất lượng",
      fields: [],
      columnLabels: {
        stt: "STT",
        item: "Chi tiết kiểm tra",
        target: "Đạt / Không Đạt",
        reaction: "Mô tả cụ thể nếu Không đạt"
      }
    },
    {
      id: "b_sign",
      type: "SIGN",
      columns: 2,
      title: "Ký xác nhận",
      fields: [
        { id: "f_sign_op", type: "signature", checkItem: "Người kiểm tra (ký và ghi rõ họ tên)", locationCode: "SIGN-OP", frequency: "Once/Shift", reactionProtocol: "" },
        { id: "f_sign_sup", type: "signature", checkItem: "Người thẩm tra (ký và ghi rõ họ tên)", locationCode: "SIGN-SUP", frequency: "Once/Shift", reactionProtocol: "" }
      ]
    }
  ];

  const [layoutBlocks, setLayoutBlocks] = useState<LayoutBlockISO[]>(initialData?.layoutBlocks || defaultBlocks);
  const [revisionHistory, setRevisionHistory] = useState<FormRevisionEntry[]>(initialData?.revisionHistory || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFormTemplate = async () => {
      const targetId = initialData?.formId;
      if (!targetId) return;
      try {
        setLoading(true);
        const res = await fetch(`/api/forms/${targetId}`);
        if (res.ok) {
          const data = await res.json();
          setFormId(data.form_id);
          setFormTitle(data.form_title || data.form_name);
          setVersion(data.version);
          setStatus(data.status);
          
          if (data.layout_blocks) {
            setLayoutBlocks(typeof data.layout_blocks === 'string' ? JSON.parse(data.layout_blocks) : data.layout_blocks);
          }
          if (data.revision_history) {
            setRevisionHistory(typeof data.revision_history === 'string' ? JSON.parse(data.revision_history) : data.revision_history);
          }
        }
      } catch (err) {
        console.error("Error fetching form template:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFormTemplate();
  }, [initialData?.formId]);

  const saveFormToBackend = async (opts: { versionOverride?: string, statusOverride?: 'ACTIVE' | 'DRAFT' | 'ARCHIVED', historyOverride?: FormRevisionEntry[] } = {}) => {
    const activeVersion = opts.versionOverride || version;
    const activeStatus = opts.statusOverride || status;
    const activeHistory = opts.historyOverride || revisionHistory;

    try {
      const payload = {
        formId,
        formName,
        formTitle,
        status: activeStatus,
        version: activeVersion,
        layoutBlocks,
        revisionHistory: activeHistory
      };
      
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        throw new Error('Failed to save form template to database');
      }
      
      const savedForm = await res.json();
      return savedForm;
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error saving form template.');
      throw err;
    }
  };
  
  // Selection and editor states
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isLocked, setIsLocked] = useState(initialData?.status === 'ACTIVE');
   const [printPreviewData, setPrintPreviewData] = useState<FormTemplateISO | null>(null);
   const [currentDraftBackup, setCurrentDraftBackup] = useState<{ layoutBlocks: LayoutBlockISO[]; version: string; isLocked: boolean } | null>(null);
   const [viewingRevisionVersion, setViewingRevisionVersion] = useState<string | null>(null);

  useEffect(() => {
    setIsLocked(status === 'ACTIVE');
  }, [status]);

  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [existingLogos, setExistingLogos] = useState<{ key: string, isUsed: boolean }[]>([]);

  const titleBlock = layoutBlocks.find(b => b.type === 'TITLE');
  const titleBlockLogo = titleBlock?.logo;

  useEffect(() => {
    fetch('/api/storage/logos')
      .then(res => res.json())
      .then(data => {
        if (data.logos) {
          setExistingLogos(data.logos);
        }
      })
      .catch(err => console.error('Error fetching existing logos:', err));
  }, [titleBlockLogo]);

  const [showLogoGallery, setShowLogoGallery] = useState(false);
  const [resolvedLogos, setResolvedLogos] = useState<{[key: string]: string}>({});

  // Copy section states
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [allProcesses, setAllProcesses] = useState<any[]>([]);
  const [selectedFormKey, setSelectedFormKey] = useState<string>(''); // format: "processId:formName"
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');

  useEffect(() => {
    if (showCopyModal && allProcesses.length === 0) {
      fetch('/api/processes')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAllProcesses(data);
          }
        })
        .catch(err => console.error('Error fetching processes for section copy:', err));
    }
  }, [showCopyModal, allProcesses]);

  useEffect(() => {
    if (showLogoGallery && existingLogos.length > 0) {
      existingLogos.forEach(logo => {
        const key = logo.key;
        if (!resolvedLogos[key]) {
          fetch(`/api/storage/download-url?key=${encodeURIComponent(key)}`)
            .then(res => res.json())
            .then(data => {
              if (data.downloadUrl) {
                setResolvedLogos(prev => ({ ...prev, [key]: data.downloadUrl }));
              }
            })
            .catch(err => console.error('Error resolving gallery logo key:', key, err));
        }
      });
    }
  }, [showLogoGallery, existingLogos, resolvedLogos]);

  const handleDeleteUnusedLogo = async (logoKey: string) => {
    try {
      const res = await fetch('/api/storage/logos', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logoKey })
      });
      if (res.ok) {
        // Re-fetch logos list
        fetch('/api/storage/logos')
          .then(r => r.json())
          .then(data => {
            if (data.logos) {
              setExistingLogos(data.logos);
            }
          });
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete logo.');
      }
    } catch (err) {
      console.error('Error deleting logo from gallery:', err);
      alert('An error occurred while deleting the logo.');
    }
  };

  useEffect(() => {
    if (!titleBlockLogo) {
      setLogoUrl('');
      return;
    }
    if (titleBlockLogo.startsWith('uploads/')) {
      fetch(`/api/storage/download-url?key=${encodeURIComponent(titleBlockLogo)}`)
        .then(res => res.json())
        .then(data => {
          if (data.downloadUrl) {
            setLogoUrl(data.downloadUrl);
          }
        })
        .catch(err => {
          console.error('Error fetching logo URL:', err);
          setLogoUrl('');
        });
    } else {
      setLogoUrl(titleBlockLogo);
    }
  }, [titleBlockLogo]);

  const sanitizeLogoName = (fileName: string): string => {
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
    return nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleLogoUpload = async (blockId: string, file: File) => {
    if (isLocked) return;
    setIsLogoUploading(true);
    try {
      const sanitizedName = sanitizeLogoName(file.name);
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          isLogo: true,
          logoName: sanitizedName
        })
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json();
        throw new Error(errData.error || 'Failed to get secure upload URL.');
      }

      const { uploadUrl, pdfKey } = await presignRes.json();

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'image/jpeg'
        },
        body: file
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to Cloudflare storage.');
      }

      handleUpdateBlockLogo(blockId, pdfKey);
      alert('Logo uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert(`Error uploading logo: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally {
      setIsLogoUploading(false);
    }
  };

  const handleLogoRemove = (blockId: string) => {
    if (isLocked) return;
    if (confirm('Are you sure you want to remove the logo from this form?')) {
      handleUpdateBlockLogo(blockId, '');
    }
  };

  // Extract version numbers for display logic
  const parseVersion = (vString: string) => {
    const match = vString.match(/v(\d+)\.(\d+)/);
    if (match) {
      return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) };
    }
    return { major: 0, minor: 1 };
  };

  // 2. Block Handlers
  const handleAddBlock = (type: 'TITLE' | 'INFO_GRID' | 'CHECKLIST_TABLE' | 'MATRIX_TABLE' | 'SIGN', columns: 1 | 2 | 3 = 1) => {
    if (isLocked) return;
    const newBlock: LayoutBlockISO = {
      id: `b_${type.toLowerCase()}_${Date.now()}`,
      type,
      columns,
      title: type === 'INFO_GRID' ? 'Thông tin chung' : type === 'CHECKLIST_TABLE' ? 'Bảng kiểm tra' : type === 'MATRIX_TABLE' ? 'Bảng kiểm đếm số lượng' : 'Ký nhận',
      fields: [],
      columnLabels: type === 'CHECKLIST_TABLE' ? {
        stt: 'STT',
        item: 'Chi tiết kiểm tra',
        target: 'Đạt / Không Đạt',
        reaction: 'Mô tả cụ thể nếu Không đạt'
      } : undefined,
      matrixConfig: type === 'MATRIX_TABLE' ? {
        rowHeader: 'Lớp',
        rowCount: 10,
        columnHeader: 'Tên hàng, quy cách',
        columns: ['SP 1', 'SP 2', 'SP 3'],
        showTotalColumn: true,
        totalColumnHeader: 'Tổng mỗi lớp (bao/carton)',
        showNotesColumn: true,
        notesColumnHeader: 'Ghi chú',
        columnAlign: 'center'
      } : undefined
    };
    setLayoutBlocks(prev => [...prev, newBlock]);
    setActiveBlockId(newBlock.id);
    setActiveFieldId(null);
  };

  const handleExecuteCopy = (sourceBlock: LayoutBlockISO) => {
    if (isLocked) return;
    
    // Generate new unique ID for the block
    const newBlockId = `b_${sourceBlock.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Regenerate unique IDs for all fields in the block to prevent collisions
    const newFields = sourceBlock.fields.map(field => {
      const newFieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      return {
        ...field,
        id: newFieldId
      };
    });

    const newBlock: LayoutBlockISO = {
      ...sourceBlock,
      id: newBlockId,
      fields: newFields
    };

    // Append to current layoutBlocks
    setLayoutBlocks(prev => [...prev, newBlock]);
    setShowCopyModal(false);
    setActiveBlockId(newBlockId);
    setActiveFieldId(null);
  };

  const handleUpdateBlockTitle = (blockId: string, newTitle: string) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, title: newTitle } : b));
  };

  const handleUpdateBlockColumns = (blockId: string, cols: 1 | 2 | 3) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, columns: cols } : b));
  };

  const handleUpdateBlockLogo = (blockId: string, newLogo: string) => {
    setLayoutBlocks(prev => prev.map(b => b.id === blockId ? { ...b, logo: newLogo } : b));
  };

  const handleUpdateBlockDescription = (blockId: string, newDesc: string) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      const updatedFields = b.fields.map((f, idx) => idx === 0 ? { ...f, checkItem: newDesc } : f);
      return { ...b, fields: updatedFields };
    }));
  };
  const handleUpdateBlockColumnLabels = (blockId: string, updates: Partial<NonNullable<LayoutBlockISO['columnLabels']>>) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        columnLabels: {
          stt: b.columnLabels?.stt || 'STT',
          item: b.columnLabels?.item || 'Nội dung kiểm tra',
          target: b.columnLabels?.target || 'Kết quả',
          reaction: b.columnLabels?.reaction || 'Ghi chú lỗi',
          ...updates
        }
      };
    }));
  };

  const handleUpdateBlockMatrixConfig = (blockId: string, updates: Partial<MatrixConfigISO>) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          matrixConfig: b.matrixConfig ? { ...b.matrixConfig, ...updates } : undefined
        };
      }
      return b;
    }));
  };


  const handleDeleteBlock = (blockId: string) => {
    if (isLocked) return;
    if (confirm('Are you sure you want to delete this entire layout block and all its fields?')) {
      setLayoutBlocks(prev => prev.filter(b => b.id !== blockId));
      if (activeBlockId === blockId) {
        setActiveBlockId(null);
        setActiveFieldId(null);
      }
    }
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (isLocked) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= layoutBlocks.length) return;
    
    setLayoutBlocks(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // 3. Field Handlers inside Blocks
  const DEFAULT_RADIO_OPTIONS: RadioOption[] = [
    { label: 'Đạt',   value: 'PASS', isPass: true  },
    { label: 'Không', value: 'FAIL', isPass: false }
  ];

  const handleAddField = (blockId: string, type: 'text' | 'number' | 'date' | 'radio' | 'signature' | 'photo') => {
    if (isLocked) return;
    
    const labelPrefix = type === 'radio' ? 'Kiểm tra ' : type === 'number' ? 'Đo thông số ' : 'Thông tin ';
    const newField: FormFieldISO = {
      id: `f_${type}_${Date.now()}`,
      type,
      checkItem: `${labelPrefix}mới`,
      locationCode: `LOC-${Math.floor(10 + Math.random() * 90)}`,
      frequency: "Once/Shift",
      reactionProtocol: type === 'radio' || type === 'number' ? "Báo cáo trưởng ca và ghi nhận hành động khắc phục." : ""
    };

    if (type === 'number') {
      newField.minSpec = 0;
      newField.maxSpec = 100;
      newField.unit = 'units';
    } else if (type === 'radio') {
      newField.options = [...DEFAULT_RADIO_OPTIONS];
    }

    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return { ...b, fields: [...b.fields, newField] };
      }
      return b;
    }));

    setActiveFieldId(newField.id);
  };

  const handleUpdateField = (blockId: string, fieldId: string, updates: Partial<FormFieldISO>) => {
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          fields: b.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f)
        };
      }
      return b;
    }));
  };

  const handleChangeFieldType = (blockId: string, fieldId: string, newType: 'text' | 'number' | 'date' | 'radio' | 'signature' | 'photo') => {
    if (isLocked) return;
    const updates: Partial<FormFieldISO> = { type: newType };
    
    if (newType === 'number') {
      updates.minSpec = 0;
      updates.maxSpec = 100;
      updates.unit = 'units';
      updates.options = undefined;
    } else if (newType === 'radio') {
      updates.options = [...DEFAULT_RADIO_OPTIONS];
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    } else if (newType === 'signature') {
      updates.reactionProtocol = 'Ký và ghi rõ họ tên';
      updates.options = undefined;
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    } else {
      updates.options = undefined;
      updates.minSpec = undefined;
      updates.maxSpec = undefined;
      updates.unit = undefined;
    }
    
    handleUpdateField(blockId, fieldId, updates);
  };


  const handleDeleteField = (blockId: string, fieldId: string) => {
    if (isLocked) return;
    setLayoutBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return { ...b, fields: b.fields.filter(f => f.id !== fieldId) };
      }
      return b;
    }));
    if (activeFieldId === fieldId) {
      setActiveFieldId(null);
    }
  };

  // 4. Save and Publish

  const handlePublish = async () => {
    if (!changeSummary.trim()) {
      alert('Please enter a change summary before publishing a new active version.');
      return;
    }

    // Validation: Ensure all fields have names
    let hasEmptyField = false;
    layoutBlocks.forEach(b => {
      if (b.fields.some(f => !f.checkItem.trim())) {
        hasEmptyField = true;
      }
    });

    if (hasEmptyField) {
      alert('All layout fields must have a description label.');
      return;
    }

    const { major, minor } = parseVersion(version);
    const approveDate = effectiveDate || new Date().toISOString().split('T')[0];
    const newActiveVersion = `v${major}.${minor} (${approveDate})`;
    
    const newHistoryEntry: FormRevisionEntry = {
      version: `v${major}.${minor}`,
      date: approveDate,
      author: 'QA Administrator',
      change: changeSummary,
      layoutBlocks: JSON.parse(JSON.stringify(layoutBlocks))
    };

    const updatedHistory = [newHistoryEntry, ...revisionHistory];
    
    setVersion(newActiveVersion);
    setStatus('ACTIVE');
    setRevisionHistory(updatedHistory);
    setIsLocked(true);
    setChangeSummary('');

    try {
      setLoading(true);
      await saveFormToBackend({
        versionOverride: newActiveVersion,
        statusOverride: 'ACTIVE',
        historyOverride: updatedHistory
      });

      onSave({
        formId,
        formTitle,
        version: newActiveVersion,
        status: 'ACTIVE'
      });

      alert(`Successfully published active version: ${newActiveVersion}. This template is now locked for quality compliance.`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreRevision = (entry: FormRevisionEntry) => {
    if (!entry.layoutBlocks || entry.layoutBlocks.length === 0) {
      alert(`This revision entry (${entry.version}) does not have layout blocks stored. It might be a log-only entry from an older version.`);
      return;
    }
    
    // Backup the current working draft if we haven't already
    if (!currentDraftBackup) {
      setCurrentDraftBackup({
        layoutBlocks: JSON.parse(JSON.stringify(layoutBlocks)),
        version: version,
        isLocked: isLocked
      });
    }

    // Load the revision blocks
    const restoredBlocks = JSON.parse(JSON.stringify(entry.layoutBlocks));
    setLayoutBlocks(restoredBlocks);

    // Set version name, status as retired, and lock the view
    const formattedVersion = `${entry.version} (${entry.date}) [RETIRED]`;
    setVersion(formattedVersion);
    setIsLocked(true);
    setViewingRevisionVersion(entry.version);
  };

  const handleReturnToDraft = () => {
    if (currentDraftBackup) {
      setLayoutBlocks(currentDraftBackup.layoutBlocks);
      setVersion(currentDraftBackup.version);
      setIsLocked(currentDraftBackup.isLocked);
      
      setCurrentDraftBackup(null);
      setViewingRevisionVersion(null);
    }
  };

  const handleCommitRestore = () => {
    if (!viewingRevisionVersion) return;
    if (confirm(`Bạn có chắc chắn muốn khôi phục phiên bản ${viewingRevisionVersion} thành bản nháp hiện tại không? Bản nháp chưa lưu hiện tại sẽ bị ghi đè.`)) {
      // Find the revision entry to get its clean version number (e.g. "v0.1")
      const entry = revisionHistory.find(h => h.version === viewingRevisionVersion);
      const baseVersion = entry ? entry.version : 'v0.1';
      
      // Parse major/minor of the restored version
      const { major, minor } = parseVersion(baseVersion);
      const draftVersion = `v${major}.${minor} (draft)`;
      
      setVersion(draftVersion);
      setStatus('DRAFT');
      setIsLocked(false);
      
      // Discard the backup draft and exit read-only preview mode
      setCurrentDraftBackup(null);
      setViewingRevisionVersion(null);
      
      alert(`Đã khôi phục phiên bản ${baseVersion} thành bản nháp hiện tại (${draftVersion}). Bạn có thể bắt đầu chỉnh sửa bản nháp này.`);
    }
  };

  const handleCreateNewVersion = () => {
    const { major, minor } = parseVersion(version);
    const draftVersion = `v${major}.${minor + 1} (draft)`;
    setVersion(draftVersion);
    setStatus('DRAFT');
    setIsLocked(false);
    setChangeSummary('');
    alert(`New draft version created: ${draftVersion}. You can now make edits. The previous version remains active in production until you publish this draft.`);
  };

  const handleSaveDraftAndClose = async () => {
    try {
      setLoading(true);
      await saveFormToBackend();
      onSave({
        formId,
        formTitle,
        version,
        status
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardChangesAndClose = () => {
    if (confirm('Discard all unsaved changes? Any edits made in this session will be lost.')) {
      onClose();
    }
  };

  // Find currently selected element details
  const activeBlock = layoutBlocks.find(b => b.id === activeBlockId);
  const activeField = activeBlock?.fields.find(f => f.id === activeFieldId);

  // Render Loading spinner
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', background: '#f8fafc', height: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading form template from database...</p>
      </div>
    );
  }

  // Render Print Preview bypass
  if (printPreviewData) {
    return (
      <PrintBlankForm
        template={printPreviewData}
        onClose={() => setPrintPreviewData(null)}
      />
    );
  }

  const { major, minor } = parseVersion(version);
  const datePart = status === 'ACTIVE'
    ? (version.includes('(') ? version.split('(')[1].replace(')', '') : new Date().toISOString().split('T')[0])
    : 'draft';

  const handleMajorChange = (newMajor: number) => {
    setVersion(`v${newMajor}.${minor} (${datePart})`);
  };

  const handleMinorChange = (newMinor: number) => {
    setVersion(`v${major}.${newMinor} (${datePart})`);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '85vh',
      background: '#f8fafc',
      border: '1px solid var(--neutral-border)',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      {/* Warning banner when viewing old revision in read-only mode */}
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
          fontWeight: 500
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
      {/* Title bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        background: '#ffffff',
        borderBottom: '1px solid var(--neutral-border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Form Designer</h2>
          <span className={`badge ${status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
            {status}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {!isLocked ? (
            <>
              <button 
                type="button"
                onClick={handleSaveDraftAndClose} 
                style={{
                  background: '#0f172a',
                  border: '1px solid #0f172a',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
              >
                Save
              </button>
              <button 
                type="button"
                onClick={handleDiscardChangesAndClose} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  padding: '4px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
              >
                Discard
              </button>
              <div style={{ borderLeft: '1px solid var(--neutral-border)', height: '16px', margin: '0 0.5rem' }} />
              <button 
                type="button"
                className="btn btn-primary btn-sm" 
                onClick={handlePublish} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '4px 12px', background: '#10b981', borderColor: '#10b981', fontSize: '0.8rem', fontWeight: 500 }}
              >
                Publish
              </button>
            </>
          ) : (
            <>
              <button 
                type="button"
                onClick={handleCreateNewVersion} 
                style={{
                  background: '#0f172a',
                  border: '1px solid #0f172a',
                  color: '#ffffff',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
              >
                Edit
              </button>
              <button 
                type="button"
                onClick={onClose} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  padding: '4px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
              >
                Close
              </button>
            </>
          )}
          
          <div style={{ borderLeft: '1px solid var(--neutral-border)', height: '16px', margin: '0 0.5rem' }} />

          <button 
            type="button"
            onClick={() => setPrintPreviewData({
              formId,
              formTitle,
              version,
              status,
              layoutBlocks,
              revisionHistory
            })}
            style={{
              background: 'none',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            Preview (A4)
          </button>
        </div>
      </div>

      {/* Main Designer Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT PANEL: Layout Blocks & Field Elements Toolbox */}
        <div style={{ background: '#ffffff', borderRight: '1px solid var(--neutral-border)', padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Blocks section */}
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.65rem', letterSpacing: '0.05em' }}>
              1. Layout
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <button 
                type="button" 
                onClick={() => handleAddBlock('TITLE')}
                disabled={isLocked}
                className="btn btn-secondary" 
                style={{ justifyContent: 'start', padding: '0.45rem 0.65rem', fontSize: '0.8rem', opacity: isLocked ? 0.6 : 1 }}
              >
                <Grid size={14} style={{ marginRight: '0.35rem' }} />
                + Title
              </button>
              <button 
                type="button" 
                onClick={() => handleAddBlock('INFO_GRID', 2)}
                disabled={isLocked}
                className="btn btn-secondary" 
                style={{ justifyContent: 'start', padding: '0.45rem 0.65rem', fontSize: '0.8rem', opacity: isLocked ? 0.6 : 1 }}
              >
                <Grid size={14} style={{ marginRight: '0.35rem' }} />
                + Info Grid
              </button>
              <button 
                type="button" 
                onClick={() => handleAddBlock('CHECKLIST_TABLE')}
                disabled={isLocked}
                className="btn btn-secondary" 
                style={{ justifyContent: 'start', padding: '0.45rem 0.65rem', fontSize: '0.8rem', opacity: isLocked ? 0.6 : 1 }}
              >
                <Grid size={14} style={{ marginRight: '0.35rem' }} />
                + Table
              </button>
              <button 
                type="button" 
                onClick={() => handleAddBlock('MATRIX_TABLE')}
                disabled={isLocked}
                className="btn btn-secondary" 
                style={{ justifyContent: 'start', padding: '0.45rem 0.65rem', fontSize: '0.8rem', opacity: isLocked ? 0.6 : 1 }}
              >
                <Grid size={14} style={{ marginRight: '0.35rem' }} />
                + Matrix Table
              </button>
              <button 
                type="button" 
                onClick={() => handleAddBlock('SIGN', 2)}
                disabled={isLocked}
                className="btn btn-secondary" 
                style={{ justifyContent: 'start', padding: '0.45rem 0.65rem', fontSize: '0.8rem', opacity: isLocked ? 0.6 : 1 }}
              >
                <Grid size={14} style={{ marginRight: '0.35rem' }} />
                + Sign
              </button>
              
              <div style={{ borderTop: '1px dashed var(--neutral-border)', margin: '0.5rem 0' }} />
              <button 
                type="button" 
                onClick={() => {
                  setSelectedFormKey('');
                  setSelectedBlockId('');
                  setShowCopyModal(true);
                }}
                disabled={isLocked}
                className="btn btn-secondary" 
                style={{ 
                  justifyContent: 'start', 
                  padding: '0.45rem 0.65rem', 
                  fontSize: '0.8rem', 
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  color: '#475569',
                  opacity: isLocked ? 0.6 : 1 
                }}
                onMouseEnter={(e) => { if (!isLocked) e.currentTarget.style.background = '#f1f5f9'; }}
                onMouseLeave={(e) => { if (!isLocked) e.currentTarget.style.background = '#f8fafc'; }}
              >
                <Copy size={14} style={{ marginRight: '0.35rem' }} />
                Copy Section...
              </button>
            </div>
          </div>

          {/* Fields section */}
          <div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
              2. Field Elements
            </h3>
            {activeBlockId ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '0 0 0.25rem 0' }}>
                  Adding to block: <strong>{activeBlock?.title}</strong>
                </p>
                <button 
                  type="button" 
                  onClick={() => handleAddField(activeBlockId, 'radio')}
                  disabled={isLocked || activeBlock?.type === 'SIGN'}
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'start', padding: '0.4rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <ListChecks size={13} style={{ marginRight: '0.35rem' }} />
                  Radio Group
                </button>
                <button 
                  type="button" 
                  onClick={() => handleAddField(activeBlockId, 'number')}
                  disabled={isLocked || activeBlock?.type === 'SIGN' || activeBlock?.type === 'TITLE'}
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'start', padding: '0.4rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <Hash size={13} style={{ marginRight: '0.35rem' }} />
                  Numeric Spec Check
                </button>
                <button 
                  type="button" 
                  onClick={() => handleAddField(activeBlockId, 'text')}
                  disabled={isLocked || activeBlock?.type === 'SIGN'}
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'start', padding: '0.4rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <FileText size={13} style={{ marginRight: '0.35rem' }} />
                  Text Note Field
                </button>
                <button 
                  type="button" 
                  onClick={() => handleAddField(activeBlockId, 'date')}
                  disabled={isLocked || activeBlock?.type === 'SIGN' || activeBlock?.type === 'TITLE'}
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'start', padding: '0.4rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <Calendar size={13} style={{ marginRight: '0.35rem' }} />
                  Date Picker
                </button>
                <button 
                  type="button" 
                  onClick={() => handleAddField(activeBlockId, 'signature')}
                  disabled={isLocked || activeBlock?.type !== 'SIGN'}
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'start', padding: '0.4rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <PenTool size={13} style={{ marginRight: '0.35rem' }} />
                  Sign-off
                </button>
                <button 
                  type="button" 
                  onClick={() => handleAddField(activeBlockId, 'photo')}
                  disabled={isLocked || activeBlock?.type !== 'CHECKLIST_TABLE'}
                  className="btn btn-secondary" 
                  style={{ justifyContent: 'start', padding: '0.4rem 0.5rem', fontSize: '0.75rem' }}
                >
                  <Camera size={13} style={{ marginRight: '0.35rem' }} />
                  Camera/Photo Log
                </button>
              </div>
            ) : (
              <div style={{ padding: '0.75rem', border: '1px dashed #cbd5e1', borderRadius: '4px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>
                  Select a layout block on the canvas to add field elements.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CENTER CANVAS: A4 Portrait Grid Document Simulation */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', flex: 1 }}>
          <div style={{
            width: '100%',
            maxWidth: '780px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            padding: '2.5rem',
            minHeight: '1050px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            position: 'relative'
          }}>
            


            {/* Layout blocks render */}
            {layoutBlocks.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '3rem', textAlign: 'center' }}>
                <Grid size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>Empty Layout Canvas</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Add layout blocks from the left toolbox to design your document structure.</p>
              </div>
            ) : (
              layoutBlocks.map((block, index) => {
                const isBlockSelected = activeBlockId === block.id;
                
                return (
                  <div 
                    key={block.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBlockId(block.id);
                      setActiveFieldId(null);
                    }}
                    style={{
                      border: isBlockSelected ? '2px solid var(--primary)' : '1px dashed #cbd5e1',
                      borderRadius: '6px',
                      padding: '1rem',
                      position: 'relative',
                      background: isBlockSelected ? 'rgba(16, 163, 163, 0.02)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {/* Block Toolbar */}
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      right: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      background: '#ffffff',
                      padding: '0 4px',
                      fontSize: '0.65rem',
                      zIndex: 10
                    }}>
                      <span style={{ fontWeight: 700, color: isBlockSelected ? 'var(--primary)' : 'var(--text-muted)', marginRight: '0.25rem' }}>
                        {block.type}
                      </span>
                      <button 
                        type="button" 
                        disabled={index === 0 || isLocked}
                        onClick={(e) => { e.stopPropagation(); handleMoveBlock(index, 'up'); }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '2px', background: '#ffffff', padding: '1px 3px', cursor: 'pointer' }}
                      >
                        <ArrowUp size={10} />
                      </button>
                      <button 
                        type="button" 
                        disabled={index === layoutBlocks.length - 1 || isLocked}
                        onClick={(e) => { e.stopPropagation(); handleMoveBlock(index, 'down'); }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '2px', background: '#ffffff', padding: '1px 3px', cursor: 'pointer' }}
                      >
                        <ArrowDown size={10} />
                      </button>
                      <button 
                        type="button" 
                        disabled={isLocked}
                        onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '2px', background: '#ffffff', padding: '1px 3px', cursor: 'pointer', color: 'var(--danger)' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>

                    {/* Block Content Render */}
                    <div style={{ marginTop: '0.25rem' }}>
                      
                      {/* 1. TITLE BLOCK */}
                      {block.type === 'TITLE' && (
                        block.logo ? (
                          <div style={{
                            padding: '10px 0',
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '10px'
                          }}>
                            {logoUrl && (
                              <div style={{
                                marginRight: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                height: '65px'
                              }}>
                                <img src={logoUrl} alt="Logo" style={{ maxHeight: '65px', maxWidth: '260px', objectFit: 'contain' }} />
                              </div>
                            )}
                            <div style={{ textAlign: 'center', flex: 1 }}>
                              <h1 style={{ margin: '0 0 2px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                                {block.title || 'TÊN BIỂU MẪU'}
                              </h1>
                              <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                                {block.fields[0]?.checkItem || '(mô tả ngắn kiểm tra)'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            padding: '10px 0',
                            textAlign: 'center',
                            marginBottom: '10px'
                          }}>
                            <h1 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                              {block.title || 'TÊN BIỂU MẪU'}
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                              {block.fields[0]?.checkItem || '(mô tả ngắn kiểm tra)'}
                            </p>
                          </div>
                        )
                      )}

                      {/* 2. INFO GRID BLOCK */}
                      {block.type === 'INFO_GRID' && (
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            {block.title}
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
                            gap: '0.75rem'
                          }}>
                            {block.fields.map(f => {
                              const isFieldSelected = activeFieldId === f.id;
                              return (
                                <div 
                                  key={f.id} 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBlockId(block.id);
                                    setActiveFieldId(f.id);
                                  }}
                                  style={{
                                    borderBottom: isFieldSelected ? '2px solid var(--primary)' : '1px dotted #cbd5e1',
                                    padding: '2px 4px',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    background: isFieldSelected ? 'rgba(16, 163, 163, 0.05)' : 'none'
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>{f.checkItem}:</span>
                                  <span style={{ color: 'var(--text-muted)' }}>[{f.type}]</span>
                                </div>
                              );
                            })}
                            {block.fields.length < 6 && !isLocked && (
                              <div 
                                onClick={(e) => { e.stopPropagation(); handleAddField(block.id, 'text'); }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '4px', fontSize: '0.7rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                              >
                                <Plus size={10} style={{ marginRight: '2px' }} /> Add Field Slot
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 3. CHECKLIST TABLE BLOCK */}
                      {block.type === 'CHECKLIST_TABLE' && (
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            {block.title}
                          </div>
                          
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '4px 6px', textAlign: 'left', width: '40px' }}>{block.columnLabels?.stt || 'STT'}</th>
                                <th style={{ padding: '4px 6px', textAlign: 'left' }}>{block.columnLabels?.item || 'Chi tiết kiểm tra'}</th>
                                <th style={{ padding: '4px 6px', textAlign: 'center', width: '130px' }}>{block.columnLabels?.target || 'Đạt / Không Đạt'}</th>
                                <th style={{ padding: '4px 6px', textAlign: 'left', width: '220px' }}>{block.columnLabels?.reaction || 'Mô tả cụ thể nếu Không đạt'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {block.fields.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No checklist fields added yet. Click elements in the left panel to populate this checklist.
                                  </td>
                                </tr>
                              ) : (
                                block.fields.map((f, idx) => {
                                  const isFieldSelected = activeFieldId === f.id;
                                  return (
                                    <tr 
                                      key={f.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveBlockId(block.id);
                                        setActiveFieldId(f.id);
                                      }}
                                      style={{
                                        borderBottom: '1px solid #e2e8f0',
                                        background: isFieldSelected ? 'rgba(16, 163, 163, 0.05)' : 'none',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <td style={{ padding: '4px 6px', fontWeight: 600 }}>{idx + 1}</td>
                                      <td style={{ padding: '4px 6px' }}>{f.checkItem}</td>
                                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                                        {(f.type === 'radio' || f.type === 'checkbox') ? (
                                          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                            {(f.options ?? DEFAULT_RADIO_OPTIONS).map(opt => (
                                              <span key={opt.value} style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '0 5px',
                                                height: '16px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.5rem',
                                                color: 'var(--text-secondary)',
                                                whiteSpace: 'nowrap'
                                              }}>{opt.label}</span>
                                            ))}
                                          </div>
                                        ) : f.type === 'number' ? (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>({f.minSpec}-{f.maxSpec} {f.unit})</span>
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{f.type}</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '4px 6px', borderLeft: '1px solid #e2e8f0', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                        {f.reactionProtocol ? 'Reaction protocol active' : ''}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                          
                          {!isLocked && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); handleAddField(block.id, 'radio'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              >
                                <Plus size={12} /> Radio Row
                              </button>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); handleAddField(block.id, 'number'); }}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                              >
                                <Plus size={12} /> Numeric Spec Row
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3.1 MATRIX TABLE BLOCK */}
                      {block.type === 'MATRIX_TABLE' && block.matrixConfig && (
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            {block.title}
                          </div>
                          
                          <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                                  <th rowSpan={2} style={{ padding: '6px', borderRight: '1px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1', textAlign: 'center', width: '50px' }}>
                                    {block.matrixConfig.rowHeader}
                                  </th>
                                  <th colSpan={block.matrixConfig.columns.length} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', textAlign: 'center' }}>
                                    {block.matrixConfig.columnHeader}
                                  </th>
                                  {block.matrixConfig.showTotalColumn && (
                                    <th rowSpan={2} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', borderBottom: '1.5px solid #cbd5e1', textAlign: 'center', width: '100px', fontSize: '0.7rem' }}>
                                      {block.matrixConfig.totalColumnHeader}
                                    </th>
                                  )}
                                  {block.matrixConfig.showNotesColumn && (
                                    <th rowSpan={2} style={{ padding: '4px', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', width: '150px' }}>
                                      {block.matrixConfig.notesColumnHeader}
                                    </th>
                                  )}
                                </tr>
                                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #cbd5e1' }}>
                                  {block.matrixConfig.columns.map((colName, cIdx) => (
                                    <th key={cIdx} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: block.matrixConfig!.columnAlign || 'center', fontWeight: 'normal', fontSize: '0.7rem' }}>
                                      {colName || `(Cột ${cIdx + 1})`}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[1, 2, 3].map((rowIdx) => (
                                  <tr key={rowIdx} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                    <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>
                                      {rowIdx}
                                    </td>
                                    {block.matrixConfig!.columns.map((_, cIdx) => (
                                      <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>
                                        <div style={{ border: '1px dashed #cbd5e1', padding: '2px', background: '#f8fafc', color: '#94a3b8', fontSize: '0.65rem' }}>
                                          [0]
                                        </div>
                                      </td>
                                    ))}
                                    {block.matrixConfig!.showTotalColumn && (
                                      <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', background: '#f1f5f9', fontWeight: 'bold' }}>
                                        0
                                      </td>
                                    )}
                                    {block.matrixConfig!.showNotesColumn && (
                                      <td style={{ padding: '4px', color: '#cbd5e1', fontStyle: 'italic', fontSize: '0.65rem' }}>
                                        ...
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                <tr style={{ background: '#f8fafc', fontWeight: 'bold', borderTop: '1.5px solid #cbd5e1' }}>
                                  <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>TỔNG</td>
                                  {block.matrixConfig.columns.map((_, cIdx) => (
                                    <td key={cIdx} style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right' }}>0</td>
                                  ))}
                                  {block.matrixConfig.showTotalColumn && (
                                    <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'right', background: '#e2e8f0' }}>0</td>
                                  )}
                                  {block.matrixConfig.showNotesColumn && (
                                    <td style={{ padding: '4px' }}></td>
                                  )}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                            * Thiết kế mô phỏng (Hiển thị 3 hàng demo). Số dòng thực tế cấu hình: {block.matrixConfig.rowCount} hàng.
                          </div>
                        </div>
                      )}

                      {/* 4. SIGN BLOCK */}
                      {block.type === 'SIGN' && (
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid #cbd5e1', paddingBottom: '2px', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                            {block.title}
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${block.columns}, 1fr)`,
                            gap: '1rem'
                          }}>
                            {block.fields.map(f => {
                              const isFieldSelected = activeFieldId === f.id;
                              return (
                                <div 
                                  key={f.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBlockId(block.id);
                                    setActiveFieldId(f.id);
                                  }}
                                  style={{
                                    border: isFieldSelected ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '0.5rem',
                                    textAlign: 'center',
                                    background: isFieldSelected ? 'rgba(16, 163, 163, 0.05)' : '#f8fafc'
                                  }}
                                >
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {f.checkItem}
                                  </div>
                                  <div style={{ fontSize: '0.65rem', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                    {f.reactionProtocol ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`) : '(Ký và ghi rõ họ tên)'}
                                  </div>
                                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', borderTop: '1px dotted #cbd5e1', paddingTop: '4px' }}>
                                    Sign-off slot
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })
            )}

            {/* Static layout-driven footer matching paper printouts */}
            <div style={{
              marginTop: 'auto',
              borderTop: '1px solid #334155',
              paddingTop: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace'
            }}>
              <span>Doc ID: {formId || 'PENDING'}</span>
              <span>Version: {formatFormVersion(version) || 'DRAFT'}</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Properties Configuration Panel */}
        <div style={{ background: '#ffffff', borderLeft: '1px solid var(--neutral-border)', padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {activeField ? (
            /* FIELD PROPERTIES */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  Field Properties
                </h3>
                <button 
                  type="button" 
                  disabled={isLocked}
                  onClick={() => handleDeleteField(activeBlockId!, activeFieldId!)}
                  style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Label / Check Item</label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={activeField.checkItem}
                    onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { checkItem: e.target.value })}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Field Type</label>
                  <select
                    disabled={isLocked}
                    value={activeField.type}
                    onChange={(e) => handleChangeFieldType(activeBlockId!, activeFieldId!, e.target.value as any)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', background: '#fff' }}
                  >
                    <option value="text">Text Note Field</option>
                    <option value="number">Numeric Spec Check</option>
                    <option value="date">Date Picker</option>
                    <option value="radio">Radio Group</option>
                    <option value="signature">Sign-off</option>
                    <option value="photo">Camera/Photo Log</option>
                  </select>
                </div>

                {activeField.type === 'signature' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Ghi chú</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="Ký và ghi rõ họ tên"
                      value={activeField.reactionProtocol || ''}
                      onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { reactionProtocol: e.target.value })}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Check Frequency</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={activeField.frequency}
                      onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { frequency: e.target.value })}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                    />
                  </div>
                )}

                {activeField.type === 'number' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontWeight: 600 }}>Min Spec</label>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={activeField.minSpec ?? ''}
                          onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { minSpec: parseFloat(e.target.value) || 0 })}
                          style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontWeight: 600 }}>Max Spec</label>
                        <input
                          type="number"
                          disabled={isLocked}
                          value={activeField.maxSpec ?? ''}
                          onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { maxSpec: parseFloat(e.target.value) || 0 })}
                          style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600 }}>Unit</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeField.unit || ''}
                        onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { unit: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>
                  </>
                )}

                {(activeField.type === 'radio' || activeField.type === 'checkbox') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Radio Options</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(activeField.options ?? DEFAULT_RADIO_OPTIONS).map((opt, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            disabled={isLocked}
                            placeholder="Nhãn"
                            value={opt.label}
                            onChange={(e) => {
                              const newOpts = [...(activeField.options ?? DEFAULT_RADIO_OPTIONS)];
                              newOpts[idx] = { ...newOpts[idx], label: e.target.value };
                              handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                            }}
                            style={{ flex: 2, padding: '0.2rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                          />
                          <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={opt.isPass}
                              onChange={(e) => {
                                const newOpts = [...(activeField.options ?? DEFAULT_RADIO_OPTIONS)];
                                newOpts[idx] = { ...newOpts[idx], isPass: e.target.checked };
                                handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                              }}
                            />
                            Đạt
                          </label>
                          <button
                            type="button"
                            disabled={isLocked || (activeField.options ?? DEFAULT_RADIO_OPTIONS).length <= 1}
                            onClick={() => {
                              const newOpts = (activeField.options ?? DEFAULT_RADIO_OPTIONS).filter((_, i) => i !== idx);
                              handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0 2px', fontSize: '0.8rem', lineHeight: 1 }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          const newOpts = [...(activeField.options ?? DEFAULT_RADIO_OPTIONS), { label: 'Lựa chọn mới', value: `OPT_${Date.now()}`, isPass: false }];
                          handleUpdateField(activeBlockId!, activeFieldId!, { options: newOpts });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <Plus size={11} /> Thêm lựa chọn
                      </button>
                    )}
                  </div>
                )}

                {(activeField.type === 'radio' || activeField.type === 'checkbox' || activeField.type === 'number') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Reaction Protocol (Out of Spec)</label>
                    <textarea
                      disabled={isLocked}
                      value={activeField.reactionProtocol}
                      onChange={(e) => handleUpdateField(activeBlockId!, activeFieldId!, { reactionProtocol: e.target.value })}
                      rows={3}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', resize: 'none' }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : activeBlock ? (
            /* BLOCK PROPERTIES */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  Section Settings
                </h3>
                <button 
                  type="button" 
                  disabled={isLocked || activeBlock.type === 'TITLE'}
                  onClick={() => handleDeleteBlock(activeBlockId!)}
                  style={{ border: 'none', background: 'none', color: 'var(--danger)', cursor: (isLocked || activeBlock.type === 'TITLE') ? 'not-allowed' : 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Title</label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={activeBlock.title}
                    onChange={(e) => handleUpdateBlockTitle(activeBlockId!, e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                  />
                </div>

                {activeBlock.type === 'TITLE' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Logo Image</label>
                      
                      {activeBlock.logo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {logoUrl ? (
                            <div style={{ padding: '0.5rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80px' }}>
                              <img src={logoUrl} alt="Logo preview" style={{ maxHeight: '65px', maxWidth: '100%', objectFit: 'contain' }} />
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Loading logo preview...</div>
                          )}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleLogoRemove(activeBlockId!)}
                            className="btn btn-sm btn-secondary"
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}
                          >
                            Remove Logo
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isLocked || isLogoUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleLogoUpload(activeBlockId!, file);
                            }}
                            style={{ display: 'none' }}
                            id="logo-file-uploader"
                          />
                          <label
                            htmlFor="logo-file-uploader"
                            style={{
                              padding: '0.5rem',
                              border: '2px dashed var(--neutral-border)',
                              borderRadius: '6px',
                              textAlign: 'center',
                              cursor: (isLocked || isLogoUploading) ? 'not-allowed' : 'pointer',
                              color: 'var(--text-secondary)',
                              fontWeight: 600,
                              background: '#f8fafc',
                              display: 'block',
                              fontSize: '0.75rem',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {isLogoUploading ? 'Uploading Logo...' : '+ Upload Logo'}
                          </label>

                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => setShowLogoGallery(true)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}
                          >
                            <span>Or Choose from Gallery</span>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Description</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeBlock.fields[0]?.checkItem || ''}
                        onChange={(e) => handleUpdateBlockDescription(activeBlockId!, e.target.value)}
                        placeholder="e.g. (kiểm tra trước khi load...)"
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>
                  </>
                )}

                {activeBlock.type === 'CHECKLIST_TABLE' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Table Column Labels</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ width: '45px', color: 'var(--text-muted)' }}>Col 1</span>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.columnLabels?.stt || 'STT'}
                          onChange={(e) => handleUpdateBlockColumnLabels(activeBlockId!, { stt: e.target.value })}
                          style={{ flex: 1, padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ width: '45px', color: 'var(--text-muted)' }}>Col 2</span>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.columnLabels?.item || 'Chi tiết kiểm tra'}
                          onChange={(e) => handleUpdateBlockColumnLabels(activeBlockId!, { item: e.target.value })}
                          style={{ flex: 1, padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ width: '45px', color: 'var(--text-muted)' }}>Col 3</span>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.columnLabels?.target || 'Đạt / Không Đạt'}
                          onChange={(e) => handleUpdateBlockColumnLabels(activeBlockId!, { target: e.target.value })}
                          style={{ flex: 1, padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ width: '45px', color: 'var(--text-muted)' }}>Col 4</span>
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.columnLabels?.reaction || 'Mô tả cụ thể nếu Không đạt'}
                          onChange={(e) => handleUpdateBlockColumnLabels(activeBlockId!, { reaction: e.target.value })}
                          style={{ flex: 1, padding: '0.25rem 0.4rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeBlock.type === 'MATRIX_TABLE' && activeBlock.matrixConfig && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Row Header Label</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeBlock.matrixConfig.rowHeader}
                        onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { rowHeader: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Row Count</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        disabled={isLocked}
                        value={activeBlock.matrixConfig.rowCount}
                        onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { rowCount: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Columns Group Title</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={activeBlock.matrixConfig.columnHeader}
                        onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { columnHeader: e.target.value })}
                        style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Column Items</label>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateBlockMatrixConfig(activeBlockId!, { columnAlign: 'left' })}
                            style={{
                              padding: '2px 4px',
                              background: (activeBlock.matrixConfig.columnAlign || 'center') === 'left' ? '#eff6ff' : 'transparent',
                              border: (activeBlock.matrixConfig.columnAlign || 'center') === 'left' ? '1px solid #bfdbfe' : '1px solid transparent',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: (activeBlock.matrixConfig.columnAlign || 'center') === 'left' ? '#1e40af' : '#64748b'
                            }}
                            title="Canh trái tiêu đề"
                          >
                            <AlignLeft size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => handleUpdateBlockMatrixConfig(activeBlockId!, { columnAlign: 'center' })}
                            style={{
                              padding: '2px 4px',
                              background: (activeBlock.matrixConfig.columnAlign || 'center') === 'center' ? '#eff6ff' : 'transparent',
                              border: (activeBlock.matrixConfig.columnAlign || 'center') === 'center' ? '1px solid #bfdbfe' : '1px solid transparent',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: (activeBlock.matrixConfig.columnAlign || 'center') === 'center' ? '#1e40af' : '#64748b'
                            }}
                            title="Canh giữa tiêu đề"
                          >
                            <AlignCenter size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {activeBlock.matrixConfig.columns.map((colName, cIdx) => (
                          <div key={cIdx} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              disabled={isLocked}
                              value={colName}
                              onChange={(e) => {
                                const newCols = [...activeBlock.matrixConfig!.columns];
                                newCols[cIdx] = e.target.value;
                                handleUpdateBlockMatrixConfig(activeBlockId!, { columns: newCols });
                              }}
                              placeholder={`Column ${cIdx + 1}`}
                              style={{ flex: 1, padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                            />
                            <button
                              type="button"
                              disabled={isLocked || activeBlock.matrixConfig!.columns.length <= 1}
                              onClick={() => {
                                const newCols = activeBlock.matrixConfig!.columns.filter((_, i) => i !== cIdx);
                                handleUpdateBlockMatrixConfig(activeBlockId!, { columns: newCols });
                              }}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            const newCols = [...activeBlock.matrixConfig!.columns, `SP ${activeBlock.matrixConfig!.columns.length + 1}`];
                            handleUpdateBlockMatrixConfig(activeBlockId!, { columns: newCols });
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', border: '1px dashed #94a3b8', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', justifyContent: 'center' }}
                        >
                          <Plus size={11} /> Thêm cột sản phẩm
                        </button>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={activeBlock.matrixConfig.showTotalColumn}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { showTotalColumn: e.target.checked })}
                        />
                        Hiện cột Tổng dòng
                      </label>
                      {activeBlock.matrixConfig.showTotalColumn && (
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.matrixConfig.totalColumnHeader}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { totalColumnHeader: e.target.value })}
                          style={{ padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                        />
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--neutral-border)', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={activeBlock.matrixConfig.showNotesColumn}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { showNotesColumn: e.target.checked })}
                        />
                        Hiện cột Ghi chú
                      </label>
                      {activeBlock.matrixConfig.showNotesColumn && (
                        <input
                          type="text"
                          disabled={isLocked}
                          value={activeBlock.matrixConfig.notesColumnHeader}
                          onChange={(e) => handleUpdateBlockMatrixConfig(activeBlockId!, { notesColumnHeader: e.target.value })}
                          style={{ padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.75rem' }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {(activeBlock.type === 'INFO_GRID' || activeBlock.type === 'SIGN') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Columns Layout</label>
                    <select
                      disabled={isLocked}
                      value={activeBlock.columns}
                      onChange={(e) => handleUpdateBlockColumns(activeBlockId!, parseInt(e.target.value, 10) as 1 | 2 | 3)}
                      style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                    >
                      <option value={1}>1 Column</option>
                      <option value={2}>2 Columns</option>
                      <option value={3}>3 Columns</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* GENERAL FORM PROPERTIES */
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                Form Settings
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Document Form ID</label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    placeholder="e.g. 3S-QC/F03"
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Form Title</label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '4px', border: '1px solid var(--neutral-border)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Version Control</label>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>v</span>
                    <input
                      type="number"
                      min="0"
                      disabled={isLocked}
                      value={major}
                      onChange={(e) => handleMajorChange(parseInt(e.target.value, 10) || 0)}
                      style={{ width: '55px', padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', textAlign: 'center', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>.</span>
                    <input
                      type="number"
                      min="0"
                      disabled={isLocked}
                      value={minor}
                      onChange={(e) => handleMinorChange(parseInt(e.target.value, 10) || 0)}
                      style={{ width: '55px', padding: '0.25rem 0.35rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', textAlign: 'center', fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem', fontStyle: 'italic' }}>
                      ({datePart})
                    </span>
                  </div>
                </div>

                {isLocked && (
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
                        padding: '0.4rem 0.75rem',
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
                )}

                {!isLocked && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Change Summary (For Release)</label>
                      <textarea 
                        value={changeSummary}
                        onChange={(e) => setChangeSummary(e.target.value)}
                        placeholder="Explain what was edited (e.g. Added safety guard check)..."
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.35rem' }}>
                      <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Release Date (Ngày hiệu lực)</label>
                      <input 
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          border: '1px solid var(--neutral-border)',
                          borderRadius: '4px',
                          outline: 'none',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </>
                )}

                {/* Revision history log */}
                {revisionHistory.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} />
                      <span>Revision History</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                      {revisionHistory.map((h, i) => {
                        const hasLayout = !!(h.layoutBlocks && h.layoutBlocks.length > 0);
                        return (
                          <div 
                            key={i} 
                            style={{ 
                              padding: '0.45rem', 
                              background: '#ffffff', 
                              borderRadius: '6px', 
                              border: '1px solid var(--neutral-border)', 
                              fontSize: '0.75rem',
                              cursor: hasLayout ? 'pointer' : 'default',
                              transition: 'all 0.15s ease',
                              opacity: hasLayout ? 1 : 0.7
                            }}
                            className={hasLayout ? "hover-card-bg" : ""}
                            onClick={() => hasLayout && handleRestoreRevision(h)}
                            title={hasLayout ? "Click to view this version in read-only mode" : "Version log details"}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '2px', color: '#0f4c81' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                {h.version}
                                {hasLayout && <span style={{ fontSize: '0.6rem', color: '#0284c7', background: '#e0f2fe', padding: '0.02rem 0.2rem', borderRadius: '3px' }}>VIEW</span>}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>{h.date}</span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{h.change}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>By: {h.author}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      {/* 5. LOGO GALLERY MODAL */}
      {showCopyModal && (() => {
        const availableForms: { processId: string; processTitle: string; formName: string; blocks: LayoutBlockISO[] }[] = [];
        allProcesses.forEach(proc => {
          if (proc.workflowFormsData) {
            Object.entries(proc.workflowFormsData).forEach(([fName, formData]: [string, any]) => {
              // Skip current form
              if (proc.id === initialData?.formId && fName === formName) {
                return;
              }
              if (formData && Array.isArray(formData.layoutBlocks) && formData.layoutBlocks.length > 0) {
                availableForms.push({
                  processId: proc.id,
                  processTitle: proc.title,
                  formName: fName,
                  blocks: formData.layoutBlocks
                });
              }
            });
          }
        });

        const selectedForm = availableForms.find(f => `${f.processId}:${f.formName}` === selectedFormKey);
        const selectedBlock = selectedForm?.blocks.find(b => b.id === selectedBlockId);

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '85vh',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Copy Section from Form</h3>
                <button 
                  type="button" 
                  onClick={() => setShowCopyModal(false)}
                  style={{ border: 'none', background: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>1. Select Source Form</label>
                <select 
                  value={selectedFormKey} 
                  onChange={(e) => {
                    setSelectedFormKey(e.target.value);
                    setSelectedBlockId('');
                  }}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '4px', border: '1px solid var(--neutral-border)', fontSize: '0.8rem', outline: 'none' }}
                >
                  <option value="">-- Choose a Form --</option>
                  {availableForms.map(f => {
                    const key = `${f.processId}:${f.formName}`;
                    return (
                      <option key={key} value={key}>
                        {f.processTitle} › {f.formName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>2. Select Section to Copy</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--neutral-border)', borderRadius: '4px', padding: '0.35rem' }}>
                    {selectedForm.blocks.map(block => (
                      <div 
                        key={block.id}
                        onClick={() => setSelectedBlockId(block.id)}
                        style={{
                          padding: '0.45rem 0.6rem',
                          fontSize: '0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: selectedBlockId === block.id ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${selectedBlockId === block.id ? '#10b981' : 'transparent'}`,
                          color: selectedBlockId === block.id ? '#15803d' : 'var(--text-primary)',
                          fontWeight: selectedBlockId === block.id ? 600 : 400,
                          transition: 'all 0.15s'
                        }}
                      >
                        {block.title || `Unnamed Section (${block.type})`}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBlock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>3. Section Preview</label>
                  <div style={{ 
                    padding: '0.75rem', 
                    background: '#f8fafc', 
                    border: '1px solid var(--neutral-border)', 
                    borderRadius: '6px', 
                    fontSize: '0.75rem' 
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.45rem', color: '#334155' }}>
                      {selectedBlock.title || 'Untitled Section'} ({selectedBlock.type})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '110px', overflowY: 'auto', padding: '0.1rem' }}>
                      {selectedBlock.fields.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No fields in this section.</span>
                      ) : (
                        selectedBlock.fields.map(field => (
                          <div key={field.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.5rem', background: '#ffffff', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.7rem' }}>
                            <span style={{ fontWeight: 500 }}>{field.checkItem || '(Blank Label)'}</span>
                            <span style={{ color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase' }}>{field.type}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem', borderTop: '1px solid var(--neutral-border)', paddingTop: '0.75rem' }}>
                <button 
                  type="button"
                  onClick={() => setShowCopyModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={!selectedBlock}
                  onClick={() => handleExecuteCopy(selectedBlock!)}
                  style={{
                    background: selectedBlock ? '#0f172a' : '#94a3b8',
                    border: `1px solid ${selectedBlock ? '#0f172a' : '#94a3b8'}`,
                    color: '#ffffff',
                    padding: '6px 16px',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: selectedBlock ? 'pointer' : 'not-allowed',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => { if (selectedBlock) e.currentTarget.style.background = '#1e293b'; }}
                  onMouseLeave={(e) => { if (selectedBlock) e.currentTarget.style.background = '#0f172a'; }}
                >
                  Copy Section
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {showLogoGallery && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--neutral-border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Select Brand Logo</h3>
              <button 
                type="button" 
                onClick={() => setShowLogoGallery(false)}
                style={{ border: 'none', background: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: '50vh', padding: '0.25rem' }}>
              {existingLogos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No existing logos found. Upload one to start!
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '1rem'
                }}>
                  {existingLogos.map((logo) => {
                    const key = logo.key;
                    const resolvedUrl = resolvedLogos[key];
                    const displayName = key.replace('uploads/logo_', '');
                    
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          handleUpdateBlockLogo(activeBlockId!, key);
                          setShowLogoGallery(false);
                        }}
                        style={{
                          border: '1px solid var(--neutral-border)',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: '#f8fafc',
                          transition: 'all 0.15s ease',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = '#f0fdf4';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--neutral-border)';
                          e.currentTarget.style.background = '#f8fafc';
                        }}
                      >
                        {!logo.isUsed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete logo "${displayName}"?`)) {
                                handleDeleteUnusedLogo(key);
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: 'none',
                              color: 'var(--danger)',
                              borderRadius: '4px',
                              padding: '2px 4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              zIndex: 10
                            }}
                            onMouseEnter={(ev) => ev.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
                            onMouseLeave={(ev) => ev.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            title="Delete unused logo"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}

                        <div style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                          {resolvedUrl ? (
                            <img src={resolvedUrl} alt="Logo" style={{ maxHeight: '45px', maxWidth: '100%', objectFit: 'contain' }} />
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Loading...</span>
                          )}
                        </div>
                        <span style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-secondary)',
                          textAlign: 'center',
                          wordBreak: 'break-all',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {displayName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
