# Project Rules & Customizations

- **Quy tắc Tối ưu hóa Mô hình (Model Selection Optimization)**:
  - Trước khi thực hiện bất kỳ tác vụ hoặc viết đoạn mã nguồn nào, Agent **bắt buộc** phải đánh giá xem mô hình hiện tại đang được chọn có phải là mô hình tối ưu nhất cho tác vụ đó hay không.
  - **Phân loại mô hình tối ưu**:
    - **Claude Sonnet 4.6 (Thinking)**: Dành cho lập trình logic lõi, cấu trúc dữ liệu phức tạp, cơ chế bảo mật (phân quyền RBAC, Auth, Route Guard), tái cấu trúc (refactor) các tệp mã nguồn lớn, hoặc giải quyết các lỗi biên dịch khó.
    - **Gemini 3.5 Flash (Medium/High)**: Dành cho code CSS/layout giao diện tĩnh, viết truy vấn SQL / Migration, chạy lệnh terminal (git push, npm run build), kiểm thử và thảo luận/giải đáp thông tin.
  - **Hành động bắt buộc**: Nếu mô hình hiện tại đang chọn không tối ưu (ví dụ: đang dùng Flash để viết logic bảo mật, hoặc đang dùng Sonnet để chạy git/npm build), Agent **PHẢI DỪNG LẠI** và gửi yêu cầu người dùng chuyển đổi mô hình trên chat UI trước khi tiếp tục xử lý.

- **Quy tắc Cập nhật Tài liệu Thiết kế (Design Document Maintenance)**:
  - Tệp `DESIGN_PROCESS_DESIGNER.md` là tài liệu thiết kế chính thức của module **Process Designer**.
  - **Hành động bắt buộc**: Khi bất kỳ Agent nào thực hiện thay đổi có nghĩa lên các tệp thuộc module này — bao gồm `src/components/ProcessEditor.tsx`, `src/components/ProcessReader.tsx`, `src/components/BpmnModelerComponent.tsx`, `src/components/BpmnViewerComponent.tsx`, `src/utils/bpmnXmlGenerator.ts` — Agent **PHẢI**:
    1. Cập nhật phần bị ảnh hưởng trong `DESIGN_PROCESS_DESIGNER.md` (ví dụ: data model, flows, interface contracts, technical debt).
    2. Cập nhật trường **Last Verified** ở Header Block thành ngày hiện tại.
    3. Thêm một dòng mới vào mục **Change Log** cuối tài liệu, ghi rõ ngày, conversation ID, và nội dung thay đổi.
  - Quy tắc này áp dụng cho mọi thay đổi: tính năng mới, sửa lỗi, refactor, hay điều chỉnh UI.

- **Quy tắc Cập nhật Tài liệu Thiết kế (Design Document Maintenance)**:
  - Tệp `DESIGN_FORM_DESIGNER.md` là tài liệu thiết kế chính thức của module **Form Designer**.
  - **Hành động bắt buộc**: Khi bất kỳ Agent nào thực hiện thay đổi có nghĩa lên các tệp thuộc module này — bao gồm `src/components/FormBuilder.tsx`, `src/components/print/PrintBlankForm.tsx` — Agent **PHẢI**:
    1. Cập nhật phần bị ảnh hưởng trong `DESIGN_FORM_DESIGNER.md` (ví dụ: data model, flows, interface contracts, technical debt).
    2. Cập nhật trường **Last Verified** ở Header Block thành ngày hiện tại.
    3. Thêm một dòng mới vào mục **Change Log** cuối tài liệu, ghi rõ ngày, conversation ID, và nội dung thay đổi.
  - Quy tắc này áp dụng cho mọi thay đổi: tính năng mới, sửa lỗi, refactor, hay điều chỉnh UI.

- **Quy tắc Cập nhật Tài liệu Thiết kế (Design Document Maintenance)**:
  - Tệp `DESIGN_FORM_OPERATIONS.md` là tài liệu thiết kế chính thức của module **Form Operations**.
  - **Hành động bắt buộc**: Khi bất kỳ Agent nào thực hiện thay đổi có nghĩa lên các tệp thuộc module này — bao gồm `src/components/FormFiller.tsx`, `src/components/FormManager.tsx`, `src/components/SubmissionManager.tsx`, `src/components/print/PrintRecord.tsx` — Agent **PHẢI**:
    1. Cập nhật phần bị ảnh hưởng trong `DESIGN_FORM_OPERATIONS.md` (ví dụ: data model, flows, interface contracts, technical debt).
    2. Cập nhật trường **Last Verified** ở Header Block thành ngày hiện tại.
    3. Thêm một dòng mới vào mục **Change Log** cuối tài liệu, ghi rõ ngày, conversation ID, và nội dung thay đổi.
  - Quy tắc này áp dụng cho mọi thay đổi: tính năng mới, sửa lỗi, refactor, hay điều chỉnh UI.

- **Quy tắc Cập nhật Tài liệu Thiết kế (Design Document Maintenance)**:
  - Tệp `DESIGN_PLATFORM_SHELL.md` là tài liệu thiết kế chính thức của module **Platform Shell**.
  - **Hành động bắt buộc**: Khi bất kỳ Agent nào thực hiện thay đổi có nghĩa lên các tệp thuộc module này — bao gồm `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/LoginPage.tsx`, `src/components/UserManagement.tsx`, `src/context/AuthContext.tsx` — Agent **PHẢI**:
    1. Cập nhật phần bị ảnh hưởng trong `DESIGN_PLATFORM_SHELL.md` (ví dụ: data model, flows, interface contracts, technical debt).
    2. Cập nhật trường **Last Verified** ở Header Block thành ngày hiện tại.
    3. Thêm một dòng mới vào mục **Change Log** cuối tài liệu, ghi rõ ngày, conversation ID, và nội dung thay đổi.
  - Quy tắc này áp dụng cho mọi thay đổi: tính năng mới, sửa lỗi, refactor, hay điều chỉnh UI.

- **Quy tắc Tuân thủ Master Design (UI/UX Compliance)**:
  - Khi tạo hoặc sửa đổi giao diện (UI), Agent **bắt buộc** phải sử dụng các biến CSS (`var(--primary)`, `var(--neutral-bg)`, v.v.) và các utility class lõi (`.paper-card`, `.btn`) đã được định nghĩa trong `src/index.css`.
  - **Cấm** sử dụng inline styles với mã màu hardcode (ví dụ: `#10a3a3`) trừ trường hợp bất khả kháng. Luôn tham chiếu đến `DESIGN_UI_UX.md`.

- **Quy tắc Cập nhật Master Design (UI/UX Evolution)**:
  - Nếu Agent thêm một biến CSS global mới, một utility class mới vào `index.css`, hoặc thay đổi đáng kể về mặt thẩm mỹ, Agent **bắt buộc** phải cập nhật file `DESIGN_UI_UX.md` và ghi log vào phần Change Log của file đó.

- **Quy tắc Lan truyền Thiết kế (UI/UX Propagation)**:
  - Khi Agent thay đổi **cấu trúc HTML/cách dùng class** của một UI pattern chuẩn (ví dụ: cấu trúc thẻ của form group, hoặc class của button), Agent **bắt buộc** phải quét (scan) toàn bộ mã nguồn và cập nhật cấu trúc mới đó cho tất cả các components tương tự để đảm bảo tính đồng nhất trên toàn hệ thống.

- **Quy tắc Cập nhật Master Index (README Maintenance)**:
  - Tệp `README.md` đóng vai trò là Master Index và Kiến trúc Hệ thống Tổng thể (System Architecture Overview).
  - **Hành động bắt buộc**: Nếu Agent thêm một module chức năng mới vào dự án, thay đổi Tech Stack (ví dụ cài thêm thư viện lõi), hoặc thay đổi luồng khởi chạy dự án (setup/run commands), Agent **PHẢI** cập nhật `README.md` tương ứng để đảm bảo tài liệu onboarding luôn chính xác.

- **Quy tắc Viết Kế hoạch Thực thi (Flash-Executable Implementation Plan)**:
  - Khi được yêu cầu lập kế hoạch cho một tác vụ lớn (multi-file refactor, schema migration, hoặc bất kỳ thay đổi nào liên quan đến nhiều write site), Agent **bắt buộc** phải viết kế hoạch theo định dạng **Flash-Executable** để tối ưu hóa quota.
  - **Nguyên tắc cốt lõi**:
    - **Sonnet làm kế hoạch, Flash làm thực thi**: Mô hình reasoning mạnh (Sonnet) chỉ được dùng để đọc, phân tích, thiết kế và viết kế hoạch chi tiết. Mô hình nhanh (Flash) thực thi từng bước mà không cần suy luận.
    - **Mỗi task là một surgical edit độc lập**: Mỗi bước trong kế hoạch chỉ chạm vào **một file**, có **số dòng cụ thể**, và cung cấp đầy đủ `TargetContent` (đoạn code cần tìm) và `ReplacementContent` (đoạn code thay thế).
    - **Không yêu cầu inference**: Flash không được phép tự suy luận "cần thay đổi gì". Tất cả logic đã được nhúng vào nội dung kế hoạch.
    - **Verify sau mỗi Phase**: Sau mỗi nhóm task (Phase), Agent thực thi **bắt buộc** chạy `npm run build` để xác nhận zero lỗi TypeScript trước khi sang Phase tiếp theo.
  - **Cấu trúc bắt buộc của một Flash-Executable Plan**:
    ```
    ## Phase N — [Tên phase]
    **File:** [đường dẫn file với link]

    ### Task N.X — [Mô tả ngắn]
    **Find** (exact content):
    [đoạn code cần tìm — PHẢI khớp chính xác với nội dung file]
    **Replace with:**
    [đoạn code thay thế hoàn chỉnh]
    ```
  - **Khi nào áp dụng**: Bất cứ khi nào tác vụ có **3+ write site** trên nhiều file, hoặc khi người dùng yêu cầu tiết kiệm quota Sonnet.
  - **Giới hạn**: Kế hoạch này **sẽ hết hạn nếu file bị chỉnh sửa** giữa lúc lập kế hoạch và thực thi. Agent thực thi phải kiểm tra số dòng trước khi áp dụng nếu session cách nhau quá 1 ngày.
  - **Khi Flash gặp lỗi build**: Agent Flash **PHẢI DỪNG LẠI** và yêu cầu người dùng chuyển sang Sonnet để debug — không được tự ý sửa lỗi TypeScript phức tạp bằng Flash.
