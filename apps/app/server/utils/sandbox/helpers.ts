import { Sandbox, Snapshot } from '@vercel/sandbox'

export function getSandboxName(sandbox: Sandbox): string {
  return sandbox.name
}

export async function getSandboxByName(name: string): Promise<Sandbox | null> {
  try {
    const sandbox = await Sandbox.get({ name })
    return sandbox.status === 'running' ? sandbox : null
  } catch {
    return null
  }
}

export async function listSandboxSummaries(limit = 20) {
  const result = await Sandbox.list({ limit })
  return result.toArray()
}

export async function listSnapshotSummaries() {
  const result = await Snapshot.list()
  return result.toArray()
}
