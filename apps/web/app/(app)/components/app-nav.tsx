"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { LayoutDashboard, CalendarDays, Settings, User } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Wordmark } from "@/components/wordmark"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

interface AppNavProps {
  user: {
    name: string | null | undefined
    email: string
    image: string | null
  }
  planHref: string
}

export function AppNav({ user, planHref }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [imgError, setImgError] = useState(false)

  const tabs = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, activePrefix: "/dashboard" },
    { label: "Plan", href: planHref, icon: CalendarDays, activePrefix: "/plan" },
    { label: "Settings", href: "/settings", icon: Settings, activePrefix: "/settings" },
  ]

  function isActive(prefix: string) {
    return pathname.startsWith(prefix)
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
  }

  const showImage = user.image && !imgError

  return (
    <>
      {/* ── Desktop top bar (md+) ──────────────────────────────────────────── */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 z-50 h-16 items-center justify-between border-b border-border bg-background px-6">
        {/* Left: wordmark */}
        <Link href="/dashboard" className="flex items-center">
          <Wordmark />
        </Link>

        {/* Center-left: nav links */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(tab.activePrefix)
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Right: user avatar + dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-muted text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              {showImage ? (
                <img
                  src={user.image!}
                  alt={user.name ?? user.email}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="h-4 w-4" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                {user.name && <p className="text-sm font-semibold leading-none">{user.name}</p>}
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => void handleSignOut()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ── Mobile bottom tab bar (<md) ────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-background"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.activePrefix)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
