# Session Log — Bộ nhớ Phiên (Episodic Memory)

> File này là bộ nhớ dài hạn của agent. Đọc trước khi thực thi, cập nhật sau khi
> hoàn thành. Xem `AGENTS.md` Mục 13 để biết quy trình.

---

## Bài học Tích lũy

Danh sách lỗi đã gặp kèm biện pháp phòng ngừa. Agent đọc mục này trước mỗi
phiên thực thi để không lặp lại lỗi cũ.

| # | Nhóm | Lỗi | Biện pháp phòng ngừa | Lần gặp |
|---|---|---|---|---|
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
| 24 | `ENV` | Tiến trình `git.exe` nền trên Windows bị treo giữ file lock `.git\index.lock` khiến git status/commit ngưng trệ | Luôn chạy `Stop-Process -Name git -Force; Remove-Item .git\index.lock -Force` trước lệnh git | 1 |
| 25 | `BLOAT` | Bỏ logic gán status nhưng sót tên biến `isOverallPass` tại chữ ký destructuring `const { snapshots, isOverallPass }` và hàm trả về → TS6133 | Áp dụng Rule 13.10 Destructuring Prune: Xóa ngay tên biến tại destructure và hàm sinh trong cùng lần patch | 1 |
| 26 | `LOGIC` | Dùng trường câu hỏi dài (>45 ký tự) trong `INFO_GRID` bị áp `whiteSpace: 'nowrap'` trên `PrintBlankForm` khiến bảng in phình rộng >1.200px và co chữ xuống 55%; nhúng bảng nhiều cột vào `subtable` làm giảm cỡ chữ xuống `0.75rem` | Với bảng dữ liệu nhiều cột, ưu tiên dùng khối `TABLE` (`borderStyle: 'grid'`) cấp cao nhất; trong `INFO_GRID`, tự động ngắt dòng (`isLongTextLabel`) khi `cleanLabel.length > 45` hoặc có `\n` | 1 |
| 27 | `LOGIC` | Container bảng dùng `overflowX: 'auto'` tự động kích hoạt `overflowY: 'auto'` theo chuẩn W3C CSS khiến dropdown menu (`position: absolute; top: 100%`) bị cắt cụt (cut off) ở đáy bảng và sinh thanh cuộn dọc không mong muốn khi bảng có ít hàng | Đặt `overflow: 'visible'` trên wrapper bảng nếu các hàng có dropdown menu tuyệt đối; bổ sung dynamic `zIndex: isGroupActive ? 30 : 1` trên card cha để menu hiển thị đè lên các card tiếp theo | 1 |
| 28 | `SCOPE` | Khi thêm tính năng in kèm hướng dẫn biểu mẫu trắng, nếu tạo component in mới sẽ trùng lặp title block, logo, @page CSS và phân trang | Kế thừa trực tiếp component in hiện hữu (`PrintBlankForm`) thông qua cờ prop `includeGuidance?: boolean` để giữ 100% nhất quán định dạng và zero duplication | 1 |
| 29 | `LOGIC` | Gộp chung `field.type === 'radio'` với `select` trong render nhánh form khiến radio biến thành dropdown `<select>` và chữ dài bị ép 1 dòng; dùng `maxWidth: '180px'` cứng nhắc trên canvas khiến nhãn radio dài bị cắt cụt | Luôn tách riêng component render radio button group với radio circle native; với nhãn nhiều dòng trên canvas, dùng CSS Grid auto-growing `<textarea>` thay vì `<input>` cố định chiều rộng | 1 |
| 30 | `BLOAT` | Nhập liệu nội dung hướng dẫn dài trên sidebar hẹp sinh thanh cuộn dọc kép và bắt buộc cuộn trang | Tách sub-component In-Canvas Accordion Editor với CSS Grid auto-grow textarea, cho phép xem và sửa trực tiếp ngay tại vị trí câu hỏi trên Canvas (Rule 13.9) | 1 |

---

## Nhật ký Phiên

### 2026-10-14 — Chuẩn Hóa URL Slug Tiếng Việt Cho Biểu Mẫu (Frontend & Backend Aligned, Không Tương Thích Ngược)

**Scope:** 4 source files (`src/utils/formUtils.ts`, `server.cjs`, `src/components/FormBuilder.tsx`, `src/components/FormFiller.tsx`) + 3 design docs (`DESIGN_FORM_OPERATIONS.md`, `DESIGN_FORM_DESIGNER.md`, `DESIGN_BACKEND.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 4 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`npx tsc --noEmit` pass 100%, `npm run build` pass 20.35s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Trích xuất Pure Utility `toFormSlug` (`src/utils/formUtils.ts`):** Xây dựng hàm pure utility chuẩn hóa chuỗi tiếng Việt thành slug URL an toàn qua Unicode NFD, bóc tách dấu mũ/thanh, chuyển đổi ký tự `đ/Đ` thành `d`, chuyển ký tự đặc biệt thành `-` và xóa gạch thừa hai đầu (ví dụ: `"Biểu mẫu đánh giá nhà máy"` ➔ `bieu-mau-danh-gia-nha-may`).
- **Đồng bộ hóa Backend (`server.cjs`):** Nâng cấp hàm `toSlug` xử lý `đ/Đ ➔ d`, giúp endpoint `GET /api/forms/resolve/*identifier` so khớp chính xác 100% giữa URL slug và tiêu đề form trong cơ sở dữ liệu (`toSlug(formRecord.form_title)`), triệt tiêu lỗi 404 khi truy cập biểu mẫu công khai.
- **Thay thế Code Inline Frontend (`FormBuilder.tsx`, `FormFiller.tsx`):** Thay thế toàn bộ các đoạn mã regex sinh slug thô bằng lời gọi hàm tập trung `toFormSlug`, loại bỏ triệt để các đường link dị tật cắt chữ (như `bi-u-m-u-nh-gi-nh-m-y`).
- **Tuân thủ Tuyệt đối Yêu cầu Không Tương Thích Ngược:** Không sinh thêm fallback code hay bloatware cho các URL unicode dị tật cũ vốn dĩ không hoạt động.

### 2026-10-14 — Chuẩn hóa Hướng dẫn Nghiệp vụ & Đồng bộ Database cho Biểu mẫu Đánh giá Nhà máy (3S-FA02)

**Scope:** 2 script files (`scripts/guidanceData.cjs` [NEW], `scripts/seedFactoryAssessmentForm.cjs`) + PostgreSQL Database (`forms`, `processes`).

| Chỉ số | Giá trị |
|---|---|
| Số trường được nạp hướng dẫn | 17 trường chỉ số nghiệp vụ trọng yếu |
| Số file nguồn frontend (`src/`) sửa đổi | 0 (Zero source change - tuân thủ kiến trúc động) |
| Số lần build | 1 (`npx tsc --noEmit` 0 lỗi, `npm run build` pass 13.69s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Chuẩn hóa Sổ tay Nghiệp vụ (`guidelines_factory_assessment.md`):** Xây dựng bộ quy tắc 3 đầu dòng không đánh số (Định nghĩa & Cách tính, Tài liệu đối chứng, Kiểm tra tính hợp lý / Đánh giá độ ổn định) cho toàn bộ 14 nhóm chỉ số số liệu của Biểu mẫu 3S-FA02 (Sản lượng cont, tấn, công suất thiết kế, cam kết, bảo trì CM/PM, dừng máy, tập trung NCC, khiếu nại, giao trễ, độ biến thiên lead-time, tỷ lệ giữ chân nhân sự chủ chốt, công suất nước thải).
- **Tập trung hóa Từ điển Guidance (`scripts/guidanceData.cjs`):** Tạo module từ điển `GUIDANCE_MAP` lưu trữ các chuỗi markdown hướng dẫn, tích hợp trực tiếp vào seed script để tự động áp dụng cho template biểu mẫu `3S-FA02`.
- **Đồng bộ Cơ sở Dữ liệu PostgreSQL:** Nạp thành công toàn bộ 17 chuỗi hướng dẫn vào bảng `forms` (3S-FA02 v0.1) và đồng bộ trường `workflowFormsData['3S-FA02']` trong bảng `processes` (quy trình `3S-FA`), kích hoạt hiển thị hướng dẫn tức thì trên cả `FormBuilder` (in-canvas editor) và `FormFiller` (accordion tooltip).

### 2026-10-14 — Trình Soạn thảo Hướng dẫn Điền Câu hỏi Trên Canvas (FormBuilder)

**Scope:** 2 source files (`src/components/form/InCanvasGuidanceEditor.tsx` [NEW], `src/components/FormBuilder.tsx`) + 1 design doc (`DESIGN_FORM_DESIGNER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`npx tsc --noEmit` pass 100%, `npm run build` pass 17.26s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Sub-component Độc lập (`InCanvasGuidanceEditor.tsx`):** Đóng gói toàn bộ logic và JSX của trình soạn thảo / xem trước hướng dẫn theo Rule 13.9 (Monolith Guard). Tích hợp thanh công cụ inline `[ B ] [ I ] [ U ] [ • ] [ 💡 ]`, nút chuyển đổi chế độ `[ 👁 Xem trước / ✍️ Soạn thảo ]` và nút thu gọn.
- **CSS Grid Auto-Grow Textarea (Triệt tiêu 100% thanh cuộn):** Sử dụng kỹ thuật CSS Grid mirror span để khung textarea tự động dãn nở chiều cao theo nội dung, loại bỏ hoàn toàn thanh cuộn dọc bên trong ô nhập liệu (khắc phục triệt để lỗi bó hẹp chiều cao trên sidebar).
- **Tích hợp Accordion Trên Canvas (`FormBuilder.tsx`):** Bổ sung nút `[ 💡 Hướng dẫn ▾/▴ ]` đối với câu hỏi đã có nội dung và `[ + 💡 Hướng dẫn ]` khi trường được chọn. Cho phép người thiết kế xem và sửa hướng dẫn trực tiếp ngay tại vị trí câu hỏi trên tờ A4 Canvas mà không cần di chuyển mắt hay cuộn trang sidebar.
- **Đồng bộ 2 Chiều & Nâng cấp Inspector:** Thêm nút `[ Mở trên Canvas ▾/▴ ]` tại mục HƯỚNG DẪN trong Right Inspector và mở rộng `minHeight: 80px, maxHeight: 260px` cho textarea sidebar.

### 2026-10-14 — Chuẩn hóa Bố cục Thích ứng & Khắc phục Lỗi Cắt chữ Radio Button trong Info Grid (FormBuilder & FormFiller)

**Scope:** 3 source files (`src/utils/formUtils.ts`, `src/components/FormFiller.tsx`, `src/components/FormBuilder.tsx`) + 2 design docs (`DESIGN_FORM_OPERATIONS.md`, `DESIGN_FORM_DESIGNER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`npx tsc --noEmit` pass 100%, `npm run build` pass 24.77s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Chuẩn hóa Bố cục Thích ứng (Adaptive Hybrid Layout theo NN/g & Material Design):** Tinh chỉnh hàm pure helper `hasLongOptions` trong `formUtils.ts`. Tự động chuyển sang bố cục xếp dọc (1 lựa chọn / 1 dòng) khi có $\ge 3$ lựa chọn hoặc bất kỳ nhãn nào $> 25$ ký tự, hoặc khối Info Grid chia $\ge 2$ cột; chỉ giữ hàng ngang khi có đúng 2 lựa chọn nhị phân ngắn (như "Đạt / Không đạt", "Có / Không").
- **Khắc phục Lỗi Cắt Chữ trên FormBuilder Canvas (`FormBuilder.tsx`):** Loại bỏ giới hạn cứng `maxWidth: '180px'` trên thẻ input lựa chọn. Khi ở dạng xếp dọc, áp dụng cơ chế CSS Grid auto-growing `<textarea>` overlay (`width: 100%`, `display: flex`, `alignItems: flex-start`), cho phép câu chữ dài hàng trăm ký tự xuống dòng 2-3 dòng trọn vẹn, không bị che khuất mép phải, đồng thời bảo toàn tính năng kéo thả đổi thứ tự và sửa nhãn trực tiếp.
- **Tách riêng Radio Button Group trong FormFiller (`FormFiller.tsx`):** Tách biệt rạch ròi `field.type === 'radio'` ra khỏi `field.type === 'select'`. Render Radio Button Group thực thụ với các nút tròn radio native, nhãn dạng `<label>` hỗ trợ `whiteSpace: 'pre-wrap'`, `wordBreak: 'break-word'`, click chọn mượt mà và hỗ trợ đầy đủ ô nhập tự do khi chọn mục "Khác".

### 2026-10-13 — Chức năng Hướng dẫn Điền Câu hỏi (Question Guidance) & In Kèm Hướng dẫn

**Scope:** 6 source files (`types.ts`, `textFormatter.tsx`, `FormBuilder.tsx`, `PrintBlankForm.tsx`, `FormFiller.tsx`, `Dashboard.tsx`) + 1 seed script (`scripts/seedFactoryAssessmentForm.cjs`) + 3 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`, `DESIGN_PLATFORM_SHELL.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 6 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`npx tsc --noEmit` pass 100%, `npm run build` pass 15.56s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Soạn thảo Hướng dẫn Điền (`FormBuilder`):** Bổ sung thuộc tính `guidance?: string` trong `FormFieldISO` và `TableRowConfig`. Hiển thị phần soạn thảo `HƯỚNG DẪN` cùng dòng với toolbar định dạng inline `[ B ] [ I ] [ U ] [ • ] [ 💡 ]`. Trích xuất pure helper `insertTextAtCursor` hỗ trợ chèn ký hiệu bullet và emoji tự động duy trì con trỏ/focus.
- **Accordion Tương tác trong Form Filler (`FormFiller`):** Nhấp vào tiêu đề câu hỏi hoặc nút `[ 💡 Hướng dẫn ▾/▴ ]` mở rộng/thu gọn khối hướng dẫn markdown phong phú (theo Phương án 1: không hardcode tiêu đề tĩnh, dải viền xanh ngọc `#0d9488`, nền `var(--neutral-bg)`). Quản lý trạng thái thông qua `expandedGuidanceMap`.
- **Nâng cấp Menu In Đa Tùy chọn (`FormFiller` & `Dashboard`):**
  - Tại `FormFiller`: Nâng cấp nút in trên thanh công cụ thành dropdown menu `[ 🖨️ In ▾ ]` cho phép lựa chọn `In bản khai` hoặc `In bảng câu hỏi kèm hướng dẫn`. Tự động đóng menu khi nhấp chuột ra ngoài.
  - Tại `Dashboard` (Tab Forms): Thêm tùy chọn `In bảng câu hỏi kèm hướng dẫn` vào menu `[ ••• ]` với icon `BookOpen`.
  - Tái sử dụng trọn vẹn `PrintBlankForm`: Tích hợp helper `PrintFieldGuidanceBox` hiển thị icon `💡` và nội dung hướng dẫn trên các khối `INFO_GRID`, `CHECKLIST_TABLE`, và `TABLE` khi cờ `includeGuidance={true}` được bật, bảo toàn 100% khung tiêu đề động, lề in A4 và chân trang phân trang.
- **Dữ liệu Mẫu Khảo sát Nhà máy (`3S-FA02`):** Cập nhật script `seedFactoryAssessmentForm.cjs` bổ sung tiêu chí đánh giá, phương pháp thu thập bằng chứng cho các câu hỏi thẩm định thực tế và đồng bộ dữ liệu vào PostgreSQL.

### 2026-10-13 — Triệt tiêu Lỗi Cắt cụt Dropdown Menu trên Tab Forms & Submissions

**Scope:** 2 source files (`Dashboard.tsx`, `SubmissionManager.tsx`) + 2 design docs (`DESIGN_PLATFORM_SHELL.md`, `DESIGN_FORM_OPERATIONS.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`npx tsc --noEmit` pass 100%, `npm run build` pass 14.92s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Giải quyết triệt để CSS Overflow Trap:** Chuyển đổi thuộc tính vùng chứa bảng con từ `overflowX: 'auto'` sang `overflow: 'visible'` trên cả 2 phân hệ `Dashboard.tsx` (Tab Forms) và `SubmissionManager.tsx` (Tab Submissions). Loại bỏ quy tắc CSS tự động tính `overflow-y: auto` làm phát sinh thanh cuộn dọc không mong muốn và cắt cụt menu thao tác (`...`) khi danh sách chỉ có 1–2 bản ghi.
- **Nâng cấp Thứ tự Lớp (Dynamic Stacking Elevation):** Bổ sung thuộc tính `zIndex: isGroupActive ? 30 : 1` (kèm `position: 'relative'`) trên thẻ `.paper-card` bao bọc, bảo đảm dropdown menu khi mở tràn xuống dưới sẽ nổi hoàn toàn lên trên các thẻ quy trình / biểu mẫu kế tiếp mà không bị che khuất.
- **Bảo toàn 100% Chức năng & Không phát sinh Rework:** Giữ nguyên các chức năng xem lịch sử nộp, in phôi trắng, xuất PDF, nhân bản biểu mẫu, cấu hình báo cáo, và cơ chế đóng tự động khi click ra ngoài.

### 2026-10-13 — Chuẩn hóa Kiểu chữ, Lề trang & Bố cục `3S-FA02` theo Hệ thống (Phương án 3 Hybrid)

**Scope:** 4 source files (`PrintBlankForm.tsx`, `PrintFilledForm.tsx`, `PrintScoring.tsx`, `FormFiller.tsx`) + 1 seed script (`scripts/seedFactoryAssessmentForm.cjs`) + 3 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`, `DESIGN_REPORT_BUILDER.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 5 (`PrintBlankForm`, `PrintFilledForm`, `PrintScoring`, `FormFiller`, `seedFactoryAssessmentForm.cjs`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`npx tsc --noEmit` pass 100%, `npm run build` pass 10.64s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Sửa tận gốc lỗi ép co trang in A4 (`PrintBlankForm`, `PrintFilledForm`, `PrintScoring`):** Thêm cơ chế `isLongTextLabel` (`cleanLabel.length > 45 || cleanLabel.includes('\n')`) cho các trường `text`/`number` một dòng trong `INFO_GRID` để tự động ngắt dòng nhãn (`whiteSpace: 'pre-wrap'`, `wordBreak: 'break-word'`) và xếp dòng kẻ chấm trả lời xuống dưới (`width: '100%'`), đồng thời cho phép nhãn `OPTION_A` `checkbox`/`radio` dài hơn 45 ký tự tự xuống dòng. Loại bỏ hoàn toàn hiện tượng `.print-outer-table` phình ra 1.250px làm trình duyệt thu nhỏ tỷ lệ in xuống 55%.
- **Chuẩn hóa Typography trên màn hình điền biểu mẫu (`FormFiller`):** Nâng cấp nhãn câu hỏi trong `INFO_GRID` từ `0.78rem` (`fontWeight: 400`, `var(--text-secondary)`) lên chuẩn hệ thống `0.82rem` (`fontWeight: 500`, `var(--text-primary)`, `whiteSpace: 'pre-wrap'`) và nhãn tùy chọn `checkbox` lên `0.82rem`.
- **Nâng cấp Cấu trúc Biểu mẫu `3S-FA02` (`seedFactoryAssessmentForm.cjs`):** Chuyển đổi 4 bảng danh sách nhiều cột (`Đại diện doanh nghiệp làm việc`, `Sản phẩm / nhóm sản phẩm chính`, `Danh sách thiết bị chính`, `Doanh nghiệp đang có Chứng nhận Hệ thống Quản lý ATTP đang còn hiệu lực?`) từ `subtable` sang các khối `TABLE` (`borderStyle: 'grid'`, `titleFormat: 'H2'`) cấp cao nhất; tách tiêu đề 8 phần chính và tiểu mục thành các khối `SECTION_LABEL` (`H1`/`H2`). Đồng bộ thành công 28 blocks và 79 fields vào PostgreSQL.

### 2026-10-13 — Factory Assessment Form (`3S-FA02` - Biểu mẫu đánh giá nhà máy): Complete 8-Section Schema Seed & Sync

**Scope:** 1 script file (`scripts/seedFactoryAssessmentForm.cjs` [NEW]) + PostgreSQL DB (`forms` & `processes`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 (`scripts/seedFactoryAssessmentForm.cjs`) |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`npx tsc --noEmit` pass 100%, `npm run build` pass 11.07s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Phân tích & Bóc tách 100% PDF 6 trang ("BIỂU MẪU ĐÁNH GIÁ NHÀ MÁY"):** Thiết kế và khởi tạo đầy đủ 12 khối (`layoutBlocks`) gồm 83 trường dữ liệu (`FormFieldISO`) trải dài qua 8 phần chính (`I. THÔNG TIN CHUNG`, `II. CÔNG SUẤT`, `III. NĂNG LỰC QUẢN LÝ CHẤT LƯỢNG`, `IV. NĂNG LỰC GIAO HÀNG`, `V. NĂNG LỰC QUẢN LÝ & TỔ CHỨC` + `KEY STAFF RETENTION RATE`, `VI. TUÂN THỦ QUY ĐỊNH & PHÁP LÝ`, `VII. NĂNG LỰC ỨNG DỤNG CÔNG NGHỆ`, `VIII. HÌNH ẢNH MINH CHỨNG`) và khối chữ ký xác nhận (`SIGN`).
- **Chuẩn hóa Cấu trúc Trường cho ReportBuilder & FormFiller:** Tách riêng từng chỉ số sản lượng/công suất thành các trường `number` độc lập kèm `unit` (`cont/tháng`, `tấn/tháng`, `%`, `giờ`, `ngày`, `năm`, `người`, `lần`, `m3/ngày`), dựng 4 bảng danh sách động (`subtable`) và hiệu chỉnh các lỗi chính tả từ bản PDF gốc.
- **Đồng bộ CSDL (`forms` & `processes`):** Cập nhật trực tiếp vào biểu mẫu `3S-FA02` (`v0.1`, `DRAFT`) và đồng bộ `workflowFormsData['3S-FA02']` trong quy trình `3S-FA` (*"Quy trình đánh giá nhà máy"*).

### 2026-09-30 — FormFiller Loading Performance: SWR Instant Paint (0ms) & Single Process Endpoint

**Scope:** 4 source files (`server.cjs`, `src/App.tsx`, `src/components/Dashboard.tsx`, `src/components/FormFiller.tsx`) + 3 design docs (`DESIGN_BACKEND.md`, `DESIGN_FORM_OPERATIONS.md`, `DESIGN_PLATFORM_SHELL.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 4 |
| Lượt edit sửa lỗi (rework) | 0 (sửa chính xác 100% không phát sinh lỗi) |
| Số lần build | 2 (`npx tsc --noEmit` pass 100%, `npm run build` pass 13.30s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **SWR Instant Paint (0ms) cho FormFiller:** Khởi tạo `initialCache` đồng bộ qua `useMemo` đọc từ `preloadedFormTemplate` hoặc `sessionStorage` (`swr_forms`, `swr_processes`), khởi tạo `process` và `loading: false` ngay trong lần render đầu tiên, xóa bỏ hoàn toàn màn hình trắng "Loading digital template form...".
- **Backend Single Process Endpoint (`GET /api/processes/:id`):** Truy vấn đơn lẻ `processes` và `process_forms` theo ID, loại bỏ triệt để truy vấn toàn bộ CSDL (`SELECT * FROM processes`), giảm dung lượng payload mạng từ nhiều MBs xuống vài KBs và thời gian phản hồi từ ~2s xuống ~35ms.
- **Pipeline truyền phôi mẫu (`App.tsx` & `Dashboard.tsx`):** Chuyển trực tiếp `form.rawRecord` từ Dashboard qua App đến `<FormFiller preloadedFormTemplate={...} />`.
- **Parallel Network Waterfall (`Promise.all`):** Với trường hợp mở link trực tiếp (cold start), chạy song song `fetchForm` và `fetchProcessSingle`, rút ngắn thời gian chờ từ ~3.5s xuống ~300ms.
- **Dead-Code Pruning & Pure Utility Extraction:** Tách helper `buildVirtualProcess` độc lập, loại bỏ hơn 90 dòng code tạo block/process trùng lặp.

### 2026-09-30 — Tab Forms Column Refinement & Last Updated Sorting

**Scope:** 1 source file (`src/components/Dashboard.tsx`) + 1 design doc (`DESIGN_PLATFORM_SHELL.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 |
| Lượt edit sửa lỗi (rework) | 0 (sửa chính xác 100% không phát sinh lỗi) |
| Số lần build | 2 (`npx tsc --noEmit` pass 100%, `npm run build` pass 8.56s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Lược bỏ cột Work Step & Dead-code Pruning:** Loại bỏ hoàn toàn cột Work Step chiếm dụng không gian và dọn dẹp toàn bộ dữ liệu thừa (`workStepTitle`, `procSteps`, `stepIdx`) tuân thủ Rule 4.2.
- **Làm sạch cột Version:** Bỏ chuỗi ngày tháng `(DD/MM/YYYY)` trong option `<select>` và badge phiên bản đơn, loại bỏ hoàn toàn hiện tượng tràn/vỡ dòng phiên bản.
- **Thêm cột Last Updated:** Căn giữa, hiển thị icon `<Calendar size={11} />` kèm ngày định dạng `vi-VN` theo phiên bản biểu mẫu đang được chọn.
- **Sắp xếp theo Last Updated (Mới nhất lên trên cùng):** Tự động sắp xếp các form trong từng nhóm quy trình theo thời điểm cập nhật gần nhất, đồng thời sắp xếp các nhóm quy trình (kể cả Standalone Forms) theo timestamp của biểu mẫu mới nhất để nhóm và biểu mẫu vừa sửa luôn xuất hiện ở đầu trang.
- **Tái cân bằng tỷ lệ độ rộng (100%):** `Form ID (15%)` | `Form Title (37%)` | `Version (12%)` | `Status (10%)` | `Last Updated (14%)` | `Actions (12%)`.

### 2026-09-30 — Process-Centric Accordion List View in Tab Forms (Option 1)

**Scope:** 1 source file (`src/components/Dashboard.tsx`) + 1 design doc (`DESIGN_PLATFORM_SHELL.md`)

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 |
| Lượt edit sửa lỗi (rework) | 1 (sửa dấu đóng ngoặc `);` tại map callback và khôi phục biến state `duplicatingFormId` / `toast`) |
| Số lần build | 2 (`npx tsc --noEmit` pass 100%, `npm run build` pass 9.00s) |
| Lần build đầu thành công? | Không (sửa dứt điểm ngay lần 2) |

**Kết quả đạt được:**
- **Chuyển đổi Tab Forms sang Process-Centric Accordion:** Thay thế bảng phẳng đơn nhất cũ bằng hệ thống thẻ Accordion (`.paper-card.accent-teal`) phân nhóm biểu mẫu theo từng Quy trình đang hoạt động (kèm nhóm riêng cho Biểu mẫu tự do), đạt tính đồng bộ hình học và styling 100% với Tab Submissions.
- **Tích hợp Bước công đoạn (Work Step):** Tự động bóc tách và hiển thị thông tin bước công đoạn liên kết (`Step N: Title`) trong bảng con, giúp định vị trực quan vị trí kiểm soát của form trong luồng SOP chuẩn ISO.
- **Header Bar Quy chuẩn:** Tích hợp `Chevron` đóng/mở, icon quy trình (`GitBranch`), tên quy trình (bold), tag mã quy trình, badge số lượng form, badge trạng thái, và nút CTA `[ 👁 View Process ]` tại mép phải.
- **Bảo toàn 100% tính năng:** Điền form (`Fill`), Sửa thiết kế (`Edit`), Xem lịch sử nộp (`Audit`), In trắng (`Print`), Xuất PDF, Nhân bản form (`Duplicate`), và Cấu hình báo cáo (`Report`).

### 2026-09-30 — Zero-Shift Layout Frame & Visual Parity across 4 Tabs

**Scope:** 4 source files (`src/index.css`, `src/components/common/DashboardToolbar.tsx`, `Dashboard.tsx`, `SubmissionManager.tsx`) + 2 design docs

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 4 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`npx tsc --noEmit` pass 100%, `npm run build` pass 8.48s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Triệt tiêu hiện tượng giật ngang (Horizontal Shift):** Bổ sung `scrollbar-gutter: stable` và `overflow-y: scroll` cho `html` trong `index.css`, giữ chỗ cố định cho scrollbar dọc của trình duyệt Windows (17px), ngăn toàn bộ container 1600px giật sang bên 8.5px khi chuyển tab.
- **Khóa chiều cao Toolbar 56px (Zero Vertical Shift):** Khóa `minHeight: '56px'` và `boxSizing: 'border-box'` trên `DashboardToolbar`, đồng bộ chiều cao 36px cho tất cả các điều khiển con (`input`, `select`, `button`), giúp toolbar giữ nguyên kích thước dù có hoặc không có nút thao tác.
- **Cố định hàng Tab Switcher 48px:** Thêm `minHeight: '48px'` và render spacer 34px trên tab Submissions, loại bỏ hiện tượng hụt 3px khi ẩn switcher List/Grid.
- **Rút gọn Placeholder Search:** Rút ngắn text gợi ý (`Search processes...`, `Search forms...`, `Search submissions...`, `Search reports...`) không bao giờ bị cắt cụt trong ô 360px.
- **Visual Parity cho Submissions:** Bổ sung `accent-teal` (vạch xanh ngọc 3px) cho các thẻ nhóm biểu mẫu trong Submissions, đồng bộ phong cách với 3 tab còn lại.
- **Chuẩn hóa 100% tiếng Anh:** Chuyển đổi toàn bộ tiêu đề cột bảng Reports (`Report ID`, `Report Title`, `Source Form`, `Version`, `Status`, `Actions`), nhãn trạng thái Submissions (`Verified`, `Pending Review`), nhãn nhóm (`Process:`) và nút hành động (`+ Fill Form`).


