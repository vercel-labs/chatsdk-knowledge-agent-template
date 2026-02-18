export function formatModelName(modelId: string): string {
  const acronyms = ['gpt'] // words that should be uppercase
  const modelName = modelId.split('/')[1] || modelId

  return modelName
    .split('-')
    .map((word) => {
      const lowerWord = word.toLowerCase()
      return acronyms.includes(lowerWord)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export function useModels() {
  const models = [
    'google/gemini-3-flash',
    'anthropic/claude-sonnet-4.6',
    'anthropic/claude-opus-4.6',
  ]

  const model = useCookie<string>('model', { default: () => 'anthropic/claude-sonnet-4.6' })

  return {
    models,
    model,
    formatModelName
  }
}
