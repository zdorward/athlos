import { describe, it, expect } from "vitest"
import { GET } from "./route"
import { NextRequest } from "next/server"

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

describe("GET /api/races", () => {
  it("returns CA_RACES sorted by date when no query given", async () => {
    const res = await GET(makeRequest("http://localhost/api/races"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: Array<{ country: string; date: string }> }
    expect(Array.isArray(body.races)).toBe(true)
    expect(body.races.length).toBeGreaterThan(0)
    for (const race of body.races) {
      expect(race.country).toBe("CA")
    }
    for (let i = 1; i < body.races.length; i++) {
      expect(body.races[i]!.date >= body.races[i - 1]!.date).toBe(true)
    }
  })

  it("returns CA_RACES when q is empty string", async () => {
    const res = await GET(makeRequest("http://localhost/api/races?q="))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: Array<{ country: string }> }
    for (const race of body.races) {
      expect(race.country).toBe("CA")
    }
  })

  it("searches full dataset when q is provided", async () => {
    const res = await GET(makeRequest("http://localhost/api/races?q=boston"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: Array<{ name: string; city: string; region: string; country: string }> }
    expect(Array.isArray(body.races)).toBe(true)
    for (const race of body.races) {
      const fields = [race.name, race.city, race.region, race.country].join(" ").toLowerCase()
      expect(fields.includes("boston")).toBe(true)
    }
  })

  it("caps search results at 50", async () => {
    const res = await GET(makeRequest("http://localhost/api/races?q=marathon"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: unknown[] }
    expect(body.races.length).toBeLessThanOrEqual(50)
  })

  it("returns empty array for query with no matches", async () => {
    const res = await GET(makeRequest("http://localhost/api/races?q=xyzzznotarace999"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: unknown[] }
    expect(body.races).toEqual([])
  })
})
