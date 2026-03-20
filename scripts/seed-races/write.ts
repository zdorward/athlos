import * as fs from "fs"
import * as path from "path"
import type { Race } from "./types"

export function writeRaceFile(country: string, exportName: string, races: Race[]): void {
  const outPath = path.resolve(__dirname, `../../apps/web/data/races/${country}.ts`)

  const lines = [
    `import type { Race } from "./types"`,
    ``,
    `export const ${exportName}: Race[] = [`,
    ...races.map((r) => {
      const fields = [
        `    id: ${JSON.stringify(r.id)},`,
        `    name: ${JSON.stringify(r.name)},`,
        `    city: ${JSON.stringify(r.city)},`,
        `    region: ${JSON.stringify(r.region)},`,
        `    country: ${JSON.stringify(r.country)},`,
        `    date: ${JSON.stringify(r.date)},`,
        `    distance: ${JSON.stringify(r.distance)},`,
        ...(r.url ? [`    url: ${JSON.stringify(r.url)},`] : []),
      ]
      return `  {\n${fields.join("\n")}\n  },`
    }),
    `]`,
    ``,
  ]

  fs.writeFileSync(outPath, lines.join("\n"), "utf8")
  console.log(`Wrote ${races.length} races to ${outPath}`)
}
