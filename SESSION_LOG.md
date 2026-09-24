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
| 18 | `BLOAT` | Trích xuất utility tổng hợp điểm (`summarizeH1ChildGroups`) nhưng vẫn import hàm con (`computeH1CombinedScore`) vào component cha → TS6133 unused import | Khi bọc logic vào pure utility cấp cao hơn, xóa ngay các imports cấp thấp không còn được gọi trực tiếp trong component | 1 |
| 19 | `LOGIC` | Gọi `form.title` thay vì `form.formTitle` trên `FormTemplateISO` hoặc truyền Raw Block ID từ `FormReferenceCanvas` vào `setActiveBlockId` mà không ánh xạ sang `template.layoutBlocks` | Luôn kiểm tra tên trường chuẩn (`formTitle` vs `reportTitle`) và ánh xạ qua `handleSelectBlockFromFormCanvas` để đồng bộ ID khối giữa Form gốc và Report template | 1 |

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

### 2026-09-24 — Report Builder: Strict 4-Tier Hierarchy (`H1` ➔ `H2` strictly `titleFormat === 'H2'` ➔ `Element` ➔ `Field`)

**Scope:** 4 files (`src/utils/tableFieldExtractor.ts`, `src/utils/reportScoring.ts`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~24.0 min |
| Thời gian lập plan (Request → Proceed) | ~4.0 min |
| Thời gian thực thi (Proceed → Push) | ~20.0 min |
| Số file nguồn chỉnh sửa | 3 (`tableFieldExtractor.ts`, `reportScoring.ts`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 4 (`3 tsc` + `1 vite build` pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Định nghĩa lại cấp `H2` nghiêm ngặt (`titleFormat === 'H2'`):** Loại bỏ hoàn toàn việc các khối `TABLE` bình thường (`titleFormat: undefined | 'NONE'`) và dòng `groupHeader` trong bảng tự ý ghi đè `sectionH2` trong `tableFieldExtractor.ts`. Khôi phục đầy đủ các phân mục `H2` thực sự (`Sản phẩm`, `Văn hóa doanh nghiệp`, `Năng lực cốt lõi`, `Hạ tầng & Công nghệ`, `Đặc trưng nhân sự`).
- **Phân cấp `Element / Table` xuống một cấp dưới `H2`:** Bổ sung `ElementHierarchyGroup` (`h2Group.elements` dưới `H2` và `directElements` dưới `H1`), hiển thị các khối `[TABLE]` thụt lề một cấp bên dưới `[H2]` trên cây `FIELDS` và Quick Field Picker Modal, đồng thời bổ sung bảng `TỔNG HỢP ĐIỂM PHÂN MỤC H2` (`summarizeH2ChildElements`) trong `H2 Section Properties`.

---

### 2026-09-24 — Report Builder: 2-Step Design Principle (`Build Layout First → Arrange Fields Into Layout`) for `TITLE` & `INFO_GRID` Blocks

**Scope:** 4 files (`src/components/report/FormReferenceCanvas.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~18.0 min |
| Thời gian lập plan (Request → Proceed) | ~5.0 min |
| Thời gian thực thi (Proceed → Push) | ~13.0 min |
| Số file nguồn chỉnh sửa | 2 (`FormReferenceCanvas.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 16 |
| Lượt edit sửa lỗi (rework) | 2 |
| Số lần build | 5 (3 tsc + 2 vite pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Thực thi Nguyên tắc Thiết kế 2 Bước ("Tạo Layout Block trước → Bố trí Field vào Layout Block") cho cả `TITLE` và `INFO_GRID`:**
  - **Bước 1 (Dựng Layout Block Shell & Cấu trúc Lưới):** Xây dựng `renderLayoutBlockShell` và `syncHeaderAndInfoGridBlocksFromForm` để dựng đầy đủ khung `TITLE` (4 slots: Logo, `<h1>`, `<p>`, Ngày tháng) và từng khối `INFO_GRID` độc lập theo đúng thiết kế của Form nguồn (`INFO_GRID #1` có `titleFormat: 'H1'`, `columns: 2`, tỷ lệ cột `[65, 35]`; `INFO_GRID #2` có `titleFormat: 'NONE'`, `columns: 2`, tỷ lệ cột `[50, 50]`).
  - **Bước 2 (Bố trí Field vào từng Ô Lưới — Field Slots):** Nạp chính xác `boundFieldIds` của từng khối `INFO_GRID` (`['ten_doanh_nghiep', 'msdn']` vào `INFO_GRID #1`; `['loai_hinh', 'nganh_hang_chinh', 'thi_truong', 'nang_luc_cung']` vào `INFO_GRID #2`), áp dụng `rowSpan`, `colSpan`, viền `1px dotted #cbd5e1` và hiển thị trực quan các lựa chọn `checkbox` / `radio` / `select` trên cả tab `Form` và `Report`.
- **Liên kết 1-1 Độc lập giữa các Khối `INFO_GRID`:** Khớp chính xác từng khối `INFO_GRID` theo `boundFieldIds` và thứ tự khối (thay vì chỉ khớp theo `title`), đồng bộ cả trong DB PostgreSQL (`RP-5C-Scorecard`).

---

### 2026-09-24 — Report Builder: Section Label H1 & H2 Properties Redesign & Scoring Roll-up Summary

**Scope:** 3 files (`src/utils/reportScoring.ts`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~18.0 min |
| Thời gian phân tích (Request → Proceed) | ~8.0 min |
| Thời gian thực thi (Proceed → Push) | ~10.0 min |
| Số file nguồn chỉnh sửa | 2 (`reportScoring.ts`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 6 |
| Lượt edit sửa lỗi (rework) | 2 |
| Số lần build | 3 (2 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tiêu đề Phân đoạn Động & Badge phân cấp [H1] / [H2]:** Header của Right Inspector tự động hiển thị `H1 SECTION PROPERTIES` với huy hiệu Teal hoặc `H2 SECTION PROPERTIES` với huy hiệu Blue tùy theo `activeBlock.titleFormat`, giải quyết hoàn toàn sự mơ hồ khi xem thuộc tính của nhãn phân đoạn.
- **Tiêu đề Liền mạch (Seamless Borderless Title Input):** Đặt ngay dưới header kèm icon bút chì `✎`, hỗ trợ click để sửa tên phân đoạn trực tiếp mà không tốn diện tích, đồng bộ phản hồi ngay lập tức trên canvas.
- **Bộ chuyển đổi Định dạng Tiêu đề (Title Format Pills):** Bổ sung cụm nút chọn viên thuốc `[ H1 | H2 | Body | None ]` cho phép người dùng thay đổi phân cấp trực tiếp ngay từ thanh thuộc tính Inspector.
- **Thẻ Trọng số 2 Hàng (Structured Weight Card):** Hàng 1 gồm switch `isKnockout (H1)` / `isKnockout (H2)` và nhãn `"Loại trực tiếp"`; Hàng 2 gồm ô nhập `Weight: [ xx ] %` và huy hiệu ngữ cảnh: với H1 là `of [ Toàn bộ Báo cáo ]`, với H2 tự động dò tìm Trụ cột H1 cha để hiển thị `of [ {parentH1ForH2} ]`.
- **Bảng Tổng hợp Điểm Trụ cột H1 (H1 Combined Scoring Summary Table):** Trích xuất logic tính điểm sang hàm thuần túy `summarizeH1ChildGroups` trong `src/utils/reportScoring.ts` (tuân thủ Rule 13.8). Hiển thị bảng tổng hợp điểm số chi tiết của tất cả các nhóm câu hỏi H2 con và điểm tổng kết có trọng số của toàn bộ Trụ cột H1.
- **Chất lượng mã nguồn:** `npx tsc --noEmit` pass 100% không lỗi; `npm run build` Vite production bundle thành công trong 18.79s.

---

### 2026-09-24 — Report Builder: Table Properties Streamlined Layout (Seamless Title, Combined Border & Header, 2-Row Weight Card)

**Scope:** 2 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~12.0 min |
| Thời gian phân tích (Request → Proceed) | ~8.0 min |
| Thời gian thực thi (Proceed → Push) | ~4.0 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 4 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (1 tsc + 1 vite pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tiêu đề bảng Liền mạch (Seamless Borderless Table Name):** Đặt ngay dưới tiêu đề `TABLE PROPERTIES` với icon bút chì `✎`. Bình thường phẳng không viền, khi focus/hover chuyển sang ô nhập có viền teal và shadow sắc nét, hỗ trợ đổi tên trực tiếp vào `layoutBlocks[].title`.
- **Gộp Border & Header trên cùng 1 hàng ngang (Biến thể 2A):** Rút gọn nhãn `Border Style` thành `"Border"`, tinh gọn nút chọn `[ Grid | Horiz | None ]` và đặt công tắc `Header` (ToggleSwitch) kế bên trên cùng một dòng ngang, tiết kiệm ~24px chiều dọc quý giá cho thanh sidebar inspector.
- **Cấu trúc Thẻ Trọng số H2 2 hàng (Đồng bộ Field Properties):** Chuyển đổi khối thuộc tính H2 sang định dạng thẻ 2 hàng: Row 1 hiển thị `[ ] isKnockout (H2)` và nhãn `"Loại trực tiếp"`; Row 2 hiển thị ô nhập `Weight: [ xx ] %` và huy hiệu `of [ {parentH1Title} ]` với thuật toán tự động giải quyết Trụ cột H1 cha đa tầng từ `boundFields`, `sectionH2` title matching và `hierarchyGroups`.

---

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


