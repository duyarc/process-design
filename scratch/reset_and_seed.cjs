const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

// 1. Define layout blocks for empty container inspection form
const layoutBlocks = [
  {
    id: "b_title",
    type: "TITLE",
    columns: 1,
    title: "PHIẾU KIỂM TRA CONTAINER RỖNG",
    fields: [
      {
        id: "f_title_desc",
        type: "text",
        checkItem: "(kiểm tra trước khi load hàng lên cont)",
        locationCode: "TITLE-DESC",
        frequency: "Once/Shift",
        reactionProtocol: ""
      }
    ],
    logo: "uploads/default_logo.png"
  },
  {
    id: "b_info",
    type: "INFO_GRID",
    columns: 2,
    title: "Thông tin chung",
    fields: [
      { id: "f_info_date", type: "date", checkItem: "Ngày", locationCode: "INFO-DATE", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_info_cont", type: "text", checkItem: "Số Container", locationCode: "INFO-CONT", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_info_order", type: "text", checkItem: "Số đơn hàng", locationCode: "INFO-ORDER", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_info_provider", type: "text", checkItem: "Đơn vị cấp Cont", locationCode: "INFO-PROVIDER", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_info_loc", type: "text", checkItem: "Địa điểm", locationCode: "INFO-LOC", frequency: "Once/Shift", reactionProtocol: "" },
      { 
        id: "f_info_eir", 
        type: "radio", 
        checkItem: "Phiếu EIR", 
        locationCode: "INFO-EIR", 
        frequency: "Once/Shift", 
        reactionProtocol: "",
        options: [
          { label: "Có", value: "Có", isPass: true },
          { label: "Không", value: "Không", isPass: false }
        ]
      }
    ]
  },
  {
    id: "b_checklist",
    type: "CHECKLIST_TABLE",
    columns: 1,
    title: "Chi tiết kiểm tra chất lượng",
    columnLabels: {
      stt: "STT",
      item: "Nội dung kiểm tra",
      target: "Đ / KĐ",
      reaction: "Mô tả cụ thể nếu Không đạt"
    },
    fields: [
      // Bên ngoài
      { id: "f_ext_01", type: "radio", checkItem: "[Bên ngoài] Số cont đúng Phiếu EIR", locationCode: "EXT-01", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Đối chiếu lại với phiếu EIR, báo cáo trưởng ca nếu phát hiện sai lệch số cont." },
      { id: "f_ext_02", type: "radio", checkItem: "[Bên ngoài] Thùng Cont không bị móp méo, thủng", locationCode: "EXT-02", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Chụp ảnh vị trí móp méo, đánh giá độ sâu vết móp. Nếu thủng rách, từ chối nhận container." },
      { id: "f_ext_03", type: "radio", checkItem: "[Bên ngoài] Các góc container không biến dạng", locationCode: "EXT-03", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Chụp ảnh các góc biến dạng. Báo cáo giám sát chất lượng kiểm tra kết cấu an toàn trước khi xếp hàng." },
      // Cửa
      { id: "f_door_01", type: "radio", checkItem: "[Cửa] Chốt khóa, bản lề, tay cầm cửa hoạt động tốt", locationCode: "DOOR-01", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Bôi trơn dầu nếu rít. Nếu hỏng chốt khóa hoặc không khép kín cửa được, yêu cầu đội bảo trì sửa chữa hoặc đổi container." },
      { id: "f_door_02", type: "radio", checkItem: "[Cửa] Gioăng cao su (door gasket) nguyên vẹn", locationCode: "DOOR-02", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Nếu rách nhẹ, tiến hành gia cố tạm thời và ghi nhận. Nếu rách nặng gây hở nước, yêu cầu đổi container." },
      // Điều kiện Bên Trong
      { id: "f_int_01", type: "radio", checkItem: "[Bên Trong] Không có mùi lạ", locationCode: "INT-01", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Mở cửa thông gió 15 phút. Nếu vẫn còn mùi hôi hóa chất hoặc ẩm mốc nặng, tiến hành vệ sinh lại hoặc từ chối nhận." },
      { id: "f_int_02", type: "radio", checkItem: "[Bên Trong] Khô thoáng, không bị đọng nước", locationCode: "INT-02", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Dùng khăn khô lau sạch vệt nước. Nếu phát hiện rò rỉ nước từ trần/vách, từ chối nhận." },
      { id: "f_int_03", type: "radio", checkItem: "[Bên Trong] Đã được vệ sinh sạch sẽ", locationCode: "INT-03", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Yêu cầu tổ vệ sinh quét dọn và xử lý rác thải còn sót lại trong container." },
      { id: "f_int_04", type: "radio", checkItem: "[Bên Trong] Không có lỗ thủng hoặc khe hở", locationCode: "INT-04", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Nếu phát hiện có vệt sáng lọt vào từ lỗ thủng, từ chối nhận container để tránh ướt hàng." },
      // Sàn
      { id: "f_flr_01", type: "radio", checkItem: "[Sàn] Phẳng, không có vật nhọn, vật cản", locationCode: "FLR-01", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Loại bỏ đinh ốc, dăm gỗ hoặc vật sắc nhọn để tránh làm rách bao bì hàng hóa." },
      { id: "f_flr_02", type: "radio", checkItem: "[Sàn] Rãnh T (T-bar floor) không bị tắc nghẽn", locationCode: "FLR-02", frequency: "Once/Shift", targetRange: "Đạt", options: [{ label: "Đ", value: "PASS", isPass: true }, { label: "KĐ", value: "FAIL", isPass: false }], reactionProtocol: "Làm sạch bụi bẩn, đất cát bám trong rãnh T để đảm bảo lưu thông khí lạnh đều dưới sàn." },
      // Nhiệt độ trước khi Load hàng
      { id: "f_temp_01", type: "number", checkItem: "Nhiệt độ Đầu cont (oC)", locationCode: "TEMP-01", frequency: "Once/Shift", minSpec: -25, maxSpec: 10, unit: "oC", reactionProtocol: "Nếu nhiệt độ chưa đạt mức yêu cầu cài đặt, chạy lạnh chờ đạt nhiệt độ đích trước khi chất hàng." },
      { id: "f_temp_02", type: "number", checkItem: "Nhiệt độ Giữa cont (oC)", locationCode: "TEMP-02", frequency: "Once/Shift", minSpec: -25, maxSpec: 10, unit: "oC", reactionProtocol: "Nếu nhiệt độ chưa đạt mức yêu cầu cài đặt, chạy lạnh chờ đạt nhiệt độ đích trước khi chất hàng." },
      { id: "f_temp_03", type: "number", checkItem: "Nhiệt độ Cuối cont (oC)", locationCode: "TEMP-03", frequency: "Once/Shift", minSpec: -25, maxSpec: 10, unit: "oC", reactionProtocol: "Nếu nhiệt độ chưa đạt mức yêu cầu cài đặt, chạy lạnh chờ đạt nhiệt độ đích trước khi chất hàng." }
    ]
  },
  {
    id: "b_sign",
    type: "SIGN",
    columns: 2,
    title: "Ký xác nhận",
    fields: [
      { id: "f_sign_operator", type: "signature", checkItem: "Người kiểm tra (ký và ghi rõ họ tên)", locationCode: "SIGN-OP", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_sign_supervisor", type: "signature", checkItem: "Người thẩm tra (ký và ghi rõ họ tên)", locationCode: "SIGN-SUP", frequency: "Once/Shift", reactionProtocol: "" }
    ]
  }
];

const formTemplate = {
  formId: "3S-QC/F03",
  formTitle: "Phiếu kiểm tra container rỗng",
  version: "V1-25.08.2025",
  status: "ACTIVE",
  layoutBlocks: layoutBlocks,
  revisionHistory: [
    {
      version: "V1",
      date: "2025-08-25",
      author: "System Agent",
      change: "Initial release of Empty Container Inspection template (3S-QC/F03)"
    }
  ]
};

// 2. Define layout blocks for the Tally Sheet Form (as requested in attachment)
const tallyLayoutBlocks = [
  {
    id: "b_tally_title",
    type: "TITLE",
    columns: 1,
    title: "PHIẾU KIỂM ĐẾM",
    fields: [
      {
        id: "f_tally_desc",
        type: "text",
        checkItem: "(kiểm tra và đảm bảo đúng loại, đúng số lượng hàng được load lên container)",
        locationCode: "TITLE-DESC",
        frequency: "Once/Shift",
        reactionProtocol: ""
      }
    ],
    logo: "uploads/default_logo.png"
  },
  {
    id: "b_tally_info",
    type: "INFO_GRID",
    columns: 2,
    title: "Thông tin chung",
    fields: [
      { id: "f_tally_booking", type: "text", checkItem: "Booking", locationCode: "INFO-BOOKING", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_tally_order", type: "text", checkItem: "Số đơn hàng", locationCode: "INFO-ORDER", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_tally_carrier", type: "text", checkItem: "Hãng tàu", locationCode: "INFO-CARRIER", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_tally_lot", type: "text", checkItem: "Số LOT", locationCode: "INFO-LOT", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_tally_container", type: "text", checkItem: "Số Container", locationCode: "INFO-CONTAINER", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_tally_date", type: "date", checkItem: "Ngày", locationCode: "INFO-DATE", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_tally_seal", type: "text", checkItem: "Số Seal", locationCode: "INFO-SEAL", frequency: "Once/Shift", reactionProtocol: "" },
      { 
        id: "f_tally_size", 
        type: "radio", 
        checkItem: "Size Container", 
        locationCode: "INFO-SIZE", 
        frequency: "Once/Shift", 
        reactionProtocol: "",
        options: [
          { label: "40", value: "40", isPass: true },
          { label: "20", value: "20", isPass: true }
        ]
      },
      { id: "f_tally_time_start", type: "text", checkItem: "Thời gian Từ", locationCode: "INFO-TIME-START", frequency: "Once/Shift", reactionProtocol: "" },
      { id: "f_tally_time_end", type: "text", checkItem: "đến", locationCode: "INFO-TIME-END", frequency: "Once/Shift", reactionProtocol: "" }
    ]
  },
  {
    id: "b_tally_matrix",
    type: "MATRIX_TABLE",
    columns: 1,
    title: "Chi tiết kiểm đếm số lượng hàng hóa",
    fields: [],
    matrixConfig: {
      rowHeader: "Lớp",
      rowCount: 17,
      columnHeader: "Tên hàng, quy cách",
      columns: ["SP 1", "SP 2", "SP 3", " ", "  "],
      showTotalColumn: true,
      totalColumnHeader: "Tổng mỗi lớp (bao/carton)",
      showNotesColumn: true,
      notesColumnHeader: "Ghi chú"
    }
  }
];

const tallyFormTemplate = {
  formId: "3S-QC/F04",
  formTitle: "Phiếu kiểm đếm",
  version: "v1.0 (" + new Date().toISOString().split('T')[0] + ")",
  status: "DRAFT",
  layoutBlocks: tallyLayoutBlocks,
  revisionHistory: [
    {
      version: "v1.0",
      date: new Date().toISOString().split('T')[0],
      author: "System Agent",
      change: "Khởi tạo Phiếu kiểm đếm hàng hóa xuất khẩu có Matrix Tally Grid."
    }
  ]
};

// 3. Define the main workflow process integrating both forms in the correct sequential steps
const sampleProcess = {
  id: "proc_container_inspection",
  title: "Quy trình kiểm tra Container rỗng & Kiểm đếm đóng hàng",
  description: "Quy trình chuẩn hóa kiểm tra chất lượng vỏ container trước khi xếp hàng, kết hợp hoạt động kiểm đếm chi tiết số lượng sản phẩm xếp vào container (FARM GATE standard)",
  version: "1",
  lastUpdated: new Date().toISOString(),
  roles: ["QC", "Supervisor"],
  steps: [
    {
      id: "step_start",
      role: "QC",
      action: "Nhận yêu cầu kiểm tra vỏ Container từ bộ phận Logistics",
      bpmnShape: "start-event",
      nextStepId: "step_inspect"
    },
    {
      id: "step_inspect",
      role: "QC",
      action: "Thực hiện kiểm tra chất lượng vỏ container rỗng tại bãi",
      formName: "Phiếu kiểm tra container rỗng",
      bpmnShape: "task",
      nextStepId: "step_tally",
      producesForm: true
    },
    {
      id: "step_tally",
      role: "QC",
      action: "Thực hiện kiểm đếm hàng hóa xếp lên container xuất khẩu",
      formName: "Phiếu kiểm đếm",
      bpmnShape: "task",
      nextStepId: "step_signoff",
      producesForm: true
    },
    {
      id: "step_signoff",
      role: "Supervisor",
      action: "Giám sát chất lượng thẩm tra và ký xác nhận biên bản đóng gói",
      bpmnShape: "task",
      nextStepId: "step_end"
    },
    {
      id: "step_end",
      role: "QC",
      action: "Hoàn tất bàn giao container đủ tiêu chuẩn cho đóng hàng",
      bpmnShape: "end-event"
    }
  ],
  formFields: [],
  sopSignoffs: {
    author: { name: "Nguyễn Văn A", title: "QC Manager" },
    reviewers: [{ name: "Trần Văn B", title: "QA Leader" }],
    authorisers: [{ name: "Lê Văn C", title: "Factory Director" }],
    effectiveDate: new Date().toISOString().split('T')[0]
  },
  workflowFormsData: {
    "Phiếu kiểm tra container rỗng": formTemplate,
    "Phiếu kiểm đếm": tallyFormTemplate
  },
  parentProcessId: "proc_container_inspection",
  status: "Draft"
};

async function main() {
  console.log('Connecting to Supabase...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Delete old submissions and processes
    console.log('Clearing old data from submissions and processes tables...');
    await pool.query('DELETE FROM submissions');
    await pool.query('DELETE FROM processes');
    console.log('Data cleared.');

    // 2. Insert new sample process
    console.log('Inserting new layout-based sample process...');
    await pool.query(`
      INSERT INTO processes (
        id, title, description, version, "lastUpdated", roles, steps, "formFields", "sopSignoffs", "workflowFormsData", "parentProcessId", status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      sampleProcess.id,
      sampleProcess.title,
      sampleProcess.description,
      sampleProcess.version,
      sampleProcess.lastUpdated,
      JSON.stringify(sampleProcess.roles),
      JSON.stringify(sampleProcess.steps),
      JSON.stringify(sampleProcess.formFields),
      JSON.stringify(sampleProcess.sopSignoffs),
      JSON.stringify(sampleProcess.workflowFormsData),
      sampleProcess.parentProcessId,
      sampleProcess.status
    ]);
    console.log('Database successfully reset and seeded with layout-based container inspection & tally process!');
  } catch (err) {
    console.error('Error resetting/seeding database:', err);
  } finally {
    await pool.end();
  }
}

main();
