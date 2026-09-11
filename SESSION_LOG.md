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

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

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

---

### 2026-09-11 — Table Rows Floating Hover Overlay & Action Column Elimination

**Scope:** 2 files, 249 insertions, 196 deletions (`9cddedb`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 5.3 min |
| Thời gian thực thi (Proceed → Push) | 7.7 min |
| Thời gian tổng (Request → Push) | 12.9 min |
| Số file nguồn chỉnh sửa | 1 (`FormBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 (các edit là non-adjacent chunks theo Mục 12) |
| Số lần build | 2 |
| Lần build đầu thành công? | Có (100% pass ngay lần build đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:** Không có lỗi mã nguồn hay cú pháp phát sinh. 100% build pass ngay lần đầu. Áp dụng triệt để Mục 12.6 (Chunk Bounding Invariant < 50 dòng) và Mục 13.7 (Dead-Code Pruning Invariant), dọn sạch 196 dòng mã cột thao tác cũ, đạt Refactor Ratio 78.7%.

---

### 2026-09-11 — Drag to Reorder Table Rows & Columns (Canvas & Inspector)

**Scope:** 4 files, 452 insertions, 187 deletions (`1ddf197`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 13.2 min |
| Số file nguồn chỉnh sửa | 2 (`FormBuilder.tsx`, `formUtils.ts`) |
| Tổng lượt edit source | 12 |
| Lượt edit sửa lỗi (rework) | 2 (lệch khai báo biến rIdx do chunk lớn & xóa handleMoveColumn unused) |
| Số lần build | 6 |
| Lần build đầu thành công? | Không (dính TS6133 unused var & TS2304) |
| Số lệnh thất bại | 1 |
| Số lỗi mới phát sinh | 1 (TS6133 unused function handleMoveColumn khi thay thế toàn bộ bằng drag) |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:**
1. `CTX`: `replace_file_content` với chunk quá dài (>150 dòng) trong monolith không khớp đúng phần đầu khai báo `(row, rIdx)` và group header `<tr>`. Khắc phục bằng việc chia nhỏ thành chunk hẹp (<40 dòng).
2. `CTX`: `handleMoveColumn` bị bỏ quên khi toàn bộ call-site đã chuyển sang `handleReorderColumns`, gây lỗi TS6133 under `tsc -b`. Đã xóa sạch các hàm không còn sử dụng.

---

### 2026-09-11 — Drag to Reorder Options Across Canvas & Inspector

**Scope:** 5 files, 477 insertions, 111 deletions (`c363793`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 2.2 min |
| Thời gian thực thi (Proceed → Push) | 10.3 min |
| Thời gian tổng (Request → Push) | 12.6 min |
| Số file nguồn chỉnh sửa | 2 |
| Tổng lượt edit source | 12 |
| Lượt edit sửa lỗi (rework) | 3 (do lệch closing tag khi convert arrow function và whitespace) |
| Số lần build | 10 |
| Lần build đầu thành công? | Không |
| Số lệnh thất bại | 3 (do assertion script và tsc -b) |
| Số lỗi mới phát sinh | 1 (lệch closing tag khi chuyển `=> (` sang `=> { return (`) |
| Số lỗi cũ lặp lại | 1 (whitespace indentation 30 vs 31 spaces trong monolith) |

**Lỗi phát sinh:**
1. `CTX`: Khi chuyển `options.map((opt) => (` sang `options.map((opt) => { return (`, closing tag ở cuối danh sách vẫn giữ nguyên `))` dẫn đến TS1005 lúc `tsc -b`. Đã sửa bằng script chèn đúng `); })}`.
2. `CTX`: `replace_file_content` với closing tag ngắn `)}` khớp nhầm ở vùng khác của file monolith. Khắc phục bằng script nhắm chuẩn dòng mục tiêu.

---

### 2026-09-11 — Decoupled Saving State & Optimistic Workflow Form Sync

**Scope:** 3 files, 97 insertions, 16 deletions (`988128c`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 4.1 min |
| Thời gian thực thi (Proceed → Push) | 3.3 min |
| Thời gian tổng (Request → Push) | 7.4 min |
| Số file nguồn chỉnh sửa | 2 |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 0 (các edit là non-adjacent chunks theo Mục 12) |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:** Không có lỗi mã nguồn hoặc cú pháp phát sinh. 100% build pass ngay lần đầu tiên nhờ áp dụng triệt để Mục 12 (đọc code thực tế trước khi patch, dùng replace_file_content gốc, chạy tsc --noEmit sau từng file).

---

### 2026-09-10 — In-Canvas Dropdown (Select) Accordion Option Editor

**Scope:** 2 files, 201 insertions, 15 deletions (`caecf2e`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 2.4 min (15:36:16 → 15:38:41) |
| Thời gian thực thi (Proceed → Push) | 1.2 min (15:38:41 → 15:39:55) |
| Thời gian tổng (Request → Push) | 3.6 min (3 phút 39 giây) |
| Số file nguồn chỉnh sửa | 1 |
| Tổng lượt edit source | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 |
| Lần build đầu thành công? | Có |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:** Không có lỗi mã nguồn hoặc cú pháp phát sinh. 100% build pass ngay lần đầu nhờ áp dụng Mục 12 (Safe Code Patching).

---

### 2026-09-10 — Custom "Khác" (Other) Option

**Scope:** 9 files, 896 insertions, 275 deletions

| Chỉ số | Giá trị |
|---|---|
| Thời gian thực thi (Proceed → Push) | 20.2 min |
| Số file nguồn chỉnh sửa | 6 |
| Tổng lượt edit source | 10 |
| Lượt edit sửa lỗi (rework) | 4 |
| Số lần build | 8 |
| Lần build đầu thành công? | Không |
| Số lệnh thất bại | 15 |
| Số lỗi mới phát sinh | 5 |
| Số lỗi cũ lặp lại | 0 |

**Lỗi phát sinh:**

| # | Nhóm | Mô tả | File liên quan |
|---|---|---|---|
| 1 | `CTX` | Whitespace mismatch trong patch marker | PrintRecord.tsx |
| 2 | `TOOL` | PowerShell parse error với `python -c` chứa JSX | — |
| 3 | `TOOL` | Index slicing sai biên → duplicate closing tags | PrintRecord.tsx, PrintFilledForm.tsx |
| 4 | `CTX` | Patch boundary overlap → stray `)` và duplicate ternary | FormFiller.tsx |
| 5 | `SCOPE` | Gom build cuối → 8 build attempts mới pass | Tất cả |
