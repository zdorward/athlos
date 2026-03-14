# Auth + Plan Saving Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth + magic link sign-in and a "Save Plan" button that persists generated training plans to Neon Postgres via Drizzle ORM, with no auth wall before plan generation.

**Architecture:** A new `packages/db` workspace package holds the Drizzle schema (Better Auth tables + `plans` table) and Neon client. Better Auth v1 handles auth with a Drizzle adapter so all tables live in the same database. Save state lives in `page.tsx` and is passed as props to three save button placements; a `SignInSheet` bottom sheet handles unauthenticated saves, writing plan state to `sessionStorage` before OAuth redirects so it survives the round-trip.

**Tech Stack:** Better Auth v1, Neon (serverless Postgres), Drizzle ORM, Resend (magic link email), Next.js App Router route handlers

---

## Chunk 1: Database package

### Task 1: Scaffold `packages/db/`

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/.gitignore`
- Modify: `apps/web/package.json` — add `@workspace/db` dep

- [ ] **Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@workspace/db",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.0",
    "drizzle-orm": "^0.40.0"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create `packages/db/tsconfig.json`**

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create `packages/db/.gitignore`**

```
.env
```

Note: `drizzle/` is intentionally NOT gitignored — migration files must be committed to version control.

- [ ] **Step 4: Create `packages/db/.env` placeholder** (for local drizzle-kit runs — gitignored)

```
DATABASE_URL=
```

- [ ] **Step 5: Add `@workspace/db` to `apps/web/package.json`**

In `apps/web/package.json`, add to `"dependencies"`:
```json
"@workspace/db": "workspace:*"
```

- [ ] **Step 6: Install**

```bash
pnpm install
```

Expected: no errors, `@workspace/db` listed in `apps/web/node_modules/@workspace/`.

- [ ] **Step 7: Commit**

```bash
git add packages/db/package.json packages/db/tsconfig.json packages/db/.gitignore apps/web/package.json pnpm-lock.yaml
git commit -m "feat: scaffold packages/db workspace package"
```

Note: `packages/db/.env` is gitignored — do NOT add it to git.

---

### Task 2: Database schema + client

**Files:**
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Create `packages/db/src/schema.ts`**

This file defines both the Better Auth core tables (required by the Drizzle adapter) and the custom `plans` table.

```typescript
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  numeric,
  jsonb,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ─── Better Auth tables (required by drizzle adapter) ──────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
})

// ─── App tables ─────────────────────────────────────────────────────────────

export const plans = pgTable("plans", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  name: text("name").notNull(),
  input: jsonb("input").notNull(),
  days: jsonb("days").notNull(),
  totalWeeks: integer("total_weeks").notNull(),
  totalKm: numeric("total_km").notNull(),
  peakWeekKm: numeric("peak_week_km").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
```

- [ ] **Step 2: Create `packages/db/src/client.ts`**

```typescript
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

- [ ] **Step 3: Create `packages/db/src/index.ts`**

```typescript
export { db } from "./client"
export * from "./schema"
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/
git commit -m "feat: add database schema and Neon client"
```

---

### Task 3: Drizzle config + migration

**Files:**
- Create: `packages/db/drizzle.config.ts`

**Prerequisites:** You must have a Neon database URL. Create a free project at [neon.tech](https://neon.tech), copy the connection string, and put it in `packages/db/.env` as `DATABASE_URL=postgresql://...`. Also put the same value in `apps/web/.env.local`.

- [ ] **Step 1: Add `dotenv` to `packages/db/package.json` devDependencies**

`drizzle-kit` does not auto-load `.env` files; we need to import `dotenv/config` in the config.

Add to `devDependencies` in `packages/db/package.json`:
```json
"dotenv": "^16.0.0"
```

Then run:
```bash
pnpm install
```

- [ ] **Step 2: Create `packages/db/drizzle.config.ts`**

```typescript
import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 3: Generate migration**

```bash
pnpm --filter @workspace/db db:generate
```

Expected: creates `packages/db/drizzle/` directory with a SQL migration file.

- [ ] **Step 4: Apply migration**

```bash
pnpm --filter @workspace/db db:migrate
```

Expected: "Applying migration..." — all 5 tables created (user, session, account, verification, plans).

- [ ] **Step 5: Commit**

```bash
git add packages/db/drizzle.config.ts packages/db/drizzle/ packages/db/package.json pnpm-lock.yaml
git commit -m "feat: add Drizzle config and initial migration"
```

---

## Chunk 2: Auth infrastructure

### Task 4: Better Auth server config

**Files:**
- Create: `apps/web/lib/auth.ts`
- Modify: `apps/web/package.json` — add `better-auth` and `resend` deps

**Prerequisites:** In `apps/web/.env.local`, set:
```
BETTER_AUTH_SECRET=<random 32+ char string, e.g. run: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
RESEND_API_KEY=<from resend.com>
```

For Google: Go to [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID → Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (add your prod URL too when deploying).

- [ ] **Step 1: Add deps to `apps/web/package.json`**

In `apps/web/package.json`, add to `"dependencies"`:
```json
"better-auth": "^1.0.0",
"resend": "^4.0.0"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

- [ ] **Step 3: Create `apps/web/lib/auth.ts`**

```typescript
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { Resend } from "resend"
import { db } from "@workspace/db"
import * as schema from "@workspace/db/schema"

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: "Athloryx <noreply@athloryx.com>",
          to: email,
          subject: "Sign in to Athloryx",
          html: `<p>Click the link below to sign in to Athloryx:</p><p><a href="${url}">${url}</a></p>`,
        })
      },
    }),
  ],
})
```

Note: Replace `noreply@athloryx.com` with a domain you've verified in Resend. For local testing, Resend allows sending to your own email from any `from` address.

Wait — the exports map in `packages/db/package.json` only exports `"."`. We need to also export `"./schema"` for the `import * as schema from "@workspace/db/schema"` to work. Update `packages/db/package.json`:

- [ ] **Step 4: Add `./schema` export to `packages/db/package.json`**

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts"
  }
}
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/package.json packages/db/package.json pnpm-lock.yaml
git commit -m "feat: add Better Auth server config with Google OAuth and magic link"
```

---

### Task 5: Better Auth client

**Files:**
- Create: `apps/web/lib/auth-client.ts`

- [ ] **Step 1: Create `apps/web/lib/auth-client.ts`**

```typescript
import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
})
```

No `baseURL` needed — Better Auth defaults to `window.location.origin` in the browser and reads `BETTER_AUTH_URL` on the server.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/auth-client.ts
git commit -m "feat: add Better Auth client with magic link plugin"
```

---

### Task 6: Better Auth catch-all route handler

**Files:**
- Create: `apps/web/app/api/auth/[...all]/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/auth/[...all]/route.ts`**

```typescript
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Smoke test**

```bash
pnpm dev
```

Visit `http://localhost:3000/api/auth/session` in your browser.

Expected: `{"session":null}` — the endpoint responds (not a 404).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/auth/
git commit -m "feat: add Better Auth catch-all route handler"
```

---

## Chunk 3: Save plan UI

### Task 7: POST /api/plans route

**Files:**
- Create: `apps/web/app/api/plans/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/plans/route.ts`**

```typescript
import { type NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import type { PlanGenerationInput, WorkoutDay } from "@workspace/ai"

interface SavePlanBody {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: SavePlanBody
  try {
    body = (await req.json()) as SavePlanBody
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.input || !body.days?.length || !body.totalWeeks) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const name =
    body.input.goal === "race" && body.input.race?.name
      ? body.input.race.name
      : "Aerobic Base Plan"

  const [saved] = await db
    .insert(plans)
    .values({
      userId: session.user.id,
      goal: body.input.goal,
      name,
      input: body.input,
      days: body.days,
      totalWeeks: body.totalWeeks,
      totalKm: String(body.totalKm),
      peakWeekKm: String(body.peakWeekKm),
    })
    .returning({ id: plans.id })

  return Response.json({ id: saved?.id })
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/plans/route.ts
git commit -m "feat: add POST /api/plans route to save training plan"
```

---

### Task 8: SavePlanButton component

**Files:**
- Create: `apps/web/app/plan/save-plan-button.tsx`

- [ ] **Step 1: Create `apps/web/app/plan/save-plan-button.tsx`**

```tsx
"use client"

import { Check, Loader2, BookmarkPlus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

interface SavePlanButtonProps {
  status: "generating" | "complete" | "error"
  isSaving: boolean
  isSaved: boolean
  saveError: boolean
  onSave: () => void
  className?: string
}

export function SavePlanButton({
  status,
  isSaving,
  isSaved,
  saveError,
  onSave,
  className,
}: SavePlanButtonProps) {
  if (status !== "complete") return null

  if (isSaved) {
    return (
      <Button variant="ghost" disabled className={`gap-2 text-primary ${className ?? ""}`}>
        <Check className="h-4 w-4" />
        Saved
      </Button>
    )
  }

  if (isSaving) {
    return (
      <Button disabled className={`gap-2 ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving…
      </Button>
    )
  }

  return (
    <Button onClick={onSave} className={`gap-2 ${className ?? ""}`}>
      <BookmarkPlus className="h-4 w-4" />
      {saveError ? "Save failed — retry" : "Save Plan"}
    </Button>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/save-plan-button.tsx
git commit -m "feat: add SavePlanButton component with 4 states"
```

---

### Task 9: SignInSheet component

**Files:**
- Create: `apps/web/app/plan/sign-in-sheet.tsx`

- [ ] **Step 1: Create `apps/web/app/plan/sign-in-sheet.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { authClient } from "@/lib/auth-client"

interface SignInSheetProps {
  onBeforeSignIn: () => void
  onClose: () => void
}

type SheetState = "options" | "email" | "sent" | "error"

export function SignInSheet({ onBeforeSignIn, onClose }: SignInSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>("options")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  async function handleGoogle() {
    onBeforeSignIn()
    await authClient.signIn.social({ provider: "google", callbackURL: "/plan" })
  }

  async function handleMagicLink() {
    if (!email) return
    onBeforeSignIn() // persist plan state before magic link redirect
    setLoading(true)
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: "/plan",
    })
    setLoading(false)
    if (error) {
      setErrorMessage(error.message ?? "Something went wrong. Please try again.")
      setSheetState("error")
    } else {
      setSheetState("sent")
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-xl bg-card border-t border-border p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />

        {sheetState === "options" && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Save your plan</h2>
              <p className="text-sm text-muted-foreground">
                Sign in to save and access your plan anytime.
              </p>
            </div>
            <Button className="w-full" onClick={handleGoogle}>
              Continue with Google
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSheetState("email")}
            >
              Continue with email
            </Button>
          </>
        )}

        {sheetState === "email" && (
          <>
            <button
              onClick={() => setSheetState("options")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              ← Back
            </button>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Enter your email</h2>
              <p className="text-sm text-muted-foreground">
                We'll send you a sign-in link.
              </p>
            </div>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleMagicLink() }}
              autoFocus
            />
            <Button
              className="w-full gap-2"
              onClick={() => void handleMagicLink()}
              disabled={!email || loading}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send link
            </Button>
          </>
        )}

        {sheetState === "sent" && (
          <div className="space-y-2 py-2">
            <h2 className="text-lg font-semibold">Check your inbox</h2>
            <p className="text-sm text-muted-foreground">
              We sent a sign-in link to <span className="text-foreground">{email}</span>.
            </p>
          </div>
        )}

        {sheetState === "error" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Something went wrong</h2>
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSheetState("options")}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/sign-in-sheet.tsx
git commit -m "feat: add SignInSheet bottom sheet with Google OAuth and magic link"
```

---

### Task 10: Wire page.tsx — session, save state, sessionStorage

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

Read the current file first. The existing file has `SESSION_KEY = "athloryx_onboarding"` and a streaming useEffect. We're adding:

1. A `PLAN_KEY = "athloryx_plan"` constant for post-OAuth plan restoration
2. Save state: `isSaving`, `isSaved`, `saveError`, `showSignInSheet`
3. Session detection via `authClient.useSession()`
4. `handleBeforeSignIn()` — writes plan to sessionStorage before OAuth redirect
5. `handleSave()` — checks session, opens sheet or POSTs to `/api/plans`
6. Post-OAuth restore logic in the mount effect

- [ ] **Step 1: Replace `apps/web/app/plan/page.tsx` with the following**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlanGenerationInput, TrainingPlan, WorkoutDay } from "@workspace/ai"
import { authClient } from "@/lib/auth-client"
import { PlanHeader } from "./plan-header"
import { PlanCalendar } from "./plan-calendar"
import { PlanFeed } from "./plan-feed"
import { SignInSheet } from "./sign-in-sheet"

const SESSION_KEY = "athloryx_onboarding"
const PLAN_KEY = "athloryx_plan"

interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
}

function mapToInput(raw: Record<string, unknown>): PlanGenerationInput | null {
  const goal = raw["goal"] as string | undefined
  const selectedDays = raw["selectedDays"] as string[] | undefined
  const longRunDay = raw["longRunDay"] as string | undefined
  const units = raw["units"] as "km" | "miles" | undefined

  if (!goal || !selectedDays?.length || !longRunDay || !units) return null
  if (goal !== "race" && goal !== "aerobic_base") return null

  const input: PlanGenerationInput = {
    goal,
    selectedDays,
    longRunDay,
    units,
    strengthTraining: Boolean(raw["strengthTraining"]),
    strengthDays: raw["strengthDays"] as string[] | undefined,
  }

  if (goal === "race" && raw["race"]) {
    const race = raw["race"] as Record<string, unknown>
    input.race = {
      name: String(race["name"] ?? ""),
      date: String(race["date"] ?? ""),
      distance: race["distance"] as "5k" | "10k" | "half" | "full" | "ultra",
      city: String(race["city"] ?? ""),
    }
  }

  if (raw["timeGoal"] === true && raw["goalTime"]) {
    const gt = raw["goalTime"] as Record<string, unknown>
    input.goalTime = {
      hours: Number(gt["hours"] ?? 0),
      minutes: Number(gt["minutes"] ?? 0),
    }
  }

  return input
}

function goalTimeLabel(input: PlanGenerationInput): string | undefined {
  if (!input.goalTime) return undefined
  const { hours, minutes } = input.goalTime
  return `${hours}:${minutes.toString().padStart(2, "0")}`
}

function planName(input: PlanGenerationInput): string {
  if (input.goal === "race" && input.race) return input.race.name
  return "Aerobic Base Plan"
}

export default function PlanPage() {
  const router = useRouter()
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  const [plan, setPlan] = useState<Partial<TrainingPlan>>({ days: [] })
  const [status, setStatus] = useState<"generating" | "complete" | "error">("generating")
  const [generatingWeek, setGeneratingWeek] = useState(1)
  const [input, setInput] = useState<PlanGenerationInput | null>(null)

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [showSignInSheet, setShowSignInSheet] = useState(false)

  // Refs to avoid stale closures inside the async stream loop
  const totalWeeksRef = useRef(0)
  const dayCountRef = useRef(0)
  const startDateRef = useRef<string | null>(null)
  const planRef = useRef<Partial<TrainingPlan>>({ days: [] })
  const streamStartedRef = useRef(false)

  // Keep planRef in sync with plan state for use in callbacks
  useEffect(() => { planRef.current = plan }, [plan])

  // ── Auto-save after OAuth redirect ────────────────────────────────────────
  // When the user returns from a Google OAuth redirect, they will be signed in
  // and athloryx_plan will be in sessionStorage (written by handleBeforeSignIn).
  useEffect(() => {
    if (!sessionData?.session) return
    const raw = sessionStorage.getItem(PLAN_KEY)
    if (!raw) return

    let snapshot: SavedPlanSnapshot
    try {
      snapshot = JSON.parse(raw) as SavedPlanSnapshot
    } catch {
      sessionStorage.removeItem(PLAN_KEY)
      return
    }

    // Guard: don't restore stale sessionStorage from a previous visit
    // if a stream is already in progress (totalWeeksRef.current > 0)
    if (totalWeeksRef.current > 0) {
      sessionStorage.removeItem(PLAN_KEY)
      return
    }

    sessionStorage.removeItem(PLAN_KEY)

    // Restore plan state from snapshot and trigger save
    setInput(snapshot.input)
    setPlan({
      days: snapshot.days,
      totalWeeks: snapshot.totalWeeks,
      totalKm: snapshot.totalKm,
      peakWeekKm: snapshot.peakWeekKm,
    })
    setStatus("complete")
    totalWeeksRef.current = snapshot.totalWeeks

    void savePlanToServer(snapshot.input, snapshot.days, snapshot.totalWeeks, snapshot.totalKm, snapshot.peakWeekKm)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.session?.id])

  // ── Streaming ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) { router.replace("/"); return }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      router.replace("/")
      return
    }

    const mapped = mapToInput(parsed)
    if (!mapped) { router.replace("/"); return }
    setInput(mapped)

    // Prevent double-execution when sessionPending changes
    if (streamStartedRef.current) return

    // If athloryx_plan exists in sessionStorage, we may be returning from OAuth.
    // Wait until session state is resolved before deciding.
    if (sessionStorage.getItem(PLAN_KEY)) {
      if (sessionPending) return // wait — re-effect runs when sessionPending changes
      if (sessionData?.session) return // session confirmed, auto-save effect handles it
      // Session resolved to null (e.g., magic link opened in different browser).
      // Clear stale PLAN_KEY and fall through to stream normally.
      sessionStorage.removeItem(PLAN_KEY)
    }

    streamStartedRef.current = true

    async function stream() {
      let response: Response
      try {
        response = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mapped),
        })
      } catch {
        setStatus("error")
        return
      }

      if (!response.ok || !response.body) {
        setStatus("error")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        let done: boolean
        let value: Uint8Array | undefined
        try {
          ;({ done, value } = await reader.read())
        } catch {
          setStatus("error")
          return
        }

        if (done) {
          if (totalWeeksRef.current === 0 || dayCountRef.current === 0) {
            setStatus("error")
          } else {
            setStatus("complete")
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>

            if ("error" in parsed) {
              setStatus("error")
              break
            } else if (parsed["_meta"] === true) {
              const tw = Number(parsed["totalWeeks"] ?? 0)
              totalWeeksRef.current = tw
              setPlan((p) => ({
                ...p,
                totalWeeks: tw,
                totalKm: Number(parsed["totalKm"] ?? 0),
                peakWeekKm: Number(parsed["peakWeekKm"] ?? 0),
              }))
            } else {
              const day = parsed as unknown as WorkoutDay
              dayCountRef.current += 1
              if (!startDateRef.current) startDateRef.current = day.date
              const weekNum =
                Math.floor(
                  (new Date(day.date).getTime() - new Date(startDateRef.current).getTime()) /
                    (7 * 24 * 60 * 60 * 1000)
                ) + 1
              setGeneratingWeek(weekNum)
              setPlan((p) => {
                const existing = p.days ?? []
                const idx = existing.findIndex((d) => d.date === day.date)
                const days = idx >= 0
                  ? existing.map((d, i) => (i === idx ? day : d))
                  : [...existing, day]
                return { ...p, days }
              })
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    void stream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPending]) // re-run when session loading state resolves

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function savePlanToServer(
    planInput: PlanGenerationInput,
    days: WorkoutDay[],
    totalWeeks: number,
    totalKm: number,
    peakWeekKm: number,
  ) {
    setIsSaving(true)
    setSaveError(false)
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: planInput, days, totalWeeks, totalKm, peakWeekKm }),
      })
      if (!res.ok) throw new Error("Save failed")
      setIsSaved(true)
    } catch {
      setSaveError(true)
    } finally {
      setIsSaving(false)
    }
  }

  function handleBeforeSignIn() {
    const current = planRef.current
    if (!input) return
    const snapshot: SavedPlanSnapshot = {
      input,
      days: current.days ?? [],
      totalWeeks: current.totalWeeks ?? 0,
      totalKm: current.totalKm ?? 0,
      peakWeekKm: current.peakWeekKm ?? 0,
    }
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(snapshot))
  }

  function handleSave() {
    if (isSaved || isSaving) return
    if (!sessionData?.session) {
      setShowSignInSheet(true)
      return
    }
    const current = planRef.current
    if (!input || !current.days?.length) return
    void savePlanToServer(
      input,
      current.days,
      current.totalWeeks ?? 0,
      current.totalKm ?? 0,
      current.peakWeekKm ?? 0,
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!input) return null  // redirecting

  const saveProps = { status, isSaving, isSaved, saveError, onSave: handleSave }

  return (
    <main className="min-h-svh flex flex-col">
      <PlanHeader
        planName={planName(input)}
        totalWeeks={plan.totalWeeks ?? 0}
        totalKm={plan.totalKm ?? 0}
        units={input.units}
        status={status}
        generatingWeek={generatingWeek}
        goalTimeLabel={goalTimeLabel(input)}
        saveProps={saveProps}
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
          saveProps={saveProps}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
          saveProps={saveProps}
        />
      </div>

      {showSignInSheet && (
        <SignInSheet
          onBeforeSignIn={handleBeforeSignIn}
          onClose={() => setShowSignInSheet(false)}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 2: Run typecheck** (will have errors — fix in next tasks)

```bash
pnpm typecheck
```

Expected: errors about `saveProps` prop not existing on `PlanHeader`, `PlanCalendar`, `PlanFeed`. These are fixed in Task 11.

- [ ] **Step 3: Commit (even with type errors — Task 11 fixes them)**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "feat: wire page.tsx with session detection and save flow"
```

---

### Task 11: Wire save button into PlanHeader, PlanFeed, PlanCalendar

**Files:**
- Modify: `apps/web/app/plan/plan-header.tsx`
- Modify: `apps/web/app/plan/plan-feed.tsx`
- Modify: `apps/web/app/plan/plan-calendar.tsx`

The `saveProps` object passed from `page.tsx` has shape:
```typescript
interface SaveProps {
  status: "generating" | "complete" | "error"
  isSaving: boolean
  isSaved: boolean
  saveError: boolean
  onSave: () => void
}
```

**`plan-header.tsx` changes:** Accept `saveProps?: SaveProps` prop. When `status === "complete"`, render `<SavePlanButton>` in place of the generating indicator.

- [ ] **Step 1: Update `apps/web/app/plan/plan-header.tsx`**

Read the current file first. Add `saveProps` to the interface and import `SavePlanButton`.

Replace the file with:

```tsx
"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { formatDistance, distanceUnit } from "./workout-utils"
import { SavePlanButton } from "./save-plan-button"

interface SaveProps {
  status: "generating" | "complete" | "error"
  isSaving: boolean
  isSaved: boolean
  saveError: boolean
  onSave: () => void
}

interface PlanHeaderProps {
  planName: string
  totalWeeks: number
  totalKm: number
  units: "km" | "miles"
  status: "generating" | "complete" | "error"
  generatingWeek?: number
  goalTimeLabel?: string
  saveProps?: SaveProps
}

export function PlanHeader({
  planName,
  totalWeeks,
  totalKm,
  units,
  status,
  generatingWeek,
  goalTimeLabel,
  saveProps,
}: PlanHeaderProps) {
  const totalDisplay = formatDistance(totalKm, units)
  const unit = distanceUnit(units)

  return (
    <div className="border-b border-border">
      {/* Nav row */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        <div className="flex items-center gap-2">
          {goalTimeLabel && (
            <span className="rounded-sm border border-primary/20 bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
              Goal {goalTimeLabel}
            </span>
          )}
          {saveProps && (
            <SavePlanButton
              status={saveProps.status}
              isSaving={saveProps.isSaving}
              isSaved={saveProps.isSaved}
              saveError={saveProps.saveError}
              onSave={saveProps.onSave}
            />
          )}
        </div>
      </div>

      {/* Plan info row */}
      <div className="px-4 pb-4 space-y-3">
        <h1 className="text-xl font-semibold tracking-tight truncate">{planName}</h1>

        <div className="flex items-center gap-6">
          <div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              {totalWeeks > 0 ? totalWeeks : "—"}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
              Weeks
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {totalKm > 0 ? totalDisplay : "—"}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
              Total {unit}
            </p>
          </div>
        </div>

        {status === "generating" && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <p className="text-xs text-muted-foreground">
              Generating week {generatingWeek}
              {totalWeeks > 0 ? ` of ${totalWeeks}` : ""}…
            </p>
          </div>
        )}

        {status === "error" && (
          <p className="text-xs text-destructive">
            Generation failed — please go back and try again.
          </p>
        )}
      </div>
    </div>
  )
}
```

**`plan-feed.tsx` changes:** Accept `saveProps?: SaveProps` and render `<SavePlanButton>` inside `<div className="px-4 pb-24 space-y-2">`, after the `weeks.map(...)` block but before the closing `</div>` of that div (and before the `{selectedDay && ...}` sheet overlay that follows).

- [ ] **Step 2: Update `apps/web/app/plan/plan-feed.tsx`**

Read the current file. Add to the `PlanFeedProps` interface:
```typescript
saveProps?: SaveProps
```

Add the `SaveProps` interface (same shape as in plan-header.tsx) and add `SavePlanButton` to the imports.

Locate the `})}` that ends `weeks.map(...)` (line ~150) followed immediately by `</div>` (which closes `px-4 pb-24 space-y-2`). Insert the save button between those two lines:

```tsx
        {/* end of weeks.map */}
        {saveProps && (
          <div className="pt-4 pb-2">
            <SavePlanButton
              status={saveProps.status}
              isSaving={saveProps.isSaving}
              isSaved={saveProps.isSaved}
              saveError={saveProps.saveError}
              onSave={saveProps.onSave}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Bottom sheet overlay for detail */}
      {selectedDay && (
```

**`plan-calendar.tsx` changes:** Accept `saveProps?: SaveProps` and render `<SavePlanButton>` inside `<div className="flex-1 overflow-auto p-4">`, after the `weeks.map(...)` block but before the closing `</div>` of that div (and before the detail side panel that follows).

- [ ] **Step 3: Update `apps/web/app/plan/plan-calendar.tsx`**

Read the current file. Add `saveProps?: SaveProps` to `PlanCalendarProps`. Add the same `SaveProps` interface and `SavePlanButton` import.

Locate the `})}` that ends `weeks.map(...)` (line ~155) followed immediately by `</div>` (which closes `flex-1 overflow-auto p-4`). Insert between those two lines:

```tsx
        {/* end of weeks.map */}
        {saveProps && (
          <div className="pt-4 pb-4">
            <SavePlanButton
              status={saveProps.status}
              isSaving={saveProps.isSaving}
              isSaved={saveProps.isSaved}
              saveError={saveProps.saveError}
              onSave={saveProps.onSave}
            />
          </div>
        )}
      </div>

      {/* Detail side panel */}
      <div className="w-72 border-l border-border bg-card overflow-y-auto flex-shrink-0">
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/plan-header.tsx apps/web/app/plan/plan-feed.tsx apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: add Save Plan button to header, feed, and calendar"
```

- [ ] **Step 6: End-to-end manual test**

```bash
pnpm dev
```

1. Complete onboarding → plan generates
2. Verify "Save Plan" button appears in header and at bottom of feed/calendar only after generation completes
3. Click "Save Plan" without being signed in → SignInSheet slides up
4. Click "Continue with Google" → OAuth flow → returns to `/plan` → plan restored → auto-saves
5. Button shows "Saved ✓"
6. Reload page → plan re-generates → "Save Plan" button available again (existing save is unlinked — no duplicate save guard needed at this stage)

- [ ] **Step 7: Push**

```bash
git push
```
