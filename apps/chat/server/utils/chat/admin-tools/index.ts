import { queryStatsTool } from './query-stats'
import { listUsersTool } from './list-users'
import { listSourcesTool } from './list-sources'
import { queryChatsTool } from './query-chats'
import { runSqlTool } from './run-sql'
import { getAgentConfigTool } from './get-agent-config'
import { chartTool } from '~~/shared/utils/tools/chart'

export const adminTools = {
  query_stats: queryStatsTool,
  list_users: listUsersTool,
  list_sources: listSourcesTool,
  query_chats: queryChatsTool,
  run_sql: runSqlTool,
  get_agent_config: getAgentConfigTool,
  chart: chartTool,
}
