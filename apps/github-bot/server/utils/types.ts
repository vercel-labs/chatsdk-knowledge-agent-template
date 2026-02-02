export interface GitHubThreadId {
  owner: string
  repo: string
  issueNumber: number
}

export interface GitHubComment {
  id: number
  node_id: string
  body: string
  user: {
    id: number
    login: string
    avatar_url: string
    type: string
  }
  created_at: string
  updated_at: string
  html_url: string
  issue_url: string
}

export interface GitHubIssueCommentPayload {
  action: 'created' | 'edited' | 'deleted'
  issue: {
    number: number
    title: string
    state: string
    body: string | null
    user: {
      id: number
      login: string
    }
  }
  comment: GitHubComment
  repository: {
    id: number
    name: string
    full_name: string
    owner: {
      login: string
    }
  }
  sender: {
    id: number
    login: string
    type: string
  }
}

export interface GitHubIssuesPayload {
  action: 'opened' | 'edited' | 'deleted' | 'closed' | 'reopened' | 'labeled' | 'unlabeled' | 'assigned' | 'unassigned'
  issue: {
    id: number
    number: number
    title: string
    state: string
    body: string | null
    user: {
      id: number
      login: string
      avatar_url: string
    }
    labels: Array<{ name: string }>
    created_at: string
    updated_at: string
    html_url: string
  }
  repository: {
    id: number
    name: string
    full_name: string
    owner: {
      login: string
    }
  }
  sender: {
    id: number
    login: string
    type: string
  }
}

export interface GitHubAdapterConfig {
  userName: string
  webhookSecret: string
  appId: string
  appPrivateKey: string
}

export interface IssueContext {
  number: number
  title: string
  body: string | null
  labels: string[]
  state: string
  owner: string
  repo: string
  previousComments?: Array<{
    author: string
    body: string
    isBot: boolean
  }>
}
