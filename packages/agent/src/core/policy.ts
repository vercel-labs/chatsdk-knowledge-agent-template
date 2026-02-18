import type { StepResult, ToolSet } from 'ai'

export function countConsecutiveToolSteps(steps: StepResult<ToolSet>[]): number {
  let streak = 0
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (!step) break
    if (step.toolCalls && step.toolCalls.length > 0) {
      streak++
      continue
    }
    break
  }
  return streak
}

export function shouldForceTextOnlyStep({
  stepNumber,
  maxSteps,
  steps,
}: {
  stepNumber: number
  maxSteps: number
  steps: StepResult<ToolSet>[]
}): boolean {
  // Always reserve the last 2 steps for final user-facing output.
  if (stepNumber >= maxSteps - 2) return true

  const toolStreak = countConsecutiveToolSteps(steps)
  const pastMidpoint = stepNumber >= Math.max(3, Math.floor(maxSteps * 0.6))

  // If the model is stuck in a tool-only streak deep in the loop, force synthesis.
  if (pastMidpoint && toolStreak >= 4) return true

  return false
}
