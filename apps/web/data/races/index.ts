import type { Race } from "./types"
import { CA_RACES } from "./ca"

// US races added after running: pnpm seed-races us
// import { US_RACES } from "./us"

export const RACES: Race[] = [
  ...CA_RACES,
  // ...US_RACES,
]

export type { Race } from "./types"
