/**
 * FormTranslator - LLM Instructions & Domain Knowledge Module
 * Defines system prompts, QC / ISO 9001 domain terminology, agricultural export rules,
 * and JSON prompt construction for high-accuracy translation.
 */

const QC_DOMAIN_GLOSSARY = {
  // ISO 9001 & Sign-off roles
  "Người lập": "Prepared By",
  "Người thẩm tra": "Reviewed / Verified By",
  "Ký xác nhận": "Signatures",
  "Biên bản": "Record / Report",
  "Nghiệm thu": "Acceptance / Handover",
  "Tiêu chuẩn kỹ thuật": "Technical Standard",
  "Kiểm tra chất lượng": "Quality Inspection",

  // Agricultural Export & Logistics
  "Thông tin đơn hàng": "Order Information",
  "Thông tin chung": "General Information",
  "Số đơn hàng": "Order Number (PO)",
  "Sales phụ trách": "Sales Representative",
  "Loại đơn hàng": "Order Type",
  "Nội địa": "Domestic",
  "XK bị động": "Passive Export",
  "XK chủ động": "Active Export",
  "Ngành hàng": "Commodity / Category",
  "Pháp nhân xuất khẩu": "Exporting Legal Entity",
  "Phạm vi công việc": "Scope of Work",
  "Phạm vi Giám sát": "Supervision Scope",
  "Giao nhận (chỉ giám sát và xác nhận  số lượng hàng hóa giao nhận)": "Receiving & Delivery (supervise and verify quantity only)",
  "Kỹ thuật (giám sát chất lượng hàng hóa)": "Technical (monitor product quality)",
  "Triển khai QR code (Cerify)": "Deploy QR Code (Cerify)",
  "Có": "Yes",
  "Không": "No",
  "Ngày bắt đầu": "Start Date",
  "Giờ làm việc": "Working Hours",
  "Số ngày làm việc dự kiến": "Estimated Working Days",
  "Mô tả yêu cầu cụ thể": "Specific Requirement Description",
  "Chi tiết đơn hàng": "Order Details",
  "STT": "No.",
  "Tên sản phẩm": "Product Name",
  "Quy cách": "Specification",
  "Số lượng (tấn)": "Quantity (tons)",
  "Số lượng (bao/thùng)": "Quantity (bags/cartons)",
  "Thời gian giao hàng": "Delivery Time",
  "yêu cầu chứng từ chất lượng": "Quality Document Requirements",
  "Khác": "Other",
  "Khác ": "Other",
  "Chứng từ khác (vui lòng ghi rõ)": "Other documents (please specify)",
  "(mỗi đơn hàng)": "(per order)",
  "FarmGate  VN": "FarmGate VN",
  "FarmGate Sing": "FarmGate Sing",
  "FarmGate Laos": "FarmGate Laos",
  "FarmGate Combodia": "FarmGate Cambodia",
  "FarmNet": "FarmNet",
  "Testing report": "Testing Report",
  "Health Certificate": "Health Certificate",
  "CoA": "CoA",

  // Q1.2e: Product Technical Specifications
  "Tiêu chuẩn kỹ thuật sản phẩm": "Product Technical Specifications",
  "Mã tiêu chuẩn": "Standard Code",
  "Thị trường": "Target Market",
  "Ngày ban hành": "Issue Date",
  "Đóng gói": "Packaging",
  "Nguồn gốc": "Origin",
  "Hạn sử dụng": "Shelf Life / Expiry Date",
  "Điều kiện bảo quản": "Storage Conditions",
  "Thành phần": "Ingredients / Composition",
  "Xử lý trước khi sử dụng hoặc sau khi đóng gói": "Treatment before use or after packaging",
  "Tiêu chuẩn kỹ thuật": "Technical Standards",
  "Tên chỉ tiêu": "Parameter / Specification Item",
  "Yêu cầu": "Requirement / Specification",
  "Cột mới": "Criteria / Notes",

  // Q1.3e: Stuffing & Loading Requirements
  "Yêu cầu đóng hàng": "Container Stuffing Requirements",
  "Ngày lập": "Date Prepared",
  "Địa điểm giám sát": "Supervision Location",
  "Tên địa điểm/ Kho hàng": "Location / Warehouse Name",
  "Địa chỉ": "Address",
  "Người liên hệ": "Contact Person",
  "SĐT": "Phone Number",
  "Thông tin và yêu cầu đóng hàng": "Stuffing Information & Requirements",
  "Ngày đóng cont dự kiến": "Estimated Stuffing Date",
  "Thời gian bắt đầu dự kiến": "Estimated Start Time",
  "Loại Cont": "Container Type",
  "[Khô] 20'DC": "[Dry] 20'DC",
  "[Khô] 40'DC": "[Dry] 40'DC",
  "[Khô] 40'HC": "[Dry] 40'HC",
  "[Lạnh] 20'RF": "[Reefer] 20'RF",
  "[Lạnh] 40'RH (Lạnh cao)": "[Reefer] 40'RH (High Cube Reefer)",
  "Nhiệt độ cài đặt": "Set Temperature",
  "Bảng biểu mẫu động": "Support Materials / Supplies",
  "Vật tư hỗ trợ": "Support Materials",
  "ĐVT": "Unit",
  "Số lượng": "Quantity",
  "Ghi chú": "Notes",
  "Sơ đồ xếp hàng": "Loading / Stacking Pattern",
  "Có xếp hàng lên Pallet (theo yêu cầu chi tiết ở phần 3)": "Palletized loading (refer to Section 3 requirements)",
  "Không sử dụng Pallet (bỏ qua phần 3)": "Floor loaded / No pallet (skip Section 3)",
  "Xếp hàng theo sơ đồ đính kèm": "Load according to attached diagram",
  "Xếp theo kinh nghiệm nhà máy": "Load per factory standard practice",
  "Đính kèm bản vẽ / Hình ảnh": "Attach Drawing / Photos",
  "Đã đính kèm": "Attached",
  "Không có file/ hình ảnh đính kèm": "No file / photo attached",
  "Yêu cầu khác (vui lòng ghi rõ)": "Other requirements (please specify)",
  "Quy cách pallet": "Pallet Specifications",
  "Loại Pallet": "Pallet Type",
  "Pallet Gỗ": "Wooden Pallet",
  "Pallet Nhựa": "Plastic Pallet",
  "Pallet Giấy": "Paper / Cardboard Pallet",
  "Xếp rời": "Loose / Floor Loaded",
  "Slip sheet": "Slip sheet",
  "Kích thước Pallet": "Pallet Dimensions",
  "Quy cách chất hàng trên Pallet": "Pallet Stacking & Wrapping Specifications",
  "Quy tắc xếp": "Stacking Pattern",
  "Không yêu cầu": "Not Required",
  "Xếp đan dây (Chồng gạch)": "Interlocking / Brick bond pattern",
  "Xếp thẳng đứng": "Column / Vertical stacking",
  "Bọc & Cố định Pallet": "Pallet Securing & Wrapping",
  "Quấn màng co": "Stretch wrapping",
  "Dùng nẹp góc giấy (V-board)": "Corner protectors (V-board)",
  "Đai niềng nhựa (Strapping)": "Plastic strapping",
  "Số thùng/bao tối đa trên 1 Pallet": "Max cartons/bags per pallet",
  "Yêu cầu khác (nếu có)": "Other requirements (if any)",
  "Ký nhận": "Signatures",
  "Xác nhận": "Confirmed By",

  // Q1.4e: Production Schedule
  "Lịch sản xuất": "Production Schedule",
  "1. Kế hoạch Sản xuất": "1. Production Plan",
  "Ngày sản xuất": "Production Date",
  "Tên Thành phẩm": "Finished Product Name",
  "Quy cách đóng gói": "Packaging Specification",
  "Số tấn": "Quantity (tons)",
  "Tiêu chuẩn, Hình mẫu": "Standard / Sample Reference",
  "2. Kế hoạch nhập nguyên liệu": "2. Raw Material Intake Plan",
  "Tên Nguyên liệu": "Raw Material Name",
  "Người xác nhận": "Confirmed By"
};

const SYSTEM_PROMPT = `You are a Senior Technical Documentation and ISO 9001 / QC Quality Assurance Translation Specialist.
Your task is to translate form interface labels, section headings, and field options from Vietnamese into professional English.

STRICT TRANSLATION RULES:
1. Domain Precision:
   - Use standard ISO 9001 and manufacturing QA/QC terminology.
   - For trade: "XK bị động" -> "Passive Export", "XK chủ động" -> "Active Export".
   - For roles: "Người lập" -> "Prepared By", "Người thẩm tra" -> "Reviewed / Verified By".
   - For table headers: Keep them concise so they fit within compact printed table column widths (e.g. "STT" -> "No.").

2. Entity & Brand Name Preservation:
   - NEVER translate company names, registered entities, or brands (e.g. "FarmGate VN", "FarmGate Sing", "FarmNet", "Cerify", "CoA").
   - NEVER translate or modify dotted lines (e.g. ".....................................................").

3. Output Format:
   - You are provided with a JSON object mapping JSON paths to Vietnamese text strings.
   - You MUST return a JSON object with the EXACT SAME keys.
   - Each key's value must be the professional English translation of the corresponding Vietnamese text.
   - Do NOT omit any keys. Do NOT invent new keys. Output ONLY valid JSON.
`;

/**
 * Builds the LLM prompt payload given a translatable text dictionary.
 * 
 * @param {Object.<string, string>} dictionary - Key-value pair of path to source text
 * @param {string} [sourceLang='vi']
 * @param {string} [targetLang='en']
 * @returns {{ systemInstruction: string, promptText: string }}
 */
function buildPrompt(dictionary, sourceLang = 'vi', targetLang = 'en') {
  const promptText = `Translate the following ${sourceLang.toUpperCase()} form dictionary into professional ${targetLang.toUpperCase()} following all system instructions:

${JSON.stringify(dictionary, null, 2)}
`;

  return {
    systemInstruction: SYSTEM_PROMPT,
    promptText,
    glossary: QC_DOMAIN_GLOSSARY
  };
}

module.exports = {
  QC_DOMAIN_GLOSSARY,
  SYSTEM_PROMPT,
  buildPrompt
};
