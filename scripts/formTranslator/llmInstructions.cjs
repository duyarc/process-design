/**
 * FormTranslator - LLM Instructions & Domain Knowledge Module
 * Enforces ISO 9001, ISO 22000, BRCGS, GFSI, and international logistics standards.
 * Employs context-aware domain profiling to select industry-standard best-practice terms
 * rather than naive literal / word-for-word translations.
 */

// 1. Finished Product Specification (ISO 22000 / BRCGS / Codex Alimentarius)
const FINISHED_PRODUCT_SPEC_GLOSSARY = {
  "Tiêu chuẩn kỹ thuật sản phẩm": "Finished Product Specification",
  "Product Technical Specifications": "Finished Product Specification",
  "Mã tiêu chuẩn": "Specification Code",
  "Standard Code": "Specification Code",
  "Thị trường": "Destination Market",
  "Target Market": "Destination Market",
  "Ngày ban hành": "Effective Date",
  "Issue Date": "Effective Date",
  "Đóng gói": "Packaging & Pack Size",
  "Tên sản phẩm": "Product Description",
  "Product Name": "Product Description",
  "Nguồn gốc": "Country of Origin",
  "Origin": "Country of Origin",
  "Hạn sử dụng": "Shelf Life",
  "Shelf Life / Expiry Date": "Shelf Life",
  "Điều kiện bảo quản": "Storage Conditions",
  "Thành phần": "Ingredients & Composition",
  "Ingredients": "Ingredients & Composition",
  "Xử lý trước khi sử dụng hoặc sau khi đóng gói": "Intended Use & Handling",
  "Tiêu chuẩn kỹ thuật": "Quality Parameters",
  "Technical Standards": "Quality Parameters",
  "Tên chỉ tiêu": "Parameter",
  "Parameter / Specification Item": "Parameter",
  "Yêu cầu": "Acceptance Criteria",
  "Requirement / Specification": "Acceptance Criteria",
  "Cột mới": "Target / Tolerance",
  "I. Bao bì và đóng gói": "I. Packaging & Packing Materials",
  "II. Cảm quan & Hóa lý": "II. Organoleptic & Physicochemical Parameters",
  "III. Vi sinh": "III. Microbiological Criteria",
  "IV. Kim loại nặng": "IV. Heavy Metals",
  "V. Dư lượng Thuốc Bảo Vệ Thực Vật": "V. Pesticide Residues (MRL)",
  "VI. Điều kiện bảo quản": "VI. Storage & Transport Conditions",
  "Nhiệt độ Container (°C)": "Container Temperature (°C)",
  "Nhiệt độ sản phẩm (°C)": "Product Core Temperature (°C)"
};

// 2. Container Stuffing & Freight Logistics (IMO / Cargo Stowage / Incoterms)
const CONTAINER_STUFFING_GLOSSARY = {
  "Yêu cầu đóng hàng": "Container Stuffing Instructions",
  "Ngày lập": "Date Prepared",
  "Địa điểm giám sát": "Stuffing & Inspection Location",
  "Tên địa điểm/ Kho hàng": "Facility / Warehouse Name",
  "Địa chỉ": "Address",
  "Người liên hệ": "Contact Person",
  "SĐT": "Phone Number",
  "Thông tin và yêu cầu đóng hàng": "Stuffing Specifications",
  "Ngày đóng cont dự kiến": "Estimated Stuffing Date",
  "Thời gian bắt đầu dự kiến": "Estimated Start Time",
  "Loại Cont": "Container Type",
  "[Khô] 20'DC": "[Dry] 20'DC",
  "[Khô] 40'DC": "[Dry] 40'DC",
  "[Khô] 40'HC": "[Dry] 40'HC",
  "[Lạnh] 20'RF": "[Reefer] 20'RF",
  "[Lạnh] 40'RH (Lạnh cao)": "[Reefer] 40'RH (High Cube Reefer)",
  "Nhiệt độ cài đặt": "Set Temperature",
  "Bảng biểu mẫu động": "Dunnage & Loading Accessories",
  "Vật tư hỗ trợ": "Dunnage & Securing Materials",
  "ĐVT": "UoM",
  "Số lượng": "Quantity",
  "Ghi chú": "Notes",
  "Sơ đồ xếp hàng": "Stowage Plan & Loading Pattern",
  "Có xếp hàng lên Pallet (theo yêu cầu chi tiết ở phần 3)": "Palletized loading (per Section 3 specifications)",
  "Không sử dụng Pallet (bỏ qua phần 3)": "Floor loaded / Loose cargo (skip Section 3)",
  "Xếp hàng theo sơ đồ đính kèm": "Load per attached stowage diagram",
  "Xếp theo kinh nghiệm nhà máy": "Load per facility standard practice",
  "Đính kèm bản vẽ / Hình ảnh": "Stowage Diagram / Photos",
  "Đã đính kèm": "Attached",
  "Không có file/ hình ảnh đính kèm": "No file / photo attached",
  "Yêu cầu khác (vui lòng ghi rõ)": "Other requirements (please specify)",
  "Quy cách pallet": "Pallet Specifications",
  "Loại Pallet": "Pallet Type",
  "Pallet Gỗ": "Wooden Pallet",
  "Pallet Nhựa": "Plastic Pallet",
  "Pallet Giấy": "Paper / Cardboard Pallet",
  "Xếp rời": "Floor Loaded",
  "Slip sheet": "Slip Sheet",
  "Kích thước Pallet": "Pallet Dimensions",
  "Quy cách chất hàng trên Pallet": "Pallet Stacking & Securing Specifications",
  "Quy tắc xếp": "Stacking Pattern",
  "Không yêu cầu": "Not Required",
  "Xếp đan dây (Chồng gạch)": "Interlocking Pattern (Brick bond)",
  "Xếp thẳng đứng": "Column Stacking Pattern",
  "Bọc & Cố định Pallet": "Pallet Securing & Wrapping",
  "Quấn màng co": "Stretch Wrapping",
  "Dùng nẹp góc giấy (V-board)": "Corner Protectors (V-Boards)",
  "Đai niềng nhựa (Strapping)": "Plastic Strapping",
  "Số thùng/bao tối đa trên 1 Pallet": "Max Cartons/Bags per Pallet",
  "Yêu cầu khác (nếu có)": "Other requirements (if any)",
  "Ký nhận": "Sign-off",
  "Xác nhận": "Confirmed By",
  "Túi chống ẩm": "Container Desiccant Bags",
  "Túi chống ẩm ": "Container Desiccant Bags",
  "Giấy lót sàn / Vách cont": "Floor & Wall Kraft Paper",
  "Lưới chắn cửa cont": "Container Door Cargo Net",
  "Thanh chắn cửa cont": "Container Cargo Shoring Bar",
  "thanh": "bar",
  "Thiết bị ghi nhiệt độ": "Temperature Data Logger",
  "cái": "pcs",
  "Túi khí chèn lót": "Dunnage Air Bags",
  "Container Stuffing Requirements": "Container Stuffing Instructions",
  "Support Materials / Supplies": "Dunnage & Loading Accessories",
  "Unit": "UoM",
  "Loading / Stacking Pattern": "Stowage Plan & Loading Pattern",
  "Loose / Floor Loaded": "Floor Loaded"
};

// 3. Production Planning & Scheduling (APICS / CPIM / ERP Standards)
const PRODUCTION_PLANNING_GLOSSARY = {
  "Lịch sản xuất": "Production Schedule",
  "1. Kế hoạch Sản xuất": "1. Finished Goods Production Plan",
  "Ngày sản xuất": "Production Date",
  "Tên Thành phẩm": "Finished Product Description",
  "Quy cách đóng gói": "Packaging Specification",
  "Số tấn": "Quantity (tons)",
  "Tiêu chuẩn, Hình mẫu": "Quality Standard / Master Sample",
  "Ghi chú": "Notes",
  "2. Kế hoạch nhập nguyên liệu": "2. Raw Material Inbound Schedule",
  "Tên Nguyên liệu": "Raw Material Description",
  "Người xác nhận": "Authorized By",
  "1. Production Plan": "1. Finished Goods Production Plan",
  "2. Raw Material Inbound Plan": "2. Raw Material Inbound Schedule",
  "Finished Product Name": "Finished Product Description",
  "Packaging Specifications": "Packaging Specification",
  "Quantity (Tons)": "Quantity (tons)",
  "Quality Standard, Master Sample": "Quality Standard / Master Sample",
  "Raw Material Name": "Raw Material Description"
};

// 4. Order Management & QA Field Verification (ISO 9001 / Export Trade)
const ORDER_MANAGEMENT_GLOSSARY = {
  "Thông tin đơn hàng": "Order Information",
  "Số đơn hàng": "Order Number (PO)",
  "Sales phụ trách": "Sales Representative",
  "Loại đơn hàng": "Order Type",
  "Nội địa": "Domestic",
  "XK bị động": "Passive Export",
  "XK chủ động": "Active Export",
  "Ngành hàng": "Commodity / Category",
  "Pháp nhân xuất khẩu": "Exporting Entity (Shipper)",
  "Phạm vi công việc": "Scope of Work",
  "Phạm vi Giám sát": "Inspection Scope",
  "Giao nhận (chỉ giám sát và xác nhận  số lượng hàng hóa giao nhận)": "Tally & Quantity Verification (supervise and verify piece count only)",
  "Kỹ thuật (giám sát chất lượng hàng hóa)": "Quality & Specification Inspection (monitor product quality)",
  "Triển khai QR code (Cerify)": "Traceability QR Code (Cerify)",
  "Có": "Yes",
  "Không": "No",
  "Ngày bắt đầu": "Start Date",
  "Giờ làm việc": "Working Hours",
  "Số ngày làm việc dự kiến": "Estimated Working Days",
  "Mô tả yêu cầu cụ thể": "Specific Requirement Description",
  "Chi tiết đơn hàng": "Order Details",
  "STT": "No.",
  "Tên sản phẩm": "Product Description",
  "Quy cách": "Specification",
  "Số lượng (tấn)": "Quantity (tons)",
  "Số lượng (bao/thùng)": "Quantity (bags/cartons)",
  "Thời gian giao hàng": "Delivery Time",
  "yêu cầu chứng từ chất lượng": "Quality & Compliance Documentation",
  "CoA": "CoA",
  "Testing report": "Testing Report",
  "Health Certificate": "Health Certificate",
  "Khác": "Other",
  "Khác ": "Other",
  "Chứng từ khác (vui lòng ghi rõ)": "Other documents (please specify)",
  "Ký xác nhận": "Signatures",
  "Người lập": "Prepared By",
  "Người thẩm tra": "Reviewed / Verified By"
};

// General Quality Assurance / Foundation Terms
const GENERAL_QC_GLOSSARY = {
  "Người lập": "Prepared By",
  "Người thẩm tra": "Reviewed / Verified By",
  "Ký xác nhận": "Signatures",
  "Biên bản": "Record / Report",
  "Nghiệm thu": "Acceptance / Handover",
  "Tiêu chuẩn kỹ thuật": "Quality Standards",
  "Kiểm tra chất lượng": "Quality Inspection",
  "Thông tin chung": "General Information",
  "(mỗi đơn hàng)": "(per order)",
  "FarmGate  VN": "FarmGate VN",
  "FarmGate Sing": "FarmGate Sing",
  "FarmGate Laos": "FarmGate Laos",
  "FarmGate Combodia": "FarmGate Cambodia",
  "FarmNet": "FarmNet",
  "Hạng mục kiểm tra A": "Inspection Item A",
  "Hạng mục kiểm tra B": "Inspection Item B",
  "cái": "pcs",
  "thanh": "bar",
  "tấn": "tons",
  "kg": "kg",
  "bao": "bags",
  "thùng": "cartons",
  "[Ảnh sản phẩm]": "[Product Image]",
  "Nhân viên Kinh doanh Ký & Ghi rõ họ tên": "Sales Representative Signature & Full Name",
  "Nhân viên Kinh doanh Ký & Ghi rõ họ tên ": "Sales Representative Signature & Full Name",
  "Có": "Yes",
  "Không": "No"
};

// Merged master glossary for universal fallback
const QC_DOMAIN_GLOSSARY = {
  ...GENERAL_QC_GLOSSARY,
  ...ORDER_MANAGEMENT_GLOSSARY,
  ...PRODUCTION_PLANNING_GLOSSARY,
  ...CONTAINER_STUFFING_GLOSSARY,
  ...FINISHED_PRODUCT_SPEC_GLOSSARY
};

/**
 * Returns a profile-specialized vocabulary with general QC fallback.
 * 
 * @param {string} domainProfile
 * @returns {Object.<string, string>}
 */
function getDomainGlossary(domainProfile) {
  let specialized = {};
  switch (domainProfile) {
    case 'FINISHED_PRODUCT_SPECIFICATION':
      specialized = FINISHED_PRODUCT_SPEC_GLOSSARY;
      break;
    case 'CONTAINER_STUFFING_LOGISTICS':
      specialized = CONTAINER_STUFFING_GLOSSARY;
      break;
    case 'PRODUCTION_PLANNING':
      specialized = PRODUCTION_PLANNING_GLOSSARY;
      break;
    case 'ORDER_MANAGEMENT':
      specialized = ORDER_MANAGEMENT_GLOSSARY;
      break;
    default:
      specialized = {};
      break;
  }
  return { ...GENERAL_QC_GLOSSARY, ...specialized };
}

const SYSTEM_PROMPT = `You are a Senior Technical Documentation and Enterprise Quality Assurance Translation Specialist.
Your task is to translate form interface labels, section headings, table headers, and field options into professional, industry-standard English.

MANDATORY TRANSLATION PRINCIPLES (EXTERNAL REFERENCE GROUNDING):
1. Grounding in External Standards (Do Not Rely on Internal Speculation):
   - All domain-specific technical terms must align with verifiable international standards (ISO, IEC, IMO, BRCGS, APICS, ASME, OSHA, etc.).
   - Do not rely on internal LLM reasoning alone or naive literal word-by-word calques.
   - For example:
     * Product quality specifications: use "Finished Product Specification", "Shelf Life", "Acceptance Criteria".
     * Cargo packing: use "Container Stuffing Instructions", "Stowage Plan", "Dunnage & Loading Accessories", "UoM".
     * Production planning: use "Finished Goods Production Plan", "Raw Material Inbound Schedule".
     * Sign-offs: use standard audit roles: "Prepared By", "Reviewed / Verified By", "Authorized By".

2. Terminology Cleanliness & UI Fit:
   - AVOID clumsy slash constructions (e.g. do NOT output "Shelf Life / Expiry Date" or "Requirement / Specification"). Select the single most precise, commonly used industry term.
   - Keep table column headers concise to fit compact print layouts (e.g. "STT" -> "No.", "ĐVT" -> "UoM").

3. Entity & Brand Name Preservation:
   - NEVER translate company names, registered entities, or brands (e.g. "FarmGate VN", "FarmGate Sing", "FarmNet", "Cerify", "CoA").
   - NEVER alter dotted placeholder lines (".....................................................").

4. Schema Integrity:
   - Maintain the EXACT JSON keys from the input dictionary. Output ONLY valid JSON.
`;

/**
 * Builds the LLM prompt payload given a translatable text dictionary and domain profile.
 * 
 * @param {Object.<string, string>} dictionary
 * @param {string} [domainProfile='GENERAL_QC']
 * @param {string} [sourceLang='vi']
 * @param {string} [targetLang='en']
 * @returns {{ systemInstruction: string, promptText: string, glossary: Object }}
 */
function buildPrompt(dictionary, domainProfile = 'GENERAL_QC', sourceLang = 'vi', targetLang = 'en') {
  const glossary = getDomainGlossary(domainProfile);
  const promptText = `Translate the following ${sourceLang.toUpperCase()} form dictionary into professional ${targetLang.toUpperCase()} using ${domainProfile} industry best-practice standards:

Form Context Profile: ${domainProfile}

Dictionary to Translate:
${JSON.stringify(dictionary, null, 2)}
`;

  return {
    systemInstruction: SYSTEM_PROMPT,
    promptText,
    glossary
  };
}

/**
 * Generalized Terminology Citation Registry
 * Associates technical terms across any domain with external verifiable references.
 * Conforms to the domain-agnostic TerminologyCitation schema:
 * { term, authority, standardDoc, section?, referenceUrl?, scope? }
 */
const TERMINOLOGY_CITATIONS = {
  "Finished Product Specification": {
    term: "Finished Product Specification",
    authority: "BRCGS / ISO",
    standardDoc: "BRCGS Food Safety Issue 9 Clause 3.6 / ISO 22000:2018 Clause 8.5.1.3",
    section: "Product Specifications & Hazard Analysis",
    referenceUrl: "https://www.brcgs.com",
    scope: "Quality Assurance & Product Safety"
  },
  "Container Stuffing Instructions": {
    term: "Container Stuffing Instructions",
    authority: "IMO / ILO / UNECE",
    standardDoc: "Code of Practice for Packing of Cargo Transport Units (CTU Code)",
    section: "Chapter 7: Packing and Securing Cargo into CTUs",
    referenceUrl: "https://www.imo.org",
    scope: "Maritime Freight & Cargo Logistics"
  },
  "Tally & Quantity Verification": {
    term: "Tally & Quantity Verification",
    authority: "International Maritime Surveyors",
    standardDoc: "Standard Cargo Survey & Tally Inspection Practice",
    section: "Discharge & Loading Piece Count Verification",
    referenceUrl: "https://www.internationalsurveygroup.com",
    scope: "Cargo Inspection & Custody Transfer"
  },
  "Finished Goods Production Plan": {
    term: "Finished Goods Production Plan",
    authority: "APICS / ASCM",
    standardDoc: "CPIM Master Production Schedule (MPS) Body of Knowledge",
    section: "Manufacturing Planning and Control (MPC)",
    referenceUrl: "https://www.ascm.org",
    scope: "Production Planning & Scheduling"
  },
  "Raw Material Inbound Schedule": {
    term: "Raw Material Inbound Schedule",
    authority: "APICS / ASCM",
    standardDoc: "Material Requirements Planning (MRP) Scheduled Receipts",
    section: "Inbound Supply Chain Synchronization",
    referenceUrl: "https://www.ascm.org",
    scope: "Inbound Supply Chain & Procurement"
  }
};

function getCitation(term) {
  return TERMINOLOGY_CITATIONS[term] || null;
}

function listCitations() {
  return TERMINOLOGY_CITATIONS;
}

module.exports = {
  QC_DOMAIN_GLOSSARY,
  FINISHED_PRODUCT_SPEC_GLOSSARY,
  CONTAINER_STUFFING_GLOSSARY,
  PRODUCTION_PLANNING_GLOSSARY,
  ORDER_MANAGEMENT_GLOSSARY,
  GENERAL_QC_GLOSSARY,
  TERMINOLOGY_CITATIONS,
  getCitation,
  listCitations,
  getDomainGlossary,
  SYSTEM_PROMPT,
  buildPrompt
};
