/** Truncated JSON preview of any value for tool call stdout display. */
export function preview(data: unknown, maxLen = 300): string {
  const text = JSON.stringify(data)
  if (!text || text === 'null' || text === '[]' || text === '{}') return 'No data'
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

/** Build a command entry for a tool call result. Empty command hides the $ prompt in the UI. */
export const cmd = (title: string, stdout: string, stderr = '', success = true) =>
  ({ command: '', title, stdout, stderr, exitCode: success ? 0 : 1, success })
