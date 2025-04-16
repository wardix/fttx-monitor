import axios, { AxiosError } from 'axios'
import { initDb } from './surreal'
import { RecordId, Surreal } from 'surrealdb'
import {
  BACKOFF_MAX,
  BACKOFF_MIN,
  COMMAND_API_KEY,
  COMMAND_API_TIMEOUT,
  COMMAND_API_URL,
  CONCURRENT_LIMIT,
  PERIOD_CACHE,
  PERIOD_SUSPEND,
  PERIOD_SYNC,
  QUERY_LIMIT,
} from './config'

// Type Definitions
interface FttxRxPowerRecord {
  id: {
    id: string
  }
  executed_at: string // Assuming ISO string, adjust if different
}

interface ApiResponse {
  result?: Array<{ command_return?: string }>
  status?: string
  [key: string]: any
}

async function main() {
  const db: Surreal | undefined = await initDb()
  if (!db) {
    throw new Error('Database initialization failed')
  }

  let backoff = BACKOFF_MIN

  while (true) {
    try {
      const now = Math.floor(Date.now() / 1000) // Current timestamp in seconds
      const query = `
        SELECT id, executed_at 
        FROM fttx_rx_power
        WHERE deleted_at IS NONE
          AND (time::unix(synced_at) + ${PERIOD_SYNC}) > ${now}
          AND (output IS NONE OR (time::unix(executed_at) + ${PERIOD_CACHE}) < ${now})
          AND (suspended_at IS NONE OR (time::unix(suspended_at) + suspended_period) < ${now})
        ORDER BY executed_at
        LIMIT ${QUERY_LIMIT}
      `

      const [rows] = await db.query(query)
      if (!Array.isArray(rows)) {
        console.warn('Unexpected query result format:', rows)
        continue
      }

      if (rows.length === 0) {
        console.log(`No records processed. Waiting for ${backoff / 1000}s.`)
        await delay(backoff)
        backoff = Math.min(backoff * 2, BACKOFF_MAX)
        continue
      }

      backoff = BACKOFF_MIN // Reset backoff since we have work to do

      // Process records concurrently with limited concurrency to improve performance
      const chunks = chunkArray(rows, CONCURRENT_LIMIT)

      for (const chunk of chunks) {
        await Promise.all(chunk.map((record) => processRecord(record, db)))
      }
    } catch (error) {
      console.error('Unexpected error in main loop:', error)
      // Optionally implement a backoff here as well
      await delay(backoff)
      backoff = Math.min(backoff * 2, BACKOFF_MAX)
    }
  }
}

// Helper function to process individual records
async function processRecord(record: FttxRxPowerRecord, db: Surreal) {
  const cid = record.id.id
  const now = new Date()
  const nowStr = Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(now)
    .replace(', ', ' ')

  const params = {
    customerID: cid,
    commandName: 'RxPower',
  }

  try {
    const response = await axios.get<ApiResponse>(COMMAND_API_URL, {
      params,
      headers: {
        'X-Api-Key': COMMAND_API_KEY,
      },
      timeout: COMMAND_API_TIMEOUT, // Set a timeout for the request
    })

    const data = response.data

    if (!data.result) {
      if (data.status) {
        await updateRecordOnError(db, cid, now, data.status)
        console.warn(`${nowStr} ${cid}: ${data.status}`)
        return
      }
      console.warn(`${nowStr} ${cid}:`, data)
      return
    }

    const commandReturn = data.result[0]?.command_return
    if (commandReturn === undefined) {
      console.warn(`${nowStr} ${cid}:`, data.result)
      return
    }

    if (!commandReturn.endsWith('(dbm)')) {
      console.warn(`${nowStr} ${cid}: "${commandReturn}"`)
      await updateRecordOnError(db, cid, now, commandReturn)
      return
    }

    const outputStr = commandReturn.slice(0, -5)
    const output = Number(outputStr)
    if (isNaN(output)) {
      console.warn(`Failed to parse output for CID ${cid}: ${outputStr}`)
      await updateRecordOnError(db, cid, now, 'Invalid output format')
      return
    }

    console.log(`${nowStr} ${cid}: ${commandReturn}`)
    await db.merge(new RecordId('fttx_rx_power', cid), {
      executed_at: now,
      updated_at: now,
      output,
    })
  } catch (error) {
    handleAxiosError(error, db, cid, now)
  }
}

// Helper function to update records on error
async function updateRecordOnError(
  db: Surreal,
  cid: string,
  now: Date,
  errorMsg: string,
) {
  await db.merge(new RecordId('fttx_rx_power', cid), {
    executed_at: now,
    suspended_at: now,
    updated_at: now,
    suspended_period: PERIOD_SUSPEND,
    error: errorMsg,
  })
}

// Helper function to handle Axios errors
async function handleAxiosError(
  error: unknown,
  db: Surreal,
  cid: string,
  now: Date,
) {
  const nowStr = Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(now)
    .replace(', ', ' ')
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError
    if (axiosError.response?.status === 504) {
      console.warn(
        `${nowStr} ${cid}: Gateway Timeout -`,
        axiosError.response.data,
      )
      await db.merge(new RecordId('fttx_rx_power', cid), {
        suspended_at: now,
        updated_at: now,
        suspended_period: 0,
      })
    } else {
      console.error(`${nowStr} ${cid}: Axios error -`, axiosError.message)
      // Optionally, update the record with the error status/message
    }
  } else {
    console.error(`${nowStr} ${cid}: Unexpected error -`, error)
    // Optionally, update the record with a generic error status
  }
}

// Utility function to delay execution
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Utility function to chunk an array into smaller arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1) // Exit the process with failure
})
