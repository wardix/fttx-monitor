export const PORT = Number(process.env.PORT || 3001)
export const BASIC_USERS = process.env.BASIC_USERS || '["nis:secret"]'

export const SURREALDB_URL =
  process.env.SURREALDB_URL || 'ws://localhost:8000/rpc'
export const SURREALDB_NAMESPACE = process.env.SURREALDB_NAMESPACE || 'nis'
export const SURREALDB_DATABASE = process.env.SURREALDB_DATABASE || 'nis'
export const SURREALDB_USERNAME = process.env.SURREALDB_USERNAME || 'root'
export const SURREALDB_PASSWORD = process.env.SURREALDB_PASSWORD || 'secret'

export const QUERY_LIMIT = Number(process.env.QUERY_LIMIT || 64)

export const CONCURRENT_LIMIT = Number(process.env.CONCURRENT_LIMIT || 1)

export const PERIOD_SYNC = Number(process.env.PERIOD_SYNC || 14400)
export const PERIOD_SUSPEND = Number(process.env.PERIOD_SUSPEND || 14400)
export const PERIOD_CACHE = Number(process.env.PERIOD_CACHE || 7200)
export const PERIOD_GRACE = Number(process.env.PERIOD_GRACE || 3600)

export const BACKOFF_MIN = Number(process.env.BACKOFF_MIN || 1000)
export const BACKOFF_MAX = Number(process.env.BACKOFF_MAX || 960000)

export const COMMAND_API_URL =
  process.env.COMMAND_API_URL || 'http://localhost:3000/api/command'
export const COMMAND_API_KEY = process.env.COMMAND_API_KEY || '0123456789abcdef'
export const COMMAND_API_TIMEOUT = Number(
  process.env.COMMAND_API_TIMEOUT || 16000,
)
