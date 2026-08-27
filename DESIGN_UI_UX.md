---
version: 1.0
name: Master UI/UX Design System
---

# Master UI/UX Design System

This document is the **single source of truth** for the visual design language of the platform. All agents and developers MUST consult this file before creating or modifying UI components.

| Field | Value |
|---|---|
| **Verified At Commit** | (2026-08-27) — Section 2, 4 (Executive Editorial Pair 1 H1-H2 Typography & Spacing Standardization across Screen & Print). |

## 1. Design Principles

The visual system is designed to convey **Executive Trustworthiness** and **Premium Digital Craftsmanship**. It blends high-contrast readability with a tactile, skeuomorphic feel, inspired by high-quality paper reports and frosted glass elements.

### Core Vibe
- **Cream & Charcoal Base:** The app avoids harsh stark-white interfaces, using a soft cream background (`--neutral-bg: #f6f4f0`) to replicate executive document cardstock.
- **Glassmorphism:** Elements like headers use transparent backdrops with a blur filter (`backdrop-filter: blur(12px)`) to float elegantly over the canvas background.
- **Teal Focus:** Teal gradients (`--primary` and `--secondary`) act as the primary interactive signal, used for highlights, CTA buttons, and focus states.

---

## 2. Global CSS Variables (Design Tokens)

These variables are defined in `src/index.css` under `:root`. Do **not** use hardcoded hex colors or arbitrary pixel values in components. Always use these `var(--name)` tokens.

### Colors
| Token | Value | Role |
|---|---|---|
| `--primary` | `#10a3a3` | Teal Brand Color (Main interactive color) |
| `--secondary` | `#0d9488` | Darker Teal Accent (Hover states, gradients) |
| `--neutral-bg` | `#f6f4f0` | Warm cream canvas background |
| `--neutral-card` | `#ffffff` | Solid white for cards/panels |
| `--neutral-border` | `rgba(0, 0, 0, 0.08)` | Subtle border for dividers |
| `--text-primary` | `#1f2937` | Charcoal for high legibility |
| `--text-secondary` | `#4b5563` | Slate gray for subtitles |
| `--text-muted` | `#8c939d` | Light gray for placeholders |
| `--warning` | `#d97706` | Orange-gold warning |
| `--danger` | `#dc2626` | Dark red alert |

### Typography
- **Font Family:** 'Be Vietnam Pro', sans-serif

### Spacing & Radii
| Token | Value | Role |
|---|---|---|
| `--container-radius` | `16px` | Large containers, modals |
| `--card-radius` | `8px` | Standard cards (`.paper-card`) |
| `--component-radius` | `4px` | Sharp curves for buttons and inputs |

### Shadows & Gradients
| Token | Role |
|---|---|
| `--shadow-sm` | Subtle elevation for buttons and headers |
| `--shadow-md` | Standard elevation for cards |
| `--shadow-lg` | High elevation for popups/modals |
| `--border-focus` | `rgba(16, 163, 163, 0.5)` (Teal glow ring for inputs) |
| `--primary-gradient` | `linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)` |

---

## 3. Core Utility Classes

All structural UI elements should be built using these standard classes defined in `index.css`.

### Layout
- `.app-container`: Main wrapper (`min-height: 100vh`, flex column).
- `.app-header`: Glassmorphic sticky top navigation bar.
- `.main-content`: Content wrapper (`max-width: 1600px`, centered, padded).
- `.grid-2`: Responsive 2-column grid (`1fr 1fr` on desktop, `1fr` on mobile).

### Cards & Panels
- `.paper-card`: Elevated white card (`--neutral-card`), rounded corners (`--card-radius`), standard shadow (`--shadow-md`), and a subtle hover border effect.
  - Modifier: `.paper-card.accent-teal` adds a top gradient border line.

### Buttons (`.btn`)
All buttons must use the base `.btn` class.
- `.btn-primary`: Uses `--primary-gradient` background. Used for main CTA (e.g., Save, Submit).
- `.btn-secondary`: White background, subtle border, gray text. Used for secondary actions (e.g., Cancel, Back).
- `.btn-danger`: Red (`#ef4444`) background. Used for destructive actions (e.g., Delete).
- `.btn-outline-danger`: White background with red hover states.
- `.btn-sm`: Smaller padding and font size for compact spaces.

### Forms & Inputs
- `.form-group`: Standard vertical spacing for input blocks.
- `.form-label`: Bold, small label text.
- `input[type="text"]`, `input[type="number"]`, `textarea`, `select`: Standardized with white background, subtle inset shadow, and a teal glow on `:focus`.
- `input[readonly]`: Automatically styled with a light teal background (`rgba(16, 163, 163, 0.04)`) to denote auto-calculation.

### Tables & Data
- `.table-container`: Responsive wrapper with rounded borders.
- `table`, `th`, `td`: Standardized padding, borders (`--neutral-border`), and typography.
- `.badge`: Pill-shaped status indicator.
  - Modifiers: `.badge-safety` (Red), `.badge-quality` (Blue), `.badge-env` (Green).

---

## 4. Printing Layout Rules

- **Print media (`@media print` in `print.css`):** Always hide headers, sidebars, dashboard navigation controls, and back buttons. Page size is always `A4`; orientation and margins differ per document kind — see §4.1. Reset background images to preserve physical printing ink. Use `page-break-inside: avoid` on charts, score blocks, and domain grids.

### 4.1 Page orientation — two conflicting `@page` rules by design

`print.css` declares `@page { size: A4 landscape }` for the process/BPMN documents, which need the
horizontal room. `PrintBlankForm.tsx` and `PrintRecord.tsx` each re-declare `@page { size: A4
portrait; margin: 15mm 15mm 20mm 15mm }` in an inline `<style>`.

`@page` accepts no selector, so the form portals **cannot** scope their override by `.print-doc`.
They win purely on DOM order — same specificity, declared later. Do not move the `@page` block in
`print.css` further down the file, and do not "deduplicate" these two declarations.

### 4.2 Print spacing scale (`.print-doc`)

The vertical rhythm of a printed form has exactly one source: the token block on `.print-doc` in
`print.css`. It sits **outside** `@media print` so the on-screen preview matches paper.

| Token | Value | Role |
|---|---|---|
| `--pw-block-gap` | `16px` | Between two adjacent content blocks |
| `--pw-section-top-gap` | `24px` | Distance above a `SECTION_LABEL` chapter marker |
| `--pw-section-bottom-gap` | `10px` | Distance below a `SECTION_LABEL` to its owned content |
| `--pw-field-gap` | `10px` | Between fields inside one block |
| `--pw-title-gap` | `8px` | Block title down to its content |
| `--pw-line-h` | `22px` | Handwriting line height (ISO 7mm) |
| `--pw-table-gap` | `14px` | Below a table's bottom border |

**Invariant.** Block spacing is owned by the adjacent-sibling selector `.print-block +
.print-block` alone. A block must never declare its own outer `margin-top` / `margin-bottom`: an
inline style beats the selector and silently reintroduces uneven gaps. This is what previously made
inter-block spacing depend on *which type came next* rather than on a rule. Both print components
were audited to hold this invariant; `SECTION_LABEL` wrappers carry `.print-block--section` so the
wider section gap is chosen by CSS, not by the component.

`.print-info-grid` is a row-major CSS grid with `align-items: baseline`, matching the FormBuilder
canvas. Full-width children (subtables) use `.print-field-full` → `grid-column: 1 / -1`, which needs
a real grid parent to take effect.

### 4.3 The `.print-doc` table exclusion

The global print rules for `th` / `td` are written as `th:not(.print-doc *), td:not(.print-doc *)`.

Author `!important` outranks a plain style attribute, so the unscoped version silently overrode every
inline `padding`, `border`, `font-size` and background in the form print templates — cell geometry on
paper was `6px 8px / 10pt` regardless of design, and screen preview disagreed with the printout.
Excluding `.print-doc` descendants hands those properties back to the components' inline styles.

Use a `:not()` exclusion, **not** `revert`. `revert` rolls back to a lower cascade origin (user-agent
defaults), it does not fall back to the inline style. The `th` background rule needs the same
exclusion, otherwise designed header tints are still forced to `#f0f0f0`.

---

## 5. Standard Dialogs & Confirmations (Bắt buộc)

Ứng dụng quy chuẩn hóa cách tương tác xác nhận của người dùng thông qua component dùng chung `src/components/common/ConfirmModal.tsx`.

### Quy tắc tạo mới
- **Nghiêm cấm** gọi trực tiếp các hàm `window.confirm()` hoặc `window.alert()` trong mã nguồn giao diện mới. 
- Tất cả các luồng xác nhận hành động (ví dụ: Xoá bản ghi, Huỷ thay đổi, Reset trạng thái) bắt buộc phải sử dụng `ConfirmModal` component để đảm bảo tính đồng bộ về thẩm mỹ (Glassmorphism backdrop, icon, button layout) và không bị chặn bởi pop-up blockers của trình duyệt.

### Quy tắc chuyển đổi lũy tiến (Progressive Adoption)
- Để giảm thiểu rủi ro hồi quy (regression) và giữ ổn định cho hệ thống, chúng ta **không thực hiện nâng cấp hàng loạt** toàn bộ code cũ.
- Tuy nhiên, mỗi khi cập nhật tính năng, sửa lỗi hoặc refactor một component mà có chứa lệnh `window.confirm()` cũ, nhà phát triển/agent **bắt buộc phải convert tiện tay** toàn bộ các lệnh confirm đó sang `ConfirmModal` trong component đó.

---

## 6. Change Log

| Date | Commit | Change |
|---|---|---|
| 2026-07-09 | `8df2f3c` | Re-written to act as the strict Master Design Source of Truth, mapping exactly to `src/index.css` variables and classes. |
| 2026-07-28 | `62b1a98` | **Print spacing invariant:** `print.css` gained the `.print-doc` token scale plus the `.print-block + .print-block` sibling rule, making block spacing single-source. Added `.print-info-grid` (row-major grid, baseline-aligned) and `.print-field-full`. Scoped the global `th` / `td` print overrides with `:not(.print-doc *)` so form print templates keep their inline cell geometry. Documented the deliberate two-`@page` orientation split. See §4.1–4.3. |
| 2026-08-03 | `CURRENT` | **ConfirmModal Rules:** Added Section 5 detailing the mandatory `ConfirmModal` component and the progressive adoption rule for legacy `window.confirm()` calls. |
| 2026-08-13 | `4eefc87` | **Automated Checkbox Layout Pattern (Option A vs Option C):** Documented dynamic layout engine. Standard fields use Option A (2-column fixed 35%/65% grid) to align checkbox icons vertically; detailed/long fields use Option C (Top-aligned label + 1rem indented options). |
| 2026-08-17 | `3504b80` | **Table Group Header Rows UI Pattern:** Documented category banner rows in tables. Full width (`colSpan=cols.length`), medium gray background (`#E5E7EB`), bold text (`fontWeight: 700`), saving 30–40% vertical whitespace. |
| 2026-08-17 | `f5e93b8` | **Table Group-Level Multi-`<tbody>` Page Break:** Documented `.print-table-group` pattern (`<tbody>` with `page-break-inside: avoid` per section), eliminating dead white space on preceding pages and preserving repeated `<thead>` on new pages. |
| 2026-08-17 | `237f540` | **`<colgroup>` & `<col>` Dynamic Table Width Standardization:** Standardized `<colgroup>` with dynamic `<col>` tags across all table renderers to guarantee 100% strict column width alignment across all browsers and printouts. |
| 2026-08-25 | `a18181b` | **Table Border Styles Parity (`.print-table--horizontal` & `.print-table--borderless`):** Standardized horizontal-only table styles with top border on `<table>`, bottom border on `<th>` and `<td>`, and elimination of vertical borders across screen, print media, and PDF export modes. |
| 2026-08-27 | `CURRENT` | **Executive Editorial Pair 1 H1-H2 Typography & Spacing Standardization:** (1) Standardized **H1** across Canvas, Screen Viewers, and Print/PDF to pure bold uppercase typography (`fontSize: 1.1rem`, `fontWeight: 700`, `letterSpacing: 0.6px`, `color: #0f172a`, `border: 'none'`, `background: 'transparent'`), eliminating divisive horizontal underlines that fragmented the form. (2) Standardized **H2** to use a sleek Left Accent Bar (`borderLeft: '3px solid var(--primary)'`, `padding: '2px 0 2px 8px'`) with transparent background (`background: 'transparent'`, `fontSize: 0.92rem`–`0.95rem`), eliminating gray banner boxes for smooth visual flow. |
| 2026-08-27 | `CURRENT` | **Long Form Section Focus & Minimal Top Bar UI Pattern:** Added Section Focus & Accordion Mode design pattern to FormFiller. Features 1-line Top Navigation Bar with `[ 🎯 Focus mode (──🟢) ]` switch toggle, Collapsed Chapter Header Cards with live counter badges (`[✓ Đã xong X/Y]`), and section footer navigation (`[← Quay lại]`, `[Tiếp tục →]`, `[🚀 Gửi phiếu]`). |
