export interface CommandResult {
  command: string
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
