"use client"

import { useState, useEffect } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const { data: sessionData } = authClient.useSession()
  const user = sessionData?.user

  // Cast to include the additional `units` field from Better Auth additionalFields config
  const currentUnits = (user as { units?: "km" | "miles" } | undefined)?.units ?? "km"
  const [pendingUnits, setPendingUnits] = useState<"km" | "miles" | null>(null)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState<"free" | "pro">("free")
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionData?.session) return
    fetch("/api/user")
      .then((r) => r.json())
      .then((data: { plan?: string }) => {
        if (data.plan === "pro") setPlan("pro")
      })
      .catch(() => {/* leave as free */})
  }, [sessionData?.session])

  async function handleUpgrade() {
    setBillingError(null)
    setLoadingBilling(true)
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" })
      const data = (await res.json()) as { url?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setBillingError("Unable to start checkout. Please try again.")
      }
    } catch {
      setBillingError("Unable to start checkout. Please try again.")
    } finally {
      setLoadingBilling(false)
    }
  }

  async function handleManageBilling() {
    setBillingError(null)
    setLoadingBilling(true)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = (await res.json()) as { url?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setBillingError("Unable to open billing portal. Please try again.")
      }
    } catch {
      setBillingError("Unable to open billing portal. Please try again.")
    } finally {
      setLoadingBilling(false)
    }
  }

  // The toggle always shows: in-flight value or session value
  const displayedUnits = pendingUnits ?? currentUnits

  async function handleUnitsChange(value: "km" | "miles") {
    if (value === displayedUnits) return
    setPendingUnits(value)
    setSaving(true)
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ units: value }),
      })
      if (!res.ok) throw new Error("Save failed")
      // On success: pendingUnits stays set; next useSession refetch will update currentUnits
      // and pendingUnits will be cleared after navigation (no explicit clear needed for UX)
    } catch {
      // Revert on error
      setPendingUnits(null)
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
                  displayedUnits === value
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

      {/* Billing */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Billing
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {plan === "pro" ? "Athlos Pro" : "Free plan"}
            </p>
            <p className="text-xs text-muted-foreground">
              {plan === "pro" ? "Active subscription" : "Upgrade to unlock Pro features"}
            </p>
          </div>
          {plan === "pro" ? (
            <Button
              variant="outline"
              onClick={() => void handleManageBilling()}
              disabled={loadingBilling}
            >
              {loadingBilling ? "Loading…" : "Manage billing"}
            </Button>
          ) : (
            <Button
              onClick={() => void handleUpgrade()}
              disabled={loadingBilling}
            >
              {loadingBilling ? "Loading…" : "Upgrade to Pro"}
            </Button>
          )}
        </div>
        {billingError && (
          <p className="text-xs text-destructive">{billingError}</p>
        )}
      </section>
    </div>
  )
}
