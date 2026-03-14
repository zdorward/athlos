"use client"

import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

interface DashboardHeaderProps {
  name: string | null | undefined
  email: string
  image: string | null | undefined
}

function getInitials(name: string | null | undefined, email: string): string {
  if (!name?.trim()) return (email[0] ?? "?").toUpperCase()
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0]![0] ?? "").toUpperCase()
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase()
}

export function DashboardHeader({ name, email, image }: DashboardHeaderProps) {
  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = "/"
  }

  const initials = getInitials(name, email)

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">Athloryx</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-muted text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              {image ? (
                <img src={image} alt={name ?? email} className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                {name && <p className="text-sm font-semibold leading-none">{name}</p>}
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => void handleSignOut()}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
