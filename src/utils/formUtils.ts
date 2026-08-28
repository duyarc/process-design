import type { FormFieldISO, TitleFormatISO, LayoutBlockISO } from '../types';

/**
 * Automatically determines whether a checkbox or radio field should render using
 * Option A (Inline 1-line or 2-Column Grid) or Option C (Top-Aligned Label + Options underneath).
 * Takes into account the number of columns in the parent layout block (blockColumns) or field colSpan.
 */
export function getAutoCheckboxLayoutMode(field: FormFieldISO, blockColumns: number = 2): 'OPTION_A' | 'OPTION_C' {
  const labelLength = (field.checkItem || '').trim().length;
  const options = field.options || [];

  // Effective columns: if field has colSpan spanning full width, treat as 1 column
  const effectiveCols = (field.colSpan && field.colSpan >= blockColumns) ? 1 : blockColumns;

  // 1. Long Option Text Rule: If any option description exceeds 40 characters -> must be Option C
  const hasLongOptionText = options.some(opt => (opt.label || '').length > 40);
  if (hasLongOptionText) return 'OPTION_C';

  // 2. High Option Density Rule: More than 4 stacked options with medium text length (>20 chars)
  const isHighDensity = options.length >= 4 && options.some(opt => (opt.label || '').length > 20);
  if (isHighDensity) return 'OPTION_C';

  // 3. Context-Aware Label & Total Length Thresholds:
  const totalOptionsLength = options.reduce((sum, opt) => sum + (opt.label || '').length, 0);

  if (effectiveCols === 1) {
    // In 1-column layout (~698px width), questions up to 65 chars with short options easily fit on 1 line.
    // Also if label + options total <= 85 characters, stay Option A (Inline).
    if (labelLength > 65 && totalOptionsLength > 25) return 'OPTION_C';
    if (labelLength > 75) return 'OPTION_C';
    return 'OPTION_A';
  }

  if (effectiveCols === 2) {
    // In 2-column layout (~340px width)
    if (labelLength > 45 && totalOptionsLength > 15) return 'OPTION_C';
    if (labelLength > 55) return 'OPTION_C';
    return 'OPTION_A';
  }

  // In 3+ column layout (~220px width)
  if (labelLength > 30) return 'OPTION_C';
  return 'OPTION_A';
}

/**
 * Checks whether options within a field are long or dense, requiring vertical stacking (column).
 * If false, options can be displayed horizontally inline with flex-direction: row.
 */
export function hasLongOptions(field: FormFieldISO): boolean {
  const options = field.options || [];
  if (options.some(opt => (opt.label || '').length > 30)) return true;
  if (options.length >= 4 && options.some(opt => (opt.label || '').length > 15)) return true;
  if (options.length > 5) return true;
  return false;
}

/**
 * Automatically determines whether options in a table column/cell can fit horizontally on a single line.
 * Returns true if options are short enough to display inline side-by-side without overflowing.
 */
export function canTableOptionsFitInline(
  options: { label?: string; value?: string }[] | undefined,
  colWidth?: string,
  checkboxLayout?: string
): boolean {
  if (!options || options.length === 0) return false;
  if (checkboxLayout === '2-column') return false; // Explicit 2-column grid override

  const count = options.length;
  const maxLabelLen = Math.max(...options.map(o => (o.label || '').trim().length));
  const totalLen = options.reduce((sum, o) => sum + (o.label || '').trim().length, 0);

  // 1. If any single option is long (> 18 characters) -> vertical
  if (maxLabelLen > 18) return false;

  // 2. Parse column width if specified (in px or %)
  let estimatedColWidthPx = 150; // default assumed minimum column width in table
  if (colWidth) {
    if (colWidth.endsWith('%')) {
      const pct = parseFloat(colWidth);
      if (!isNaN(pct)) {
        estimatedColWidthPx = (pct / 100) * 700; // ~700px standard printable A4 table width
      }
    } else if (colWidth.endsWith('px')) {
      const px = parseFloat(colWidth);
      if (!isNaN(px)) {
        estimatedColWidthPx = px;
      }
    }
  }

  const estimatedNeededWidth = (count * 25) + (totalLen * 7.5);

  // 3. Short 2-option pairs (like Có/Không, Đạt/KĐ, Yes/No, Nam/Nữ) total <= 16 chars:
  if (count <= 2 && totalLen <= 16 && estimatedColWidthPx >= 70) {
    return true;
  }

  // 4. 3 to 4 short options (like A/B/C, Thấp/TB/Cao, etc.)
  if (count <= 4 && maxLabelLen <= 12 && estimatedNeededWidth <= estimatedColWidthPx) {
    return true;
  }

  // 5. General check against column width
  return estimatedNeededWidth <= estimatedColWidthPx;
}

/**
 * Calculates optimal 2-column grid template percentages based on option label lengths.
 */
export function getCheckboxGridTemplate(options: any[]): string {
  if (!options || options.length === 0) return '1fr 1fr';
  let maxLen1 = 0;
  let maxLen2 = 0;
  options.forEach((opt, idx) => {
    const len = opt && opt.label ? opt.label.length : 0;
    if (idx % 2 === 0) {
      if (len > maxLen1) maxLen1 = len;
    } else {
      if (len > maxLen2) maxLen2 = len;
    }
  });
  if (maxLen1 === 0) maxLen1 = 10;
  if (maxLen2 === 0) maxLen2 = 10;
  const total = maxLen1 + maxLen2;
  const pct1 = Math.max(30, Math.min(70, Math.round((maxLen1 / total) * 100)));
  const pct2 = 100 - pct1;
  return `${pct1}% ${pct2}%`;
}

/**
 * Sanitizes field labels by stripping trailing colons and extra whitespace.
 */
export const sanitizeLabel = (label?: string): string => {
  if (!label) return '';
  return label.replace(/:+$/, '').trim();
};

/**
 * Calculates the effective title format for a block with fallback defaults.
 * SECTION_LABEL defaults to 'H1', all other content blocks default to 'NONE'.
 */
export const getEffectiveTitleFormat = (block: { type: string; titleFormat?: TitleFormatISO; sectionFormat?: 'H1' | 'H2' }): TitleFormatISO => {
  if (block.titleFormat) return block.titleFormat;
  if (block.type === 'SECTION_LABEL') return block.sectionFormat || 'H1';
  return 'NONE';
};

/**
 * Determines whether a TABLE block should seamlessly merge with its preceding block.
 * Returns true if:
 * 1. The current block is a TABLE with hideHeader === true
 * 2. The current block has titleFormat === 'NONE' (no section/block title displayed)
 * 3. The preceding block is also a TABLE
 */
export function isSeamlessTableBlock(
  block?: { type: string; hideHeader?: boolean; titleFormat?: TitleFormatISO; sectionFormat?: 'H1' | 'H2' },
  prevBlock?: { type: string; hideHeader?: boolean; titleFormat?: TitleFormatISO; sectionFormat?: 'H1' | 'H2' }
): boolean {
  if (!block || !prevBlock) return false;
  if (block.type !== 'TABLE' || prevBlock.type !== 'TABLE') return false;
  if (!block.hideHeader) return false;
  const titleFmt = getEffectiveTitleFormat(block);
  return titleFmt === 'NONE';
}

/**
 * Normalizes any title string to follow Digital 5S naming conventions:
 * 1. Remove Vietnamese diacritics (accents)
 * 2. Strip special characters (except alphanumeric, spaces, and underscores)
 * 3. Replace spaces with underscores and remove duplicate underscores
 */
export function to5SFileName(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[đđ]/g, 'd')
    .replace(/[ĐĐ]/g, 'D')
    .replace(/[^a-zA-Z0-9\s_]/g, '') // strip special chars
    .trim()
    .replace(/\s+/g, '_') // space to underscore
    .replace(/_+/g, '_'); // duplicate underscores to single
}

export interface FormValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Modular Form Submission Validation Handler.
 * 
 * Note for future sessions:
 * The hardcoded all-fields completion check ("Please fill out all check items") has been removed.
 * Use this function as the central entry point to plug in domain-specific validation rules
 * (e.g. required field flags, custom spec constraints, or step-based criteria).
 */
export const validateFormSubmission = (
  _formTemplate: any,
  _formValues: Record<string, any>
): FormValidationResult => {
  // Default: bypass arbitrary completion checks
  return {
    isValid: true,
    errors: []
  };
};

/**
 * Standard preset ratios for 2-column INFO_GRID (Column 1 width %)
 */
export const INFO_GRID_2COL_PRESETS = [20, 25, 30, 35, 40, 50, 60, 65, 70, 75, 80];

/**
 * Standard curated preset combinations for 3-column INFO_GRID [Col 1, Col 2, Col 3] (%)
 */
export const INFO_GRID_3COL_PRESETS: [number, number, number][] = [
  [33, 34, 33], // 1:1:1 Equal
  [25, 50, 25], // 1:2:1 Center prominent
  [20, 60, 20], // 1:3:1 Center wide
  [50, 25, 25], // 2:1:1 First prominent
  [25, 25, 50], // 1:1:2 Last prominent
  [40, 40, 20], // 2:2:1
  [20, 40, 40], // 1:2:2
  [30, 40, 30]  // 3:4:3
];

/**
 * Calculates CSS Grid gridTemplateColumns for INFO_GRID block with minmax protection against overflow.
 */
export function getInfoGridTemplateColumns(block?: { columns: 1 | 2 | 3; columnWidths?: number[] }): string {
  if (!block || block.columns === 1) return '1fr';

  if (block.columns === 2) {
    const w1 = block.columnWidths?.[0] ?? 50;
    const w2 = block.columnWidths?.[1] ?? (100 - w1);
    return `minmax(0, ${w1}fr) minmax(0, ${w2}fr)`;
  }

  if (block.columns === 3) {
    const w1 = block.columnWidths?.[0] ?? 33.33;
    const w2 = block.columnWidths?.[1] ?? 33.33;
    const w3 = block.columnWidths?.[2] ?? Math.max(10, 100 - w1 - w2);
    return `minmax(0, ${w1}fr) minmax(0, ${w2}fr) minmax(0, ${w3}fr)`;
  }

  return `repeat(${block.columns}, 1fr)`;
}

/**
 * Snaps a 2-column percentage to the closest standard preset notch.
 */
export function snap2ColWidth(rawPct: number): [number, number] {
  const closest = INFO_GRID_2COL_PRESETS.reduce((prev, curr) =>
    Math.abs(curr - rawPct) < Math.abs(prev - rawPct) ? curr : prev
  );
  return [closest, 100 - closest];
}

/**
 * Snaps a 3-column handle drag position to the closest curated 3-column preset.
 */
export function snap3ColWidths(handleIndex: 0 | 1, rawPosPct: number): [number, number, number] {
  let bestPreset = INFO_GRID_3COL_PRESETS[0];
  let minDiff = Infinity;

  INFO_GRID_3COL_PRESETS.forEach((p) => {
    const targetPos = handleIndex === 0 ? p[0] : p[0] + p[1];
    const diff = Math.abs(targetPos - rawPosPct);
    if (diff < minDiff) {
      minDiff = diff;
      bestPreset = p;
    }
  });

  return [...bestPreset];
}

/**
 * Chuyển đổi tiêu đề trường sang định dạng Field ID chuẩn Best Practice (Smart Clean Slug):
 * - Loại bỏ ký tự in đậm Markdown **, __
 * - Loại bỏ đơn vị đo trong ngoặc (tấn/năm), (VND)...
 * - Chuyển dấu tiếng Việt sang ascii không dấu dạng snake_case
 * - Giới hạn tối đa 3 từ khoá chính (khoảng 24 ký tự)
 * - Tự động đánh số _2, _3 nếu trùng lặp trong cùng form
 */
export function generateSmartFieldSlug(label: string, existingIds: string[] = [], type?: string): string {
  if (!label || !label.trim()) {
    const base = type ? type.toLowerCase() : 'field';
    let candidate = `${base}_1`;
    let i = 1;
    while (existingIds.includes(candidate)) {
      i++;
      candidate = `${base}_${i}`;
    }
    return candidate;
  }

  // 1. Lọc bỏ Markdown, dấu ngoặc và đơn vị
  let clean = label
    .replace(/\*\*/g, '')                         // Bỏ markdown bold **
    .replace(/\(.*?\)/g, '')                      // Bỏ đơn vị trong ngoặc (tấn/năm), (VND)...
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')             // Bỏ dấu tiếng Việt
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s_]/g, '')                 // Chỉ giữ chữ cái, số và khoảng trắng
    .trim();

  // 2. Lấy tối đa 3 từ đầu tiên
  const words = clean.split(/\s+/).filter(Boolean).slice(0, 3);
  let slug = words.join('_').substring(0, 24);

  if (!slug) slug = type ? type.toLowerCase() : 'field';

  // 3. Chống trùng lặp trong cùng một biểu mẫu
  let uniqueId = slug;
  let counter = 2;
  while (existingIds.includes(uniqueId)) {
    uniqueId = `${slug}_${counter}`;
    counter++;
  }

  return uniqueId;
}

export { extractTableFields, extractAllFormFields } from './tableFieldExtractor';

// ============================================================================
// SECTION GROUPING & PROGRESS TRACKING ENGINE (Focus Mode & Accordion)
// ============================================================================

export interface FormSubSectionGroup {
  id: string;
  index: number;
  title: string;
  description?: string;
  titleFormat: TitleFormatISO;
  headerBlock?: LayoutBlockISO;
  blocks: LayoutBlockISO[];
}

export interface FormSectionGroup {
  id: string;
  index: number;
  title: string;
  description?: string;
  titleFormat: TitleFormatISO;
  leadingBlocks: LayoutBlockISO[];
  subSections: FormSubSectionGroup[];
  blocks: LayoutBlockISO[];
}

export interface FormGroupingResult {
  preambleBlocks: LayoutBlockISO[];
  sections: FormSectionGroup[];
  postambleBlocks: LayoutBlockISO[];
}

/**
 * Gom nhóm danh sách layoutBlocks thành cấu trúc 3 tầng đối xứng:
 * 1. preambleBlocks: Toàn bộ khối trước mốc H1 đầu tiên (TITLE, hướng dẫn...) -> Hiển thị cố định ở đầu trang (Uncollapsed).
 * 2. sections: Các phân đoạn H1 (và phân đoạn con H2) từ H1 đầu tiên đến trước khối SIGN cuối -> Thu gọn / mở rộng Accordion.
 * 3. postambleBlocks: Khối SIGN ở cuối form (và các khối sau SIGN) -> Hiển thị cố định ở chân trang (Uncollapsed).
 */
export function groupBlocksIntoSections(layoutBlocks: LayoutBlockISO[]): FormGroupingResult {
  if (!layoutBlocks || layoutBlocks.length === 0) {
    return { preambleBlocks: [], sections: [], postambleBlocks: [] };
  }

  // 1. Tìm vị trí mốc H1 đầu tiên
  const firstH1Index = layoutBlocks.findIndex((block) => {
    if ((block.type as string) === 'PAGE_BREAK') return false;
    const effectiveFmt = getEffectiveTitleFormat(block);
    return (block.type === 'SECTION_LABEL' && effectiveFmt === 'H1') || (effectiveFmt === 'H1' && !!block.title?.trim());
  });

  // 2. Tìm vị trí mốc Postamble (khối SIGN ở cuối form)
  let lastSignIndex = -1;
  for (let i = layoutBlocks.length - 1; i >= 0; i--) {
    if (layoutBlocks[i].type === 'SIGN') {
      lastSignIndex = i;
      break;
    }
  }

  // Nếu không có H1 nào trong biểu mẫu -> toàn bộ hiển thị dạng continuous
  if (firstH1Index === -1) {
    return {
      preambleBlocks: [],
      sections: [],
      postambleBlocks: []
    };
  }

  // Preamble: Tất cả các khối đứng trước mốc H1 đầu tiên
  const preambleBlocks = layoutBlocks.slice(0, firstH1Index).filter(b => (b.type as string) !== 'PAGE_BREAK');

  // Postamble: Khối SIGN ở cuối form (và các khối đi sau SIGN nếu có)
  const isPostambleActive = lastSignIndex !== -1 && lastSignIndex >= firstH1Index;
  const postambleBlocks = isPostambleActive
    ? layoutBlocks.slice(lastSignIndex).filter(b => (b.type as string) !== 'PAGE_BREAK')
    : [];

  // Sections Body: Các khối nằm giữa firstH1Index và điểm bắt đầu Postamble
  const bodyBlocks = layoutBlocks.slice(
    firstH1Index,
    isPostambleActive ? lastSignIndex : layoutBlocks.length
  ).filter(b => (b.type as string) !== 'PAGE_BREAK');

  // Gom bodyBlocks thành các Section H1
  const rawH1Sections: {
    id: string;
    index: number;
    title: string;
    description?: string;
    titleFormat: TitleFormatISO;
    blocks: LayoutBlockISO[];
  }[] = [];

  let currentH1: typeof rawH1Sections[0] | null = null;
  let sectionCounter = 0;

  bodyBlocks.forEach((block) => {
    const effectiveFmt = getEffectiveTitleFormat(block);
    const isH1 = effectiveFmt === 'H1' && !!block.title?.trim();
    const isSectionHeader = (block.type === 'SECTION_LABEL' && effectiveFmt === 'H1') || isH1;

    if (isSectionHeader) {
      sectionCounter++;
      currentH1 = {
        id: block.id || `section_${sectionCounter}`,
        index: sectionCounter - 1,
        title: block.title || `Phần ${sectionCounter}`,
        description: block.description,
        titleFormat: 'H1',
        blocks: [block]
      };
      rawH1Sections.push(currentH1);
    } else {
      if (!currentH1) {
        sectionCounter++;
        currentH1 = {
          id: `section_${sectionCounter}`,
          index: sectionCounter - 1,
          title: `Phần ${sectionCounter}`,
          titleFormat: 'H1',
          blocks: []
        };
        rawH1Sections.push(currentH1);
      }
      currentH1.blocks.push(block);
    }
  });

  // Tách từng H1 thành leadingBlocks và subSections (H2)
  const sections = rawH1Sections.map((sec, h1Idx) => {
    const leadingBlocks: LayoutBlockISO[] = [];
    const subSections: FormSubSectionGroup[] = [];
    let currentSub: FormSubSectionGroup | null = null;
    let subCounter = 0;

    sec.blocks.forEach((block, bIdx) => {
      const effectiveFmt = getEffectiveTitleFormat(block);

      // Bỏ qua tiêu đề SECTION_LABEL H1 ở đầu section
      if (bIdx === 0 && block.type === 'SECTION_LABEL' && effectiveFmt === 'H1') {
        leadingBlocks.push(block);
        return;
      }

      // CHỈ KHI thực sự là H2 và có tiêu đề không rỗng
      const isH2 = effectiveFmt === 'H2' && !!block.title?.trim();

      if (isH2) {
        subCounter++;
        currentSub = {
          id: block.id || `subsec_${h1Idx}_${subCounter}`,
          index: subCounter - 1,
          title: block.title || `Mục ${subCounter}`,
          description: block.description,
          titleFormat: 'H2',
          headerBlock: block,
          blocks: [block]
        };
        subSections.push(currentSub);
      } else {
        if (currentSub) {
          currentSub.blocks.push(block);
        } else {
          leadingBlocks.push(block);
        }
      }
    });

    return {
      id: sec.id,
      index: h1Idx,
      title: sec.title,
      description: sec.description,
      titleFormat: sec.titleFormat,
      leadingBlocks,
      subSections,
      blocks: sec.blocks
    };
  });

  return { preambleBlocks, sections, postambleBlocks };
}

/**
 * Tính toán tiến độ nhập liệu (số trường đã điền / tổng số trường) trong một Section.
 */
export function computeSectionProgress(
  section: FormSectionGroup,
  formValues: Record<string, any>,
  tableRowsMap?: Record<string, any[]>,
  signValues?: Record<string, any>
): { completed: number; total: number; isComplete: boolean } {
  let total = 0;
  let completed = 0;

  section.blocks.forEach(block => {
    if (block.type === 'TITLE' || block.type === 'SECTION_LABEL') return;

    if (block.type === 'INFO_GRID' || block.type === 'CHECKLIST_TABLE') {
      (block.fields || []).forEach(f => {
        if ((f.type as string) === 'label' || (f.type as string) === 'divider') return;
        total++;
        const val = formValues[f.id];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          completed++;
        }
      });
    } else if (block.type === 'SIGN') {
      (block.fields || []).forEach(f => {
        if (!f.checkItem || f.checkItem.trim() === '') return;
        total++;
        const signVal = signValues?.[f.id] || formValues[f.id];
        if (signVal && (typeof signVal === 'object' ? signVal.name : String(signVal).trim() !== '')) {
          completed++;
        }
      });
    } else if (block.type === 'TABLE') {
      const rows = tableRowsMap?.[block.id] || block.tableRows || [];
      const cols = block.tableColumns || [];
      const isLikert = (block as any).isLikert || (block as any).tableConfig?.isLikert;

      if (isLikert) {
        rows.forEach((r: any) => {
          if (!r.isHeader) {
            total++;
            const cellKey = `${block.id}_${r.id}_likert`;
            const val = formValues[cellKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              completed++;
            }
          }
        });
      } else {
        rows.forEach((r: any) => {
          if (!r.isHeader) {
            cols.forEach((col: any) => {
              if (col.id === 'col_stt' || col.id === 'col_action') return;
              total++;
              const cellKey = `${block.id}_${r.id}_${col.id}`;
              const val = formValues[cellKey];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                completed++;
              }
            });
          }
        });
      }
    } else if (block.type === 'MATRIX_TABLE' && block.matrixConfig) {
      const cfg = block.matrixConfig;
      const rowCount = cfg.rowCount || 0;
      const colCount = (cfg.columns || []).length;
      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          total++;
          const cellKey = `${block.id}_${r}_${c}`;
          const val = formValues[cellKey];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            completed++;
          }
        }
      }
    }
  });

  return {
    total,
    completed,
    isComplete: total > 0 ? completed >= total : true
  };
}




