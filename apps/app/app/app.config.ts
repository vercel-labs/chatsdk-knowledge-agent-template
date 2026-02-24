export default defineAppConfig({
  app: {
    name: 'Knowledge Agent Template',
    description: 'Open source file-system and knowledge based agent template.',
    icon: 'i-simple-icons-vercel',
    repoUrl: 'https://github.com/vercel-labs/knowledge-agent-template',
    deployUrl: 'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fknowledge-agent-template&env=BETTER_AUTH_SECRET,GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET,AI_GATEWAY_API_KEY&envDescription=BETTER_AUTH_SECRET%3A%20run%20openssl%20rand%20-hex%2032%20%7C%20GITHUB_CLIENT_ID%20%2B%20SECRET%3A%20create%20a%20GitHub%20App%20at%20github.com%2Fsettings%2Fapps%2Fnew%20%7C%20AI_GATEWAY_API_KEY%3A%20create%20a%20gateway%20at%20vercel.com%2F~%2Fai&envLink=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fknowledge-agent-template%2Fblob%2Fmain%2Fdocs%2FENVIRONMENT.md&project-name=knowledge-agent&repository-name=knowledge-agent',
  },
  ui: {
    colors: {
      primary: 'neutral',
      neutral: 'neutral'
    },
    dashboardPanel: {
      slots: {
        root: 'min-h-[calc(100svh-1rem)]',
        body: 'sm:p-4 sm:gap-4'
      }
    },
    dashboardSidebar: {
      slots: {
        header: 'h-auto flex-col items-stretch gap-1.5 p-2',
        body: 'p-2 gap-1 overflow-hidden',
        footer: 'p-0',
        toggle: '-ms-1.5'
      }
    },
    dashboardNavbar: {
      slots: {
        root: 'sm:px-4 h-12',
        toggle: '-ms-1.5'
      }
    }
  }
})
