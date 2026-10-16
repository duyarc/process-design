# Session Log — Bộ nhớ Phiên (Episodic Memory)

> File này là bộ nhớ dài hạn của agent. Đọc trước khi thực thi, cập nhật sau khi
> hoàn thành. Xem `AGENTS.md` Mục 13 để biết quy trình.

---

## Bài học Tích lũy

Danh sách lỗi đã gặp kèm biện pháp phòng ngừa. Agent đọc mục này trước mỗi
phiên thực thi để không lặp lại lỗi cũ.

| # | Nhóm | Lỗi | Biện pháp phòng ngừa | Lần gặp |
|---|---|---|---|---|
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
| 31 | `LOGIC` | Regex in nghiêng `\*(?:[^*]+)\*` nuốt dấu hoa thị đầu dòng bullet list (`* **Bold**`) thành in nghiêng lỗi | Áp dụng lookahead/lookbehind nghiêm ngặt `\*(?!\s)(?:[^*]+?)(?<!\s)\*` và xử lý phân cấp 2 tầng: tách dòng bullet (`* `, `- `, `+ `, `• `) trước, parse inline markdown sau | 1 |
| 32 | `SCOPE` | Khi thêm trường mới vào `FormFieldISO.type`, nếu chỉ cập nhật union type cục bộ mà quên thêm vào chữ ký tham số `newType` của `handleChangeFieldType` trong component monolith thì `tsc -b` sẽ báo TS2367 ("no overlap") và TS2345 tại các call-site dropdown | Luôn đồng bộ union type của hàm đổi loại trường (`handleChangeFieldType`) cùng lúc với `FormFieldISO['type']` hoặc gán trực tiếp `newType: FormFieldISO['type']` | 1 |
| 33 | `LOGIC` | Giới hạn cứng `maxHeight: '200px'`/`'220px'` kết hợp `alignItems: 'center'` trên ảnh tỷ lệ rộng (banner 4:1) khiến ảnh bị bóp hẹp chiều ngang (~800px) tạo 2 dải lề trắng lớn bên trái và phải | Bỏ trần `maxHeight` cứng khi ở chế độ banner/full, đặt `width: '100%'` và `height: 'auto'` kết hợp các chế độ độ rộng `imageWidthMode` ('full' \| 'bleed' \| 'fit') để ảnh dãn bằng phẳng 100% với lề văn bản | 1 |
| 34 | `LOGIC` | Khóa cứng thao tác xóa trên nút bấm (`disabled={... \|\| block.type === 'TITLE'}`) trong khi vẫn để màu kích hoạt đỏ (`var(--danger)`) gây nghịch lý giao diện (nút nhìn bấm được nhưng không phản hồi); ngoài ra `formTitle` vốn là thuộc tính độc lập lưu trong DB chứ không phụ thuộc vào sự tồn tại của khối TITLE trên canvas | Khi vô hiệu hóa nút bấm, luôn chuyển màu sắc sang `var(--text-muted)` và kiểm tra tính độc lập của dữ liệu trước khi áp đặt các ràng buộc cấm xóa cứng nhắc | 1 |
| 35 | `LOGIC` | `InCanvasImageField` thiếu `processId` và `formName` trong request body của presign-upload, server trả HTTP 400, component fallback sang base64 nhúng trực tiếp multi-MB vào `layoutBlocks` → cascading slow save qua `onSave` → `ProcessEditor` auto-save process chứa toàn bộ JSONB | Khi tích hợp sub-component upload ảnh, luôn truyền đủ context (`processId`, `formName`/`formId`) để presign-upload hoạt động đúng; kiểm tra Network tab xác nhận presign thành công trước khi cho rằng upload OK | 1 |
| 36 | `LOGIC` | Khối TABLE có schema cột đa dạng (STT, Tiêu chí, Kết quả, Ghi chú) nếu hardcode ID cột hiển thị hướng dẫn (`col_item`, col 1) sẽ bị lệch hoặc nhân bản nút accordion sang mọi cột | Dùng pure utility `getTableItemColumnId` ưu tiên nhận diện cột nội dung chính (`col_item`/`item`/`name`/`content` ➔ `static_text` ➔ col 1 ➔ col 0) để neo duy nhất 1 nút accordion cho mỗi dòng | 1 |
| 37 | `LOGIC` | Dùng cờ `useRef(false)` một chiều (`hasInitializedViewMode`) khoá cứng `viewMode = 'all'` ngay từ lần tick đầu tiên khi nạp cache SWR ban đầu, khiến việc revalidation ngầm từ DB (`default_focus_mode = true`) bị bỏ qua; đồng thời không đồng bộ cache `swr_forms` trong `sessionStorage` sau khi lưu form trong `FormBuilder` | Khởi tạo state đồng bộ từ `preloadedFormTemplate`/`initialCache`; thay thế guard một chiều bằng tracking tương tác người dùng (`userInteractedRef`) để luôn đồng bộ với DB trừ khi người dùng chủ động bấm toggle; luôn cập nhật `sessionStorage` (`swr_forms`) ngay khi lưu biểu mẫu | 1 |
| 38 | `LOGIC` | Khi khối TABLE làm header phân đoạn (H1/H2), `groupBlocksIntoSections` đưa mô tả bảng vào `sec.description`/`subSec.description` (render dạng `<p>` văn bản thô) trong khi khối TABLE con tiếp tục render nút và hộp hướng dẫn xanh ngọc `[ 💡 Hướng dẫn ]` bên trong, gây trùng lặp 2 lần | Bổ sung `headerBlock?: LayoutBlockISO` vào `FormSectionGroup` và triệt tiêu render văn bản thô `sec.description` / `subSec.description` khi `headerBlock?.type === 'TABLE'`, để toàn bộ hướng dẫn bảng được quản lý duy nhất qua accordion tương tác | 1 |

---

## Nhật ký Phiên

### 2026-10-16 — Triệt tiêu Trùng lặp Hướng dẫn Bảng trong Chế độ Focus Mode (`FormFiller`, `formUtils`)

**Scope:** 2 source files (`src/utils/formUtils.ts`, `src/components/FormFiller.tsx`) + 1 design doc (`DESIGN_FORM_OPERATIONS.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 2 (`npx tsc --noEmit` pass 100%, `npm run build` pass 10.33s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Nhận diện Khối Khởi tạo Phân đoạn (`formUtils.ts`):**
  - Mở rộng interface `FormSectionGroup` với trường `headerBlock?: LayoutBlockISO` và gán `headerBlock: block` trong hàm pure utility `groupBlocksIntoSections` (cả nhánh `isSectionHeader` và fallback `!currentH1`, cũng như mapping danh sách `sections` trả về), đồng bộ cấu trúc với `FormSubSectionGroup`.
- **Triệt tiêu Render Văn bản Mô tả Thô Dư thừa (`FormFiller.tsx`):**
  - Trong phân đoạn H1 (dòng 4129) và phân đoạn con H2 (dòng 4222), áp dụng điều kiện `sec.headerBlock?.type !== 'TABLE'` và `subSec.headerBlock?.type !== 'TABLE'`, loại bỏ hoàn toàn việc in đoạn text hướng dẫn thô `<p>` bên trên nút tương tác `[ 💡 Hướng dẫn ]`.
- **Tập trung Quản lý Hướng dẫn Qua Accordion Chuyên dụng:**
  - Hướng dẫn bảng được hiển thị duy nhất 1 lần trong hộp xanh ngọc 💡 của accordion `[ 💡 Hướng dẫn ⌃/⌄ ]`, cho phép người vận hành linh hoạt mở rộng để tham khảo hoặc thu gọn để tối ưu diện tích màn hình trên thiết bị di động / desktop.
- **Bảo toàn Hiển thị Phân đoạn `SECTION_LABEL`:**
  - Giữ nguyên 100% hiển thị mô tả cho các phân đoạn `SECTION_LABEL` thông thường (vốn không có input hay accordion hướng dẫn riêng).

### 2026-10-16 — Khắc phục Lỗi Kích hoạt Default Focus Mode (`FormFiller`, `FormBuilder`, `ProcessEditor`)

**Scope:** 3 source files (`src/components/FormFiller.tsx`, `src/components/FormBuilder.tsx`, `src/components/ProcessEditor.tsx`) + 2 design docs (`DESIGN_FORM_OPERATIONS.md`, `DESIGN_FORM_DESIGNER.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 3 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`npx tsc --noEmit` x2 pass 100%, `npm run build` pass 10.70s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Khởi tạo Đồng bộ Trực tiếp Chế độ Xem (`FormFiller.tsx`):**
  - Khởi tạo `viewMode` đồng bộ theo lazy initializer từ `preloadedFormTemplate` hoặc `initialCache.process` (`defaultFocusMode === true`), loại bỏ hoàn toàn render flash và trạng thái default sai lệch.
- **Tracking Tương tác Người dùng (`userInteractedViewModeRef`):**
  - Thay thế guard một lần `hasInitializedViewMode` bằng `userInteractedViewModeRef`. Dữ liệu SWR revalidation từ DB tự động đồng bộ chế độ Focus Mode mặc định trừ khi người dùng đã chủ động bấm nút toggle.
- **Nới lỏng Ngưỡng Kiểm tra Phân đoạn (`sections.length >= 1`):**
  - Cho phép biểu mẫu có 1 section H1 (kèm các sub-section H2) kích hoạt giao diện phân đoạn accordion và hiển thị công tắc Focus mode trên thanh công cụ.
- **Mở khóa SWR Background Revalidation khi có `preloadedFormTemplate`:**
  - Loại bỏ early return chặn fetch ngầm trong `fetchProcess`, đảm bảo dữ liệu mới nhất từ máy chủ luôn được đồng bộ.
- **Đồng bộ Cache `sessionStorage` (`swr_forms`):**
  - Tự động cập nhật bản ghi cache trong `FormBuilder.tsx` (`saveFormToBackend`) và `ProcessEditor.tsx` (`onSave`) ngay khi lưu thành công, đảm bảo các lần mở biểu mẫu sau đó nhận diện tức thì `default_focus_mode: true`.

### 2026-10-16 — Thống nhất Trình Soạn thảo & Hiển thị Hướng dẫn Khối Bảng (Unified Table Guidance Accordion)

**Scope:** 2 source files (`src/components/FormBuilder.tsx`, `src/components/FormFiller.tsx`) + 2 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 2 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 3 (`npx tsc --noEmit` x2 pass 100%, `npm run build` pass 9.31s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Thống nhất Element Soạn thảo Hướng dẫn Khối Bảng (`FormBuilder.tsx`):**
  - Loại bỏ textarea trần cũ trong `renderDescription()` đối với khối `TABLE` trong `InCanvasTitleHeader`.
  - Bổ sung nút bấm `[ 💡 Hướng dẫn ⌃/⌄ ]` (khi đã có hướng dẫn) và `[ + 💡 Hướng dẫn ]` (khi chưa có và đang chọn khối) trên thanh tiêu đề `renderControlGroup`.
  - Đồng nhất 100% Visual Style Parity với khối `INFO_GRID`: `borderRadius: '4px'`, nền xanh bạc hà nhạt `#f0fdfa`, viền `1px solid #0d9488`, chữ `#0f766e`, icon `<ChevronUp size={11} />` / `<ChevronDown size={11} />` (thay vì pill bo tròn 12px và ký tự unicode text `▴`/`▾`).
  - Tích hợp sub-component chuẩn `InCanvasGuidanceEditor` (Rule 4.3 Monolith Guard) mở rộng dạng accordion ngay dưới tiêu đề, trang bị toolbar markdown `[ B ] [ I ] [ U ] [ • ] [ 💡 ]`, preview toggle `[ 👁 Xem trước / ✍️ Soạn thảo ]`, auto-grow CSS Grid textarea, và nút đóng `[ ✕ ]`.
  - Hỗ trợ hiển thị hướng dẫn khi tiêu đề bị ẩn (`titleFmt === 'NONE'`).
  - Bổ sung nút liên kết `[ Mở trên Canvas ▾/▴ ]` trên Right Inspector để đồng bộ đóng/mở trực tiếp với Canvas.
- **Hiển thị Thu gọn/Mở rộng Linh hoạt trên Form Điền (`FormFiller.tsx`):**
  - Bổ sung nút accordion `[ 💡 Hướng dẫn ⌃/⌄ ]` bên cạnh tiêu đề bảng (hoặc phía trên bảng khi tiêu đề ẩn), cho phép người vận hành chủ động đóng/mở hướng dẫn chung của bảng.
  - Chuẩn hóa style nút bấm bo góc 4px, màu sắc và icon đồng bộ 100% với câu hỏi `INFO_GRID` và các dòng tiêu chí con.
  - Quản lý trạng thái qua `expandedGuidanceMap[block.id]`, giữ bảng điền luôn gọn gàng và tập trung.

### 2026-10-16 — Cập nhật Hiển thị và Soạn thảo Hướng dẫn Khối Bảng (Table Block Guidance)

**Scope:** 5 source files (`src/utils/formUtils.ts`, `src/types.ts`, `src/components/FormFiller.tsx`, `src/components/print/PrintBlankForm.tsx`, `src/components/FormBuilder.tsx`) + 2 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 5 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 4 (`npx tsc --noEmit` pass 100%, `npm run build` pass 18.02s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Trích xuất Pure Utility `getTableItemColumnId` (`src/utils/formUtils.ts`):** Nhận diện chính xác cột chứa nội dung/tiêu chí chính của bảng theo thứ tự ưu tiên (`col_item`/`item`/`name`/`content` ➔ `static_text` ➔ col 1 ➔ col 0) theo Rule 13.8.
- **Mở rộng Schema (`src/types.ts`):** Bổ sung `guidance?: string` vào `LayoutBlockISO`.
- **Hiển thị Hướng dẫn Đa Cấp trên Form Điền (`FormFiller.tsx`):**
  - Hiển thị banner hướng dẫn chung cho bảng ngay dưới tiêu đề khối bảng khi có `block.description` hoặc `block.guidance`.
  - Hiển thị nút accordion `[ 💡 Hướng dẫn ▾/▴ ]` tại ô nội dung tiêu chí khi dòng có `row.guidance`, mở rộng khung hướng dẫn chi tiết màu teal `#0d9488`.
- **Hỗ trợ In Biểu Mẫu Trắng Kèm Hướng Dẫn (`PrintBlankForm.tsx`):**
  - In banner hướng dẫn chung khối bảng khi bật `includeGuidance` hoặc khi có `block.description`.
  - In `PrintFieldGuidanceBox` cho dòng tại đúng cột `itemColId`.
- **Trình Soạn thảo Hướng dẫn Khối & Dòng trên Canvas (`FormBuilder.tsx`):**
  - Mở rộng `InCanvasTitleHeader` cho phép khối `TABLE` soạn thảo mô tả/hướng dẫn khối trực tiếp trên Canvas với CSS Grid auto-grow textarea.
  - Tích hợp nút accordion `[ 💡 Hướng dẫn ▾/▴ ]` / `[ + 💡 Hướng dẫn ]` trên Canvas table row nhúng sub-component `InCanvasGuidanceEditor` (Rule 4.3 Monolith Guard) đầy đủ công cụ markdown và xem trước.
  - Bổ sung vùng `💡 HƯỚNG DẪN DÒNG (ROW GUIDANCE)` và hỗ trợ sửa Hướng dẫn chung khối `TABLE` trên Right Inspector với liên kết mở trên Canvas 2 chiều.

### 2026-10-16 — Tối ưu Hiệu suất Lưu Biểu mẫu (Form Save Performance Optimization)

**Scope:** 4 source files (`src/components/form/InCanvasImageField.tsx`, `src/components/FormBuilder.tsx`, `src/components/ProcessEditor.tsx`, `server.cjs`) + `package.json` + 3 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_BACKEND.md`, `DESIGN_PROCESS_DESIGNER.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 4 |
| Lượt edit sửa lỗi (rework) | 4 |
| Số lần build | 5 (`npx tsc --noEmit` + `npm run build` pass 100% 17.24s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Khắc phục Presign-Upload Thất bại (Root Cause #1):** Phát hiện `InCanvasImageField` thiếu `processId` và `formName` trong request body khi gọi `/api/storage/presign-upload` → server trả HTTP 400 → component fallback sang base64 nhúng multi-MB vào `layoutBlocks`. Bổ sung `formId` prop và truyền đủ context vào request.
- **Loại bỏ Cascading Process Auto-Save (Root Cause #2):** `onSave` callback từ `FormBuilder` truyền toàn bộ `savedFormData` (bao gồm `layoutBlocks` + `revisionHistory`) lên `ProcessEditor` → tự động ghi vào `workflowFormsData` JSONB → cascading `POST /api/processes` với payload multi-MB. Destructure loại bỏ `layoutBlocks` và `revisionHistory` trước khi merge.
- **Memoize `getFormSnapshot` (React Render Perf):** Bọc `getFormSnapshot()` trong `useMemo` với 10-field dependency array, triệt tiêu `JSON.stringify` trên mỗi re-render.
- **Backend Compression & RETURNING Optimization:** Thêm middleware `compression` cho gzip/brotli. Đổi `RETURNING *` thành column-list (loại trừ `layout_blocks` và `revision_history`). Siết điều kiện fanout `revision_history` chỉ khi mảng có phần tử.

### 2026-10-16 — Mở khóa Xóa Khối Tiêu Đề (Title Block) & Đồng bộ ConfirmModal Xóa Khối (FormBuilder)

**Scope:** 1 source file (`src/components/FormBuilder.tsx`) + 1 design doc (`DESIGN_FORM_DESIGNER.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`tsc -b && vite build` pass 100% 11.06s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Giải quyết Triệt để Nghịch lý Giao diện Nút Xóa Khối Tiêu Đề:** Loại bỏ điều kiện vô hiệu hóa cứng `block.type === 'TITLE'` trên Canvas block badge và Right Inspector của `FormBuilder.tsx`. Cho phép người dùng chủ động xóa khối Tiêu đề khi thiết kế các biểu mẫu đặc thù không cần khối title đầu trang hoặc muốn tùy biến lại bố cục.
- **Bảo toàn Tính Độc lập Kiến trúc của `formTitle`:** Xác minh và bảo toàn 100% tính độc lập của `formTitle` (lưu ở cột `form_title` cấp bảng `forms` trong DB), bảo đảm việc xóa khối `TITLE` trên canvas không làm mất dữ liệu tên biểu mẫu, không gây lỗi runtime trên FormFiller, Submissions, Báo cáo hay Tiến trình BPMN, và có thể thêm lại bất cứ lúc nào qua nút `+ Title` trên toolbar.
- **Đồng bộ Quy chuẩn `ConfirmModal` (Rule 3 Progressive Adoption):** Loại bỏ hoàn toàn hộp thoại chặn trình duyệt `window.confirm()` trong `handleDeleteBlock`. Thay thế bằng `ConfirmModal` (`variant="danger"`) với thông điệp cảnh báo trực quan riêng cho khối Tiêu đề (giải thích rõ tên form vẫn lưu trong thuộc tính) và các khối thông thường khác.

### 2026-10-16 — Bổ sung Thư viện Ảnh (Image Gallery Modal) & Giải pháp Dãn Ảnh Tràn Lề Ngang (Full Width Mode)

**Scope:** 8 source files (`src/types.ts`, `server.cjs`, `src/components/form/ImageGalleryModal.tsx` [NEW], `src/components/form/InCanvasImageField.tsx`, `src/components/FormBuilder.tsx`, `src/components/FormFiller.tsx`, `src/components/print/PrintBlankForm.tsx`, `src/components/print/PrintFilledForm.tsx`, `src/components/print/PrintScoring.tsx`) + 3 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`, `DESIGN_BACKEND.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa / tạo mới | 8 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`tsc -b && vite build` pass 100% 9.45s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Giải quyết Triệt để Vấn đề Co Lề Ảnh (Banner Horizontal Stretch):** Chuẩn đoán nguyên nhân gốc rễ do `maxHeight: '200px'`/`'220px'` kết hợp `alignItems: 'center'` bóp hẹp ảnh 4.2:1 xuống ~800px. Bổ sung `imageWidthMode?: 'full' | 'bleed' | 'fit'` vào `FormFieldISO`, đặt `width: '100%'`, `height: 'auto'`, loại bỏ trần `maxHeight` cho chế độ `full` (mặc định cho banner) giúp dãn phẳng 100% khớp tuyệt đối với lề tiêu đề và văn bản bên trên/dưới.
- **Sub-component `ImageGalleryModal` (Rule 4.3 Monolith Guard):** Tạo modal thư viện ảnh dùng chung trong `src/components/form/` với ô tìm kiếm tên file, lưới thumbnail ảnh R2, kích thước file, badge nhận diện ảnh đang chọn, và nút tải ảnh mới trực tiếp.
- **Backend API (`server.cjs`):** Bổ sung endpoint `GET /api/storage/images` duyệt tìm các tệp có đuôi ảnh (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`, `.gif`, `.bmp`) từ Cloudflare R2 bucket.
- **Form Designer Canvas & Right Inspector:** Cập nhật `InCanvasImageField.tsx` với dải nút độ rộng `[ 100% Lề ]` / `[ Tràn mép ]` / `[ Thu nhỏ ]` và nút `[ 📁 Thư viện ]` mở Image Gallery. Đồng bộ cấu hình tương ứng trên Right Inspector của `FormBuilder.tsx`.
- **Form Operations & Print Out Đồng bộ:** `FormFiller.tsx` hỗ trợ render ảnh theo cả 3 chế độ độ rộng kèm Lightbox phóng to. Các component in ấn (`PrintBlankForm.tsx`, `PrintFilledForm.tsx`, `PrintScoring.tsx`) dãn phẳng toàn bộ chiều rộng trang với `height: 'auto'`.

### 2026-10-16 — Bổ sung Trường Hình ảnh (Image Field Type), Tỷ lệ Khung hình Banner & Lightbox Phóng to

**Scope:** 8 source files (`src/types.ts`, `src/utils/formUtils.ts`, `src/components/form/InCanvasImageField.tsx` [NEW], `src/components/FormBuilder.tsx`, `src/components/FormFiller.tsx`, `src/components/print/PrintBlankForm.tsx`, `src/components/print/PrintFilledForm.tsx`, `src/components/print/PrintScoring.tsx`) + 2 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa / tạo mới | 8 |
| Lượt edit sửa lỗi (rework) | 1 (thêm `'image'` vào `handleChangeFieldType` parameter type) |
| Số lần build | 2 (`tsc -b && vite build` pass 100% 14.25s) |
| Lần build đầu thành công? | Không (`tsc -b` bắt TS2367/TS2345 tại `handleChangeFieldType`, sửa dứt điểm ngay) |

**Kết quả đạt được:**
- **Schema & Pure Utility:** Thêm `'image'` và `imageUrl`, `imageAspectRatio`, `imageCaption` vào `FormFieldISO`. Thêm pure utility `resolveImageSrc` giải quyết linh hoạt URL, Base64 dataUrl và R2 storage key cho Web và Print.
- **Sub-component `InCanvasImageField` (Rule 4.3 Monolith Guard):** Tách subcomponent riêng biệt khỏi `FormBuilder.tsx`, cung cấp dải pills chọn tỷ lệ (`Banner`, `16:9`, `4:3`, `1:1`, `Auto`), dropzone kéo thả / tải ảnh với FileReader Base64 fallback, và input chú thích inline.
- **Form Designer Canvas & Menu:** Giữ nguyên 100% kích thước và 12 loại trường cũ của `FieldTypeDropdown`, chỉ thêm mục thứ 13 là `Image`. Thêm cấu hình thuộc tính trong Right Inspector.
- **Form Operations & Lightbox Modal:** `FormFiller.tsx` hiển thị ảnh tham chiếu tĩnh và hỗ trợ mở Lightbox phóng to toàn màn hình khi nhấp vào ảnh, bấm Esc để đóng.
- **In ấn A4 Chuẩn:** `PrintBlankForm.tsx`, `PrintFilledForm.tsx`, `PrintScoring.tsx` hiển thị ảnh với `page-break-inside: avoid;` và `max-width: 100%`.

### 2026-10-15 — Nâng cấp Định dạng Markdown, Bullet List & Canvas WYSIWYG Linh động cho Trường Label

**Scope:** 7 source files (`src/utils/textFormatter.tsx`, `src/components/form/InCanvasLabelField.tsx`, `src/components/FormBuilder.tsx`, `src/components/FormFiller.tsx`, `src/components/print/PrintBlankForm.tsx`, `src/components/print/PrintFilledForm.tsx`, `src/components/print/PrintScoring.tsx`) + 2 design docs (`DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa / tạo mới | 7 |
| Lượt edit sửa lỗi (rework) | 2 (sửa type-only import & unused import sau `tsc -b`) |
| Số lần build | 2 (`tsc -b && vite build` pass 100% 10.18s) |
| Lần build đầu thành công? | Không (`tsc -b` bắt TS1484, TS6133, TS2367; sửa dứt điểm ngay) |

**Kết quả đạt được:**
- **Khắc phục lỗi parser Markdown (`src/utils/textFormatter.tsx`):** Thêm lookahead/lookbehind `\*(?!\s)(?:[^*]+?)(?<!\s)\*` triệt tiêu lỗi nuốt dấu hoa thị đầu dòng khi kết hợp bullet với in đậm (`* **Công suất**`). Bóc tách phân cấp 2 tầng (tầng dòng nhận diện `* `, `- `, `+ `, `• ` và thụt lề; tầng inline parse in đậm, in nghiêng, gạch chân). Mở rộng `applyTextFormat` hỗ trợ mode `'bullet'`.
- **Sub-component `InCanvasLabelField` & Toolbar Co giãn Linh động (Rule 4.3):** Tách sub-component riêng biệt (~420 dòng) khỏi monolith `FormBuilder.tsx`. Toolbar gộp chung trên 1 hàng phẳng (`flex-wrap: wrap`), tự động xuống dòng mềm mại khi cột ô lưới hẹp (`gap: 6px`). Hỗ trợ 2 chế độ: Xem trước WYSIWYG và Soạn thảo với CSS Grid auto-grow textarea mirror.
- **Mở rộng Right Inspector:** Thêm nút `•` (Bullet point) cạnh `B`, `I`, `U` và tăng `rows={6}` cho trường nhãn.
- **Đồng bộ FormFiller & Print Out:** Bỏ `sanitizeLabel` (bảo toàn dấu `:` cuối câu dẫn), chuyển `display: 'block'` (loại bỏ lỗi căn giữa flexbox của đoạn văn nhiều dòng).

### 2026-10-14 — Tối giản Menu Tùy chọn In ấn (Biến thể 2 kèm Tag Trạng thái) (FormFiller)

**Scope:** 1 source file (`src/components/FormFiller.tsx`) + 1 design doc (`DESIGN_FORM_OPERATIONS.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`npx tsc --noEmit` pass 100%, `npm run build` pass 21.92s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Mở rộng Đầy đủ 3 Chế độ In Ấn (`FormFiller.tsx`):** Thay thế `printWithGuidanceTemplate` bằng `printBlankConfig: { template, includeGuidance }`, hỗ trợ cả 3 luồng in ấn độc lập: (1) In biểu mẫu trắng không hướng dẫn (phôi tiêu chuẩn), (2) In biểu mẫu trắng kèm hướng dẫn (phôi khảo sát chi tiết), và (3) In bản khai (phiếu đã có dữ liệu).
- **Thiết kế Tinh gọn theo Biến thể 2 (Không Icon, Kèm Tag Trạng thái):** Mở rộng độ rộng menu lên `280px` triệt tiêu lỗi ngắt dòng mồ côi (*"dẫn"*), căn lề hai đầu phẳng thanh thoát, tag trạng thái phân định (`[ Trống ]`, `[ + Hướng dẫn ]`, `[ Có dữ liệu ]`), xoay mũi tên 180° khi mở menu.
- **Dead-Code Pruning (Rule 4.2):** Xóa bỏ import icon `BookOpen` không còn sử dụng.

### 2026-10-14 — Khắc phục Lặp Tiêu đề H2 trong Chế độ Focus Mode (FormFiller)

**Scope:** 1 source file (`src/components/FormFiller.tsx`) + 1 design doc (`DESIGN_FORM_OPERATIONS.md`).

| Chỉ số | Giá trị |
|---|---|
| Số file nguồn chỉnh sửa | 1 |
| Lượt edit sửa lỗi (rework) | 0 |
| Số lần build | 1 (`npx tsc --noEmit` pass 100%, `npm run build` pass 16.93s) |
| Lần build đầu thành công? | Có |

**Kết quả đạt được:**
- **Mở rộng Cơ chế Ẩn Tiêu đề Phân cấp (`FormFiller.tsx`):** Bổ sung tham số `hideH2Title?: boolean` cho hàm `renderBlock` và kết hợp vào điều kiện ẩn tiêu đề `!(hideH2Title && blockTitleFmt === 'H2')`, tương tự cơ chế `hideH1Title` đã có.
- **Triệt tiêu Lặp Tiêu đề H2 trong Focus Mode:** Truyền `hideH2Title = true` khi render các block con bên trong phân đoạn Accordion H2 (`subSec.blocks.map`), loại bỏ hoàn toàn tiêu đề H2 lặp lại lần 2 bên trên bảng dữ liệu (như khối "Đại diện doanh nghiệp" trên biểu mẫu 3S-FA02).
- **Bảo toàn Chế độ Xem Liên tục & In ấn:** Giữ nguyên 100% hiển thị tiêu đề H2 trên chế độ xem liên tục (Continuous View Mode) và in ấn (PrintFilledForm & PrintBlankForm).
