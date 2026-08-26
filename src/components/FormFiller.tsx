import React, { useState, useEffect, useRef, Component } from 'react';
import type { Process, FormTemplateISO, SubmissionFieldSnapshot, Submission } from '../types';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class FormErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('FormFiller ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="paper-card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto', border: '1px solid #fca5a5', background: '#fff5f5' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
          <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Đã xảy ra lỗi khi hiển thị biểu mẫu</h3>
          <p style={{ fontSize: '0.85rem', color: '#7f1d1d', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'Không thể tải được dữ liệu biểu mẫu số.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { formatFormVersion, getColStyleWidth } from '../types';
import { sanitizeLabel, getEffectiveTitleFormat, validateFormSubmission, getAutoCheckboxLayoutMode, hasLongOptions, canTableOptionsFitInline, getCheckboxGridTemplate, isSeamlessTableBlock, getInfoGridTemplateColumns } from '../utils/formUtils';
import { renderFormattedText } from '../utils/textFormatter';
import PrintBlankForm from './print/PrintBlankForm';
import PrintFilledForm from './print/PrintFilledForm';
import { 
  ArrowLeft, 
  CheckCircle2, 
  X, 
  Camera, 
  AlertTriangle, 
  Link2,
  PenTool,
  Trash2,
  Printer,
  Star,
  FileText,
  Globe,
  Lock
} from 'lucide-react';

const parseSubtableValue = (val: string): Record<string, string>[] => {
  try { return JSON.parse(val || '[]'); } catch { return []; }
};
const stringifySubtableValue = (rows: Record<string, string>[]): string => JSON.stringify(rows);

interface AutoResizingTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

const AutoResizingTextarea: React.FC<AutoResizingTextareaProps> = ({
  value,
  onChange,
  placeholder,
  style,
  className
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 34)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      placeholder={placeholder}
      rows={1}
      style={{
        width: '100%',
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        lineHeight: '1.4',
        fontFamily: 'inherit',
        ...style
      }}
      className={className}
    />
  );
};

interface FormFillerProps {
  processId: string;
  formName: string;
  onBack: () => void;
  initialSubmission?: Submission;
  editSubmissionId?: string;
  isPublicGuestMode?: boolean;
}


function FormFillerInner({ 
  processId, 
  formName, 
  onBack, 
  initialSubmission, 
  editSubmissionId,
  isPublicGuestMode
}: FormFillerProps) {
  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form Filler UI states
  const [formValues, setFormValues] = useState<{ [fieldId: string]: string }>({});
  const [fieldReactions, setFieldReactions] = useState<{ [fieldId: string]: string }>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<{ [fieldId: string]: string[] }>({}); // fieldId -> array of keys
  const [isPhotoUploading, setIsPhotoUploading] = useState<{ [fieldId: string]: boolean }>({});
  const [operatorId, setOperatorId] = useState('');
  const [signValues, setSignValues] = useState<{ [fieldId: string]: { name: string; confirmedAt: string } | null }>({});
  const [signInputs, setSignInputs] = useState<{ [fieldId: string]: string }>({});
  const [signOpen, setSignOpen] = useState<{ [fieldId: string]: boolean }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [showPrintBlank, setShowPrintBlank] = useState(false);
  const [autoExportPdf, setAutoExportPdf] = useState(false);
  const [printCurrentSubmission, setPrintCurrentSubmission] = useState<Submission | null>(null);

  // Smart Public Link State
  const [isPublic, setIsPublic] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'public';
  });

  const handleTogglePublic = () => {
    setIsPublic(prev => !prev);
  };

  // Dynamic Table Rows state: blockId -> TableRowConfig[]
  const [tableRowsMap, setTableRowsMap] = useState<{ [blockId: string]: any[] }>({});

  // Helper to initialize table rows: preserves 100% of designed template rows without collapsing or auto-inserting extra rows
  const initSmartTableRows = (block: any): any[] => {
    return block.tableRows || [];
  };

  const handleAddTableRowToGroup = (block: any, groupHeaderId?: string) => {
    const blockId = block.id;
    const currentRows = tableRowsMap[blockId] || initSmartTableRows(block);
    const newRowId = `row_dyn_${Date.now()}`;
    const newRow = { id: newRowId, isDynamic: true, groupId: groupHeaderId };

    if (!groupHeaderId) {
      setTableRowsMap(prev => ({
        ...prev,
        [blockId]: [...currentRows, newRow]
      }));
      return;
    }

    let insertIndex = -1;
    let foundGroup = false;

    for (let i = 0; i < currentRows.length; i++) {
      const r = currentRows[i];
      if (r.id === groupHeaderId) {
        foundGroup = true;
        insertIndex = i;
        continue;
      }
      if (foundGroup) {
        if (r.isGroupHeader) break;
        insertIndex = i;
      }
    }

    const nextRows = [...currentRows];
    if (insertIndex !== -1) {
      nextRows.splice(insertIndex + 1, 0, newRow);
    } else {
      nextRows.push(newRow);
    }

    setTableRowsMap(prev => ({
      ...prev,
      [blockId]: nextRows
    }));
  };



  const handleDeleteTableRow = (blockId: string, rowId: string, block?: any) => {
    setTableRowsMap(prev => {
      const currentRows = prev[blockId] || (block ? initSmartTableRows(block) : []);
      const nextRows = currentRows.filter((r: any) => r.id !== rowId);
      return { ...prev, [blockId]: nextRows };
    });

    setFormValues(prev => {
      const nextValues = { ...prev };
      Object.keys(nextValues).forEach(key => {
        if (key.startsWith(`${blockId}_${rowId}_`)) {
          delete nextValues[key];
        }
      });
      return nextValues;
    });
  };

  // Auto-append new row when user types in the last row of a group / table
  const handleTableCellChangeWithAutoAppend = (
    block: any,
    rowId: string,
    colId: string,
    val: string,
    groupId?: string
  ) => {
    const cellKey = `${block.id}_${rowId}_${colId}`;
    setFormValues(prev => ({ ...prev, [cellKey]: val }));

    if (val && val.trim() !== '') {
      const currentRows = tableRowsMap[block.id] || initSmartTableRows(block);
      const groupRows = groupId 
        ? currentRows.filter((r: any) => r.groupId === groupId || r.id === groupId)
        : currentRows;

      const lastRowOfGroup = groupRows[groupRows.length - 1];
      if (lastRowOfGroup && lastRowOfGroup.id === rowId) {
        handleAddTableRowToGroup(block, groupId);
      }
    }
  };

  // Load initial values if editing
  useEffect(() => {
    if (initialSubmission && process && formTemplate) {
      const restoredValues: { [fieldId: string]: string } = {};
      const restoredReactions: { [fieldId: string]: string } = {};
      
      initialSubmission.formData.forEach((snapshot: any) => {
        let baseValue = snapshot.value;
        const actionMatch = snapshot.value.match(/^(.*?) \(Action: (.*?)\)$/);
        if (actionMatch) {
          baseValue = actionMatch[1];
          restoredReactions[snapshot.id] = actionMatch[2];
        }
        
        restoredValues[snapshot.id] = baseValue;
        
        // Parse signatures if signature field
        const signBlocks = formTemplate.layoutBlocks?.filter((b: any) => b.type === 'SIGN') || [];
        const isSignField = signBlocks.some((b: any) => b.fields.some((f: any) => f.id === snapshot.id));
        if (isSignField && baseValue) {
          const signMatch = baseValue.match(/^(.*?) \[Xác thực: (.*?)\]$/);
          if (signMatch) {
            setSignValues(prev => ({
              ...prev,
              [snapshot.id]: { name: signMatch[1], confirmedAt: new Date().toISOString() }
            }));
          } else {
            setSignValues(prev => ({
              ...prev,
              [snapshot.id]: { name: baseValue, confirmedAt: new Date().toISOString() }
            }));
          }
        }
      });
      
      setFormValues(restoredValues);
      setFieldReactions(restoredReactions);
      setOperatorId(initialSubmission.operatorId || '');
    }
  }, [initialSubmission, process]);

  const calculateSummaryValue = (
    col: any,
    row: any,
    block: any,
    currentValues: { [key: string]: string }
  ): number => {
    if (row.type === 'sum') {
      let sum = 0;
      (block.tableRows || []).forEach((r: any) => {
        const cellKey = `${block.id}_${r.id}_${col.id}`;
        const valStr = currentValues[cellKey] || '';
        const num = parseFloat(valStr.replace(/,/g, '')) || 0;
        sum += num;
      });
      return sum;
    }
    if (row.type === 'manual') {
      const cellKey = `${block.id}_summary_${col.id}_${row.id}`;
      const valStr = currentValues[cellKey] || '';
      return parseFloat(valStr.replace(/,/g, '')) || 0;
    }
    if (row.type === 'percentage') {
      if (!row.percentageOfId) return 0;
      const parentRow = (col.summaryRows || []).find((r: any) => r.id === row.percentageOfId);
      if (!parentRow) return 0;
      const parentVal = calculateSummaryValue(col, parentRow, block, currentValues);
      return parentVal * ((row.percentageValue || 0) / 100);
    }
    if (row.type === 'sum_all') {
      let sum = 0;
      (row.sumRowIds || []).forEach((id: string) => {
        const targetRow = (col.summaryRows || []).find((r: any) => r.id === id);
        if (targetRow) {
          sum += calculateSummaryValue(col, targetRow, block, currentValues);
        }
      });
      return sum;
    }
    return 0;
  };

  // Fetch process details
  const fetchProcess = async () => {
    try {
      setLoading(true);
      if (!processId || processId === 'unlinked') {
        const res = await fetch(`/api/forms/${encodeURIComponent(formName)}`);
        if (!res.ok) throw new Error('Failed to fetch unlinked form');
        const formRecord = await res.json();
        
        const layoutBlocks = typeof formRecord.layout_blocks === 'string'
          ? JSON.parse(formRecord.layout_blocks)
          : (formRecord.layout_blocks || []);
        
        const virtualProc: Process = {
          id: 'unlinked',
          title: 'Biểu mẫu tự do',
          description: 'Biểu mẫu chưa liên kết quy trình',
          version: 'V1.0',
          status: 'Active',
          steps: [],
          parentProcessId: 'unlinked',
          roles: [],
          formFields: [],
          lastUpdated: formRecord.updated_at || new Date().toISOString(),
          workflowFormsData: {
            [formName]: {
              formId: formName,
              formTitle: formRecord.form_title || formRecord.form_name || formName,
              version: formRecord.version || 'v0.1',
              status: formRecord.status || 'DRAFT',
              layoutBlocks
            }
          }
        };
        setProcess(virtualProc);
      } else {
        const res = await fetch('/api/processes');
        if (!res.ok) throw new Error('Failed to fetch processes');
        const procList: Process[] = await res.json();
        const foundProc = procList.find(p => p.id === processId);
        if (foundProc) {
          setProcess(foundProc);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error loading form details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcess();
  }, [processId]);

  // Copy share link helper
  const handleCopyShareLink = () => {
    const baseUrl = `${window.location.origin}/?page=fill&processId=${processId}&formName=${encodeURIComponent(formName)}`;
    const shareUrl = isPublic ? `${baseUrl}&mode=public` : baseUrl;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        const msg = isPublic 
          ? '✓ Đã sao chép liên kết công khai! (Khách có thể điền không cần đăng nhập)\n' + shareUrl
          : '✓ Đã sao chép liên kết nội bộ! (Yêu cầu đăng nhập)\n' + shareUrl;
        alert(msg);
      })
      .catch((err) => {
        console.error(err);
        alert('Không thể sao chép liên kết.');
      });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading digital template form...</div>
      </div>
    );
  }

  if (!process || !process.workflowFormsData || !process.workflowFormsData[formName]) {
    return (
      <div className="paper-card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <X size={48} style={{ color: '#ef4444', marginBottom: '1rem' }} />
        <h3>Form template not found</h3>
        <p>Could not locate the form "{formName}" in process "{process?.title || processId}".</p>
        {onBack && (
          <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '1rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>
    );
  }

  const formTemplate = process.workflowFormsData[formName] as FormTemplateISO;

  // Photo uploading callback
  const handlePhotoUpload = async (fieldId: string, file: File) => {
    setIsPhotoUploading(prev => ({ ...prev, [fieldId]: true }));
    try {
      const presignRes = await fetch('/api/storage/presign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processId: process.id,
          formName,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
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

      setUploadedPhotos(prev => ({
        ...prev,
        [fieldId]: [...(prev[fieldId] || []), pdfKey]
      }));

      alert('Photo evidence uploaded successfully!');
    } catch (err) {
      console.error(err);
      alert(`Error uploading photo: ${err instanceof Error ? err.message : 'Upload failed'}`);
    } finally {
      setIsPhotoUploading(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  // Helper: Collect snapshots from UI state
  const buildSubmissionSnapshots = (forPrint: boolean = false) => {
    const allFields = formTemplate?.layoutBlocks?.flatMap((b: any) => b.fields || []) || [];
    let isOverallPass = true;
    const snapshots: SubmissionFieldSnapshot[] = [];

    allFields.forEach((field: any) => {
      const val = formValues[field.id];
      let fieldStatus: 'PASS' | 'FAIL' = 'PASS';
      let targetRange = '';

      if (val === undefined || val === '') {
        fieldStatus = 'PASS';
        targetRange = field.targetRange || (field.unit ? `Unit: ${field.unit}` : 'N/A');
      } else if (field.type === 'number') {
        const numVal = parseFloat(val);
        const minVal = field.minSpec ?? -Infinity;
        const maxVal = field.maxSpec ?? Infinity;
        const hasMin = field.minSpec !== undefined && field.minSpec !== null;
        const hasMax = field.maxSpec !== undefined && field.maxSpec !== null;
        if (hasMin && hasMax) {
          targetRange = `${field.minSpec} - ${field.maxSpec} ${field.unit || ''}`;
        } else if (hasMin) {
          targetRange = `>= ${field.minSpec} ${field.unit || ''}`;
        } else if (hasMax) {
          targetRange = `<= ${field.maxSpec} ${field.unit || ''}`;
        } else {
          targetRange = field.unit ? `Unit: ${field.unit}` : '';
        }
        if (isNaN(numVal) || numVal < minVal || numVal > maxVal) {
          fieldStatus = 'FAIL';
          isOverallPass = false;
        }
      } else if (field.type === 'radio' || field.type === 'checkbox') {
        targetRange = field.options ? field.options.filter((o: any) => o.isPass).map((o: any) => o.label).join(' / ') : (field.targetRange || 'Checked & Ok');
        if (field.type === 'checkbox') {
          const selectedVals = val ? val.split(',').filter(Boolean) : [];
          if (selectedVals.length > 0) {
            const hasFail = selectedVals.some(v => {
              const opt = field.options?.find((o: any) => o.value === v);
              return opt && !opt.isPass;
            });
            if (hasFail) {
              fieldStatus = 'FAIL';
              isOverallPass = false;
            }
          }
        } else {
          const selectedOpt = field.options?.find((o: any) => o.value === val);
          if (selectedOpt && !selectedOpt.isPass) {
            fieldStatus = 'FAIL';
            isOverallPass = false;
          }
        }
      } else {
        targetRange = field.targetRange || 'N/A';
      }

      if (fieldStatus === 'FAIL' && !fieldReactions[field.id]?.trim() && !forPrint) {
        throw new Error(`Corrective Action Containment log is required for failed check: "${field.checkItem}".`);
      }

      const actionText = fieldReactions[field.id]?.trim() ? ` (Action: ${fieldReactions[field.id]})` : '';

      snapshots.push({
        id: field.id,
        checkItem: field.checkItem,
        locationCode: field.locationCode || 'N/A',
        targetRange,
        reactionProtocol: field.reactionProtocol,
        value: (val || '') + (fieldStatus === 'FAIL' ? actionText : ''),
        status: fieldStatus
      });
    });

    // Collect regular table values dynamically
    formTemplate?.layoutBlocks?.forEach((block: any) => {
      if (block.type === 'TABLE' && block.tableColumns && block.tableRows) {
        block.tableRows.forEach((row: any, rIdx: number) => {
          const staticCols = block.tableColumns.filter((c: any) => c.type === 'static_text');
          const rowLabel = staticCols.length > 0 
            ? staticCols.map((c: any) => block.tableData?.[row.id]?.[c.id] || '').join(' ') 
            : `Dòng ${rIdx + 1}`;

          block.tableColumns.forEach((col: any) => {
            if (col.type !== 'static_text') {
              const key = `${block.id}_${row.id}_${col.id}`;
              const val = formValues[key] || '';
              snapshots.push({
                id: key,
                checkItem: `${rowLabel} - ${col.label}`,
                locationCode: 'N/A',
                targetRange: 'Nhập liệu',
                reactionProtocol: '',
                value: val,
                status: 'PASS'
              });
            }
          });
        });

        // Collect summary row values
        block.tableColumns.forEach((col: any) => {
          if (col.type === 'number' && col.summaryRows) {
            col.summaryRows.forEach((sRow: any) => {
              const key = `${block.id}_summary_${col.id}_${sRow.id}`;
              const val = calculateSummaryValue(col, sRow, block, formValues);
              snapshots.push({
                id: key,
                checkItem: `Hàng cộng (${col.label}): ${sRow.label}`,
                locationCode: 'N/A',
                targetRange: 'Tính toán chân bảng',
                reactionProtocol: '',
                value: String(val),
                status: 'PASS'
              });
            });
          }
        });
      }
    });

    // Collect matrix table values dynamically
    formTemplate?.layoutBlocks?.forEach((block: any) => {
      if (block.type === 'MATRIX_TABLE' && block.matrixConfig) {
        const config = block.matrixConfig;
        for (let rIdx = 0; rIdx < config.rowCount; rIdx++) {
          config.columns.forEach((colName: string, cIdx: number) => {
            const key = `${block.id}_row_${rIdx}_col_${cIdx}`;
            const val = formValues[key] || '';
            snapshots.push({
              id: key,
              checkItem: `${config.rowHeader} ${rIdx + 1} - ${colName || `Cột ${cIdx + 1}`}`,
              locationCode: 'N/A',
              targetRange: 'Tally Count',
              reactionProtocol: '',
              value: val || '0',
              status: 'PASS'
            });
          });
          if (config.showNotesColumn) {
            const noteKey = `${block.id}_row_${rIdx}_note`;
            const noteVal = formValues[noteKey] || '';
            if (noteVal.trim()) {
              snapshots.push({
                id: noteKey,
                checkItem: `${config.rowHeader} ${rIdx + 1} - Ghi chú`,
                locationCode: 'N/A',
                targetRange: 'Ghi chú',
                reactionProtocol: '',
                value: noteVal,
                status: 'PASS'
              });
            }
          }
        }
      }
    });

    // Collect SIGN block signatures dynamically
    const signBlocks = formTemplate?.layoutBlocks?.filter((b: any) => b.type === 'SIGN') || [];
    signBlocks.forEach((block: any) => {
      (block.fields || []).forEach((f: any) => {
        const sv = signValues[f.id];
        if (sv) {
          snapshots.push({
            id: f.id,
            checkItem: f.checkItem,
            locationCode: `SIGN_${f.id}`,
            targetRange: 'Chữ ký điện tử',
            reactionProtocol: f.reactionProtocol || 'Ký và ghi rõ họ tên',
            value: `${sv.name} [Xác thực: ${new Date(sv.confirmedAt).toLocaleString('vi-VN')}]`,
            status: 'PASS'
          });
        }
      });
    });

    const titleBlock = formTemplate?.layoutBlocks?.find((b: any) => b.type === 'TITLE' && b.showDate);
    if (titleBlock) {
      snapshots.push({
        id: '__title_date__',
        checkItem: 'Ngày',
        locationCode: 'TITLE',
        targetRange: 'Ngày kiểm tra',
        reactionProtocol: '',
        value: formValues['__title_date__'] || '',
        status: 'PASS'
      });
    }

    return { snapshots, isOverallPass };
  };

  // Submit filled form
  const handleSubmitForm = async () => {
    const signBlocks = formTemplate.layoutBlocks?.filter((b: any) => b.type === 'SIGN' && b.fields.length > 0) || [];
    const mandatorySignField = signBlocks[0]?.fields[0];
    const hasSignBlock = !!mandatorySignField;

    if (hasSignBlock && !signValues[mandatorySignField.id]?.name?.trim()) {
      alert(`Vui lòng ký xác nhận tại ô chữ ký bắt buộc ("${mandatorySignField.checkItem}") trước khi nộp phiếu.`);
      return;
    }

    if (!hasSignBlock && !operatorId.trim()) {
      alert('Vui lòng nhập họ và tên người điền phiếu.');
      return;
    }

    const effectiveOperatorId = hasSignBlock
      ? signValues[mandatorySignField.id]!.name
      : operatorId;

    const validationResult = validateFormSubmission(formTemplate, formValues);
    if (!validationResult.isValid) {
      alert(validationResult.errors.join('\n'));
      return;
    }

    try {
      const { snapshots, isOverallPass } = buildSubmissionSnapshots(false);

      const allMediaKeys: string[] = [];
      Object.values(uploadedPhotos).forEach(keys => {
        allMediaKeys.push(...keys);
      });

      if (!isOverallPass && allMediaKeys.length === 0) {
        throw new Error('⚠️ QMS Protocol: Photo evidence is required for out-of-specification abnormalities.');
      }

      setSubmitting(true);
      const submissionId = editSubmissionId;
      
      const payload = {
        id: submissionId,
        processId: process.id,
        formId: formTemplate.formId,
        formVersion: formTemplate.version,
        operatorId: effectiveOperatorId,
        status: isOverallPass ? 'PASS' : 'ABNORMALITY',
        formData: snapshots,
        mediaUrls: editSubmissionId ? (initialSubmission?.mediaUrls || []) : allMediaKeys
      };

      if (editSubmissionId && allMediaKeys.length > 0) {
        const uniqueKeys = new Set([...(initialSubmission?.mediaUrls || []), ...allMediaKeys]);
        payload.mediaUrls = Array.from(uniqueKeys);
      }
 
      const res = await fetch(editSubmissionId ? `/api/submissions/${editSubmissionId}` : '/api/submissions', {
        method: editSubmissionId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
 
      if (!res.ok) throw new Error('Submission server error');
      const resData = await res.json();
      const finalId = resData.id || submissionId;
       
      setSubmittedId(finalId);
      
      // Reset states
      setFormValues({});
      setFieldReactions({});
      setUploadedPhotos({});
      setOperatorId('');
      setSignValues({});
      setSignInputs({});
      setSignOpen({});
    } catch (err) {
      console.error(err);
      alert(`Failed to submit: ${err instanceof Error ? err.message : 'Server error'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Submission success UI
  if (submittedId) {
    return (
      <div className="paper-card" style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '4rem auto', borderTop: '4px solid #10b981' }}>
        <CheckCircle2 size={56} style={{ color: '#10b981', marginBottom: '1.25rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          {editSubmissionId ? 'Record Updated Successfully!' : 'Record Submitted Successfully!'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          {editSubmissionId 
            ? 'Your changes have been saved and overwritten on the server.'
            : 'Your check record has been securely uploaded and cataloged.'}
          <br />
          Submission ID: <strong style={{ fontFamily: 'monospace' }}>{submittedId}</strong>
        </p>
        
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary" 
            onClick={() => setSubmittedId(null)}
          >
            Fill Another Record
          </button>
          
          <button className="btn btn-secondary" onClick={onBack}>
            Back to Form Manager
          </button>
        </div>
      </div>
    );
  }

  // Print blank form overlay
  if (showPrintBlank && formTemplate) {
    return (
      <PrintBlankForm
        template={formTemplate}
        autoExportPdf={autoExportPdf}
        exportMode={autoExportPdf}
        onClose={() => {
          setShowPrintBlank(false);
          setAutoExportPdf(false);
        }}
      />
    );
  }

  // Print draft current filled form overlay
  if (printCurrentSubmission && formTemplate) {
    return (
      <PrintFilledForm
        submission={printCurrentSubmission}
        formTemplate={formTemplate}
        onClose={() => setPrintCurrentSubmission(null)}
      />
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {editSubmissionId && (
        <div style={{
          background: '#fff7ed',
          border: '1px solid #ffedd5',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#c2410c',
          marginTop: '1rem'
        }}>
          <AlertTriangle size={20} style={{ color: '#ea580c', flexShrink: 0 }} />
          <div style={{ fontSize: '0.88rem' }}>
            <strong>Admin Edit Mode</strong> — Đang chỉnh sửa bản ghi <code style={{ background: '#ffedd5', padding: '0.1rem 0.3rem', borderRadius: '4px', fontFamily: 'monospace' }}>{editSubmissionId}</code>. 
            Lưu lại sẽ <strong>ghi đè (overwrite)</strong> bản ghi gốc này.
          </div>
        </div>
      )}
      
      {/* Standalone Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {!isPublicGuestMode && (
            <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => {
              setAutoExportPdf(true);
              setShowPrintBlank(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem' }}
            title="Tải biểu mẫu dạng Fillable PDF tương tác"
          >
            <FileText size={13} />
            <span>PDF</span>
          </button>

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setShowPrintBlank(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem' }}
            title="In form trắng A4 để ghi tay"
          >
            <Printer size={13} />
            <span>In form trắng</span>
          </button>

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => {
              const signBlocks = formTemplate?.layoutBlocks?.filter((b: any) => b.type === 'SIGN' && b.fields.length > 0) || [];
              const mandatorySignField = signBlocks[0]?.fields[0];
              const effectiveOperatorId = mandatorySignField && signValues[mandatorySignField.id]
                ? signValues[mandatorySignField.id]!.name
                : operatorId;

              const { snapshots, isOverallPass } = buildSubmissionSnapshots(true);
              const allMediaKeys: string[] = [];
              Object.values(uploadedPhotos).forEach(keys => {
                allMediaKeys.push(...keys);
              });

              const draftSub: Submission = {
                id: editSubmissionId || `draft_${Date.now()}`,
                processId: processId,
                formId: formTemplate.formId,
                formVersion: formTemplate.version,
                operatorId: effectiveOperatorId || 'DRAFT',
                submittedAt: new Date().toISOString(),
                status: isOverallPass ? 'PASS' : 'ABNORMALITY',
                formData: snapshots,
                mediaUrls: editSubmissionId ? (initialSubmission?.mediaUrls || []) : allMediaKeys
              };
              if (editSubmissionId && allMediaKeys.length > 0) {
                const uniqueKeys = new Set([...(initialSubmission?.mediaUrls || []), ...allMediaKeys]);
                draftSub.mediaUrls = Array.from(uniqueKeys);
              }
              setPrintCurrentSubmission(draftSub);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem' }}
            title="In bản khai hiện tại cùng dữ liệu đang nhập"
          >
            <Printer size={13} style={{ color: '#0d9488' }} />
            <span>In bản khai</span>
          </button>

          {/* Smart Status Pill & Copy Link Button (Only for internal users) */}
          {!isPublicGuestMode && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              borderRadius: '6px',
              border: isPublic ? '1px solid #0d9488' : '1px solid var(--neutral-border)',
              overflow: 'hidden',
              fontSize: '0.78rem',
              background: isPublic ? '#f0fdf4' : '#ffffff'
            }}>
              <button
                type="button"
                onClick={handleTogglePublic}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.65rem',
                  border: 'none',
                  background: isPublic ? '#ccfbf1' : '#f1f5f9',
                  color: isPublic ? '#0f766e' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderRight: '1px solid var(--neutral-border)'
                }}
                title={isPublic ? 'Bật công khai (Click để chuyển về cần đăng nhập)' : 'Tắt công khai (Click để mở công khai)'}
              >
                {isPublic ? <Globe size={13} style={{ color: '#0d9488' }} /> : <Lock size={13} />}
                <span>{isPublic ? 'Link công khai' : 'Cần đăng nhập'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyShareLink}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Sao chép đường dẫn điền phiếu"
              >
                <Link2 size={13} />
                <span>Sao chép link</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Form Paper Card */}
      <div className="paper-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {/* Checklist Groups */}
        {formTemplate.layoutBlocks && formTemplate.layoutBlocks.map((block: any, index: number) => {
          if (block.type === 'PAGE_BREAK') return null;
          if ((!block.fields || block.fields.length === 0) && block.type !== 'TITLE' && block.type !== 'SECTION_LABEL' && block.type !== 'TABLE') return null;

          const prevBlock = index > 0 ? formTemplate.layoutBlocks[index - 1] : undefined;
          const isSeamless = isSeamlessTableBlock(block, prevBlock);
          const isPrevSection = prevBlock?.type === 'SECTION_LABEL' && getEffectiveTitleFormat(prevBlock) !== 'NONE';

          if (block.type === 'SECTION_LABEL') {
            const titleFmt = getEffectiveTitleFormat(block);
            if (titleFmt === 'NONE') return null;
            return (
              <div key={block.id} style={titleFmt === 'H1' ? {
                padding: '0.15rem 0',
                marginTop: index === 0 ? '0' : '24px',
                marginBottom: '8px'
              } : titleFmt === 'H2' ? {
                padding: '0.6rem 0.85rem',
                background: '#f1f5f9',
                borderLeft: '4px solid var(--primary)',
                borderRadius: '0px',
                marginTop: index === 0 ? '0' : '24px',
                marginBottom: '8px'
              } : {
                padding: '0.2rem 0',
                marginTop: index === 0 ? '0' : '20px',
                marginBottom: '6px'
              }}>
                {titleFmt === 'H1' ? (
                  <h2 style={{
                    display: 'inline-block',
                    margin: '0 0 4px 0',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2.5px solid var(--text-primary)',
                    paddingBottom: '0.3rem'
                  }}>
                    {block.title}
                  </h2>
                ) : titleFmt === 'H2' ? (
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.0rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {block.title}
                  </h3>
                ) : (
                  <div style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {block.title}
                  </div>
                )}
                {block.description && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                    {block.description}
                  </p>
                )}
              </div>
            );
          }

          const blockTitleFmt = getEffectiveTitleFormat(block);

          let blockMarginTop = '0px';
          if (index > 0) {
            if (isSeamless) {
              blockMarginTop = '-1px';
            } else if (isPrevSection) {
              blockMarginTop = '0px';
            } else {
              blockMarginTop = '16px';
            }
          }

          return (
            <div key={block.id} style={{
              border: 'none',
              borderRadius: '0',
              padding: '0',
              marginTop: blockMarginTop,
              background: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {blockTitleFmt !== 'NONE' && block.type !== 'TITLE' && (
                blockTitleFmt === 'H1' ? (
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', borderBottom: '2px solid var(--text-primary)', paddingBottom: '0.3rem' }}>
                    {block.title}
                  </h2>
                ) : blockTitleFmt === 'H2' ? (
                  <div style={{ padding: '0.6rem 0.8rem', background: '#f1f5f9', borderLeft: '4px solid var(--primary)', borderRadius: '4px', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {block.title}
                  </div>
                ) : (
                  <div style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {block.title}
                  </div>
                )
              )}

              {/* 1. TITLE BLOCK */}
              {block.type === 'TITLE' && (
                <div style={{ textAlign: 'center', padding: '0.5rem 0', position: 'relative' }}>
                  {block.showDate && block.datePosition === 'A' && (
                    <div style={{ position: 'absolute', right: 0, top: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span>
                      <input
                        type="date"
                        value={formValues['__title_date__'] || ''}
                        onChange={(e) => setFormValues(prev => ({ ...prev, '__title_date__': e.target.value }))}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem 0', textTransform: 'uppercase' }}>{block.title}</h1>
                  <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-secondary)', margin: 0 }}>
                    {(block.fields || [])[0]?.checkItem}
                  </p>
                  {block.showDate && (block.datePosition ?? 'B') === 'B' && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 600 }}>Ngày</span>
                      <input
                        type="date"
                        value={formValues['__title_date__'] || ''}
                        onChange={(e) => setFormValues(prev => ({ ...prev, '__title_date__': e.target.value }))}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 2. INFO GRID BLOCK */}
              {block.type === 'INFO_GRID' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: getInfoGridTemplateColumns(block),
                  gap: '1rem'
                }}>
                  {(block.fields || []).map((field: any) => {
                    const value = formValues[field.id] || '';
                    const inputStyle = { padding: '0.45rem 0.6rem', fontSize: '0.82rem', border: '1px solid #e2e8f0', borderRadius: '4px', width: '100%', height: '36px', backgroundColor: '#f8fafc' };
                    const parsedRSpan = field.type === 'subtable' ? undefined : (field.rowSpan ? Number(field.rowSpan) : undefined);
                    const rSpan = parsedRSpan && !isNaN(parsedRSpan) && parsedRSpan > 1 ? parsedRSpan : undefined;
                    const cSpan = field.type === 'subtable' ? -1 : (field.colSpan ? Number(field.colSpan) : undefined);

                    if (field.type === 'label') {
                      return (
                        <div 
                          key={field.id} 
                          style={{ 
                            gridRow: rSpan ? `span ${rSpan}` : undefined,
                            gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                            display: 'flex', 
                            alignItems: 'center',
                            padding: '0.45rem 0',
                          }}
                        >
                          <span style={{ fontSize: '0.82rem', fontWeight: 400, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                            {renderFormattedText(sanitizeLabel(field.checkItem))}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={field.id} 
                        style={{ 
                          gridRow: rSpan ? `span ${rSpan}` : undefined,
                          gridColumn: cSpan && cSpan > 1 ? `span ${cSpan}` : cSpan === -1 ? '1 / -1' : undefined,
                          alignSelf: field.type === 'photo' ? 'stretch' : 'start',
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.35rem',
                        }}
                      >
                        <label style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                          {renderFormattedText(sanitizeLabel(field.checkItem))}
                        </label>
                        {field.type === 'date' ? (
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                            style={inputStyle}
                          />
                        ) : field.type === 'time' ? (
                          field.timeMode === 'dual' ? (() => {
                            const parts = (value || '').split(' - ');
                            const sTime = parts[0] || '';
                            const eTime = parts[1] || '';
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Từ</span>
                                  <input 
                                    type="time" 
                                    value={sTime} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormValues(prev => ({ ...prev, [field.id]: `${val} - ${eTime}` }));
                                    }}
                                    style={inputStyle}
                                  />
                                </div>
                                <span style={{ marginTop: '12px', color: '#cbd5e1' }}>~</span>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Đến</span>
                                  <input 
                                    type="time" 
                                    value={eTime} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFormValues(prev => ({ ...prev, [field.id]: `${sTime} - ${val}` }));
                                    }}
                                    style={inputStyle}
                                  />
                                </div>
                              </div>
                            );
                          })() : (
                            <input 
                              type="time"
                              value={value}
                              onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                              style={inputStyle}
                            />
                          )
                        ) : field.type === 'checkbox' ? (() => {
                          const isOptionC = getAutoCheckboxLayoutMode(field, block.columns) === 'OPTION_C';
                          const isLongOpt = hasLongOptions(field);
                          return (
                            <div style={{
                              display: 'flex',
                              flexDirection: isOptionC && isLongOpt ? 'column' : 'row',
                              flexWrap: isOptionC && isLongOpt ? 'nowrap' : 'wrap',
                              gap: isOptionC && isLongOpt ? '6px' : '6px 20px',
                              alignItems: isOptionC && isLongOpt ? 'flex-start' : 'center',
                              padding: '4px 0',
                              paddingLeft: isOptionC ? '1rem' : '0'
                            }}>
                              {(field.options ?? [{ label: 'Có', value: 'YES' }, { label: 'Không', value: 'NO' }]).map((opt: any) => {
                                const currentValues = value ? value.split(',').filter(Boolean) : [];
                                const isChecked = currentValues.includes(opt.value || opt.label);
                                return (
                                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      style={{ marginTop: '2px', flexShrink: 0 }}
                                      onChange={(e) => {
                                        const val = opt.value || opt.label;
                                        let nextValues;
                                        if (e.target.checked) {
                                          nextValues = [...currentValues, val];
                                        } else {
                                          nextValues = currentValues.filter((v: string) => v !== val);
                                        }
                                        setFormValues(prev => ({ ...prev, [field.id]: nextValues.join(',') }));
                                      }} 
                                    />
                                    <span style={{ lineHeight: '1.3' }}>{opt.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })() : field.type === 'radio' ? (
                          <select
                            value={value}
                            onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                            style={inputStyle}
                          >
                            <option value="">-- Chọn --</option>
                            {(field.options ?? [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }]).map((opt: any) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : field.type === 'photo' ? (() => {
                          const photoKeys = uploadedPhotos[field.id] || [];
                          const singleKey = photoKeys[0];
                          const isUploading = isPhotoUploading[field.id];

                          return (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100px' }}>
                              <input
                                type="file"
                                accept="image/*"
                                id={`photo_input_${field.id}`}
                                style={{ display: 'none' }}
                                disabled={isUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoUpload(field.id, file);
                                }}
                              />
                              {singleKey ? (
                                <div style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', padding: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                  <img
                                    src={`/api/storage/download-url?key=${encodeURIComponent(singleKey)}`}
                                    alt="Evidence"
                                    style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: '3px' }}
                                  />
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                    <button
                                      type="button"
                                      onClick={() => document.getElementById(`photo_input_${field.id}`)?.click()}
                                      disabled={isUploading}
                                      style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                      🔄 Thay ảnh
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setUploadedPhotos(prev => {
                                        const next = { ...prev };
                                        delete next[field.id];
                                        return next;
                                      })}
                                      style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', borderRadius: '3px', cursor: 'pointer' }}
                                    >
                                      🗑️ Xóa
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => !isUploading && document.getElementById(`photo_input_${field.id}`)?.click()}
                                  style={{ flex: 1, border: '1.5px dashed #cbd5e1', borderRadius: '4px', background: '#f8fafc', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', minHeight: '80px' }}
                                >
                                  <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500, fontStyle: 'italic', textAlign: 'center' }}>
                                    {isUploading ? 'Đang tải ảnh...' : (field.placeholder ?? '')}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
                                    (Hỗ trợ PNG, JPG, JPEG)
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })() : field.type === 'subtable' ? (() => {
                          const cols = field.subtableColumns ?? [];
                          const hasStaticCol = cols.some((c: any) => c.type === 'static_text');
                          let rows: Record<string, string>[] = parseSubtableValue(value);
                          if (hasStaticCol) {
                            const staticDataKeys = Object.keys(field.subtableStaticData || {}).map(Number).filter(n => !isNaN(n));
                            const maxStaticKey = staticDataKeys.length > 0 ? Math.max(...staticDataKeys) + 1 : 0;
                            const targetRowCount = Math.max(field.subtableDefaultRows ?? 1, maxStaticKey);
                            if (rows.length < targetRowCount) {
                              const padded = [...rows];
                              while (padded.length < targetRowCount) {
                                padded.push({});
                              }
                              rows = padded;
                            }
                          } else if (rows.length === 0) {
                            rows = [{}];
                          }
                          const updateRows = (newRows: Record<string, string>[]) => {
                            setFormValues(prev => ({ ...prev, [field.id]: stringifySubtableValue(newRows) }));
                          };
                          return (
                            <div style={{ width: '100%' }}>
                              <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: '#fff' }}>
                                  <thead>
                                    <tr style={{ background: '#e2e8f0', borderBottom: '2px solid var(--primary)' }}>
                                      {cols.map((col: any) => {
                                        const headerAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' ? 'center' : 'left'));
                                        return (
                                          <th key={col.id} style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: 600, color: '#0f172a', fontSize: '0.8rem', textAlign: headerAlign as any, width: col.width, whiteSpace: 'nowrap' }}>
                                            {col.label}
                                          </th>
                                        );
                                      })}
                                      <th style={{ width: '26px', border: '1px solid #cbd5e1', background: '#e2e8f0' }} />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {rows.map((row, rowIdx) => (
                                      <tr key={rowIdx}>
                                        {cols.map((col: any) => {
                                          if (col.type === 'static_text') {
                                            const sttAlign = col.align || 'left';
                                            return (
                                              <td key={col.id} style={{ border: '1px solid #e2e8f0', padding: '4px 6px', textAlign: sttAlign as any, fontWeight: 600, color: '#1e293b', fontSize: '0.78rem', background: '#f8fafc' }}>
                                                 {field.subtableStaticData?.[rowIdx]?.[col.id] || ''}
                                              </td>
                                            );
                                          }
                                          const cellAlign = col.type === 'number' ? 'right' : col.type === 'date' || col.type === 'time' ? 'center' : 'left';
                                          return (
                                            <td key={col.id} style={{ border: '1px solid #e2e8f0', padding: '2px' }}>
                                              <input
                                                type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : col.type === 'time' ? 'time' : 'text'}
                                                value={row[col.id] || ''}
                                                onChange={(e) => {
                                                  const newRows = rows.map((r, i) => i === rowIdx ? { ...r, [col.id]: e.target.value } : r);
                                                  updateRows(newRows);
                                                }}
                                                style={{ width: '100%', border: 'none', padding: '4px 6px', background: '#f8fafc', fontSize: '0.78rem', textAlign: cellAlign as any, outline: 'none', boxSizing: 'border-box' }}
                                              />
                                            </td>
                                          );
                                        })}
                                        <td style={{ border: '1px solid #e2e8f0', textAlign: 'center', padding: '1px', verticalAlign: 'middle' }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newRows = rows.filter((_, i) => i !== rowIdx);
                                              updateRows(newRows.length === 0 ? [{}] : newRows);
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                            title="Xóa dòng này"
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const emptyRow: Record<string, string> = {};
                                  cols.forEach((col: any) => { emptyRow[col.id] = ''; });
                                  updateRows([...rows, emptyRow]);
                                }}
                                style={{ marginTop: '4px', float: 'right', fontSize: '0.72rem', padding: '2px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                              >+ Thêm dòng</button>
                              <div style={{ clear: 'both' }} />
                            </div>
                          );
                        })() : (
                          <AutoResizingTextarea
                            value={value}
                            onChange={(val) => setFormValues(prev => ({ ...prev, [field.id]: val }))}
                            style={inputStyle}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3. CHECKLIST TABLE BLOCK */}
              {block.type === 'CHECKLIST_TABLE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(block.fields || []).map((field: any, fIdx: number) => {
                    const value = formValues[field.id] || '';
                    
                    // Out of spec detection
                    let isOutOfSpec = false;
                    let specHint = '';

                    if (field.type === 'number' && value !== '') {
                      const num = parseFloat(value);
                      const hasMin = field.minSpec !== undefined && field.minSpec !== null;
                      const hasMax = field.maxSpec !== undefined && field.maxSpec !== null;
                      const min = field.minSpec ?? -Infinity;
                      const max = field.maxSpec ?? Infinity;
                      if (hasMin && hasMax) {
                        specHint = `Target: ${field.minSpec} - ${field.maxSpec} ${field.unit || ''}`;
                      } else if (hasMin) {
                        specHint = `Target: >= ${field.minSpec} ${field.unit || ''}`;
                      } else if (hasMax) {
                        specHint = `Target: <= ${field.maxSpec} ${field.unit || ''}`;
                      } else {
                        specHint = field.unit ? `Unit: ${field.unit}` : '';
                      }
                      if (isNaN(num) || num < min || num > max) {
                        isOutOfSpec = true;
                      }
                    } else if (field.type === 'radio' || field.type === 'checkbox') {
                      const passLabels = field.options ? field.options.filter((o: any) => o.isPass).map((o: any) => o.label).join(' / ') : 'Đạt';
                      specHint = `Target: ${passLabels}`;
                      if (field.type === 'checkbox') {
                        const selectedVals = value ? value.split(',').filter(Boolean) : [];
                        const hasFail = selectedVals.some((v: string) => {
                          const opt = field.options?.find((o: any) => o.value === v);
                          return opt && !opt.isPass;
                        });
                        if (hasFail) {
                          isOutOfSpec = true;
                        }
                      } else {
                        const selectedOpt = field.options?.find((o: any) => o.value === value);
                        if (value !== '' && !selectedOpt?.isPass) {
                          isOutOfSpec = true;
                        }
                      }
                    } else if (field.type === 'text') {
                      specHint = field.targetRange ? `Target: ${field.targetRange}` : '';
                    }

                    return (
                      <div key={field.id} style={{
                        border: '1px solid var(--neutral-border)',
                        borderRadius: '6px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        background: isOutOfSpec ? '#fff5f5' : '#ffffff',
                        borderColor: isOutOfSpec ? '#fca5a5' : 'var(--neutral-border)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {block.hideSTT || block.tableColumns?.find((c: any) => c.id === 'col_stt')?.hidden ? '' : `${fIdx + 1}. `}{sanitizeLabel(field.checkItem)} {field.locationCode && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontFamily: 'monospace' }}>[{field.locationCode}]</span>}
                          </span>
                          {specHint && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{specHint}</span>}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            {field.type === 'number' ? (
                              <input 
                                type="number"
                                value={value}
                                onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                placeholder={`Nhập số (${field.unit || ''})...`}
                                style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                              />
                            ) : field.type === 'time' ? (
                              field.timeMode === 'dual' ? (() => {
                                const parts = (value || '').split(' - ');
                                const sTime = parts[0] || '';
                                const eTime = parts[1] || '';
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', width: '100%' }}>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Từ</span>
                                      <input 
                                        type="time" 
                                        value={sTime} 
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormValues(prev => ({ ...prev, [field.id]: `${val} - ${eTime}` }));
                                        }}
                                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                      />
                                    </div>
                                    <span style={{ marginTop: '10px', color: '#cbd5e1' }}>~</span>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '1px' }}>Đến</span>
                                      <input 
                                        type="time" 
                                        value={eTime} 
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setFormValues(prev => ({ ...prev, [field.id]: `${sTime} - ${val}` }));
                                        }}
                                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', width: '100%', height: '34px' }}
                                      />
                                    </div>
                                  </div>
                                );
                              })() : (
                                <input 
                                  type="time"
                                  value={value}
                                  onChange={(e) => setFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                                  style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                                />
                              )
                            ) : field.type === 'checkbox' ? (
                              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', maxWidth: '100%' }}>
                                {(field.options ?? [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }]).map((opt: any) => {
                                  const currentValues = value ? value.split(',').filter(Boolean) : [];
                                  const isChecked = currentValues.includes(opt.value);
                                  return (
                                    <label key={opt.value} style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.82rem', cursor: 'pointer', wordBreak: 'break-word', maxWidth: '100%' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        style={{ marginTop: '2px', flexShrink: 0 }}
                                        onChange={(e) => {
                                          let nextValues;
                                          if (e.target.checked) {
                                            nextValues = [...currentValues, opt.value];
                                          } else {
                                            nextValues = currentValues.filter((v: string) => v !== opt.value);
                                          }
                                          setFormValues(prev => ({ ...prev, [field.id]: nextValues.join(',') }));
                                        }}
                                      />
                                      <span style={{ lineHeight: '1.3' }}>{opt.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (field.type === 'likert_scale' || field.type === 'rating') ? (() => {
                          const isStars = field.likertVariant === 'stars' || field.type === 'rating';
                          if (isStars) {
                            const scale = field.ratingScale === 3 ? 3 : 5;
                            const currentRating = parseInt(value, 10) || 0;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', minHeight: '36px' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {Array.from({ length: scale }).map((_, idx) => {
                                    const starVal = idx + 1;
                                    const isFilled = starVal <= currentRating;
                                    return (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          const nextVal = currentRating === starVal ? '' : String(starVal);
                                          setFormValues(prev => ({ ...prev, [field.id]: nextVal }));
                                        }}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          padding: '2px',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'transform 0.1s ease'
                                        }}
                                        title={`${starVal}/${scale} sao`}
                                      >
                                        <Star
                                          size={22}
                                          style={{
                                            color: isFilled ? '#f59e0b' : '#cbd5e1',
                                            fill: isFilled ? '#f59e0b' : '#ffffff',
                                            strokeWidth: 1.5
                                          }}
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                                {currentRating > 0 && (
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706', marginLeft: '4px' }}>
                                    {currentRating}/{scale}
                                  </span>
                                )}
                              </div>
                            );
                          }

                          const scales = field.scaleOptions && field.scaleOptions.length > 0 ? field.scaleOptions : ['1', '2', '3', '4', '5'];
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', width: '100%', overflowX: 'auto' }}>
                              {scales.map((opt: string, sIdx: number) => {
                                const isSelected = value === opt;
                                return (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => {
                                      const nextVal = isSelected ? '' : opt;
                                      setFormValues(prev => ({ ...prev, [field.id]: nextVal }));
                                    }}
                                    style={{
                                      flex: 1,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '6px 4px',
                                      borderRadius: '6px',
                                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid #cbd5e1',
                                      background: isSelected ? 'rgba(13, 148, 136, 0.08)' : '#f8fafc',
                                      color: isSelected ? 'var(--primary)' : '#334155',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                      minWidth: '32px'
                                    }}
                                  >
                                    <span style={{ fontSize: '0.72rem', fontWeight: isSelected ? 700 : 500, lineHeight: 1.1, textAlign: 'center' }}>
                                      {opt}
                                    </span>
                                    <span style={{
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '50%',
                                      border: isSelected ? '4px solid var(--primary)' : '1.5px solid #94a3b8',
                                      background: '#ffffff'
                                    }} />
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })() : field.type === 'radio' ? (
                              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', maxWidth: '100%' }}>
                                {(field.options ?? [{ label: 'Đạt', value: 'PASS', isPass: true }, { label: 'Không Đạt', value: 'FAIL', isPass: false }]).map((opt: any) => (
                                  <label key={opt.value} style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.35rem', fontSize: '0.82rem', cursor: 'pointer', wordBreak: 'break-word', maxWidth: '100%' }}>
                                    <input 
                                      type="radio" 
                                      name={field.id}
                                      value={opt.value}
                                      checked={value === opt.value}
                                      style={{ marginTop: '2px', flexShrink: 0 }}
                                      onChange={() => setFormValues(prev => ({ ...prev, [field.id]: opt.value }))}
                                    />
                                    <span style={{ lineHeight: '1.3' }}>{opt.label}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <AutoResizingTextarea 
                                value={value}
                                onChange={(val) => setFormValues(prev => ({ ...prev, [field.id]: val }))}
                                placeholder="Nhập kết quả..."
                                style={{ width: '100%', padding: '0.45rem 0.5rem', fontSize: '0.82rem', border: '1px solid var(--neutral-border)', borderRadius: '4px' }}
                              />
                            )}
                          </div>

                          {/* Photo upload trigger */}
                          {isOutOfSpec && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <label className="btn btn-secondary btn-sm" style={{ margin: 0, padding: '0.35rem 0.6rem', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                                <Camera size={12} />
                                <span>Upload photo</span>
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload(field.id, e.target.files[0])}
                                  style={{ display: 'none' }}
                                  disabled={isPhotoUploading[field.id]}
                                />
                              </label>
                              
                              {isPhotoUploading[field.id] && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Uploading...</span>}

                              {uploadedPhotos[field.id] && uploadedPhotos[field.id].length > 0 && (
                                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                                  ✓ Uploaded ({uploadedPhotos[field.id].length})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action note */}
                        {isOutOfSpec && (
                          <div style={{ borderLeft: '3px solid #ef4444', paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.72rem', fontWeight: 600 }}>
                              <AlertTriangle size={12} />
                              <span>Corrective action Containment protocol required:</span>
                            </div>
                            <AutoResizingTextarea 
                              value={fieldReactions[field.id] || ''}
                              onChange={(val) => setFieldReactions(prev => ({ ...prev, [field.id]: val }))}
                              placeholder="Enter containment reaction protocol feedback... (e.g. Put on hold / Isolated)"
                              style={{ width: '100%', marginTop: '0.25rem', padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid #fca5a5', borderRadius: '4px', background: '#fff' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 3.1 DYNAMIC TABLE BLOCK */}
              {block.type === 'TABLE' && (() => {
                const bStyle = block.borderStyle || 'grid';
                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: isSeamless ? '0px' : '0.5rem' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      className={bStyle === 'borderless' ? 'print-table--borderless' : bStyle === 'horizontal_only' ? 'print-table--horizontal' : ''}
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.8rem',
                        background: '#ffffff',
                        tableLayout: 'fixed',
                        border: bStyle === 'grid' ? '1px solid var(--neutral-border)' : 'none',
                        borderTop: isSeamless ? 'none' : (bStyle === 'horizontal_only' ? '1.5px solid #cbd5e1' : undefined)
                      }}
                    >
                      <colgroup>
                        {(block.tableColumns || []).map((col: any) => {
                          const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                          return <col key={col.id} style={{ width: colWidth }} />;
                        })}
                        <col style={{ width: '36px' }} />
                      </colgroup>
                      {!block.hideHeader && (
                        <thead>
                          <tr style={{ background: bStyle === 'borderless' ? 'transparent' : '#f1f5f9', borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1' }}>
                            {(block.tableColumns || []).map((col: any) => {
                              const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                              const headerAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'date' || col.type === 'time' || col.type === 'likert_scale' ? 'center' : 'left'));
                              return (
                                <th
                                  key={col.id}
                                  style={{
                                    padding: '8px 10px',
                                    borderRight: bStyle === 'grid' ? '1px solid #cbd5e1' : 'none',
                                    borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1',
                                    color: '#0f172a',
                                    textAlign: headerAlign as any,
                                    width: colWidth,
                                    fontWeight: 700,
                                    fontSize: '0.82rem'
                                  }}
                                >
                                  {col.type === 'likert_scale' ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(col.scaleOptions || []).length || 3}, 1fr)`, gap: '4px', textAlign: 'center', width: '100%' }}>
                                      {(col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer']).map((opt: string, sIdx: number) => (
                                        <div key={sIdx} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', padding: '2px 4px', wordBreak: 'break-word', textAlign: 'center' }}>
                                          {opt}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    col.label
                                  )}
                                </th>
                              );
                            })}
                            <th style={{ width: '36px', padding: 0, borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1' }} />
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {(() => {
                          const activeRows = tableRowsMap[block.id] || initSmartTableRows(block);
                          if (activeRows.length === 0) {
                            return (
                              <tr>
                                <td colSpan={(block.tableColumns || []).length + 1} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  Không có dòng nào.
                                </td>
                              </tr>
                            );
                          }

                          let currentGroupId: string | undefined = undefined;

                          return activeRows.flatMap((row: any) => {
                            if (row.isGroupHeader) {
                              currentGroupId = row.id;
                              const groupTitle = row.groupTitle || block.tableData?.[row.id]?.['_groupTitle'] || '';
                              return [
                                <tr key={row.id} style={{ background: bStyle === 'borderless' ? 'transparent' : '#f8fafc', borderBottom: bStyle === 'borderless' ? 'none' : '1px solid #cbd5e1' }}>
                                  <td
                                    colSpan={(block.tableColumns || []).length + 1}
                                    style={{
                                      padding: '6px 10px',
                                      fontWeight: 600,
                                      fontSize: '0.80rem',
                                      color: '#1e293b',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}
                                  >
                                    {renderFormattedText(groupTitle)}
                                  </td>
                                </tr>
                              ];
                            }

                            if (row.groupId) {
                              currentGroupId = row.groupId;
                            }

                            const thisGroupHeaderId = currentGroupId;

                            const hasStaticText = (block.tableColumns || []).some((col: any) => {
                              const staticVal = block.tableData?.[row.id]?.[col.id];
                              return (col.type === 'static_text' || col.type === 'text') &&
                                     staticVal !== undefined && staticVal !== null &&
                                     staticVal.toString().trim() !== '';
                            });
                            const isDeletable = !row.isGroupHeader && !hasStaticText && activeRows.length > 1;

                            return [
                              <tr key={row.id} style={{ borderBottom: bStyle === 'borderless' ? 'none' : '1px solid var(--neutral-border)' }}>
                              {(block.tableColumns || []).map((col: any) => {
                                const colWidth = getColStyleWidth(col.id, col.width, block.tableColumns || []);
                                const cellKey = `${block.id}_${row.id}_${col.id}`;
                                const cellValue = formValues[cellKey] || '';
                                const customCellOpts = block.cellOptionsMap?.[`${row.id}_${col.id}`];
                                const effectiveOpts = customCellOpts !== undefined ? customCellOpts : (col.options || []);
                                const hasOptions = (col.type === 'checkbox' || col.type === 'radio') && effectiveOpts.length > 0;
                                const cellAlign = col.align || (col.type === 'number' ? 'right' : (col.type === 'checkbox' || col.type === 'radio' ? (hasOptions ? 'left' : 'center') : col.type === 'likert_scale' ? 'center' : 'left'));
                                const staticVal = block.tableData?.[row.id]?.[col.id];
                                const isStaticLabel = (col.type === 'static_text' || col.type === 'text') && staticVal !== undefined && staticVal !== null && staticVal.toString().trim() !== '';

                                return (
                                  <td
                                    key={col.id}
                                    style={{
                                      padding: '6px',
                                      borderRight: bStyle === 'grid' ? '1px solid var(--neutral-border)' : 'none',
                                      borderBottom: bStyle === 'borderless' ? 'none' : '1px solid var(--neutral-border)',
                                      verticalAlign: 'middle',
                                      textAlign: cellAlign,
                                      width: colWidth,
                                      maxWidth: colWidth,
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    {isStaticLabel ? (
                                      <span style={{ fontWeight: 500, display: 'block', textAlign: cellAlign, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.82rem', lineHeight: 1.4 }}>{renderFormattedText(staticVal)}</span>
                                    ) : col.type === 'checkbox' ? (() => {
                                      const isInline = canTableOptionsFitInline(effectiveOpts, col.width, col.checkboxLayout);
                                      return (
                                        hasOptions ? (
                                          <div style={{
                                            display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                            gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(effectiveOpts) : undefined,
                                            flexDirection: col.checkboxLayout === '2-column' ? undefined : (isInline ? 'row' : 'column'),
                                            flexWrap: isInline ? 'wrap' : undefined,
                                            gap: col.checkboxLayout === '2-column' ? '4px 12px' : (isInline ? '4px 12px' : '5px'),
                                            alignItems: isInline ? 'center' : 'flex-start',
                                            justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                            padding: '4px',
                                            width: '100%'
                                          }}>
                                            {effectiveOpts.map((opt: any, oIdx: number) => {
                                              const currentValues = cellValue ? cellValue.split(',').filter(Boolean) : [];
                                              const isChecked = currentValues.includes(opt.value || opt.label);
                                              return (
                                                <label key={oIdx} style={{ display: isInline ? 'inline-flex' : 'flex', alignItems: isInline ? 'center' : 'flex-start', gap: '6px', fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0, width: isInline ? 'auto' : '100%', whiteSpace: isInline ? 'nowrap' : undefined }}>
                                                  <input 
                                                    type="checkbox" 
                                                    checked={isChecked} 
                                                    onChange={(e) => {
                                                      const val = opt.value || opt.label;
                                                      let nextValues;
                                                      if (e.target.checked) {
                                                        nextValues = [...currentValues, val];
                                                      } else {
                                                        nextValues = currentValues.filter((v: string) => v !== val);
                                                      }
                                                      setFormValues(prev => ({ ...prev, [cellKey]: nextValues.join(',') }));
                                                    }} 
                                                    style={{ transform: 'scale(1.0)', cursor: 'pointer', marginTop: isInline ? 0 : '2px', flexShrink: 0 }}
                                                  />
                                                  <span style={{ lineHeight: '1.35', whiteSpace: isInline ? 'nowrap' : 'pre-wrap', wordBreak: isInline ? 'normal' : 'break-word', flex: isInline ? undefined : 1 }}>{opt.label}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <div style={{ textAlign: 'center' }}>
                                            <input 
                                              type="checkbox" 
                                              checked={cellValue === 'true'} 
                                              onChange={(e) => setFormValues(prev => ({ ...prev, [cellKey]: e.target.checked ? 'true' : 'false' }))} 
                                              style={{ transform: 'scale(1.1)', cursor: 'pointer' }}
                                            />
                                          </div>
                                        )
                                      );
                                    })() : col.type === 'radio' ? (() => {
                                      const isInline = canTableOptionsFitInline(effectiveOpts, col.width, col.checkboxLayout);
                                      return (
                                      hasOptions ? (
                                        <div style={{
                                          display: col.checkboxLayout === '2-column' ? 'grid' : 'flex',
                                          gridTemplateColumns: col.checkboxLayout === '2-column' ? getCheckboxGridTemplate(effectiveOpts) : undefined,
                                          flexDirection: col.checkboxLayout === '2-column' ? undefined : isInline ? 'row' : 'column',
                                          flexWrap: isInline ? 'wrap' : undefined,
                                          gap: col.checkboxLayout === '2-column' ? '4px 12px' : isInline ? '4px 12px' : '5px',
                                          alignItems: 'center',
                                          justifyContent: isInline ? (cellAlign === 'center' ? 'center' : cellAlign === 'right' ? 'flex-end' : 'flex-start') : undefined,
                                          padding: '4px',
                                          width: '100%'
                                        }}>
                                          {effectiveOpts.map((opt: any, oIdx: number) => {
                                            const val = opt.value || opt.label;
                                            const isChecked = cellValue === val;
                                            return (
                                              <label key={oIdx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer', margin: 0, width: isInline ? 'auto' : '100%', whiteSpace: isInline ? 'nowrap' : undefined }}>
                                                <input 
                                                  type="radio" 
                                                  name={`radio_${cellKey}`}
                                                  checked={isChecked} 
                                                  onChange={() => setFormValues(prev => ({ ...prev, [cellKey]: val }))} 
                                                  style={{ cursor: 'pointer', marginTop: 0, flexShrink: 0 }}
                                                />
                                                <span style={{ lineHeight: '1.35', whiteSpace: isInline ? 'nowrap' : 'pre-wrap', wordBreak: isInline ? 'normal' : 'break-word', flex: isInline ? undefined : 1 }}>{opt.label}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div style={{ textAlign: 'center' }}>
                                          <input 
                                            type="radio" 
                                            checked={cellValue === 'true'} 
                                            onChange={() => setFormValues(prev => ({ ...prev, [cellKey]: 'true' }))} 
                                            style={{ transform: 'scale(1.1)', cursor: 'pointer' }}
                                          />
                                        </div>
                                      )
                                      );
                                    })() : col.type === 'likert_scale' ? (() => {
                                      const scaleOptions = col.scaleOptions || ['Easy to Answer', 'Could Answer', 'Difficult to Answer'];
                                      return (
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${scaleOptions.length}, 1fr)`, gap: '4px', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '2px 0' }}>
                                          {scaleOptions.map((opt: string, sIdx: number) => {
                                            const isSelected = cellValue === opt;
                                            return (
                                              <div key={sIdx} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const nextVal = isSelected ? '' : opt;
                                                    setFormValues(prev => ({ ...prev, [cellKey]: nextVal }));
                                                  }}
                                                  style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: '2px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                  }}
                                                  title={opt}
                                                >
                                                  <span
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      width: '16px',
                                                      height: '16px',
                                                      borderRadius: '50%',
                                                      border: isSelected ? '2px solid var(--primary)' : '1.5px solid #94a3b8',
                                                      background: '#ffffff',
                                                      transition: 'all 0.15s ease'
                                                    }}
                                                  >
                                                    {isSelected && (
                                                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                                                    )}
                                                  </span>
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })() : col.type === 'rating' ? (() => {
                                      const scale = col.ratingScale === 3 ? 3 : 5;
                                      const currentRating = parseInt(cellValue, 10) || 0;
                                      return (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', padding: '2px 0' }}>
                                          {Array.from({ length: scale }).map((_, idx) => {
                                            const starVal = idx + 1;
                                            const isFilled = starVal <= currentRating;
                                            return (
                                              <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                  const nextVal = currentRating === starVal ? '' : String(starVal);
                                                  setFormValues(prev => ({ ...prev, [cellKey]: nextVal }));
                                                }}
                                                style={{
                                                  background: 'none',
                                                  border: 'none',
                                                  padding: '1px',
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center'
                                                }}
                                                title={`${starVal}/${scale} sao`}
                                              >
                                                <Star
                                                  size={18}
                                                  style={{
                                                    color: isFilled ? '#f59e0b' : '#cbd5e1',
                                                    fill: isFilled ? '#f59e0b' : '#ffffff',
                                                    strokeWidth: 1.5
                                                  }}
                                                />
                                              </button>
                                            );
                                          })}
                                        </div>
                                      );
                                    })() : col.type === 'date' ? (
                                      <input 
                                        type="date" 
                                        value={cellValue} 
                                        onChange={(e) => handleTableCellChangeWithAutoAppend(block, row.id, col.id, e.target.value, thisGroupHeaderId)} 
                                        style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center', backgroundColor: '#f8fafc' }}
                                      />
                                    ) : col.type === 'time' ? (
                                      <input 
                                        type="time" 
                                        value={cellValue} 
                                        onChange={(e) => handleTableCellChangeWithAutoAppend(block, row.id, col.id, e.target.value, thisGroupHeaderId)} 
                                        style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'center', backgroundColor: '#f8fafc' }}
                                      />
                                    ) : col.type === 'number' ? (
                                      <input 
                                        type="number" 
                                        value={cellValue} 
                                        onChange={(e) => handleTableCellChangeWithAutoAppend(block, row.id, col.id, e.target.value, thisGroupHeaderId)} 
                                        style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'right', backgroundColor: '#f8fafc' }}
                                      />
                                    ) : (
                                      <AutoResizingTextarea 
                                        value={cellValue} 
                                        onChange={(val) => handleTableCellChangeWithAutoAppend(block, row.id, col.id, val, thisGroupHeaderId)} 
                                        style={{ width: '100%', padding: '0.35rem 0.45rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: '4px', textAlign: 'left', backgroundColor: '#f8fafc' }}
                                      />
                                    )}
                                  </td>
                                );
                              })}
                              {/* Dynamic Row Delete Cell */}
                              <td style={{
                                width: '36px',
                                textAlign: 'center',
                                verticalAlign: 'middle',
                                padding: '2px',
                                borderRight: bStyle === 'grid' ? '1px solid var(--neutral-border)' : 'none',
                                borderBottom: bStyle === 'borderless' ? 'none' : '1px solid var(--neutral-border)'
                              }}>
                                {isDeletable && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTableRow(block.id, row.id, block)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
                                    title="Xóa dòng này"
                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </td>
                             </tr>
                           ];
                         });
                      })()}
                      </tbody>
                      {(() => {
                        const columns = block.tableColumns || [];
                        const totalCols = columns.length;
                        if (totalCols === 0) return null;

                        const summaryTypes: { id: string; label: string }[] = [];
                        const columnsWithSummaries: { col: any; colIdx: number; rowMap: Map<string, any> }[] = [];

                        columns.forEach((col: any, colIdx: number) => {
                          if (col.type === 'number' && col.summaryRows && col.summaryRows.length > 0) {
                            const rowMap = new Map<string, any>();
                            col.summaryRows.forEach((row: any) => {
                              rowMap.set(row.id, row);
                              if (!summaryTypes.some(s => s.label === row.label)) {
                                summaryTypes.push({ id: row.id, label: row.label || 'Cộng:' });
                              }
                            });
                            columnsWithSummaries.push({ col, colIdx, rowMap });
                          }
                        });

                        if (columnsWithSummaries.length === 0) return null;

                        const firstSumColIdx = Math.min(...columnsWithSummaries.map(c => c.colIdx));

                        return (
                          <tfoot style={{ borderTop: '2px solid var(--neutral-border)' }}>
                            {summaryTypes.map((sumType, idx) => {
                              return (
                                <tr key={sumType.id || idx} style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                                  {firstSumColIdx > 0 && (
                                    <td colSpan={firstSumColIdx} style={{
                                      padding: '6px 8px',
                                      borderRight: '1px solid var(--neutral-border)',
                                      borderBottom: '1px solid var(--neutral-border)',
                                      textAlign: 'right',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.8rem'
                                    }}>
                                      {sumType.label}
                                    </td>
                                  )}
                                  {columns.slice(firstSumColIdx).map((col: any, offsetIdx: number) => {
                                    const actualColIdx = firstSumColIdx + offsetIdx;
                                    const colSumData = columnsWithSummaries.find(c => c.colIdx === actualColIdx);
                                    const targetRow = colSumData ? (colSumData.rowMap.get(sumType.id) || Array.from(colSumData.rowMap.values()).find((r: any) => r.label === sumType.label)) : null;
                                    const isLabelColIfFirst = actualColIdx === 0 && firstSumColIdx === 0;

                                    if (!targetRow) {
                                      return (
                                        <td key={col.id} style={{
                                          padding: '6px 8px',
                                          borderRight: '1px solid var(--neutral-border)',
                                          borderBottom: '1px solid var(--neutral-border)',
                                          fontSize: '0.8rem'
                                        }}>
                                          {isLabelColIfFirst ? sumType.label : ''}
                                        </td>
                                      );
                                    }

                                    const cellKey = `${block.id}_summary_${col.id}_${targetRow.id}`;
                                    const val = calculateSummaryValue(col, targetRow, block, formValues);
                                    const isManual = targetRow.type === 'manual';

                                    return (
                                      <td key={col.id} style={{
                                        padding: '6px 8px',
                                        borderRight: '1px solid var(--neutral-border)',
                                        borderBottom: '1px solid var(--neutral-border)',
                                        textAlign: 'right',
                                        color: 'var(--text-primary)'
                                      }}>
                                        {isManual ? (
                                          <input
                                            type="number"
                                            value={formValues[cellKey] || ''}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, [cellKey]: e.target.value }))}
                                            placeholder="Nhập..."
                                            style={{ width: '100px', padding: '0.2rem 0.35rem', fontSize: '0.8rem', border: '1px solid var(--neutral-border)', borderRadius: '4px', textAlign: 'right' }}
                                          />
                                        ) : (
                                          <span style={{ fontSize: '0.8rem' }}>{val.toLocaleString('vi-VN')}</span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tfoot>
                        );
                      })()}
                    </table>
                  </div>

                </div>
                );
              })()}

              {/* 4. MATRIX TABLE BLOCK */}
              {block.type === 'MATRIX_TABLE' && block.matrixConfig && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#e2e8f0' }}>
                        <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                          {block.matrixConfig.rowHeader}
                        </th>
                        <th 
                          colSpan={block.matrixConfig.columns.length} 
                          style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}
                        >
                          {block.matrixConfig.columnHeader}
                        </th>
                        {block.matrixConfig.showTotalColumn && (
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                            {block.matrixConfig.totalColumnHeader}
                          </th>
                        )}
                        {block.matrixConfig.showNotesColumn && (
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                            {block.matrixConfig.notesColumnHeader}
                          </th>
                        )}
                      </tr>
                      <tr style={{ background: '#cbd5e1', borderBottom: '2px solid var(--primary)' }}>
                        <th style={{ border: '1px solid #94a3b8', padding: '6px' }}></th>
                        {block.matrixConfig.columns.map((colName: string, cIdx: number) => (
                          <th key={cIdx} style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: block.matrixConfig.columnAlign || 'center', fontWeight: 600, color: '#0f172a' }}>
                            {colName}
                          </th>
                        ))}
                        {block.matrixConfig.showTotalColumn && (
                          <th style={{ border: '1px solid #94a3b8', padding: '6px' }}></th>
                        )}
                        {block.matrixConfig.showNotesColumn && (
                          <th style={{ border: '1px solid #94a3b8', padding: '6px' }}></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: block.matrixConfig.rowCount }).map((_, rIdx) => {
                        let rowTotal = 0;
                        block.matrixConfig.columns.forEach((_: any, cIdx: number) => {
                          const val = formValues[`${block.id}_row_${rIdx}_col_${cIdx}`] || '';
                          const num = parseInt(val, 10);
                          if (!isNaN(num)) rowTotal += num;
                        });

                        return (
                          <tr key={rIdx}>
                            <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'center', fontWeight: 'bold', background: '#f8fafc' }}>
                              {rIdx + 1}
                            </td>
                            {block.matrixConfig.columns.map((_: any, cIdx: number) => {
                              const key = `${block.id}_row_${rIdx}_col_${cIdx}`;
                              return (
                                <td key={cIdx} style={{ border: '1.5px solid #000000', padding: '4px' }}>
                                  <input 
                                    type="number"
                                    value={formValues[key] || ''}
                                    onChange={(e) => setFormValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    style={{ width: '100%', border: 'none', outline: 'none', padding: '4px', textAlign: 'right', fontSize: '0.8rem' }}
                                  />
                                </td>
                              );
                            })}
                            {block.matrixConfig.showTotalColumn && (
                              <td style={{ border: '1.5px solid #000000', padding: '6px', textAlign: 'right', fontWeight: 'bold', background: '#f8fafc' }}>
                                {rowTotal}
                              </td>
                            )}
                            {block.matrixConfig.showNotesColumn && (
                              <td style={{ border: '1.5px solid #000000', padding: '4px' }}>
                                <input 
                                  type="text"
                                  value={formValues[`${block.id}_row_${rIdx}_note`] || ''}
                                  onChange={(e) => setFormValues(prev => ({ ...prev, [`${block.id}_row_${rIdx}_note`]: e.target.value }))}
                                  placeholder="Ghi chú..."
                                  style={{ width: '100%', border: 'none', outline: 'none', padding: '4px', fontSize: '0.8rem' }}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 5. SIGN BLOCK — Interactive Click-to-Sign */}
              {block.type === 'SIGN' && (
                <div style={{
                  paddingTop: '5px',
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '24px',
                  flexWrap: 'wrap'
                }}>
                  {(block.fields || []).map((f: any, fIdx: number) => {
                    const confirmed = signValues[f.id];
                    const isOpen = signOpen[f.id];
                    const inputVal = signInputs[f.id] || '';
                    const isMandatory = fIdx === 0;

                    return (
                      <div key={f.id} style={{
                        flex: 1,
                        minWidth: '220px',
                        minHeight: '90px',
                        border: confirmed
                          ? '1.5px solid #10b981'
                          : isOpen
                          ? '1.5px solid var(--primary)'
                          : '1.5px dashed #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        background: confirmed ? '#f0fdf4' : isOpen ? '#f0fdfa' : '#fafafa',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}>
                        {/* Header label */}
                        <div style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: confirmed ? '#059669' : 'var(--text-secondary)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <span>
                            {f.checkItem}
                            {isMandatory && <span style={{ color: '#ef4444', marginLeft: '2px' }} title="Chữ ký bắt buộc">*</span>}
                          </span>
                          {confirmed && <CheckCircle2 size={14} style={{ color: '#10b981' }} />}
                        </div>

                        {/* Subtitle / reactionProtocol */}
                        <div style={{ fontSize: '0.68rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          {f.reactionProtocol ? (f.reactionProtocol.startsWith('(') ? f.reactionProtocol : `(${f.reactionProtocol})`) : '(Ký và ghi rõ họ tên)'}
                        </div>

                        {/* IDLE state — Chưa ký */}
                        {!confirmed && !isOpen && (
                          <button
                            type="button"
                            onClick={() => setSignOpen(prev => ({ ...prev, [f.id]: true }))}
                            style={{
                              marginTop: '4px',
                              padding: '0.45rem 0.75rem',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              background: '#ffffff',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <PenTool size={12} /> Ký tên tại đây...
                          </button>
                        )}

                        {/* INPUT state — Đang nhập tên & xác nhận */}
                        {!confirmed && isOpen && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
                            <input
                              type="text"
                              placeholder="Họ và tên người ký..."
                              value={inputVal}
                              onChange={e => setSignInputs(prev => ({ ...prev, [f.id]: e.target.value }))}
                              style={{
                                padding: '0.4rem 0.6rem',
                                fontSize: '0.82rem',
                                border: '1px solid var(--primary)',
                                borderRadius: '6px',
                                outline: 'none'
                              }}
                              autoFocus
                            />
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                id={`attestation_${f.id}`}
                                onChange={e => {
                                  if (e.target.checked && inputVal.trim()) {
                                    setSignValues(prev => ({
                                      ...prev,
                                      [f.id]: { name: inputVal.trim(), confirmedAt: new Date().toISOString() }
                                    }));
                                    setSignOpen(prev => ({ ...prev, [f.id]: false }));
                                  }
                                }}
                                style={{ marginTop: '1px', accentColor: 'var(--primary)' }}
                              />
                              Tôi xác nhận thông tin trên là trung thực và chịu trách nhiệm về bản ghi này.
                            </label>
                            <button
                              type="button"
                              onClick={() => setSignOpen(prev => ({ ...prev, [f.id]: false }))}
                              style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                            >
                              Huỷ
                            </button>
                          </div>
                        )}

                        {/* CONFIRMED state — Đã ký */}
                        {confirmed && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                            <span style={{ fontSize: '1.0rem', fontWeight: 700, color: '#059669', fontFamily: "'Dancing Script', cursive, sans-serif" }}>
                              {confirmed.name}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              [Đã xác thực điện tử] · {new Date(confirmed.confirmedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSignValues(prev => ({ ...prev, [f.id]: null }))}
                              style={{ fontSize: '0.65rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, marginTop: '2px', textDecoration: 'underline' }}
                            >
                              Ký lại
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}

        {/* Fallback Operator Identification (Only shown at bottom if form has NO SIGN block) */}
        {(() => {
          const hasSignBlock = formTemplate?.layoutBlocks?.some((b: any) => b.type === 'SIGN' && b.fields.length > 0);
          if (hasSignBlock) return null;
          return (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '1.25rem',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              marginTop: '0.5rem',
              marginBottom: '0.5rem'
            }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>Người điền phiếu *</span>
              </label>
              <input
                type="text"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                placeholder="Nhập họ và tên người điền phiếu"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '1px solid #93c5fd',
                  borderRadius: '6px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>
          );
        })()}

        {/* Static layout-driven footer matching paper printouts & Form Builder */}
        <div style={{
          borderTop: '1px solid #334155',
          paddingTop: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          fontFamily: 'monospace'
        }}>
          <span>{formTemplate.formId || 'N/A'}</span>
          <span>{formatFormVersion(formTemplate.version || 'v0.1', formTemplate.status, formTemplate.effectiveDate, formTemplate.updatedAt)}</span>
        </div>

        {/* Submit Bar */}
        <div style={{
          borderTop: '1px solid var(--neutral-border)',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          {onBack && (
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onBack}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSubmitForm}
            disabled={submitting}
            style={{ padding: '0.5rem 2rem' }}
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function FormFiller(props: FormFillerProps) {
  return (
    <FormErrorBoundary>
      <FormFillerInner {...props} />
    </FormErrorBoundary>
  );
}
