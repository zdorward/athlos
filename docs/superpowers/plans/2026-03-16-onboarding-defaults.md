# Onboarding Defaults Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pre-select sensible day defaults in the running days and lifting days onboarding steps to reduce friction for high-volume athletes.

**Architecture:** Two React component state initializers are updated. No new files, no API changes, no shared logic needed — each component independently initializes its own state from `formData` with a fallback to the appropriate default.

**Tech Stack:** React 19, Next.js 16 App Router, TypeScript. No new dependencies.

---

## Chunk 1: Both tasks

### Task 1: Running days defaults (`StepWhichDays`)

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-which-days.tsx:9-12`

**Spec:** `docs/superpowers/specs/2026-03-16-onboarding-defaults-design.md`

**Context:**

The component currently initializes:
```typescript
const [selectedDays, setSelectedDays] = useState<Day[]>(formData.selectedDays ?? [])
const [longRunDay, setLongRunDay] = useState<Day | undefined>(formData.longRunDay)
```

`??` only catches `null | undefined` — an explicit `[]` passes through unchanged. The defaults must only fire when the field is `undefined` (first visit, never written to `formData`).

Note on the `as Day[]` cast: TypeScript infers a string literal array like `["mon", "tue"]` as `string[]`, not `Day[]`. Without the cast, `useState<Day[]>` would reject the initializer with a type error. The cast is required wherever a literal array is used as a default.

- [ ] **Step 1: Replace the two state initializers**

Replace lines 9–10 in `step-which-days.tsx` with:

```typescript
const resolvedDays = formData.selectedDays ?? (["mon", "tue", "thu", "fri", "sun"] as Day[])
const [selectedDays, setSelectedDays] = useState<Day[]>(resolvedDays)
const [longRunDay, setLongRunDay] = useState<Day | undefined>(
  formData.longRunDay ?? (resolvedDays.includes("sun") ? "sun" : undefined)
)
```

`resolvedDays` is a local variable used only to initialize state — it avoids duplicating the default array to guard the `longRunDay` default. The `longRunDay` default fires only when `formData.longRunDay` is `undefined` AND `"sun"` is in the resolved running days, preventing an invisible pre-selection.

- [ ] **Step 2: Verify manually**

Run `pnpm dev` and navigate to `/new-plan`. Confirm:
- The running days step arrives with Mon/Tue/Thu/Fri/Sun highlighted
- Sunday is pre-selected as the long run day
- The Next button is immediately enabled
- Toggling days on/off works as before
- Navigate forward past this step, then press Back — the step re-shows the days you selected, not the defaults

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/steps/step-which-days.tsx
git commit -m "feat: pre-select running day defaults for high-volume athletes"
```

---

### Task 2: Lifting days defaults (`StepStrengthDays`)

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-strength-days.tsx:9`

**Context:**

The component currently initializes:
```typescript
const [selected, setSelected] = useState<Day[]>(formData.strengthDays ?? [])
```

Same `??` semantics as above. Default fires on `undefined`, explicit `[]` passes through. The `as Day[]` cast is required for the same reason as Task 1.

- [ ] **Step 1: Update `selected` initializer**

Replace line 9 in `step-strength-days.tsx`:

```typescript
const [selected, setSelected] = useState<Day[]>(
  formData.strengthDays ?? (["wed", "sat"] as Day[])
)
```

- [ ] **Step 2: Verify manually**

Navigate through the onboarding flow to the lifting days step (requires selecting "Yes" on the strength training step). Confirm:
- Wed and Sat are pre-highlighted on arrival
- The Next button is immediately enabled
- Toggling days on/off works as before
- Navigate forward past this step, then press Back — the step re-shows the days you selected, not the defaults

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/steps/step-strength-days.tsx
git commit -m "feat: pre-select lifting day defaults for hybrid athletes"
```
