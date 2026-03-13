"use client"

import {
  DemoProvider,
  HeroSection,
  WorkoutCard,
  WeeklyPlan,
  ProgressMetrics,
  HowItWorks,
  CTASection,
} from "@/components/landing"

export default function Page() {
  return (
    <DemoProvider>
      <main className="flex min-h-svh flex-col items-center gap-16 px-4 py-16 sm:px-6 lg:px-8">
        <HeroSection />

        <div className="flex w-full max-w-4xl flex-col items-center gap-12">
          <WorkoutCard />
          <WeeklyPlan />
          <ProgressMetrics />
        </div>

        <div className="w-full max-w-3xl">
          <HowItWorks />
        </div>

        <CTASection />

        <footer className="text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </footer>
      </main>
    </DemoProvider>
  )
}
