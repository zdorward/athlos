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
