"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { authClient } from "@/lib/auth-client"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { SignInSheet } from "@/app/plan/sign-in-sheet"
import { RACES, type Race } from "@/data/races"
import { DISTANCE_LABELS, type OnboardingData, type RaceData } from "@/components/onboarding/types"

export default function Page() {
  const router = useRouter()
  const { data: sessionData, isPending } = authClient.useSession()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [initialData, setInitialData] = useState<Partial<OnboardingData> | undefined>()
  const [query, setQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPending && sessionData?.session) {
      router.replace("/dashboard")
    }
  }, [isPending, sessionData?.session, router])

  // Close dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  if (isPending || sessionData?.session) {
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

  function handleManualEntry() {
    setInitialData({ goal: "race", manualRaceEntry: true })
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

      <main style={{ position: "relative", width: "100vw", height: "100svh", overflow: "hidden", background: "#020208" }}>

        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(80,100,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(80,100,255,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Aurora blooms */}
        <div style={{
          position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
          width: "70vw", height: "60vh", top: "-15vh", left: "-10vw",
          background: "radial-gradient(ellipse, rgba(30,55,200,0.22) 0%, transparent 70%)",
          animation: "bloom-1 28s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
          width: "60vw", height: "55vh", bottom: "-10vh", right: "-5vw",
          background: "radial-gradient(ellipse, rgba(15,80,180,0.18) 0%, transparent 70%)",
          animation: "bloom-2 34s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
          width: "50vw", height: "45vh", top: "20vh", left: "25vw",
          background: "radial-gradient(ellipse, rgba(40,40,160,0.12) 0%, transparent 65%)",
          animation: "bloom-3 22s ease-in-out infinite alternate",
        }} />

        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 75% 75% at 50% 48%, transparent 20%, rgba(1,1,8,0.7) 100%)",
        }} />

        {/* Nav */}
        <nav style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "24px 36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 10,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.85)" }}>
            ATHLORYX
          </span>
          <button
            onClick={() => setShowSignIn(true)}
            style={{
              fontSize: 13, color: "rgba(255,255,255,0.38)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "7px 18px",
              background: "none", cursor: "pointer",
            }}
          >
            Log in
          </button>
        </nav>

        {/* Hero */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 24, zIndex: 5,
          textAlign: "center", padding: "0 24px",
        }}>
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 64px)",
            fontWeight: 700, color: "#fff",
            letterSpacing: "-0.04em", lineHeight: 1.0, margin: 0,
          }}>
            When&apos;s your<br />next race?
          </h1>

          {/* Search widget */}
          <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 480 }}>

            {/* Input box */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              height: 56, padding: "0 18px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${isOpen ? "rgba(100,140,255,0.35)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: isOpen ? "14px 14px 0 0" : 14,
              backdropFilter: "blur(12px)",
            }}>
              <Search style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, width: 16, height: 16 }} />
              <input
                placeholder="Search races by name or city…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setDropdownOpen(true)}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontSize: 15, color: "rgba(255,255,255,0.85)",
                  fontFamily: "inherit", letterSpacing: "0.01em",
                }}
              />
            </div>

            {/* Dropdown */}
            {isOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                background: "rgba(8,8,20,0.95)",
                border: "1px solid rgba(100,140,255,0.25)",
                borderTop: "none",
                borderBottomLeftRadius: 14,
                borderBottomRightRadius: 14,
                backdropFilter: "blur(20px)",
                overflow: "hidden",
              }}>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
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
                <ManualEntryFooter onSelect={handleManualEntry} />
              </div>
            )}
          </div>
        </div>

        {showSignIn && (
          <SignInSheet
            onBeforeSignIn={() => {}}
            onClose={() => setShowSignIn(false)}
            callbackURL="/dashboard"
          />
        )}
      </main>
    </>
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
      style={{
        padding: "10px 18px", fontSize: 11,
        color: hovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center", cursor: "pointer",
      }}
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
      style={{
        padding: "12px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hovered ? "rgba(80,120,255,0.08)" : "transparent",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.82)" }}>
          {race.name}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
          {race.city}, {race.province} · {format(parseISO(race.date), "MMM d, yyyy")}
        </div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
        color: "rgba(100,150,255,0.7)",
        background: "rgba(80,120,255,0.1)",
        border: "1px solid rgba(80,120,255,0.18)",
        borderRadius: 4, padding: "2px 7px",
        flexShrink: 0, marginLeft: 16,
      }}>
        {DISTANCE_LABELS[race.distance]}
      </span>
    </div>
  )
}
