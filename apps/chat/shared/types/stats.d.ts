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
 * Top user statistics
 */
export interface TopUserStats {
  userId: string
  name: string
  email: string
  image: string
  messageCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalDurationMs: number
}

/**
 * Daily totals for trend charts
 */
export interface DailyTotals {
  date: string
  messages: number
  tokens: number
}

/**
 * Trend comparison (current vs previous period)
 */
export interface TrendStats {
  messages: number | null
  tokens: number | null
  activeUsers: number | null
}

/**
 * Daily statistics broken down by source
 */
export interface DailyBySource {
  date: string
  source: string
  messageCount: number
  inputTokens: number
  outputTokens: number
}

/**
 * Hourly activity distribution (UTC)
 */
export interface HourlyDistribution {
  hour: number // 0-23
  messageCount: number
  totalTokens: number
}

/**
 * Estimated cost breakdown
 */
export interface EstimatedCost {
  total: number
  byModel: Array<{
    model: string
    inputCost: number
    outputCost: number
    totalCost: number
  }>
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
    activeUsers: number
  }
  trends: TrendStats
  feedback: FeedbackStats
  byModel: Array<{
    model: string
    messageCount: number
    inputTokens: number
    outputTokens: number
    avgDurationMs: number
    positive: number
    negative: number
  }>
  bySource: SourceStats[]
  topUsers: TopUserStats[]
  daily: DailyStats[]
  dailyTotals: DailyTotals[]
  dailyBySource: DailyBySource[]
  hourlyDistribution: HourlyDistribution[]
  estimatedCost: EstimatedCost
  availableSources: string[]
  availableModels: string[]
}
