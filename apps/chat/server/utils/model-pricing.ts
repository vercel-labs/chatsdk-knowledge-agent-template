import { createGateway } from '@ai-sdk/gateway'

interface ModelPricing {
  input: number // cost per token in USD
  output: number
}

type PricingRecord = Record<string, ModelPricing>

export const getModelPricingMap = defineCachedFunction(
  async (): Promise<PricingRecord> => {
    try {
      const config = useRuntimeConfig()
      const gateway = createGateway({ apiKey: config.savoir?.apiKey })
      const { models } = await gateway.getAvailableModels()

      const pricing: PricingRecord = {}
      for (const model of models) {
        if (model.pricing) {
          pricing[model.id] = {
            input: parseFloat(model.pricing.input),
            output: parseFloat(model.pricing.output),
          }
        }
      }

      return pricing
    } catch {
      // Return empty record on failure — cost will show as $0
      return {}
    }
  },
  {
    maxAge: 3600,
    swr: true,
    name: 'model-pricing',
    getKey: () => 'v1',
  },
)

export function computeEstimatedCost(
  byModel: Array<{ model: string, inputTokens: number, outputTokens: number }>,
  pricingMap: PricingRecord,
) {
  const byModelCosts = byModel.map((m) => {
    const pricing = pricingMap[m.model]
    if (!pricing) return { model: m.model, inputCost: 0, outputCost: 0, totalCost: 0 }
    const inputCost = m.inputTokens * pricing.input
    const outputCost = m.outputTokens * pricing.output
    return { model: m.model, inputCost, outputCost, totalCost: inputCost + outputCost }
  })

  return {
    total: byModelCosts.reduce((sum, m) => sum + m.totalCost, 0),
    byModel: byModelCosts,
  }
}
