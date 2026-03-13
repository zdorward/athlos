"use client"

import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { useDemoState, useDemoDispatch } from "./use-demo-state"
import { FeedbackDialog } from "./feedback-dialog"
import { AdaptiveResponse } from "./adaptive-response"
import { Play, SkipForward } from "lucide-react"

export function WorkoutCard() {
  const state = useDemoState()
  const dispatch = useDemoDispatch()

  const isCompleted = state.demoPhase === "adapted"

  return (
    <>
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">
              Today
            </Badge>
            {isCompleted && (
              <Badge className="bg-green-500/10 text-green-500">
                Completed
              </Badge>
            )}
          </div>
          <CardTitle className="mt-2 text-xl">{state.currentWorkout.title}</CardTitle>
          <CardDescription>
            Target pace: {state.currentWorkout.targetPace}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isCompleted ? (
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => dispatch({ type: "OPEN_FEEDBACK" })}
              >
                <Play className="mr-2 h-4 w-4" />
                Log Workout
              </Button>
              <Button variant="outline">
                <SkipForward className="mr-2 h-4 w-4" />
                Skip
              </Button>
            </div>
          ) : (
            <AdaptiveResponse />
          )}
        </CardContent>
      </Card>

      <FeedbackDialog
        open={state.demoPhase === "feedback"}
        onClose={() => dispatch({ type: "RESET" })}
      />
    </>
  )
}
