import type { Race } from "./types"
import { CA_RACES } from "./ca"
import { US_RACES } from "./us"

export const RACES: Race[] = [
  ...CA_RACES,
  ...US_RACES,
]

export type { Race } from "./types"
