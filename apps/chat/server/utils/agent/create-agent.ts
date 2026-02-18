import { stepCountIs, ToolLoopAgent, type StepResult, type ToolSet } from 'ai'
import { log } from 'evlog'
import { DEFAULT_MODEL } from '../router/schema'
import { getAgentConfig } from '../agent-config'
import { compactContext } from './context-management'
import { callOptionsSchema } from './schemas'
import { sanitizeToolCallInputs } from './sanitize'
import { countConsecutiveToolSteps, shouldForceTextOnlyStep } from './step-policy'
import type { AgentCallOptions, AgentExecutionContext, CreateAgentOptions } from './types'

export function createAgent({
  tools,
  route,
  buildPrompt,
  resolveModel,
  admin,
  onRouted,
  onStepFinish,
  onFinish,
}: CreateAgentOptions) {
  let isAdminMode = false
  let maxSteps = 15

  return new ToolLoopAgent({
    model: DEFAULT_MODEL,
    callOptionsSchema,
    prepareCall: async ({ options, ...settings }) => {
      const modelOverride = (options as AgentCallOptions | undefined)?.model
      const customContext = (options as AgentCallOptions | undefined)?.context

      if (admin) {
        isAdminMode = true
        maxSteps = admin.maxSteps ?? 15
        const effectiveModel = modelOverride ?? DEFAULT_MODEL
        const executionContext: AgentExecutionContext = {
          mode: 'admin',
          effectiveModel,
          maxSteps,
          customContext,
        }
        return {
          ...settings,
          model: effectiveModel,
          instructions: admin.systemPrompt,
          tools: admin.tools,
          stopWhen: stepCountIs(maxSteps),
          experimental_context: executionContext,
        }
      }

      isAdminMode = false

      const [routerConfig, agentConfig] = await Promise.all([
        route(),
        getAgentConfig(),
      ])

      const effectiveMaxSteps = Math.round(routerConfig.maxSteps * agentConfig.maxStepsMultiplier)
      const routedModel = resolveModel?.(routerConfig, agentConfig)
        ?? agentConfig.defaultModel
        ?? DEFAULT_MODEL
      const effectiveModel = modelOverride ?? routedModel

      maxSteps = effectiveMaxSteps
      onRouted?.({ routerConfig, agentConfig, effectiveModel, effectiveMaxSteps })

      const executionContext: AgentExecutionContext = {
        mode: 'chat',
        effectiveModel,
        maxSteps: effectiveMaxSteps,
        routerConfig,
        agentConfig,
        customContext,
      }

      return {
        ...settings,
        model: effectiveModel,
        instructions: buildPrompt(routerConfig, agentConfig),
        tools,
        stopWhen: stepCountIs(effectiveMaxSteps),
        experimental_context: executionContext,
      }
    },
    prepareStep: ({ stepNumber, messages, steps }) => {
      sanitizeToolCallInputs(messages)
      const normalizedSteps = (steps as StepResult<ToolSet>[] | undefined) ?? []
      const compactedMessages = compactContext({
        messages,
        steps: normalizedSteps,
      })

      if (isAdminMode) {
        if (compactedMessages !== messages) {
          return { messages: compactedMessages }
        }
        return
      }

      // Prevent tool-only endings: reserve end of loop for synthesis.
      if (shouldForceTextOnlyStep({ stepNumber, maxSteps, steps: normalizedSteps })) {
        log.info(
          'agent',
          `Forcing text-only step at ${stepNumber + 1}/${maxSteps} (tool streak=${countConsecutiveToolSteps(normalizedSteps)})`,
        )
        return {
          tools: {},
          toolChoice: 'none' as const,
          activeTools: [],
          ...(compactedMessages !== messages ? { messages: compactedMessages } : {}),
        }
      }

      if (compactedMessages !== messages) {
        return { messages: compactedMessages }
      }
    },
    onStepFinish,
    onFinish,
  })
}
