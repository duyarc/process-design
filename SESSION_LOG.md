# Session Log — Bộ nhớ Phiên (Episodic Memory)

> File này là bộ nhớ dài hạn của agent. Đọc trước khi thực thi, cập nhật sau khi
> hoàn thành. Xem `AGENTS.md` Mục 13 để biết quy trình.

---

## Bài học Tích lũy

Danh sách lỗi đã gặp kèm biện pháp phòng ngừa. Agent đọc mục này trước mỗi
phiên thực thi để không lặp lại lỗi cũ.

| # | Nhóm | Lỗi | Biện pháp phòng ngừa | Lần gặp |
|---|---|---|---|---|
| 1 | `CTX` | Viết target string từ trí nhớ, whitespace không khớp file thực tế → marker not found | Luôn `view_file` vùng code cần patch, copy-paste chính xác target. Xem Mục 12.1 | 1 |
| 2 | `TOOL` | Dùng `python -c "..."` với nội dung chứa `=>`, `()` → PowerShell parse error | Ghi ra file `.py` rồi chạy `python path/script.py`. Xem Mục 12.4 | 1 |
| 3 | `TOOL` | Index slicing `c[:start]+new+c[end:]` tìm sai biên end → duplicate closing tags | Dùng `content.replace(exact_old, exact_new, 1)` thay vì index slicing. Xem Mục 12.2 | 3 |
| 4 | `CTX` | Patch boundary overlap: replacement content chồng lấn với code gốc còn lại → stray `)`, duplicate ternary | Verify vùng biên bằng `view_file` sau mỗi patch. Xem Mục 12.1, 12.3 | 2 |
| 5 | `SCOPE` | Gom `npm run build` cuối cùng → lỗi tích lũy nhiều file, khó debug | Chạy `npx tsc --noEmit` sau mỗi file. Xem Mục 12.3 | 1 |
| 6 | `CTX` | Chuyển arrow func `=> (` sang `=> { return (` quên đổi closing `))` thành `); })}` hoặc patch tag ngắn thiếu context độc nhất trong file monolith | Patch đồng thời mở và đóng block hàm; luôn bao gồm ≥ 3 dòng context độc nhất xung quanh closing tag | 1 |
| 7 | `CTX` | Patch chunk quá dài (>100 dòng) trong file monolith lớn dễ bị fuzzy match lệch vị trí hoặc bỏ sót biến | Chia nhỏ patch thành các chunk tập trung (< 40-50 dòng) với context độc nhất. Đã tiến hóa thành quy tắc bắt buộc: Xem Mục 12.6 | 1 |
| 8 | `BLOAT` | Để sót dead code (hàm cũ, props cũ như `handleMoveColumn`) khi thay thế giải pháp mới | Tuân thủ Mục 13.7 Dead-Code Pruning: rà soát toàn bộ call-site và xóa sạch code cũ trong cùng commit | 1 |
| 9 | `BLOAT` | Xóa logic con dùng tham số callback mảng (`fArr` trong `.map((f, fIdx, fArr) => ...)`) nhưng bỏ sót trong chữ ký hàm → TS6133 unused declaration | Khi xóa tính năng hoặc dọn dead code, rà soát luôn tham số của closure bao quanh để lược bỏ biến không còn đọc | 1 |
| 10 | `CTX` | Khi patch code trong khối JS trước `return`, chèn comment JSX `{/* */}` gây syntax error; hoặc patch thẻ con thiếu mốc neo độc nhất | Luôn phân biệt ngữ cảnh JS thuần vs JSX khi viết comment (`//` vs `{/* */}`); dùng thẻ cha làm mốc neo khi patch thẻ con | 1 |

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

### 2026-09-18 — Form Designer & Process Editor: Transparent Form ID Renaming & Workstep Re-linking

**Scope:** 4 files (`formUtils.ts`, `ProcessEditor.tsx`, `FormBuilder.tsx`, `DESIGN_FORM_DESIGNER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 3 (`formUtils.ts`, `ProcessEditor.tsx`, `FormBuilder.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`tsc` x 2 + `vite` 13.16s) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Triển khai thành công giải pháp đổi mã Form ID trong suốt: người dùng chỉ cần gõ mã mới và bấm Save/Publish, form mặc định giữ nguyên liên kết với các công đoạn cũ mà không cần modal xác nhận hay bất kỳ thao tác phụ nào.
- Trích xuất pure utility `renameFormInSteps` trong `formUtils.ts` (Rule 13.8) tự động hoán đổi mã cũ thành mã mới trên toàn bộ mảng `steps`.
- Trong `ProcessEditor.tsx`, tự động đồng bộ `steps`, di chuyển `workflowFormsData`, cập nhật `activeFormToBuild`, và auto-save quy trình cha ngầm.
- Trong `FormBuilder.tsx`, mở khóa ô Form ID khi `!isLocked`, duy trì hiển thị nhánh cây phân cấp 3B liên tục trong lúc gõ, và di chuyển triệt để `window.confirm()` sang `ConfirmModal` (Rule 3).
- Build TypeScript (`tsc`) và Vite production bundle thành công 100% trong 13.16s.

---

### 2026-09-18 — Form Designer: Fix Fallback Hint for Unlinked Standalone Forms

**Scope:** 2 files (`FormBuilder.tsx`, `DESIGN_FORM_DESIGNER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 (`FormBuilder.tsx`) |
| Tổng lượt edit source | 2 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc` + `vite` 10.38s) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Khắc phục lỗi hiển thị vùng Form ID: thay thế điều kiện hẹp `linkedProcessId && !formIdLinked` bằng cấu trúc nhị phân `linkedProcessId && formIdLinked ? (...) : (...)`.
- Đảm bảo MỌI biểu mẫu chưa liên kết (kể cả form mở độc lập từ Dashboard không có `linkedProcessId`) đều hiển thị đúng dòng `[Link2Off] Form chưa liên kết` bên dưới ô input.
- Hiển thị icon `Link2Off` màu xám nhạt kèm tooltip cạnh nhãn Form ID khi form không có quy trình liên kết.
- TypeScript (`tsc`) và Vite bundle hoàn tất 100% trong 10.38s.

---

### 2026-09-18 — Form Designer: Linked Workstep Context & Ultra-Clean Tree Guide Line

**Scope:** 6 files, 116 insertions, 13 deletions (`76661c5`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 25.3 min |
| Thời gian thực thi (Proceed → Push) | 14.2 min |
| Thời gian tổng (Request → Push) | 39.5 min |
| Số file nguồn chỉnh sửa | 4 (`types.ts`, `formUtils.ts`, `FormBuilder.tsx`, `ProcessEditor.tsx`) |
| Tổng lượt edit source | 10 |
| Lượt edit sửa lỗi (rework) | 1 (`BLOAT` TS6133 unused declaration) |
| Số lần build | 7 |
| Lần build đầu thành công? | Không (vướng TS6133 do destructure prop chưa dùng) |
| Số lệnh thất bại | 1 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 1 (Lỗi #9: TS6133 unused declaration) |

**Điểm nổi bật:**
- Nâng cấp hiển thị trạng thái Form ID theo Biến thể 3B tối giản: loại bỏ toàn bộ card lớn, ký tự rườm rà (`↳`), và nhãn thừa ("Công đoạn:", "2 công đoạn").
- Sử dụng đường gióng cây dọc mảnh `1.5px` tạo cấu trúc phân cấp trực quan đồng bộ cho cả form gắn 1 bước lẫn form gắn nhiều bước (Multi-workstep).
- Tách biệt logic trích xuất công đoạn bằng hàm pure utility `extractLinkedWorkSteps` trong `formUtils.ts` (Rule 13.8).
- Gắn tooltip `title={linkedProcessTitle}` vào tên quy trình để hover xem chi tiết mà không làm rối mắt giao diện, triệt tiêu lỗi TS6133.
- Chuẩn hóa thông báo biểu mẫu độc lập thành `"Form chưa liên kết"`.
- Build TypeScript (`tsc`) và Vite production bundle thành công 100% trong 10.48s.

---

### 2026-09-17 — Dashboard & UI/UX: Actions Area Segmented Clusters & Hover-to-Reveal

**Scope:** 5 files, 318 insertions, 163 deletions (`853a0aa`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 5.5 min |
| Thời gian thực thi (Proceed → Push) | 3.8 min |
| Thời gian tổng (Request → Push) | 9.4 min |
| Số file nguồn chỉnh sửa | 2 (`Dashboard.tsx`, `index.css`) |
| Tổng lượt edit source | 6 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Tái cấu trúc 7 nút thao tác thành 3 khối nghiệp vụ chuẩn (Phương án 1): Vận hành (`PenTool`, `History`), In ấn (`Printer`, `FileText`), Thiết kế & Cấu hình (`Edit2`, `Copy`, `SlidersHorizontal` - bọc quyền `design_document`), ngăn cách bằng vách ngăn dọc tinh tế.
- Triển khai cơ chế Hover-to-Reveal thuần CSS (`.dashboard-form-row:hover`), ẩn cụm nút và hiện `⋯` khi idle, triệt tiêu hoàn toàn hiện tượng lặp nút gây rối mắt và bảo đảm 100% Zero Layout Shift.
- Đồng bộ hóa trên Thẻ Lưới (Grid View Card): chia footer thành 2 hàng phân cấp rõ ràng và hỗ trợ hover chuyển đổi độ mờ mượt mà.
- Refactor Ratio đạt 51.3% nhờ thay thế và dọn sạch mã JSX/CSS cũ.
- TypeScript (`npx tsc --noEmit`) và Vite bundle (`npm run build` 8.09s) hoàn tất thành công 100% không lỗi.

---

### 2026-09-17 — Form Operations & Platform Shell: 1-Click Form Duplication in Dashboard Forms Tab

**Scope:** 4 files, 363 insertions, 6 deletions (`1e301b8`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 22.2 min |
| Thời gian thực thi (Proceed → Push) | 4.7 min |
| Thời gian tổng (Request → Push) | 26.9 min |
| Số file nguồn chỉnh sửa | 2 (`Dashboard.tsx`, `formUtils.ts`) |
| Tổng lượt edit source | 8 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Triển khai tính năng nhân bản 1-click tốc độ cao (Fast Duplication) trực tiếp trong Tab Forms của `Dashboard.tsx` (cả List View và Grid View Card).
- Tuyệt đối tuân thủ yêu cầu không modal dialog, không popup gây gián đoạn dòng công việc, phản hồi qua floating Toast banner.
- Thuật toán thông minh `generateNextFormId` trong `formUtils.ts`: tự nhận diện định dạng hậu tố số (`FM-QC-01` -> `FM-QC-02`), tự tăng và kiểm tra chống trùng lặp với toàn bộ form IDs hiện hữu.
- Thuật toán `duplicateFormTemplate`: deep clone toàn bộ layout blocks, tái tạo UUID cho các block/field/table row, ánh xạ lại bảng dữ liệu cell maps (`cellOptionsMap`, `cellPlaceholderMap`), cập nhật block tiêu đề và reset trạng thái về `DRAFT`, phiên bản `v0.1`.
- Tự động gán biểu mẫu mới vào đúng Quy trình và đúng Công đoạn (`step.formNames`, `workflowFormsData`) tương ứng với biểu mẫu gốc.
- Không truyền `oldFormId` khi gọi `POST /api/forms` để triệt để bảo vệ biểu mẫu gốc không bị ghi đè/xóa nhầm trong backend.
- Build TypeScript (`npx tsc --noEmit`) và Vite bundle (`npm run build`) thành công 100% không lỗi.

---

### 2026-09-17 — Form Operations & Print: Dropdown & Custom Other Option Resolution

**Scope:** 3 files, ~40 insertions, ~15 deletions

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 (`formUtils.ts`, `PrintFilledForm.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass ngay lần build đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Khắc phục triệt để lỗi rò rỉ chuỗi tiền tố kỹ thuật `__other__:<text>` trên bản in `PrintFilledForm.tsx`.
- Chuẩn hóa hàm thuần túy `formatOptionDisplay` trong `formUtils.ts`: tự động chuẩn hóa nhãn `"Khác: [Nội dung]"` với đúng 1 dấu hai chấm, hỗ trợ tra cứu kép `value` và `label`.
- Bổ sung nhánh render riêng cho `f.type === 'select'` trong `INFO_GRID` và cơ chế phòng vệ chiều sâu (Defense-in-depth) tại nhánh mặc định.
- Đồng bộ hóa tra cứu nhãn cho trường Dropdown trong `CHECKLIST_TABLE` và `TABLE`, đồng thời loại bỏ lỗi lặp dấu hai chấm (`::`) trong Radio/Checkbox.
- 100% build pass ngay lần đầu (tsc & vite build 10.00s).

---

### 2026-09-14 — Form Operations & Print: Unified Table Cell Custom Options Resolution

**Scope:** 7 files, ~45 insertions, ~30 deletions

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 6 (`formUtils.ts`, `PrintFilledForm.tsx`, `ProcessReader.tsx`, `FormFiller.tsx`, `PrintBlankForm.tsx`, `FormBuilder.tsx`) |
| Tổng lượt edit source | 10 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 7 (6 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass ngay lần build đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Trích xuất hàm thuần túy `getEffectiveCellOptions` vào `formUtils.ts` hỗ trợ Dual-Compatibility key lookup (`${rowId}_${colId}` phẳng và `[rowId]?.[colId]` lồng).
- Khắc phục lỗi lệch key `cellOptionsMap?.[row.id]?.[col.id]` trong `PrintFilledForm.tsx` và `ProcessReader.tsx`, đảm bảo in chính xác options và checkmark của từng ô bảng.
- Đồng bộ hóa 100% cả 5 components (`PrintFilledForm`, `PrintBlankForm`, `FormFiller`, `ProcessReader`, `FormBuilder`).
- Bổ sung hiển thị `col.checkboxLayout === '2-column'` cho Radio cell trong `PrintFilledForm.tsx`.
- 100% build pass ngay lần đầu (tsc & vite build 14.76s).

---

### 2026-09-14 — FormBuilder & ReportBuilder: Simplify SECTION_LABEL Description Placeholder Text

**Scope:** 2 files, 2 insertions, 2 deletions

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 (`FormBuilder.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 2 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass ngay lần build đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Tinh gọn văn bản gợi ý (placeholder) của trường mô tả/ghi chú hướng dẫn trong khối phân đoạn `SECTION_LABEL`.
- Loại bỏ phần chú thích định dạng markdown trong ngoặc đơn `(hỗ trợ **in đậm**, *in nghiêng*, __gạch chân__)`, đưa về định dạng ngắn gọn: `"Gõ mô tả hoặc ghi chú hướng dẫn..."`.
- Đồng bộ chuẩn hóa trên cả `FormBuilder.tsx` và `ReportBuilder.tsx`.
- 100% build pass ngay lần đầu (tsc & vite build 10.67s).

---

### 2026-09-14 — FormFiller & Design System: Standardize Native Placeholder Formatting & Multi-line Auto-Height

**Scope:** 5 files, ~50 insertions, ~5 deletions

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 3 (`textFormatter.tsx`, `index.css`, `FormFiller.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass ngay lần build đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Triển khai định dạng Native Placeholder tối đa theo W3C HTML: không dùng DOM overlay giả lập, tránh phình to DOM và rủi ro trôi vị trí trên mobile.
- Hàm thuần túy `stripMarkdownTokens` bóc tách sạch các cú pháp Markdown thô (`*`, `_`, `~`, `<u>`), bảo toàn xuống dòng `\n`.
- Chuẩn hóa CSS `::placeholder` toàn hệ thống với `font-style: italic`, `#94a3b8`, `opacity: 0.9`.
- Tự động mở rộng chiều cao và số dòng khởi tạo cho `AutoResizingTextarea` khi placeholder có nhiều dòng.

---

### 2026-09-14 — FormFiller Bugfix: Preserving Spacebar Input in Custom "Other" Option Fields

**Scope:** 3 files, 31 insertions, 47 deletions (`05f1eec`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 3.8 min |
| Thời gian lập plan (Request → Proceed) | 2.9 min |
| Thời gian thực thi (Proceed → Push) | 0.9 min |
| Số file nguồn chỉnh sửa | 1 (`formUtils.ts`) |
| Tổng lượt edit source | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite) |
| Lần build đầu thành công? | Có |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Sửa triệt để lỗi không gõ được phím Space trong ô nhập "Khác" (Select dropdown, Radio, Checkbox).
- Loại bỏ lệnh `.trim()` trong `encodeOtherValue` để bảo toàn khoảng trắng tự nhiên trong suốt quá trình người dùng đang nhập liệu trong React Controlled Component.
- Chuẩn hóa `.trim()` tại `formatOptionDisplay` để đảm bảo báo cáo và bản in không bị khoảng trắng thừa.
- Tốc độ thực thi: 0.9 phút, 1 edit dứt điểm, 100% build pass lần đầu.
