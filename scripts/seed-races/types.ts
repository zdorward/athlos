export interface Race {
  id: string
  name: string
  city: string
  region: string
  country: string
  date: string
  distance: "half" | "full"
  url?: string
}

export interface RunSignUpRace {
  race: {
    name: string
    next_date: string
    url: string
    address: {
      city: string
      state: string
    }
  }
}
