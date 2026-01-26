import { kv } from '@nuxthub/kv'
import type { SandboxSession } from './types'
import { KV_KEYS } from './types'

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

/** Returns session if exists and not expired, null otherwise */
export async function getSandboxSession(sessionId: string): Promise<SandboxSession | null> {
  const session = await kv.get<SandboxSession>(KV_KEYS.session(sessionId))

  if (!session) {
    return null
  }

  if (Date.now() > session.expiresAt) {
    await kv.del(KV_KEYS.session(sessionId))
    return null
  }

  return session
}

/** Creates or updates session with TTL, returns full session with timestamps */
export async function setSandboxSession(
  sessionId: string,
  session: Omit<SandboxSession, 'lastAccessedAt' | 'expiresAt'>,
  ttlMs: number = DEFAULT_SESSION_TTL_MS,
): Promise<SandboxSession> {
  const now = Date.now()

  const fullSession: SandboxSession = {
    ...session,
    lastAccessedAt: now,
    expiresAt: now + ttlMs,
  }

  await kv.set(KV_KEYS.session(sessionId), fullSession)
  return fullSession
}

/** Refreshes session expiration time, returns updated session or null if not found */
export async function touchSandboxSession(
  sessionId: string,
  ttlMs: number = DEFAULT_SESSION_TTL_MS,
): Promise<SandboxSession | null> {
  const session = await getSandboxSession(sessionId)
  if (!session) {
    return null
  }

  const now = Date.now()
  session.lastAccessedAt = now
  session.expiresAt = now + ttlMs

  await kv.set(KV_KEYS.session(sessionId), session)
  return session
}

/** Deletes session from storage */
export async function deleteSandboxSession(sessionId: string): Promise<void> {
  await kv.del(KV_KEYS.session(sessionId))
}

/** Generates unique session ID with timestamp and random suffix */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
