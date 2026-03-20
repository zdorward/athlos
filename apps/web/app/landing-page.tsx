"use client"

import React, { Suspense, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { Wordmark } from "@/components/wordmark"
import { Search } from "lucide-react"
import type { Race } from "@/data/races/types"
import { useRaceSearch } from "@/hooks/use-race-search"
import {
  DISTANCE_LABELS,
  type OnboardingData,
  type RaceData,
} from "@/components/onboarding/types"
import { PlanPreview } from "./plan-preview"

const OnboardingFlow = dynamic(
  () =>
    import("@/components/onboarding/onboarding-flow").then((m) => ({
      default: m.OnboardingFlow,
    })),
  { ssr: false }
)
const SignInSheet = dynamic(
  () =>
    import("@/app/plan/sign-in-sheet").then((m) => ({
      default: m.SignInSheet,
    })),
  { ssr: false }
)
const ManualRaceSheet = dynamic(() =>
  import("./manual-race-sheet").then((m) => ({ default: m.ManualRaceSheet }))
)

export function LandingPage() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  )
}

function PageContent() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [initialData, setInitialData] = useState<
    Partial<OnboardingData> | undefined
  >()
  const [query, setQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { results, loading } = useRaceSearch(query)
  const wrapRef = useRef<HTMLDivElement>(null)

  const isOpen = dropdownOpen || query.trim() !== ""

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  useEffect(() => {
    if (isOpen) void import("./manual-race-sheet")
  }, [isOpen])

  function handleRaceSelect(race: Race) {
    const raceData: RaceData = {
      name: race.name,
      city: `${race.city}, ${race.region}`,
      date: new Date(race.date + "T12:00:00Z"),
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

  if (showOnboarding) {
    return (
      <main className="min-h-svh">
        <OnboardingFlow
          onExit={() => setShowOnboarding(false)}
          initialData={initialData}
        />
      </main>
    )
  }

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
        <section
          style={{ position: "relative", height: "100svh", overflow: "hidden" }}
        >
          {/* Dot grid */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(80,100,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(80,100,255,0.05) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* Aurora blooms */}
          <div
            style={{
              position: "absolute",
              borderRadius: "50%",
              filter: "blur(80px)",
              pointerEvents: "none",
              width: "70vw",
              height: "60vh",
              top: "-15vh",
              left: "-10vw",
              background:
                "radial-gradient(ellipse, rgba(30,55,200,0.22) 0%, transparent 70%)",
              animation: "bloom-1 28s ease-in-out infinite alternate",
              willChange: "transform",
            }}
          />
          <div
            style={{
              position: "absolute",
              borderRadius: "50%",
              filter: "blur(80px)",
              pointerEvents: "none",
              width: "60vw",
              height: "55vh",
              bottom: "-10vh",
              right: "-5vw",
              background:
                "radial-gradient(ellipse, rgba(15,80,180,0.18) 0%, transparent 70%)",
              animation: "bloom-2 34s ease-in-out infinite alternate",
              willChange: "transform",
            }}
          />
          <div
            style={{
              position: "absolute",
              borderRadius: "50%",
              filter: "blur(80px)",
              pointerEvents: "none",
              width: "50vw",
              height: "45vh",
              top: "20vh",
              left: "25vw",
              background:
                "radial-gradient(ellipse, rgba(40,40,160,0.12) 0%, transparent 65%)",
              animation: "bloom-3 22s ease-in-out infinite alternate",
              willChange: "transform",
            }}
          />

          {/* Vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "radial-gradient(ellipse 75% 75% at 50% 48%, transparent 20%, rgba(1,1,8,0.7) 100%)",
            }}
          />

          {/* Nav */}
          <nav
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "24px 36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 10,
            }}
          >
            <Wordmark className="text-white/85" />
            <button
              onClick={() => setShowSignIn(true)}
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.38)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "7px 18px",
                background: "none",
                cursor: "pointer",
              }}
            >
              Log in
            </button>
          </nav>

          {/* Hero content */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              zIndex: 5,
              textAlign: "center",
              padding: "0 24px",
              paddingBottom: "14vh",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(40px, 6vw, 64px)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.04em",
                lineHeight: 1.0,
                margin: 0,
              }}
            >
              Your marathon plan,
              <br />
              built on modern sports science.
            </h1>

            <p
              style={{
                fontSize: 15,
                margin: 0,
                color: "rgba(255,255,255,0.38)",
                letterSpacing: "0.01em",
              }}
            >
              Pfitzinger methodology. Personalized to your goal time and race
              date. Strength training included.
            </p>

            {/* Search widget */}
            <div
              ref={wrapRef}
              style={{ position: "relative", width: "100%", maxWidth: 480 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  height: 56,
                  padding: "0 18px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${isOpen ? "rgba(100,140,255,0.35)" : "rgba(255,255,255,0.12)"}`,
                  borderRadius: isOpen ? "14px 14px 0 0" : 14,
                  backdropFilter: "blur(12px)",
                }}
              >
                <Search
                  style={{
                    color: "rgba(255,255,255,0.3)",
                    flexShrink: 0,
                    width: 16,
                    height: 16,
                  }}
                />
                <input
                  placeholder="Search races by name or city…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    fontSize: 16,
                    color: "rgba(255,255,255,0.85)",
                    fontFamily: "inherit",
                    letterSpacing: "0.01em",
                  }}
                />
              </div>

              {isOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    background: "rgba(8,8,20,0.95)",
                    border: "1px solid rgba(100,140,255,0.25)",
                    borderTop: "none",
                    borderBottomLeftRadius: 14,
                    borderBottomRightRadius: 14,
                    backdropFilter: "blur(20px)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {loading ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        Loading…
                      </p>
                    ) : results.length > 0 ? (
                      results.map((race) => (
                        <DropdownRaceRow
                          key={race.id}
                          race={race}
                          onSelect={handleRaceSelect}
                        />
                      ))
                    ) : (
                      <div
                        style={{
                          padding: "12px 18px",
                          fontSize: 13,
                          color: "rgba(255,255,255,0.32)",
                        }}
                      >
                        No races found for &ldquo;{query}&rdquo;
                      </div>
                    )}
                  </div>
                  <ManualEntryFooter
                    onSelect={() => setShowManualEntry(true)}
                  />
                </div>
              )}
            </div>

            <p
              style={{
                fontSize: 12,
                margin: 0,
                color: "rgba(74,222,128,0.55)",
                letterSpacing: "0.02em",
              }}
            >
              Free. No account required to start.
            </p>
          </div>

          {/* Scroll hint */}
          <div
            style={{
              position: "absolute",
              bottom: 28,
              left: 0,
              right: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              See how it works
            </span>
            <div
              style={{
                width: 1,
                height: 28,
                background:
                  "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)",
              }}
            />
          </div>
        </section>

        <PlanPreview />

        <PlanInputsSection />

        <ScienceSection />

        <FounderSection />

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <section style={{ padding: "0 24px 120px", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(24px, 3.5vw, 36px)",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.03em",
              margin: "0 0 12px",
            }}
          >
            Build your plan.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.32)",
              margin: "0 0 28px",
            }}
          >
            Pick your race and watch the magic happen.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "rgba(80,120,255,0.9)",
              border: "none",
              borderRadius: 12,
              padding: "14px 32px",
              cursor: "pointer",
            }}
          >
            Find my race
          </button>
        </section>
      </main>

      {showSignIn && (
        <SignInSheet
          onBeforeSignIn={() => {}}
          onClose={() => setShowSignIn(false)}
          callbackURL="/dashboard"
          title="Sign in to Athlos"
        />
      )}

      {showManualEntry && (
        <Suspense fallback={null}>
          <ManualRaceSheet
            onClose={() => setShowManualEntry(false)}
            onSubmit={handleManualRaceSubmit}
          />
        </Suspense>
      )}
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ManualEntryFooter({ onSelect }: { onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 18px",
        fontSize: 11,
        color: hovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center",
        cursor: "pointer",
      }}
    >
      Don&apos;t see yours? Add it manually →
    </div>
  )
}

function DropdownRaceRow({
  race,
  onSelect,
}: {
  race: Race
  onSelect: (r: Race) => void
}) {
  const [hovered, setHovered] = useState(false)
  const dateLabel = new Date(race.date + "T12:00:00Z").toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  )
  return (
    <div
      role="button"
      onClick={() => onSelect(race)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hovered ? "rgba(80,120,255,0.08)" : "transparent",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          {race.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.32)",
            marginTop: 2,
          }}
        >
          {race.city}, {race.region} · {dateLabel}
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "rgba(100,150,255,0.7)",
          background: "rgba(80,120,255,0.1)",
          border: "1px solid rgba(80,120,255,0.18)",
          borderRadius: 4,
          padding: "2px 7px",
          flexShrink: 0,
          marginLeft: 16,
        }}
      >
        {DISTANCE_LABELS[race.distance]}
      </span>
    </div>
  )
}

function FounderSection() {
  const [photoError, setPhotoError] = useState(false)

  return (
    <section
      style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
    >
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        {/* Flex row: photo column | text column */}
        <div
          style={{
            display: "flex",
            gap: 32,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          {/* Photo column */}
          <div
            style={{
              flexShrink: 0,
              minWidth: 120,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {photoError ? (
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                ZD
              </div>
            ) : (
              <Image
                src="/zack.jpg"
                alt="Zack"
                width={88}
                height={88}
                onError={() => setPhotoError(true)}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            )}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.88)",
                marginTop: 10,
              }}
            >
              Zack
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.32)",
                marginTop: 2,
              }}
            >
              Edmonton, AB
            </div>
          </div>

          {/* Text column */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(100,150,255,0.7)",
                marginBottom: 16,
              }}
            >
              Why I built this
            </div>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.55)",
                margin: "0 0 14px",
              }}
            >
              I ran my first marathon in September 2025 in{" "}
              <strong
                style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600 }}
              >
                3:52
              </strong>
              . I&apos;m trying to run{" "}
              <strong
                style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600 }}
              >
                3:20 at Victoria BC
              </strong>{" "}
              this year and I eventually want to qualify for Boston.
            </p>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.55)",
                margin: "0 0 14px",
              }}
            >
              I wanted a program that fit how I actually train. I was using
              ChatGPT for plans, Google Sheets for tracking, and I didn&apos;t
              want to pay for Runna.
            </p>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.55)",
                margin: 0,
              }}
            >
              I believe training plans should be free. Eventually, I do want to
              build out higher quality features like adaptive training.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            marginTop: 32,
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {[
            {
              value: "3:52",
              color: "rgba(255,255,255,0.88)",
              label: "First marathon · Sept 2025",
            },
            {
              value: "3:20",
              color: "rgba(100,150,255,0.9)",
              label: "Goal · Victoria BC 2026",
            },
            {
              value: "<2:55",
              color: "rgba(167,139,250,0.9)",
              label: "BQ goal · 2027",
            },
          ].map((stat, i) => (
            <div
              key={stat.value}
              style={{
                flex: 1,
                padding: "16px 20px",
                textAlign: "center",
                borderRight:
                  i < 2 ? "1px solid rgba(255,255,255,0.07)" : undefined,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.32)",
                  marginTop: 4,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Early access callout */}
        <div
          style={{
            marginTop: 20,
            padding: "14px 18px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.88)",
              }}
            >
              Early access
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
              I&apos;m looking for people to try this and tell me what&apos;s
              wrong with it. Please roast it.
            </div>
            <a
              href="mailto:zack@athlos.run"
              style={{
                fontSize: 12,
                color: "rgba(100,150,255,0.9)",
                textDecoration: "none",
              }}
            >
              zack@athlos.run
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function PlanInputsSection() {
  const inputs = [
    {
      label: "Weeks to race",
      title: "Defines your phase structure",
      body: "Determines how long each phase runs and how much time is available to build before the taper.",
    },
    {
      label: "Current weekly mileage",
      title: "Sets your volume ceiling",
      body: "Determines your starting point and how aggressively the plan can build.",
    },
    {
      label: "Goal time",
      title: "Sets your training load",
      body: "Sets your training intensity and marathon-pace volume. Faster goals mean more threshold work and higher mileage.",
    },
    {
      label: "Running days",
      title: "Determines session mix",
      body: "Sets how many sessions per week and which types fit in.",
    },
    {
      label: "Include strength training",
      title: "Kept in the picture",
      body: "Tell us whether you lift. Strength sessions are scheduled around your runs, not on quality days or adjacent to the long run.",
    },
  ]

  return (
    <section
      style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
    >
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h2
          style={{
            fontSize: "clamp(22px, 3.5vw, 36px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          How your plan is built
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.32)",
            margin: "8px 0 0",
          }}
        >
          Five inputs. Grounded in what actually predicts marathon performance.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {inputs.map((input, i) => (
          <div
            key={input.label}
            style={{
              display: "flex",
              gap: 20,
              alignItems: "flex-start",
              padding: "20px 0",
              borderBottom:
                i < inputs.length - 1
                  ? "1px solid rgba(255,255,255,0.06)"
                  : undefined,
            }}
          >
            {/* Circle number */}
            <div
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid rgba(100,150,255,0.3)",
                background: "rgba(100,150,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(100,150,255,0.8)",
                marginTop: 1,
              }}
            >
              {i + 1}
            </div>
            {/* Content */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "rgba(100,150,255,0.7)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                {input.label}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.88)",
                  marginBottom: 4,
                }}
              >
                {input.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.38)",
                  lineHeight: 1.6,
                }}
              >
                {input.body}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ScienceSection() {
  const phases = [
    {
      name: "General Fitness",
      focus:
        "Optional phase for 20+ week plans. Easy aerobic volume only — no quality sessions. Builds tissue tolerance before heavier training begins.",
      labelStyle: {
        background: "rgba(255,255,255,0.07)",
        color: "rgba(255,255,255,0.45)",
      },
    },
    {
      name: "Base",
      focus:
        "Aerobic foundation. Tempo runs introduce lactate threshold work. Easy volume builds the engine.",
      labelStyle: {
        background: "rgba(80,120,255,0.15)",
        color: "rgba(100,150,255,0.9)",
      },
    },
    {
      name: "Build",
      focus:
        "Early: tempo + VO2max intervals raise your ceiling. Late Build shifts toward marathon pace.",
      labelStyle: {
        background: "rgba(120,80,255,0.15)",
        color: "rgba(160,120,255,0.9)",
      },
    },
    {
      name: "Peak",
      focus:
        "Marathon-pace dominant. The final 6–8 weeks are the most race-specific of the entire plan.",
      labelStyle: {
        background: "rgba(255,120,50,0.15)",
        color: "rgba(255,150,80,0.9)",
      },
    },
    {
      name: "Taper",
      focus:
        "3 weeks. One light tempo session in Week 1. Full easy running from Week 2 through race day.",
      labelStyle: {
        background: "rgba(80,200,120,0.15)",
        color: "rgba(100,220,140,0.9)",
      },
    },
  ]

  return (
    <section
      style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
    >
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h2
          style={{
            fontSize: "clamp(22px, 3.5vw, 36px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          The Science
        </h2>
      </div>

      {/* Block 1 — Built on Pfitzinger, improved */}
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Built on Pfitzinger, improved
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.55)",
            marginTop: 6,
          }}
        >
          Pfitz is the gold standard for volume progression and phase structure.
          We keep what works and fix what doesn&apos;t.
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.38)",
            lineHeight: 1.6,
            marginTop: 8,
          }}
        >
          What we keep: the 10% progression rule, long run targets, recovery
          week cadence, and the Base → Build → Peak → Taper arc. What we change:
          intensity distribution is polarized (80% easy / 20% hard) to eliminate
          the gray-zone fatigue that Pfitz&apos;s medium-long runs create. Phase
          order is reversed — threshold work comes before VO2max in early
          phases, then marathon-pace dominates the final 6–8 weeks. And
          marathon-pace volume is dramatically higher than Pfitz prescribes (~14
          miles over 12 weeks). Modern coaching prescribes 5–10× that.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.2)",
            marginTop: 10,
          }}
        >
          Source: Pfitzinger &amp; Douglas, <em>Advanced Marathoning</em> (3rd
          ed.)
        </div>
      </div>

      {/* Block 2 — Training phases */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: 28,
          marginTop: 28,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Training phases
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.55)",
            marginTop: 6,
          }}
        >
          Five phases, each with a distinct purpose. The taper is always 3 weeks
          — everything else scales to your timeline.
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            marginTop: 16,
          }}
        >
          {phases.map((phase, i) => (
            <div
              key={phase.name}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: "0 16px",
                alignItems: "start",
                padding: "12px 0",
                ...(i < phases.length - 1
                  ? { borderBottom: "1px solid rgba(255,255,255,0.06)" }
                  : {}),
              }}
            >
              <div
                className="shrink-0 rounded text-xs font-semibold"
                style={{
                  ...phase.labelStyle,
                  width: "100%",
                  boxSizing: "border-box",
                  textAlign: "center",
                  padding: "5px 8px",
                }}
              >
                {phase.name}
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.55)",
                  paddingTop: 4,
                }}
              >
                {phase.focus}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Block 3 — Strength training */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: 28,
          marginTop: 28,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          Strength training is performance, not maintenance
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.55)",
            marginTop: 6,
          }}
        >
          A 2024 meta-analysis of 31 studies and 652 runners puts heavy
          resistance training on the same performance tier as lactate threshold
          work.
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.38)",
            lineHeight: 1.6,
            marginTop: 8,
          }}
        >
          Heavy resistance (≥80% 1RM) combined with plyometrics improves
          neuromuscular efficiency, tendon stiffness, and running economy. The
          effect size is meaningful (ES = −0.426). We schedule strength on easy
          run days, after the run, never adjacent to quality sessions or the
          long run. Volume tapers with the plan: 2×/week resistance in Base and
          Build, 1×/week in Peak, and zero from Taper Week 2 through race day.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.2)",
            marginTop: 10,
          }}
        >
          Source: Grgic et al., <em>Sports Medicine</em> 2024 — meta-analysis,
          31 studies, 652 runners (PMC11052887)
        </div>
      </div>
    </section>
  )
}
