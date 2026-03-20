import type { NextRequest } from "next/server"
import { CA_RACES } from "@/data/races/ca"
import { RACES } from "@/data/races"

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""

    if (q === "") {
      const sorted = [...CA_RACES].sort((a, b) => a.date.localeCompare(b.date))
      return Response.json({ races: sorted })
    }

    const lower = q.toLowerCase()
    const matches = RACES.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.city.toLowerCase().includes(lower) ||
        r.region.toLowerCase().includes(lower) ||
        r.country.toLowerCase().includes(lower),
    ).slice(0, 50)

    return Response.json({ races: matches })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
