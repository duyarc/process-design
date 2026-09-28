# Session Log — Bộ nhớ Phiên (Episodic Memory)

> File này là bộ nhớ dài hạn của agent. Đọc trước khi thực thi, cập nhật sau khi
> hoàn thành. Xem `AGENTS.md` Mục 13 để biết quy trình.

---

## Bài học Tích lũy

Danh sách lỗi đã gặp kèm biện pháp phòng ngừa. Agent đọc mục này trước mỗi
phiên thực thi để không lặp lại lỗi cũ.

| # | Nhóm | Lỗi | Biện pháp phòng ngừa | Lần gặp |
|---|---|---|---|---|
| 1 | `SCOPE` | Gom `npm run build` cuối cùng → lỗi tích lũy nhiều file, khó debug | Chạy `npx tsc --noEmit` sau mỗi file. Xem Mục 12.3 | 1 |
| 2 | `CTX` | Chuyển arrow func `=> (` sang `=> { return (` quên đổi closing `))` thành `); })}` hoặc patch tag ngắn thiếu context độc nhất trong file monolith | Patch đồng thời mở và đóng block hàm; luôn bao gồm ≥ 3 dòng context độc nhất xung quanh closing tag | 1 |
| 3 | `CTX` | Patch chunk quá dài (>100 dòng) trong file monolith lớn dễ bị fuzzy match lệch vị trí hoặc bỏ sót biến | Chia nhỏ patch thành các chunk tập trung (< 40-50 dòng) với context độc nhất. Đã tiến hóa thành quy tắc bắt buộc: Xem Mục 12.6 | 1 |
| 4 | `BLOAT` | Để sót dead code (hàm cũ, props cũ như `handleMoveColumn`) khi thay thế giải pháp mới | Tuân thủ Mục 13.7 Dead-Code Pruning: rà soát toàn bộ call-site và xóa sạch code cũ trong cùng commit | 1 |
| 5 | `BLOAT` | Xóa logic con dùng tham số callback mảng (`fArr` trong `.map((f, fIdx, fArr) => ...)`) nhưng bỏ sót trong chữ ký hàm → TS6133 unused declaration | Khi xóa tính năng hoặc dọn dead code, rà soát luôn tham số của closure bao quanh để lược bỏ biến không còn đọc | 1 |
| 6 | `CTX` | Khi patch code trong khối JS trước `return`, chèn comment JSX `{/* */}` gây syntax error; hoặc patch thẻ con thiếu mốc neo độc nhất | Luôn phân biệt ngữ cảnh JS thuần vs JSX khi viết comment (`//` vs `{/* */}`); dùng thẻ cha làm mốc neo khi patch thẻ con | 1 |
| 7 | `TOOL` | Chạy inline Node trên PowerShell chứa `$1` bị PowerShell ngậm biến `$1` thành chuỗi rỗng → SQL syntax error | Lưu code ra file `.cjs` tạm hoặc escape `\$1` trong chuỗi lệnh PowerShell | 1 |
| 8 | `SCOPE` | Biểu mẫu chứa text động trong `tableData` (pre-filled cells) hoặc `tableRows` (`groupTitle`) ngoài `tableColumns` | Luôn duyệt toàn diện cả `tableRows` (`groupTitle`), `tableData` (text cells), field `placeholder`, `reactionProtocol` khi bóc tách chuỗi | 1 |
| 9 | `LOGIC` | Hiểu nhầm "search" là truy xuất bộ nhớ nội bộ (internal reasoning) của LLM thay vì tra cứu không gian bên ngoài | Định nghĩa rõ: "Search" bắt buộc là tìm kiếm không gian bên ngoài (External Web Search) với các nguồn quy chuẩn xác thực, không dựa vào lập luận nội bộ của LLM | 1 |
| 10 | `SCOPE` | Hardcode danh sách quy chuẩn cố định (IMO, BRCGS, ISO 22000, APICS) làm thiên lệch vào dữ liệu mẫu | Khái quát hóa thành quy trình: "Search web theo ngữ cảnh form" (Context-Driven Web Search) dựa trên domain suy diễn động | 1 |
| 11 | `BLOAT` | Thêm text badges (Selected, Đã chọn, Active, hints) trùng lặp với visual indicator (màu sắc, border, icon) → UI bị rối | Áp dụng UI Streamlining Audit: Khi visual cues đã rõ ràng, triệt tiêu toàn bộ text badges phụ trợ để giữ UI tối giản | 1 |
| 12 | `LOGIC` | Truyền `row.id` đơn lẻ khi click canvas thay vì composite ID (`${blockId}_${rowId}_${colId}`) khiến registry lookup trả về `undefined` | Luôn dùng composite ID resolver helper (`getTableFieldId`, `getTableRowPrimaryFieldId`) khớp quy ước định danh của extractor | 1 |
| 13 | `LOGIC` | `updateRuleOverride` silent abort khi `layoutBlocks` rỗng hoặc chưa gán trường vào khối khiến controlled inputs (Score, Weight) không thể chỉnh sửa | Xây dựng Smart Target Block Resolution (5 tầng ưu tiên) kết hợp Auto-Initialization khối Table cho Section H2 | 1 |
| 14 | `BLOAT` | Trích xuất utility tổng hợp điểm (`summarizeH1ChildGroups`) nhưng vẫn import hàm con (`computeH1CombinedScore`) vào component cha → TS6133 unused import | Khi bọc logic vào pure utility cấp cao hơn, xóa ngay các imports cấp thấp không còn được gọi trực tiếp trong component | 1 |
| 15 | `LOGIC` | Gọi `form.title` thay vì `form.formTitle` trên `FormTemplateISO` hoặc truyền Raw Block ID từ `FormReferenceCanvas` vào `setActiveBlockId` mà không ánh xạ sang `template.layoutBlocks` | Luôn kiểm tra tên trường chuẩn (`formTitle` vs `reportTitle`) và ánh xạ qua `handleSelectBlockFromFormCanvas` để đồng bộ ID khối giữa Form gốc và Report template | 1 |
| 16 | `BLOAT` | Thay thế sub-layout cũ (như thanh toolbar text format) làm sót import helper (`applyTextFormat`) ở đầu file → TS6133 unused import khi build production | Khi dọn dẹp cụm UI/control cũ, kiểm tra ngay đầu file để loại bỏ import của các helper chỉ dùng riêng cho control đó | 1 |
| 17 | `CTX` | Khi lồng conditional JSX (`ternary ? :`), đóng nhầm thẻ `</div>` của wrapper cha bên ngoài → TS17015 expected closing tag | Kiểm tra kỹ cấu trúc mở/đóng thẻ của wrapper cha trước khi chèn ternary; bọc fragment độc lập cho từng nhánh | 1 |
| 18 | `LOGIC` | Trùng tên giữa Section H2 cha và khối TABLE con khiến hàm tìm kiếm lầm tưởng là click vào Section H2 (Name Shadowing Collision) | Tách riêng luồng sự kiện theo bản chất đối tượng: click vào vỏ/thead khối dùng onSelectBlock; chỉ dùng onSelectTableGroup cho các hàng group header thực sự, và luôn ưu tiên tìm kiếm Element con trước Section cha | 1 |
| 19 | `LOGIC` | updateRuleOverride tìm targetBlock theo tiêu đề (cleanGroup) mà không lọc theo loại khối (b.type), dẫn đến lưu nhầm ruleOverrides vào SECTION_LABEL | Bắt buộc áp dụng Strict Block Type Scoping: trường thuộc TABLE thì chỉ gán vào khối TABLE; trường thuộc INFO_GRID thì chỉ gán vào INFO_GRID | 1 |
| 20 | `SCOPE` | `extractTableFields` chỉ đọc `col.options` mà bỏ qua `block.cellOptionsMap` khiến trường bóc tách rơi về giá trị mặc định của cột (Có/Không) thay vì các tùy chọn tùy biến của ô | Luôn dùng `getEffectiveCellOptions(block.cellOptionsMap, row.id, col.id, col.options)` và `cellPlaceholderMap` khi duyệt trích xuất các ô trong khối `TABLE` | 1 |
| 21 | `SCOPE` | Khi sửa lỗi lệch bố cục trên `FormReferenceCanvas` (`tab Form`), đánh đồng việc hiển thị dữ liệu `sampleSubmission` với lỗi ghi đè cấu trúc `matchedReportBlock` dẫn đến xóa nhầm tính năng xem dữ liệu bản nộp | Phân tách rõ 2 tầng trách nhiệm trên `FormReferenceCanvas`: (1) Cấu trúc & Bố cục (`layoutBlocks`, `fields`, `titleFormat`, `showDate`) luôn lấy 1:1 từ `form` gốc; (2) Giá trị hiển thị trong ô nhập liệu đọc từ `sampleSubmission` để hỗ trợ cấu hình chấm điểm | 1 |

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

### 2026-09-28 — Report Builder: Bản In Đặc tả Công thức, Trọng số & Quy luật Chấm điểm từ `tab Form` (`Biến thể 2A` + `Option 1 [X% of Parent]`) (`reportScoring`, `PrintFormScoringSpec`, `ReportBuilder`)

**Scope:** 5 files (`src/utils/reportScoring.ts`, `src/components/print/PrintFormScoringSpec.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~9.5 min |
| Thời gian lập plan (Request → Proceed) | ~2.0 min |
| Thời gian thực thi (Proceed → Push) | ~7.5 min |
| Số file nguồn chỉnh sửa | 3 (`reportScoring.ts`, `PrintFormScoringSpec.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 3 (đồng bộ tên trường `ReportFieldRuleOverride` & `TableRowConfig`) |
| Số lần build | 3 (`tsc --noEmit` + `npm run build` 13.60s pass) |
| Lần build cuối thành công? | Có |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Pure Utility `buildFormScoringBlueprintMap` (`src/utils/reportScoring.ts` — Rule 4.1):** Tính toán toàn bộ trọng số 4 tầng kèm nhãn tham chiếu cấp cha động (`[35% of Form]`, `[50% of H1]`, `[100% of H2]`, `[40%• of Bảng]` — tự động thích ứng khi biểu mẫu khuyết `H1` hoặc khuyết `H2`) và chuẩn hóa dữ liệu đáp án `InlineAnswerKeySpec` cho mọi kiểu trường (`radio`, `select`, `likert_scale`, `rating`, `checkbox`, `number`, `text`).
- **Component In Đặc tả Độc lập `PrintFormScoringSpec.tsx` (`src/components/print/PrintFormScoringSpec.tsx` — Rule 4.3 Monolith Guard):** Kết xuất trực tiếp trên nền bố cục Biểu mẫu gốc (`Biến thể 2A: Inline Answer-Key`) kèm thanh công thức 2 dòng, ký hiệu `◉ Đậm · Điểm` (ĐẠT) / `○ Mờ · Điểm` (TRƯỢT), huy hiệu `[KO]`, hỗ trợ cả `Ctrl+P` và xuất file PDF vector (`exportFillablePdfFromDOM`).
- **Điều hướng In ấn Thông minh theo Ngữ cảnh Tab (`ReportBuilder.tsx`):** Khi đang ở `tab Form` bấm `Print` / `PDF` sẽ mở `<PrintFormScoringSpec />`; khi đang ở `tab Report` bấm `Print` / `PDF` sẽ mở `<PrintReport />`.

---

### 2026-09-28 — Report Builder: Tối giản Cây `FIELDS` Sidebar Trái (`Option A` Cấp Nhóm + `Option B` Cấp Trường) & Gán Nhóm bằng Kéo-Thả (`ReportBuilder`)

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7.0 min |
| Thời gian lập plan (Request → Proceed) | ~4.5 min |
| Thời gian thực thi (Proceed → Push) | ~2.5 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`tsc --noEmit` + `npm run build` 13.58s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tối giản cấp Nhóm (`Option A` — giải phóng `68px`–`98px` chiều ngang):** Loại bỏ icon `<Layers />` và nút `[+ Gán cả H1]` (`82px`) ở cấp `H1`; loại bỏ icon `<Folder />` / `<FolderOpen />` (cùng import dư thừa trong `lucide-react`) và nút `[+ Cả H2]` (`60px`) ở cấp `H2`; loại bỏ badge chữ `[TABLE]` trùng lặp (`45px`) và nút `[+ Bảng]` (`52px`) ở cấp `Element`; thay thế dấu ngoặc đơn `(count)` bằng số đếm `tabular-nums` gọn sát lề phải.
- **Tối giản cấp Trường đơn lẻ (`Option B` — giải phóng `65px`–`85px` chiều ngang):** Thay thế chấm kéo `⠿` ở đầu dòng và nhãn chữ kiểu dữ liệu rộng ở cuối dòng (`[CHECKBOX]` `64px`, `[DROPDOWN]` `66px`, `[TEXT]` `38px`) bằng icon kiểu dữ liệu màu ngữ nghĩa `13px` (`<TypeIcon />` từ `getFieldTypeOption` + `badgeStyle.color`) ở đầu dòng kết hợp badge tần suất `x{usageCount}` (`tabular-nums`) gọn sát lề phải.
- **Bảo toàn 100% tính năng gán cả nhóm trường bằng Kéo-Thả (`application/x-report-group-fields`):** Tích hợp payload `application/x-report-group-fields` (`fieldIds`) kèm trạng thái `setIsDraggingField(true)` trên cả 3 cấp `H1`, `H2`, `Element`, cho phép kéo-thả trực tiếp bất kỳ mục/bảng nào vào khối `INFO_GRID` hoặc `TABLE` trên Canvas (hoặc vào dropzone của Right Inspector) để gán hàng loạt toàn bộ trường thông qua `addMultipleFieldsToBlock`.

---

### 2026-09-28 — Report Builder: Khắc phục Hiển thị Đa cột (`Columns = 2, 3`) của `INFO_GRID` trên Canvas & Đồng bộ Bố cục với `FormBuilder` (`ReportBuilder`, `RadarChartBlock`, `BarChartBlock`, `FormReport`)

**Scope:** 6 files (`src/components/ReportBuilder.tsx`, `src/components/report/RadarChartBlock.tsx`, `src/components/report/BarChartBlock.tsx`, `src/components/FormReport.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~11.0 min |
| Thời gian lập plan (Request → Proceed) | ~6.5 min |
| Thời gian thực thi (Proceed → Push) | ~4.5 min |
| Số file nguồn chỉnh sửa | 4 (`ReportBuilder.tsx`, `RadarChartBlock.tsx`, `BarChartBlock.tsx`, `FormReport.tsx`) |
| Tổng lượt edit source | 6 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` + `npm run build` 17.17s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Đồng bộ Grid Container của `INFO_GRID` với `FormBuilder` (`getInfoGridTemplateColumns`):** Loại bỏ nhánh ternary `items === 0` từng bỏ qua CSS Grid và chỉ vẽ 1 thẻ `<div>` 1 cột. Giờ đây `INFO_GRID` luôn khởi tạo `<div style={{ display: 'grid', gridTemplateColumns: getInfoGridTemplateColumns(block) }}>` ở mọi trạng thái và đồng bộ `getInfoGridTemplateColumns` sang cả `FormReport.tsx`.
- **Hiển thị trực quan các ô Slot `+ Thả vào đây` theo đúng số cột `block.columns`:** Khi `Columns = 2` (hoặc `3`), Canvas hiển thị ngay 2 (hoặc 3) ô `+ Thả vào đây` nằm cạnh nhau theo đúng tỷ lệ `columnWidths` (`50% | 50%`, `30% | 70%`, ...); khi mới thả 1 phần tử vào cột 1, cột 2 bên phải vẫn hiển thị ô `+ Thả vào đây`.
- **Gỡ `gridColumn: '1 / -1'` trên `RadarChartBlock` & `BarChartBlock`:** Cho phép đặt 2 biểu đồ nằm cạnh nhau trong `INFO_GRID` 2 cột hoặc kết hợp trường thông tin ở cột trái và biểu đồ ở cột phải.

---

### 2026-09-28 — Report Builder: Cơ chế Trọng số Tự động Cân bằng 4 Tầng (`Zero-Sum Auto-Balance`), Khóa Thủ công (`isWeightManual`), Nút Reset `↺` & Đôn Cấp Khuyết (`Skip-Level Promotion`) (`reportScoring`, `reportCompute`, `FieldScoringInspector`, `ReportBuilder`, `types`)

**Scope:** 7 files (`src/types.ts`, `src/utils/reportScoring.ts`, `src/utils/reportCompute.ts`, `src/components/report/FieldScoringInspector.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~26.5 min |
| Thời gian lập plan (Request → Proceed) | ~16.8 min |
| Thời gian thực thi (Proceed → Push) | ~9.7 min |
| Số file nguồn chỉnh sửa | 5 (`types.ts`, `reportScoring.ts`, `reportCompute.ts`, `FieldScoringInspector.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 20 |
| Lượt edit sửa lỗi (rework) | 0 (`tsc --noEmit` pass 100% ở mọi bước) |
| Số lần build | 6 (`tsc --noEmit` x5 + `npm run build` 8.37s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tự động cân bằng trọng số thông minh 4 tầng (`resolveSmartGroupWeights` & `distributeIntegerTotal`):** Toàn bộ 4 cấp (`Form -> H1 -> H2 -> Table -> Field`) mặc định chia đều `100%` cho các phần tử `AUTO` (`!isWeightManual`). Khi người dùng chỉnh sửa tay bất kỳ phần tử nào (kể cả nhập `0%`), phần tử đó tự động gắn cờ `isWeightManual: true` (khóa cứng, không bao giờ bị ghi đè), và phần dư `Math.max(0, 100 - sum(manualWeights))` tự động chia đều cho các phần tử `AUTO` còn lại trong cùng nhóm.
- **Tự động Đôn Cấp khi khuyết tầng (`Skip-Level / Tier Promotion` trong `resolveFormTopLevelGroups` & `summarizeH1ChildGroups`):** Xử lý trọn vẹn biểu mẫu khuyết `H1` (`Form -> H2` với tổng `H2 = 100%`), khuyết cả `H1` & `H2` (`Form -> Bảng` với tổng `Bảng = 100%`), hoặc `H1` khuyết `H2` (`H1 -> Bảng`). Thẻ kéo ở đầu cây `FIELDS` tự động đổi nhãn (`[N H1]` / `[K H2]` / `[M Bảng]`).
- **Nhận diện trực quan không nở dòng (`Zero Layout Shift`) & Nút `↺` 1-Click Reset:** Ô `<SmartNumberInput>` đã chỉnh tay (`isWeightManual === true`) đổi viền Teal đậm và nền `#f0fdfa` trên đúng kích thước `32px x 22px`; tiêu đề cột `Weight` và thẻ `Weight (%)` đơn lẻ hiển thị nút `↺` (`RotateCcw`) cho phép khôi phục về chia đều tự động chỉ với 1 cú click.

---

### 2026-09-28 — Report Builder: Sửa lỗi cắt chữ trục Radar Chart (`wrapSvgAxisLabel`) & Gỡ Title hardcode `"Thông tin chung"` của `INFO_GRID` (`reportChartUtils`, `RadarChartBlock`, `ReportBuilder`, `PrintReport`)

**Scope:** 6 files (`src/utils/reportChartUtils.ts`, `src/components/report/RadarChartBlock.tsx`, `src/components/ReportBuilder.tsx`, `src/components/print/PrintReport.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~9.0 min |
| Thời gian lập plan (Request → Proceed) | ~2.5 min |
| Thời gian thực thi (Proceed → Push) | ~6.5 min |
| Số file nguồn chỉnh sửa | 4 (`reportChartUtils.ts`, `RadarChartBlock.tsx`, `ReportBuilder.tsx`, `PrintReport.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`tsc --noEmit` x2 + `npm run build` 11.53s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Ngắt dòng cân đối nhãn trục Radar Chart (`wrapSvgAxisLabel`):** Tự động tách các nhãn trục dài thành 2 dòng `<tspan>` tại khoảng trắng gần điểm giữa nhất (kết hợp mở rộng `viewBoxWidth = 640` và `overflow: 'visible'`), triệt tiêu hoàn toàn hiện tượng cắt chữ ở mép trái/phải của khung SVG.
- **Khởi tạo `INFO_GRID` sạch 100% (`title = ''`, `titleFormat = 'NONE'`):** Gỡ bỏ tiêu đề hardcode `"Thông tin chung"` trong `handleAddBlock` và tự động ẩn tiêu đề mặc định cũ trên các khối `INFO_GRID` trống/chỉ chứa biểu đồ.

---

### 2026-09-28 — Report Builder: Vẽ Biểu đồ từ Toàn bộ `H1` (Cách A), Kéo thả `H1` Đơn lẻ & Cơ chế Accordion Toàn Sidebar (`ReportBuilder`, `RadarChartInspector`, `BarChartInspector`, `FormReferenceCanvas`)

**Scope:** 6 files (`src/components/ReportBuilder.tsx`, `src/components/report/RadarChartInspector.tsx`, `src/components/report/BarChartInspector.tsx`, `src/components/report/FormReferenceCanvas.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8.5 min |
| Thời gian lập plan (Request → Proceed) | ~4.5 min |
| Thời gian thực thi (Proceed → Push) | ~4.0 min |
| Số file nguồn chỉnh sửa | 3 (`RadarChartInspector.tsx`, `BarChartInspector.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 8 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` + `npm run build` 13.25s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Phân tách ngữ nghĩa 2 vùng thả (`Summary Row` vs `THÀNH PHẦN`) & Thẻ gốc Cách A (`{selectedForm.formTitle} [N H1]`):** Thả thẻ gốc biểu mẫu vào `Summary Row` sẽ tự động nạp toàn bộ các khối `H1` vào biểu đồ; thả một khối `H1` hoặc `H2` vào vùng `+ Kéo trường hoặc nhóm vào đây` sẽ thêm chính khối đó làm 1 trục đơn lẻ mà không bung cấp con.
- **Accordion 2 tầng trên toàn bộ Left Sidebar:** Tự động thu gọn `FIELDS` khi mở `CHARTS` (và ngược lại), đồng thời áp dụng Accordion đa cấp (`H1` ↔ `H2` ↔ `Element`) bên trong cây `FIELDS` giúp người dùng tập trung tối đa vào nhánh đang thao tác.
- **Khôi phục `sampleSubmission` trên `tab Form` & Khởi tạo trống `handleAddBlock`:** Giữ nguyên bố cục 1:1 với Form Builder đồng thời hiển thị dữ liệu bản nộp trên `FormReferenceCanvas.tsx` và dọn sạch pre-populate cứng khi thêm `INFO_GRID` / `TABLE`.

---

### 2026-09-27 — Report Builder: Radar & Bar Chart Components (`INFO_GRID` Blocks, Option B+D Hybrid Summary Drop-Slot & Two-Way Weight Sync)

**Scope:** 10 files (`src/types.ts`, `src/utils/reportChartUtils.ts`, `src/components/report/RadarChartBlock.tsx`, `src/components/report/BarChartBlock.tsx`, `src/components/report/RadarChartInspector.tsx`, `src/components/report/BarChartInspector.tsx`, `src/components/ReportBuilder.tsx`, `src/components/FormReport.tsx`, `src/components/print/PrintReport.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 15.3 min |
| Thời gian lập plan (Request → Proceed) | 8.7 min |
| Thời gian thực thi (Proceed → Push) | 6.6 min |
| Số file nguồn chỉnh sửa | 9 |
| Tổng lượt edit source | 12 |
| Lượt edit sửa lỗi (rework) | 2 (đồng bộ tên prop `chart` / `onUpdateChart` khi nối sub-components vào `ReportBuilder.tsx`) |
| Số lần build | 2 (`tsc -b && vite build` 10.11s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tách Sub-components & Pure Utilities (Rule 4.1 & Rule 4.3):** Tách hoàn toàn logic tính toán biểu đồ vào `src/utils/reportChartUtils.ts` và tách 4 sub-components độc lập (`RadarChartBlock.tsx`, `BarChartBlock.tsx`, `RadarChartInspector.tsx`, `BarChartInspector.tsx`) giúp `ReportBuilder.tsx` gọn sạch, không phình to monolith.
- **Option B + D Hybrid Summary Drop-Slot:** Hàng tổng hợp duy nhất ngay dưới tiêu đề `RADAR CHART` / `BAR CHART` hỗ trợ vừa gõ tiêu đề thủ công (điểm tổng tự tính từ `THÀNH PHẦN (x)`), vừa kéo thả Field đơn lẻ hoặc Nhóm (`H1` / `H2` / `Element Table`) để liên kết điểm tổng + tự động điền toàn bộ thành phần con vào `THÀNH PHẦN (x)`.
- **Căn thẳng hàng dọc tuyệt đối (`38px | 48px | 18px`) & Đồng bộ Trọng số 2 Chiều:** Điểm tổng/thành phần (`38px`), Trọng số `%` (`48px`), và nút xóa/gỡ (`18px`) thẳng trục dọc 100%; chỉnh sửa `%` trong giao diện biểu đồ tự động đồng bộ hai chiều với thuộc tính `weight` của Field/Block nguồn.
- **Khắc phục triệt để lỗi cắt đáy trang `.paper-card` (`1050px` Clipping Bug):** Bổ sung `height: 'auto', flexShrink: 0, overflow: 'visible'` vào container `.paper-card` trong `ReportBuilder.tsx` và `FormReport.tsx`, ngăn Flexbox ép co trang giấy về `minHeight: 1050px` và ngăn `overflow: hidden` cắt mất phần dưới của khối `INFO_GRID`.
- **Khôi phục chọn `SECTION_LABEL` (H1/H2) và `TABLE` trong `tab Form` (`hiddenInReport`):** Bổ sung cờ `hiddenInReport?: boolean` trên `ReportBlockConfig`, cho phép click chọn bất kỳ Section H1, H2 hoặc Table nào trong `tab Form` để xem bảng điểm tổng hợp và chỉnh `weight`/`isKnockout` ở cột Properties mà không làm tự sinh khối thừa bên trang `tab Report`.

---

### 2026-09-25 — Report Builder: Pure Native Drag & Drop Field Reordering on Canvas & Inspector (ReportBuilder)

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7 min |
| Thời gian lập plan (Request → Proceed) | ~2.5 min |
| Thời gian thực thi (Proceed → Push) | ~4.5 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`1 tsc -b` pass + `1 npm run build` 11.92s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Native HTML5 Drag and Drop Reordering:** Hỗ trợ kéo thả trực quan để sắp xếp lại thứ tự trường ở cả Canvas (ô lưới `INFO_GRID`, hàng `TABLE`) và Right Inspector (danh sách `FIELDS`).
- **Đồng bộ hai chiều thời gian thực (Two-way Reactive Sync):** Việc sắp xếp lại vị trí trên Canvas tự động phản ánh tức thì sang danh sách Inspector và ngược lại thông qua mảng `boundFieldIds` và utility `reorderArray`.
- **Tối giản hóa giao diện & Triệt tiêu Clutter (Lesson 11):** Bỏ hoàn toàn các dòng hướng dẫn phụ trợ rườm rà ("Kéo để xếp lại", hint boxes). Trải nghiệm dựa hoàn toàn vào visual affordances trực quan: biểu tượng grip `⠿`, con trỏ `cursor: grab`, độ mờ ghost `0.35`, và vạch định vị primary teal `borderTop: 2.5px solid var(--primary)` khi rê qua vị trí đích.
- **Triệt tiêu Mã Chết (Dead-Code Pruning — Rule 4.2 / Rule 13.7):** Xóa sạch các nút bước đơn `↑` / `↓` ở Inspector và thay thế hoàn toàn hàm cũ `moveFieldInBlock` bằng `reorderFieldInBlock` sử dụng pure utility `reorderArray` từ `src/utils/formUtils.ts`.
- **Bảo vệ thao tác người dùng (Drag Safety):** Chặn kích hoạt drag khi click/select trên thẻ `<input>` trong card trường để không cản trở việc chỉnh sửa văn bản.

---

### 2026-09-25 — Report Builder: Pure Native Drag & Drop Field Assignment & Pruned Modal (ReportBuilder)

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~6 min |
| Thời gian lập plan (Request → Proceed) | ~2 min |
| Thời gian thực thi (Proceed → Push) | ~4 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`1 tsc` pass + `1 tsc -b` pass + `1 vite build` 15.88s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Chuyển đổi sang Pure Native Drag and Drop:** Thay thế hoàn toàn cơ chế gán trường cồng kềnh qua modal và nút bấm bằng chuẩn Native HTML5 Drag and Drop không phụ thuộc thư viện ngoài.
- **Tối ưu Left Sidebar Data Palette:** Toàn bộ card trường trong danh mục `FIELDS` được gắn grip `⠿` và `draggable={true}`. Tính toán số lần tái sử dụng `getFieldUsageCount`: các trường đã gán hiển thị badge gọn gàng (`x1`, `x2`,...), các trường chưa gán hoàn toàn sạch sẽ (không hiện badge hay chữ 'o' gây rối mắt).
- **Option 4 Adaptive Microcopy trên Canvas:** Khối `INFO_GRID` và `TABLE` rỗng hiển thị hộp đứt nét `+ Thả vào đây`. Khi khối đã có dữ liệu, ở trạng thái nghỉ toàn bộ slot dropzone ẩn đi giúp canvas trang nhã; khi người dùng bắt đầu kéo trường (`isDraggingField === true`), slot đứt nét `+ Thả vào đây` tự động xuất hiện ở cuối lưới/bảng để đón nhận.
- **Triệt tiêu Mã Chết (Dead-Code Pruning — Rule 4.2):** Xóa sạch modal `Quick Field Picker` (~365 dòng JSX) và các nút `+ Thêm trường` rườm rà trên Canvas và Right Inspector, giảm net hơn 310 dòng code.

---

### 2026-09-25 — Report Builder: Removed Virtual Page Breaks & Pruned Tracking Code (ReportBuilder)

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~5 min |
| Thời gian lập plan (Request → Proceed) | ~2 min |
| Thời gian thực thi (Proceed → Push) | ~3 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`1 tsc` pass + `1 vite build` 19.26s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Loại bỏ Vạch Phân Trang Ảo:** Gỡ bỏ hoàn toàn đường kẻ phân trang ảo (`--- RANH GIỚI HẾT TRANG X (A4/A5) ---`) khỏi canvas tờ giấy theo yêu cầu của người dùng, chấm dứt việc vạch nét đứt cắt ngang qua bảng và nội dung văn bản gây khó khăn khi thao tác.
- **Triệt tiêu Mã chết (Dead-code Pruning):** Xóa sạch `paperCardRef`, `paperScrollHeight` và hook `ResizeObserver` đo chiều cao tờ giấy khỏi `ReportBuilder.tsx` theo chuẩn Rule 4.2 / Rule 13.7, đảm bảo 0 cảnh báo `TS6133`.
- **Bảo toàn Cải tiến Cốt lõi:** Vẫn duy trì trọn vẹn khoảng đệm đáy thoáng đãng (`padding: '1.25rem 1rem 5rem'`, `marginBottom: '2.5rem'`, spacer đáy `4rem`) và ISO Paper Footer ở cuối tờ giấy.

---

### 2026-09-25 — Report Builder: Decoupled Form Scoring, Blank Slate Report, Bottom Clearance & Virtual Page Breaks (ReportBuilder, reportCompute, reportScoring, types.ts)

**Scope:** 5 files (`src/types.ts`, `src/utils/reportCompute.ts`, `src/utils/reportScoring.ts`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~18 min |
| Thời gian lập plan (Request → Proceed) | ~8 min |
| Thời gian thực thi (Proceed → Push) | ~10 min |
| Số file nguồn chỉnh sửa | 4 (`types.ts`, `reportCompute.ts`, `reportScoring.ts`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 7 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`2 tsc` pass + `1 vite build` 16.29s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tách biệt Chấm điểm Form & Layout Báo cáo (Decoupling Form Scoring from Report Layout):** Bổ sung `ruleOverrides` vào cấp template `ReportTemplateISO`, cập nhật `computeReportData` ưu tiên gộp `template.ruleOverrides` trước block overrides. Nhờ đó, Tab Form cho phép chấm điểm và cấu hình trọng số cho bất kỳ trường nào mà không bao giờ tự động tạo mới hay làm biến đổi `layoutBlocks` của trang Report.
- **Trang Report Blank Slate Không Bị Ô Nhiễm (Clean Slate Canvas):** Loại bỏ hoàn toàn cơ chế tự clone `INFO_GRID` và tự inject các khối `SECTION_LABEL` / `TABLE` khi chọn trường hoặc chuyển tab. Tab Report khởi đầu hoàn toàn sạch sẽ, chỉ chứa các khối do người dùng chủ động xây dựng.
- **Triệt tiêu Hoàn toàn Lỗi Cụt Cuối Trang (Bottom Clearance):** Nâng padding đáy của container cuộn ngoài lên `5rem` (`padding: '1.25rem 1rem 5rem'`), gán `marginBottom: '2.5rem'` cho `.paper-card`, và bổ sung spacer đáy `4rem` (`<div style={{ height: '4rem', flexShrink: 0, width: '100%' }} />`), đảm bảo trên mọi trình duyệt flex-column không bao giờ bị dính sát mép dưới viewport.
- **Vạch Phân Trang Ảo (Virtual Page Breaks):** Tích hợp đường ranh giới trang in nét đứt (`--- RANH GIỚI HẾT TRANG X (A4/A5) ---`) mỗi 1050px (A4) hoặc 650px (A5) dựa trên `ResizeObserver` theo dõi chiều cao thực tế của tờ giấy.
- **ISO Paper Footer cho Tab Report:** Bổ sung footer chuẩn ISO (`Mã BC: template.reportId` bên trái, `Phiên bản: formatFormVersion(...)` bên phải, `marginTop: 'auto'`, đường kẻ viền `#334155`) khớp 100% với chuẩn tờ giấy của FormBuilder và FormReferenceCanvas.

---

### 2026-09-25 — Report Builder: Unified Canvas Dimensions & Tab Form Silent Edit Lock (ReportBuilder & FormReferenceCanvas)

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `src/components/report/FormReferenceCanvas.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7.1 min |
| Thời gian lập plan (Request → Proceed) | ~3.5 min |
| Thời gian thực thi (Proceed → Push) | ~3.5 min |
| Số file nguồn chỉnh sửa | 2 (`ReportBuilder.tsx`, `FormReferenceCanvas.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`1 tsc` pass + `1 vite build` 14.90s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Thống nhất Kích thước Canvas Tờ Giấy:** Đồng bộ `maxWidth` sang `920px` (A5 Landscape) / `820px` (A4 Portrait), `minHeight` sang `650px` / `1050px`, và `padding: '1.75rem 2rem'` trên cả 2 Tab `Form` và `Report`, xóa bỏ hoàn toàn cú nhảy giật khung hình 122px khi chuyển tab.
- **Triệt tiêu Thanh Cuộn Kép (Double Scrollbar):** Xóa bỏ outer scroll wrapper thừa (`overflowY: 'auto'`, background xám `#f1f5f9`) trong `FormReferenceCanvas`, giúp canvas cắm trực tiếp vào container cuộn trung tâm duy nhất của `ReportBuilder`.
- **Cơ chế Ngầm Khóa Edit (Silent Lock) trên Tab Form:** Đúng yêu cầu "không ẩn công cụ, không mô tả readonly, chỉ ngầm khóa edit", đặt kiểm tra `if (activeCanvasTab === 'form') return;` chặn các thao tác thay đổi layout/nội dung (`handleAddBlock`, `handleDeleteBlock`, title format, borders, headers, title inputs) trong khi vẫn bảo lưu 100% khả năng cấu hình quy tắc chấm điểm và trọng số (`isKnockout`, `weight`, `ruleOverrides`).

---







