// auth.d.ts
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
    avatar: string
    username: string
    provider: 'github'
    providerId: number
    role: 'user' | 'admin'
  }
}

export {}
