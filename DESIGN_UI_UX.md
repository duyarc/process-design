---
version: 1.0
name: Master UI/UX Design System
---

# Master UI/UX Design System

This document is the **single source of truth** for the visual design language of the platform. All agents and developers MUST consult this file before creating or modifying UI components.

| Field | Value |
|---|---|
| **Verified At Commit** | `001af74` (2026-07-27) — Section 2 design tokens checked against `src/index.css` |

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

- **Print media (`@media print` in `print.css`):** Always hide headers, sidebars, dashboard navigation controls, and back buttons. Set paper margins to `15mm` and page size to `A4`. Reset background images to preserve physical printing ink. Use `page-break-inside: avoid` on charts, score blocks, and domain grids.

---

## 5. Change Log

| Date | Commit | Change |
|---|---|---|
| 2026-07-09 | `8df2f3c` | Re-written to act as the strict Master Design Source of Truth, mapping exactly to `src/index.css` variables and classes. |
