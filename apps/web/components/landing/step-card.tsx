import { Badge } from "@workspace/ui/components/badge"
import type { LucideIcon } from "lucide-react"

interface StepCardProps {
  step: number
  icon: LucideIcon
  title: string
  description: string
}

export function StepCard({ step, icon: Icon, title, description }: StepCardProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <div className="rounded-full bg-primary/10 p-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <Badge className="absolute -right-2 -top-2 h-6 w-6 rounded-full p-0">
          {step}
        </Badge>
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
