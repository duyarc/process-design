# Print Formatting System - Reusable Specification

This document provides a complete specification for styling a web page to print out beautifully on standard A4 paper using browser print engines. It is designed to be easily read by developers and AI coding agents to replicate the visual formatting elsewhere.

---

## 1. CSS Custom Properties (Design Tokens)

Include these custom variables in the root of your stylesheet to align design variables:

```css
:root {
  --text-primary: #1e293b;
  --text-secondary: #475569;
  --border-color: #cbd5e1;
  --accent-color: #10a3a3;
  --bg-secondary: #f8fafc;
}
```

---

## 2. Global Print Adjustments & Page Setup

These selectors normalize browser defaults, establish margins, and force backgrounds to load correctly in PDF and physical print outputs.

```css
* {
  box-sizing: border-box;
}

body {
  font-family: 'Be Vietnam Pro', sans-serif;
  color: var(--text-primary);
  margin: 0;
  padding: 0;
  background-color: #f1f5f9;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

@page {
  size: A4;
  margin: 10mm 15mm;
}
```

---

## 3. Screen vs. Print Layouts

Establish a simulation wrapper class `.print-container` that displays as a card on screen but expands to full A4 page width without box-shadows when printed.

```css
/* Card stock view on-screen */
.print-container {
  max-width: 900px;
  margin: 24px auto;
  padding: 40px;
  background: #fff;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.form-header {
  text-align: center;
  margin-bottom: 24px;
}

.form-title {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--accent-color);
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
  font-style: italic;
}

/* Print Overrides */
@media print {
  body {
    background-color: #fff;
    font-size: 11pt;
  }

  .no-print {
    display: none !important;
  }

  .print-container {
    max-width: 100%;
    padding: 0;
    margin: 0;
    box-shadow: none;
    border-radius: 0;
  }
}
```

---

## 4. Grid Layouts & Page Break Guidelines

To prevent content from awkwardly breaking across A4 page lines:

```css
.questions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.question-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  page-break-inside: avoid;
}

.question-item.full-width {
  grid-column: 1 / -1;
}

.question-text {
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.4;
}

@media print {
  .domain-section {
    margin-bottom: 20px;
    page-break-inside: auto;
  }

  .criterion-group {
    margin-bottom: 12px;
    page-break-inside: auto;
  }

  .criterion-title {
    margin-bottom: 8px;
    padding: 5px 10px;
  }

  .questions-grid {
    column-gap: 16px;
    row-gap: 20px;
  }

  .question-item {
    gap: 6px;
  }

  .question-text {
    font-size: 0.82rem;
    color: #0f172a;
    line-height: 1.3;
  }
}
```

---

## 5. Domain & Criterion Headings

Titles are accented to group inputs visually. Accents switch to full black during printing.

```css
.domain-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 2px solid var(--accent-color);
  padding-bottom: 6px;
  margin-bottom: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  page-break-after: avoid;
}

.criterion-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 8px 12px;
  border-left: 4px solid var(--accent-color);
  margin-bottom: 16px;
  border-radius: 0 4px 4px 0;
  page-break-after: avoid;
}

@media print {
  .domain-title {
    border-bottom: 2px solid #000;
    color: #000;
  }

  .criterion-title {
    border-left: 4px solid #000;
    background: #f1f5f9 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

---

## 6. Input Elements & Handwriting Slots

Dotted slots allow for physical pen input on blank printouts, and highlight solid black text when prefilled.

```css
/* Dotted Line handwriting slot */
.input-dotted {
  font-size: 0.9rem;
  color: #94a3b8;
  letter-spacing: 2px;
  margin-top: 4px;
  border-bottom: 1px dotted #94a3b8;
  height: 20px;
}

/* Prefilled text block overlaying the slot */
.input-dotted.filled {
  color: #0f172a;
  font-weight: 600;
  border-bottom: 1px solid #cbd5e1;
  height: auto;
  min-height: 20px;
  letter-spacing: normal;
  padding-bottom: 2px;
}

.input-date-container {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 8px;
}

@media print {
  .input-dotted {
    margin-top: 2px;
    height: 18px;
  }

  .input-dotted.filled {
    color: #000 !important;
    border-bottom-color: #000 !important;
  }
}
```

---

## 7. Custom Options lists, Checkboxes, & Grid Tables

```css
.options-list {
  display: flex;
  flex-wrap: wrap;
  column-gap: 20px;
  row-gap: 6px;
  margin-top: 4px;
  margin-left: 16px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.82rem;
  color: #475569;
}

/* Checkbox boxes */
.checkbox-box {
  width: 15px;
  height: 15px;
  border: 1.5px solid #64748b;
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
  margin-top: 2px;
}

.checkbox-box.checked {
  background-color: var(--accent-color);
  border-color: var(--accent-color);
  position: relative;
}

.checkbox-box.checked::after {
  content: '✓';
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Grid layout sub-tables */
.grid-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  page-break-inside: avoid;
}

.grid-table th, .grid-table td {
  border: 1px solid var(--border-color);
  padding: 8px 10px;
  text-align: left;
  font-size: 0.8rem;
}

.grid-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-secondary);
}

.grid-table td {
  height: 32px;
}

@media print {
  .checkbox-box {
    border-color: #000;
  }

  .checkbox-box.checked {
    border-color: #000 !important;
    background-color: #000 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .checkbox-box.checked::after {
    color: #fff !important;
  }
}
```
