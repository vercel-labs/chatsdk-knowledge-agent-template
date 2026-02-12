import type { AgentConfigData } from '../agent-config'
import type { AgentConfig } from '../router/schema'

export const STYLE_INSTRUCTIONS: Record<AgentConfigData['responseStyle'], string> = {
  concise: 'Keep your responses brief and to the point.',
  detailed: 'Provide comprehensive explanations with context.',
  technical: 'Focus on technical details and include code examples.',
  friendly: 'Be conversational and approachable in your responses.',
}

export function applyAgentConfig(basePrompt: string, config: AgentConfigData): string {
  let prompt = basePrompt

  prompt = prompt.replace(
    /## Response(?: Style)?\n+- Be concise and helpful/,
    `## Response Style\n\n- ${STYLE_INSTRUCTIONS[config.responseStyle]}`,
  )

  if (config.language && config.language !== 'en') {
    prompt += `\n\n## Language\nRespond in ${config.language}.`
  }

  if (config.citationFormat === 'footnote') {
    prompt += '\n\n## Citations\nPlace all source citations as footnotes at the end of your response.'
  } else if (config.citationFormat === 'none') {
    prompt += '\n\n## Citations\nDo not include source citations in your response.'
  }

  if (config.searchInstructions) {
    prompt += `\n\n## Custom Search Instructions\n${config.searchInstructions}`
  }

  if (config.additionalPrompt) {
    prompt += `\n\n## Additional Instructions\n${config.additionalPrompt}`
  }

  return prompt
}

export const COMPLEXITY_HINTS: Record<AgentConfig['complexity'], string> = {
  trivial: 'This is a simple greeting or acknowledgment. Respond briefly without searching.',
  simple: 'This is a straightforward question. Explore with `ls`, then do a targeted search.',
  moderate: 'This requires some research. Explore the sources structure first, then search within relevant directories.',
  complex: 'This is a complex question. Map out the available sources with `ls`, then systematically search relevant areas.',
}

export function applyComplexity(prompt: string, agentConfig: AgentConfig): string {
  return `${prompt}\n\n## Task Complexity: ${agentConfig.complexity}\n${COMPLEXITY_HINTS[agentConfig.complexity]}`
}
