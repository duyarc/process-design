# Project Rules & Customizations

- **Quy tắc Tối ưu hóa Mô hình (Model Selection Optimization)**:
  - Trước khi thực hiện bất kỳ tác vụ hoặc viết đoạn mã nguồn nào, Agent **bắt buộc** phải đánh giá xem mô hình hiện tại đang được chọn có phải là mô hình tối ưu nhất cho tác vụ đó hay không.
  - **Phân loại mô hình tối ưu**:
    - **Claude Sonnet 4.6 (Thinking)**: Dành cho lập trình logic lõi, cấu trúc dữ liệu phức tạp, cơ chế bảo mật (phân quyền RBAC, Auth, Route Guard), tái cấu trúc (refactor) các tệp mã nguồn lớn, hoặc giải quyết các lỗi biên dịch khó.
    - **Gemini 3.5 Flash (Medium/High)**: Dành cho code CSS/layout giao diện tĩnh, viết truy vấn SQL / Migration, chạy lệnh terminal (git push, npm run build), kiểm thử và thảo luận/giải đáp thông tin.
  - **Hành động bắt buộc**: Nếu mô hình hiện tại đang chọn không tối ưu (ví dụ: đang dùng Flash để viết logic bảo mật, hoặc đang dùng Sonnet để chạy git/npm build), Agent **PHẢI DỪNG LẠI** và gửi yêu cầu người dùng chuyển đổi mô hình trên chat UI trước khi tiếp tục xử lý.
