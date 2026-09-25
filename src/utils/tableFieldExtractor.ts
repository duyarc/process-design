import type { FormFieldISO, LayoutBlockISO, TableColumnConfig, TableRowConfig } from '../types';
import { getEffectiveCellOptions } from './formUtils';

/**
 * Interface cho nhóm Element bình thường (TABLE, INFO_GRID) nằm dưới H2 hoặc trực tiếp dưới H1
 */
export interface ElementHierarchyGroup {
  elementTitle: string;
  fields: FormFieldISO[];
}

/**
 * Interface cho nhóm phân cấp 4 tầng: Section H1 -> Section H2 (chỉ format H2) -> Element -> FormFieldISO
 */
export interface FieldHierarchyGroup {
  h1: string;
  totalFieldsCount: number;
  h2Groups: {
    h2: string;
    fields: FormFieldISO[];
    elements: ElementHierarchyGroup[];
  }[];
  directElements: ElementHierarchyGroup[];
}

/**
 * Trích xuất các trường dữ liệu nhập liệu từ một khối Bảng (TABLE block)
 * Quy tắc nghiêm ngặt: Bảng bình thường (titleFormat !== 'H2') KHÔNG bao giờ ghi đè parentH2.
 */
export function extractTableFields(
  block: LayoutBlockISO,
  parentH1: string = 'Thông tin chung',
  parentH2: string = ''
): FormFieldISO[] {
  if (block.type !== 'TABLE' || !block.tableColumns || !block.tableRows) {
    return [];
  }

  const fields: FormFieldISO[] = [];
  let currentGroupTitle = '';
  const baseElementTitle = (block.title || 'Bảng').trim();
  // Chỉ khi bản thân TABLE được cấu hình rõ titleFormat === 'H2' thì mới coi là H2, còn lại giữ nguyên parentH2
  const effectiveH2 = (block.titleFormat === 'H2' && block.title) ? block.title.trim() : parentH2;

  block.tableRows.forEach((row: TableRowConfig, rIdx: number) => {
    // 1. Nhận diện dòng phân nhóm bên trong bảng (chỉ là nhóm con trong bảng, không phải H2)
    if (row.isGroupHeader || block.tableData?.[row.id]?.['_groupTitle']) {
      let grp = (row.groupTitle || block.tableData?.[row.id]?.['_groupTitle'] || '').trim();
      if (grp.startsWith('**') && grp.endsWith('**') && grp.length > 4) {
        grp = grp.slice(2, -2).trim();
      }
      currentGroupTitle = grp;
      return;
    }

    // 2. Tìm nội dung câu hỏi/tiêu đề của dòng từ cột văn bản cố định hoặc tableData
    let rowQuestion = '';
    const staticCol = block.tableColumns?.find(c => c.type === 'static_text');
    if (staticCol && block.tableData?.[row.id]?.[staticCol.id]) {
      rowQuestion = block.tableData[row.id][staticCol.id].trim();
    }

    if (!rowQuestion) {
      for (const col of block.tableColumns || []) {
        const val = block.tableData?.[row.id]?.[col.id];
        if (val && typeof val === 'string' && val.trim().length > 0 && col.type === 'text') {
          rowQuestion = val.trim();
          break;
        }
      }
    }

    const hasExplicitRowQuestion = !!rowQuestion;
    if (!rowQuestion) {
      rowQuestion = `Dòng ${rIdx + 1}`;
    }

    const elementLocationCode = currentGroupTitle
      ? `${baseElementTitle} › ${currentGroupTitle}`
      : baseElementTitle;

    // 3. Duyệt qua từng cột nhập liệu trên dòng
    (block.tableColumns || []).forEach((col: TableColumnConfig, cIdx: number) => {
      // Bỏ qua cột đã dùng làm tiêu đề câu hỏi
      const isQuestionCol = hasExplicitRowQuestion &&
        block.tableData?.[row.id]?.[col.id] === rowQuestion &&
        col.type === 'text' &&
        (!col.label || ['tên cột...', 'câu hỏi', 'tiêu chí', ''].includes(col.label.trim().toLowerCase()));

      if (col.type === 'static_text' || isQuestionCol) return;

      // Xây dựng tên hiển thị thông minh (checkItem)
      const colLabel = (col.label || '').trim();
      const isGenericColLabel = !colLabel || ['giá trị', 'thực trạng', 'kết quả', 'đánh giá', 'tên cột...'].includes(colLabel.toLowerCase());

      let checkItem = '';
      if (hasExplicitRowQuestion) {
        if (isGenericColLabel) {
          checkItem = rowQuestion;
        } else {
          checkItem = `${rowQuestion} - ${colLabel}`;
        }
      } else {
        if (colLabel) {
          checkItem = `${rowQuestion}: ${colLabel}`;
        } else {
          checkItem = `${baseElementTitle} - ${rowQuestion} (Cột ${cIdx + 1})`;
        }
      }

      // ID trường chuẩn khớp 100% với key lưu trong phiếu nộp
      const fieldId = `${block.id}_${row.id}_${col.id}`;
      const effectiveOptions = getEffectiveCellOptions(block.cellOptionsMap, row.id, col.id, col.options);
      const effectivePlaceholder = block.cellPlaceholderMap?.[`${row.id}_${col.id}`] || col.placeholder;

      fields.push({
        id: fieldId,
        type: col.type as any,
        checkItem,
        options: effectiveOptions.length > 0 ? effectiveOptions : (col.options || undefined),
        scaleOptions: col.scaleOptions,
        ratingScale: col.ratingScale,
        placeholder: effectivePlaceholder,
        locationCode: elementLocationCode,
        sectionH1: parentH1,
        sectionH2: effectiveH2,
        reactionProtocol: ''
      });
    });
  });

  return fields;
}

/**
 * Trích xuất toàn bộ trường dữ liệu từ tất cả các khối (INFO_GRID, TABLE, MATRIX_TABLE, CHECKLIST_TABLE)
 * Tự động phân cấp nghiêm ngặt:
 * - H1: chỉ từ block có format H1
 * - H2: CHỈ từ block có format H2 (titleFormat === 'H2' hoặc sectionFormat === 'H2')
 * - Các element bình thường (TABLE, INFO_GRID với titleFormat != H1/H2) giữ nguyên currentH2 (hoặc '' nếu không có H2)
 */
export function extractAllFormFields(blocks: LayoutBlockISO[] = []): FormFieldISO[] {
  const allFields: FormFieldISO[] = [];
  let currentH1 = 'Thông tin chung';
  let currentH2 = '';

  blocks.forEach((block, bIdx) => {
    // 1. Nhận diện khối SECTION_LABEL
    if (block.type === 'SECTION_LABEL') {
      const sectionTitle = (block.title || '').trim();
      const format = block.sectionFormat || block.titleFormat || (sectionTitle === sectionTitle.toUpperCase() && sectionTitle.length > 3 ? 'H1' : 'H2');
      if (format === 'H1') {
        currentH1 = sectionTitle || `Phần ${bIdx + 1}`;
        currentH2 = ''; // Reset H2 khi chuyển sang H1 mới
      } else if (format === 'H2') {
        currentH2 = sectionTitle || `Mục ${bIdx + 1}`;
      }
      return;
    }

    // Nếu block thường có titleFormat === 'H1' hoặc 'H2'
    if (block.titleFormat === 'H1' && block.title) {
      currentH1 = block.title.trim();
      currentH2 = '';
    } else if (block.titleFormat === 'H2' && block.title) {
      currentH2 = block.title.trim();
    }

    // 2. Trường chuẩn trong INFO_GRID hoặc khối có block.fields
    if (block.fields && block.fields.length > 0) {
      const elementName = (block.title || currentH1).trim();
      block.fields.forEach(f => {
        allFields.push({
          ...f,
          locationCode: elementName || f.locationCode,
          sectionH1: currentH1,
          sectionH2: currentH2
        });
      });
    }

    // 3. Trường bóc tách từ TABLE
    if (block.type === 'TABLE') {
      const tableFields = extractTableFields(block, currentH1, currentH2);
      allFields.push(...tableFields);
    }
  });

  return allFields;
}

/**
 * Gom danh sách trường theo Element cấp 3 (tên bảng / lưới thông tin từ locationCode)
 */
export function groupFieldsByElements(fields: FormFieldISO[]): ElementHierarchyGroup[] {
  const elMap = new Map<string, FormFieldISO[]>();
  fields.forEach(f => {
    const rawLoc = (f.locationCode || 'Chi tiết').trim();
    const baseElementTitle = rawLoc.split(' › ')[0].trim() || 'Chi tiết';
    if (!elMap.has(baseElementTitle)) {
      elMap.set(baseElementTitle, []);
    }
    elMap.get(baseElementTitle)!.push(f);
  });

  const elements: ElementHierarchyGroup[] = [];
  elMap.forEach((fList, elementTitle) => {
    elements.push({ elementTitle, fields: fList });
  });
  return elements;
}

/**
 * Phân nhóm mảng trường FormFieldISO thành cây phân cấp 4 tầng:
 * H1 -> H2 (chỉ các tiêu đề format H2) -> Element (TABLE/INFO_GRID) -> FormFieldISO[]
 */
export function groupFieldsByHierarchy(fields: FormFieldISO[]): FieldHierarchyGroup[] {
  const h1Map = new Map<string, { h2Map: Map<string, FormFieldISO[]>; directFields: FormFieldISO[] }>();

  fields.forEach(field => {
    const h1 = (field.sectionH1 || 'Thông tin chung').trim();
    const rawH2 = (field.sectionH2 || '').trim();
    const hasRealH2 = rawH2.length > 0 && rawH2.toLowerCase() !== h1.toLowerCase();

    if (!h1Map.has(h1)) {
      h1Map.set(h1, { h2Map: new Map<string, FormFieldISO[]>(), directFields: [] });
    }
    const bucket = h1Map.get(h1)!;
    if (hasRealH2) {
      if (!bucket.h2Map.has(rawH2)) {
        bucket.h2Map.set(rawH2, []);
      }
      bucket.h2Map.get(rawH2)!.push(field);
    } else {
      bucket.directFields.push(field);
    }
  });

  const result: FieldHierarchyGroup[] = [];

  h1Map.forEach((bucket, h1) => {
    const h2Groups: { h2: string; fields: FormFieldISO[]; elements: ElementHierarchyGroup[] }[] = [];
    let totalFieldsCount = 0;

    bucket.h2Map.forEach((fList, h2) => {
      h2Groups.push({
        h2,
        fields: fList,
        elements: groupFieldsByElements(fList)
      });
      totalFieldsCount += fList.length;
    });

    const directElements = groupFieldsByElements(bucket.directFields);
    totalFieldsCount += bucket.directFields.length;

    result.push({
      h1,
      totalFieldsCount,
      h2Groups,
      directElements
    });
  });

  return result;
}

/**
 * Lấy Field ID chuẩn của một ô trong TABLE block khớp với format extractTableFields
 */
export function getTableFieldId(blockId: string, rowId: string, colId: string): string {
  return `${blockId}_${rowId}_${colId}`;
}

/**
 * Lấy Field ID đại diện/chính của một dòng trong TABLE block
 * Ưu tiên cột nhập liệu (likert_scale, rating, radio, checkbox, number, v.v.), bỏ qua static_text và cột câu hỏi
 */
export function getTableRowPrimaryFieldId(block: LayoutBlockISO, rowId: string): string | null {
  if (!block.tableColumns || !block.tableRows) return null;
  const row = block.tableRows.find(r => r.id === rowId);
  if (!row || row.isGroupHeader) return null;

  let rowQuestion = '';
  const staticCol = block.tableColumns.find(c => c.type === 'static_text');
  if (staticCol && block.tableData?.[row.id]?.[staticCol.id]) {
    rowQuestion = block.tableData[row.id][staticCol.id].trim();
  }
  if (!rowQuestion) {
    for (const col of block.tableColumns) {
      const val = block.tableData?.[row.id]?.[col.id];
      if (val && typeof val === 'string' && val.trim().length > 0 && col.type === 'text') {
        rowQuestion = val.trim();
        break;
      }
    }
  }
  const hasExplicitRowQuestion = !!rowQuestion;

  const inputCols = block.tableColumns.filter(col => {
    const isQuestionCol = hasExplicitRowQuestion &&
      block.tableData?.[row.id]?.[col.id] === rowQuestion &&
      col.type === 'text' &&
      (!col.label || ['tên cột...', 'câu hỏi', 'tiêu chí', ''].includes(col.label.trim().toLowerCase()));

    return col.type !== 'static_text' && !isQuestionCol && col.id !== 'col_stt' && col.label?.toLowerCase() !== 'stt';
  });

  if (inputCols.length === 0) return null;

  const preferredCol = inputCols.find(c => c.type === 'likert_scale' || c.type === 'rating') || inputCols[0];
  return getTableFieldId(block.id, row.id, preferredCol.id);
}

/**
 * Kiểm tra xem một fieldId có thuộc dòng rowId của blockId không
 */
export function isFieldInTableRow(fieldId: string | null | undefined, blockId: string, rowId: string): boolean {
  if (!fieldId) return false;
  return fieldId.startsWith(`${blockId}_${rowId}_`) || fieldId === rowId;
}
