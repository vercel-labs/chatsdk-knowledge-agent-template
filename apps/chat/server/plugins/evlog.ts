import { createUserAgentEnricher, createGeoEnricher, createRequestSizeEnricher } from 'evlog/enrichers'

export default defineNitroPlugin((nitroApp) => {
  const enrichers = [createUserAgentEnricher(), createGeoEnricher(), createRequestSizeEnricher()]
  nitroApp.hooks.hook('evlog:enrich', (ctx) => {
    for (const enricher of enrichers) enricher(ctx)
  })
})
