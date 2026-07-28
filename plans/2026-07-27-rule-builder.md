# RuleBuilder — Scoring Module Design Plan

| Field | Value |
|---|---|
| **Authored against commit** | `35c164e` |
| **Status** | Active |

---

## Context

The platform's only evaluation logic today is hardcoded binary pass/fail: number fields against
`minSpec`/`maxSpec`, radio and checkbox against `options[].isPass`. A submission comes out `PASS` or
`ABNORMALITY`, nothing in between.

Audit-style forms need grading, not a verdict. RuleBuilder lets an author give each question a
**score, weight, and category**, so a submission produces a percentage per category plus one
combined total.

Scope is scoring only. No conditional show/hide, no validation rules, no workflow routing — those are
separate rule kinds that can later join the same table.

---

# PART 1 — UI / UX: how the user meets this system

Follows [`DESIGN_UI_UX.md`](../DESIGN_UI_UX.md) throughout: `var(--primary)`, `var(--neutral-bg)`,
`.paper-card`, `.btn`, `.badge`, `--card-radius`. No hardcoded hex. Sentence case labels, per the
header convention from `001af74`.

## 1.1 Three ways in

| Entry point | Where | Role |
|---|---|---|
| **Dashboard, Forms view** | "Scoring" action on each form row, beside Fill / Manage | Primary discovery path. Rows already resolve `formName` + version; reuses the `handleFillAction` / `processSelectDialog` pattern in `Dashboard.tsx` |
| **FormBuilder top action bar** | "Scoring rules" button next to Print Preview | For an author already editing the layout |
| **Drift banner link** | "Review scoring rules" in the FormBuilder banner | Recovery path, see §1.4 |

The FormBuilder entry has one trap worth designing around: RuleBuilder reads `layout_blocks` from the
database, so unsaved canvas edits would yield a stale question list. The button prompts to save first
rather than silently showing an out-of-date picker.

## 1.2 The RuleBuilder page

Three panels, matching FormBuilder's established shape: palette left, work centre, inspector right.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← Back    3S-QC/F1.1 · V0.2-27.07.2026 (draft)  [DRAFT]   ⚠ 2   [Save]     │
├────────────────┬──────────────────────────────────┬──────────────────────────┤
│ CATEGORIES     │  QUESTIONS                       │  ITEM SETTINGS           │
│                │                                  │                          │
│ Safety     40  │  ▾ Container exterior check      │  Question                │
│ Quality    40  │    ● Door seal condition    S 40 │  Door seal condition     │
│ Housekeep  20  │    ● Floor cleanliness      H 20 │                          │
│ ─────────────  │    ○ Roof panel             —    │  Category  [Safety   ▾]  │
│ Total     100  │                                  │  Weight    [ 40 ]        │
│ ✓ balanced     │  ▾ Temperature log (table)       │  Max points[ 10 ]        │
│                │    ● Reading °C   col       Q 30 │  Scoring   [Pass/fail ▾] │
│ + Add category │    ⚠ Grade col — target missing  │  If blank  ( ) 0 (•) skip│
└────────────────┴──────────────────────────────────┴──────────────────────────┘
```

**Left, categories.** Add, rename, reorder, delete, one weight input each. A live total with a soft
signal: "✓ balanced" at 100, an amber note otherwise. Amber not red, because an unbalanced total is
normalised at compute time rather than being an error.

**Centre, questions.** Every scorable target grouped under its block title, so the list reads in the
same order as the printed form. Three visual states:

- **Scored** — filled dot, category chip, weight
- **Unscored** — hollow dot, muted, em-dash. Visible on purpose: an author needs to see what is not
  yet graded
- **Warning** — amber chip naming the problem inline on the row

**Right, item settings.** Category, weight, max points, scoring mode, and for option-mapped questions
a small table of one points input per option. Plus the blank policy: score zero, or drop from the
denominator.

**Header.** Form id, version through the existing `formatFormVersion` helper in `src/types.ts`,
status badge, warning count, Save, Back.

When the form version is ACTIVE the page renders read-only, mirroring FormBuilder's `isLocked`:
inputs disabled, one line of explanation, and a "Create new draft" affordance routing back into
FormBuilder.

## 1.3 What the operator sees

Nothing new while filling. FormFiller gains no scoring UI, no live meter, no per-question points.
That is deliberate: a visible running score invites the operator to work the number instead of
recording what they observed.

The score appears after submit:

- **Success screen** — total percent with per-category bars beneath
- **FormManager, SubmissionManager** — total percent as a sortable column; category breakdown in the
  expanded detail panel
- **PrintRecord** — a score block under the record header, `page-break-inside: avoid` per
  `DESIGN_UI_UX.md` §4

Forms with no rule set look exactly as they do today, everywhere. The feature is invisible until
someone authors rules.

**Score and PASS/FAIL are separate axes.** A form can score 82% and still submit as ABNORMALITY
because one reading was out of spec. Collapsing them would lose information an auditor needs.

## 1.4 When the form changes underneath the rules

Warn, never block. An author mid-redesign must not be stopped by a scoring rule, and an operator must
never be blocked from recording work by an authoring mistake.

| Where | How drift shows |
|---|---|
| FormBuilder | Dismissible banner, "2 scoring rules no longer match this form", with the Review link. Publish still succeeds |
| RuleBuilder | Amber chip on each affected row, count in the header |
| FormFiller | Nothing shown to the operator. Broken items drop out of the calculation and are recorded on the submission as skipped, so the audit trail shows the score was partial |

---

# PART 2 — Function blocks and how they connect

## 2.1 The blocks

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  FormBuilder    │     │  RuleBuilder    │     │   FormFiller    │
│  (existing)     │     │  (new page)     │     │   (existing)    │
│                 │     │                 │     │                 │
│ authors layout  │     │ authors scoring │     │ collects values │
│ owns version    │     │ reads layout    │     │ computes score  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │  writes               │  writes               │  reads both
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  forms          │◀────│  form_rules     │     │  submissions    │
│  PK(form_id,    │  FK │  PK(form_id,    │     │  + score JSONB  │
│     version)    │     │     version)    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                 │                       ▲
                    ┌────────────┴────────────┐          │
                    │   scoring.ts            │──────────┘
                    │   addresses · resolve   │
                    │   validate · compute    │
                    └─────────────────────────┘
```

`scoring.ts` is the shared brain. Anything that needs to know what is scorable, whether a rule still
fits, or what a submission scored calls into it. No component parses a rule address or re-implements
the maths.

## 2.2 Authoring sequence

```
1  FormBuilder: author builds layout, Save Draft
        ↓  POST /api/forms  →  forms row (form_id, v0.1)
                            →  server copies rules forward if a prior version has them

2  Dashboard or FormBuilder: open Scoring
        ↓  RuleBuilder reads layout_blocks from the forms row
        ↓  resolveScorableTargets() turns the layout into a question list

3  RuleBuilder: define categories, assign score/weight/category, Save
        ↓  POST /api/form-rules  →  form_rules row (form_id, v0.1)

4  FormBuilder: Publish
        ↓  forms row → ACTIVE. Rules become read-only. Publish never blocks on warnings.
```

Steps 1 and 3 are independent save cycles against different tables. That separation is the reason
rules get their own table: a layout save can never clobber rules, and a rule save never rewrites
layout JSON through `saveFormToBackend`'s full-object upsert.

## 2.3 Submission sequence

```
Operator opens FormFiller
        ↓  fetch layout (existing)  +  fetch rule set (new; 404 = no scoring, feature absent)
Operator fills, submits
        ↓  existing pass/fail evaluation  →  PASS | ABNORMALITY   (unchanged)
        ↓  computeScore(ruleSet, values, layout)  →  SubmissionScore
        ↓  POST /api/submissions  with score + scorePercent
Stored on the submission, frozen
        ↓  FormManager · SubmissionManager · PrintRecord read it back
```

Frozen is the point. Editing rules next month must not silently restate what a record scored last
month.

## 2.4 Version sequence, the crux

Rules are keyed `(form_id, version)`, identical to `forms`, because `forms` already stores one
independent `layout_blocks` snapshot per version. Keyed by `form_id` alone, a v0.2 rule set would
silently grade a v0.1 layout it was never written against.

```
v0.1 ACTIVE                          v0.2 DRAFT
┌──────────────┐   + NEW DRAFT      ┌──────────────┐
│ layout v0.1  │  ───────────────▶  │ layout v0.2  │   editable
│ rules  v0.1  │   carry forward    │ rules  v0.2  │   editable, independent
│ (read-only)  │   on first save    │              │
└──────────────┘                    └──────────────┘
      ▲
      └── untouched by any edit to v0.2
```

Carry-forward must happen server-side, in `POST /api/forms`. `handleCreateNewVersion` in FormBuilder
only mutates local React state and never writes to the database (technical debt already documented in
[`DESIGN_FORM_DESIGNER.md`](../DESIGN_FORM_DESIGNER.md)), so there is no client moment to hook. The
POST handler covers every path that can mint a version — Save Draft, Publish, Commit Restore then
save — with no client change.

Three adjacent behaviours:

- **Delete a form version** → `ON DELETE CASCADE` takes its rules. No orphan-cleanup code, and no
  repeat of the R2 logo incident in [`DESIGN_BACKEND.md`](../DESIGN_BACKEND.md) §4
- **Restore Revision** → swaps an old layout into the current draft without changing the version
  string. Rules stay bound to the draft version and are not swapped; the drift banner covers any
  mismatch. Rules belong to the version being authored, not the snapshot being browsed
- **Rename a form id** → rules must follow the rename, or the cascade eats them (§3.6)

---

# PART 3 — Technical reference for execution

## 3.1 Rule addressing

Question identity is not uniform here. `handleSubmitForm` in `FormFiller.tsx` builds snapshot ids four
different ways:

| Element | Value key |
|---|---|
| Block field | `field.id` |
| TABLE cell | `` `${block.id}_${row.id}_${col.id}` `` |
| TABLE summary row | `` `${block.id}_summary_${col.id}_${sRow.id}` `` |
| MATRIX cell | `` `${block.id}_row_${rIdx}_col_${cIdx}` `` |

A rule stores a stable **address**, not a value key:

- `field:<fieldId>` — resolves to value key `fieldId`
- `tcol:<blockId>:<colId>` — resolves to every row cell `${blockId}_${rowId}_${colId}`; the column
  scores as the **mean** of its cells, so adding table rows does not inflate the column's weight

Addresses survive what matters. Block ids (`b_{type}_{Date.now()}`) and field ids
(`f_{type}_{Date.now()}`) are minted once at add-time and preserved verbatim by
`handleRestoreRevision`, which deep-clones `entry.layoutBlocks`. Only the Copy-Block path regenerates
ids, and that yields a genuinely new question which legitimately has no rule.

## 3.2 Types — add to `src/types.ts`

Owning doc is a new `DESIGN_RULE_BUILDER.md`, per `AGENTS.md` §1.

```typescript
export type ScoringMode = 'pass_fail' | 'option_map' | 'numeric_range';
export type NAPolicy = 'zero' | 'exclude';

export interface ScoreCategoryISO {
  id: string;                            // cat_<Date.now()>
  name: string;
  weight: number;                        // relative weight in the form total
  description?: string;
}

export interface ScoreItemISO {
  id: string;                            // si_<Date.now()>
  target: string;                        // "field:<id>" | "tcol:<blockId>:<colId>"
  categoryId: string;
  weight: number;                        // relative weight within its category
  maxPoints: number;
  scoring: ScoringMode;
  optionScores?: Record<string, number>; // option.value -> points (option_map)
  naPolicy: NAPolicy;
}

export interface FormRuleSetISO {
  formId: string;
  version: string;                       // clean semver, "v0.2"
  categories: ScoreCategoryISO[];
  items: ScoreItemISO[];
  totalMode: 'weighted_percent' | 'raw_points';
  updatedAt?: string;
}

export interface SubmissionCategoryScore {
  categoryId: string;
  name: string;                          // denormalized: old records stay readable after a rename
  points: number;
  maxPoints: number;
  percent: number;
}

export interface SubmissionScore {
  totalPoints: number;
  maxPoints: number;
  totalPercent: number;
  categories: SubmissionCategoryScore[];
  ruleSetVersion: string;
  skippedItemIds: string[];              // dropped for drift or naPolicy
  computedAt: string;
}
```

`Submission` gains `score?: SubmissionScore | null`.

## 3.3 `src/utils/scoring.ts`

```
buildFieldAddress(fieldId)                      -> "field:<id>"
buildTableColumnAddress(blockId, colId)         -> "tcol:<blockId>:<colId>"
parseAddress(addr)                              -> discriminated union
resolveScorableTargets(layoutBlocks)            -> ScorableTarget[]
evaluatePassFail(field, value)                  -> boolean
validateRuleSet(ruleSet, layoutBlocks)          -> RuleWarning[]
computeScore(ruleSet, formValues, layoutBlocks) -> SubmissionScore
```

`resolveScorableTargets` is the only function that knows the layout shape. It walks `layoutBlocks`
and returns per candidate: address, display label (via the existing `sanitizeLabel` in
`src/utils/formUtils.ts`), block title, type, and `options` where present. Both the RuleBuilder picker
and the drift validator consume it.

`evaluatePassFail` is an **extraction, not new logic**. `FormFiller` currently duplicates the same
evaluation in two places, the `handleSubmitForm` snapshot mapping and the CHECKLIST_TABLE
`isOutOfSpec` render path. Move it here and call it from both, so scoring and the red-highlight UI can
never disagree.

`validateRuleSet` warning kinds: `TARGET_MISSING` (field or column deleted), `TYPE_CHANGED` (type no
longer supports the scoring mode), `OPTION_MISSING` (mapped option gone), plus three advisory ones,
`UNSCORED_TARGET`, `EMPTY_CATEGORY`, `WEIGHT_ZERO`.

Scoring modes:

| Mode | Rule |
|---|---|
| `pass_fail` | `evaluatePassFail` → full `maxPoints` on pass, 0 on fail |
| `option_map` | `optionScores[value]`, clamped to `[0, maxPoints]`. Checkbox (comma-joined) sums selected options, then clamps |
| `numeric_range` | Linear: `minSpec` → 0, `maxSpec` → `maxPoints`, clamped both ends |

Aggregation: item percent = `points / maxPoints`. Category percent = weighted mean of its items by
`item.weight`. Total = weighted mean of categories by `category.weight`. Items excluded by
`naPolicy: 'exclude'` or by drift leave both numerator and denominator. A category with zero
effective weight reports `percent: 0, maxPoints: 0` and drops out of the total, never a
divide-by-zero.

## 3.4 Schema — `server.cjs`

Add to `INITIALIZE_SCHEMA_QUERY`:

```sql
CREATE TABLE IF NOT EXISTS form_rules (
  form_id     TEXT NOT NULL,
  version     TEXT NOT NULL,
  categories  JSONB NOT NULL DEFAULT '[]',
  items       JSONB NOT NULL DEFAULT '[]',
  total_mode  TEXT NOT NULL DEFAULT 'weighted_percent',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (form_id, version),
  FOREIGN KEY (form_id, version) REFERENCES forms(form_id, version)
    ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE form_rules ENABLE ROW LEVEL SECURITY;
```

The RLS line matches the convention for all five existing tables, though per `DESIGN_BACKEND.md` §3
no policies exist and the server bypasses it.

Idempotent migrations in `initDatabase()`, following the existing inline `ALTER TABLE` pattern:

```sql
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS score JSONB DEFAULT NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS score_percent NUMERIC;
```

`score_percent` is denormalized for sorting: `GET /api/submissions` returns the whole table with no
server-side filtering, so keeping the sort key out of JSONB avoids a client-side JSON walk over every
row.

## 3.5 Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/form-rules/*formId` | Read a rule set; `?version=` selects, omitted = latest. 404 when none |
| `POST` | `/api/form-rules` | Upsert `(formId, version)` |
| `DELETE` | `/api/form-rules/*formId?version=` | Drop a rule set without deleting the form version |

Wildcard `*formId` on read and delete matches the existing forms routes, since form ids contain
slashes (`3S-QC/F1.1`). `/api/form-rules` is a distinct prefix, so `/api/forms/*formId` cannot swallow
it and route ordering is not a hazard. Group the handlers with the forms handlers.

Offline CSV mode must be dual-implemented per the `if (dbPool) { … } else { … }` convention:
`readRulesOffline()` / `writeRulesOffline()` modelled on the existing `readFormsOffline()` /
`writeFormsOffline()`, against `data/form_rules.json`. The offline branch has no FK, so
`DELETE /api/forms/*formId` must explicitly drop the matching offline rules row.

## 3.6 Carry-forward and rename in `POST /api/forms`

New helper `ensureRulesForVersion(formId, version)` beside the forms handlers: if no `form_rules` row
exists for `(formId, version)`, copy from the highest prior version of the same `form_id`. It must run
**after** the upsert, because the FK requires the `forms` row to exist first.

Rename needs care. The handler already deletes the old DRAFT row when `oldFormId !== formId`, and the
cascade would take the old rules with it. Sequence inside the handler:

1. Read `form_rules` for `(oldFormId, ver)` into a variable
2. Existing `DELETE FROM forms WHERE form_id = oldFormId …` — cascade drops the old rules
3. Existing safety check + upsert of the new row
4. If a rule set was captured, insert it under `(formId, ver)`; otherwise call
   `ensureRulesForVersion`

## 3.7 Routing and permissions

`App.tsx`: add `'rule-builder'` to the `PageId` union; state for the selected form id and version; a
`handleOpenRuleBuilder` navigator shaped like the existing `handleOpenFormManager` (set `prevPage`,
set selection, set page); a render branch guarded by `hasPermission('design_document')` for edit and
`'view_document'` for read.

No new `PermissionKey`. Rule editing rides on `design_document`, treating scoring as part of document
design. Tighter restriction later would be a follow-up to `AuthContext.tsx`.

Note that read-only-when-ACTIVE is UI-only enforcement, exactly like FormBuilder's `isLocked` today.
No server guard, consistent with `DESIGN_BACKEND.md` §5.

## 3.8 Files

**New**

| File | Role |
|---|---|
| `src/utils/scoring.ts` | Addresses, `resolveScorableTargets`, `evaluatePassFail`, `validateRuleSet`, `computeScore` |
| `src/components/RuleBuilder.tsx` | The page |
| `DESIGN_RULE_BUILDER.md` | Owning doc for the new interfaces |

**Modified**

| File | Change |
|---|---|
| `src/types.ts` | Interfaces in §3.2 + `Submission.score` |
| `server.cjs` | `form_rules` DDL, two `ALTER TABLE`s, three endpoints, `ensureRulesForVersion`, rename handling, score persistence in `POST /api/submissions`, offline helpers |
| `src/App.tsx` | Route + navigator |
| `src/components/Dashboard.tsx` | Scoring row action in the forms view |
| `src/components/FormBuilder.tsx` | Drift banner + Scoring rules button; read-only w.r.t. rules |
| `src/components/FormFiller.tsx` | Fetch rule set, extract `evaluatePassFail`, compute + submit score |
| `src/components/FormManager.tsx`, `src/components/SubmissionManager.tsx`, `src/components/print/PrintRecord.tsx` | Render score when present |
| `AGENTS.md` | Module Ownership Map row + shared-types owner row |
| `README.md` | New module in the architecture overview |
| `DESIGN_FORM_DESIGNER.md`, `DESIGN_FORM_OPERATIONS.md`, `DESIGN_BACKEND.md` | Interface and schema deltas + Change Log entries |

## 3.9 Build order

`npm run build` → zero TypeScript errors at every phase boundary, per `AGENTS.md` §9.

| Phase | Work | Gate |
|---|---|---|
| 1 | Types + `scoring.ts`, `evaluatePassFail` extracted from FormFiller | Build clean; FormFiller pass/fail behaviour unchanged |
| 2 | Schema + three endpoints + `ensureRulesForVersion` + offline branch | Build clean; endpoints respond |
| 3 | RuleBuilder page + route + entry points | Build clean; rules save and reload |
| 4 | FormBuilder drift banner | Build clean |
| 5 | FormFiller compute-and-submit | Build clean |
| 6 | Score display in FormManager / SubmissionManager / PrintRecord | Build clean |
| 7 | Docs | — |

Phases 1–2 are independent of 3–6 and can be split across sessions. Per `AGENTS.md` §9, an Executor
that fails a mechanical fix twice stops and escalates to Planner tier rather than improvising a
TypeScript fix.

This plan is design-level, not the Find/Replace task format `AGENTS.md` §9 mandates for 3+ write
sites. The three new files have nothing to "find", so they are full-content tasks regardless; the
edits to `server.cjs`, `types.ts`, `App.tsx`, `FormBuilder.tsx` and `FormFiller.tsx` need exact
anchors read from each file before an Executor-tier model can apply them mechanically. That pass is
worth doing before execution starts.

---

## Verification

No test framework exists in this repo — `package.json` has no test script or runner. Setting one up is
worth doing but is a separate decision, flagged here rather than bundled in. Verify manually with
`npm run dev`:

1. **Create rules** — open a DRAFT form's RuleBuilder, add two categories, assign items across both,
   save. Reload: rules persist against that exact `(form_id, version)`.
2. **Carry-forward** — publish, then "+ NEW DRAFT" in FormBuilder and Save Draft. The new version's
   RuleBuilder shows the copied rules; editing them leaves the ACTIVE version's rules untouched
   (re-read the old version via `?version=` to confirm).
3. **Drift warns, never blocks** — delete a scored field in FormBuilder and save. FormBuilder shows
   the banner, RuleBuilder shows the target-missing chip, Publish still succeeds, and a submission
   still computes a score with that item excluded.
4. **Score math** — fill a form whose category and total percentages are hand-calculable, submit,
   confirm the stored `score` matches. Leave one item blank to exercise `naPolicy: 'exclude'`.
5. **Cascade** — delete a form version; confirm its `form_rules` row is gone.
6. **Absent rules** — fill and submit a form with no rule set. Submission succeeds, no score UI
   anywhere, PASS/ABNORMALITY behaviour identical to today.
7. **Rename** — rename a DRAFT form's Form ID; confirm its rules follow to the new id.
8. **Read-only** — open RuleBuilder on an ACTIVE version; confirm inputs are disabled.

Two consequences of this design are worth a second look during build. ACTIVE rule sets being
read-only means you cannot add scoring to an already-published form without cutting a new version —
correct for ISO document control, but a real constraint. And FormFiller showing no live score is a
choice about operator behaviour, not an oversight; if operators turn out to need feedback while
filling, changing it is a deliberate later decision.
