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
    'anthropic/claude-opus-4.5',
    'openai/gpt-5.1-instant',
    'google/gemini-3-flash',
  ]

  const model = useCookie<string>('model', { default: () => 'google/gemini-3-flash' })

  return {
    models,
    model,
    formatModelName
  }
}
