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

### 2026-09-28 — Report Builder: Tái cấu trúc `FormReport.tsx` theo chuẩn `PrintReport` & Xóa bỏ Khối Hardcoded

**Scope:** 4 files (`src/components/FormReport.tsx`, `src/components/print/printShared.tsx`, `src/components/print/PrintReport.tsx`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | 17.5 min |
| Thời gian lập plan (Request → Proceed) | 12.6 min |
| Thời gian thực thi (Proceed → Push) | 4.9 min |
| Số file nguồn chỉnh sửa | 3 (`FormReport.tsx`, `printShared.tsx`, `PrintReport.tsx`) |
| Lượt edit sửa lỗi (rework) | 2 (bổ sung `)}` đóng TITLE block, sửa kiểu `onImgSettled` tùy chọn) |
| Số lần build | 3 (`tsc --noEmit` pass, `npm run build` 13.78s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Triệt tiêu Khối Cứng (Hardcoded) không thuộc Builder:**
  - Xóa bỏ hoàn toàn 4 thẻ KPI Scorecard tóm tắt (`totalEvaluated`, `passCount`, `failCount`, `overallStatus`) ở đầu báo cáo — vốn không hề tồn tại trong Report Builder template.
  - Loại bỏ toàn bộ viền hộp đen nhân tạo `border: 1px solid #000` bao quanh các khối `TITLE`, `INFO_GRID`, và `SIGN`.
- **Đồng bộ WYSIWYG 100% giữa View Screen (`FormReport`) và Print/PDF (`PrintReport`):**
  - Trích xuất `renderReportField` thành pure shared component trong `src/components/print/printShared.tsx` (Rule 4.1), dùng chung giữa `PrintReport` và `FormReport`.
  - Hiển thị chuẩn hóa các trường dữ liệu: ô kiểm glyph `[✓]`, lựa chọn radio, giải mã nhãn tiếng Việt cho dropdown select, text/number có gạch chân baseline chấm mờ, và biểu đồ Radar/Bar lồng trong ô.
  - Áp dụng `<PrintTitleBlock />`, `<PrintSectionHeader />`, bảng ISO Table (STT, Spec, Kết quả thực tế, Đánh giá ĐẠT/K.ĐẠT), và cụm chữ ký chuẩn ISO.

---

### 2026-09-28 — Report Builder: Chuẩn hóa Render Engine & Kiểu In ấn Khối INFO_GRID cho `PrintReport.tsx`

**Scope:** 3 files (`src/components/print/PrintReport.tsx`, `src/utils/formUtils.ts`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~13 min |
| Thời gian lập plan (Request → Proceed) | ~4.7 min |
| Thời gian thực thi (Proceed → Push) | ~8.2 min |
| Số file nguồn chỉnh sửa | 2 (`formUtils.ts`, `PrintReport.tsx`) |
| Lượt edit sửa lỗi (rework) | 1 (khôi phục `operatorText`/`supervisorText` bị ghi đè khi chèn `renderReportField`) |
| Số lần build | 3 (`tsc --noEmit` pass, `npm run build` 8.53s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Khắc phục Triệt để Lộ ID & Cờ Logic Thô:**
  - `field.type === 'select'`: Tự động gọi `formatOptionDisplay(val, field.options)` để ánh xạ mã `OPT_...` thành nhãn tiếng Việt (*Cá*).
  - `field.type === 'checkbox' | 'radio'`: Render ô kiểm trực quan `[✓]` và `[ ]` (hoặc `(✓)` cho radio) kèm nhãn tiếng Việt, không còn in chuỗi thô `PASS,FAIL`. Hỗ trợ cả `OPTION_C` và `OPTION_A`.
  - Cơ chế so khớp kép `isOptionSelected(val, opt.value) || isOptionSelected(val, opt.label)` đảm bảo tương thích mọi kiểu lưu trữ.
- **Tái cấu trúc Bố cục In ấn Trang nhã:**
  - Loại bỏ hoàn toàn `justify-content: space-between` kéo dãn nhãn và giá trị về 2 mép giấy.
  - Sử dụng khoảng cách tự nhiên (`gap: 8px`) và gạch chân chấm mờ chân chữ, đồng bộ 100% phong cách với `PrintFilledForm` và `PrintScoring`.
  - Hỗ trợ đầy đủ `colSpan` và `rowSpan` trong CSS Grid.

---

### 2026-09-28 — Report Builder: Chuẩn hóa `PrintReport.tsx` Tái sử dụng Tài nguyên In Dùng chung (`printShared.tsx`)

**Scope:** 4 files (`src/components/print/PrintReport.tsx`, `src/components/print/printShared.tsx`, `DESIGN_REPORT_BUILDER.md`, `AGENTS.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~8 min |
| Thời gian lập plan (Request → Proceed) | ~2 min |
| Thời gian thực thi (Proceed → Push) | ~6 min |
| Số file nguồn chỉnh sửa | 2 (`PrintReport.tsx`, `printShared.tsx`) |
| Tổng lượt edit source | 5 |
| Lượt edit sửa lỗi (rework) | 1 (`ReportBlockConfig` type union in `printShared.tsx`) |
| Số lần build | 3 (`tsc --noEmit` pass, `tsc -b` pass, `vite build` 9.09s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Triệt tiêu Trùng lặp & Chuẩn hóa In ấn Toàn diện:** Đồng bộ `PrintReport.tsx` theo chuẩn kiến trúc của `PrintBlankForm`, `PrintFilledForm` và `PrintScoring`.
- **Áp dụng `printShared.tsx` Primitives:**
  - Thay thế 30 dòng tự quản lý state & fetch logo Cloudflare R2 bằng hook `usePrintLogo(titleBlock?.logo)`.
  - Thay thế 53 dòng CSS inline `@media print` bằng component chuẩn `<PrintDocumentStyles isA5={isA5} />`.
  - Thay thế khối render `TITLE` thủ công (66 dòng) bằng `<PrintTitleBlock />`, hỗ trợ hiển thị ngày nộp bản ghi linh hoạt.
  - Tái sử dụng `<PrintSectionHeader />` cho tiêu đề `SECTION_LABEL`, `INFO_GRID` và `TABLE`, giải quyết triệt để các đoạn switch-case rườm rà.
  - Thay thế chân trang tĩnh bằng `<PrintPageFooter />` chuẩn ISO.
- **Mở rộng Type Contract `printShared.tsx`:** Cho phép `PrintTitleBlock` và `PrintSectionHeader` nhận cả `LayoutBlockISO` và `ReportBlockConfig`, loại bỏ ép kiểu cưỡng bức.
- **Kỷ luật Module Ownership (`AGENTS.md`):** Đăng ký chính thức các component của phân hệ Report Builder (`ReportBuilder.tsx`, `FormReport.tsx`, `PrintReport.tsx`, `PrintScoring.tsx`) thay thế cho `*(Components TBD)*`.

---

### 2026-09-28 — Form Operations & Report Builder: Tinh gọn Thanh Công cụ Xem Bản nộp (`FormFiller`), Bổ sung Segmented Pill Tab `[ Form | Report ]`, Tích hợp Hộp Chia sẻ Link Động và Embedded FormReport

**Scope:** 8 files (`server.cjs`, `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/FormFiller.tsx`, `src/components/FormManager.tsx`, `src/components/FormReport.tsx`, `src/components/SubmissionManager.tsx`, `src/components/SubmissionViewer.tsx`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~45 min |
| Thời gian lập plan (Request → Proceed) | ~11 min |
| Thời gian thực thi (Proceed → Push) | ~34 min |
| Số file nguồn chỉnh sửa | 8 |
| Tổng lượt edit source | 16 |
| Lượt edit sửa lỗi (rework) | 2 (`FormFiller.tsx` hoisting & `FormManager.tsx` call-site pruning) |
| Số lần build | 3 (`tsc --noEmit` pass, `tsc -b` pass, `vite build` 8.10s pass) |
| Lần build cuối thành công? | Có (100% pass) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tinh gọn Thanh Công cụ Submission View Toolbar (`FormFiller.tsx`):** Loại bỏ hoàn toàn các thành phần dư thừa gây chật chội (`[ ABNORMALITY ]` badge, tên người nộp `• NGUYỄN VĂ...`, nút `[📋 Sao chép]`, rút gọn chữ `Quay lại` thành `[←] ID`, chữ `In bản khai` thành `[🖨 In]`). Giữ nguyên Pill Button Focus Mode (`Focus mode [ ●]`) trên tab Form.
- **Segmented Pill Tab `[ Form | Report ]`:** Tái hiện chuẩn mực giao diện từ `ReportBuilder.tsx` (nền `#f0fdfa`, viền `#99f6e4`, nút trắng active nổi bật kèm chữ teal đậm).
- **Hộp Chia sẻ Link Trực quan (Zero-Modal Sharing):** Triệt tiêu modal popup chia sẻ rườm rà. Tích hợp trực tiếp hộp input kèm nút `Sao chép` trên toolbar: khi ở tab Form, tự động sinh và sao chép link Form Submission (`/f/:slug/s/:subId?token=...`); khi ở tab Report, tự động sinh và sao chép link Report (`/f/:slug/r/:subId?token=...`).
- **Nút Thao tác Thống nhất `[✏️ Chỉnh sửa]`:** Hiển thị đồng nhất trên cả 2 tab: ở tab Form chuyển sang chế độ inline edit bản nộp; ở tab Report điều hướng trực tiếp sang Report Builder để tinh chỉnh mẫu báo cáo.
- **Embedded Report Canvas (`FormReport.tsx`):** Bổ sung chế độ `isEmbedded`, loại bỏ fixed outer header 56px và padding ngoài, render trực tiếp nội dung canvas báo cáo lồng trong view bản nộp.
- **Đồng bộ Định tuyến & Quyền Guest Token (`server.cjs`, `App.tsx`, `SubmissionViewer.tsx`):** Hỗ trợ đầy đủ routing `/f/:slug/[sr]/:subId` và `/[sr]/:subId`, bổ sung endpoint `GET /api/reports/view/:submissionId` trả về trọn bộ submission + formTemplate + reportTemplate cho khách xem bằng token không cần đăng nhập.

---

### 2026-09-28 — Report Builder: Tinh gọn Bản In Chấm điểm (`PrintScoring`), Kế thừa Layout Minimal của `PrintBlankForm` & Tách Module In Dùng chung (`printShared`, `formUtils`)

**Scope:** 7 files (`src/utils/formUtils.ts`, `src/components/print/printShared.tsx`, `src/components/print/PrintBlankForm.tsx`, `src/components/print/PrintFilledForm.tsx`, `src/components/print/PrintScoring.tsx`, `src/components/ReportBuilder.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~11.5 min |
| Thời gian lập plan (Request → Proceed) | ~2.5 min |
| Thời gian thực thi (Proceed → Push) | ~9.0 min |
| Số file nguồn chỉnh sửa | 6 (`formUtils.ts`, `printShared.tsx`, `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, `PrintScoring.tsx`, `ReportBuilder.tsx`) |
| Tổng lượt edit source | 12 |
| Lượt edit sửa lỗi (rework) | 2 (bổ sung import types `TableColumnConfig`) |
| Số lần build | 2 (`tsc --noEmit` + `npm run build` 19.24s pass) |
| Lần build cuối thành công? | Có |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Tái cấu trúc Module In Dùng chung (`printShared.tsx` & `formUtils.ts` — Rule 4.1):** Trích xuất pure helpers `getChecklistColumns` và `groupTableRowsForPrint` sang `src/utils/formUtils.ts`, tạo module dùng chung `src/components/print/printShared.tsx` (`usePrintLogo`, `PrintDocumentStyles`, `PrintTitleBlock`, `PrintSectionHeader`, `PrintPageFooter`) tái sử dụng đồng bộ trên cả 3 component in (`PrintBlankForm`, `PrintFilledForm`, `PrintScoring`).
- **Giao diện In Đặc tả Siêu Tinh gọn (`PrintScoring.tsx` — đồng bộ 100% với `PrintBlankForm`):**
  - Xóa bỏ toàn bộ khung banner rườm rà và hộp khung viền chú giải công thức đầu trang.
  - Khối `INFO_GRID` không còn khung viền xám bao ngoài, không vạch chia ô, không lặp lại thanh tiêu đề `"Thông tin chung"`, giữ nguyên dòng chấm `...... 5đ` và ô chọn `☐` / `○`.
  - Khối `TABLE` bảo toàn 100% kiểu đường viền gốc (`borderless` 3 cột Likert scale `○ 5đ` / `○ 3đ` / `○ 1đ`, cột Sao `☆ ☆ ☆ ☆ ☆`, cột Checkbox `☐ Option (+1đ)`).
  - Toàn bộ trọng số được thể hiện bằng nhãn monospace thanh mảnh `[X% / Parent]` neo gọn ở góc trên bên phải của từng khối/ô.
- **Triệt tiêu Mã Chết (`PrintFormScoringSpec.tsx` — Rule 4.2):** Xóa bỏ hoàn toàn file cũ `PrintFormScoringSpec.tsx`, chuyển đổi toàn bộ call-sites trong `ReportBuilder.tsx` sang `PrintScoring.tsx`.

---

### 2026-09-28 — Report Builder: Chuẩn hóa Ký hiệu Trọng số Đa ngôn ngữ (`Option D: / & ⊞`), Gắn Trọng số Góc Trên-Phải & Tạm lược bỏ `isPass` trên Bản In `tab Form` (`reportScoring`, `PrintFormScoringSpec`)

**Scope:** 4 files (`src/utils/reportScoring.ts`, `src/components/print/PrintFormScoringSpec.tsx`, `DESIGN_REPORT_BUILDER.md`, `SESSION_LOG.md`)

| Chỉ số | Giá trị |
|---|---|
| Thời gian tổng (Request → Push) | ~6.5 min |
| Thời gian lập plan (Request → Proceed) | ~2.5 min |
| Thời gian thực thi (Proceed → Push) | ~4.0 min |
| Số file nguồn chỉnh sửa | 2 (`reportScoring.ts`, `PrintFormScoringSpec.tsx`) |
| Tổng lượt edit source | 8 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`tsc --noEmit` + `npm run build` 9.22s pass) |
| Lần build cuối thành công? | Có (100% pass ngay lần đầu) |
| Số lỗi mới phát sinh | 0 |
| Số lỗi cũ lặp lại | 0 |

**Điểm nổi bật:**
- **Chuẩn hóa Ký hiệu Trọng số Đa ngôn ngữ (`Option D` — `/` & `⊞`):** Thay thế giới từ tiếng Anh `"of"` bằng ký hiệu toán học `"/"` và thay thế chữ tiếng Việt `"Bảng"` bằng ký hiệu bảng quốc tế `"⊞"` trong `WeightBadgeSpec` (`src/utils/reportScoring.ts`) và `renderWeightBadge` (`src/components/print/PrintFormScoringSpec.tsx`), tạo thành bộ ký hiệu `[35% / Form]`, `[50% / H1]`, `[100% / H2]`, `[17% / ⊞]` dùng chung tự nhiên cho cả tiếng Việt lẫn tiếng Anh.
- **Định vị Trọng số tại Góc Trên-Phải của Mọi Khối Giao diện:** Chuyển toàn bộ huy hiệu trọng số của `H1`, `H2`, header khối `INFO_GRID`, từng ô trường `INFO_GRID`, header khối `TABLE` và từng ô dữ liệu `TABLE` về góc trên bên phải (`display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'`), tạo trục thị giác đồng nhất để rà soát nhanh tổng `100%`.
- **Tạm lược bỏ `isPass` để Giữ Bản In Tinh gọn:** Lược bỏ phân biệt màu sắc/biểu tượng `◉` vs `○` (`isPass`) và dòng `ruleSummary` ngưỡng Đạt trong `renderInlineFieldAnswerKey` cũng như trên thanh chú giải đầu trang; hiển thị đồng nhất mọi phương án lựa chọn/thang đo kèm điểm số (`• {label} · {scoreText}`, `[{label}: {scoreText}]`).

---

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









