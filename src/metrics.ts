import { PERIOD_SYNC } from './config'
import { initDb } from './surreal'

export async function getMetrics() {
  const db = await initDb()

  if (!db) {
    return ''
  }

  const now = Math.floor(Date.now() / 1000)
  const metricLines: string[] = []

  const [outputResult] = await db.query<any[]>(
    [
      'SELECT id, output FROM fttx_rx_power',
      'WHERE deleted_at IS NONE', // not deleted
      'AND NOT(output IS NONE)', // has output
      `AND (time::unix(synced_at) + ${PERIOD_SYNC}) > ${now}`, // not out of sync
      `AND (time::unix(suspended_at) + suspended_period) < ${now}`, // not suspended
    ].join(' '),
  )

  outputResult.forEach(
    ({ id, output }: { id: { id: string }; output: number }) => {
      metricLines.push(`fttx_rx_power{CID="${id.id}"} ${output}`)
    },
  )

  const [errorResult] = await db.query<any[]>(
    [
      'SELECT id, error FROM fttx_rx_power',
      'WHERE deleted_at IS NONE', // not deleted
      'AND NOT(error IS NONE)', // has error
      'AND suspended_at = executed_at', // suspended by error during execution
      `AND (time::unix(synced_at) + ${PERIOD_SYNC}) > ${now}`, // not out of sync
      `AND (time::unix(suspended_at) + suspended_period) > ${now}`, // suspended
    ].join(' '),
  )

  errorResult.forEach(
    ({ id, error }: { id: { id: string }; error: number }) => {
      if (!error) {
        return
      }
      metricLines.push(
        `fttx_rx_power_error{CID="${id.id}",message="${error}"} 1`,
      )
    },
  )

  return metricLines.join('\n')
}
