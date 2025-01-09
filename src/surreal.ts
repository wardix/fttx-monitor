import { Surreal } from 'surrealdb'
import {
  SURREALDB_DATABASE,
  SURREALDB_NAMESPACE,
  SURREALDB_PASSWORD,
  SURREALDB_URL,
  SURREALDB_USERNAME,
} from './config'

let db: Surreal | undefined

export async function initDb(): Promise<Surreal | undefined> {
  if (db) return db
  db = new Surreal()
  try {
    await db.connect(SURREALDB_URL, {
      namespace: SURREALDB_NAMESPACE,
      database: SURREALDB_DATABASE,
      auth: { username: SURREALDB_USERNAME, password: SURREALDB_PASSWORD },
    })
    return db
  } catch (err) {
    console.error('Failed to connect to SurrealDB:', err)
    throw err
  }
}

export async function closeDb(): Promise<void> {
  if (!db) return
  await db.close()
  db = undefined
}

export function getDb(): Surreal | undefined {
  return db
}
