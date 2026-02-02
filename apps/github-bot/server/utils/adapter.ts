import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  Adapter,
  AdapterPostableMessage,
  ChatInstance,
  EmojiValue,
  FetchOptions,
  FetchResult,
  FormattedContent,
  RawMessage,
  ThreadInfo,
  WebhookOptions,
} from 'chat'
import { Message, NotImplementedError } from 'chat'
import { createGitHubAuth, type GitHubAuth } from './auth'
import { GitHubFormatConverter } from './markdown'
import type {
  GitHubAdapterConfig,
  GitHubComment,
  GitHubIssueCommentPayload,
  GitHubIssuesPayload,
  GitHubThreadId,
  IssueContext,
} from './types'

export class GitHubAdapter implements Adapter<GitHubThreadId, GitHubComment> {

  readonly name = 'github'
  readonly userName: string

  private chat!: ChatInstance
  private webhookSecret: string
  private auth: GitHubAuth
  private formatConverter: GitHubFormatConverter

  constructor(config: GitHubAdapterConfig) {
    this.userName = config.userName
    this.webhookSecret = config.webhookSecret
    this.auth = createGitHubAuth(config.appId, config.appPrivateKey)
    this.formatConverter = new GitHubFormatConverter()
  }

  private getToken(owner: string, repo: string): Promise<string> {
    return this.auth.getToken(owner, repo)
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat
  }

  async handleWebhook(request: Request, options?: WebhookOptions): Promise<Response> {
    const body = await request.text()

    const signature = request.headers.get('X-Hub-Signature-256')
    if (!this.verifySignature(body, signature)) {
      return new Response('Invalid signature', { status: 401 })
    }

    const event = request.headers.get('X-GitHub-Event')

    if (event === 'ping') {
      return new Response('pong', { status: 200 })
    }

    if (event === 'issue_comment') {
      return this.handleIssueComment(body, options)
    }

    if (event === 'issues') {
      return this.handleIssueEvent(body, options)
    }

    return new Response('OK', { status: 200 })
  }

  private handleIssueComment(body: string, options?: WebhookOptions): Response {
    const payload = JSON.parse(body) as GitHubIssueCommentPayload

    if (payload.action !== 'created') {
      return new Response('OK', { status: 200 })
    }

    const botUserName = `${this.userName}[bot]`
    if (payload.comment.user.login === this.userName || payload.comment.user.login === botUserName) {
      return new Response('OK', { status: 200 })
    }

    const threadId = this.encodeThreadId({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issueNumber: payload.issue.number,
    })

    const message = this.parseMessage(payload.comment)
    this.chat.processMessage(this, threadId, message, options)

    return new Response('OK', { status: 200 })
  }

  private handleIssueEvent(body: string, options?: WebhookOptions): Response {
    const payload = JSON.parse(body) as GitHubIssuesPayload

    if (payload.action !== 'opened') {
      return new Response('OK', { status: 200 })
    }

    const botUserName = `${this.userName}[bot]`
    if (payload.issue.user.login === this.userName || payload.issue.user.login === botUserName) {
      return new Response('OK', { status: 200 })
    }

    const threadId = this.encodeThreadId({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issueNumber: payload.issue.number,
    })

    const virtualComment = {
      id: `issue:${payload.issue.number}` as unknown as number,
      node_id: `issue_${payload.issue.id}`,
      body: `${payload.issue.title}\n\n${payload.issue.body || ''}`,
      user: {
        id: payload.issue.user.id,
        login: payload.issue.user.login,
        avatar_url: payload.issue.user.avatar_url,
        type: 'User',
      },
      created_at: payload.issue.created_at,
      updated_at: payload.issue.updated_at,
      html_url: payload.issue.html_url,
      issue_url: payload.issue.html_url,
    } as GitHubComment

    const message = this.parseMessage(virtualComment)
    this.chat.processMessage(this, threadId, message, options)

    return new Response('OK', { status: 200 })
  }

  private verifySignature(body: string, signature: string | null): boolean {
    if (!signature || !this.webhookSecret) {
      return false
    }

    const expected = `sha256=${createHmac('sha256', this.webhookSecret).update(body).digest('hex')}`

    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  }

  async postMessage(threadId: string, message: AdapterPostableMessage): Promise<RawMessage<GitHubComment>> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const body = this.renderPostable(message)
    const token = await this.getToken(owner, repo)

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ body }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${error}`)
    }

    const data = (await response.json()) as GitHubComment
    return { id: String(data.id), threadId, raw: data }
  }

  async editMessage(threadId: string, messageId: string, message: AdapterPostableMessage): Promise<RawMessage<GitHubComment>> {
    const { owner, repo } = this.decodeThreadId(threadId)
    const body = this.renderPostable(message)
    const token = await this.getToken(owner, repo)

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/comments/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({ body }),
      },
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${error}`)
    }

    const data = (await response.json()) as GitHubComment
    return { id: String(data.id), threadId, raw: data }
  }

  async deleteMessage(threadId: string, messageId: string): Promise<void> {
    const { owner, repo } = this.decodeThreadId(threadId)
    const token = await this.getToken(owner, repo)

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/comments/${messageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!response.ok && response.status !== 404) {
      const error = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${error}`)
    }
  }

  async addReaction(threadId: string, messageId: string, emoji: EmojiValue | string): Promise<void> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const reaction = this.emojiToGitHubReaction(emoji)
    const token = await this.getToken(owner, repo)

    const isIssue = messageId.startsWith('issue:')
    const url = isIssue
      ? `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/reactions`
      : `https://api.github.com/repos/${owner}/${repo}/issues/comments/${messageId}/reactions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ content: reaction }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${error}`)
    }
  }

  async removeReaction(threadId: string, messageId: string, emoji: EmojiValue | string): Promise<void> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const reaction = this.emojiToGitHubReaction(emoji)
    const token = await this.getToken(owner, repo)

    const isIssue = messageId.startsWith('issue:')
    const baseUrl = isIssue
      ? `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/reactions`
      : `https://api.github.com/repos/${owner}/${repo}/issues/comments/${messageId}/reactions`

    const listResponse = await fetch(baseUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!listResponse.ok) return

    const reactions = (await listResponse.json()) as Array<{
      id: number
      content: string
      user: { login: string }
    }>

    const botUserName = `${this.userName}[bot]`
    const ourReaction = reactions.find(
      r => r.content === reaction && (r.user.login === this.userName || r.user.login === botUserName),
    )

    if (!ourReaction) return

    await fetch(`${baseUrl}/${ourReaction.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
  }

  private emojiToGitHubReaction(emoji: EmojiValue | string): string {
    const name = typeof emoji === 'string' ? emoji : emoji.name
    const mapping: Record<string, string> = {
      thumbs_up: '+1',
      thumbs_down: '-1',
      laugh: 'laugh',
      confused: 'confused',
      heart: 'heart',
      party: 'hooray',
      rocket: 'rocket',
      eyes: 'eyes',
    }
    return mapping[name] || 'eyes'
  }

  async startTyping(): Promise<void> {}

  async fetchMessages(threadId: string, options?: FetchOptions): Promise<FetchResult<GitHubComment>> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const limit = options?.limit || 30
    const direction = options?.direction || 'backward'

    let url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${limit}`
    if (options?.cursor) {
      url += `&page=${options.cursor}`
    }
    url += '&sort=created&direction=asc'

    const token = await this.getToken(owner, repo)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${error}`)
    }

    const comments = (await response.json()) as GitHubComment[]

    const linkHeader = response.headers.get('Link')
    let nextCursor: string | undefined

    if (linkHeader) {
      const nextMatch = linkHeader.match(/<[^>]+[?&]page=(\d+)[^>]*>;\s*rel="next"/)
      if (nextMatch) {
        nextCursor = nextMatch[1]
      }
    }

    const messages = comments.map(comment => this.parseMessage(comment))

    if (direction === 'backward') {
      messages.reverse()
    }

    return { messages, nextCursor }
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const token = await this.getToken(owner, repo)

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error: ${response.status} - ${error}`)
    }

    const issue = (await response.json()) as {
      number: number
      title: string
      state: string
      html_url: string
    }

    return {
      id: threadId,
      channelId: `${owner}/${repo}`,
      channelName: `${owner}/${repo}#${issueNumber}`,
      isDM: false,
      metadata: {
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
      },
    }
  }

  async fetchIssueContext(threadId: string): Promise<IssueContext> {
    const { owner, repo, issueNumber } = this.decodeThreadId(threadId)
    const token = await this.getToken(owner, repo)

    const issueResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    if (!issueResponse.ok) {
      const error = await issueResponse.text()
      throw new Error(`GitHub API error: ${issueResponse.status} - ${error}`)
    }

    const issue = (await issueResponse.json()) as {
      number: number
      title: string
      body: string | null
      state: string
      labels: Array<{ name: string }>
    }

    const commentsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=10&sort=created&direction=desc`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    )

    let previousComments: Array<{ author: string, body: string, isBot: boolean }> = []
    if (commentsResponse.ok) {
      const comments = (await commentsResponse.json()) as Array<{
        user: { login: string, type: string }
        body: string
      }>

      previousComments = comments.reverse().map(c => ({
        author: c.user.login,
        body: c.body,
        isBot: c.user.type === 'Bot',
      }))
    }

    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: issue.labels.map(l => l.name),
      state: issue.state,
      owner,
      repo,
      previousComments,
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

  parseMessage(raw: GitHubComment): Message<GitHubComment> {
    return new Message<GitHubComment>({
      id: String(raw.id),
      threadId: '',
      text: raw.body,
      formatted: this.formatConverter.toAst(raw.body),
      raw,
      author: {
        userId: String(raw.user.id),
        userName: raw.user.login,
        fullName: raw.user.login,
        isBot: raw.user.type === 'Bot',
        isMe: raw.user.login === this.userName || raw.user.login === `${this.userName}[bot]`,
      },
      metadata: {
        dateSent: new Date(raw.created_at),
        edited: raw.created_at !== raw.updated_at,
        editedAt: raw.created_at !== raw.updated_at ? new Date(raw.updated_at) : undefined,
      },
      attachments: [],
    })
  }

  renderFormatted(content: FormattedContent): string {
    return this.formatConverter.fromAst(content)
  }

  private renderPostable(message: AdapterPostableMessage): string {
    if (typeof message === 'string') return message
    if ('raw' in message) return message.raw
    if ('markdown' in message) return message.markdown
    if ('ast' in message) return this.formatConverter.fromAst(message.ast)
    if ('card' in message) throw new NotImplementedError('Cards are not supported on GitHub')
    throw new NotImplementedError('Cards are not supported on GitHub')
  }

}

export function createGitHubAdapter(config: GitHubAdapterConfig): GitHubAdapter {
  return new GitHubAdapter(config)
}
