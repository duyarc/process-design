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
  "CoA": "CoA"
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
