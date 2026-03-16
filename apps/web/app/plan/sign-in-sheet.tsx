"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"
import { authClient } from "@/lib/auth-client"

interface SignInSheetProps {
  onBeforeSignIn: () => void
  onClose: () => void
  callbackURL?: string
  title?: string
}

type SheetState = "options" | "email" | "sent" | "error"

export function SignInSheet({ onBeforeSignIn, onClose, callbackURL = "/plan", title = "Save your plan" }: SignInSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>("options")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  async function handleGoogle() {
    onBeforeSignIn()
    await authClient.signIn.social({ provider: "google", callbackURL })
  }

  async function handleMagicLink() {
    if (!email) return
    onBeforeSignIn() // persist plan state before magic link redirect
    setLoading(true)
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >

        {sheetState === "options" && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{title}</h2>
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
              {loading && <Spinner size="sm" />}
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
