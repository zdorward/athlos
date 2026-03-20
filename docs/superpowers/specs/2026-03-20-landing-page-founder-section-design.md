# Landing Page Founder Section — Design

**Date:** 2026-03-20
**Status:** Approved

## Goal

Add a founder section to the landing page that builds trust with early users by showing the human behind the product — who built it, why, and what they're trying to achieve. Also update the bottom CTA to surface the free pricing.

## Context

The landing page is currently pure product branding (methodology-forward, no personal element). For early access, this is a liability — there's no reason to trust an unknown product. The target audience (advanced runners chasing BQ) responds well to builders who are runners themselves.

Positioning chosen: **Product + founder section (Approach B)**. The hero stays unchanged. A "Why I built this" section is added below the existing content, before the bottom CTA.

## Founder Section

### Placement

Between the "How your plan is built" section and the bottom CTA in `landing-page.tsx`.

### DOM Structure

```
<section>                          // outer container, same as all sections
  <div>                            // 560px content block, centered
    <div style="display:flex">     // flex row: photo column | text column
      <div>                        // photo column (left)
        <img or placeholder />
        <div>Zack</div>
        <div>Edmonton, AB</div>
      </div>
      <div>                        // text column (right)
        <div>WHY I BUILT THIS</div>  // section label
        <p>paragraph 1</p>
        <p>paragraph 2</p>
        <p>paragraph 3</p>
      </div>
    </div>
    <div>stats row</div>           // sibling to flex row, full 560px width
    <div>early access callout</div> // sibling to flex row, full 560px width
  </div>
</section>
```

### Outer Container

Same as every other section: `padding: "0 24px 96px"`, `maxWidth: 1100`, `margin: "0 auto"` on the `<section>`. Inner content block: `maxWidth: 560`, `margin: "0 auto"`.

### Flex Row

`display: "flex"`, `gap: 32`, `alignItems: "flex-start"`, `flexWrap: "wrap"`.

**Photo column:** `flexShrink: 0`, `minWidth: 120`, `display: "flex"`, `flexDirection: "column"`, `alignItems: "center"` (centers the photo, name, and location both on desktop and when stacked on mobile).

**Text column:** `flex: 1`, `minWidth: 220`.

### Photo

`width: 88`, `height: 88`, `borderRadius: "50%"`, `objectFit: "cover"`, `display: "block"`. Source: `/zack.jpg`.

**Placeholder:** Render `<img src="/zack.jpg">` with an `onError` handler. When the image errors, set a state flag (`photoError`) to `true` and render a grey circle div instead: `width: 88`, `height: 88`, `borderRadius: "50%"`, `background: "rgba(255,255,255,0.08)"`, `display: "flex"`, `alignItems: "center"`, `justifyContent: "center"`, with text "ZD" at `fontSize: 20`, `color: "rgba(255,255,255,0.4)"`. This is the only state in `FounderSection` — a single `useState(false)` for `photoError`.

Below the photo: name `"Zack"` (`fontSize: 12`, `fontWeight: 600`, `color: "rgba(255,255,255,0.88)"`, `marginTop: 10`) and location `"Edmonton, AB"` (`fontSize: 11`, `color: "rgba(255,255,255,0.32)"`, `marginTop: 2`).

### Section Label

First element inside the text column. `"WHY I BUILT THIS"` — `fontSize: 11`, `fontWeight: 700`, `letterSpacing: "0.06em"`, `textTransform: "uppercase"`, `color: "rgba(100,150,255,0.7)"`, `marginBottom: 16`.

### Copy

Three `<p>` elements. `fontSize: 15`, `lineHeight: 1.7`, `color: "rgba(255,255,255,0.55)"`, `margin: "0 0 14px"` (last paragraph `margin: 0`).

> I ran my first marathon in September 2025 in **3:52**. I'm trying to run **3:20 at Victoria BC** this year and I'm using Athlos to get there.

> I wanted something that fit how I actually train. I lift, I care about how I look, and I run. Most plans don't really account for that. I built this mostly for myself and figured other people probably had the same problem.

> I also just don't think training plans should cost money. **Athlos is free.** The core plan always will be.

Bold spans: `color: "rgba(255,255,255,0.88)"`, `fontWeight: 600`.

### Stats Row

Sibling to the flex row, `marginTop: 32`. Spans the full 560px content block width.

Container: `display: "flex"`, `border: "1px solid rgba(255,255,255,0.07)"`, `borderRadius: 10`, `overflow: "hidden"`.

Each cell: `flex: 1`, `padding: "16px 20px"`, `textAlign: "center"`, `borderRight: "1px solid rgba(255,255,255,0.07)"` (last cell omits `borderRight`).

| Stat | Color | Label |
|------|-------|-------|
| 3:52 | `rgba(255,255,255,0.88)` | First marathon · Sept 2025 |
| 3:20 | `rgba(100,150,255,0.9)` | Goal · Victoria BC 2026 |
| 2:55 | `rgba(167,139,250,0.9)` | BQ goal · 2027 |

Stat value: `fontSize: 22`, `fontWeight: 700`. Label: `fontSize: 11`, `color: "rgba(255,255,255,0.32)"`, `marginTop: 4`.

### Early Access Callout

Sibling to the flex row and stats row, `marginTop: 20`. Spans the full 560px content block width.

Container: `padding: "14px 18px"`, `background: "rgba(255,255,255,0.04)"`, `border: "1px solid rgba(255,255,255,0.07)"`, `borderRadius: 8`, `display: "flex"`, `alignItems: "flex-start"`, `gap: 12`.

- ⚡ icon: `fontSize: 18`, `flexShrink: 0`
- Text column (`display: "flex"`, `flexDirection: "column"`, `gap: 2`):
  - Heading: `"Early access"` — `fontSize: 12`, `fontWeight: 600`, `color: "rgba(255,255,255,0.88)"`
  - Body: `"I'm looking for people to try this and tell me what's wrong with it. I read every message."` — `fontSize: 12`, `color: "rgba(255,255,255,0.38)"`
  - Email: `<a href="mailto:zack@athlos.run">zack@athlos.run</a>` — `fontSize: 12`, `color: "rgba(100,150,255,0.9)"`, `textDecoration: "none"`

## Bottom CTA Update

Change the existing subtitle `margin` from `"0 0 28px"` to `"0 0 8px"`.

Add a new element after the subtitle:

> Free. No account required to start.

Style: `fontSize: 13`, `fontWeight: 500`, `color: "#4ade80"`, `margin: "0 0 28px"`.

## Component Notes

`FounderSection` takes no props — it is entirely static content plus a single `photoError` state for the image fallback. Insert `<FounderSection />` in `PageContent`'s JSX between the "How your plan is built" `<section>` and the bottom CTA `<section>`.

## Files to Change

| File | Change |
|------|--------|
| `apps/web/app/landing-page.tsx` | Add `FounderSection` function, insert into `PageContent` JSX, update bottom CTA |
| `apps/web/public/zack.jpg` | Zack provides photo separately — `onError` fallback handles absence |
