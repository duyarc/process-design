/**
 * Centralized guidance mapping for Form 3S-FA02 ('Biểu mẫu đánh giá nhà máy').
 * Standardized across 14 key indicators and sections.
 */

const GUIDANCE_MAP = {
  // 1. Sản lượng cont/tháng
  f_s2_san_luong_cont: 
`**Định nghĩa & Cách tính:**
• Là số container thành phẩm thực tế xuất xưởng trung bình mỗi tháng (bao gồm cả cont 20' và 40'), tính bằng tổng số cont xuất trong 12 tháng chia cho 12.
**Kiểm tra tính hợp lý:**
• Tỷ lệ giữa [Sản lượng tấn/tháng] chia cho [Số cont/tháng] phải nằm trong khoảng tải trọng cho phép theo quy chuẩn đóng gói ngành hàng (thường từ 14 – 28.5 tấn/container).`,

  // 2. Sản lượng tấn/tháng
  f_s2_san_luong_tan:
`**Định nghĩa & Cách tính:**
• Là tổng khối lượng thành phẩm thương mại thực tế xuất xưởng trung bình mỗi tháng (tính theo tấn thành phẩm hoàn thiện, không tính khối lượng nguyên liệu thô đầu vào), bằng tổng sản lượng 12 tháng chia cho 12.
**Tài liệu đối chứng:**
• Báo cáo Xuất - Nhập - Tồn kho thành phẩm 12 tháng, Báo cáo tổng hợp sản lượng tháng của bộ phận sản xuất, Tờ khai hải quan xuất khẩu hoặc Báo cáo doanh thu/Hóa đơn bán hàng.
**Kiểm tra tính hợp lý:**
• Sản lượng thực tế phải nhỏ hơn hoặc bằng Công suất thiết kế.`,

  // 3. Công suất thiết kế
  f_s2_cong_suat_thiet_ke:
`**Định nghĩa & Cách tính:**
• Là sản lượng thành phẩm đầu ra tối đa nhà máy có thể đạt được trong 1 tháng (tính theo tấn thành phẩm hoàn thiện, không tính nguyên liệu thô), xác định theo năng lực thiết bị chính khi chạy đủ ca thiết kế và đủ nguyên liệu.
**Tài liệu đối chứng:**
• Giấy phép môi trường / Báo cáo ĐTM, Giấy chứng nhận đầu tư, hoặc Hồ sơ thông số kỹ thuật của các máy móc chính trong xưởng.
**Kiểm tra tính hợp lý:**
• Công suất thiết kế phải lớn hơn hoặc bằng Sản lượng thực tế trung bình hàng tháng (tấn/tháng).`,

  // 4. Sản lượng cam kết Techcoop
  f_s2_san_luong_cam_ket:
`**Định nghĩa & Cách tính:**
• Là khối lượng thành phẩm tối đa nhà máy có thể cam kết ưu tiên cung ứng cho TechCoop, tính dựa trên dư địa công suất (bằng Công suất thiết kế trừ đi sản lượng đã cam kết cho các khách hàng khác).
**Tài liệu đối chứng:**
• Kế hoạch phân bổ sản lượng năm, hoặc Văn bản đề xuất/Biên bản ghi nhớ hợp tác (MOU) với TechCoop.
**Kiểm tra tính hợp lý:**
• Sản lượng cam kết cho TechCoop cộng với sản lượng đang bán cho các đối tác khác không vượt quá Công suất thiết kế (trừ trường hợp nhà máy có phương án tăng ca hoặc có cơ sở liên kết đã được thẩm định).`,

  // 5. Năm vận hành
  f_s2_nam_van_hanh:
`**Định nghĩa:**
• Là năm nhà máy chính thức hoàn thành nghiệm thu xây dựng/lắp đặt và bắt đầu đi vào hoạt động sản xuất thương mại.
**Kiểm tra tính hợp lý:**
• Năm vận hành phải tương thích với năm lắp đặt của các máy móc trong bảng [Danh sách thiết bị chính].`,

  // 6. Tỷ lệ CM/PM
  f_s2_ty_le_cm_pm:
`**Định nghĩa & Cách tính:**
• Tính bằng tổng số giờ sửa chữa do hư hỏng đột xuất (CM) chia cho tổng số giờ bảo dưỡng định kỳ theo kế hoạch (PM) nhân với 100%, căn cứ theo biên bản/nhật ký bảo trì trong năm.
**Tài liệu đối chứng:**
• Sổ nhật ký bảo trì thiết bị và các biên bản sửa chữa, bảo dưỡng xưởng.
**Kiểm tra tính hợp lý:**
• Tỷ lệ CM/PM tiêu chuẩn thường không vượt quá 25%. Nếu tỷ lệ cao bất thường, phải kiểm tra lại tình trạng máy móc cũ/mới trong bảng [Danh sách thiết bị chính] và [Thời gian dừng máy hàng tháng].`,

  // 7. Thời gian dừng máy
  f_s2_gio_dung_may:
`**Định nghĩa & Cách tính:**
• Là số giờ dây chuyền phải ngừng sản xuất trung bình mỗi tháng (chủ yếu do sự cố hỏng hóc máy móc, mất điện hoặc bảo trì), tính bằng tổng thời gian dừng máy trong năm chia cho 12 tháng.
**Tài liệu đối chứng:**
• Nhật ký vận hành máy, Sổ ghi nhận dừng máy hoặc Báo cáo của xưởng.
**Kiểm tra tính hợp lý:**
• Thời gian dừng máy phải tương thích với mức độ cũ/mới của thiết bị và [Tỷ lệ CM/PM].`,

  // 8. Tỷ trọng 3 NCC lớn nhất
  f_s2_ty_trong_3_ncc:
`**Định nghĩa & Cách tính:**
• Tính bằng tổng sản lượng (hoặc giá trị) nguyên liệu nhập từ 3 nhà cung cấp lớn nhất chia cho tổng nguyên liệu đầu vào của toàn xưởng trong năm nhân với 100%.
**Tài liệu đối chứng:**
• Sổ theo dõi nhập mua nguyên liệu hoặc Báo cáo mua hàng năm.
**Kiểm tra tính hợp lý:**
• Tỷ lệ từ 0 đến 100%. Nếu vượt quá 80%, cần ghi nhận rủi ro phụ thuộc nguồn cung và kiểm tra tính độc lập giữa các nhà cung cấp này.`,

  // 9. Số cont khiếu nại
  f_s3_so_cont_khieu_nai:
`**Định nghĩa & Cách tính:**
• Là số lượng container thành phẩm bị khách hàng khiếu nại trung bình mỗi tháng (theo phạm vi đã chọn ở câu [Định nghĩa khiếu nại]), tính bằng tổng số cont phát sinh khiếu nại trong 12 tháng gần nhất chia cho 12. Nếu xưởng không thống kê theo cont, quy đổi từ số tấn khiếu nại sang cont tương ứng.
**Tài liệu đối chứng:**
• Sổ theo dõi khiếu nại khách hàng (Complaint Log), Báo cáo hành động khắc phục phòng ngừa (CAPA), hoặc Biên bản bồi thường/giảm trừ công nợ trong năm.
**Kiểm tra tính hợp lý:**
• Số cont khiếu nại hàng tháng phải nhỏ hơn nhiều so với [Sản lượng cont/tháng] ở Phần II (thông lệ ngành xuất khẩu thường kiểm soát tỷ lệ khiếu nại dưới 1% – 2% tổng sản lượng xuất).`,

  // 10. Số cont giao trễ
  f_s4_so_cont_giao_tre:
`**Định nghĩa & Cách tính:**
• Là số lượng container giao không đúng hạn trung bình mỗi tháng (căn cứ theo chuẩn đã chọn ở câu [Định nghĩa đơn hàng đúng hạn]: giao trễ ngày cam kết, giao thiếu số lượng hoặc giao sai quy cách), tính bằng tổng số cont giao trễ trong 12 tháng gần nhất chia cho 12.
**Tài liệu đối chứng:**
• Báo cáo theo dõi tiến độ giao hàng (Delivery Tracking Report), Sổ nhật ký Logistics.
**Kiểm tra tính hợp lý:**
• Tỷ lệ giao trễ cao cần đối chiếu với các nguyên nhân gián đoạn như [Thời gian dừng máy] hoặc thiếu hụt nguyên liệu.`,

  // 11. Nhóm 4 trường Lead-time
  f_s4_thoi_gian_giao_thong_thuong:
`**Định nghĩa & Mốc tính:**
• Là các tham số thống kê về số ngày thực hiện đơn hàng (Lead-time) của dòng sản phẩm chủ lực trong năm, tính từ lúc xác nhận đơn hàng đến khi hàng sẵn sàng xuất xưởng (Cargo Ready Date):
  - [Thuận lợi]: Thời gian giao hàng ngắn nhất thực tế ghi nhận được (Min lead-time).
  - [Bất lợi]: Thời gian giao hàng dài nhất thực tế ghi nhận được (Max lead-time).
  - [Thông thường]: Thời gian giao hàng trung bình của các đơn hàng (Average lead-time).
  - [Cam kết HĐ]: Thời hạn giao hàng chuẩn quy định trên hợp đồng thương mại.
**Tài liệu đối chứng:**
• Báo cáo thống kê Lead-time của phòng kế hoạch/Logistics, hoặc Bảng theo dõi ngày nhận PO và ngày hoàn thành đơn hàng trong năm.
**Kiểm tra tính hợp lý & Đánh giá độ ổn định:**
• Độ biến thiên (khoảng cách giữa thời gian dài nhất và ngắn nhất) phản ánh mức độ ổn định trong vận hành của nhà máy; khoảng chênh lệch càng hẹp thì năng lực kiểm soát sản xuất và độ tin cậy giao hàng càng cao.`,

  f_s4_thoi_gian_giao_bat_loi:
`**Định nghĩa & Mốc tính:**
• Thời gian giao hàng dài nhất thực tế ghi nhận được (Max lead-time) của dòng sản phẩm chủ lực trong năm.
**Tài liệu đối chứng:** Báo cáo thống kê Lead-time hoặc Bảng theo dõi ngày nhận PO và ngày hoàn thành đơn hàng trong năm.
**Đánh giá độ ổn định:** Độ biến thiên giữa thời gian dài nhất và ngắn nhất phản ánh mức độ ổn định vận hành và chuỗi cung ứng của nhà máy.`,

  f_s4_thoi_gian_giao_thuan_loi:
`**Định nghĩa & Mốc tính:**
• Thời gian giao hàng ngắn nhất thực tế ghi nhận được (Min lead-time) của dòng sản phẩm chủ lực trong năm khi có đầy đủ điều kiện sản xuất.
**Tài liệu đối chứng:** Báo cáo thống kê Lead-time hoặc Bảng theo dõi ngày nhận PO và ngày hoàn thành đơn hàng trong năm.`,

  f_s4_thoi_gian_giao_cam_ket:
`**Định nghĩa & Mốc tính:**
• Thời hạn giao hàng chuẩn quy định trên hợp đồng thương mại ký với khách hàng.
**Tài liệu đối chứng:** Hợp đồng mua bán chuẩn hoặc thỏa thuận khung với khách hàng.`,

  // 12. Nhóm 2 trường Nhân sự chủ chốt
  f_s5_tong_nhan_su_chu_chot:
`**Định nghĩa & Phạm vi xác định:**
• [Nhân sự chủ chốt]: Là các nhân sự giữ vai trò quản lý hoặc kỹ thuật cốt lõi tại 3 bộ phận Sản xuất, Thu mua và QC/QA (bao gồm Trưởng/Phó bộ phận, Kỹ sư công nghệ/QC chính, và Quản đốc/Tổ trưởng xưởng). Không tính công nhân trực tiếp, lao động thời vụ hoặc thử việc.
• [Số nghỉ việc 12 tháng]: Tính tất cả các trường hợp nghỉ việc, chấm dứt hợp đồng hoặc điều chuyển khỏi 3 bộ phận trên trong 12 tháng qua.
**Tài liệu đối chứng:**
• Sơ đồ tổ chức (Org Chart), Danh sách trích nộp BHXH hoặc Báo cáo biến động nhân sự năm của phòng Nhân sự.
**Kiểm tra tính hợp lý & Đánh giá rủi ro:**
• Tỷ lệ nghỉ việc của nhân sự chủ chốt (Số nghỉ / Tổng số × 100%) nếu vượt quá 20% – 30%/năm là dấu hiệu báo động về độ bất ổn định trong bộ máy điều hành, dễ gây đứt gãy quy trình kiểm soát chất lượng.`,

  f_s5_so_nghi_viec_12_thang:
`**Định nghĩa:**
• Tổng số nhân sự chủ chốt (thuộc 3 bộ phận Sản xuất, Thu mua, QC/QA) đã nghỉ việc hoặc điều chuyển công tác trong 12 tháng qua.
**Tài liệu đối chứng:**
• Quyết định chấm dứt hợp đồng lao động, Báo cáo biến động nhân sự hoặc Danh sách giảm đóng BHXH.`,

  // 13. Công suất xử lý nước thải
  f_s6_cong_suat_nuoc_thai:
`**Định nghĩa & Cách tính:**
• Là lưu lượng xả thải tối đa hệ thống có thể xử lý đạt chuẩn trong 24 giờ. Trường hợp nhà máy đấu nối vào trạm xử lý tập trung của KCN, ghi theo hạn mức lưu lượng xả thải tối đa được KCN cấp phép tiếp nhận.
**Tài liệu đối chứng:**
• Giấy phép Môi trường (hoặc Báo cáo ĐTM/Đề án BVMT đã phê duyệt), hoặc Hợp đồng đấu nối và xử lý nước thải với đơn vị quản lý hạ tầng KCN.
**Kiểm tra tính hợp lý:**
• Bằng 0 nếu chưa có hệ thống xử lý hoặc xả thải tự nhiên; công suất thiết kế hệ thống phải đáp ứng đủ lưu lượng nước thải phát sinh thực tế theo quy mô công suất chế biến của nhà máy.`
};

module.exports = { GUIDANCE_MAP };
