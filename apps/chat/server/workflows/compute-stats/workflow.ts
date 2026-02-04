/**
 * Compute Stats Workflow
 *
 * Aggregates daily usage statistics from messages into the usage_stats table.
 * Can be triggered manually via API or scheduled via cron.
 */

import { log } from 'evlog'
import type { ComputeStatsConfig, ComputeStatsResult } from './types'
import { stepAggregateStats } from './steps'

export async function computeStats(config: ComputeStatsConfig): Promise<ComputeStatsResult> {
  'use workflow'

  log.info('stats', `Starting stats computation for ${config.date}`)

  const result = await stepAggregateStats(config.date)

  if (result.success) {
    log.info('stats', `✓ Stats computed: ${result.statsCreated} records for ${config.date}`)
  } else {
    log.error('stats', `✗ Stats computation failed for ${config.date}`)
  }

  return result
}
