import type { z } from 'zod'
import type { AgentConfig } from '../router/schema'
import type { AgentConfigData } from '../agent-config'

export interface RoutingResult {
  routerConfig: AgentConfig
  agentConfig: AgentConfigData
  effectiveModel: string
  effectiveMaxSteps: number
}

export interface AgentExecutionContext {
  mode: 'admin' | 'chat'
  effectiveModel: string
  maxSteps: number
  routerConfig?: AgentConfig
  agentConfig?: AgentConfigData
  customContext?: Record<string, unknown>
}

export interface CreateAgentOptions {
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

export type AgentCallOptions = z.infer<typeof import('./schemas').callOptionsSchema>
