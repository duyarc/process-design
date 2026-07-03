const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const fields = [
  // Bên ngoài
  {
    id: "f_ext_01",
    type: "checkbox",
    checkItem: "[Bên ngoài] Số cont đúng Phiếu EIR",
    locationCode: "EXT-01",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Đối chiếu lại với phiếu EIR, báo cáo trưởng ca nếu phát hiện sai lệch số cont."
  },
  {
    id: "f_ext_02",
    type: "checkbox",
    checkItem: "[Bên ngoài] Thùng Cont không bị móp méo, thủng",
    locationCode: "EXT-02",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Chụp ảnh vị trí móp méo, đánh giá độ sâu vết móp. Nếu thủng rách, từ chối nhận container."
  },
  {
    id: "f_ext_03",
    type: "checkbox",
    checkItem: "[Bên ngoài] Các góc container không biến dạng",
    locationCode: "EXT-03",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Chụp ảnh các góc biến dạng. Báo cáo giám sát chất lượng kiểm tra kết cấu an toàn trước khi xếp hàng."
  },
  // Cửa
  {
    id: "f_door_01",
    type: "checkbox",
    checkItem: "[Cửa] Chốt khóa, bản lề, tay cầm cửa có hoạt động trơn tru và chắc chắn",
    locationCode: "DOOR-01",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Bôi trơn dầu nếu rít. Nếu hỏng chốt khóa hoặc không khép kín cửa được, yêu cầu đội bảo trì sửa chữa hoặc đổi container."
  },
  {
    id: "f_door_02",
    type: "checkbox",
    checkItem: "[Cửa] Gioăng cao su (door gasket) nguyên vẹn, không bị rách, không hở",
    locationCode: "DOOR-02",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Nếu rách nhẹ, tiến hành gia cố tạm thời và ghi nhận. Nếu rách nặng gây hở nước, yêu cầu đổi container."
  },
  // Điều kiện Bên Trong
  {
    id: "f_int_01",
    type: "checkbox",
    checkItem: "[Điều kiện Bên Trong] Không có mùi lạ",
    locationCode: "INT-01",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Mở cửa thông gió 15 phút. Nếu vẫn còn mùi hôi hóa chất hoặc ẩm mốc nặng, tiến hành vệ sinh lại hoặc từ chối nhận."
  },
  {
    id: "f_int_02",
    type: "checkbox",
    checkItem: "[Điều kiện Bên Trong] Khô thoáng, không bị đọng nước",
    locationCode: "INT-02",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Dùng khăn khô lau sạch vệt nước. Nếu phát hiện rò rỉ nước từ trần/vách, từ chối nhận."
  },
  {
    id: "f_int_03",
    type: "checkbox",
    checkItem: "[Điều kiện Bên Trong] Đã được vệ sinh sạch sẽ",
    locationCode: "INT-03",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Yêu cầu tổ vệ sinh quét dọn và xử lý rác thải còn sót lại trong container."
  },
  {
    id: "f_int_04",
    type: "checkbox",
    checkItem: "[Điều kiện Bên Trong] Không có lỗ thủng hoặc khe hở (khéo hờ cửa và kiểm tra bằng đèn pin)",
    locationCode: "INT-04",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Nếu phát hiện có vệt sáng lọt vào từ lỗ thủng, từ chối nhận container để tránh ướt hàng."
  },
  {
    id: "f_int_05",
    type: "checkbox",
    checkItem: "[Điều kiện Bên Trong] Quạt thông gió hoạt động bình thường",
    locationCode: "INT-05",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Kiểm tra nguồn điện và công tắc quạt. Báo bảo trì kỹ thuật nếu quạt không quay."
  },
  // Sàn
  {
    id: "f_flr_01",
    type: "checkbox",
    checkItem: "[Sàn] Phẳng, không có vật nhọn, vật cản",
    locationCode: "FLR-01",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Loại bỏ đinh ốc, dăm gỗ hoặc vật sắc nhọn để tránh làm rách bao bì hàng hóa."
  },
  {
    id: "f_flr_02",
    type: "checkbox",
    checkItem: "[Sàn] Rãnh T (T-bar floor) không bị tắc nghẽn",
    locationCode: "FLR-02",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Làm sạch bụi bẩn, đất cát bám trong rãnh T để đảm bảo lưu thông khí lạnh đều dưới sàn."
  },
  {
    id: "f_flr_03",
    type: "checkbox",
    checkItem: "[Sàn] 04 lỗ thoát nước nguyên vẹn, không tắc nghẽn",
    locationCode: "FLR-03",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Thông tắc các lỗ thoát nước ở 4 góc sàn nếu bị nghẹt lá cây, rác."
  },
  {
    id: "f_flr_04",
    type: "checkbox",
    checkItem: "[Sàn] Thiết bị lạnh hoạt động bình thường",
    locationCode: "FLR-04",
    frequency: "Once/Shift",
    targetRange: "Đạt (OK)",
    reactionProtocol: "Khởi động chạy thử block lạnh, kiểm tra mã lỗi trên màn hình điều khiển. Báo kỹ thuật lạnh xử lý."
  },
  // Nhiệt độ trước khi Load hàng
  {
    id: "f_temp_01",
    type: "number",
    checkItem: "Nhiệt độ Đầu cont (oC)",
    locationCode: "TEMP-01",
    frequency: "Once/Shift",
    minSpec: -25,
    maxSpec: 10,
    unit: "oC",
    reactionProtocol: "Nếu nhiệt độ chưa đạt mức yêu cầu cài đặt, chạy lạnh chờ đạt nhiệt độ đích trước khi chất hàng."
  },
  {
    id: "f_temp_02",
    type: "number",
    checkItem: "Nhiệt độ Giữa cont (oC)",
    locationCode: "TEMP-02",
    frequency: "Once/Shift",
    minSpec: -25,
    maxSpec: 10,
    unit: "oC",
    reactionProtocol: "Nếu nhiệt độ chưa đạt mức yêu cầu cài đặt, chạy lạnh chờ đạt nhiệt độ đích trước khi chất hàng."
  },
  {
    id: "f_temp_03",
    type: "number",
    checkItem: "Nhiệt độ Cuối cont (oC)",
    locationCode: "TEMP-03",
    frequency: "Once/Shift",
    minSpec: -25,
    maxSpec: 10,
    unit: "oC",
    reactionProtocol: "Nếu nhiệt độ chưa đạt mức yêu cầu cài đặt, chạy lạnh chờ đạt nhiệt độ đích trước khi chất hàng."
  },
  // Xử lý báo cáo
  {
    id: "f_rep_01",
    type: "text",
    checkItem: "Kết quả Xử lý Không đạt (nếu có)",
    locationCode: "REP-01",
    frequency: "Once/Shift",
    targetRange: "Ghi nhận biện pháp khắc phục",
    reactionProtocol: "Nhập mô tả cụ thể cách xử lý container lỗi."
  },
  {
    id: "f_rep_02",
    type: "text",
    checkItem: "Ghi nhận khác (nếu có)",
    locationCode: "REP-02",
    frequency: "Once/Shift",
    targetRange: "Ghi nhận thêm thông tin",
    reactionProtocol: "Nhập các lưu ý khác."
  }
];

const revisionHistory = [
  {
    version: "v1.0",
    date: new Date().toISOString().split('T')[0],
    author: "System Agent",
    change: "Initial release of Empty Container Inspection template (FARM GATE standard)"
  }
];

const formTemplate = {
  formId: "3S-QC/F03",
  formTitle: "Phiếu kiểm tra container rỗng",
  version: "v1.0 (" + new Date().toISOString().split('T')[0] + ")",
  status: "ACTIVE",
  isoFields: fields,
  revisionHistory: revisionHistory
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Fetch current process
    const processId = 'proc_1781170202946';
    const fetchRes = await pool.query('SELECT * FROM processes WHERE id = $1', [processId]);
    if (fetchRes.rows.length === 0) {
      console.error(`Process ${processId} not found in database.`);
      return;
    }

    const processObj = fetchRes.rows[0];
    const workflowFormsData = processObj.workflowFormsData || {};

    // 2. Set form template data
    workflowFormsData['Phiếu kiểm tra container rỗng'] = formTemplate;

    // 3. Save back to db
    await pool.query(
      'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
      [JSON.stringify(workflowFormsData), new Date().toISOString(), processId]
    );

    console.log(`Successfully populated "Phiếu kiểm tra container rỗng" template inside process: ${processObj.title} (${processId})`);
  } catch (err) {
    console.error('Error updating database:', err);
  } finally {
    await pool.end();
  }
}

main();
