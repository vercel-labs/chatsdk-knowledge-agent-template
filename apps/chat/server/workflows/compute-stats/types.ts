/**
 * Types for compute-stats workflow
 */

export interface ComputeStatsConfig {
  /**
   * Date to compute stats for (YYYY-MM-DD format)
   * Defaults to yesterday
   */
  date: string
}

export interface AggregatedStats {
  userId: string | null // null = global stats
  model: string
  messageCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalDurationMs: number
}

export interface ComputeStatsResult {
  success: boolean
  date: string
  statsCreated: number
  userStats: number
  globalStats: number
}
