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
| 11 | `TOOL` | Chạy inline Node trên PowerShell chứa `$1` bị PowerShell ngậm biến `$1` thành chuỗi rỗng → SQL syntax error | Lưu code ra file `.cjs` tạm hoặc escape `\$1` trong chuỗi lệnh PowerShell | 1 |
| 12 | `SCOPE` | Biểu mẫu chứa text động trong `tableData` (pre-filled cells) hoặc `tableRows` (`groupTitle`) ngoài `tableColumns` | Luôn duyệt toàn diện cả `tableRows` (`groupTitle`), `tableData` (text cells), field `placeholder`, `reactionProtocol` khi bóc tách chuỗi | 1 |
| 13 | `LOGIC` | Hiểu nhầm "search" là truy xuất bộ nhớ nội bộ (internal reasoning) của LLM thay vì tra cứu không gian bên ngoài | Định nghĩa rõ: "Search" bắt buộc là tìm kiếm không gian bên ngoài (External Web Search) với các nguồn quy chuẩn xác thực, không dựa vào lập luận nội bộ của LLM | 1 |
| 14 | `SCOPE` | Hardcode danh sách quy chuẩn cố định (IMO, BRCGS, ISO 22000, APICS) làm thiên lệch vào dữ liệu mẫu | Khái quát hóa thành quy trình: "Search web theo ngữ cảnh form" (Context-Driven Web Search) dựa trên domain suy diễn động | 1 |
| 15 | `BLOAT` | Thêm text badges (Selected, Đã chọn, Active, hints) trùng lặp với visual indicator (màu sắc, border, icon) → UI bị rối | Áp dụng UI Streamlining Audit: Khi visual cues đã rõ ràng, triệt tiêu toàn bộ text badges phụ trợ để giữ UI tối giản | 1 |

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

### 2026-09-23 — Form & Report Designer: Blank Space Click-to-Deselect to View & Edit Form/Report Properties

**Scope:** 4 files (`FormBuilder.tsx`, `ReportBuilder.tsx`, `DESIGN_FORM_DESIGNER.md`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 4.0 min |
| Thời gian lập plan (Request → Proceed) | 1.0 min |
| Thời gian thực thi (Proceed → Push) | 3.0 min |
| Số file nguồn chỉnh sửa | 2 (`FormBuilder.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 4 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Cơ chế Bỏ chọn khi Click Khoảng trắng (Canvas & Paper Click Delegation):** Gắn sự kiện `onClick` lên khung cuộn Canvas trung tâm (`#f1f5f9`) và khoảng trống lề trang giấy in (`.paper-card`) trong cả `FormBuilder.tsx` và `ReportBuilder.tsx`, tự động reset `activeBlockId = null`, `activeFieldId = null`, `selectedFieldId = null`.
- **Cô lập Sự kiện Khối (Event Isolation):** Bổ sung `e.stopPropagation()` trên block wrapper để click vào bất kỳ khối nào sẽ chỉ chọn khối đó mà không bị kích hoạt sự kiện bỏ chọn của Canvas.
- **Chuẩn hóa Tiêu đề Form & Report Properties:** Bổ sung tiêu đề in hoa `FORM PROPERTIES` và `REPORT PROPERTIES` trong thanh thuộc tính bên phải khi ở trạng thái bỏ chọn, tạo sự nhất quán hoàn hảo với `FIELD PROPERTIES` và `BLOCK PROPERTIES`.

---

### 2026-09-23 — Report Builder: Number Multi-Range & Text Completeness Scoring Rules & Minimal English Inspector

**Scope:** 5 files (	ypes.ts, 
eportScoring.ts, FieldScoringInspector.tsx, ReportBuilder.tsx, DESIGN_REPORT_BUILDER.md)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 6.5 min |
| Thời gian lập plan (Request → Proceed) | 2.5 min |
| Thời gian thực thi (Proceed → Push) | 4.0 min |
| Số file nguồn chỉnh sửa | 4 (	ypes.ts, 
eportScoring.ts, FieldScoringInspector.tsx, ReportBuilder.tsx) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 1 (sửa TS2367 không có textarea trong FormFieldISO.type) |
| Số lần build | 4 (3 tsc + 1 vite pass) |
| Lần build cuối thành công? | Có (100% pass, built in 11.05s) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Chấm điểm Đa Dải Ngưỡng (Number Multi-Range Intervals):** Hỗ trợ cấu hình $ dải ngưỡng với trạng thái isPass và Score độc lập, nút + Add Range, xóa dải và highlight dải khớp giá trị thực tế.
- **Kiểm tra Độ đầy đủ & Cấu hình Ký tự Inline (Text Completeness):** Tích hợp trực tiếp ô nhập số ký tự tối thiểu vào dòng điều kiện Standard (≥ [ 10 ]), tự động cập nhật dòng Short (< 10) và Empty (toggle Allow empty).
- **Chuẩn hóa Minimal English & Tiết kiệm Chiều cao:** Đổi toàn bộ nhãn sang tiếng Anh tối giản (Value:, Range, Condition, Copy/Copied!) và thu gọn hàng Type trên cùng 1 hàng ngang phẳng.

---

### 2026-09-23 — Report Builder: Streamlined Weight Label in Field, H1 & H2 Property Bars

**Scope:** 3 files (`FieldScoringInspector.tsx`, `ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 3.5 min |
| Thời gian lập plan (Request → Proceed) | 0.0 min (minor follow-up UI tweak) |
| Thời gian thực thi (Proceed → Push) | 3.5 min |
| Số file nguồn chỉnh sửa | 2 (`FieldScoringInspector.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite pass) |
| Lần build cuối thành công? | Có (100% pass, built in 9.63s) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Rút gọn nhãn Trọng số (Streamlined Weight Label):** Đơn giản hóa toàn bộ nhãn dài bị quấn dòng (`Weight (% trong [Tên Nhóm]):`, `Weight (% trong Báo cáo):`, `Weight (% trong [Trụ Cột]):`) thành duy nhất nhãn ngắn gọn **`Weight:`** trên cùng 1 hàng ngang trong cả 3 phân hệ: Cấp Câu hỏi (`FieldScoringInspector.tsx`), Cấp Trụ cột H1 (`ReportBuilder.tsx`) và Cấp Nhóm H2 (`ReportBuilder.tsx`).
- **Giữ trọn vẹn ngữ cảnh qua tooltip:** Nội dung giải thích chi tiết nhóm cha được đưa vào thuộc tính `title` khi rê chuột (`title="Trọng số phần trăm của câu hỏi trong nhóm..."`), giúp thanh thuộc tính luôn giữ được độ cao 1 hàng phẳng, đẹp và không bị tràn text.

---

### 2026-09-22 — Report Builder: Left Panel Section H1 / H2 Interactive Selection & Collapsed Card Clipping Fix

**Scope:** 2 files (`ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 4.2 min |
| Thời gian lập plan (Request → Proceed) | 1.6 min |
| Thời gian thực thi (Proceed → Push) | 2.6 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite pass) |
| Lần build cuối thành công? | Có (100% pass, built in 8.19s) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Triệt tiêu lỗi cắt cụt chữ khi thu gọn (Left Tree & Modal):** Bổ sung `flexShrink: 0`, `minHeight: '34px'`, `minHeight: '28px'` và `boxSizing: 'border-box'` cho toàn bộ container thẻ H1/H2 ở Left Panel và Quick Field Picker Modal, chống hiện tượng flexbox co ép chiều cao khi danh sách dài.
- **Tách biệt thao tác:** Bấm nút Chevron `[ > ]` / `[ v ]` để mở rộng / thu gọn nhánh cây độc lập mà không ảnh hưởng tới khối đang kích hoạt.
- **Chọn trực tiếp Section H1 / Sub-section H2 từ khay trái:** Bổ sung `handleSelectH1Section` và `handleSelectH2Subgroup` kích hoạt trực tiếp khối tương ứng trên Canvas (hoặc tự tạo nếu chưa có), xóa `selectedFieldId = null` và tự động chuyển ngay sang tab `Properties` hiển thị cấu hình H1/H2 (`isKnockout`, `Weight %`, ma trận điểm nhóm).
- **Trạng thái chọn nổi bật:** Thẻ H1 hiển thị viền/nền Teal `#f0fdfa` và thẻ H2 hiển thị viền/nền Blue `#eff6ff` khi đang được chọn.

---

### 2026-09-22 — Report Builder: Dual Evaluation Engine & Hierarchical Combined Score Roll-up

**Scope:** 6 files (`types.ts`, `reportScoring.ts`, `reportCompute.ts`, `FieldScoringInspector.tsx`, `ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 12.5 min |
| Thời gian lập plan (Request → Proceed) | 8.6 min |
| Thời gian thực thi (Proceed → Push) | 3.9 min |
| Số file nguồn chỉnh sửa / tạo mới | 5 (`types.ts`, `reportScoring.ts`, `reportCompute.ts`, `FieldScoringInspector.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 2 (dọn biến thừa `isFieldPass` & bổ sung import `FieldEvaluationResult`) |
| Số lần build | 3 (2 tsc + 1 vite pass) |
| Lần build cuối thành công? | Có (100% pass, built in 10.84s) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Động cơ Đánh giá Kép Song song (Dual Evaluation Engine):** Vận hành độc lập giữa Đạt/K.Đạt định tính (`isPass`) và Điểm số định lượng (`Score`), hỗ trợ cờ chí mạng `isKnockout` tự động đánh rớt toàn bộ nhóm/báo cáo khi vi phạm.
- **Tính điểm Bình quân theo Trọng số 3 Cấp (Hierarchical Roll-up):** Xây dựng pure utility `src/utils/reportScoring.ts` tính Combined Score 3 cấp: Field ➔ Sub-section H2 (`computeH2CombinedScore`) ➔ Section H1 (`computeH1CombinedScore`) ➔ Report Overall (`computeRecordReport`): $\text{Combined Score} = \sum (\text{Score}_i \times \frac{\text{Weight}_i}{100})$.
- **Thanh Thuộc tính 1 Hàng & Tên Nhóm Động:** Thiết kế thanh thuộc tính `[ ] isKnockout` và `Weight (% trong [Tên Nhóm/Trụ cột]): [ X ] %` trên 1 hàng ngang duy nhất. Tên nhóm cha được lấy động theo ngữ cảnh (`[Tên Nhóm H2]`, `[Tên Trụ cột H1]`, `[Toàn bộ Báo cáo]`).
- **Inspector Chuyên biệt `FieldScoringInspector.tsx`:** Tách component độc lập theo Rule 4.3 Monolith Guard, hiển thị ma trận đánh giá 3 cột (`Option / Condition`, `isPass`, `Score`), dòng SUM responsive hiển thị nhãn `PASS`/`FAIL` và Điểm tổng hợp cỡ lớn, không có hậu tố `đ` và không hardcode thang 10.
- **Chuẩn hóa Tiêu đề Cột:** Đồng bộ header bảng ở cả 3 cấp duy nhất là `Score`.

---

### 2026-09-22 — Report Builder: Field Properties Auto-Grow Label & Streamlined Multi-Option Value Visualizer

**Scope:** 2 files (`ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite) |
| Lần build cuối thành công? | Có (100% pass, built in 16.17s) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Auto-Grow Label:** Thay thế `<textarea>` bằng container tự co giãn chiều cao (`whiteSpace: 'pre-wrap', wordBreak: 'break-word'`), hiển thị 100% câu hỏi mà không sinh thanh cuộn dọc. Ẩn cụm nút format text `[ B ] [ I ] [ U ]` vì nhãn là read-only.
- **Streamlined Multi-Option Value Visualizer:** Trường `Value` tự động kéo tất cả các mức điểm / tùy chọn từ form schema (`scale` / `likert_scale`, `checkbox`, `radio`, `select`). Thể hiện trạng thái được chọn qua ngôn ngữ thị giác thuần túy (viền & nền Teal `#0d9488`, icon Tích tròn `✓`, Checkbox `☑`, Radio `⦿`), triệt tiêu toàn bộ các text badge rườm rà (`Selected`, `Đã chọn`, `Active`).
- **UI Streamlining Audit Protocol:** Đưa quy trình rà soát và tinh gọn giao diện vào bài học kinh nghiệm để agent tự động tối giản UI trong các kế hoạch tiếp theo.

---

### 2026-09-22 — Report Builder: FormBuilder-Parity Field Properties Inspector & Left Tray Streamlining

**Scope:** 2 files (`ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 1 (dọn hàm cũ `toggleFieldInBlock` & fix `selectedField.checkItem`) |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build cuối thành công? | Có (100% pass, built in 17.06s) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tối giản Field Card khay trái:** Loại bỏ dòng subtitle `ID:` kỹ thuật, chỉ hiển thị câu hỏi và badge loại trường, thêm highlight viền Teal khi trường được chọn.
- **Thẻ Field Properties chuẩn 100% FormBuilder:** Tích hợp `FIELD PROPERTIES` vào Tab Properties với `ID` kèm nút 1-chạm `[📋 Sao chép]`, `Label` kèm cụm nút `[ B ] [ I ] [ U ]`, `Type` với icon Lucide chuẩn (`FIELD_TYPE_OPTIONS`), và `Value` hiển thị giá trị câu trả lời thực tế từ lượt nộp mẫu.
- **Loại bỏ toàn bộ phần đánh giá & nút `+ Gán...`:** Theo đúng chỉ đạo của người dùng để phần tính toán đánh giá được xây dựng chuyên biệt trong các giai đoạn sau của Report Builder.
- **Tự động nạp form mới nhất:** Sắp xếp theo `updated_at DESC` trong `init()`, giải quyết triệt để lỗi nạp phiên bản form cũ.

---

### 2026-09-22 — Form Designer & Common UI: Upgrade Publish Form Alert to ConfirmModal Success Dialog

**Scope:** 4 files (`ConfirmModal.tsx`, `FormBuilder.tsx`, `DESIGN_UI_UX.md`, `DESIGN_FORM_DESIGNER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian lập plan (Request → Proceed) | 16.8 min |
| Thời gian thực thi (Proceed → Push) | 3.1 min |
| Thời gian tổng (Request → Push) | 19.9 min |
| Số file nguồn chỉnh sửa | 2 (`ConfirmModal.tsx`, `FormBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lệnh thất bại | 0 |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Triệt tiêu hoàn toàn hộp thoại chặn mặc định của trình duyệt (`alert(...)`) khi ban hành phiên bản biểu mẫu (`handlePublish`) theo đúng Rule 3 (`AGENTS.md`).
- Mở rộng component dùng chung `ConfirmModal`: bổ sung `variant="success"` (icon `CheckCircle`, màu ngọc `#059669`, viền `#a7f3d0`, nút `var(--primary)`) và hỗ trợ cờ `hideCancel` cho các hộp thoại thông báo đơn hành động (single-action alert).
- Tinh chỉnh nội dung theo chỉ đạo của người dùng: loại bỏ lời nhắc tuân thủ ISO rườm rà, giữ lại badge phiên bản nổi bật và chuẩn hóa nút đóng về duy nhất một nút `"OK"`.
- TypeScript (`npx tsc --noEmit`) và Vite bundle (`npm run build`) hoàn tất thành công 100% không lỗi.

---

### 2026-09-22 — Report Builder: Hierarchical Section H1 & H2 Grouping & Batch Field Adding

**Scope:** 5 files (`types.ts`, `tableFieldExtractor.ts`, `formUtils.ts`, `ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn tạo mới / chỉnh sửa | 4 (`types.ts`, `tableFieldExtractor.ts`, `formUtils.ts`, `ReportBuilder.tsx`) |
| Lượt edit source (rework) | 1 (thêm khai báo `expandedSections` state) |
| Số lần build / test | 2 (`tsc --noEmit` pass + 1 vite 10.79s pass) |
| Lần build đầu thành công? | Có |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Bóc tách Tầng Bậc H1/H2 Tự động (`tableFieldExtractor.ts`):** Tự động nhận diện Section H1 (từ `SECTION_LABEL` H1 hoặc tiêu đề phần lớn) và Section H2 (từ `SECTION_LABEL` H2, table row group headers `row.isGroupHeader` như `5C-Scorecard`, hoặc block titles).
- **Pure Utility Hierarchy (`groupFieldsByHierarchy`):** Tách cấu trúc nhóm lồng nhau dạng cây `{ h1, totalFieldsCount, h2Groups: [{ h2, fields }] }` ra utility thuần túy, an toàn cho render.
- **Tree Accordion & Batch Adding (`ReportBuilder.tsx`):** Nâng cấp Left Panel `FIELDS` tray và `Quick Field Picker Modal` thành cây phân cấp có thể đóng/mở từng nhóm, mở hết/thu gọn tất cả, tự động bung nhánh khi tìm kiếm, và bổ sung các nút `[ + Gán cả H1 ]` & `[ + Nhóm ]` gán đồng loạt toàn bộ trường chỉ với 1 click.
- **Tuân thủ quy trình 2 giai đoạn:** Hoàn thành Two-Stage Planning ➔ Batch Execution ➔ TypeScript/Vite pass 100% ➔ Atomic commit.

---

### 2026-09-20 — Form Translation: Minimal Post-Translation Review Report & User Override Protocol

**Scope:** 5 files (`reporter.cjs`, `index.cjs`, `cli.cjs`, `DESIGN_TRANSLATOR.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn tạo mới / chỉnh sửa | 4 (`reporter.cjs`, `index.cjs`, `cli.cjs`, `DESIGN_TRANSLATOR.md`) |
| Lượt edit source (rework) | 1 (sửa cú pháp dấu nháy chuỗi trong reporter.cjs) |
| Số lần build / test | 3 (1 self-test pass + 1 tsc + 1 vite 8.36s) |
| Lần build đầu thành công? | Có |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Thêm bước Báo cáo Đối soát Hậu Dịch thuật Tinh gọn (`reporter.cjs`):** Bóc tách danh sách các khái niệm thuật ngữ duy nhất, đánh chỉ mục `#` từ 1..N, xuất bảng đối chiếu 2 cột (Từ gốc vs. Từ dịch được chọn) theo phong cách minimal cho cả Markdown và Console.
- **Hỗ trợ Ghi đè Thuật ngữ Linh hoạt:** Người dùng có thể yêu cầu thay thế qua phản hồi hội thoại (`Đổi #3 thành X` hoặc `Đổi "từ gốc" thành X`) hoặc qua cờ lệnh CLI `--override "<#|từ gốc>: <từ mới>"`.
- **Bảo toàn Bất biến 100%:** Các giá trị ghi đè tự động đi qua hàm `assertInvariants` trước khi ghi vào cơ sở dữ liệu.
- **Mở rộng Test Suite:** Bổ sung Test 5 vào `cli.cjs` nâng tổng số test assertions lên 5/5 pass. Vite production bundle pass trong 8.36s.

---

### 2026-09-20 — Form Translation: Context-Driven Dynamic Web Search Invariant Refinement

**Scope:** 4 files (`DESIGN_TRANSLATOR.md`, `llmInstructions.cjs`, `llmClient.cjs`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 4 (`DESIGN_TRANSLATOR.md`, `llmInstructions.cjs`, `llmClient.cjs`, `SESSION_LOG.md`) |
| Lượt edit source (rework) | 0 |
| Số lần build / test | 3 (1 self-test pass + 1 tsc + 1 vite 7.93s) |
| Lần build đầu thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Chuẩn hóa bước tra cứu trong thuật toán dịch:** Chuyển đổi định nghĩa từ danh sách quy chuẩn hardcoded (IMO, BRCGS, ISO, APICS) sang nguyên lý tổng quát: **"Search web theo ngữ cảnh form" (Context-Driven Web Search)**.
- **Loại bỏ hoàn toàn thiên lệch dữ liệu mẫu:** Cập nhật tài liệu thiết kế `DESIGN_TRANSLATOR.md` v1.2 và module chỉ dẫn `llmInstructions.cjs`, `llmClient.cjs` đảm bảo hệ thống không bị đóng khung trong bất kỳ ngành nghề cụ thể nào mà thích ứng động qua truy vấn tìm kiếm bên ngoài (`search_web`).
- **Xác minh toàn diện:** TypeScript pass 100%, 4/4 self-tests pass, Vite production bundle build hoàn tất trong 7.93s.

---

### 2026-09-20 — Form Translation: Generalized External Web Grounding & Multi-Domain Verification

**Scope:** 7 files (`extractor.cjs`, `reconstitutor.cjs`, `llmInstructions.cjs`, `llmClient.cjs`, `index.cjs`, `cli.cjs`, `DESIGN_TRANSLATOR.md`)

| Chỉ số | Giá trị |
|---|---|
| Số phần thực thi | 2 (Phần 1: Module Upgrade, Phần 2: Sample Re-run) |
| Số file nguồn chỉnh sửa | 4 (`DESIGN_TRANSLATOR.md`, `llmInstructions.cjs`, `index.cjs`, `SESSION_LOG.md`) |
| Lượt edit source (rework) | 0 |
| Số lần build / test | 3 (1 self-test pass + 1 tsc + 1 vite 7.88s) |
| Lần build đầu thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Khái quát hóa quy tắc đối soát thực tế bên ngoài (External Web Grounding Invariant):** Không dựa vào lập luận nội bộ của LLM; mọi thuật ngữ chuyên môn bắt buộc phải được neo (anchor) vào quy chuẩn quốc tế thực tế thông qua tìm kiếm không gian bên ngoài (`search_web`).
- **Thiết kế Schema trích dẫn tổng quát (`TerminologyCitation`):** Định nghĩa cấu trúc `authority`, `standardDoc`, `section`, `referenceUrl`, `scope` độc lập với dữ liệu mẫu, áp dụng mở rộng cho bất kỳ ngành nào (ISO, IEC, IMO, BRCGS, APICS, ASME, OSHA).
- **Thực thi 2 phần độc lập:**
  - *Phần 1:* Nâng cấp module, cập nhật `DESIGN_TRANSLATOR.md` v1.2, xuất bản registry `TERMINOLOGY_CITATIONS` và helper `getCitation`. Build pass 100% (tsc và Vite 7.88s).
  - *Phần 2:* Chạy lại pipeline dịch thuật trên 4 form mẫu, ghi dữ liệu bền vững vào PostgreSQL (Supabase). Quét regex xác nhận 0 chuỗi sót tiếng Việt (187/187 chuỗi chuẩn hóa).

---

### 2026-09-20 — Architecture & Governance: Refactor FormTranslator as Independent Module

**Scope:** 5 files (`DESIGN_TRANSLATOR.md`, `AGENTS.md`, `DESIGN_FORM_DESIGNER.md`, `package.json`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa / tạo mới | 4 |
| Lượt edit source (rework) | 0 |
| Số lần build / test | 3 (1 self-test + 1 tsc + 1 vite 8.43s) |
| Lần build đầu thành công? | Có (100% build pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Tách biệt hoàn toàn phân hệ `FormTranslator` thành module backend/agent độc lập, sở hữu tài liệu thiết kế chuẩn hóa riêng [`DESIGN_TRANSLATOR.md`](DESIGN_TRANSLATOR.md).
- Cập nhật Bản đồ sở hữu module trong [`AGENTS.md`](AGENTS.md), phân định ranh giới rõ ràng: `Form Designer` chỉ quản lý UI tương tác React (`FormBuilder.tsx`, `PrintBlankForm.tsx`), `Form Translator` quản lý toàn bộ pipeline bóc tách, dịch thuật và bảo toàn bất biến (`scripts/formTranslator/*`).
- Giải phóng hoàn toàn [`DESIGN_FORM_DESIGNER.md`](DESIGN_FORM_DESIGNER.md) khỏi các nội dung kịch bản dịch thuật không có giao diện người dùng.
- Thêm lệnh chạy tắt `"translate": "node scripts/formTranslator/cli.cjs"` trong `package.json` phục vụ Antigravity agents và quy trình CI/CD.
- Kiểm thử `npm run translate -- test` pass 4/4 assertions; Vite build pass trong 8.43s.

---

### 2026-09-20 — Form Translation: Batch Ingestion of Forms 3S-QC/Q1.2e, Q1.3e, Q1.4e

**Scope:** 4 files (`llmInstructions.cjs`, `DESIGN_FORM_DESIGNER.md`, `SESSION_LOG.md`, `walkthrough.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 (`llmInstructions.cjs`, `DESIGN_FORM_DESIGNER.md`) |
| Lượt edit source (rework) | 0 |
| Số lần build / test | 3 (1 self-test pass + 1 tsc + 1 vite 8.38s) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Mở rộng từ điển chuyên ngành QC (`QC_DOMAIN_GLOSSARY` trong `llmInstructions.cjs`) với các tập thuật ngữ chuyên sâu: Tiêu chuẩn kỹ thuật (`Product Technical Specifications`), Đóng cont & Sơ đồ pallet (`Container Stuffing Requirements`, các loại cont khô/lạnh, quấn màng co, nẹp V-board, đai strapping), Kế hoạch sản xuất (`Production Schedule`).
- Thực thi quy trình `FormTranslator` hàng loạt trên 3 biểu mẫu `3S-QC/Q1.2e` (21 chuỗi), `3S-QC/Q1.3e` (63 chuỗi), `3S-QC/Q1.4e` (24 chuỗi) — tổng cộng 108 chuỗi văn bản.
- Tự động kiểm tra và bảo toàn 100% cấu trúc bất biến (zero ID/type/value thay đổi), cập nhật thành công lên PostgreSQL Supabase.
- Kiểm thử self-test đạt 4/4 kịch bản; Vite production bundle pass trong 8.38s.

---

### 2026-09-20 — Form Designer & Process Editor: Fix Form Reload from DB on Modified Form ID Save

**Scope:** 3 files (`FormBuilder.tsx`, `ProcessEditor.tsx`, `DESIGN_FORM_DESIGNER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 (`FormBuilder.tsx`, `ProcessEditor.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc` x 1 + `vite` 9.39s) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Khắc phục triệt để hiện tượng form bị unmount và hiển thị màn hình tải lại DB ("Loading form template from database...") khi người dùng sửa Form ID và lưu lại.
- Trong `FormBuilder.tsx`, thay thế `setLoading(true/false)` bằng `setSaving(true/false)` trong các khối kiểm tra trùng phiên bản của `handleSaveDraft` và `handlePublish`, giữ nguyên 100% canvas giao diện trong khi nút Save hiển thị trạng thái `Saving...`.
- Bổ sung guard ref `initialLoadDoneRef` đảm bảo `fetchFormTemplate` chỉ chạy 1 lần khi cold mount, ngăn chặn các đợt re-fetch dư thừa khi props thay đổi.
- Trong `ProcessEditor.tsx`, quản lý phiên làm việc bằng `formBuilderSessionId` ổn định thay cho `key={activeFormToBuild}`, triệt tiêu hiện tượng React huỷ bỏ và remount lại FormBuilder khi Form ID đổi.
- TypeScript (`tsc`) và Vite production bundle pass 100% trong 9.39s.

---

### 2026-09-20 — Form Designer & Translation: FormTranslator Module & 3S-QC/Q1.1e Ingestion

**Scope:** 8 files (`scripts/formTranslator/*`, `DESIGN_FORM_DESIGNER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa / tạo mới | 8 |
| Lượt edit source (rework) | 2 |
| Số lần build / test | 4 (1 self-test rework + 1 pass + 1 tsc + 1 vite 10.52s) |
| Lần build đầu thành công? | Có (100% build pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Xây dựng hoàn chỉnh phân hệ dùng lại `scripts/formTranslator/` theo kiến trúc chia tách rành mạch: kịch bản xác định (`extractor.cjs`, `reconstitutor.cjs`, `dbAdapter.cjs`) bọc ngoài bảo vệ cấu trúc, LLM (`llmInstructions.cjs`, `llmClient.cjs`) đảm nhiệm dịch thuật ngữ chuyên ngành QC/ISO 9001 và thương mại nông sản.
- Thuật toán bóc tách AST chỉ xuất ra từ điển văn bản thuần (`{ path -> text }`), triệt tiêu 100% rủi ro LLM làm sai lệch ID kỹ thuật (`fld_*`, `locationCode`, `row_*`), types hoặc các giá trị enum database (`PASS`, `FAIL`, `OPT_*`).
- Cơ chế kiểm định bất biến (`assertInvariants`) tự động chặn mọi vi phạm trước khi ghi database.
- Tự động bóc tách 48 chuỗi tiếng Việt của biểu mẫu `3S-QC/Q1.1e`, dịch chính xác sang tiếng Anh chuẩn công nghiệp (`Order Information`) và cập nhật thành công vào bảng `forms` trên PostgreSQL Supabase.
- Kiểm thử self-test đạt 4/4 kịch bản; Vite build hoàn tất trong 10.52s.

---

### 2026-09-18 — Dashboard & Platform Shell: Fix Duplicated Form Process Re-linking

**Scope:** 4 files (`formUtils.ts`, `Dashboard.tsx`, `server.cjs`, `DESIGN_PLATFORM_SHELL.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 3 (`formUtils.ts`, `Dashboard.tsx`, `server.cjs`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`tsc` x 2 + `vite` 10.13s) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- Khắc phục triệt để lỗi biểu mẫu sau khi nhân bản (duplicate) bị unlinked khỏi quy trình cha.
- Sửa lỗi sai lệch endpoint & method trong `Dashboard.tsx`: thay thế `PUT /api/processes/:id` (bị 404) bằng `POST /api/processes` đúng chuẩn hệ thống và bổ sung bắt lỗi nghiêm ngặt.
- Định vị chuẩn xác quy trình cha chứa form gốc trong mảng `processes`, tránh lệch phiên bản với `getRepresentative`.
- Trích xuất pure utility `linkDuplicatedFormToSteps` trong `formUtils.ts` (Rule 13.8) tự động gán Form ID nhân bản vào các bước liên quan.
- Thêm route alias phòng vệ `app.put('/api/processes/:id')` trong `server.cjs`.
- Build TypeScript (`tsc`) và Vite production bundle thành công 100% trong 10.13s.

---

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
