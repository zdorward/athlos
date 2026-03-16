import { cn } from "@workspace/ui/lib/utils"

interface SpinnerProps {
  size?: "sm" | "md"
  className?: string
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const dotClass = cn(
    "rounded-full bg-current animate-dot-pulse",
    size === "md" ? "size-2" : "size-1.5"
  )
  const delays = ["0s", "0.2s", "0.4s"]

  return (
    <div
      className={cn(
        "flex items-center text-primary",
        size === "md" ? "gap-1.5" : "gap-1",
        className
      )}
      role="status"
      aria-label="Loading"
    >
      {delays.map((delay) => (
        <span
          key={delay}
          className={dotClass}
          style={{ animationDelay: delay }}
        />
      ))}
    </div>
  )
}
