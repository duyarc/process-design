/**
 * Seed / Update Script for Factory Assessment Form ('3S-FA02' - Biểu mẫu đánh giá nhà máy)
 * Builds the complete 8-section FormTemplateISO structure and persists to PostgreSQL
 * (`forms` table and `processes.workflowFormsData` for process '3S-FA').
 */

const { saveForm, loadForm, getPool } = require('./formTranslator/dbAdapter.cjs');
const { GUIDANCE_MAP } = require('./guidanceData.cjs');

const yesNoOptions = () => [
  { label: 'Có', value: 'YES', isPass: true },
  { label: 'Không', value: 'NO', isPass: false }
];

const maintenanceDocOptions = () => [
  { label: 'Có (đính kèm chứng từ)', value: 'OPT_CO_CHUNG_TU', isPass: true },
  { label: 'Có (không có chứng từ)', value: 'OPT_CO_KHONG_CHUNG_TU', isPass: true },
  { label: 'Không', value: 'OPT_KHONG', isPass: false }
];

const verificationAccuracyOptions = () => [
  { label: 'Chính xác hoàn toàn', value: 'OPT_CHINH_XAC_HOAN_TOAN', isPass: true },
  { label: 'Chính xác một phần', value: 'OPT_CHINH_XAC_MOT_PHAN', isPass: true },
  { label: 'Không chính xác / gian lận', value: 'OPT_KHONG_CHINH_XAC', isPass: false }
];

const evidenceAttachedOptions = () => [
  { label: 'Đã đính kèm minh chứng', value: 'ATTACHED', isPass: true }
];

const layoutBlocks = [
  // =========================================================================
  // 0. TITLE BLOCK
  // =========================================================================
  {
    id: 'b_title_fa02',
    type: 'TITLE',
    title: 'BIỂU MẪU ĐÁNH GIÁ NHÀ MÁY',
    columns: 1,
    fields: [],
    showDate: false,
    datePosition: 'B'
  },

  // =========================================================================
  // I. THÔNG TIN CHUNG
  // =========================================================================
  {
    id: 'b_sec1_label',
    type: 'SECTION_LABEL',
    title: 'I. THÔNG TIN CHUNG',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec1_grid_2col',
    type: 'INFO_GRID',
    title: 'I. THÔNG TIN CHUNG',
    titleFormat: 'NONE',
    columns: 2,
    fields: [
      {
        id: 'f_s1_ngay_danh_gia',
        type: 'date',
        checkItem: 'Ngày đánh giá',
        locationCode: 'I. THÔNG TIN CHUNG',
        reactionProtocol: ''
      },
      {
        id: 'f_s1_danh_gia_vien',
        type: 'text',
        checkItem: 'Đánh giá viên',
        locationCode: 'I. THÔNG TIN CHUNG',
        reactionProtocol: ''
      },
      {
        id: 'f_s1_ten_cong_ty',
        type: 'text',
        checkItem: 'Tên Công ty',
        locationCode: 'I. THÔNG TIN CHUNG',
        reactionProtocol: ''
      },
      {
        id: 'f_s1_dia_chi_nha_may',
        type: 'text',
        checkItem: 'Địa chỉ Nhà máy',
        locationCode: 'I. THÔNG TIN CHUNG',
        reactionProtocol: ''
      }
    ]
  },
  {
    id: 'b_sec1_table_dai_dien',
    type: 'TABLE',
    title: 'Đại diện doanh nghiệp làm việc',
    titleFormat: 'H2',
    borderStyle: 'grid',
    columns: 1,
    hideSTT: true,
    hideHeader: false,
    fields: [],
    tableColumns: [
      { id: 'col_ho_ten', label: 'HỌ VÀ TÊN', type: 'text', width: '40%', align: 'left' },
      { id: 'col_chuc_danh', label: 'CHỨC DANH', type: 'text', width: '30%', align: 'left' },
      { id: 'col_sdt', label: 'SỐ ĐIỆN THOẠI', type: 'text', width: '30%', align: 'left' }
    ],
    tableRows: [
      { id: 'row_dd_1', lineCount: 1 },
      { id: 'row_dd_2', lineCount: 1 },
      { id: 'row_dd_3', lineCount: 1 },
      { id: 'row_dd_4', lineCount: 1 }
    ],
    tableData: {}
  },
  {
    id: 'b_sec1_grid_nganh_hang',
    type: 'INFO_GRID',
    title: 'Ngành hàng chính',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s1_nganh_hang_chinh',
        type: 'checkbox',
        checkItem: 'Ngành hàng chính',
        locationCode: 'I. THÔNG TIN CHUNG',
        reactionProtocol: '',
        options: [
          { label: 'Điều', value: 'OPT_DIEU', isPass: true },
          { label: 'Dừa', value: 'OPT_DUA', isPass: true },
          { label: 'Cà phê', value: 'OPT_CA_PHE', isPass: true },
          { label: 'Sầu riêng', value: 'OPT_SAU_RIENG', isPass: true },
          { label: 'Cá', value: 'OPT_CA', isPass: true },
          { label: 'Thảo mộc', value: 'OPT_THAO_MOC', isPass: true },
          { label: 'CNTT', value: 'OPT_CNTT', isPass: true },
          { label: 'Xoài', value: 'OPT_XOAI', isPass: true },
          { label: 'Gạo', value: 'OPT_GAO', isPass: true },
          { label: 'Tôm', value: 'OPT_TOM', isPass: true },
          { label: 'Tinh bột', value: 'OPT_TINH_BOT', isPass: true },
          { label: 'Rau củ', value: 'OPT_RAU_CU', isPass: true },
          { label: 'Lúa mì', value: 'OPT_LUA_MI', isPass: true },
          { label: 'Khác (ghi rõ):', value: '__other__', isOther: true, isPass: true }
        ]
      }
    ]
  },
  {
    id: 'b_sec1_table_san_pham',
    type: 'TABLE',
    title: 'Sản phẩm / nhóm sản phẩm chính',
    titleFormat: 'H2',
    borderStyle: 'grid',
    columns: 1,
    hideSTT: true,
    hideHeader: false,
    fields: [],
    tableColumns: [
      { id: 'col_nganh_hang', label: 'NGÀNH HÀNG', type: 'text', width: '35%', align: 'left' },
      { id: 'col_nhom_sp', label: 'NHÓM SẢN PHẨM', type: 'text', width: '40%', align: 'left' },
      { id: 'col_ty_trong', label: 'TỶ TRỌNG (%)', type: 'number', width: '25%', align: 'center' }
    ],
    tableRows: [
      { id: 'row_sp_1', lineCount: 1 },
      { id: 'row_sp_2', lineCount: 1 },
      { id: 'row_sp_3', lineCount: 1 },
      { id: 'row_sp_4', lineCount: 1 }
    ],
    tableData: {}
  },
  {
    id: 'b_sec1_grid_bao_bi',
    type: 'INFO_GRID',
    title: 'Bao bì có thể đóng gói',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s1_bao_bi',
        type: 'checkbox',
        checkItem: 'Bao bì có thể đóng gói',
        locationCode: 'I. THÔNG TIN CHUNG',
        reactionProtocol: '',
        options: [
          { label: 'Đổ xá (rời, không đóng gói)', value: 'OPT_DO_XA', isPass: true },
          { label: 'Bao bì lớn (500–1.000 kg)', value: 'OPT_BAO_BI_LON', isPass: true },
          { label: 'Bao bì công nghiệp (25–50 kg)', value: 'OPT_BAO_BI_CN', isPass: true },
          { label: 'Bao bì nhỏ (thùng / hộp / túi)', value: 'OPT_BAO_BI_NHO', isPass: true }
        ]
      }
    ]
  },

  // =========================================================================
  // II. CÔNG SUẤT
  // =========================================================================
  {
    id: 'b_sec2_label',
    type: 'SECTION_LABEL',
    title: 'II. CÔNG SUẤT',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec2_cong_suat_a',
    type: 'INFO_GRID',
    title: 'II. CÔNG SUẤT',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s2_san_luong_cont',
        type: 'number',
        unit: 'cont/tháng',
        checkItem: 'Trong năm vừa qua, sản lượng trung bình hàng tháng tính theo container là bao nhiêu? (cont/tháng)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: '',
        guidance: '**Tiêu chí đánh giá:**\n• Căn cứ vào số liệu xuất kho thực tế trong 12 tháng gần nhất.\n• Quy đổi chuẩn 1 container = 20-25 tấn tùy quy cách đóng gói.\n• Đánh giá viên đối chiếu với báo cáo xuất kho và tờ khai hải quan (nếu có xuất khẩu).'
      },
      {
        id: 'f_s2_san_luong_tan',
        type: 'number',
        unit: 'tấn/tháng',
        checkItem: 'Trong năm vừa qua, sản lượng trung bình hàng tháng tính theo tấn là bao nhiêu? (tấn/tháng)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_cong_suat_thiet_ke',
        type: 'number',
        unit: 'tấn/tháng',
        checkItem: 'Công suất thiết kế (tấn/tháng)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_san_luong_cam_ket',
        type: 'number',
        unit: 'tấn/tháng',
        checkItem: 'Sản lượng có thể cam kết cung cấp cho Techcoop (tấn/tháng)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_nguon_so_lieu',
        type: 'radio',
        checkItem: 'Số liệu sản lượng, công suất được lấy từ đâu?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: '',
        guidance: '**Minh chứng kiểm tra:**\n• Yêu cầu xem trực tiếp sổ sách ghi chép vận hành xưởng hoặc phần mềm ERP/MES.\n• Đánh giá viên chụp ảnh màn hình hệ thống xuất báo cáo hoặc trang nhật ký sản xuất gần nhất.',
        options: [
          { label: 'Ước tính: dựa trên kinh nghiệm / trí nhớ', value: 'OPT_UOC_TINH', isPass: false },
          { label: 'Thủ công: số ghi chép hoặc file Excel rời', value: 'OPT_THU_CONG', isPass: true },
          { label: 'Phần mềm: dữ liệu được thống kê, tổng hợp để xuất báo cáo định kỳ hoặc theo yêu cầu.', value: 'OPT_PHAN_MEM', isPass: true }
        ]
      },
      {
        id: 'f_s2_nam_van_hanh',
        type: 'number',
        unit: 'năm',
        checkItem: 'Nhà máy được đưa vào vận hành từ năm nào?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      }
    ]
  },
  {
    id: 'b_sec2_table_thiet_bi',
    type: 'TABLE',
    title: 'Danh sách thiết bị chính',
    titleFormat: 'H2',
    borderStyle: 'grid',
    columns: 1,
    hideSTT: true,
    hideHeader: false,
    fields: [],
    tableColumns: [
      { id: 'col_ten_tb', label: 'TÊN THIẾT BỊ', type: 'text', width: '34%', align: 'left' },
      { id: 'col_nam_lap_dat', label: 'NĂM LẮP ĐẶT', type: 'text', width: '20%', align: 'center' },
      { id: 'col_nam_thay_the', label: 'NĂM DỰ ĐỊNH THAY THẾ', type: 'text', width: '26%', align: 'center' },
      { id: 'col_cong_suat', label: 'CÔNG SUẤT', type: 'text', width: '20%', align: 'center' }
    ],
    tableRows: [
      { id: 'row_tb_1', lineCount: 1 },
      { id: 'row_tb_2', lineCount: 1 },
      { id: 'row_tb_3', lineCount: 1 },
      { id: 'row_tb_4', lineCount: 1 },
      { id: 'row_tb_5', lineCount: 1 }
    ],
    tableData: {}
  },
  {
    id: 'b_sec2_cong_suat_b',
    type: 'INFO_GRID',
    title: 'II. CÔNG SUẤT',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s2_ke_hoach_bao_tri',
        type: 'radio',
        checkItem: 'Có lịch/ kế hoạch bảo trì máy móc thiết bị, nhà xưởng hoặc Hồ sơ/ biên bản bảo trì máy móc thiết bị?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: '',
        guidance: '**Hồ sơ cần kiểm tra:**\n• Kế hoạch bảo trì định kỳ năm (đã được Giám đốc nhà máy phê duyệt).\n• Danh mục thiết bị thuộc diện bảo trì phòng ngừa (PM).\n• Nhật ký/biên bản nghiệm thu bảo trì thực tế của 3 tháng gần nhất.',
        options: maintenanceDocOptions()
      },
      {
        id: 'f_s2_ho_so_bao_tri',
        type: 'radio',
        checkItem: 'Có Hồ sơ/ biên bản bảo trì máy móc thiết bị?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: '',
        options: maintenanceDocOptions()
      },
      {
        id: 'f_s2_ty_le_cm_pm',
        type: 'number',
        unit: '%',
        checkItem: 'Tỷ lệ bảo trì hư hỏng / bảo trì dự phòng (CM/PM) dựa theo số liệu trên biên bản là bao nhiêu (%)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_gio_dung_may',
        type: 'number',
        unit: 'giờ',
        checkItem: 'Trong năm vừa qua, ước tính trung bình mỗi tháng nhà máy dừng hoạt động bao nhiêu giờ? (giờ)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_quan_ly_dung_may',
        type: 'radio',
        checkItem: 'Thời gian dừng máy tại nhà máy được ghi nhận và quản lý như thế nào?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: '',
        options: [
          { label: 'Không ghi nhận', value: 'OPT_KHONG_GHI_NHAN', isPass: false },
          { label: 'Ghi nhận thủ công trên giấy/sổ', value: 'OPT_THU_CONG_GIAY', isPass: true },
          { label: 'File Excel, tổng hợp khi có yêu cầu', value: 'OPT_EXCEL_YEU_CAU', isPass: true },
          { label: 'File Excel, có báo cáo tổng hợp định kỳ hàng tháng', value: 'OPT_EXCEL_DINH_KY', isPass: true },
          { label: 'Phần mềm quản lý sản xuất, báo cáo định kỳ hoặc real-time', value: 'OPT_PHAN_MEM_SX', isPass: true }
        ]
      },
      {
        id: 'f_s2_cong_suat_tang_them',
        type: 'number',
        unit: 'tấn/tháng',
        checkItem: 'Trong trường hợp cần tăng sản lượng đột xuất, tổng công suất có thể tăng thêm (nhờ tăng ca, tăng mua nguyên liệu...) là bao nhiêu? (tấn/tháng)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_co_so_lien_ket',
        type: 'radio',
        checkItem: 'Có nhà máy / cơ sở chế biến liên kết không?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: '',
        options: [
          { label: 'Có, cùng chủ sở hữu', value: 'OPT_CUNG_CHU', isPass: true },
          { label: 'Có, hợp đồng dài hạn', value: 'OPT_HD_DAI_HAN', isPass: true },
          { label: 'Có, hợp tác theo đơn hàng', value: 'OPT_THEO_DON_HANG', isPass: true },
          { label: 'Không', value: 'OPT_KHONG', isPass: true }
        ]
      },
      {
        id: 'f_s2_cong_suat_lien_ket',
        type: 'number',
        unit: 'tấn/tháng',
        checkItem: 'Tổng công suất cộng thêm từ cơ sở liên kết (tấn/tháng)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_so_ncc',
        type: 'number',
        unit: 'nhà cung cấp',
        checkItem: 'Doanh nghiệp hiện mua nguyên liệu đầu vào từ bao nhiêu nhà cung cấp?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_ty_trong_3_ncc',
        type: 'number',
        unit: '%',
        checkItem: '3 nhà cung cấp lớn nhất chiếm bao nhiêu % sản lượng nguyên liệu đầu vào? (%)',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: ''
      },
      {
        id: 'f_s2_quan_he_ncc',
        type: 'radio',
        checkItem: 'Các nhà cung cấp nguyên liệu của doanh nghiệp có mối quan hệ nào với nhau không?',
        locationCode: 'II. CÔNG SUẤT',
        reactionProtocol: '',
        options: [
          { label: 'Phần lớn độc lập, không có quan hệ', value: 'OPT_DOC_LAP', isPass: true },
          { label: 'Một số có quan hệ với nhau (cùng chủ, cùng gia đình, hoặc có thỏa thuận hợp tác)', value: 'OPT_MOT_SO_QUAN_HE', isPass: true },
          { label: 'Phần lớn có liên kết với nhau', value: 'OPT_LIEN_KET', isPass: false }
        ]
      }
    ]
  },

  // =========================================================================
  // III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG
  // =========================================================================
  {
    id: 'b_sec3_label',
    type: 'SECTION_LABEL',
    title: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec3_qlcl_a',
    type: 'INFO_GRID',
    title: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s3_quy_trinh_khieu_nai',
        type: 'radio',
        checkItem: 'Anh/chị vui lòng mô tả quy trình tiếp nhận và xử lý khiếu nại của khách hàng từ lúc bắt đầu cho đến lúc kết thúc',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        guidance: '**Tiêu chuẩn xem xét:**\n• **Bước 1:** Tiếp nhận thông tin & lập phiếu khiếu nại (trong vòng 24h).\n• **Bước 2:** Bộ phận QA/QC cô lập lô hàng, lấy mẫu phân tích nguyên nhân gốc (5 Whys / 8D).\n• **Bước 3:** Đề xuất hành động khắc phục phòng ngừa (CAPA) và gửi văn bản phản hồi khách hàng.\n• Đánh giá viên yêu cầu xem tối thiểu 01 hồ sơ khiếu nại thực tế đã được giải quyết.',
        options: [
          { label: 'Quy trình mơ hồ hoặc không có quy trình', value: 'OPT_MO_HO', isPass: false },
          { label: 'Mô tả được các bước logic (Tiếp nhận > Phân loại > Xử lý > Phản hồi), có thời hạn (SLA) cho từng bước', value: 'OPT_BUOC_LOGIC', isPass: true },
          { label: 'Quy trình chuyên nghiệp, có sự tham gia của các bộ phận liên quan (CSKH, Kho, Sản xuất/Mua hàng), có bước lưu vết (log) lại lịch sử và thống kê tỷ lệ khiếu nại.', value: 'OPT_CHUYEN_NGHIEP', isPass: true }
        ]
      },
      {
        id: 'f_s3_dinh_nghia_khieu_nai',
        type: 'radio',
        checkItem: 'Hiện nay, đơn vị định nghĩa như thế nào là một đơn hàng có khiếu nại?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: [
          { label: 'Không có định nghĩa rõ ràng, chỉ tính khiếu nại khi khách yêu cầu bồi thường', value: 'OPT_KHONG_RO_RANG', isPass: false },
          { label: 'Định nghĩa khiếu nại bao gồm các phản hồi liên quan đến chất lượng sản phẩm (sai specs, hàng hỏng, hàng không đúng tem nhãn)', value: 'OPT_NHOM_CHAT_LUONG', isPass: true },
          { label: 'Định nghĩa khiếu nại bao gồm cả nhóm chất lượng và nhóm giao nhận (giao hàng trễ, thiếu số lượng) và nhóm hỗ trợ (sai chứng từ, hóa đơn)', value: 'OPT_TOAN_DIEN', isPass: true }
        ]
      },
      {
        id: 'f_s3_so_cont_khieu_nai',
        type: 'number',
        unit: 'cont/tháng',
        checkItem: 'Trong năm qua, số lượng đơn hàng có phát sinh khiếu nại là bao nhiêu cont? (để trống nếu không thống kê) (cont/tháng)',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: ''
      }
    ]
  },
  {
    id: 'b_sec3_table_chung_nhan_attp',
    type: 'TABLE',
    title: 'Doanh nghiệp đang có Chứng nhận Hệ thống Quản lý ATTP đang còn hiệu lực?',
    titleFormat: 'H2',
    borderStyle: 'grid',
    columns: 1,
    hideSTT: true,
    hideHeader: false,
    fields: [],
    tableColumns: [
      { id: 'col_ten_cn', label: 'TÊN CHỨNG NHẬN', type: 'text', width: '40%', align: 'left' },
      { id: 'col_ngay_het_han', label: 'NGÀY HẾT HẠN', type: 'date', width: '30%', align: 'center' },
      { id: 'col_so_nam_duy_tri', label: 'SỐ NĂM DUY TRÌ LIÊN TỤC', type: 'number', width: '30%', align: 'center' }
    ],
    tableRows: [
      { id: 'row_cn_1', lineCount: 1 },
      { id: 'row_cn_2', lineCount: 1 },
      { id: 'row_cn_3', lineCount: 1 },
      { id: 'row_cn_4', lineCount: 1 }
    ],
    tableData: {}
  },
  {
    id: 'b_sec3_qlcl_b',
    type: 'INFO_GRID',
    title: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s3_muc_chung_nhan_cao_nhat',
        type: 'radio',
        checkItem: 'Mức chứng nhận cao nhất',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        guidance: '**Yêu cầu kiểm tra:**\n• Xem bản gốc hoặc bản sao công chứng chứng chỉ.\n• Kiểm tra hiệu lực chứng chỉ trên cổng tra cứu của tổ chức chứng nhận (SGS, TUV, Bureau Veritas...).\n• Báo cáo đánh giá giám sát định kỳ gần nhất không có lỗi không phù hợp nặng (Major NC).',
        options: [
          { label: 'Không', value: 'OPT_KHONG', isPass: false },
          { label: 'HACCP/ ISO 22000', value: 'OPT_HACCP_ISO', isPass: true },
          { label: 'FSSC 22000/ BRCGS/ IFS', value: 'OPT_FSSC_BRCGS_IFS', isPass: true }
        ]
      },
      {
        id: 'f_s3_han_chung_chi_cao_nhat',
        type: 'radio',
        checkItem: 'Ngày hết hạn của chứng chỉ cao nhất đạt được',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: [
          { label: 'Hết hiệu lực', value: 'OPT_HET_HIEU_LUC', isPass: false },
          { label: 'Còn hiệu lực < 6 tháng', value: 'OPT_DUOI_6_THANG', isPass: true },
          { label: 'Còn hiệu lực >= 6 tháng', value: 'OPT_TREN_6_THANG', isPass: true }
        ]
      },
      {
        id: 'f_s3_so_nam_duy_tri_cn',
        type: 'radio',
        checkItem: 'Số năm duy trì liên tục của chứng nhận cao nhất đạt được',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: [
          { label: 'Không liên tục', value: 'OPT_KHONG_LIEN_TUC', isPass: false },
          { label: 'Gia hạn liên tục < 3 năm', value: 'OPT_DUOI_3_NAM', isPass: true },
          { label: 'Gia hạn liên tục >= 3 năm', value: 'OPT_TREN_3_NAM', isPass: true }
        ]
      },
      {
        id: 'f_s3_ho_so_cong_bo',
        type: 'radio',
        checkItem: 'Có hồ sơ công bố tiêu chuẩn áp dụng theo nghị định chính phủ Việt Nam?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_phong_lab_noi_bo',
        type: 'radio',
        checkItem: 'Có phòng lab nội bộ?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_phieu_kiem_nghiem_doc_lap',
        type: 'radio',
        checkItem: 'Có Phiếu kết quả kiểm nghiệm thành phẩm cấp bởi tổ chức độc lập (VD: SGS, Eurofins...) trong vòng 12 tháng?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_tieu_chuan_ky_thuat_xk',
        type: 'radio',
        checkItem: 'Có Thiết lập tiêu chuẩn kỹ thuật về chất lượng và an toàn thực phẩm cho các sản phẩm xuất khẩu?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_kiem_tra_truoc_xuat_ban',
        type: 'radio',
        checkItem: 'Nhân viên chuyên trách có kiểm tra chất lượng lô hàng theo hợp đồng trước khi xuất bán không?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_khu_vuc_luu_mau',
        type: 'radio',
        checkItem: 'Có phòng hoặc khu vực lưu mẫu sản phẩm?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_ke_hoach_kiem_nghiem_nam',
        type: 'radio',
        checkItem: 'Có kế hoạch kiểm nghiệm hàng năm dựa trên xem xét rủi ro chất lượng và an toàn thực phẩm?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_luu_do_quy_trinh_sx',
        type: 'radio',
        checkItem: 'Có Lưu đồ Quy trình sản xuất và diễn giải quy trình?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_nhat_ky_sx_giao_ca',
        type: 'radio',
        checkItem: 'Có Nhật ký sản xuất? Sổ giao ca? Hồ sơ kiểm tra công đoạn sản xuất, đóng gói?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_doi_qc_chuyen_trach',
        type: 'radio',
        checkItem: 'Có đội QC chuyên trách thực hiện kiểm soát chất lượng xuyên suốt các công đoạn sản xuất chính?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_theo_doi_thong_so_thiet_bi',
        type: 'radio',
        checkItem: 'Có quy định và theo dõi thông số kỹ thuật cho các thiết bị quan trọng trong dây chuyền sản xuất?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      },
      {
        id: 'f_s3_huong_dan_xu_ly_su_co',
        type: 'radio',
        checkItem: 'Có hướng dẫn cho người phụ trách cách xử lý khi phát sinh lỗi hoặc sự cố?',
        locationCode: 'III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG',
        reactionProtocol: '',
        options: yesNoOptions()
      }
    ]
  },

  // =========================================================================
  // IV. NĂNG LỰC GIAO HÀNG
  // =========================================================================
  {
    id: 'b_sec4_label',
    type: 'SECTION_LABEL',
    title: 'IV. NĂNG LỰC GIAO HÀNG',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec4_giao_hang',
    type: 'INFO_GRID',
    title: 'IV. NĂNG LỰC GIAO HÀNG',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s4_xac_dinh_ngay_giao',
        type: 'radio',
        checkItem: 'Khi thực hiện đơn hàng, ngày yêu cầu giao hàng được xác định như thế nào?',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: '',
        options: [
          { label: 'Nhà máy báo leadtime khi nhận được yêu cầu báo giá. Bộ phận kế hoạch xác nhận thời gian giao hàng có thể cam kết trước khi chốt ký hợp đồng.', value: 'OPT_NHA_MAY_BAO_LEADTIME', isPass: true },
          { label: 'Theo yêu cầu của khách hàng, được quy định trên hợp đồng.', value: 'OPT_THEO_KHACH_HANG', isPass: true },
          { label: 'Không cam kết thời gian giao hàng cụ thể, khi nào xong hàng thì giao.', value: 'OPT_KHONG_CAM_KET', isPass: false }
        ]
      },
      {
        id: 'f_s4_dinh_nghia_dung_han',
        type: 'radio',
        checkItem: 'Theo quy trình hiện tại, đơn hàng đúng hạn được định nghĩa như thế nào?',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: '',
        options: [
          { label: 'Tiêu chuẩn cao, hàng hóa phải được giao đúng ngày cam kết (chứng minh qua B/L hoặc POD - Proof of Delivery), tại đúng địa điểm, và phải giao đủ 100% số lượng & chất lượng (On-Time In-Full). Giao đúng ngày nhưng thiếu hàng hoặc hàng lỗi vẫn bị tính là giao trễ/thất bại.', value: 'OPT_OTIF', isPass: true },
          { label: 'Có tính mốc thời gian rõ ràng theo ngày bàn giao cho đơn vị vận chuyển hoặc theo giờ tàu chạy (ETD) tùy theo điều kiện vận chuyển đã chốt, có biên độ (VD: +/- 3 ngày) được thỏa thuận bởi hai bên.', value: 'OPT_CO_BIEN_DO', isPass: true },
          { label: 'Không có định nghĩa rõ ràng.', value: 'OPT_KHONG_RO_RANG', isPass: false }
        ]
      },
      {
        id: 'f_s4_ghi_nhan_lich_su_giao',
        type: 'radio',
        checkItem: 'Lịch sử giao hàng, tỷ lệ giao hàng đúng hạn tại nhà máy được ghi nhận và quản lý như thế nào?',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: '',
        options: [
          { label: 'Phần mềm quản lý sản xuất, logistic chuyên dụng', value: 'OPT_PHAN_MEM_LOGISTIC', isPass: true },
          { label: 'File Excel, có báo cáo thống kê tỷ lệ giao hàng đúng hạn', value: 'OPT_EXCEL_THONG_KE', isPass: true },
          { label: 'Ghi nhận trên giấy/sổ và có ghi chú đúng hạn/trễ hạn', value: 'OPT_GIAY_CO_GHI_CHU', isPass: true },
          { label: 'Ghi nhận thủ công trên giấy/sổ', value: 'OPT_GIAY_THU_CONG', isPass: true },
          { label: 'Không ghi nhận', value: 'OPT_KHONG_GHI_NHAN', isPass: false }
        ]
      },
      {
        id: 'f_s4_so_cont_giao_tre',
        type: 'number',
        unit: 'cont/tháng',
        checkItem: 'Trong năm qua, với số lượng đơn hàng trung bình hàng tháng đã nêu thì số lượng đơn hàng giao không đúng hạn là bao nhiêu cont? (cont/tháng)',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: ''
      },
      {
        id: 'f_s4_thoi_gian_giao_thong_thuong',
        type: 'number',
        unit: 'ngày',
        checkItem: 'Đối với dòng sản phẩm chủ lực, tính từ lúc xác nhận đơn hàng, thông thường nhà máy mất bao nhiêu ngày sẵn sàng giao hàng? (ngày)',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: ''
      },
      {
        id: 'f_s4_thoi_gian_giao_bat_loi',
        type: 'number',
        unit: 'ngày',
        checkItem: 'Trong điều kiện bất lợi, thời gian giao hàng dài nhất là bao nhiêu ngày ? (ngày)',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: ''
      },
      {
        id: 'f_s4_thoi_gian_giao_thuan_loi',
        type: 'number',
        unit: 'ngày',
        checkItem: 'Trong điều kiện thuận lợi, thời gian giao hàng sớm nhất là bao nhiêu ngày ? (ngày)',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: ''
      },
      {
        id: 'f_s4_thoi_gian_giao_cam_ket',
        type: 'number',
        unit: 'ngày',
        checkItem: 'Thời gian giao hàng thường được cam kết trong hợp đồng là bao nhiêu ngày ? (ngày)',
        locationCode: 'IV. NĂNG LỰC GIAO HÀNG',
        reactionProtocol: ''
      }
    ]
  },

  // =========================================================================
  // V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC
  // =========================================================================
  {
    id: 'b_sec5_label',
    type: 'SECTION_LABEL',
    title: 'V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec5_quan_ly_to_chuc',
    type: 'INFO_GRID',
    title: 'V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s5_tach_biet_nhan_su',
        type: 'radio',
        checkItem: 'Bộ phận mua hàng, quản lý sản xuất và kiểm soát chất lượng có được tách biệt về nhân sự không?',
        locationCode: 'V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC',
        reactionProtocol: '',
        options: [
          { label: 'Một người kiêm nhiệm cả 3 chức năng', value: 'OPT_KIEM_NHIEM_3', isPass: false },
          { label: 'Có tách biệt một phần (ví dụ: QC độc lập nhưng Mua hàng và Sản xuất là một)', value: 'OPT_TACH_MOT_PHAN', isPass: true },
          { label: 'Ba chức năng hoàn toàn độc lập — khác người, khác tuyến báo cáo (đính kèm sơ đồ tổ chức)', value: 'OPT_DOC_LAP_HOAN_TOAN', isPass: true }
        ]
      },
      {
        id: 'f_s5_kn_quan_ly_cl',
        type: 'number',
        unit: 'năm',
        checkItem: 'Quản lý chất lượng có bao nhiêu năm kinh nghiệm trong ngành hàng kinh doanh hiện tại? (năm)',
        locationCode: 'V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC',
        reactionProtocol: ''
      },
      {
        id: 'f_s5_kn_quan_ly_sx',
        type: 'number',
        unit: 'năm',
        checkItem: 'Quản lý sản xuất có bao nhiêu năm kinh nghiệm trong ngành hàng kinh doanh hiện tại? (năm)',
        locationCode: 'V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC',
        reactionProtocol: ''
      },
      {
        id: 'f_s5_kn_quan_ly_mh',
        type: 'number',
        unit: 'năm',
        checkItem: 'Quản lý mua hàng có bao nhiêu năm kinh nghiệm trong ngành hàng kinh doanh hiện tại? (năm)',
        locationCode: 'V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC',
        reactionProtocol: ''
      }
    ]
  },
  {
    id: 'b_sec5_retention_label',
    type: 'SECTION_LABEL',
    title: 'KEY STAFF RETENTION RATE',
    sectionFormat: 'H2',
    titleFormat: 'H2',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec5_retention_rate',
    type: 'INFO_GRID',
    title: 'KEY STAFF RETENTION RATE',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s5_tong_nhan_su_chu_chot',
        type: 'number',
        unit: 'người',
        checkItem: 'Tổng số vị trí nhân sự chủ chốt đang làm việc tại bộ phận sản xuất, thu mua và QC/QA là bao nhiêu người? * Không tính lao động thời vụ, hợp đồng dưới 3 tháng hoặc lao động thuê ngoài. (người)',
        locationCode: 'KEY STAFF RETENTION RATE',
        reactionProtocol: ''
      },
      {
        id: 'f_s5_so_nghi_viec_12_thang',
        type: 'number',
        unit: 'người',
        checkItem: 'Trong 12 tháng qua, có bao nhiêu người trong số nhân sự chủ chốt nói trên đã nghỉ việc (bao gồm tự nghỉ, bị cho thôi việc, hoặc hợp đồng không được gia hạn)? (người)',
        locationCode: 'KEY STAFF RETENTION RATE',
        reactionProtocol: ''
      },
      {
        id: 'f_s5_kich_ban_khung_hoang',
        type: 'radio',
        checkItem: "Doanh nghiệp có 'kịch bản xử lý khủng hoảng' khi gặp các tình huống nguy cấp không?",
        locationCode: 'KEY STAFF RETENTION RATE',
        reactionProtocol: '',
        options: [
          { label: 'Không có kế hoạch', value: 'OPT_KHONG_KE_HOACH', isPass: false },
          { label: 'Có kế hoạch dự phòng nhưng chưa ban hành thành văn bản', value: 'OPT_CHUA_BAN_HANH', isPass: true },
          { label: 'Có kế hoạch nhưng chưa kiểm tra', value: 'OPT_CHUA_KIEM_TRA', isPass: true },
          { label: 'Có kế hoạch và có diễn tập/kiểm tra', value: 'OPT_CO_DIEN_TAP', isPass: true }
        ]
      },
      {
        id: 'f_s5_do_chinh_xac_fda',
        type: 'radio',
        checkItem: 'Độ chính xác của thông tin cung cấp so với quan sát tại hiện trường hoặc chứng từ *FDA xác nhận trực tiếp',
        locationCode: 'KEY STAFF RETENTION RATE',
        reactionProtocol: '',
        options: verificationAccuracyOptions()
      }
    ]
  },

  // =========================================================================
  // VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ
  // =========================================================================
  {
    id: 'b_sec6_label',
    type: 'SECTION_LABEL',
    title: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec6_phap_ly',
    type: 'INFO_GRID',
    title: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s6_so_lan_xu_phat',
        type: 'number',
        unit: 'lần',
        checkItem: 'Trong 24 tháng qua, doanh nghiệp có bao nhiêu lần bị cơ quan nhà nước xử phạt hoặc yêu cầu khắc phục liên quan đến hải quan, kiểm dịch thực vật, hoặc nhãn mác? (lần)',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: ''
      },
      {
        id: 'f_s6_muc_xu_ly_nghiem_trong',
        type: 'radio',
        checkItem: 'Trong số đó, mức xử lý nghiêm trọng nhất là gì?',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: [
          { label: 'Không có vi phạm', value: 'OPT_KHONG_VI_PHAM', isPass: true },
          { label: 'Nhắc nhở / cảnh cáo không phạt tiền', value: 'OPT_NHAC_NHO', isPass: true },
          { label: 'Phạt hành chính', value: 'OPT_PHAT_HANH_CHINH', isPass: false },
          { label: 'Tạm giữ lô hàng, yêu cầu bổ sung/làm lại hồ sơ', value: 'OPT_TAM_GIU_LO_HANG', isPass: false },
          { label: 'Tiêu hủy lô hàng hoặc đình chỉ xuất khẩu', value: 'OPT_TIEU_HUY_DINH_CHI', isPass: false }
        ]
      },
      {
        id: 'f_s6_doi_chieu_vi_pham_1',
        type: 'radio',
        checkItem: 'Đối chiếu với kết quả tìm kiếm thông báo xử phạt công khai hoặc cổng tra cứu thông tin vi phạm',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: verificationAccuracyOptions()
      },
      {
        id: 'f_s6_danh_sach_canh_bao_xk',
        type: 'radio',
        checkItem: 'Trong 24 tháng qua, doanh nghiệp có từng xuất hiện trong bất kỳ danh sách cảnh báo hoặc tạm giữ nào của cơ quan quản lý thực phẩm tại các thị trường xuất khẩu (FDA, EU hoặc tương đương) không?',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: [
          { label: 'Không — chưa từng xuất hiện trong bất kỳ danh sách nào', value: 'OPT_CHUA_TUNG', isPass: true },
          { label: 'Từng xuất hiện nhưng đã được gỡ, có giải trình rõ ràng', value: 'OPT_DA_DUOC_GO', isPass: true },
          { label: 'Hiện đang trong danh sách cảnh báo hoặc tạm giữ', value: 'OPT_DANG_CANH_BAO', isPass: false }
        ]
      },
      {
        id: 'f_s6_doi_chieu_vi_pham_2',
        type: 'radio',
        checkItem: 'Đối chiếu với kết quả tìm kiếm thông báo xử phạt công khai hoặc cổng tra cứu thông tin vi phạm',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: verificationAccuracyOptions()
      },
      {
        id: 'f_s6_su_co_lao_dong',
        type: 'radio',
        checkItem: 'Trong 24 tháng qua, doanh nghiệp có phát sinh sự cố nào liên quan đến lao động không?',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: [
          { label: 'Không có sự cố nào', value: 'OPT_KHONG_SU_CO', isPass: true },
          { label: 'Bị nhắc nhở hoặc yêu cầu khắc phục từ cơ quan chức năng', value: 'OPT_NHAC_NHO_LD', isPass: true },
          { label: 'Bị phạt hành chính về lao động hoặc môi trường.', value: 'OPT_PHAT_HC_LD', isPass: false },
          { label: 'Có tranh chấp lao động tập thể hoặc đình công', value: 'OPT_TRANH_CHAP_DINH_CONG', isPass: false },
          { label: 'Đang bị điều tra hoặc khởi kiện liên quan đến vi phạm luật lao động', value: 'OPT_DIEU_TRA_KHOI_KIEN_LD', isPass: false }
        ]
      },
      {
        id: 'f_s6_su_co_moi_truong',
        type: 'radio',
        checkItem: 'Trong 24 tháng qua, doanh nghiệp có phát sinh sự cố nào liên quan đến môi trường không?',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: [
          { label: 'Không có sự cố nào', value: 'OPT_KHONG_SU_CO', isPass: true },
          { label: 'Bị nhắc nhở hoặc yêu cầu khắc phục từ cơ quan thanh tra môi trường', value: 'OPT_NHAC_NHO_MT', isPass: true },
          { label: 'Bị xử phạt hành chính về môi trường (xả thải, khí thải, chất thải rắn)', value: 'OPT_PHAT_HC_MT', isPass: false },
          { label: 'Bị đình chỉ hoạt động một phần do vi phạm môi trường', value: 'OPT_DINH_CHI_MT', isPass: false },
          { label: 'Đang bị điều tra hoặc khởi kiện liên quan đến vi phạm luật môi trường', value: 'OPT_DIEU_TRA_KHOI_KIEN_MT', isPass: false }
        ]
      },
      {
        id: 'f_s6_doi_chieu_vi_pham_3',
        type: 'radio',
        checkItem: 'Đối chiếu với kết quả tìm kiếm thông báo xử phạt công khai hoặc cổng tra cứu thông tin vi phạm',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: verificationAccuracyOptions()
      },
      {
        id: 'f_s6_xu_ly_nuoc_thai',
        type: 'radio',
        checkItem: 'Hiện tại nhà máy đang xử lý nước thải như thế nào? Đạt tiêu chuẩn gì ?',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: '',
        options: [
          { label: 'Chưa có hệ thống xử lý nước thải', value: 'OPT_CHUA_CO_HT', isPass: false },
          { label: 'Đang có kế hoạch xây dựng hệ thống xử lý nước thải', value: 'OPT_DANG_CO_KE_HOACH', isPass: false },
          { label: 'Đấu nối vào hệ thống xử lý nước thải tập trung của khu công nghiệp', value: 'OPT_DAU_NOI_KCN', isPass: true },
          { label: 'Hệ thống xử lý nước thải đạt tiêu chuẩn cột B', value: 'OPT_DAT_COT_B', isPass: true },
          { label: 'Hệ thống xử lý nước thải đạt tiêu chuẩn cột A', value: 'OPT_DAT_COT_A', isPass: true }
        ]
      },
      {
        id: 'f_s6_cong_suat_nuoc_thai',
        type: 'number',
        unit: 'm3/ngày',
        checkItem: 'Công suất hệ thống xử lý nước thải (m3/ngày)',
        locationCode: 'VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ',
        reactionProtocol: ''
      }
    ]
  },

  // =========================================================================
  // VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ
  // =========================================================================
  {
    id: 'b_sec7_label',
    type: 'SECTION_LABEL',
    title: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec7_cong_nghe',
    type: 'INFO_GRID',
    title: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
    titleFormat: 'NONE',
    columns: 1,
    fields: [
      {
        id: 'f_s7_dich_vu_techcoop',
        type: 'checkbox',
        checkItem: 'Doanh nghiệp hiện đang sử dụng các dịch vụ CNTT nào của nền tảng TechCoop? *FDA xác nhận trực tiếp',
        locationCode: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
        reactionProtocol: '',
        options: [
          { label: 'Chưa sử dụng dịch vụ nào', value: 'OPT_CHUA_SU_DUNG', isPass: false },
          { label: 'Truy xuất nguồn gốc', value: 'OPT_TRUY_XUAT', isPass: true },
          { label: 'Hệ thống quản lý chất lượng', value: 'OPT_QMS', isPass: true },
          { label: 'Quản lý vườn trồng', value: 'OPT_VUON_TRONG', isPass: true }
        ]
      },
      {
        id: 'f_s7_nhan_su_cds',
        type: 'radio',
        checkItem: 'Doanh nghiệp có nhân sự phụ trách chuyển đổi số hoặc ứng dụng công nghệ vào vận hành không?',
        locationCode: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
        reactionProtocol: '',
        options: [
          { label: 'Không có', value: 'OPT_KHONG_CO', isPass: false },
          { label: 'Ban lãnh đạo trực tiếp kiêm nhiệm', value: 'OPT_BLD_KIEM_NHIEM', isPass: true },
          { label: 'Nhân sự thuộc bộ phận khác kiêm nhiệm (kế toán, hành chính, kinh doanh)', value: 'OPT_BP_KHAC_KIEM_NHIEM', isPass: true },
          { label: 'Có nhân sự chuyên trách nội bộ tập trung vào IT/công nghệ/chuyển đổi số', value: 'OPT_NHAN_SU_CHUYEN_TRACH', isPass: true },
          { label: 'Có bộ phận hoặc team chuyên trách chuyển đổi số', value: 'OPT_TEAM_CHUYEN_TRACH', isPass: true }
        ]
      },
      {
        id: 'f_s7_he_thong_phan_mem',
        type: 'radio',
        checkItem: 'Doanh nghiệp hiện đang sử dụng hệ thống phần mềm nào để quản lý hoạt động vận hành?',
        locationCode: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
        reactionProtocol: '',
        options: [
          { label: 'Không có hệ thống, quản lý thủ công', value: 'OPT_THU_CONG', isPass: false },
          { label: 'File Excel, không có phần mềm chuyên dụng', value: 'OPT_EXCEL', isPass: true },
          { label: 'Phần mềm chuyên dụng một chức năng (chỉ kế toán, hoặc chỉ kho, không tích hợp)', value: 'OPT_PM_DON_LE', isPass: true },
          { label: 'Phần mềm tích hợp nhiều chức năng (quản lý kho + sản xuất + bán hàng)', value: 'OPT_PM_TICH_HOP', isPass: true }
        ]
      },
      {
        id: 'f_s7_ten_phan_mem',
        type: 'text',
        checkItem: 'Tên phần mềm',
        locationCode: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
        reactionProtocol: ''
      },
      {
        id: 'f_s7_ngan_sach_cntt',
        type: 'radio',
        checkItem: 'Mức ngân sách dự kiến đầu tư cho Công Nghệ Thông Tin (VND/năm)',
        locationCode: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
        reactionProtocol: '',
        options: [
          { label: 'Không có ngân sách', value: 'OPT_KHONG_NGAN_SACH', isPass: false },
          { label: 'Dưới 100tr', value: 'OPT_DUOI_100TR', isPass: true },
          { label: '100-300tr', value: 'OPT_100_300TR', isPass: true },
          { label: '300-700tr', value: 'OPT_300_700TR', isPass: true },
          { label: '>700tr', value: 'OPT_TREN_700TR', isPass: true }
        ]
      },
      {
        id: 'f_s7_chia_se_du_lieu',
        type: 'radio',
        checkItem: 'Doanh nghiệp có sẵn lòng chia sẻ dữ liệu vận hành với TechCoop và bên mua không? Chọn mức độ phù hợp nhất',
        locationCode: 'VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ',
        reactionProtocol: '',
        options: [
          { label: 'Không sẵn sàng chia sẻ dữ liệu vận hành với bên ngoài', value: 'OPT_KHONG_SAN_SANG', isPass: false },
          { label: 'Sẵn sàng chia sẻ khi có yêu cầu cụ thể, từng trường hợp một', value: 'OPT_KHI_CO_YEU_CAU', isPass: true },
          { label: 'Sẵn sàng chia sẻ định kỳ theo thỏa thuận — sản lượng, chất lượng, và/hoặc logistics', value: 'OPT_DINH_KY', isPass: true },
          { label: 'Sẵn sàng tích hợp hệ thống để chia sẻ dữ liệu tự động với TechCoop và bên mua', value: 'OPT_TICH_HOP_TU_DONG', isPass: true }
        ]
      }
    ]
  },

  // =========================================================================
  // VIII. HÌNH ẢNH MINH CHỨNG
  // =========================================================================
  {
    id: 'b_sec8_label',
    type: 'SECTION_LABEL',
    title: 'VIII. HÌNH ẢNH MINH CHỨNG',
    sectionFormat: 'H1',
    titleFormat: 'H1',
    columns: 1,
    fields: []
  },
  {
    id: 'b_sec8_minh_chung',
    type: 'INFO_GRID',
    title: 'VIII. HÌNH ẢNH MINH CHỨNG',
    titleFormat: 'NONE',
    columns: 2,
    fields: [
      {
        id: 'f_s8_anh_check_in',
        type: 'checkbox',
        checkItem: 'Ảnh check-in tại cổng',
        locationCode: 'VIII. HÌNH ẢNH MINH CHỨNG',
        reactionProtocol: '',
        options: evidenceAttachedOptions()
      },
      {
        id: 'f_s8_buoi_lam_viec',
        type: 'checkbox',
        checkItem: 'Buổi làm việc & thành viên',
        locationCode: 'VIII. HÌNH ẢNH MINH CHỨNG',
        reactionProtocol: '',
        options: evidenceAttachedOptions()
      },
      {
        id: 'f_s8_chung_chi',
        type: 'checkbox',
        checkItem: 'Chứng chỉ & chứng nhận',
        locationCode: 'VIII. HÌNH ẢNH MINH CHỨNG',
        reactionProtocol: '',
        options: evidenceAttachedOptions()
      },
      {
        id: 'f_s8_nhat_ky_chung_tu',
        type: 'checkbox',
        checkItem: 'Nhật ký & chứng từ vận hành',
        locationCode: 'VIII. HÌNH ẢNH MINH CHỨNG',
        reactionProtocol: '',
        options: evidenceAttachedOptions()
      }
    ]
  },

  // =========================================================================
  // 9. FOOTER SIGN BLOCK
  // =========================================================================
  {
    id: 'b_sign_fa02',
    type: 'SIGN',
    title: 'Xác nhận đánh giá',
    titleFormat: 'NONE',
    columns: 2,
    fields: [
      {
        id: 'f_sign_nguoi_danh_gia',
        type: 'signature',
        checkItem: 'Người đánh giá',
        locationCode: 'SIGN',
        reactionProtocol: ''
      },
      {
        id: 'f_sign_dai_dien_nha_may',
        type: 'signature',
        checkItem: 'Đại diện nhà máy',
        locationCode: 'SIGN',
        reactionProtocol: ''
      }
    ]
  }
];

async function main() {
  // Apply standardized guidance to all matching fields
  for (const block of layoutBlocks) {
    if (block.fields && Array.isArray(block.fields)) {
      for (const field of block.fields) {
        if (GUIDANCE_MAP[field.id]) {
          field.guidance = GUIDANCE_MAP[field.id];
        }
      }
    }
  }

  const formTemplate = {
    formId: '3S-FA02',
    formName: '3S-FA02',
    formTitle: 'Biểu mẫu đánh giá nhà máy',
    version: 'v0.1',
    status: 'DRAFT',
    pageSize: 'A4',
    isPublic: false,
    defaultFocusMode: false,
    layoutBlocks,
    revisionHistory: []
  };

  console.log('1. Saving FormTemplateISO to forms table (3S-FA02, v0.1)...');
  const savedRow = await saveForm(formTemplate);
  console.log('   Saved form row:', savedRow);

  console.log('2. Syncing workflowFormsData in process 3S-FA...');
  const pool = getPool();
  try {
    const procRes = await pool.query('SELECT * FROM processes WHERE id = $1', ['3S-FA']);
    if (procRes.rows.length > 0) {
      const proc = procRes.rows[0];
      const wfData = proc.workflowFormsData || {};
      wfData['3S-FA02'] = {
        ...(wfData['3S-FA02'] || {}),
        formId: '3S-FA02',
        formTitle: 'Biểu mẫu đánh giá nhà máy',
        version: 'v0.1',
        status: 'DRAFT',
        layoutBlocks,
        revisionHistory: []
      };
      await pool.query(
        'UPDATE processes SET "workflowFormsData" = $1, "lastUpdated" = $2 WHERE id = $3',
        [JSON.stringify(wfData), new Date().toISOString().split('T')[0], '3S-FA']
      );
      console.log('   Synced process 3S-FA workflowFormsData["3S-FA02"] successfully.');
    }
  } finally {
    await pool.end();
  }

  console.log('3. Verifying saved form from database...');
  const verified = await loadForm('3S-FA02', 'v0.1');
  const totalFields = verified.layoutBlocks.reduce((acc, b) => acc + (b.fields ? b.fields.length : 0), 0);
  console.log(`   Verified: ${verified.formId} (${verified.version}) -> ${verified.layoutBlocks.length} blocks, ${totalFields} total fields.`);
}

main().catch((err) => {
  console.error('Error seeding 3S-FA02:', err);
  process.exit(1);
});
