import { useStorage } from 'nitro/storage'
import type { SandboxSession } from './types'
import { KV_KEYS } from './types'

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Get a sandbox session from KV storage
 */
export async function getSession(sessionId: string): Promise<SandboxSession | null> {
  const kv = useStorage('kv')
  const session = await kv.getItem<SandboxSession>(KV_KEYS.session(sessionId))

  if (!session) {
    return null
  }

  // Check if session is expired
  if (Date.now() > session.expiresAt) {
    await kv.removeItem(KV_KEYS.session(sessionId))
    return null
  }

  return session
}

/**
 * Create or update a sandbox session in KV storage
 */
export async function setSession(
  sessionId: string,
  session: Omit<SandboxSession, 'lastAccessedAt' | 'expiresAt'>,
  ttlMs: number = DEFAULT_SESSION_TTL_MS,
): Promise<SandboxSession> {
  const kv = useStorage('kv')
  const now = Date.now()

  const fullSession: SandboxSession = {
    ...session,
    lastAccessedAt: now,
    expiresAt: now + ttlMs,
  }

  await kv.setItem(KV_KEYS.session(sessionId), fullSession)
  return fullSession
}

/**
 * Update the last accessed time for a session
 */
export async function touchSession(
  sessionId: string,
  ttlMs: number = DEFAULT_SESSION_TTL_MS,
): Promise<SandboxSession | null> {
  const session = await getSession(sessionId)
  if (!session) {
    return null
  }

  const now = Date.now()
  session.lastAccessedAt = now
  session.expiresAt = now + ttlMs

  const kv = useStorage('kv')
  await kv.setItem(KV_KEYS.session(sessionId), session)
  return session
}

/**
 * Delete a sandbox session from KV storage
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const kv = useStorage('kv')
  await kv.removeItem(KV_KEYS.session(sessionId))
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
