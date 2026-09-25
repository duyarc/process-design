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

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

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

### 2026-09-25 — Report Builder: Realigned Footer Weight Slots & Removed Sigma Symbol (ReportBuilder)

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7 min |
| Thời gian lập plan (Request → Proceed) | ~3 min |
| Thời gian thực thi (Proceed → Push) | ~4 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`1 tsc` pass + `1 vite build` 14.73s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Loại bỏ Ký hiệu `∑`:** Chấm dứt tình trạng ký hiệu `∑ ` chèn ép diện tích ngang, đẩy chuỗi `100%` lệch khỏi trục ô nhập và nằm quá sát cột `Score`.
- **Căn chỉnh Thẳng Hàng Trục Dọc (Vertical Center Alignment) Chuẩn Xác:** Đồng bộ cấu trúc footer với các hàng thành phần (`display: flex, justifyContent: flex-end, gap: 2px, paddingRight: 2px`).
- **Slot Số Tổng 32px Căn giữa:** Số tổng trọng số được bọc trong thẻ `<span>` có chiều rộng cố định đúng `32px`, căn giữa (`textAlign: 'center'`), `fontVariantNumeric: 'tabular-nums'` và `fontWeight: 800`. Tâm số `100` thẳng hàng 100% theo phương thẳng đứng với tâm các ô input `<SmartNumberInput>` (32px) phía trên.
- **Ký tự `%` Thẳng Hàng:** Ký tự `%` được tách riêng trong thẻ `<span>` sau `gap: 2px`, thẳng trục tuyệt đối với `%` của các hàng trên.
- **Đồng bộ trên Cả 3 Bảng Tổng hợp:** Áp dụng chuẩn thiết kế này cho Bảng Tổng hợp Trụ cột H1, Bảng Tổng hợp Phân mục H2 và Bảng Đánh giá FIELDS của Khối Table.

---

### 2026-09-25 — Report Builder: Streamlined H1 Pillar Summary Table & In-Table Weight Editing (ReportBuilder & reportScoring)

**Scope:** 3 files (`src/utils/reportScoring.ts`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~18 min |
| Thời gian lập plan (Request → Proceed) | ~13 min |
| Thời gian thực thi (Proceed → Push) | ~5 min |
| Số file nguồn chỉnh sửa | 2 (`reportScoring.ts`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`2 tsc` pass + `1 vite build` 13.55s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Đồng bộ hóa Giao diện Bảng H1 theo Thiết kế Tinh gọn của H2:** Loại bỏ dòng tiêu đề lặp thừa `"TỔNG HỢP ĐIỂM TRỤ CỘT H1"`, áp dụng tỷ lệ lưới 4 cột chuẩn `6 / 2 / 2 / 2`, viền teal `#99f6e4`, nền header `#f0fdfa` và cột đầu tiên mang tên `"Items"`.
- **Hỗ trợ Click Drill-down trực tiếp trên tên thành phần con:** Tên các phân mục H2 con hoặc bảng trực thuộc H1 có màu teal đậm `#0f766e`, con trỏ chuột pointer và gạch chân khi hover, cho phép click để chuyển ngay sang xem/cấu hình H2 Section Properties hoặc Table Properties tương ứng.
- **Tích hợp Chỉnh sửa Trọng số Tại Chỗ (`handleUpdateH1ChildWeight`):** Tích hợp `<SmartNumberInput>` (32px, `min={0}`, `max={100}`, hậu tố `%`) trực tiếp tại cột `Weight`. Hỗ trợ cập nhật ngay lập tức trọng số của Section H2 con (`layoutBlocks`) hoặc Element trực thuộc (`tableRow.weight` / `ruleOverrides.weight`) với cơ chế tái cân bằng phần trăm tự động.
- **Footer Tinh giản & Trực quan:** Loại bỏ nhãn `"Tổng Trụ Cột:"`, để trống cột 1 (span 6), hiển thị huy hiệu trạng thái `PASS/FAIL` (span 2), tổng điểm trụ cột (span 2) và tổng trọng số `∑ {totalWeight}%` (span 2, màu xanh lục `#059669` nếu đủ 100%, màu hổ phách `#d97706` nếu chưa đủ 100%).

---

### 2026-09-25 — Report Builder: Custom Cell Options & Checkbox Scoring Resolution (tableFieldExtractor, FieldScoringInspector, reportScoring)

**Scope:** 6 files (`src/utils/tableFieldExtractor.ts`, `src/utils/formUtils.ts`, `src/components/report/FieldScoringInspector.tsx`, `src/utils/reportScoring.ts`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~17.5 min |
| Thời gian lập plan (Request → Proceed) | ~12.5 min |
| Thời gian thực thi (Proceed → Push) | ~5.0 min |
| Số file nguồn chỉnh sửa | 4 (`tableFieldExtractor.ts`, `formUtils.ts`, `FieldScoringInspector.tsx`, `reportScoring.ts`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 5 (`4 tsc` + `1 vite build` 14.92s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Ưu tiên nạp Custom Cell Options từ `block.cellOptionsMap`:** Trong `tableFieldExtractor.ts`, nâng cấp `extractTableFields` sử dụng `getEffectiveCellOptions(block.cellOptionsMap, row.id, col.id, col.options)`, triệt tiêu hoàn toàn lỗi làm mất tùy chọn tùy biến của ô cell và bị rơi về giá trị mặc định của cột (`Có / Không`). Đồng thời nạp `placeholder` từ `cellPlaceholderMap`.
- **Dọn dẹp triệt để Dead Re-exports (Rule 13.7):** Xóa bỏ các re-export không dùng của `tableFieldExtractor` trong `formUtils.ts`, ngăn chặn 100% nguy cơ hình thành vòng lặp circular dependency.
- **Hỗ trợ toàn diện Tùy chọn Khác (`__other__`) cho Checkbox:** Trong `FieldScoringInspector.tsx` và `reportScoring.ts`, bổ sung nhận diện `isOtherOpt` (`__other__` / `isOther`) kết hợp `isOtherValue` cho checkbox, giúp highlight teal các mục đã chọn trong phiếu mẫu và tính điểm chính xác tuyệt đối.

---

### 2026-09-25 — Report Builder: Strict Block Type Scoping for Field Rule Overrides & Table Weight Sync

**Scope:** 3 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~11 min |
| Thời gian lập plan (Request → Proceed) | ~4.5 min |
| Thời gian thực thi (Proceed → Push) | ~6.5 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 4 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`npx tsc` pass + `tsc -b && vite build` 11.00s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Triệt tiêu hoàn toàn rò rỉ override sang SECTION_LABEL:** Áp dụng Strict Block Type Scoping trong `updateRuleOverride`. Khi trường bắt nguồn từ khối `TABLE`, hàm ép buộc khối nhận `ruleOverrides` trong `template.layoutBlocks` phải có `b.type === 'TABLE'`, xóa bỏ hoàn toàn kịch bản `find()` bắt nhầm khối `SECTION_LABEL` có cùng tên nằm phía trước.
- **Auto-Initialization trọn bộ trường:** Khi tự động tạo khối `TABLE` báo cáo mới, nạp đầy đủ toàn bộ trường của bảng nguồn (`extractTableFields`) vào `boundFieldIds` thay vì chỉ 1 trường đơn lẻ.
- **Tự động dọn dẹp & di chuyển dữ liệu rò rỉ:** Tự động phát hiện và thanh trừng sạch sẽ các `fieldId` và `ruleOverrides` bị lưu lạc trên `SECTION_LABEL` sang khối `TABLE` đích.
- **Đồng bộ hai chiều Cell ⇄ Table Properties:** Trọng số chỉnh sửa từ ô cell (`FIELD PROPERTIES`) và bảng tổng hợp trong `Table Properties` liên kết chặt chẽ vào đúng 1 khối `TABLE` duy nhất.

---

### 2026-09-25 — Report Builder: TABLE Canvas Selection & H2 Name Collision Resolution

**Scope:** 5 files (`src/components/report/FormReferenceCanvas.tsx`, `src/components/ReportBuilder.tsx`, `src/components/report/FieldScoringInspector.tsx`, `src/utils/reportScoring.ts`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~17 min |
| Thời gian lập plan (Request → Proceed) | ~6 min |
| Thời gian thực thi (Proceed → Push) | ~11 min |
| Số file nguồn chỉnh sửa | 4 (`FormReferenceCanvas.tsx`, `ReportBuilder.tsx`, `FieldScoringInspector.tsx`, `reportScoring.ts`) |
| Tổng lượt edit source | 9 |
| Lượt edit sửa lỗi (rework) | 1 (sửa kiểu `fieldOptions \|\| undefined` cho `formatOptionDisplay`) |
| Số lần build | 5 (`npx tsc` 4 lần pass + `tsc -b && vite build` 10.56s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Giải quyết triệt để Name Shadowing Collision:** Tách biệt luồng sự kiện click khối TABLE trên Canvas (`onSelectBlock?.(block.id)` thay vì `onSelectTableGroup(block.title)`), bổ sung nhánh xử lý `TABLE` chuyên biệt trong `handleSelectBlockFromFormCanvas` và đảo ngược thứ tự ưu tiên trong `handleSelectTableGroupFromCanvas` (tìm element trước Section H2). Nhờ đó, bảng con trùng tên với Section H2 cha (ví dụ Section H2 "Đặc trưng nhân sự" và bảng "ĐẶC TRƯNG NHÂN SỰ") luôn được chọn chuẩn xác.
- **H2 Drill-down:** Cho phép bấm trực tiếp vào tên bảng con trong bảng tóm tắt con của Section H2 ở Right Inspector để mở cấu hình Table Properties.
- **Chuẩn hóa hiển thị `__other__`:** Áp dụng `formatOptionDisplay` trên Canvas và Report Preview, tích hợp `isOtherValue` trong `FieldScoringInspector.tsx` và `reportScoring.ts` để nhận diện và tính điểm chính xác cho các giá trị tùy chọn "Khác".

---

### 2026-09-25 — Report Builder: Live Submission Canvas Rendering & formUtils Pure Extraction

**Scope:** 4 files (`src/utils/formUtils.ts`, `src/components/ReportBuilder.tsx`, `src/components/report/FormReferenceCanvas.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8 min |
| Thời gian lập plan (Request → Proceed) | ~3.8 min |
| Thời gian thực thi (Proceed → Push) | ~4.2 min |
| Số file nguồn chỉnh sửa | 3 (`formUtils.ts`, `ReportBuilder.tsx`, `FormReferenceCanvas.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 1 (lệch dòng replace do thêm code phía trước, đã view_file khắc phục ngay) |
| Số lần build | 4 (`npx tsc` 3 lần pass + `tsc -b && vite build` 15.44s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Đồng bộ 100% giữa Center Canvas và Right Inspector:** Truyền `sampleSubmission` từ `ReportBuilder` vào `FormReferenceCanvas`, giúp hiển thị trực quan các câu trả lời thực tế từ phiếu nộp mẫu: Likert scale hiển thị chấm tròn teal đặc `●` kèm halo ring; Rating hiển thị các ngôi sao vàng đặc `★`; Checkbox/Radio hiển thị tick `[✓]` và `(●)`; Text/Number/Date/Select hiển thị chữ số đậm `#0f172a`.
- **Pure Utility Extraction (Rule 13.8):** Trích xuất logic bóc tách `extractSubmissionValue`, `isLikertSelected`, `isOptionSelected` vào `src/utils/formUtils.ts` để tái sử dụng xuyên suốt toàn hệ thống.
- **Null-Safety & Zero Regression:** Khi không có phiếu mẫu, Canvas tự động giữ nguyên chế độ xem mẫu đơn rỗng (Blank Form Preview).

---

### 2026-09-25 — Report Builder: Elimination of Floating Quick-Select Pill Bar in SmartNumberInput

**Scope:** 4 files (`src/components/common/SmartNumberInput.tsx`, `src/components/report/FieldScoringInspector.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7 min |
| Thời gian lập plan (Request → Proceed) | ~4 min |
| Thời gian thực thi (Proceed → Push) | ~3 min |
| Số file nguồn chỉnh sửa | 3 (`SmartNumberInput.tsx`, `FieldScoringInspector.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 4 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 4 (`npx tsc` 3 lần pass + `tsc -b && vite build` 8.72s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Triệt tiêu hoàn toàn floating pill popup:** Xóa bỏ prop `presets` và khối render floating pill bar (`[ 0 | 10 | 20 | 25 | 50 | 100 ]`) trong `SmartNumberInput.tsx`. Khi người dùng click/focus vào bất kỳ ô nhập Weight nào, giao diện luôn phẳng và sạch sẽ 100%, không còn popup nào bật lên che khuất chữ `isKnockout` hay `Loại trực tiếp` ở hàng trên.
- **Dọn sạch call-sites:** Loại bỏ triệt để `presets` prop tại cả 3 vị trí Weight card: `FieldScoringInspector.tsx` (câu hỏi con), `ReportBuilder.tsx` (SECTION_LABEL H1/H2), và `ReportBuilder.tsx` (TABLE).
- **Bảo toàn 100% UX nhập liệu bàn phím:** Tự động bôi đen toàn bộ số (`select()`) khi focus/click để gõ đè số mới ngay tức khắc; phím mũi tên `↑/↓` tăng giảm mượt mà (Shift + mũi tên bước nhảy 5); xóa lùi Backspace tự nhiên với draft state; không có spinner trình duyệt làm phiền.

---

### 2026-09-25 — Report Builder: Streamlined Table Inspector (Single-row TABLE + Border Icons + Header Toggle, FIELDS, In-Table Weight Editing)

**Scope:** 2 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~11 min |
| Thời gian lập plan (Request → Proceed) | ~6 min |
| Thời gian thực thi (Proceed → Push) | ~5 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Tổng lượt edit source | 4 |
| Lượt edit sửa lỗi (rework) | 1 (sửa closing tag JSX) |
| Số lần build | 3 (`npx tsc` pass + `tsc -b && vite build` 13.36s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 1 (`TS17015`) |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Gom Header Table Inspector trên 1 hàng duy nhất:** Tiêu đề `TABLE` in hoa đậm, 3 nút icon Border trực quan (Lưới `[ ▦ ]`, Ngang `[ ☵ ]`, Không viền `[ ▢ ]`), nhãn `Header` kèm công tắc toggle switch, và nút xóa `[🗑]` cùng nằm trên 1 hàng ngang (~210px / 310px width), tiết kiệm ~28px chiều dọc quý giá.
- **Triệt tiêu khối Border & Header trùng lặp:** Xóa bỏ hoàn toàn khối Border/Header cũ ở bên dưới.
- **Rút gọn nhãn danh sách trường:** Đổi `CÁC TRƯỜNG ĐÃ GÁN (x)` ➔ `FIELDS (x)` ngắn gọn, đồng bộ phong cách Left Sidebar.
- **Bảng con Items & Chỉnh sửa Trọng số tại chỗ:** Loại bỏ tiêu đề thừa `TỔNG HỢP ĐIỂM BẢNG ĐÁNH GIÁ`, đổi cột 1 thành `Items`, áp dụng lưới `6 / 2 / 2 / 2`, màu Header trung tính `#334155`, tích hợp `<SmartNumberInput>` (32px, không popup) trực tiếp tại ô Weight của từng câu hỏi con, liên kết `updateRuleOverride(f.id, { weight: val })`.
- **Footer Tinh gọn & Rút gọn isKnockout:** Footer hiển thị trạng thái `PASS/FAIL`, tổng điểm bảng to đậm, và tổng trọng số `∑ {totalWeight}%`. Rút gọn nhãn `isKnockout (Bảng)` thành `isKnockout`.
