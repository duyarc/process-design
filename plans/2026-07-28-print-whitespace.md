# Chuẩn hoá khoảng trắng khi in biểu mẫu (Print Whitespace Normalization)

| Field | Value |
|---|---|
| **Authored against commit** | `0cf52c3` |
| **Status** | Đã thực thi (Phase 1–5), `npm run build` sạch. Chờ kiểm tra thủ công bằng Print Preview — xem mục Kiểm tra. Chưa commit. |

---

## Bối cảnh

Bản in không có một thang khoảng cách (spacing scale) duy nhất. Mỗi loại block tự khai báo
`marginTop` / `marginBottom` inline, còn `.print-block` bị reset `margin-bottom: 0px` ở commit
`93e1564`. Kết quả: khoảng cách giữa hai block phụ thuộc hoàn toàn vào việc block **kế tiếp** thuộc
loại gì, chứ không theo một quy tắc nào.

Thêm nữa, INFO_GRID in ra theo **column-major** trong khi canvas FormBuilder hiển thị
**row-major**, nên bản in vừa lệch nhịp dọc vừa lệch thứ tự field so với thiết kế.

---

## Nguyên nhân gốc

### RC1 — INFO_GRID đảo thứ tự và không có khái niệm "hàng"

`PrintBlankForm.tsx` chia field vào các mảng cột bằng `cols[idx % block.columns].push(f)`, rồi render
mỗi cột là một flex column độc lập với `gap: 10px`. `FormBuilder.tsx` (canvas) và `FormFiller.tsx`
dùng `display: grid; gridTemplateColumns: repeat(block.columns, 1fr)` — tức row-major.

Hai hệ quả:
- Field số 2 nằm ở **cột phải hàng 1** trên canvas, nhưng ở **cột trái hàng 2** khi in.
- Vì mỗi cột là một flex column riêng, không có ràng buộc chiều cao ngang. Một field cao ở cột trái
  (checkbox 2 dòng, subtable) đẩy toàn bộ phần dưới của **riêng cột đó** xuống, làm các "hàng" lệch
  dần. Số field lẻ thì đuôi hai cột trống không đều.

`PrintRecord.tsx` còn hardcode `length: 2`, bỏ qua `block.columns`.

### RC2 — Không có thang khoảng cách giữa các block

`.print-block { margin-bottom: 0px }` trong `<style>` nội tuyến của cả hai print component. Toàn bộ
nhịp dọc do margin inline của từng block quyết định:

| Block | Khoảng cách nó tự tạo |
|---|---|
| TITLE | `marginBottom: 15px` |
| INFO_GRID | `marginTop: 0` / `marginBottom: 0` → **0px** |
| CHECKLIST_TABLE / TABLE / MATRIX_TABLE / SIGN | `marginTop: 0`, không có bottom |
| SECTION_LABEL | `marginTop` 18 / 14 / 10px theo H1 / H2 / BODY |
| subtable (trong INFO_GRID) | `marginBottom: 14px` + `marginTop: 14px` nếu không phải field đầu |

Nên: INFO_GRID → INFO_GRID = **0px**, INFO_GRID → SECTION_LABEL H1 = **18px**, sau SIGN = **45px**.
Hai block riêng biệt có thể sát nhau hơn hai field trong cùng một block (10px) — đúng như ảnh chụp.

### RC3 — Chiều cao nội tại của field không được chuẩn hoá

`gap: 10px` là khoảng cách giữa các **hộp**, không phải giữa các **dòng viết**. Chiều cao hộp khác
nhau: text/date/time = `minHeight: 22px` một dòng; radio/checkbox = nhãn + hàng option, `gap: 2px`,
cao hơn ~50%; subtable = tuỳ số dòng. Vì các renderer dùng `alignItems: 'baseline'` cục bộ trong từng
field mà không có baseline chung theo hàng, khoảng trắng thị giác từ dòng viết này sang dòng viết kế
tiếp không đều dù `gap` bằng nhau.

### RC4 — `gridColumn: span` vô hiệu trên subtable

`PrintBlankForm.tsx` đặt `gridColumn: span ${block.columns}` cho subtable, nhưng phần tử cha là
**flex** (`display: flex; flexDirection: column`), nên thuộc tính này bị bỏ qua. Subtable không span
được, bị bó trong một cột, đồng thời tự cộng `14px` trên/dưới vào `gap: 10px` của cha → nhịp thứ ba
là 24px.

### RC5 — `print.css` ghi đè inline style của bảng in

`src/print.css` được import toàn cục qua `src/index.css`, và trong `@media print` có:

```css
th, td {
  border: 1px solid #111111 !important;
  padding: 6px 8px !important;
  font-size: 10pt !important;
}
```

Theo cascade CSS, khai báo `!important` của author thắng style attribute thường. Vì portal render vào
`document.body`, mọi `padding: '4px 6px'`, `fontSize: '0.8rem'`, `border: '1px solid #cbd5e1'` inline
trong `PrintBlankForm.tsx` / `PrintRecord.tsx` **đều bị ghi đè khi in**. Chiều cao ô thật là
`6px+6px+10pt`, không phải giá trị đã thiết kế — nên preview trên màn hình khác bản in, và phần
"aesthetic upgrade" ở `065c01f` (viền subtable `#cbd5e1`) không xuất hiện trên giấy.

### RC6 — Hai khai báo `@page` xung đột

`print.css` khai `size: A4 landscape; margin: 10mm`; `<style>` nội tuyến khai
`size: A4 portrait; margin: 15mm 15mm 20mm 15mm`. Cùng specificity, bản nội tuyến thắng chỉ vì đứng
sau trong DOM. Vùng in đúng là do thứ tự chèn, không do chủ đích — dễ vỡ nếu thứ tự thay đổi.

---

## Giải pháp

Một thang khoảng cách duy nhất, khai báo một chỗ trong `src/print.css`, phạm vi `.print-doc`:

| Token | Giá trị | Vai trò |
|---|---|---|
| `--pw-block-gap` | `16px` | Giữa hai block nội dung liền kề |
| `--pw-section-gap` | `20px` | Trước một SECTION_LABEL (mốc chương) |
| `--pw-field-gap` | `10px` | Giữa các field trong cùng block |
| `--pw-title-gap` | `8px` | Từ tiêu đề block xuống nội dung |
| `--pw-line-h` | `22px` | Dòng viết tay (ISO 7mm) |
| `--pw-table-gap` | `14px` | Sau viền dưới của bảng |

Quy tắc: khoảng cách giữa block do **duy nhất** selector anh-em `.print-block + .print-block` quyết
định. Block đầu tiên không có margin trên, margin không cộng dồn, và không block nào tự khai báo
khoảng cách ngoài của chính nó nữa.

INFO_GRID chuyển sang CSS grid row-major, `align-items: baseline`, để hàng thẳng ngang và
`gridColumn: 1 / -1` của subtable có hiệu lực thật.

---

## Phase 1 — Thang khoảng cách trong `src/print.css`

**Module:** Design System — đọc `DESIGN_UI_UX.md` §4 trước khi sửa.

### Task 1.1 — Loại `.print-doc` khỏi phạm vi rule `th, td`

> **Đã sửa so với bản duyệt đầu.** Bản đầu dùng `.print-doc th, td { … : revert !important }`.
> Cách đó **không** trả về inline style: `revert` lùi về cascade origin thấp hơn (user-agent
> default), nên ô bảng mất luôn cả viền và padding đã thiết kế. Cách đúng là loại trừ hậu duệ
> `.print-doc` ra khỏi chính rule chung, để style attribute của component thắng tự nhiên.
> Phải loại trừ **cả** rule `th` (background) — nếu không, header tint `#f8fafc` / `#f1f5f9` vẫn
> bị ép về `#f0f0f0`.

**Find 1.1a** (exact content, xuất hiện 1 lần):

```css
  th, td {
    border: 1px solid #111111 !important;
```

**Replace with:**

```css
  /* Bảng chung của ứng dụng (ProcessReader, Dashboard...).
     Loại trừ `.print-doc` — bản in biểu mẫu tự quản kích thước ô qua inline
     style; nếu không loại trừ, `!important` ở đây thắng style attribute và
     mọi padding/border/font-size đã thiết kế đều bị bỏ. Xem DESIGN_UI_UX.md §4. */
  th:not(.print-doc *), td:not(.print-doc *) {
    border: 1px solid #111111 !important;
```

**Find 1.1b** (exact content, xuất hiện 1 lần):

```css
  th {
    font-weight: bold !important;
    background-color: #f0f0f0 !important;
```

**Replace with:**

```css
  th:not(.print-doc *) {
    font-weight: bold !important;
    background-color: #f0f0f0 !important;
```

### Task 1.2 — Khai báo token và layout dùng chung

**Find** (exact content, cuối khối `@media print`, xuất hiện 1 lần):

```css
  /* Color-coded targets in print */
  .print-target-box {
    border: 1px solid #000000 !important;
    background-color: #f9f9f9 !important;
    font-weight: bold !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

**Replace with:**

```css
  /* Color-coded targets in print */
  .print-target-box {
    border: 1px solid #000000 !important;
    background-color: #f9f9f9 !important;
    font-weight: bold !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

/* ─────────────────────────────────────────────────────────────
   PRINT DOCUMENT SPACING SCALE
   Nguồn duy nhất cho nhịp dọc của bản in biểu mẫu. Áp dụng cho cả
   màn hình (preview) và giấy, để preview khớp bản in.
   ───────────────────────────────────────────────────────────── */
.print-doc {
  --pw-block-gap: 16px;
  --pw-section-gap: 20px;
  --pw-field-gap: 10px;
  --pw-title-gap: 8px;
  --pw-line-h: 22px;
  --pw-table-gap: 14px;
}

/* Khoảng cách giữa các block: chỉ định nghĩa ở đây, không ở inline style. */
.print-doc .print-block + .print-block {
  margin-top: var(--pw-block-gap);
}

.print-doc .print-block.print-block--section + .print-block,
.print-doc .print-block + .print-block.print-block--section {
  margin-top: var(--pw-section-gap);
}

/* INFO_GRID: grid row-major, baseline chung theo hàng. */
.print-doc .print-info-grid {
  display: grid;
  column-gap: 40px;
  row-gap: var(--pw-field-gap);
  align-items: baseline;
}

.print-doc .print-info-grid > .print-field-full {
  grid-column: 1 / -1;
  align-self: stretch;
  margin-bottom: calc(var(--pw-table-gap) - var(--pw-field-gap));
}
```

---
Verify: `npm run build` → không có lỗi TypeScript trước khi sang Phase 2.

## Phase 2 — `src/components/print/PrintBlankForm.tsx`

**Module:** Form Designer — đọc `DESIGN_FORM_DESIGNER.md` trước khi sửa.

### Task 2.1 — Gắn `print-doc` vào gốc portal

**Find** (exact content):

```tsx
    <div className="print-container" style={{
      position: 'fixed',
```

**Replace with:**

```tsx
    <div className="print-container print-doc" style={{
      position: 'fixed',
```

### Task 2.2 — Bỏ reset `margin-bottom: 0px` khỏi `<style>` nội tuyến

**Find** (exact content):

```css
          .print-block {
            margin-bottom: 0px;
          }
```

**Replace with:**

```css
          /* Khoảng cách giữa các block do .print-doc trong print.css quản. */
```

### Task 2.3 — Đánh dấu block SECTION_LABEL để áp `--pw-section-gap`

**Find** (exact content):

```tsx
          <div key={block.id} className={`print-block ${block.type !== 'CHECKLIST_TABLE' && block.type !== 'INFO_GRID' ? 'print-block-avoid' : ''}`}>
```

**Replace with:**

```tsx
          <div key={block.id} className={`print-block${block.type === 'SECTION_LABEL' ? ' print-block--section' : ''} ${block.type !== 'CHECKLIST_TABLE' && block.type !== 'INFO_GRID' ? 'print-block-avoid' : ''}`}>
```

### Task 2.4 — Bỏ `marginTop` inline khỏi SECTION_LABEL (3 biến thể)

**Find 2.4a** (H1, exact content):

```tsx
                    padding: '0',
                    marginTop: '18px',
                    marginBottom: '8px',
```

**Replace with:**

```tsx
                    padding: '0',
                    marginBottom: 'var(--pw-title-gap)',
```

**Find 2.4b** (H2, exact content):

```tsx
                    marginTop: '14px',
                    marginBottom: '6px',
```

**Replace with:**

```tsx
                    marginBottom: 'var(--pw-title-gap)',
```

**Find 2.4c** (BODY, exact content):

```tsx
                <div style={{ padding: '2px 0', marginTop: '10px', marginBottom: '4px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
```

**Replace with:**

```tsx
                <div style={{ padding: '2px 0', marginBottom: 'var(--pw-title-gap)', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
```

### Task 2.5 — INFO_GRID sang grid row-major

Ba edit trên cùng một khối `block.type === 'INFO_GRID'`. Phần render từng field **không đổi**.

**Find 2.5a** (exact content):

```tsx
              const cols: any[][] = Array.from({ length: block.columns }, () => []);
              block.fields.forEach((f, idx) => {
                cols[idx % block.columns].push(f);
              });
              const titleFmt = getEffectiveTitleFormat(block);
```

**Replace with:**

```tsx
              const titleFmt = getEffectiveTitleFormat(block);
```

**Find 2.5b** (exact content):

```tsx
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '40px'
                  }}>
                    {cols.map((colFields, colIdx) => (
                      <div key={colIdx} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        {colFields.map((f, fIdx) => {
```

**Replace with:**

```tsx
                  <div className="print-info-grid" style={{ gridTemplateColumns: `repeat(${block.columns}, 1fr)` }}>
                    {block.fields.map((f, fIdx) => {
```

**Find 2.5c** (thẻ đóng, exact content — 4 dòng liền nhau, duy nhất trong file):

```tsx
                        })}
                      </div>
                    ))}
                  </div>
```

**Replace with:**

```tsx
                        })}
                  </div>
```

### Task 2.6 — Subtable span đủ chiều rộng, bỏ margin tự phát

**Find** (exact content):

```tsx
                              <div key={f.id} className="subtable-print-container" style={{ fontSize: '0.82rem', width: '100%', marginBottom: '14px', gridColumn: `span ${block.columns || 1}`, pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                {cleanLabel && <div style={{ fontWeight: 700, color: '#0f172a', marginTop: fIdx === 0 ? '0px' : '14px', marginBottom: '6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{cleanLabel}</div>}
```

**Replace with:**

```tsx
                              <div key={f.id} className="subtable-print-container print-field-full" style={{ fontSize: '0.82rem', width: '100%', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                {cleanLabel && <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{cleanLabel}</div>}
```

Sau edit này biến `fIdx` có thể không còn được dùng. Nếu `npm run build` báo `'fIdx' is declared but
its value is never read`, đổi `{block.fields.map((f, fIdx) => {` ở Task 2.5b thành
`{block.fields.map((f) => {`.

### Task 2.7 — Dòng viết tay dùng token

Sáu chỗ có `minHeight: '22px'` trong file. Thay tất cả `minHeight: '22px'` thành
`minHeight: 'var(--pw-line-h)'` (replace all).

### Task 2.8 — SIGN block: bỏ `marginBottom: 45px`

**Find** (exact content):

```tsx
                    paddingTop: '5px',
                    marginTop: '12px',
                    marginBottom: '45px',
```

**Replace with:**

```tsx
                    paddingTop: '5px',
                    marginTop: 'var(--pw-block-gap)',
```

---
Verify: `npm run build` → không có lỗi TypeScript trước khi sang Phase 3.

## Phase 3 — `src/components/print/PrintRecord.tsx`

**Module:** Form Operations — đọc `DESIGN_FORM_OPERATIONS.md` trước khi sửa. Bắt buộc theo
`AGENTS.md` §7 Propagation: cùng cấu trúc in, phải cùng thang khoảng cách.

### Task 3.1 — Gắn `print-doc` vào gốc portal

**Find** (exact content):

```tsx
    <div className="print-container" style={{
```

**Replace with:**

```tsx
    <div className="print-container print-doc" style={{
```

### Task 3.2 — Bỏ reset `margin-bottom: 0px`

**Find** (exact content):

```css
          .print-block {
            margin-bottom: 0px;
          }
```

**Replace with:**

```css
          /* Khoảng cách giữa các block do .print-doc trong print.css quản. */
```

### Task 3.3 — INFO_GRID sang grid row-major, tôn trọng `block.columns`

`PrintRecord` dựng `infoFields` phẳng từ snapshot và hardcode 2 cột. Executor phải đọc lại vùng
`infoFields.length > 0 && (() => {` trước khi sửa, vì tên biến khác `PrintBlankForm`.

**Find 3.3a** (exact content):

```tsx
        const cols: any[][] = Array.from({ length: 2 }, () => []);
        infoFields.forEach((f, idx) => {
          cols[idx % 2].push(f);
        });
```

**Replace with:**

```tsx
        const infoBlock = layoutBlocks.find(b => b.type === 'INFO_GRID');
        const infoColumns = infoBlock?.columns || 2;
```

**Find 3.3b** (exact content):

```tsx
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '40px'
            }}>
              {cols.map((colFields, colIdx) => (
                <div key={colIdx} style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {colFields.map((f, fIdx) => {
```

**Replace with:**

```tsx
            <div className="print-info-grid" style={{ gridTemplateColumns: `repeat(${infoColumns}, 1fr)` }}>
              {infoFields.map((f, fIdx) => {
```

**Find 3.3c** (thẻ đóng, exact content):

```tsx
                  })}
                </div>
              ))}
            </div>
```

**Replace with:**

```tsx
              })}
            </div>
```

Lưu ý: thân hàm render field bị thụt lề sâu hơn 2 mức so với cấu trúc mới. Thụt lề không ảnh hưởng
biên dịch; giữ nguyên để edit tối thiểu.

### Task 3.4 — Subtable span đủ chiều rộng

**Find** (exact content):

```tsx
                        <div key={f.id} className="subtable-print-container" style={{ fontSize: '0.82rem', width: '100%', marginBottom: '14px', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          {f.checkItem && <div style={{ fontWeight: 600, marginTop: fIdx === 0 ? '0px' : '14px', marginBottom: '6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{f.checkItem}:</div>}
```

**Replace with:**

```tsx
                        <div key={f.id} className="subtable-print-container print-field-full" style={{ fontSize: '0.82rem', width: '100%', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                          {f.checkItem && <div style={{ fontWeight: 600, marginBottom: '6px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>{f.checkItem}:</div>}
```

### Task 3.5 — SIGN block: bỏ `marginBottom: 45px`

Cùng chuỗi như Task 2.8, xuất hiện 1 lần trong file. Áp dụng cùng thay thế.

---
Verify: `npm run build` → không có lỗi TypeScript trước khi sang Phase 4.

## Phase 4 — Gỡ xung đột `@page`

`print.css` khai `size: A4 landscape; margin: 10mm` cho toàn ứng dụng (đúng cho `ProcessReader`, in
sơ đồ BPMN ngang). Hai print component khai lại `A4 portrait` trong `<style>` nội tuyến và thắng nhờ
thứ tự DOM.

Không đổi giá trị nào ở phase này — chỉ ghi rõ ràng buộc, vì `@page` không nhận selector nên không
thể scope theo `.print-doc`. Thêm chú thích ngay trên khối `@page` của `print.css`:

**Find** (exact content):

```css
  /* Setup A4 Paper Page Margins */
  @page {
    size: A4 landscape;
    margin: 10mm;
  }
```

**Replace with:**

```css
  /* Setup A4 Paper Page Margins.
     RÀNG BUỘC: PrintBlankForm.tsx và PrintRecord.tsx khai lại @page thành
     A4 portrait qua <style> nội tuyến và thắng rule này nhờ thứ tự DOM.
     @page không nhận selector nên không scope được — đừng chuyển khối này
     xuống sau trong file. */
  @page {
    size: A4 landscape;
    margin: 10mm;
  }
```

---

## Phase 5 — Cập nhật tài liệu

- `DESIGN_UI_UX.md` §4: bổ sung thang token `--pw-*`, quy tắc "khoảng cách giữa block chỉ khai ở
  `.print-block + .print-block`", và ngoại lệ `.print-doc th, td`. Thêm dòng Change Log.
- `DESIGN_FORM_DESIGNER.md`: Change Log — INFO_GRID chuyển row-major khớp canvas; margin cấp block
  chuyển sang `print.css`.
- `DESIGN_FORM_OPERATIONS.md`: Change Log — cùng nội dung cho `PrintRecord.tsx`, thêm việc tôn trọng
  `block.columns` thay vì hardcode 2.
- Cả ba tài liệu: `Verified At Commit` **không** được ghi một SHA chưa tồn tại. Vì các thay đổi còn
  nằm trong working tree, mỗi header chỉ ghi chú rõ phần mới được kiểm chứng đối chiếu **uncommitted
  working tree**, kèm yêu cầu ghi lại SHA khi commit. Change Log dùng `*(uncommitted)*` ở cột Commit.

---

## Kiểm tra

Không có test framework trong repo (`package.json` không có script test). Kiểm bằng `npm run dev`:

1. **Thứ tự field** — INFO_GRID 2 cột, 5 field. Canvas và bản in phải đọc cùng thứ tự (1-2 hàng đầu,
   3-4 hàng hai, 5 hàng ba). Trước khi sửa, bản in đọc 1-2-3 cột trái, 4-5 cột phải.
2. **Hàng thẳng** — đặt một checkbox group ở cột trái và một text field ở cột phải cùng hàng. Nhãn hai
   bên phải cùng baseline; field hàng dưới không lệch.
3. **Nhịp giữa block** — ba INFO_GRID liền nhau: khoảng cách phải bằng nhau (16px) và lớn hơn khoảng
   cách giữa hai field trong cùng block (10px).
4. **SECTION_LABEL** — mốc chương cách block trước 20px, không cộng dồn với margin của block trước.
5. **Subtable** — subtable trong INFO_GRID 2 cột phải chiếm hết chiều rộng, không bó trong một cột.
6. **Ô bảng** — kiểm bằng Print Preview của Chromium: padding ô CHECKLIST_TABLE phải là `8px 6px` như
   inline style, không phải `6px 8px` của `print.css`; viền subtable là `#cbd5e1` nhạt.
7. **Preview khớp giấy** — so bản xem trước trên màn hình với PDF xuất ra: nhịp dọc phải giống nhau.
8. **Không hồi quy `ProcessReader`** — in một quy trình có sơ đồ BPMN: vẫn A4 landscape, bảng vẫn dùng
   padding `6px 8px` của `print.css`.
9. **`PrintRecord`** — in một bản ghi đã điền: dữ liệu vẫn khớp đúng nhãn sau khi đổi thứ tự cột.

---

## Sai khác giữa bản duyệt và bản đã thực thi

Ghi lại để lần sau không phải suy luận lại từ diff.

1. **Task 1.1 viết lại** — `revert !important` không khôi phục inline style. Đổi sang loại trừ
   `:not(.print-doc *)` trên cả hai rule `th, td` và `th`. Chi tiết ở ngay Task 1.1.

2. **Bỏ `marginBottom: 15px` của TITLE** (2 biến thể mỗi file, 4 chỗ). Plan gốc liệt kê nó ở bảng
   RC2 nhưng không có task xoá. Giữ lại thì bất biến "khoảng cách giữa block chỉ do
   `.print-block + .print-block` quyết định" không đúng: TITLE là `.print-block` nên margin inline
   của nó thắng selector, và 15px vs 16px chỉ khớp nhau nhờ margin collapsing — trùng hợp, không
   phải thiết kế.

3. **Bỏ `marginTop: 'var(--pw-block-gap)'` ở SIGN của `PrintRecord`.** Ở `PrintBlankForm`, SIGN nằm
   trong wrapper `.print-block` chung nên khai báo này là margin *nội bộ*, hợp lệ. Ở `PrintRecord`,
   chính div đó **là** `.print-block`, nên nó nhân đôi khoảng cách của selector anh-em.

4. **Thêm `.print-block--section` cho SECTION_LABEL của `PrintRecord`** (Phase 3 không có task
   tương ứng với Task 2.3) và **xoá `marginTop: '0'` ở các wrapper `.print-block`** của
   CHECKLIST / MATRIX / TABLE / PHOTO / INFO_GRID. Không xoá thì `--pw-block-gap` chỉ có hiệu lực
   trên form trắng, không có trên bản ghi — tức là vi phạm chính Propagation mà Phase 3 yêu cầu.
   Các div `marginTop: '0'` *bên trong* một `.print-block` thì giữ nguyên: chúng không tham gia
   selector anh-em.

5. **Selector section gap áp cả hai phía** (`--section + *` và `* + --section`), rộng hơn mô tả
   "trước một SECTION_LABEL" ở bảng token. Cố ý: mốc chương cần thoáng cả trên lẫn dưới.

6. **`PrintRecord` lỗi biên dịch thật, không phải lỗi JSX.** `f?.subtableStaticData` trong ô
   `static_text`: `SubmissionFieldSnapshot` không có trường đó. Trước đây lọt vì vòng lặp
   column-major cho biến item kiểu `any`; chuyển sang `infoFields.map` mới lộ ra. Đã đổi sang đọc
   `matchedField.subtableStaticData` — nhãn static_text thuộc **template**, không thuộc snapshot.
   Đây là bug sẵn có được phát hiện nhờ việc siết kiểu, không phải hồi quy của lần sửa này.

7. **`Verified At Commit` của ba design doc chưa đổi SHA.** Theo `AGENTS.md` §4 đây là lời cam kết
   đã kiểm chứng, không phải dấu thời gian, nên không thể trỏ vào `0cf52c3` (không chứa các thay
   đổi này) hay một SHA chưa tồn tại. Mỗi doc ghi rõ phần mới được kiểm chứng trên working tree
   **chưa commit** và phải cập nhật SHA khi commit.

---

## Ghi chú khi thực thi

Điểm mở còn lại: RC3 chỉ được xử lý một phần. `align-items: baseline` làm các field **cùng hàng**
thẳng nhau, nhưng chiều cao nội tại giữa các loại field vẫn khác nhau, nên khoảng trắng giữa hai hàng
có checkbox vẫn lớn hơn giữa hai hàng chỉ có text. Chuẩn hoá triệt để cần một `min-height` chung cho
mọi hộp field — việc đó làm form dài hơn đáng kể, nên là một quyết định thiết kế riêng, không gộp vào
lần sửa này.
