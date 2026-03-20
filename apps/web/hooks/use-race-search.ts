"use client"

import { useEffect, useState } from "react"
import type { Race } from "@/data/races/types"

export function useRaceSearch(query: string): { results: Race[]; loading: boolean } {
  const [results, setResults] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    setLoading(true)

    async function fetchRaces(q: string) {
      try {
        const url = q ? `/api/races?q=${encodeURIComponent(q)}` : "/api/races"
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) {
          if (!cancelled) setResults([])
          return
        }
        const data = (await res.json()) as { races: Race[] }
        if (!cancelled) setResults(data.races)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const trimmed = query.trim()

    if (trimmed === "") {
      // Mount/clear: fetch immediately, no debounce
      void fetchRaces("")
      return () => {
        cancelled = true
        controller.abort()
      }
    }

    // Non-empty query: debounce 200ms
    const timer = setTimeout(() => void fetchRaces(trimmed), 200)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  return { results, loading }
}
