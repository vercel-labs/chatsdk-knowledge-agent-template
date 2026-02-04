/**
 * User statistics summary
 */
export interface UserStats {
  totalMessages: number
  totalInputTokens: number
  totalOutputTokens: number
  totalDurationMs: number
  modelsUsed: string[]
}

/**
 * Daily aggregated statistics
 */
export interface DailyStats {
  date: string
  model: string
  messageCount: number
  inputTokens: number
  outputTokens: number
  avgDurationMs: number
}

/**
 * Feedback statistics
 */
export interface FeedbackStats {
  positive: number
  negative: number
  total: number
  score: number | null // 0-100 percentage, null if no feedback
}

/**
 * Statistics by source
 */
export interface SourceStats {
  source: string // 'web', 'github-bot', 'sdk', etc.
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgDurationMs: number
}

/**
 * Global stats response (admin)
 */
export interface GlobalStatsResponse {
  period: {
    days: number
    from: string
    to: string
  }
  totals: {
    messages: number
    inputTokens: number
    outputTokens: number
    totalTokens: number
    avgDurationMs: number
  }
  feedback: FeedbackStats
  byModel: Array<{
    model: string
    messageCount: number
    inputTokens: number
    outputTokens: number
    positive: number
    negative: number
  }>
  bySource: SourceStats[]
  daily: DailyStats[]
}
