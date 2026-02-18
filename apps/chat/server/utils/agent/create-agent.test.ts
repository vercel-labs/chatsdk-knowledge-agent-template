// @ts-expect-error bun test types are runtime-provided in this workspace
import { describe, expect, test } from 'bun:test'
import { compactContext } from './context-management'
import { shouldForceTextOnlyStep } from './step-policy'

describe('compactContext', () => {
  test('keeps context unchanged when token usage is low', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'hello' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
    ] as any

    const result = compactContext({
      messages,
      steps: [{ usage: { inputTokens: 1000 } }] as any,
    })

    expect(result).toBe(messages)
  })

  test('prunes old tool calls when token usage is high', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'first' }] },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolName: 'bash', input: { command: 'ls -la' }, toolCallId: '1' }],
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolName: 'bash', output: 'x'.repeat(120_000), toolCallId: '1' }],
      },
      { role: 'user', content: [{ type: 'text', text: 'second' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'done' }] },
    ] as any

    const result = compactContext({
      messages,
      steps: [{ usage: { inputTokens: 60_000 } }] as any,
      protectLastUserMessages: 1,
      minTrimSavings: 1000,
    })

    expect(result.length).toBeLessThanOrEqual(messages.length)
  })
})

describe('shouldForceTextOnlyStep', () => {
  test('forces text-only on last two steps', () => {
    expect(shouldForceTextOnlyStep({
      stepNumber: 8,
      maxSteps: 10,
      steps: [],
    } as any)).toBe(true)
    expect(shouldForceTextOnlyStep({
      stepNumber: 9,
      maxSteps: 10,
      steps: [],
    } as any)).toBe(true)
  })

  test('forces text-only on long tool streak after midpoint', () => {
    const toolSteps = Array.from({ length: 4 }, () => ({ toolCalls: [{ toolName: 'bash' }] }))
    const shouldForce = shouldForceTextOnlyStep({
      stepNumber: 7,
      maxSteps: 10,
      steps: toolSteps as any,
    })
    expect(shouldForce).toBe(true)
  })

  test('keeps tools available early in loop', () => {
    const shouldForce = shouldForceTextOnlyStep({
      stepNumber: 2,
      maxSteps: 10,
      steps: [{ toolCalls: [{ toolName: 'bash' }] }] as any,
    })
    expect(shouldForce).toBe(false)
  })
})
