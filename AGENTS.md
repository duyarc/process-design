# Project Rules & Customizations

> **Đây là nguồn quy tắc duy nhất (single source of truth) cho mọi AI agent làm việc trên
> repo này** — Claude Code, Google Antigravity, hoặc bất kỳ agent nào khác.
> Không tạo bản sao của tệp này. Quy tắc riêng cho từng agent nằm ở mục cuối cùng.

---

## 1. Module Ownership Map

Mỗi tệp mã nguồn thuộc về **đúng một** module, và mỗi module có **đúng một** tài liệu
thiết kế chính thức. Bảng này là nguồn tra cứu duy nhất cho quan hệ file → doc.

| Module | Tệp mã nguồn thuộc module | Tài liệu thiết kế |
|---|---|---|
| **Platform Shell** | `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/LoginPage.tsx`, `src/components/UserManagement.tsx`, `src/context/AuthContext.tsx`, `src/main.tsx` | [`DESIGN_PLATFORM_SHELL.md`](DESIGN_PLATFORM_SHELL.md) |
| **Process Designer** | `src/components/ProcessEditor.tsx`, `src/components/ProcessReader.tsx`, `src/components/BpmnModelerComponent.tsx`, `src/components/BpmnViewerComponent.tsx`, `src/components/BPMNGuide.tsx`, `src/utils/bpmnXmlGenerator.ts`, `src/utils/layout/*`, `src/bpmn-custom.d.ts` | [`DESIGN_PROCESS_DESIGNER.md`](DESIGN_PROCESS_DESIGNER.md) |
| **Form Designer** | `src/components/FormBuilder.tsx`, `src/components/print/PrintBlankForm.tsx` | [`DESIGN_FORM_DESIGNER.md`](DESIGN_FORM_DESIGNER.md) |
| **Form Operations** | `src/components/FormFiller.tsx`, `src/components/FormManager.tsx`, `src/components/SubmissionManager.tsx`, `src/components/print/PrintRecord.tsx`, `src/utils/formUtils.ts` | [`DESIGN_FORM_OPERATIONS.md`](DESIGN_FORM_OPERATIONS.md) |
| **Report Builder** | *(Components TBD)* | [`DESIGN_REPORT_BUILDER.md`](DESIGN_REPORT_BUILDER.md) |
| **Backend & Persistence** | `server.cjs`, `api/index.js` | [`DESIGN_BACKEND.md`](DESIGN_BACKEND.md) |
| **Design System** | `src/index.css`, `src/print.css`, `src/App.css` | [`DESIGN_UI_UX.md`](DESIGN_UI_UX.md) |

### Shared types (`src/types.ts`)

`src/types.ts` được nhiều module dùng chung. Để tránh tình trạng cùng một thay đổi
được ghi vào nhiều tài liệu khác nhau, **mỗi interface có đúng một tài liệu chủ**:

| Interface / Type | Tài liệu chủ |
|---|---|
| `Process`, `ProcessStep`, `SOPSignOff`, `SOPSignOffs`, `FormField`, `FormDesignerField`, `RadioOption` | `DESIGN_PROCESS_DESIGNER.md` |
| `FormTemplateISO`, `LayoutBlockISO`, `FormFieldISO`, `FormRevisionEntry`, `MatrixConfigISO`, `TableColumnConfig`, `TableRowConfig`, `SubtableColumn`, `ColumnSummaryRowConfig`, `TitleFormatISO` | `DESIGN_FORM_DESIGNER.md` |
| `Submission`, `SubmissionFieldSnapshot` | `DESIGN_FORM_OPERATIONS.md` |
| `ReportTemplateISO`, `ReportBlockConfig`, `ReportBlockType`, `ReportRevisionEntry`, `ReportDataModel`, `FieldEvaluationResult`, `ReportFieldRuleOverride` | `DESIGN_REPORT_BUILDER.md` |

> `User`, `Role`, `RoleId`, `PermissionKey`, `RolePermissionsMatrix` **không** nằm trong
> `types.ts` — chúng được khai báo trong `src/context/AuthContext.tsx` và thuộc
> `DESIGN_PLATFORM_SHELL.md`.

---

## 2. Đọc tài liệu trước khi sửa mã (Read Before Edit)

Mục đích của bộ tài liệu thiết kế là để agent **không phải đọc lại toàn bộ codebase**.
Vì vậy:

- **Hành động bắt buộc**: Trước khi sửa bất kỳ tệp nào trong bảng Module Ownership Map,
  agent **PHẢI** đọc tài liệu thiết kế của module đó trước.
- Sau khi đọc tài liệu, chỉ đọc phần mã nguồn thực sự liên quan đến thay đổi
  (hàm/component cụ thể), **không** đọc toàn bộ tệp.
- Nếu tài liệu mâu thuẫn với mã nguồn: **mã nguồn là đúng**. Sửa tài liệu ngay trong
  cùng session đó và ghi vào Change Log.
- Nếu tài liệu thiếu thông tin cần thiết: bổ sung phần còn thiếu sau khi đã đọc mã nguồn,
  để session sau không phải đọc lại.

---

## 3. Cập nhật tài liệu sau khi sửa mã (Update After Edit)

Khi agent thực hiện thay đổi **có nghĩa** (feature mới, sửa lỗi, refactor, điều chỉnh UI)
lên bất kỳ tệp nào trong bảng Module Ownership Map, agent **PHẢI**:

1. **Cập nhật phần bị ảnh hưởng** trong tài liệu thiết kế tương ứng — data model, flows,
   interface contracts, technical debt. Đây là bước quan trọng nhất.
2. **Cập nhật Header Block**: trường `Verified At Commit` phải ghi rõ *đã kiểm chứng mục nào*,
   không chỉ ghi ngày. Xem mục 4 bên dưới.
3. **Thêm một dòng vào Change Log** — chỉ khi thay đổi mang tính kiến trúc. Xem mục 5.

---

## 4. Trường `Verified At Commit` là một lời cam kết, không phải dấu thời gian

Không được cập nhật ngày một cách phản xạ. Trường này phải nêu rõ phạm vi đã kiểm chứng
và ngày kiểm chứng tại đó — đúng một dòng duy nhất trong Header Block:

```
| **Verified At Commit** | (2026-08-26) — Sections 4 and 6 checked against source |
```

Chỉ ghi tên những mục agent thực sự đã đọc và so với source trong lần đó. Các mục không
kiểm chứng thì không được liệt kê, kể cả khi trước đó chúng đã từng đúng.

Một ngày sai còn tệ hơn một ngày cũ, vì nó tạo ra sự tin tưởng không có căn cứ.

---

## 5. Change Log: chỉ ghi thay đổi kiến trúc, tối đa ~15 dòng

Change Log **không** phải là bản sao thứ hai của `git log`.

- **Chỉ ghi**: thay đổi schema, interface contract, invariant, loại block mới,
  quyết định kiến trúc, hoặc bug có nguyên nhân gốc đáng ghi nhớ.
- **Không ghi**: đổi nhãn UI, đổi padding, đổi màu, đổi text nút bấm.
  Những thay đổi này đã có trong `git log`.
- **Giới hạn ~15 dòng**. Khi vượt quá, xoá dòng cũ nhất.
- **Quy tắc Commit Nguyên tử (Atomic Single Commit — Tuyệt đối không tạo commit phụ)**:
  Mọi sửa đổi mã nguồn và tài liệu thiết kế PHẢI được gộp trong **đúng 1 commit duy nhất**
  khi push lên Git. **Tuyệt đối cấm** tạo commit thứ hai chỉ để sửa mã SHA trong tài liệu
  nhằm tránh kích hoạt lãng phí các lượt build CI/CD (Vercel / GitHub Actions). Cột định danh
  trong Change Log ghi ngày và tiêu đề thay đổi rõ ràng.

```
| Date | Change |
|---|---|
| 2026-08-26 | **Tên thay đổi kiến trúc:** Mô tả chi tiết... |
```

---

## 6. Không ghi số dòng vào tài liệu (No Line Numbers)

- **Cấm** ghi số dòng trong tài liệu thiết kế (`line 28–41`, `lines 155–162`).
  Số dòng lệch ngay khi có commit tiếp theo, và một con trỏ sai còn tệ hơn không có
  con trỏ nào — agent nhảy sai chỗ rồi vẫn phải đọc lại cả tệp.
- **Thay bằng tên symbol** để agent tự tìm được: `interface FormBuilderProps`,
  `function handleLogoUpload`, `const DEFAULT_LAYOUT_CONSTANTS`.
- **Cấm** ghi số dòng hoặc kích thước tệp trong bảng Quick File Index.

---

## 7. Tuân thủ Master Design (UI/UX Compliance)

- Khi tạo hoặc sửa UI, agent **bắt buộc** dùng CSS variables (`var(--primary)`,
  `var(--neutral-bg)`, …) và utility class lõi (`.paper-card`, `.btn`) đã định nghĩa
  trong `src/index.css`. Luôn tham chiếu [`DESIGN_UI_UX.md`](DESIGN_UI_UX.md).

- **Cấm** inline style với mã màu hardcode (ví dụ `#10a3a3`) trừ trường hợp bất khả kháng.
- **Nghiêm cấm dùng window.confirm() / alert()**: Nghiêm cấm viết mới `window.confirm()` hoặc `window.alert()`. Mọi xác nhận phải thông qua component dùng chung `ConfirmModal` (`src/components/common/ConfirmModal.tsx`).
- **Chiến lược chuyển đổi lũy tiến (Progressive Adoption)**: Khi sửa đổi/cập nhật tính năng trong một component có sẵn code `window.confirm()` cũ, **bắt buộc** phải convert toàn bộ các lệnh `window.confirm()` trong component đó sang `ConfirmModal`.
- **Evolution**: Nếu thêm CSS variable global mới, utility class mới, hoặc thay đổi đáng kể
  về thẩm mỹ, agent **bắt buộc** cập nhật `DESIGN_UI_UX.md` và ghi Change Log.
- **Propagation**: Khi thay đổi **cấu trúc HTML / cách dùng class** của một UI pattern
  chuẩn (ví dụ cấu trúc thẻ của form group, hoặc class của button), agent **bắt buộc**
  quét toàn bộ mã nguồn và cập nhật cấu trúc mới cho tất cả component tương tự.


---

## 8. Master Index (`README.md`)

[`README.md`](README.md) là Master Index và System Architecture Overview.
Agent **PHẢI** cập nhật `README.md` nếu: thêm module chức năng mới, thay đổi Tech Stack
(cài thêm thư viện lõi), hoặc thay đổi luồng khởi chạy (setup/run commands).

---

## 9. Quy tắc riêng theo Agent (Agent-Specific Overlays)

Các mục 1–8 áp dụng cho **mọi** agent. Phần dưới đây chỉ áp dụng cho một agent cụ thể;
agent khác bỏ qua.

### Google Antigravity

- **Model routing**: Mặc định dùng Gemini (Flash/Pro) cho phần lớn tác vụ thiết kế giao diện,
  lập trình, viết kiểm thử, chạy lệnh terminal và thảo luận, để tiết kiệm quota của model
  reasoning cao cấp.
- **Phân chia vai trò cộng tác**:
  - *Người dùng làm Kiến trúc sư (The Thinker)*: dẫn dắt, cung cấp giải pháp logic cốt lõi
    và hướng đi chi tiết.
  - *Agent làm Trợ lý thực thi (The Assistant)*: viết mã, kiểm tra build, viết tài liệu và
    giải đáp thông tin dưới sự kiểm soát của Người dùng.
- **Git Push Procedure**: Xem Mục 10 — áp dụng bắt buộc cho mọi lần push.

---

## 10. Quy trình Git Push Chuẩn (Native Git Command Procedure)

Sử dụng trực tiếp các lệnh `git` nguyên bản trong PowerShell (dùng dấu chấm phẩy `;` để phân tách lệnh trong 1 lần gọi `run_command` duy nhất). Việc này giúp câu lệnh gọn gàng, trực quan và không phụ thuộc vào `cmd /c`.

### Quy trình chuẩn (Chỉnh sửa file đã tracked)

Chạy 1 lần `run_command` duy nhất (WaitMsBeforeAsync: 25 000 ms):

```powershell
git commit -a -m "<message>"; git push origin main; git log -n 1 --oneline
```

### Quy trình cho file mới (Chưa tracked)

Nếu có file mới chưa được Git theo dõi:

```powershell
git add <file cụ thể>; git commit -m "<message>"; git push origin main; git log -n 1 --oneline
```

### Ràng buộc bắt buộc

1. **Phân tách lệnh bằng `;` (Semicolon):** Trong Windows PowerShell, dấu `;` cho phép thực thi chuỗi lệnh liên tiếp một cách an toàn và gọn gàng.
2. **`WaitMsBeforeAsync`:** Set `25 000` ms (25 giây) cho lệnh gộp chuỗi để lệnh thực thi hoàn tất đồng bộ và trả về kết quả ngay lập tức.
3. **Xử lý sự cố `index.lock` (nếu có):** Chạy lệnh tự động dọn lock nếu cần:
   ```powershell
   Remove-Item -Path .git\index.lock -Force -ErrorAction SilentlyContinue
   ```
4. **Cam kết 1 Commit duy nhất (Atomic Single Commit):** Luôn gộp tất cả mã nguồn và tài liệu liên quan vào đúng **1 lần commit & push duy nhất**. Tuyệt đối không tạo commit phụ thứ hai để tránh lãng phí build trên CI/CD.

