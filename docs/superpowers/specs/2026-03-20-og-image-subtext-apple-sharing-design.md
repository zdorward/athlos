# OG Image Subtext & Apple Sharing Design

## Goal

Add a tagline to the OG image, update the site description, and fix iMessage link previews to show the full large card instead of a small icon.

## Changes

### 1. OG image subtext (`apps/web/app/opengraph-image.tsx`)

Add "Data driven marathon training." below the "Athlos" wordmark. The tagline should:
- Font size: ~28px
- Weight: 400 (regular)
- Color: `rgba(255, 255, 255, 0.5)` (muted white)
- Letter spacing: normal (no tight tracking)
- Positioned directly below the wordmark, vertically close

The wordmark + tagline should be grouped in a `flex flex-col` container so they stay centered as a unit relative to the 3-block mark.

### 2. Site description (`apps/web/app/layout.tsx`)

Change `metadata.description` from:
> "Adaptive marathon training for runners with a real goal time."

To:
> "Data driven marathon training."

### 3. Twitter card for iMessage (`apps/web/app/layout.tsx`)

Add to the `metadata` export:
```ts
twitter: {
  card: "summary_large_image",
},
```

This causes iOS Messages to render the full 1200×630 OG image preview instead of falling back to the small `apple-touch-icon`.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/opengraph-image.tsx` | Add tagline below wordmark |
| `apps/web/app/layout.tsx` | Update description + add twitter card metadata |
