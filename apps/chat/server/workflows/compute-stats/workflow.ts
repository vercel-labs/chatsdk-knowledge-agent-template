/**
 * Compute Stats Workflow
 *
 * Aggregates daily usage statistics from messages into the usage_stats table.
 * Can be triggered manually via API or scheduled via cron.
 */

import { FatalError } from 'workflow'
import { log } from 'evlog'
import type { ComputeStatsConfig, ComputeStatsResult } from './types'
import { stepAggregateStats } from './steps'

export async function computeStats(config: ComputeStatsConfig): Promise<ComputeStatsResult> {
  'use workflow'

  // Validate date format
  if (!config.date || !/^\d{4}-\d{2}-\d{2}$/.test(config.date)) {
    throw new FatalError(`Invalid date format: ${config.date}. Expected YYYY-MM-DD`)
  }

  log.info('stats', `Starting stats computation for ${config.date}`)

  // Let errors propagate for retry semantics
  const result = await stepAggregateStats(config.date)

  log.info('stats', `✓ Stats computed: ${result.statsCreated} records for ${config.date}`)

  return result
}
