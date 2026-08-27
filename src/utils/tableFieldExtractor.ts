import type { FormFieldISO, LayoutBlockISO, TableColumnConfig, TableRowConfig } from '../types';

/**
 * Trích xuất các trường dữ liệu nhập liệu từ một khối Bảng (TABLE block)
 */
export function extractTableFields(block: LayoutBlockISO): FormFieldISO[] {
  if (block.type !== 'TABLE' || !block.tableColumns || !block.tableRows) {
    return [];
  }

  const fields: FormFieldISO[] = [];
  let currentGroupTitle = '';

  block.tableRows.forEach((row: TableRowConfig, rIdx: number) => {
    // 1. Nhận diện dòng phân nhóm
    if (row.isGroupHeader || block.tableData?.[row.id]?.['_groupTitle']) {
      currentGroupTitle = row.groupTitle || block.tableData?.[row.id]?.['_groupTitle'] || '';
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
        reactionProtocol: ''
      });
    });
  });

  return fields;
}

/**
 * Trích xuất toàn bộ trường dữ liệu từ tất cả các khối (INFO_GRID, TABLE, MATRIX_TABLE, CHECKLIST_TABLE)
 */
export function extractAllFormFields(blocks: LayoutBlockISO[] = []): FormFieldISO[] {
  const allFields: FormFieldISO[] = [];

  blocks.forEach(block => {
    // 1. Trường chuẩn trong INFO_GRID hoặc khối có block.fields
    if (block.fields && block.fields.length > 0) {
      block.fields.forEach(f => {
        allFields.push({
          ...f,
          locationCode: f.locationCode || block.title || 'Thông tin chung'
        });
      });
    }

    // 2. Trường bóc tách từ TABLE
    if (block.type === 'TABLE') {
      const tableFields = extractTableFields(block);
      allFields.push(...tableFields);
    }
  });

  return allFields;
}
