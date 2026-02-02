import type { Lock, StateAdapter } from 'chat'
import { kv } from 'hub:kv'

export class KVStateAdapter implements StateAdapter {

   
  async connect(): Promise<void> {}

   
  async disconnect(): Promise<void> {}

  async subscribe(threadId: string): Promise<void> {
    await kv.set(`chat:sub:${threadId}`, true)
  }

  async unsubscribe(threadId: string): Promise<void> {
    await kv.del(`chat:sub:${threadId}`)
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    return await kv.has(`chat:sub:${threadId}`)
  }

  async *listSubscriptions(adapterName?: string): AsyncIterable<string> {
    const keys = await kv.keys('chat:sub:')
    for (const key of keys) {
      const threadId = key.replace('chat:sub:', '')
      if (!adapterName || threadId.startsWith(`${adapterName}:`)) {
        yield threadId
      }
    }
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    const key = `chat:lock:${threadId}`
    const existing = await kv.get<Lock>(key)

    if (existing && existing.expiresAt > Date.now()) {
      return null
    }

    const lock: Lock = {
      threadId,
      token: `kv_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      expiresAt: Date.now() + ttlMs,
    }

    await kv.set(key, lock, { ttl: Math.ceil(ttlMs / 1000) })
    return lock
  }

  async releaseLock(lock: Lock): Promise<void> {
    const key = `chat:lock:${lock.threadId}`
    const existing = await kv.get<Lock>(key)

    if (existing && existing.token === lock.token) {
      await kv.del(key)
    }
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const key = `chat:lock:${lock.threadId}`
    const existing = await kv.get<Lock>(key)

    if (!existing || existing.token !== lock.token) {
      return false
    }

    if (existing.expiresAt < Date.now()) {
      await kv.del(key)
      return false
    }

    existing.expiresAt = Date.now() + ttlMs
    await kv.set(key, existing, { ttl: Math.ceil(ttlMs / 1000) })
    return true
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    return await kv.get<T>(`chat:cache:${key}`)
  }

  async set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    const opts = ttlMs ? { ttl: Math.ceil(ttlMs / 1000) } : undefined
    await kv.set(`chat:cache:${key}`, value as string, opts)
  }

  async delete(key: string): Promise<void> {
    await kv.del(`chat:cache:${key}`)
  }

}
