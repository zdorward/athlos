"use client"

import { useState } from "react"
import { User } from "lucide-react"
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

export function DashboardHeader({ name, email, image }: DashboardHeaderProps) {
  const [imgError, setImgError] = useState(false)

  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = "/"
  }

  const showImage = image && !imgError

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">Athloryx</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden bg-muted text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
              {showImage ? (
                <img
                  src={image}
                  alt={name ?? email}
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
