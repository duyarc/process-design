import type { FormFieldISO, LayoutBlockISO, TableColumnConfig, TableRowConfig } from '../types';

/**
 * Interface cho nhóm phân cấp Section H1 -> Section H2 -> FormFieldISO
 */
export interface FieldHierarchyGroup {
  h1: string;
  totalFieldsCount: number;
  h2Groups: {
    h2: string;
    fields: FormFieldISO[];
  }[];
}

/**
 * Trích xuất các trường dữ liệu nhập liệu từ một khối Bảng (TABLE block)
 */
export function extractTableFields(
  block: LayoutBlockISO,
  parentH1: string = 'Thông tin chung',
  parentH2: string = 'Bảng'
): FormFieldISO[] {
  if (block.type !== 'TABLE' || !block.tableColumns || !block.tableRows) {
    return [];
  }

  const fields: FormFieldISO[] = [];
  let currentGroupTitle = '';

  block.tableRows.forEach((row: TableRowConfig, rIdx: number) => {
    // 1. Nhận diện dòng phân nhóm
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

    // Xác định Section H2 cho từng dòng trường
    const effectiveH2 = currentGroupTitle || (block.title ? block.title.trim() : parentH2) || parentH1;

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
          checkItem = `${block.title || 'Bảng'} - ${rowQuestion} (Cột ${cIdx + 1})`;
        }
      }

      // ID trường chuẩn khớp 100% với key lưu trong phiếu nộp
      const fieldId = `${block.id}_${row.id}_${col.id}`;

      fields.push({
        id: fieldId,
        type: col.type as any,
        checkItem,
        options: col.options,
        scaleOptions: col.scaleOptions,
        ratingScale: col.ratingScale,
        locationCode: block.title || currentGroupTitle || 'Bảng',
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
 * Tự động phân cấp theo Section Header H1 và Section H2
 */
export function extractAllFormFields(blocks: LayoutBlockISO[] = []): FormFieldISO[] {
  const allFields: FormFieldISO[] = [];
  let currentH1 = 'Thông tin chung';
  let currentH2 = 'Thông tin cơ bản';

  blocks.forEach((block, bIdx) => {
    // 1. Nhận diện khối SECTION_LABEL
    if (block.type === 'SECTION_LABEL') {
      const sectionTitle = (block.title || '').trim();
      const format = block.sectionFormat || (sectionTitle === sectionTitle.toUpperCase() && sectionTitle.length > 3 ? 'H1' : 'H2');
      if (format === 'H1') {
        currentH1 = sectionTitle || `Phần ${bIdx + 1}`;
        currentH2 = ''; // Reset H2 khi chuyển sang H1 mới
      } else {
        currentH2 = sectionTitle || `Mục ${bIdx + 1}`;
      }
      return;
    }

    // Nếu block có titleFormat === 'H1'
    if (block.titleFormat === 'H1' && block.title) {
      currentH1 = block.title.trim();
      currentH2 = '';
    }

    const defaultH2 = currentH2 || (block.title ? block.title.trim() : (currentH1 ? currentH1 : 'Chi tiết'));

    // 2. Trường chuẩn trong INFO_GRID hoặc khối có block.fields
    if (block.fields && block.fields.length > 0) {
      const effectiveH2 = block.titleFormat === 'H2' && block.title ? block.title.trim() : defaultH2;
      block.fields.forEach(f => {
        allFields.push({
          ...f,
          locationCode: f.locationCode || block.title || currentH1,
          sectionH1: currentH1,
          sectionH2: effectiveH2 || currentH1
        });
      });
    }

    // 3. Trường bóc tách từ TABLE
    if (block.type === 'TABLE') {
      const tableFields = extractTableFields(block, currentH1, defaultH2);
      allFields.push(...tableFields);
    }
  });

  return allFields;
}

/**
 * Phân nhóm mảng trường FormFieldISO thành cây phân cấp H1 -> H2 -> FormFieldISO[]
 */
export function groupFieldsByHierarchy(fields: FormFieldISO[]): FieldHierarchyGroup[] {
  const h1Map = new Map<string, Map<string, FormFieldISO[]>>();

  fields.forEach(field => {
    const h1 = (field.sectionH1 || 'Thông tin chung').trim();
    const h2 = (field.sectionH2 || h1).trim();

    if (!h1Map.has(h1)) {
      h1Map.set(h1, new Map<string, FormFieldISO[]>());
    }
    const h2Map = h1Map.get(h1)!;
    if (!h2Map.has(h2)) {
      h2Map.set(h2, []);
    }
    h2Map.get(h2)!.push(field);
  });

  const result: FieldHierarchyGroup[] = [];

  h1Map.forEach((h2Map, h1) => {
    const h2Groups: { h2: string; fields: FormFieldISO[] }[] = [];
    let totalFieldsCount = 0;

    h2Map.forEach((fList, h2) => {
      h2Groups.push({ h2, fields: fList });
      totalFieldsCount += fList.length;
    });

    result.push({
      h1,
      totalFieldsCount,
      h2Groups
    });
  });

  return result;
}
