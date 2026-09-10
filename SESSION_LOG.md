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

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

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
