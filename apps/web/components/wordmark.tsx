import { cn } from "@workspace/ui/lib/utils"

interface WordmarkProps {
  className?: string
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "text-[13px] font-bold tracking-[0.12em] uppercase",
        className,
      )}
    >
      ATHLOS
    </span>
  )
}
