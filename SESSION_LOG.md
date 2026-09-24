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
| 16 | `LOGIC` | Truyền `row.id` đơn lẻ khi click canvas thay vì composite ID (`${blockId}_${rowId}_${colId}`) khiến registry lookup trả về `undefined` | Luôn dùng composite ID resolver helper (`getTableFieldId`, `getTableRowPrimaryFieldId`) khớp quy ước định danh của extractor | 1 |
| 17 | `LOGIC` | `updateRuleOverride` silent abort khi `layoutBlocks` rỗng hoặc chưa gán trường vào khối khiến controlled inputs (Score, Weight) không thể chỉnh sửa | Xây dựng Smart Target Block Resolution (5 tầng ưu tiên) kết hợp Auto-Initialization khối Table cho Section H2 | 1 |

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

### 2026-09-24 — Report Builder: Smart Target Block Resolution & Auto-Initialization for Field Scoring & Weights

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `src/components/report/FieldScoringInspector.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~13.5 min |
| Thời gian phân tích (Request → Proceed) | ~9.0 min |
| Thời gian thực thi (Proceed → Push) | ~4.5 min |
| Số file nguồn chỉnh sửa | 2 (`ReportBuilder.tsx`, `FieldScoringInspector.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Giải quyết triệt để lỗi không chỉnh sửa được Score và Weight:** Xác định chính xác nguyên nhân gốc do `updateRuleOverride` bị silent abort (`if (!targetBlock) return prev;`) khi người dùng chỉnh sửa trường từ Form canvas trước khi thêm khối vào báo cáo (hoặc khi `template.layoutBlocks` rỗng `[]`). Do state không đổi, React controlled input lập tức reset về giá trị mặc định.
- **Smart Target Block Resolution (5 tầng ưu tiên):** Xây dựng thuật toán phân giải khối thông minh: Ưu tiên 1 (khối đã chứa `fieldId`), Ưu tiên 2 (khối đã có `ruleOverrides`), Ưu tiên 3 (khối Table có tiêu đề trùng `parentGroupTitle`), Ưu tiên 4 (`activeBlock`), và Ưu tiên 5 (**Auto-Initialization**: Tự động tạo khối Table cho nhóm câu hỏi nếu chưa có khối nào trong báo cáo).
- **Đồng bộ hóa Trạng thái Kích hoạt:** Bổ sung `setActiveBlockId(null)` khi click chọn trường từ Left Panel và gán `key={selectedField.id}` cho `FieldScoringInspector` đảm bảo đồng bộ hoàn hảo giữa canvas và danh sách.
- **Nhập liệu Mượt mà:** Tinh chỉnh các ô nhập Score và Weight hỗ trợ xóa trắng và gõ số tự do mà không bị kẹt hay cưỡng bức về 0 tức thì.
- **Chất lượng mã nguồn:** `npx tsc --noEmit` pass 100% không lỗi; `npm run build` Vite production bundle hoàn thành trong 11.91s.

---

### 2026-09-24 — Report Builder: Field Properties Weight of Section 2-Row Structured Layout

**Scope:** 2 files (`src/components/report/FieldScoringInspector.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8.0 min |
| Thời gian lập plan & mockup (Request → Proceed) | ~5.0 min |
| Thời gian thực thi (Proceed → Push) | ~3.0 min |
| Số file nguồn chỉnh sửa | 1 (`FieldScoringInspector.tsx`) |
| Tổng lượt edit source | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Nâng cấp Bố cục Thẻ Thuộc tính Câu hỏi (Field Properties Layout):** Triển khai theo Option 1 được người dùng phê duyệt từ 4 phương án mockup giao diện. Tái cấu trúc thanh thuộc tính dưới cùng thành card 2 hàng phân tầng: Hàng 1 gồm toggle `[ ] isKnockout` kèm phụ đề `"Loại trực tiếp"`; Hàng 2 gồm ô nhập `Weight: [ xx ] %` đi kèm badge ngữ cảnh nhóm cha `of [ {parentGroupTitle} ]` với chữ xanh Teal đậm, có tự động rút gọn `truncate` và `title` tooltip đầy đủ.
- **Tối ưu Không gian Thanh bên:** Giải quyết triệt để vấn đề chật chội trên Right Inspector (~310px) khi tên nhóm cha dài, giữ bố cục thoáng đãng và trực quan.
- **Chất lượng mã nguồn:** `npx tsc --noEmit` pass 100% không lỗi; `npm run build` Vite production bundle thành công trong 12.84s.

---

### 2026-09-24 — Report Builder: Interactive Canvas Selection for Table Properties & H2 Group Headers

**Scope:** 3 files (`src/components/report/FormReferenceCanvas.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7.0 min |
| Thời gian lập plan (Request → Proceed) | ~2.5 min |
| Thời gian thực thi (Proceed → Push) | ~4.5 min |
| Số file nguồn chỉnh sửa | 2 (`FormReferenceCanvas.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Giải quyết triệt để lỗi chọn Table Properties từ Canvas:** Khắc phục lỗi click dòng tiêu đề nhóm bảng (`row.isGroupHeader`) hoặc tiêu đề bảng chỉ gửi ID form block cũ khiến `activeBlock` bị `undefined`. Xây dựng `handleSelectTableGroupFromCanvas` liên kết chính xác tên nhóm với `hierarchyGroups` và gọi `handleSelectH2Subgroup` đồng bộ 100% với Left Panel.
- **Tương tác 2 Chiều Form Canvas & Report Canvas:** Hỗ trợ click vào dòng tiêu đề nhóm hoặc tiêu đề bảng/thead để mở ngay `Table Properties` bên Right Inspector; click vào tiêu đề phân đoạn H1 mở ngay `Section Label Properties`.
- **Chỉ báo trực quan nổi bật:** Dòng tiêu đề nhóm trên Form canvas hiển thị viền nổi bật `borderLeft: 4px solid #2563eb`, nền `#eff6ff` và text xanh đậm khi nhóm tương ứng đang active; con trỏ chuột chuyển sang `cursor: 'pointer'`.
- **Đồng bộ hóa trên Report Canvas:** Nâng cấp `InCanvasTitleHeader`, block wrapper và `<thead>` xóa sạch `selectedFieldId = null` và chuyển sang `setRightTab('properties')`, giúp người dùng dễ dàng chuyển đổi linh hoạt giữa `FIELD PROPERTIES` của câu hỏi con và `Table Properties` của bảng cha.
- **Chất lượng mã nguồn:** `npx tsc --noEmit` pass 100% không lỗi; `npm run build` Vite production bundle thành công trong 19.70s.

---

### 2026-09-24 — Report Builder: Interactive Canvas Selection for Table Likert Scale Questions

**Scope:** 4 files (`src/utils/tableFieldExtractor.ts`, `src/components/report/FormReferenceCanvas.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8.5 min |
| Thời gian lập plan (Request → Proceed) | ~3.0 min |
| Thời gian thực thi (Proceed → Push) | ~5.5 min |
| Số file nguồn chỉnh sửa | 3 (`tableFieldExtractor.ts`, `FormReferenceCanvas.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 8 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 4 (3 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Giải quyết lỗi chọn trường bảng từ Canvas:** Khắc phục triệt để lỗi click hàng Likert scale chỉ gửi `row.id` dẫn đến `allFormFields.find()` trả về `undefined`. Xây dựng các hàm tiện ích chuẩn (`getTableFieldId`, `getTableRowPrimaryFieldId`, `isFieldInTableRow`) để map chính xác ID composite `${block.id}_${row.id}_${col.id}`.
- **Tương tác cấp hàng và cấp ô (Row & Cell Interaction):** Hỗ trợ click vào hàng bảng để kích hoạt câu hỏi Likert scale chính của hàng, hoặc click trực tiếp vào ô input cụ thể để chọn trường chi tiết. Tự động chuyển Right Inspector sang tab `properties` và mở `FIELD PROPERTIES` (Scoring matrix, knockout, weight, option values).
- **Chỉ báo trực quan tinh gọn (Visual Highlights):** Đường viền `borderLeft: 3px solid var(--primary)` và nền nhạt `rgba(13, 148, 136, 0.08)` cho hàng được chọn; viền nổi inset `boxShadow` và nền `rgba(13, 148, 136, 0.16)` cho ô input được chọn.
- **Đồng bộ hóa 2 chiều trên Report Canvas:** Bổ sung xử lý click chọn và active highlight tương tự cho các khối `TABLE` và `INFO_GRID` trên tab Report.
- **Chất lượng mã nguồn:** `npx tsc --noEmit` pass 100% không lỗi; `npm run build` Vite production bundle thành công trong 17.95s.

---

### 2026-09-23 — Report Builder: FormReferenceCanvas FormBuilder-Parity Rewrite

**Scope:** 3 files (`src/components/report/FormReferenceCanvas.tsx`, `DESIGN_REPORT_BUILDER.md`, `walkthrough.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~15.6 min |
| Thời gian lập plan (Request → Proceed) | ~9.5 min |
| Thời gian thực thi (Proceed → Push) | ~6.1 min |
| Số file nguồn chỉnh sửa | 1 (`FormReferenceCanvas.tsx`) |
| Tổng lượt edit source | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc` + `vite` 12.09s) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Đồng bộ trung thực 100% (FormBuilder WYSIWYG Parity):** Tái cấu trúc hoàn toàn `FormReferenceCanvas.tsx`, chuyển đổi toàn bộ cấu trúc paper sheet thành `maxWidth: 820px` (A4) / `920px` (A5), `padding: 2.5rem`, `minHeight: 1050px`, `gap: 0px`.
- **Triệt tiêu khoảng cách Block Margin-Top:** Đặt `marginTop: 0px` cho toàn bộ các block theo đúng chỉ đạo người dùng, triệt tiêu hoàn toàn khoảng cách lồi lõm không đồng đều.
- **Footer chuẩn FormBuilder:** Khớp định dạng chân trang `formId || 'PENDING'` và `formatFormVersion(version, status, effectiveDate, updatedAt)`.
- **Type-Aware Field Rendering & Table Colgroup Parity:** Hỗ trợ render đầy đủ mọi loại trường (`photo`, `text`/`number`, `date`/`time`, `rating`/`likert_scale`, `radio`/`checkbox`, `select`, `subtable`) và định dạng bảng chuẩn (`tableLayout: fixed`, `<colgroup>` với `getColStyleWidth`, `hideHeader` mờ thead, group header resolution, `getEffectiveCellOptions`, và MATRIX_TABLE demo).
- **Chất lượng mã nguồn:** TypeScript compilation pass 100% không lỗi, Vite production bundle hoàn tất trong 12.09s.

---

### 2026-09-23 — Report Builder: Dual Tab Canvas [ Form | Report ] & Form Reference Canvas Sub-Component

**Scope:** 4 files (`src/components/report/FormReferenceCanvas.tsx`, `ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `walkthrough.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~9.5 min |
| Thời gian lập plan (Request → Proceed) | ~5.8 min |
| Thời gian thực thi (Proceed → Push) | ~3.5 min |
| Số file nguồn chỉnh sửa / tạo mới | 2 (`ReportBuilder.tsx`, `FormReferenceCanvas.tsx`) |
| Tổng lượt edit source | 4 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (2 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Canvas 2 Trang [ Form | Report ] (Minimal Tab Switcher):** Tái cấu trúc Center Canvas thành 2 chế độ xem trang đơn A4 độc lập `Form` và `Report`, loại bỏ chế độ split view rườm rà.
- **Trích xuất Sub-Component `FormReferenceCanvas.tsx` (Rule 4.3 Monolith Guard):** Đóng gói toàn bộ logic render trang mẫu biểu WYSIWYG gốc của form nguồn (ISO Title, Info Grid, Section Labels H1/H2, Tables với `isGroupHeader` và `tableData`, Sign block, Form footer) ra file riêng `src/components/report/FormReferenceCanvas.tsx`.
- **Khớp dữ liệu thực tế 5C-Scorecard:** Hỗ trợ chuẩn xác cấu trúc bảng động với các hàng nhóm tiêu đề (`row.isGroupHeader`, `row.groupTitle`) phân chia theo 6 Trụ cột chiến lược của Form 5C-Scorecard.
- **Tương tác trực tiếp:** Cho phép click chọn trường từ trang Form gốc và click ra lề giấy để bỏ chọn về Report Properties.

---

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

