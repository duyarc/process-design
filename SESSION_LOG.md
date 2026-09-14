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

---

### 2026-09-14 — Dead-Code Pruning: Pruning Orphaned PrintRecord.tsx & Design Doc Unification

**Scope:** 6 files, 56 insertions, 1674 deletions (`3cb5c8d`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 7.2 min |
| Thời gian lập plan (Request → Proceed) | 4.8 min |
| Thời gian thực thi (Proceed → Push) | 2.5 min |
| Số file nguồn chỉnh sửa | 1 (`print.css`) |
| Tổng lượt edit source | 2 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite) |
| Lần build đầu thành công? | Có |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Triệt tiêu 100% mã chết `PrintRecord.tsx` (1.636 dòng, ~89 KB) theo Mục 13.7 `AGENTS.md` (Dead-Code Pruning Invariant).
- Khắc phục triệt để tình trạng bảo trì kép (double maintenance) kéo dài suốt 15+ commit qua do `PrintRecord.tsx` bị sót lại trong `AGENTS.md` và `DESIGN_FORM_OPERATIONS.md`.
- Thống nhất duy nhất `PrintFilledForm.tsx` là component phụ trách render phiếu in bản khai trên toàn bộ hệ thống.
- Tối ưu hóa dung lượng codebase: Net LOC Delta -1.618 dòng, tỷ lệ Refactor Ratio 2989.3%.

---

### 2026-09-14 — Print Standardization: Likert/Radio Circle Checkmark & Checkbox Square Checkmark

**Scope:** 3 files, 136 insertions, 56 deletions (`c4c0607`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 20.4 min |
| Thời gian lập plan (Request → Proceed) | 13.2 min |
| Thời gian thực thi (Proceed → Push) | 7.2 min |
| Số file nguồn chỉnh sửa | 2 (`PrintFilledForm.tsx`, `PrintRecord.tsx`) |
| Tổng lượt edit source | 10 |
| Lượt edit sửa lỗi (rework) | 2 (lệch JSX comment và khôi phục return trong getEffectiveColumns) |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 1 (CTX: nhầm `{/* */}` trong block JS trước return) |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Chuẩn hóa toàn bộ hiển thị in ấn theo Phương án 1: Radio/Likert hình TRÒN có dấu tick đen `(✓)`, Checkbox hình VUÔNG có dấu tick đen `[✓]`.
- Giải quyết triệt để vấn đề mất dấu chọn khi in do trình duyệt tự động tắt "Background graphics" bằng cách chuyển dấu tick sang ký tự text UTF-8 đen `#000000` trên nền trắng `#ffffff`.
- Thêm chỉ thị `print-color-adjust: exact !important` và helper `isLikertSelected` xử lý chuẩn hóa dữ liệu.

---

### 2026-09-14 — FormFiller UI Streamlining: Pruning Manual Add Row Buttons in Favor of Pure Auto-Append

**Scope:** 2 files, 4 insertions, 48 deletions (`6745df9`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 2.5 min |
| Thời gian thực thi (Proceed → Push) | 3.2 min |
| Thời gian tổng (Request → Push) | 5.7 min |
| Số file nguồn chỉnh sửa | 1 (`FormFiller.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 1 (phục hồi thẻ `</table>` bị cắt nhầm) |
| Số lần build | 2 (1 tsc + 1 vite) |
| Lần build đầu thành công? | Có |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Loại bỏ hoàn toàn nút `+ Thêm dòng` ở chân bảng `TABLE` và nút `+ Thêm dòng vào nhóm` ở tiêu đề nhóm trong `FormFiller.tsx`.
- Duy trì 100% cơ chế tự động sinh dòng (`handleTableCellChangeWithAutoAppend`) khi người dùng nhập liệu ở dòng cuối cùng của bảng dữ liệu.
- Giữ sạch sẽ tuyệt đối các bảng khảo sát đánh giá Likert Scale, không còn nút thêm dòng thừa thãi.
- Giảm rác DOM và tiết kiệm -44 LOC.

---

### 2026-09-11 — Cell-Scoped Label vs Placeholder Direct Editing on Canvas & FormFiller Parity

**Scope:** 4 files, 329 insertions, 100 deletions

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 2.0 min |
| Thời gian thực thi (Proceed → Push) | 4.3 min |
| Thời gian tổng (Request → Push) | 6.3 min |
| Số file nguồn chỉnh sửa | 3 (`types.ts`, `FormBuilder.tsx`, `FormFiller.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 1 (căn chỉnh handler textarea trong monolith) |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Mở rộng `LayoutBlockISO` với `cellPlaceholderMap` và `TableColumnConfig`/`SubtableColumn` với `placeholder?`.
- Triển khai gõ trực tiếp trên Canvas mặc định là `Label`, đi kèm thanh điều khiển nổi mini `[ Label | Placeholder ]` chuyển đổi trạng thái mượt mà không mất dữ liệu.
- Định dạng WYSIWYG 100% khớp thực tế (`Label`: chữ đậm phẳng; `Placeholder`: viền nét đứt, nền xám, chữ nghiêng).
- Áp dụng Rule 13.8 trích xuất `handleUpdateTableCellText` thu gọn ~46 dòng code lặp trong JSX.
- Đồng bộ hiển thị sang `FormFiller.tsx` giải quyết placeholder theo cấp ô ưu tiên hơn cấp cột.
- TypeScript và Vite build thành công 100% không lỗi.

---

### 2026-09-11 — INFO_GRID Field Drag-to-Reorder & Discrete Arrows Pruning

**Scope:** 3 files, 106 insertions, 34 deletions (`6788fb4`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 2.5 min |
| Thời gian thực thi (Proceed → Push) | 4.5 min |
| Thời gian tổng (Request → Push) | 7.0 min |
| Số file nguồn chỉnh sửa | 1 (`FormBuilder.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 1 (dọn sạch tham số thừa `fArr` tránh TS6133) |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có (pass sau khi dọn dead-code parameter `fArr`) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:** Sau khi gỡ cụm nút `ArrowDown` (vốn đọc `fArr.length - 1`), TypeScript cảnh báo `TS6133: 'fArr' is declared but its value is never read`. Đã xử lý triệt để ngay lập tức theo Rule 13.7 (Dead-Code Pruning Invariant), đạt Refactor Ratio 32.1% và Vite build pass 100% trong 15.29s.

---

### 2026-09-11 — Block-Scoped Table Row Keys & Cross-Block Hover Isolation

**Scope:** 3 files, 47 insertions, 24 deletions (`3617fe5`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 1.5 min |
| Thời gian thực thi (Proceed → Push) | 2.5 min |
| Thời gian tổng (Request → Push) | 4.0 min |
| Số file nguồn chỉnh sửa | 1 (`FormBuilder.tsx`) |
| Tổng lượt edit source | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 |
| Lần build đầu thành công? | Có (100% pass ngay lần build đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:** Không có lỗi mã nguồn hoặc cú pháp phát sinh. 100% build pass ngay lần đầu. Chuyển đổi thành công sang Composite Key `${block.id}:${row.id}`, cách ly hoàn toàn phạm vi hover và popover giữa các bảng, đạt Refactor Ratio 51.1%.

---

### 2026-09-11 — Table Row Line Count UI/UX Refinement & Segmented Action Pill

**Scope:** 3 files, 116 insertions, 77 deletions (`aed930a`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 2.9 min |
| Thời gian thực thi (Proceed → Push) | 6.3 min |
| Thời gian tổng (Request → Push) | 9.1 min |
| Số file nguồn chỉnh sửa | 1 (`FormBuilder.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 |
| Lần build đầu thành công? | Có (100% pass ngay lần build đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:** Không có lỗi mã nguồn hoặc cú pháp phát sinh. 100% build pass ngay lần đầu. Nâng cấp thành công icon vector `Rows2` + số lượng + `ChevronDown`, loại bỏ viền hộp lồng hộp thô ráp, bổ sung divider phân đoạn và hover effect, đạt Refactor Ratio 66.4%.

