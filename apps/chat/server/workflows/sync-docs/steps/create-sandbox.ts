/**
 * Step: Create Sandbox
 *
 * Creates a new Vercel Sandbox from a Git repository.
 * This is an atomic step that can be retried independently.
 */

import { getStepMetadata } from 'workflow'
import { log } from 'evlog'
import { Sandbox } from '@vercel/sandbox'
import type { SyncConfig } from '../types'
import { createGitSource } from '../../../utils/sandbox/context'

export interface CreateSandboxResult {
  sandboxId: string
}

export async function stepCreateSandbox(
  config: SyncConfig,
  timeoutMs: number = 10 * 60 * 1000,
): Promise<CreateSandboxResult> {
  'use step'

  const { stepId } = getStepMetadata()
  log.info('sync', `[${stepId}] Creating sandbox from ${config.snapshotRepo}#${config.snapshotBranch}`)

  const source = createGitSource(config)

  const sandbox = await Sandbox.create({
    source,
    timeout: timeoutMs,
    runtime: 'node24',
  })

  log.info('sync', `[${stepId}] Sandbox created: ${sandbox.sandboxId}`)

  return {
    sandboxId: sandbox.sandboxId,
  }
}

// Allow more retries for network operations
stepCreateSandbox.maxRetries = 5
