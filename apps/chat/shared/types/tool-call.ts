export interface CommandResult {
  /** Shell command shown with $ prompt. Empty string hides the prompt line. */
  command: string
  /** Display title for the bullet point label (used instead of command when set). */
  title?: string
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
}

export interface ToolExecutionResult {
  commands: CommandResult[]
  success: boolean
  durationMs: number
  error?: string
}

export interface ToolCall {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  state: 'loading' | 'done' | 'error'
  result?: ToolExecutionResult
}
