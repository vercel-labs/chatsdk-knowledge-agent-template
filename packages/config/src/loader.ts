import { loadConfig } from 'c12'
import type {
  SavoirConfigInput,
  CustomSourceInput,
  LoadedConfig,
  Source,
  GitHubSource,
  YouTubeSource,
  CustomSource,
} from './types'
import { validateConfig } from './validation'
import { normalizeGitHubSource, normalizeYouTubeSource, normalizeCustomSource } from './normalize'

let configCwd: string | undefined

export interface LoadOptions {
  cwd?: string
}

/**
 * Load the Savoir configuration from savoir.config.{ts,js,json,yaml}
 */
export async function loadSavoirConfig(options?: LoadOptions): Promise<LoadedConfig> {
  if (options?.cwd) {
    configCwd = options.cwd
  }

  const { config } = await loadConfig<SavoirConfigInput>({
    name: 'savoir',
    cwd: configCwd,
    defaults: {
      sources: {
        github: [],
        youtube: [],
        custom: [],
      },
    },
  })

  const validated = validateConfig(config)

  const github = (validated.sources?.github ?? []).map(normalizeGitHubSource)
  const youtube = (validated.sources?.youtube ?? []).map(normalizeYouTubeSource)
  const custom = ((validated.sources?.custom ?? []) as CustomSourceInput[]).map(normalizeCustomSource)

  return {
    config: validated as SavoirConfigInput,
    sources: [...github, ...youtube, ...custom] as Source[],
    github,
    youtube,
    custom,
  }
}

/**
 * Set the config directory (call once at startup)
 */
export function setConfigCwd(cwd: string): void {
  configCwd = cwd
}

/**
 * Get all sources
 */
export async function getSources(): Promise<Source[]> {
  const config = await loadSavoirConfig()
  return config.sources
}

/**
 * Get GitHub sources only
 */
export async function getGitHubSources(): Promise<GitHubSource[]> {
  const config = await loadSavoirConfig()
  return config.github
}

/**
 * Get YouTube sources only
 */
export async function getYouTubeSources(): Promise<YouTubeSource[]> {
  const config = await loadSavoirConfig()
  return config.youtube
}

/**
 * Get custom sources only
 */
export async function getCustomSources(): Promise<CustomSource[]> {
  const config = await loadSavoirConfig()
  return config.custom
}

/**
 * Get a source by its ID
 */
export async function getSourceById(id: string): Promise<Source | undefined> {
  const config = await loadSavoirConfig()
  return config.sources.find(s => s.id === id)
}

/**
 * Get sources filtered by type
 */
export async function getSourcesByType<T extends Source['type']>(
  type: T
): Promise<Extract<Source, { type: T }>[]> {
  const config = await loadSavoirConfig()
  return config.sources.filter(s => s.type === type) as Extract<Source, { type: T }>[]
}
