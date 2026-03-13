import { ShimmerButton } from "@workspace/ui/components/shimmer-button"

export function CTASection() {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <h2 className="text-2xl font-bold">Ready to train smarter?</h2>
      <p className="text-muted-foreground">
        Join athletes who let their training adapt to them.
      </p>
      <ShimmerButton className="mt-2">
        Start Training Free
      </ShimmerButton>
    </section>
  )
}
