"use client"

import { useMemo } from "react"

// ── Types ────────────────────────────────────────────────────────────────────

type WorkoutType = "easy" | "tempo" | "long" | "strength" | "rest" | "intervals"

type WorkoutStyle = { color: string; bg?: string; border?: string }

const WORKOUT_STYLES: Record<WorkoutType, WorkoutStyle | null> = {
  easy:           { color: "rgba(255,255,255,0.80)" },
  tempo:          { color: "oklch(0.78 0.15 80 / 0.9)" },
  long:           { color: "rgba(147,197,253,0.85)", bg: "rgba(80,130,255,0.07)", border: "rgba(100,160,255,0.2)" },
  strength:       { color: "oklch(0.65 0.15 300 / 0.85)" },
  rest:           null,
  intervals:      { color: "oklch(0.72 0.18 40 / 0.90)" },
}

type MockDay = {
  dayLabel: string   // "Mon", "Tue", etc. — filled in by buildMockWeeks()
  date: number       // day-of-month — filled in by buildMockWeeks()
  type: WorkoutType
  title: string      // full name, e.g. "Easy Run", "Rest Day"
  km: string         // "10 km", or "" for strength/rest
  desc: string       // subtitle for mobile list
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const WEEK_TEMPLATES: Array<{
  phase: string | null
  km: string
  days: Array<Pick<MockDay, "type" | "title" | "km" | "desc">>
}> = [
  {
    phase: "Base",
    km: "72 km",
    days: [
      { type: "easy",         title: "Easy Run",     km: "10 km", desc: "Easy aerobic run." },
      { type: "strength",     title: "Strength Training", km: "",      desc: "Strength training." },
      { type: "easy",         title: "Easy Run",     km: "12 km", desc: "Easy aerobic run." },
      { type: "easy",         title: "Easy Run",     km: "16 km", desc: "16 km easy run." },
      { type: "easy",         title: "Easy Run",     km: "10 km", desc: "Easy run with strides." },
      { type: "rest",         title: "Rest Day",     km: "",      desc: "" },
      { type: "long",         title: "Long Run",     km: "24 km", desc: "24 km long run at easy pace." },
    ],
  },
  {
    phase: null,
    km: "90 km",
    days: [
      { type: "easy",         title: "Easy Run",     km: "12 km", desc: "Easy recovery run." },
      { type: "intervals",    title: "Intervals",    km: "14 km", desc: "6 × 1 km at 5K pace." },
      { type: "strength",     title: "Strength Training", km: "",      desc: "Strength training." },
      { type: "easy",         title: "Easy Run",     km: "18 km", desc: "18 km easy run." },
      { type: "easy",         title: "Easy Run",     km: "10 km", desc: "Easy recovery run." },
      { type: "easy",         title: "Easy Run",     km: "8 km",  desc: "Easy shakeout run." },
      { type: "long",         title: "Long Run",     km: "28 km", desc: "28 km long run — last 8 km at marathon pace." },
    ],
  },
]

function buildMockWeeks() {
  const today = new Date()
  const day = today.getDay()                                    // 0 = Sun, 1 = Mon
  const daysToMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMonday)
  monday.setHours(0, 0, 0, 0)

  return WEEK_TEMPLATES.map((template, wi) => {
    const weekStart = new Date(monday)
    weekStart.setDate(monday.getDate() + wi * 7)
    const dateLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    return {
      label: `W${wi + 1}`,
      dateLabel,
      km: template.km,
      phase: template.phase,
      days: template.days.map((d, i) => {
        const date = new Date(weekStart)
        date.setDate(weekStart.getDate() + i)
        return { ...d, date: date.getDate(), dayLabel: DAY_SHORT[i] }
      }),
    }
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export function PlanPreview() {
  const mockWeeks = useMemo(buildMockWeeks, [])

  return (
    <section
      style={{
        padding: "96px 24px 80px",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <style>{`
        .mock-plan-desktop { display: block }
        .mock-plan-mobile  { display: none  }
        @media (max-width: 639px) {
          .mock-plan-desktop { display: none  }
          .mock-plan-mobile  { display: block }
        }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 40px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: "0 0 12px",
          }}
        >
          Every week, mapped out.
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.38)",
            margin: 0,
            maxWidth: 480,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Runs and strength sessions scheduled together — each placed where
          they won&apos;t wreck your key workouts.
        </p>
      </div>

      {/* Browser chrome mockup */}
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#0d1117",
        }}
      >
        {/* Chrome bar */}
        <div
          style={{
            height: 40,
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {[
              "rgba(255,95,87,0.6)",
              "rgba(255,189,46,0.6)",
              "rgba(39,201,63,0.6)",
            ].map((c, i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: c,
                }}
              />
            ))}
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <span
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.04)",
                padding: "3px 16px",
                borderRadius: 6,
              }}
            >
              athlos.com/plan
            </span>
          </div>
        </div>

        {/* Plan header bar */}
        <div
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0d1117",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Toronto Waterfront Marathon
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                marginTop: 2,
              }}
            >
              16 weeks · 42.2 km · Goal: 3:45
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "5px 12px",
            }}
          >
            Save Plan
          </div>
        </div>

        {/* Calendar */}
        <div
          style={{
            padding: "0 16px 16px",
            overflowX: "auto",
            background: "#0d1117",
          }}
        >
          {/* Desktop grid */}
          <div className="mock-plan-desktop">
            {/* Day-of-week header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "52px repeat(7, 1fr)",
                gap: 3,
                padding: "8px 0 4px",
              }}
            >
              <div />
              {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
                <div
                  key={d}
                  style={{
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {mockWeeks.map((week, wi) => (
              <div key={wi}>
                {/* Phase label — only when non-null */}
                {week.phase && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1fr",
                      gap: 3,
                      padding: "4px 0 2px",
                    }}
                  >
                    <div />
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase" as const,
                          letterSpacing: "0.12em",
                          color: "rgba(255,255,255,0.45)",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {week.phase}
                      </span>
                      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                    </div>
                  </div>
                )}

                {/* Week row */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px repeat(7, 1fr)",
                    gap: 3,
                    marginBottom: 3,
                  }}
                >
                  {/* Week label */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      paddingRight: 4,
                    }}
                  >
                    <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                      {week.label}
                    </p>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: "1px 0 0" }}>
                      {week.dateLabel}
                    </p>
                    <p style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.50)", margin: "1px 0 0" }}>
                      {week.km}
                    </p>
                  </div>

                  {/* Day cells */}
                  {week.days.map((d) => {
                    const s = WORKOUT_STYLES[d.type]
                    const isRest = d.type === "rest"
                    return (
                      <div
                        key={d.dayLabel}
                        style={{
                          minHeight: 60,
                          borderRadius: 4,
                          border: `1px solid ${s?.border ?? (isRest ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)")}`,
                          background: s?.bg ?? (isRest ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)"),
                          padding: "4px 5px",
                          opacity: isRest ? 0.4 : 1,
                        }}
                      >
                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: "0 0 2px" }}>
                          {d.date}
                        </p>
                        <p
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: s?.color ?? "rgba(255,255,255,0.55)",
                            margin: 0,
                          }}
                        >
                          {d.title}
                        </p>
                        {d.km && (
                          <p style={{ fontSize: 8, color: "rgba(255,255,255,0.40)", margin: "1px 0 0" }}>
                            {d.km}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Fade-out hint */}
            <div
              style={{
                marginTop: 8,
                height: 36,
                background: "linear-gradient(to bottom, transparent, #0d1117)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 4,
              }}
            >
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.30)" }}>16 weeks total</span>
            </div>
          </div>

          {/* Mobile list */}
          <div className="mock-plan-mobile">
            {mockWeeks.map((week, wi) => (
              <div key={wi}>
                {/* Week header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0 8px",
                  }}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0 }}>
                      {`Week ${wi + 1}`}{week.phase ? ` — ${week.phase}` : ""}
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>
                      {week.dateLabel}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 20,
                      padding: "3px 10px",
                      flexShrink: 0,
                    }}
                  >
                    {week.km}
                  </span>
                </div>

                {/* Day cards */}
                {week.days.map((d) => {
                  const s = WORKOUT_STYLES[d.type]
                  const isRest = d.type === "rest"
                  return (
                    <div
                      key={d.dayLabel}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "9px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        opacity: isRest ? 0.4 : 1,
                      }}
                    >
                      {/* Colored left bar */}
                      <div
                        style={{
                          width: 3,
                          alignSelf: "stretch",
                          borderRadius: 2,
                          background: isRest ? "rgba(255,255,255,0.12)" : (s?.color ?? "rgba(255,255,255,0.3)"),
                          marginRight: 12,
                          flexShrink: 0,
                          minHeight: 36,
                        }}
                      />
                      {/* Date + day */}
                      <div style={{ width: 36, flexShrink: 0 }}>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.85)",
                            margin: 0,
                            lineHeight: 1,
                          }}
                        >
                          {d.date}
                        </p>
                        <p
                          style={{
                            fontSize: 9,
                            color: "rgba(255,255,255,0.3)",
                            margin: "2px 0 0",
                            textTransform: "uppercase" as const,
                            letterSpacing: "0.05em",
                          }}
                        >
                          {d.dayLabel}
                        </p>
                      </div>
                      {/* Title + desc */}
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isRest ? "rgba(255,255,255,0.35)" : (s?.color ?? "rgba(255,255,255,0.55)"),
                            margin: 0,
                          }}
                        >
                          {d.title}
                        </p>
                        {d.desc && (
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>
                            {d.desc}
                          </p>
                        )}
                      </div>
                      {/* km */}
                      {d.km && (
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: s?.color ?? "rgba(255,255,255,0.4)",
                            flexShrink: 0,
                            margin: "0 0 0 8px",
                          }}
                        >
                          {d.km}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Fade-out */}
            <div
              style={{
                height: 28,
                background: "linear-gradient(to bottom, transparent, #0d1117)",
                marginTop: 4,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
