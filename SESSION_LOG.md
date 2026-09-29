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
| 22 | `CTX` | API `/api/forms/:formId` trả về raw DB row với key snake_case `layout_blocks` nhưng component đọc camelCase `layoutBlocks` → `undefined` → mọi field lookup đều fail theo kiểu cascade (label, decode option, render type) | Luôn normalize raw DB response ngay tại điểm nhận: `layoutBlocks: raw.layoutBlocks \|\| raw.layout_blocks \|\| []`. Áp dụng cho mọi path (authenticated + public) | 1 |
| 23 | `TOOL` | Thêm `field?.label` vào fallback chain nhưng `FormFieldISO` không có property `label` → TS2339 build fail | Luôn tra cứu interface type (`FormFieldISO`) trước khi dùng optional chain trên typed object. `checkItem` là nhãn duy nhất trong `FormFieldISO` | 1 |

---

## Nhật ký Phiên

Entry mới nhất ở trên cùng. Tối đa 10 entries.

### 2026-09-29 — Fix: Unified Post-Submit Smart Success Screen for Admin + Guest

**Scope:** 2 files (`src/components/FormFiller.tsx`, `DESIGN_FORM_OPERATIONS.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 (`FormFiller.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` 0 lỗi, `npm run build` 8.47s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Sửa lỗi: Admin nộp form xong bị chuyển đột ngột sang `FormManager` rồi treo loading.
- Root cause: Guard `isPublicGuestMode` tại `FormFiller.tsx` dòng 1353 chặn Admin không cho thấy `submitResult` screen.
- Fix: Thay guard thành `!isEditOperation` để mọi user (Admin + Guest) đều thấy Smart Success Screen.
- Thêm nút `[ ⬅ Về Quản lý ]` chỉ hiển thị cho user nội bộ có `onBack`.

**Lỗi gặp:** 0 lỗi.

---

### 2026-09-29 — Form Operations: Smart Success Screen & Seamless Direct /r/ Report Routing

**Scope:** 4 files (`src/components/FormFiller.tsx`, `src/App.tsx`, `DESIGN_FORM_OPERATIONS.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7 min |
| Thời gian lập plan (Request → Proceed) | ~2 min |
| Thời gian thực thi (Proceed → Push) | ~5 min |
| Số file nguồn chỉnh sửa | 2 (`FormFiller.tsx`, `App.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`tsc --noEmit` 0 lỗi, `npm run build` 8.15s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Nâng cấp màn hình nộp thành công (`submitResult`): bổ sung nút Primary `[ 📊 Xem Báo cáo Đánh giá ]` dẫn thẳng vào trang Report, nút Secondary `[ 📋 Xem phiếu vừa nộp ]`, và `[ + Điền phiếu mới ]`, giữ màn hình tối giản không bị rườm rà.
- Đồng bộ `initialSubmissionTab`: thêm `useEffect` trong `FormFiller.tsx` tự động kích hoạt `submissionTab = 'report'` khi truy cập link có tiền tố `/r/`.
- Nâng cấp `rawFormTemplate` tra cứu thông minh (slug / formId / formTitle) để dữ liệu báo cáo luôn tải mượt mà.
- Sửa triệt để routing trong `App.tsx` cho `/f/:formName/[sr]/:subId` và `/([sr])/:subId`: giải quyết token dự phòng (từ URL, `localStorage.submission_history`, hoặc `jwt_token`), loại bỏ lỗi redirect nhầm về form trống khi mở link báo cáo.

**Lỗi gặp:** 0 lỗi.

---

### 2026-09-29 — Form Operations: Action-Driven Toolbar (Contextual View Switcher & 1-Click Share Button)

**Scope:** 2 files (`src/components/FormFiller.tsx`, `DESIGN_FORM_OPERATIONS.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8 min |
| Thời gian lập plan (Request → Proceed) | ~2 min |
| Thời gian thực thi (Proceed → Push) | ~6 min |
| Số file nguồn chỉnh sửa | 1 (`FormFiller.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` 0 lỗi, `npm run build` 7.94s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Loại bỏ cụm pill tab `[ Form | Report ]` ở góc trái header, trả lại sự thông thoáng định danh cho nhãn `Phiếu <id>`.
- Bổ sung nút chuyển đổi góc nhìn ngữ cảnh (`[ 📊 Xem báo cáo ]` khi ở Form / `[ 📋 Xem phiếu gốc ]` khi ở Report) trên thanh công cụ bên phải.
- Thay thế ô input link 210px cồng kềnh bằng nút `[ ↗ Chia sẻ ]` 1-click gọn gàng (`Share2` icon) với phản hồi tức thì `[ ✓ Đã chép! ]` trong 2 giây. Tiết kiệm ~180px chiều ngang màn hình.

**Lỗi gặp:** 0 lỗi.

---

### 2026-09-29 — Report Builder: Fix Chart Drag-to-Reorder in INFO_GRID (2+ Charts)

**Scope:** 1 file (`src/components/ReportBuilder.tsx`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~4 min |
| Thời gian lập plan (Request → Proceed) | ~2 min |
| Thời gian thực thi (Proceed → Push) | ~2 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` 0 lỗi, `npm run build` 7.90s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Thêm MIME guard `e.dataTransfer.types.includes('application/x-report-chart-item-reorder')` early-return vào 3 handler: field cell `onDragOver`, empty slot `onDragOver`, empty slot `onDrop`.
- Root cause: field cell và empty slot gọi `preventDefault+stopPropagation` bất điều kiện → chặn chart drag events bubbling lên chart wrapper handlers → cursor hiện `no-drop` khi drag chart qua vùng field/empty slot.

**Lỗi gặp:** 0 lỗi.

---

### 2026-09-29 — Report Builder: Fix Cross-Block `INFO_GRID` Field Drag-and-Drop & `ruleOverrides` Migration

**Scope:** 2 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8 min |
| Thời gian lập plan (Request → Proceed) | ~4 min |
| Thời gian thực thi (Proceed → Push) | ~4 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`tsc --noEmit && npm run build` 7.92s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Bổ sung nhánh `application/x-report-reorder` với `dropEffect = 'move'` trong `onDragOver` của block container để đồng bộ với `effectAllowed = 'move'` của ô `INFO_GRID` (giữ nguyên `dropEffect = 'copy'` cho thao tác kéo từ Left Sidebar).
- Bổ sung `onDragOver` và `onDrop` trực tiếp trên các ô trống `+ Thả vào đây` của `INFO_GRID`, hỗ trợ đầy đủ di chuyển trường liên khối (`moveFieldBetweenBlocks`), chuyển xuống cuối cùng khối (`reorderFieldInBlock`), gán nhóm trường (`addMultipleFieldsToBlock`), và gán trường đơn lẻ (`addFieldToBlock`).
- Bật `setIsDraggingField(true)` tại `onDragStart` của ô `INFO_GRID` (và reset tại `onDragEnd`) để các khối `INFO_GRID` đích đã đầy tự động hiển thị thêm 1 ô nhận `+ Thả vào đây` khi đang kéo trường trên Canvas.
- Nâng cấp `moveFieldBetweenBlocks` tự động di chuyển cấu hình `ruleOverrides[fieldId]` (nhãn tùy chỉnh, ẩn nhãn, quy tắc chấm điểm) từ khối nguồn sang khối đích.

---

### 2026-09-29 — Report Builder: Option 3 Stacked Label Layout, Badge Tags (Cách C) & DATA PRUNING Controls

**Scope:** 4 files (`src/types.ts`, `src/components/print/printShared.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8 min |
| Thời gian lập plan (Request → Proceed) | ~2.5 min |
| Thời gian thực thi (Proceed → Push) | ~5.5 min |
| Số file nguồn chỉnh sửa | 3 (`types.ts`, `printShared.tsx`, `ReportBuilder.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`tsc --noEmit` 0 lỗi, `npm run build` 9.63s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Bổ sung `hideUncheckedOptions?: boolean` và `hideEmptyFields?: boolean` vào `ReportBlockConfig` trong `src/types.ts`.
- Tái cấu trúc hàm `renderReportField` trong `src/components/print/printShared.tsx` sang Option 3 Stacked Label (nhãn ở trên nhỏ gọn `0.72rem`, giá trị ở dưới in đậm `0.85rem` kèm dotted underline) và Checkbox/Radio Cách C (thẻ Badge Tags bo tròn kèm icon `✓`).
- Hỗ trợ Data Pruning: khi bật `hideEmptyFields`, các trường rỗng trả về `null` để khối `INFO_GRID` tự co; khi bật `hideUncheckedOptions`, chỉ hiển thị các tag đã chọn.
- Dọn dẹp dead-code: lược bỏ unused imports `getAutoCheckboxLayoutMode` và `hasLongOptions` trong `printShared.tsx` (Rule 13.7).
- Cập nhật Canvas cell preview trong `ReportBuilder.tsx` đồng bộ Option 3 & Badge Tags.
- Bổ sung cụm `DATA PRUNING` (2 công tắc ToggleSwitch) vào Tab `Properties` (Right Inspector) của `INFO_GRID`, bảo toàn 100% các thành phần hiện hữu.

---

### 2026-09-29 — Report Builder: Insert Layout Block Immediately After Active Block

**Scope:** 3 files (`src/utils/formUtils.ts`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~6 min |
| Thời gian lập plan (Request → Proceed) | ~2.5 min |
| Thời gian thực thi (Proceed → Push) | ~3.5 min |
| Số file nguồn chỉnh sửa | 2 (`formUtils.ts`, `ReportBuilder.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` 0 lỗi, `npm run build` 8.46s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Trích xuất pure utility `insertAfterActive` trong `src/utils/formUtils.ts` tái sử dụng toàn hệ thống.
- Khi thêm một khối layout block mới trong Report Builder, nếu có khối đang active thì khối mới được chèn ngay sau khối đó (`activeIdx + 1`) và tự động active khối mới. Nếu không có khối nào active, khối mới mặc định nằm ở cuối.
- Áp dụng đồng bộ cho Toolbar buttons, thêm khối biểu đồ từ Left Sidebar, và các section sinh tự động.

---

### 2026-09-29 — Report Builder: Full Chart Drag-to-Reorder, Cross-Block Move & DropZone Chart Insertion

**Scope:** 2 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7 min |
| Thời gian lập plan (Request → Proceed) | ~3 min |
| Thời gian thực thi (Proceed → Push) | ~4 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` 0 lỗi, `npm run build` 10.36s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Kéo thả các mục biểu đồ (`Radar`, `Bar`) trong khối `INFO_GRID` để hoán đổi vị trí (`reorderChartInBlock`).
- Kéo thả biểu đồ sang khối `INFO_GRID` khác (`moveChartBetweenBlocks`).
- Tách biểu đồ thành khối riêng khi thả vào Drop Zone giữa 2 khối.
- Kéo thả biểu đồ từ Left Sidebar thả vào Drop Zone giữa 2 khối để tạo khối biểu đồ mới tại đúng vị trí mong muốn.
- Badge khối đổi thành `BIỂU ĐỒ` trực quan khi khối chứa biểu đồ.

---

### 2026-09-29 — Report Builder: Canvas Drag-to-Reorder Layout Blocks & Cross-Block Field Dragging

**Scope:** 2 files (`src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~15 min |
| Thời gian lập plan (Request → Proceed) | ~8 min |
| Thời gian thực thi (Proceed → Push) | ~7 min |
| Số file nguồn chỉnh sửa | 1 (`ReportBuilder.tsx`) |
| Lượt edit sửa lỗi (rework) | 1 (khắc phục indentation 42-spaces qua python script chuẩn) |
| Số lần build | 3 (`tsc --noEmit` 0 lỗi 2 lần, `npm run build` 18.77s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Kéo thả handle GripVertical trên canvas tab Report để đổi thứ tự các khối với dynamic drop zones và indicator lines sáng nổi bật (`var(--primary)`).
- Kéo thả field giữa các khối khác nhau (`moveFieldBetweenBlocks`): trường được chuyển nguyên tử từ khối nguồn sang khối đích tại vị trí chỉ định.
- Hỗ trợ drop vào ô cụ thể lẫn drop vào container khối chung.

---

### 2026-09-28 — Report Builder: Zero-Latency Report Tab — Props Bypass + Background Pre-fetch

**Scope:** 3 files (`src/components/FormReport.tsx`, `src/components/FormFiller.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~10 min |
| Thời gian lập plan (Request → Proceed) | ~5 min |
| Thời gian thực thi (Proceed → Push) | ~5 min |
| Số file nguồn chỉnh sửa | 2 (`FormReport.tsx`, `FormFiller.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`tsc --noEmit` pass 2 lần, `npm run build` 9.10s pass) |
| Lần build đầu thành công? | Có (100% pass ngay lần 1) |

**Kết quả đạt được:**
- Xem Form tab ≥1–2s → bấm Report tab: **~0ms** (render ngay lập tức, zero network fetch)
- Bấm Report tab ngay lập tức: **~50–150ms** (chỉ 1 fetch nhẹ ~10–30KB thay vì bundle nặng)
- Standalone `/r/:id`: Giữ nguyên behavior (fallback đầy đủ)

---



**Scope:** 4 files (`src/components/FormFiller.tsx`, `src/components/FormReport.tsx`, `src/components/SubmissionViewer.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~7 min |
| Thời gian lập plan (Request → Proceed) | ~3.5 min |
| Thời gian thực thi (Proceed → Push) | ~3.5 min |
| Số file nguồn chỉnh sửa | 3 (`FormFiller.tsx`, `FormReport.tsx`, `SubmissionViewer.tsx`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`tsc --noEmit` pass từng file, `npm run build` 11.40s pass) |
| Lần build đầu thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Nâng chuẩn khổ giấy Canvas Builder:**
  - Nâng `maxWidth` container của `FormFiller` từ `800px` lên `canvasMaxWidth`: `820px` (A4) / `920px` (A5_LANDSCAPE), đúng tỷ lệ tiêu chuẩn của `FormBuilder` và `ReportBuilder`.
  - Loại bỏ hoàn toàn hardcode `698px` và khoảng đệm thụt lùi trong `FormReport.tsx`.
- **Đồng bộ 100% hình học giữa tab Form và Report:**
  - Cả 2 tab đều dùng chung độ rộng `820px`, `padding: 2rem`, `boxShadow: var(--shadow-md)`, và `borderRadius: var(--card-radius, 8px)`.
  - Triệt tiêu hoàn toàn hiện tượng co giật (nhảy kích thước 102px) khi bấm chuyển đổi giữa `[ Form | Report ]`.
- **Căn mép hoàn hảo Thanh Toolbar:**
  - Toolbar trải rộng đủ 820px, hai mép trái/phải gióng thẳng hàng tuyệt đối với hai góc trên của tờ giấy trắng bên dưới.
  - Mở rộng ô URL liên kết chia sẻ từ 180px lên 210px để hiển thị đường dẫn thoáng đẹp, dễ đọc hơn.

---

### 2026-09-28 — Report Builder: Fix INFO_GRID Display Bugs — normalizeForm layoutBlocks

**Scope:** 1 file (`src/components/FormReport.tsx`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~5 min |
| Thời gian lập plan (Request → Proceed) | ~2 min |
| Thời gian thực thi (Proceed → Push) | ~3 min |
| Số file nguồn chỉnh sửa | 1 (`FormReport.tsx`) |
| Lượt edit sửa lỗi (rework) | 1 (`field?.label` không tồn tại trong `FormFieldISO` → build fail → revert `printShared.tsx`) |
| Số lần build | 3 (build fail lần 1 TS2339, pass lần 2 sau revert, pass final) |
| Lần build đầu thành công? | Không (lỗi `printShared.tsx` `field?.label` không thuộc `FormFieldISO`) |
| Số lỗi mới phát sinh | 0 (sau revert) |

**Bài học mới:**
- `FormFieldISO.checkItem` là nhãn duy nhất — không có `label`. Khi cần fallback label cho field, kiểm tra type interface trước khi dùng `field?.label`. Sau khi fix root cause (`normalizeForm`), `field.checkItem` sẽ luôn được resolve đúng.

**Root cause & Fix:**
- `/api/forms/:formId` trả về raw DB row với key `layout_blocks` (snake_case). `extractAllFormFields(formTemplate.layoutBlocks)` nhận `undefined` → `allFormFields = []` → mọi field lookup fail → 3 bugs cascade.
- Fix: `normalizeForm(raw)` helper trong `useEffect`, áp dụng cho cả 2 fetch path.

---

