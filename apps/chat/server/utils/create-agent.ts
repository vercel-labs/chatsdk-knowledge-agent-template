import { stepCountIs, ToolLoopAgent } from 'ai'
import type { AgentConfig } from './router/schema'
import { DEFAULT_MODEL } from './router/schema'
import type { AgentConfigData } from './agent-config'
import { getAgentConfig } from './agent-config'

export interface RoutingResult {
  routerConfig: AgentConfig
  agentConfig: AgentConfigData
  effectiveModel: string
  effectiveMaxSteps: number
}

interface CreateAgentOptions {
  tools: Record<string, any>
  route: () => Promise<AgentConfig>
  buildPrompt: (routerConfig: AgentConfig, agentConfig: AgentConfigData) => string
  resolveModel?: (routerConfig: AgentConfig, agentConfig: AgentConfigData) => string
  admin?: {
    tools: Record<string, any>
    systemPrompt: string
    maxSteps?: number
  }
  onRouted?: (result: RoutingResult) => void
  onStepFinish?: (stepResult: any) => void
  onFinish?: (result: any) => void
}

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
    prepareCall: async ({ ...settings }) => {
      if (admin) {
        isAdminMode = true
        maxSteps = admin.maxSteps ?? 15
        return {
          ...settings,
          instructions: admin.systemPrompt,
          tools: admin.tools,
          stopWhen: stepCountIs(maxSteps),
        }
      }

      isAdminMode = false

      const [routerConfig, agentConfig] = await Promise.all([
        route(),
        getAgentConfig(),
      ])

      const effectiveMaxSteps = Math.round(routerConfig.maxSteps * agentConfig.maxStepsMultiplier)
      const effectiveModel = resolveModel?.(routerConfig, agentConfig)
        ?? agentConfig.defaultModel
        ?? DEFAULT_MODEL

      maxSteps = effectiveMaxSteps

      onRouted?.({ routerConfig, agentConfig, effectiveModel, effectiveMaxSteps })

      return {
        ...settings,
        model: effectiveModel,
        instructions: buildPrompt(routerConfig, agentConfig),
        tools,
        stopWhen: stepCountIs(effectiveMaxSteps),
      }
    },
    prepareStep: ({ stepNumber }) => {
      if (isAdminMode) return
      // Remove tools on the last step to force text output
      if (stepNumber >= maxSteps - 1) {
        return { activeTools: [] }
      }
    },
    onStepFinish,
    onFinish,
  })
}
