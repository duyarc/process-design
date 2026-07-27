# Plans

Thư mục này chứa các **Implementation Plan** cần tồn tại qua nhiều session.

Quy tắc đầy đủ nằm ở mục 9 của [`AGENTS.md`](../AGENTS.md). Tóm tắt:

- **Tên tệp**: `<YYYY-MM-DD>-<slug>.md` — có ngày để plan mới không ghi đè plan cũ.
- **Header bắt buộc**: `Authored against commit: <sha>` và `Status: Active | Done`.
- **Chỉ dùng đường dẫn relative** từ repo root. Cấm `file:///d:/...`.
- **Khi hoàn thành**: xoá tệp, hoặc đổi `Status: Done`.

## Cách dùng

Plan **không** được agent tự động tìm. Người dùng chỉ định rõ khi giao việc:

> "Thực thi `plans/2026-07-27-ten-plan.md`"

Agent thực thi phải kiểm tra `Authored against commit` trước khi áp dụng — nếu tệp đích
đã bị sửa sau commit đó, plan có thể đã hết hạn.

## Mẫu

```markdown
# <Tên plan>

| Field | Value |
|---|---|
| **Authored against commit** | `a1b2c3d` |
| **Status** | Active |

## Phase 1 — <Tên phase>
**File:** src/components/Example.tsx

### Task 1.1 — <Mô tả ngắn>
**Find** (exact content):
<đoạn mã cần tìm>

**Replace with:**
<đoạn mã thay thế>

---
Verify: `npm run build` → zero lỗi TypeScript trước khi sang Phase 2.
```
