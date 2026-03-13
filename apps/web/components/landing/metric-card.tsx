import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string
  trend?: "up" | "down" | "neutral"
}

export function MetricCard({ icon: Icon, label, value, trend = "neutral" }: MetricCardProps) {
  return (
    <Card className="flex-1">
      <CardContent className="flex items-center gap-3 pt-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-lg font-semibold",
              trend === "up" && "text-green-500",
              trend === "down" && "text-red-500"
            )}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
