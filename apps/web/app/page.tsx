"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { Wordmark } from "@/components/wordmark"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Loader2, CalendarIcon } from "lucide-react"
import { format, parseISO } from "date-fns"
import { authClient } from "@/lib/auth-client"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { SignInSheet } from "@/app/plan/sign-in-sheet"
import { RACES, type Race } from "@/data/races"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  DISTANCE_LABELS,
  type Distance,
  type OnboardingData,
  type RaceData,
} from "@/components/onboarding/types"

// ── Plan preview mock data ──────────────────────────────────────────────────

type WorkoutType = "easy" | "tempo" | "long" | "strength" | "rest"

// ── Plan preview color system (matches workout-utils.ts) ──────────────────
type WorkoutStyle = { color: string; bg?: string; border?: string }

const WORKOUT_STYLES: Record<WorkoutType, WorkoutStyle | null> = {
  easy:     { color: "rgba(255,255,255,0.55)" },
  tempo:    { color: "oklch(0.78 0.15 80 / 0.9)" },
  long:     { color: "rgba(147,197,253,0.85)", bg: "rgba(80,130,255,0.07)", border: "rgba(100,160,255,0.2)" },
  strength: { color: "oklch(0.65 0.15 300 / 0.85)" },
  rest:     null,
}

type MockDay = {
  day: string
  date: number
  type: WorkoutType
  title: string
  sub: string
  extra?: string
}

const MOCK_WEEKS = [
  {
    label: "W1", date: "Mar 16", km: "54 km", phase: "Base",
    days: [
      { day: "Mon", date: 16, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Tue", date: 17, type: "strength" as WorkoutType, title: "Strength",  sub: "" },
      { day: "Wed", date: 18, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Thu", date: 19, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "6 km", extra: "strength" },
      { day: "Fri", date: 20, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Sat", date: 21, type: "rest"     as WorkoutType, title: "",          sub: "" },
      { day: "Sun", date: 22, type: "long"     as WorkoutType, title: "Long Run",  sub: "12 km" },
    ] as MockDay[],
  },
  {
    label: "W2", date: "Mar 23", km: "56 km", phase: null,
    days: [
      { day: "Mon", date: 23, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Tue", date: 24, type: "strength" as WorkoutType, title: "Strength",  sub: "" },
      { day: "Wed", date: 25, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Thu", date: 26, type: "tempo"    as WorkoutType, title: "Tempo Run", sub: "8 km" },
      { day: "Fri", date: 27, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Sat", date: 28, type: "strength" as WorkoutType, title: "Strength",  sub: "" },
      { day: "Sun", date: 29, type: "long"     as WorkoutType, title: "Long Run",  sub: "14 km" },
    ] as MockDay[],
  },
]

// ── Page ───────────────────────────────────────────────────────────────────

export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  )
}

function PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNewPlan = searchParams.get("new") === "1"
  const { data: sessionData, isPending } = authClient.useSession()
  const [showOnboarding, setShowOnboarding] = useState(isNewPlan)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [initialData, setInitialData] = useState<Partial<OnboardingData> | undefined>()
  const [query, setQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPending && sessionData?.session && !isNewPlan) {
      router.replace("/dashboard")
    }
  }, [isPending, sessionData?.session, isNewPlan, router])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  if (isPending || (sessionData?.session && !isNewPlan)) {
    return (
      <main style={{ display: "flex", minHeight: "100svh", alignItems: "center", justifyContent: "center", background: "#020208" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
      </main>
    )
  }

  if (showOnboarding) {
    return (
      <main className="min-h-svh">
        <OnboardingFlow onExit={() => setShowOnboarding(false)} initialData={initialData} />
      </main>
    )
  }

  const filtered =
    query.trim() === ""
      ? RACES
      : RACES.filter((r) => {
          const q = query.toLowerCase()
          return (
            r.name.toLowerCase().includes(q) ||
            r.city.toLowerCase().includes(q) ||
            r.province.toLowerCase().includes(q)
          )
        })

  function handleRaceSelect(race: Race) {
    const raceData: RaceData = {
      name: race.name,
      city: `${race.city}, ${race.province}`,
      date: parseISO(race.date),
      distance: race.distance,
    }
    setInitialData({ goal: "race", race: raceData })
    setShowOnboarding(true)
  }

  function handleManualRaceSubmit(raceData: RaceData) {
    setInitialData({ goal: "race", race: raceData })
    setShowManualEntry(false)
    setShowOnboarding(true)
  }

  const isOpen = dropdownOpen || query.trim() !== ""

  return (
    <>
      <style>{`
        @keyframes bloom-1 {
          0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          33%  { transform: translate(6%, 8%) scale(1.15) rotate(15deg); }
          66%  { transform: translate(-4%, 3%) scale(0.95) rotate(-8deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes bloom-2 {
          0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          40%  { transform: translate(-8%, -5%) scale(1.1) rotate(-20deg); }
          70%  { transform: translate(5%, 6%) scale(1.05) rotate(10deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes bloom-3 {
          0%   { transform: translate(0%, 0%) scale(1); }
          50%  { transform: translate(4%, -6%) scale(1.08); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
      `}</style>

      <main style={{ background: "#020208" }}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", height: "100svh", overflow: "hidden" }}>
          {/* Dot grid */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(80,100,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(80,100,255,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />

          {/* Aurora blooms */}
          <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", width: "70vw", height: "60vh", top: "-15vh", left: "-10vw", background: "radial-gradient(ellipse, rgba(30,55,200,0.22) 0%, transparent 70%)", animation: "bloom-1 28s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", width: "60vw", height: "55vh", bottom: "-10vh", right: "-5vw", background: "radial-gradient(ellipse, rgba(15,80,180,0.18) 0%, transparent 70%)", animation: "bloom-2 34s ease-in-out infinite alternate" }} />
          <div style={{ position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none", width: "50vw", height: "45vh", top: "20vh", left: "25vw", background: "radial-gradient(ellipse, rgba(40,40,160,0.12) 0%, transparent 65%)", animation: "bloom-3 22s ease-in-out infinite alternate" }} />

          {/* Vignette */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 75% 75% at 50% 48%, transparent 20%, rgba(1,1,8,0.7) 100%)" }} />

          {/* Nav */}
          <nav style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "24px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
            <Wordmark className="text-white/85" />
            <button
              onClick={() => setShowSignIn(true)}
              style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 18px", background: "none", cursor: "pointer" }}
            >
              Log in
            </button>
          </nav>

          {/* Hero content */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, zIndex: 5, textAlign: "center", padding: "0 24px", paddingBottom: "14vh" }}>
            <h1 style={{ fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1.0, margin: 0 }}>
              When&apos;s your next race?
            </h1>

            <p style={{ fontSize: 15, margin: 0, color: "rgba(255,255,255,0.38)", letterSpacing: "0.01em" }}>
              Adaptive race training for runners who lift.
            </p>

            {/* Search widget */}
            <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 480 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, height: 56, padding: "0 18px", background: "rgba(255,255,255,0.05)", border: `1px solid ${isOpen ? "rgba(100,140,255,0.35)" : "rgba(255,255,255,0.12)"}`, borderRadius: isOpen ? "14px 14px 0 0" : 14, backdropFilter: "blur(12px)" }}>
                <Search style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, width: 16, height: 16 }} />
                <input
                  placeholder="Search races by name or city…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 16, color: "rgba(255,255,255,0.85)", fontFamily: "inherit", letterSpacing: "0.01em" }}
                />
              </div>

              {isOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: "rgba(8,8,20,0.95)", border: "1px solid rgba(100,140,255,0.25)", borderTop: "none", borderBottomLeftRadius: 14, borderBottomRightRadius: 14, backdropFilter: "blur(20px)", overflow: "hidden" }}>
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {filtered.length > 0 ? (
                      filtered.map((race) => (
                        <DropdownRaceRow key={race.id} race={race} onSelect={handleRaceSelect} />
                      ))
                    ) : (
                      <div style={{ padding: "12px 18px", fontSize: 13, color: "rgba(255,255,255,0.32)" }}>
                        No races found for &ldquo;{query}&rdquo;
                      </div>
                    )}
                  </div>
                  <ManualEntryFooter onSelect={() => setShowManualEntry(true)} />
                </div>
              )}
            </div>

            {/* Friction copy */}
            <p style={{ fontSize: 12, margin: 0, color: "rgba(255,255,255,0.22)", letterSpacing: "0.02em" }}>
              Free &middot; No account needed &middot; Ready in 2 minutes
            </p>
          </div>

          {/* Scroll hint */}
          <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 5, pointerEvents: "none" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "0.06em", textTransform: "uppercase" }}>See how it works</span>
            <div style={{ width: 1, height: 28, background: "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)" }} />
          </div>
        </section>

        {/* ── Plan preview ──────────────────────────────────────────────── */}
        <section style={{ padding: "96px 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", margin: "0 0 12px" }}>
              Every week, mapped out.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", margin: 0, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
              Runs and lifts scheduled together — strength days placed where they won&apos;t wreck your key sessions.
            </p>
          </div>

          {/* Browser chrome mockup */}
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#0d1117" }}>
            {/* Chrome bar */}
            <div style={{ height: 40, background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {["rgba(255,95,87,0.6)", "rgba(255,189,46,0.6)", "rgba(39,201,63,0.6)"].map((c, i) => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                ))}
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.04)", padding: "3px 16px", borderRadius: 6 }}>
                  athlos.com/plan
                </span>
              </div>
            </div>

            {/* Plan header bar */}
            <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Toronto Waterfront Marathon</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>16 weeks · 42.2 km · Goal: 3:45</div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px" }}>
                Save Plan
              </div>
            </div>

            {/* Calendar */}
            <div style={{ padding: "0 16px 16px", overflowX: "auto", background: "#0d1117" }}>

              {/* Day of week header */}
              <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", gap: 3, padding: "8px 0 4px" }}>
                <div />
                {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)" }}>{d}</div>
                ))}
              </div>

              {MOCK_WEEKS.map((week, wi) => (
                <div key={wi}>
                  {/* Phase header — only shown when phase label is present */}
                  {week.phase && (
                    <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 3, padding: "4px 0 2px" }}>
                      <div />
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap" as const }}>{week.phase}</span>
                        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                      </div>
                    </div>
                  )}

                  {/* Week row */}
                  <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
                    {/* Week label */}
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: 4 }}>
                      <p style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", margin: 0 }}>{week.label}</p>
                      <p style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", margin: "1px 0 0" }}>{week.date}</p>
                      <p style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.35)", margin: "1px 0 0" }}>{week.km}</p>
                    </div>

                    {/* Day cells */}
                    {week.days.map((d) => {
                      const s = WORKOUT_STYLES[d.type]
                      const isRest = d.type === "rest"
                      return (
                        <div
                          key={d.day}
                          style={{
                            minHeight: 68,
                            borderRadius: 5,
                            border: `1px solid ${s?.border ?? (isRest ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)")}`,
                            background: s?.bg ?? (isRest ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)"),
                            padding: "5px 6px",
                            opacity: isRest ? 0.4 : 1,
                          }}
                        >
                          <p style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", margin: "0 0 2px" }}>{d.date}</p>
                          {s && (
                            <>
                              <p style={{ fontSize: 8, fontWeight: 600, color: s.color, margin: 0 }}>{d.title}</p>
                              {d.sub && <p style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", margin: "1px 0 0" }}>{d.sub}</p>}
                              {"extra" in d && d.extra === "strength" && (
                                <p style={{ fontSize: 7, color: "oklch(0.65 0.15 300 / 0.65)", margin: "2px 0 0" }}>+ Strength</p>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Fade-out hint */}
              <div style={{ marginTop: 8, height: 36, background: "linear-gradient(to bottom, transparent, #0d1117)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>16 weeks total</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2 style={{ fontSize: "clamp(22px, 3.5vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", margin: 0 }}>
              How it works
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {[
              {
                icon: "🔍",
                title: "Find your race",
                body: "Search from hundreds of races, or add your own.",
              },
              {
                icon: "⚙️",
                title: "Tell us about yourself",
                body: "Your goal time, weekly mileage, lifting days, and schedule.",
              },
              {
                icon: "📋",
                title: "Get your plan",
                body: "A personalized week-by-week plan built for runners who also lift.",
              },
            ].map((f) => (
              <div key={f.title} style={{ padding: 28, borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)", marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{f.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Founder note ─────────────────────────────────────────────── */}
        <section style={{ padding: "0 24px 96px", maxWidth: 540, margin: "0 auto" }}>
          <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "36px 32px" }}>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.58)", lineHeight: 1.75, fontStyle: "italic", margin: "0 0 16px" }}>
              &ldquo;I was training for the Victoria Marathon and chasing a PR. I didn&apos;t want to pay for Runna, so I was duct-taping ChatGPT and Google Sheets together. It worked, sort of &mdash; but I also lift, and no plan I found took both seriously. So I built one.&rdquo;
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", margin: 0 }}>
              &mdash; Zack, builder &amp; runner
            </p>
          </div>
        </section>

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <section style={{ padding: "0 24px 120px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", margin: "0 0 12px" }}>
            Ready to build your plan?
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", margin: "0 0 28px" }}>
            Pick your race above and you&apos;ll have a full plan in under 2 minutes.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "rgba(80,120,255,0.9)", border: "none", borderRadius: 12, padding: "14px 32px", cursor: "pointer" }}
          >
            Find my race
          </button>
        </section>

      </main>

      {showSignIn && (
        <SignInSheet onBeforeSignIn={() => {}} onClose={() => setShowSignIn(false)} callbackURL="/dashboard" />
      )}

      {showManualEntry && (
        <ManualRaceSheet onClose={() => setShowManualEntry(false)} onSubmit={handleManualRaceSubmit} />
      )}
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ManualRaceSheet({ onClose, onSubmit }: { onClose: () => void; onSubmit: (race: RaceData) => void }) {
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [distance, setDistance] = useState<Distance | undefined>(undefined)

  const isValid = name.trim() !== "" && city.trim() !== "" && date !== undefined && distance !== undefined

  function handleSubmit() {
    if (!isValid || !date || !distance) return
    onSubmit({ name: name.trim(), city: city.trim(), date, distance })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full rounded-t-xl bg-card border-t border-border p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Add your race</h2>
          <p className="text-sm text-muted-foreground">Can&apos;t find it in the list? Enter the details manually.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="manual-race-name">Race name</Label>
            <Input id="manual-race-name" placeholder="e.g. Boston Marathon" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-race-city">City</Label>
            <Input id="manual-race-city" placeholder="e.g. Boston, MA" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d <= new Date()} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Distance</Label>
              <Select value={distance} onValueChange={(v) => setDistance(v as Distance)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Distance" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(DISTANCE_LABELS) as [Distance, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={!isValid} className="w-full">Continue</Button>
      </div>
    </div>
  )
}

function ManualEntryFooter({ onSelect }: { onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "10px 18px", fontSize: 11, color: hovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center", cursor: "pointer" }}
    >
      Don&apos;t see yours? Add it manually →
    </div>
  )
}

function DropdownRaceRow({ race, onSelect }: { race: Race; onSelect: (r: Race) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="button"
      onClick={() => onSelect(race)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)", background: hovered ? "rgba(80,120,255,0.08)" : "transparent" }}
    >
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.82)" }}>{race.name}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
          {race.city}, {race.province} · {format(parseISO(race.date), "MMM d, yyyy")}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: "rgba(100,150,255,0.7)", background: "rgba(80,120,255,0.1)", border: "1px solid rgba(80,120,255,0.18)", borderRadius: 4, padding: "2px 7px", flexShrink: 0, marginLeft: 16 }}>
        {DISTANCE_LABELS[race.distance]}
      </span>
    </div>
  )
}
