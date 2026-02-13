import { createHmac, timingSafeEqual } from 'node:crypto'
import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'
import { Message, parseMarkdown, stringifyMarkdown, type Adapter, type AdapterPostableMessage, type RawMessage, type WebhookOptions, type FetchResult, type ThreadInfo, type FormattedContent, type ChatInstance } from 'chat'
import { createError, log } from 'evlog'
import type { ThreadContext } from '../types'

export interface GitHubThreadId {
  owner: string
  repo: string
  issueNumber: number
}

export interface GitHubAdapterConfig {
  appId: string
  privateKey: string
  webhookSecret: string
  userName: string
  /** If true, the bot replies to all new issues even without a mention. Default: false. */
  replyToNewIssues?: boolean
}

interface GitHubComment {
  id: number
  body: string
  user: {
    id: number
    login: string
    avatar_url: string
    type: string
  }
  created_at: string
}

interface GitHubIssueCommentPayload {
  action: 'created' | 'edited' | 'deleted'
  issue: {
    number: number
  }
  comment: GitHubComment
  repository: {
    name: string
    owner: { login: string }
  }
}

interface GitHubIssuesPayload {
  action: string
  issue: {
    id: number
    number: number
    title: string
    body: string | null
    user: { login: string }
    created_at: string
  }
  repository: {
    name: string
    owner: { login: string }
  }
}

type GitHubRawMessage = {
  type: 'issue_comment'
  id: number
  body: string
  user: { login: string, type: string }
  created_at: string
}

export class SavoirGitHubAdapter implements Adapter<GitHubThreadId, GitHubRawMessage> {

  readonly name = 'github'
  readonly userName: string
  private webhookSecret: string
  private appId: string
  private privateKey: string
  private replyToNewIssues: boolean
  private chat: ChatInstance | null = null
  private octokitCache = new Map<string, { octokit: Octokit, expiresAt: number }>()

  /** Map normalized SDK emoji names to GitHub reaction content names */
  private static readonly EMOJI_MAP: Record<string, string> = {
    thumbs_up: '+1',
    thumbs_down: '-1',
  }

  private resolveEmoji(emoji: string): string {
    return SavoirGitHubAdapter.EMOJI_MAP[emoji] ?? emoji
  }

  constructor(config: GitHubAdapterConfig) {
    this.userName = config.userName
    this.webhookSecret = config.webhookSecret
    this.appId = config.appId
    this.privateKey = config.privateKey
    this.replyToNewIssues = config.replyToNewIssues ?? false
  }

  // eslint-disable-next-line
  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat
    log.info({
      event: 'github.adapter.initialized',
      userName: this.userName,
      replyToNewIssues: this.replyToNewIssues,
    })
  }

  private async getOctokit(owner: string, repo: string): Promise<Octokit> {
    const cacheKey = `${owner}/${repo}`
    const cached = this.octokitCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.octokit
    }

    const auth = createAppAuth({
      appId: this.appId,
      privateKey: this.privateKey,
    })

    const appOctokit = new Octokit({ authStrategy: createAppAuth, auth: { appId: this.appId, privateKey: this.privateKey } })

    let installation
    try {
      const result = await appOctokit.apps.getRepoInstallation({ owner, repo })
      installation = result.data
    } catch (error) {
      throw createError({
        message: `GitHub App not installed on ${cacheKey}`,
        why: error instanceof Error ? error.message : 'Failed to get installation',
        fix: `Install the GitHub App on the repository ${cacheKey} from the app settings page`,
      })
    }

    const { token } = await auth({ type: 'installation', installationId: installation.id })

    const octokit = new Octokit({ auth: token })

    this.octokitCache.set(cacheKey, { octokit, expiresAt: Date.now() + 50 * 60 * 1000 })

    log.info({
      event: 'github.octokit.created',
      repo: cacheKey,
      installationId: installation.id,
    })

    return octokit
  }

  private verifySignature(body: string, signature: string | null): boolean {
    if (!signature || !this.webhookSecret) return false

    const expected = `sha256=${createHmac('sha256', this.webhookSecret).update(body).digest('hex')}`
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    const body = await request.text()
    const signature = request.headers.get('X-Hub-Signature-256')
    const eventType = request.headers.get('X-GitHub-Event')
    const deliveryId = request.headers.get('X-GitHub-Delivery')

    if (!this.verifySignature(body, signature)) {
      log.warn({
        event: 'github.webhook.invalid_signature',
        deliveryId,
        eventType,
      })
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 })
    }

    log.info({
      event: 'github.webhook.received',
      eventType,
      deliveryId,
      chatReady: !!this.chat,
    })

    if (eventType === 'ping') {
      return new Response(JSON.stringify({ ok: true, message: 'pong' }), { status: 200 })
    }

    if (eventType === 'issue_comment') {
      const payload = JSON.parse(body) as GitHubIssueCommentPayload
      const repo = `${payload.repository.owner.login}/${payload.repository.name}`
      const issue = payload.issue.number

      if (payload.action !== 'created') {
        log.info({
          event: 'github.webhook.skipped',
          reason: 'action_not_created',
          action: payload.action,
          repo,
          issue,
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const botUserName = `${this.userName}[bot]`
      if (payload.comment.user.login === this.userName || payload.comment.user.login === botUserName) {
        log.info({
          event: 'github.webhook.skipped',
          reason: 'own_comment',
          author: payload.comment.user.login,
          repo,
          issue,
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const threadId = this.encodeThreadId({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issueNumber: issue,
      })

      const message = this.parseMessage({
        type: 'issue_comment',
        id: payload.comment.id,
        body: payload.comment.body,
        user: payload.comment.user,
        created_at: payload.comment.created_at,
      })

      log.info({
        event: 'github.webhook.processing',
        type: 'issue_comment',
        repo,
        issue,
        threadId,
        author: payload.comment.user.login,
        isMention: message.isMention,
        commentId: payload.comment.id,
      })

      this.chat!.processMessage(this, threadId, message, options)

      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (eventType === 'issues') {
      const payload = JSON.parse(body) as GitHubIssuesPayload
      const repo = `${payload.repository.owner.login}/${payload.repository.name}`
      const issue = payload.issue.number

      if (payload.action !== 'opened') {
        log.info({
          event: 'github.webhook.skipped',
          reason: 'action_not_opened',
          action: payload.action,
          repo,
          issue,
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const botUserName = `${this.userName}[bot]`
      if (payload.issue.user.login === this.userName || payload.issue.user.login === botUserName) {
        log.info({
          event: 'github.webhook.skipped',
          reason: 'own_issue',
          author: payload.issue.user.login,
          repo,
          issue,
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const issueText = `${payload.issue.title}\n\n${payload.issue.body || ''}`
      const hasMention = issueText.includes(`@${this.userName}`)

      if (!this.replyToNewIssues && !hasMention) {
        log.info({
          event: 'github.webhook.skipped',
          reason: 'no_mention_and_reply_disabled',
          repo,
          issue,
          replyToNewIssues: this.replyToNewIssues,
          hasMention,
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const threadId = this.encodeThreadId({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issueNumber: issue,
      })

      const message = this.parseMessage({
        type: 'issue_comment',
        id: payload.issue.id,
        body: issueText,
        user: { ...payload.issue.user, type: 'User' },
        created_at: payload.issue.created_at,
      })

      message.isMention = true

      log.info({
        event: 'github.webhook.processing',
        type: 'new_issue',
        repo,
        issue,
        threadId,
        author: payload.issue.user.login,
        hasMention,
        replyToNewIssues: this.replyToNewIssues,
      })

      this.chat!.processMessage(this, threadId, message, options)

      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    log.info({
      event: 'github.webhook.unhandled',
      eventType,
      deliveryId,
    })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }

  async postMessage(threadId: string, message: AdapterPostableMessage): Promise<RawMessage<GitHubRawMessage>> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    const body = typeof message === 'string' ? message : (message as { markdown?: string }).markdown || String(message)

    const { data } = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    })

    log.info({
      event: 'github.comment.posted',
      repo: `${owner}/${repo}`,
      issue: issueNumber,
      commentId: data.id,
    })

    return {
      id: String(data.id),
      threadId,
      raw: {
        type: 'issue_comment',
        id: data.id,
        body: data.body || '',
        user: { login: data.user?.login || '', type: data.user?.type || '' },
        created_at: data.created_at,
      },
    }
  }

  async editMessage(threadId: string, messageId: string, message: AdapterPostableMessage): Promise<RawMessage<GitHubRawMessage>> {
    const { owner, repo } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    const body = typeof message === 'string' ? message : (message as { markdown?: string }).markdown || String(message)

    const { data } = await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: Number(messageId),
      body,
    })

    return {
      id: String(data.id),
      threadId,
      raw: {
        type: 'issue_comment',
        id: data.id,
        body: data.body || '',
        user: { login: data.user?.login || '', type: data.user?.type || '' },
        created_at: data.created_at,
      },
    }
  }

  async deleteMessage(threadId: string, messageId: string): Promise<void> {
    const { owner, repo } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    await octokit.issues.deleteComment({
      owner,
      repo,
      comment_id: Number(messageId),
    })
  }

  async addReaction(threadId: string, messageId: string, emoji: string): Promise<void> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    const content = this.resolveEmoji(emoji) as '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'

    if (messageId.startsWith('issue:')) {
      await octokit.reactions.createForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        content,
      })
    } else {
      await octokit.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: Number(messageId),
        content,
      })
    }
  }

  async removeReaction(threadId: string, messageId: string, emoji: string): Promise<void> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    const resolvedEmoji = this.resolveEmoji(emoji)
    const botUserName = `${this.userName}[bot]`

    if (messageId.startsWith('issue:')) {
      const { data: reactions } = await octokit.reactions.listForIssue({
        owner,
        repo,
        issue_number: issueNumber,
      })

      const ourReaction = reactions.find(
        r => r.content === resolvedEmoji && (r.user?.login === this.userName || r.user?.login === botUserName),
      )
      if (!ourReaction) return

      await octokit.reactions.deleteForIssue({
        owner,
        repo,
        issue_number: issueNumber,
        reaction_id: ourReaction.id,
      })
    } else {
      const { data: reactions } = await octokit.reactions.listForIssueComment({
        owner,
        repo,
        comment_id: Number(messageId),
      })

      const ourReaction = reactions.find(
        r => r.content === resolvedEmoji && (r.user?.login === this.userName || r.user?.login === botUserName),
      )
      if (!ourReaction) return

      await octokit.reactions.deleteForIssueComment({
        owner,
        repo,
        comment_id: Number(messageId),
        reaction_id: ourReaction.id,
      })
    }
  }

  async startTyping(_threadId: string): Promise<void> {}

  async fetchMessages(threadId: string, options?: { limit?: number, cursor?: string, direction?: string }): Promise<FetchResult<GitHubRawMessage>> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    const perPage = options?.limit || 30

    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: perPage,
      ...(options?.cursor ? { since: options.cursor } : {}),
    })

    const messages = comments.map(c => this.parseMessage({
      type: 'issue_comment' as const,
      id: c.id,
      body: c.body || '',
      user: { login: c.user?.login || '', type: c.user?.type || '' },
      created_at: c.created_at,
    }))

    return { messages }
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    })

    return {
      id: threadId,
      channelId: `${owner}/${repo}`,
      channelName: `${owner}/${repo}#${issueNumber}`,
      metadata: {
        title: issue.title,
        state: issue.state,
        labels: issue.labels.map(l => typeof l === 'string' ? l : l.name || ''),
      },
    }
  }

  encodeThreadId(data: GitHubThreadId): string {
    return `github:${data.owner}/${data.repo}:issue:${data.issueNumber}`
  }

  decodeThreadId(threadId: string): GitHubThreadId {
    const match = threadId.match(/^github:([^/]+)\/([^:]+):issue:(\d+)$/)
    if (!match || !match[1] || !match[2] || !match[3]) {
      throw new Error(`Invalid GitHub thread ID: ${threadId}`)
    }

    return {
      owner: match[1],
      repo: match[2],
      issueNumber: Number.parseInt(match[3], 10),
    }
  }

  parseMessage(raw: GitHubRawMessage): Message<GitHubRawMessage> {
    const botUserName = `${this.userName}[bot]`
    const isBot = raw.user.type === 'Bot' || raw.user.login === this.userName || raw.user.login === botUserName
    const isMention = !isBot && raw.body.includes(`@${this.userName}`)

    return new Message<GitHubRawMessage>({
      id: String(raw.id),
      threadId: '',
      text: raw.body,
      formatted: parseMarkdown(raw.body),
      raw,
      author: {
        userId: raw.user.login,
        userName: raw.user.login,
        fullName: raw.user.login,
        isBot,
        isMe: isBot,
      },
      metadata: {
        dateSent: new Date(raw.created_at),
        edited: false,
      },
      attachments: [],
      isMention,
    })
  }

  renderFormatted(content: FormattedContent): string {
    return stringifyMarkdown(content)
  }

  async fetchThreadContext(threadId: string): Promise<ThreadContext> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const octokit = await this.getOctokit(owner, repo)

    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    })

    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 10,
      direction: 'desc',
    })

    const previousComments = comments.reverse().map(c => ({
      author: c.user?.login || 'unknown',
      body: c.body || '',
      isBot: c.user?.type === 'Bot',
    }))

    return {
      platform: 'github',
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      labels: issue.labels.map(l => typeof l === 'string' ? l : l.name || ''),
      state: issue.state,
      source: `${owner}/${repo}`,
      previousComments,
    }
  }

}
