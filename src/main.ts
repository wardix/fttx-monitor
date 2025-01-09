import axios from 'axios'
import { initDb } from './surreal'
import { RecordId } from 'surrealdb'

async function main() {
  const db = await initDb()
  if (!db) {
    throw new Error('Database initialization failed')
  }

  const errorSuspendPeriod = 14400
  const outputCachePeriod = 7200
  const syncPeriod = 14400
  const maxBackoff = 960000
  const defaultBackoff = 1000

  let backoff = defaultBackoff
  while (true) {
    const now = new Date()
    const nowTimeStamp = Math.floor(now.getTime() / 1000)
    const query =
      'SELECT id, executed_at FROM fttx_rx_power' +
      ' WHERE deleted_at IS NONE' +
      ` AND (time::unix(synced_at) + ${syncPeriod}) > ${nowTimeStamp}` +
      ` AND (output IS NONE OR (time::unix(executed_at) + ${outputCachePeriod}) < ${nowTimeStamp})` +
      ` AND (suspended_at IS NONE OR (time::unix(suspended_at) + suspended_period) < ${nowTimeStamp})` +
      ' ORDER BY executed_at' +
      ' LIMIT 100'
    const [rows] = await db.query(query)
    let processed = 0
    for (const row of rows as { id: { id: string } }[]) {
      const cid = row.id.id
      const now = new Date()
      const url = 'https://fsfttx.nusa.net.id/api/command'
      const params = {
        customerID: cid,
        commandName: 'RxPower',
      }
      processed += 1
      try {
        const response = await axios({
          method: 'GET',
          url,
          params,
          headers: {
            'X-Api-Key': '8558920cd3ec281925439daa7d7112fa',
          },
        })
        if (!('result' in response.data)) {
          console.log(response.data)
          if ('status' in response.data) {
            await db.merge(new RecordId('fttx_rx_power', cid), {
              executed_at: now,
              suspended_at: now,
              updated_at: now,
              suspended_period: errorSuspendPeriod,
              error: response.data.status,
            })
          }
          continue
        }
        if (!('command_return' in response.data.result[0])) {
          console.log(response.data.result)
          continue
        }
        if (!response.data.result[0].command_return.endsWith('(dbm)')) {
          console.log(`${cid} "${response.data.result[0].command_return}"`)
          await db.merge(new RecordId('fttx_rx_power', cid), {
            executed_at: now,
            suspended_at: now,
            updated_at: now,
            suspended_period: errorSuspendPeriod,
            error: response.data.result[0].command_return,
          })
          continue
        }
        const output = Number(
          response.data.result[0].command_return.slice(0, -5),
        )
        console.log(`${cid} ${response.data.result[0].command_return}`)
        await db.merge(new RecordId('fttx_rx_power', cid), {
          executed_at: now,
          updated_at: now,
          output,
        })
      } catch (error: any) {
        if (error.status === 504) {
          console.log(`${cid} ${error.response.data}`)
          await db.merge(new RecordId('fttx_rx_power', cid), {
            suspended_at: now,
            updated_at: now,
          })
        } else {
          console.error(error)
        }
      }
    }
    if (processed === 0) {
      console.log(`No records processed. Waiting for ${backoff / 1000}s.`)
      await new Promise((resolve) => setTimeout(resolve, backoff))
      backoff = Math.min(backoff * 2, maxBackoff)
    } else {
      backoff = defaultBackoff
    }
  }
}

main().catch((error) => {
  console.error(error)
})
