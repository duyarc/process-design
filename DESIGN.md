---
version: alpha
name: Process Design
colors:
  primary: "#10a3a3"          # Teal Brand Color
  secondary: "#0d9488"        # Success/Darker Teal Accent
  neutral-bg: "#f6f4f0"       # Warm cream paper-like canvas background
  neutral-card: "#ffffff"     # Solid card stock panels
  neutral-border: "rgba(0, 0, 0, 0.08)"
  text-primary: "#1f2937"     # Rich charcoal for high ink-like legibility
  text-secondary: "#4b5563"   # Muted slate gray for subtitles
  text-muted: "#8c939d"       # Gray for placeholders
  warning: "#d97706"          # Orange-gold warning
  danger: "#dc2626"           # Dark red alert
typography:
  fontFamily: "Be Vietnam Pro, sans-serif"
  baseSize: "16px"
  headings:
    fontWeight: 700
  body:
    lineHeight: 1.5
spacing:
  container-radius: "16px"    # For headers, stats panels, glass cards
  component-radius: "4px"     # Minimalist sharp curves on buttons and input fields
  card-radius: "8px"          # Soft outline for questionnaire content cards
---

# Design Principles

The visual system is designed to convey **Executive Trustworthiness** and **Premium Digital Craftsmanship**. It blends high-contrast readability with a tactile, skeuomorphic feel, inspired by high-quality paper reports and frosted glass elements.

## Core Vibe
- **Cream & Charcoal Base:** The app avoids harsh stark-white interfaces, using a soft cream background (`#f6f4f0`) to replicate executive document cardstock.
- **Glassmorphism:** Elements like headers and modals use transparent backdrops (`rgba(255,255,255,0.85)`) with a blur filter (`backdrop-filter: blur(12px)`) and fine translucent borders to float elegantly over the canvas background.
- **Teal Focus:** Teal gradients (`#10a3a3` to `#0d9488`) are the primary interactive signal, used for highlights, CTA buttons, and focus states.

---

# UI Components & Rules

### 1. Buttons
- **Shape:** All buttons have a minimalist `border-radius: 4px`.
- **Transitions:** Buttons must scale or translate subtly (`transform: translateY(-2px)`) on hover with a smooth bezier transition.
- **Primary CTA:** Uses `--primary-gradient`.
- **Secondary Action:** Styled using elevated paper card background, turning dark charcoal (`#374151`) on hover.

### 2. Form Inputs
- **Inputs:** Solid white backdrop with subtle inset shadow. On focus, triggers `--border-focus` border outline and a glow shadow effect (`box-shadow: 0 0 0 3px rgba(16, 163, 163, 0.1)`).
- **Calculated Fields:** Formula fields must be marked read-only and colored in light translucent teal (`rgba(16, 163, 163, 0.04)`) to denote auto-calculation.

### 3. Printing Layout Rules
- **Print media (`@media print`):** Always hide headers, sidebars, dashboard navigation controls, and back buttons. Set paper margins to `15mm` and page size to `A4`. Reset background images to preserve physical printing ink. Use `page-break-inside: avoid` on charts, score blocks, and domain grids.
