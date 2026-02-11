import { admin } from 'better-auth/plugins'
import { sql } from 'drizzle-orm'

export default defineServerAuth(({ runtimeConfig, db }) => {
  const adminUsers = runtimeConfig.adminUsers?.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean) || []

  return {
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        scope: ['user:email'],
        mapProfileToUser: (profile: { name: string, login: string, avatar_url: string }) => ({
          name: profile.name || profile.login,
          image: profile.avatar_url,
          username: profile.login,
        }),
      },
    },
    user: {
      additionalFields: {
        username: { type: 'string' as const, required: false },
      },
    },
    plugins: [admin()],
    databaseHooks: {
      user: {
        create: {
          after: async (user: { id: string, email?: string, username?: string }) => {
            if ((user.email && adminUsers.includes(user.email.toLowerCase())) || (user.username && adminUsers.includes(user.username.toLowerCase()))) {
              await db.run(sql`UPDATE user SET role = 'admin' WHERE id = ${user.id}`)
            }
          },
        },
      },
    },
  }
})
