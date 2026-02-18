import path from 'node:path'

export const ALLOWED_BASH_COMMANDS = new Set([
  // File discovery
  'find',
  'ls',
  'tree',
  // Content search
  'grep',
  'egrep',
  'fgrep',
  // File reading
  'cat',
  'head',
  'tail',
  'less',
  'more',
  // Text processing (output filtering)
  'wc',
  'sort',
  'uniq',
  'cut',
  'awk',
  'sed',
  'tr',
  'column',
  // Utilities
  'echo',
  'printf',
  'test',
  '[',
  'true',
  'false',
  'basename',
  'dirname',
  'realpath',
  'file',
  'stat',
  'du',
  'diff',
  'comm',
  'xargs',
  'tee',
  // String/path helpers
  'md5sum',
  'sha256sum',
])

export const BLOCKED_SHELL_PATTERNS = [
  /\$\(/, // command substitution $(...)
  /`[^`]+`/, // backtick substitution
  /\beval\b/, // eval
  /\bexec\b/, // exec
  /\bsource\b/, // source
  /\bbash\b/, // nested bash
  /\bsh\b/, // nested sh
  /\bzsh\b/, // nested zsh
  /\benv\b/, // env (can run arbitrary commands)
  />\s*[^\s|]/, // write redirection (> file)
  /\bpython\b/, // interpreter
  /\bnode\b/, // interpreter
  /\bperl\b/, // interpreter
  /\bruby\b/, // interpreter
]

export function isPathWithinDirectory(filePath: string, directory: string): boolean {
  const resolvedPath = path.resolve(filePath)
  const resolvedDir = path.resolve(directory)
  return resolvedPath.startsWith(`${resolvedDir}${path.sep}`) || resolvedPath === resolvedDir
}

export function pathMatchesGlob(filePath: string, glob: string, baseDir: string): boolean {
  const resolvedPath = path.resolve(filePath)
  const resolvedBase = path.resolve(baseDir)

  if (!isPathWithinDirectory(resolvedPath, resolvedBase)) {
    return false
  }

  const relativePath = path.relative(resolvedBase, resolvedPath).replace(/\\/g, '/')

  try {
    const globRegex = glob
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*')
      .replace(/\//g, '\\/')

    const regex = new RegExp(`^${globRegex}`)
    if (regex.test(relativePath)) {
      return true
    }

    if (glob.endsWith('/**') && !relativePath.endsWith('/')) {
      return regex.test(`${relativePath}/`)
    }

    return false
  } catch {
    return false
  }
}

export interface ShellValidationOptions {
  allowedCommands?: Set<string>
  blockedPatterns?: RegExp[]
  allowedBaseDirectory?: string
}

export type ShellValidationResult =
  | { ok: true }
  | { ok: false, reason: string }

function extractPotentialPathTokens(command: string): string[] {
  const tokenRegex = /(?:^|\s)(\/[^\s|;&]+|\.{1,2}\/[^\s|;&]+)/g
  const tokens: string[] = []

  let match: RegExpExecArray | null = null
  while ((match = tokenRegex.exec(command)) !== null) {
    const [, token] = match
    if (token) {
      tokens.push(token.replace(/^['"]|['"]$/g, ''))
    }
  }

  return tokens
}

function validatePaths(command: string, allowedBaseDirectory?: string): ShellValidationResult {
  if (!allowedBaseDirectory) {
    return { ok: true }
  }

  const tokens = extractPotentialPathTokens(command)
  for (const token of tokens) {
    if (token.startsWith('../')) {
      return { ok: false, reason: `Path traversal is not allowed: ${token}` }
    }
    if (token.startsWith('/')) {
      if (!isPathWithinDirectory(token, allowedBaseDirectory)) {
        return { ok: false, reason: `Path outside sandbox is not allowed: ${token}` }
      }
    }
  }

  return { ok: true }
}

export function validateShellCommand(
  command: string,
  options?: ShellValidationOptions,
): ShellValidationResult {
  const blockedPatterns = options?.blockedPatterns ?? BLOCKED_SHELL_PATTERNS
  const allowedCommands = options?.allowedCommands ?? ALLOWED_BASH_COMMANDS

  for (const pattern of blockedPatterns) {
    if (pattern.test(command)) {
      return { ok: false, reason: `Command contains blocked pattern: ${command.slice(0, 50)}` }
    }
  }

  const segments = command.split(/\s*(?:\|(?!\|)|\|\||&&|;)\s*/)
  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const words = trimmed.split(/\s+/)
    const cmdName = words.find(w => !w.includes('=')) || words[0]
    if (!cmdName || !allowedCommands.has(cmdName)) {
      return { ok: false, reason: `Command not allowed: ${cmdName || 'unknown'}` }
    }
  }

  return validatePaths(command, options?.allowedBaseDirectory)
}
