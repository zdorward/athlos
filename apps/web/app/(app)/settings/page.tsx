"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const { data: sessionData } = authClient.useSession()
  const user = sessionData?.user

  // Cast to include the additional `units` field from Better Auth additionalFields config
  const currentUnits = (user as { units?: "km" | "miles" } | undefined)?.units ?? "km"
  const [units, setUnits] = useState<"km" | "miles">(currentUnits)
  const [saving, setSaving] = useState(false)

  async function handleUnitsChange(value: "km" | "miles") {
    if (value === units) return
    setUnits(value)
    setSaving(true)
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: value }),
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* Preferences */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Preferences
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Distance units</p>
            {saving && (
              <p className="text-xs text-muted-foreground">Saving…</p>
            )}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["km", "miles"] as const).map((value) => (
              <button
                key={value}
                onClick={() => void handleUnitsChange(value)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  units === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Account */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Account
        </h2>

        <div className="space-y-1">
          {user?.name && (
            <p className="text-sm font-medium">{user.name}</p>
          )}
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <Button variant="outline" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
      </section>
    </div>
  )
}
