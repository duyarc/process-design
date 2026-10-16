# Session Log — Bộ nhớ Phiên (Episodic Memory)

> File này là bộ nhớ dài hạn của agent. Đọc trước khi thực thi, cập nhật sau khi
> hoàn thành. Xem `AGENTS.md` Mục 13 để biết quy trình.

---

## Bài học Tích lũy

Danh sách lỗi đã gặp kèm biện pháp phòng ngừa. Agent đọc mục này trước mỗi
phiên thực thi để không lặp lại lỗi cũ.

| # | Nhóm | Lỗi | Biện pháp phòng ngừa | Lần gặp |
|---|---|---|---|---|
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
| 31 | `LOGIC` | Regex in nghiêng `\*(?:[^*]+)\*` nuốt dấu hoa thị đầu dòng bullet list (`* **Bold**`) thành in nghiêng lỗi | Áp dụng lookahead/lookbehind nghiêm ngặt `\*(?!\s)(?:[^*]+?)(?<!\s)\*` và xử lý phân cấp 2 tầng: tách dòng bullet (`* `, `- `, `+ `, `• `) trước, parse inline markdown sau | 1 |
| 32 | `SCOPE` | Khi thêm trường mới vào `FormFieldISO.type`, nếu chỉ cập nhật union type cục bộ mà quên thêm vào chữ ký tham số `newType` của `handleChangeFieldType` trong component monolith thì `tsc -b` sẽ báo TS2367 ("no overlap") và TS2345 tại các call-site dropdown | Luôn đồng bộ union type của hàm đổi loại trường (`handleChangeFieldType`) cùng lúc với `FormFieldISO['type']` hoặc gán trực tiếp `newType: FormFieldISO['type']` | 1 |
| 33 | `LOGIC` | Giới hạn cứng `maxHeight: '200px'`/`'220px'` kết hợp `alignItems: 'center'` trên ảnh tỷ lệ rộng (banner 4:1) khiến ảnh bị bóp hẹp chiều ngang (~800px) tạo 2 dải lề trắng lớn bên trái và phải | Bỏ trần `maxHeight` cứng khi ở chế độ banner/full, đặt `width: '100%'` và `height: 'auto'` kết hợp các chế độ độ rộng `imageWidthMode` ('full' \| 'bleed' \| 'fit') để ảnh dãn bằng phẳng 100% với lề văn bản | 1 |

---

## Nhật ký Phiên

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



