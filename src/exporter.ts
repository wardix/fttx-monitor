import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { basicAuth } from 'hono/basic-auth'
import { BASIC_USERS, PORT } from './config'
import metrics from './metrics.route'

const app = new Hono()

const validUsers = new Set(JSON.parse(BASIC_USERS))
const verifyUser = (username: string, password: string, _c: any) =>
  validUsers.has(`${username}:${password}`)
const authMiddleware = basicAuth({ verifyUser })

app.use(logger())
app.use('/metrics', authMiddleware)

app.get('/', (c) => {
  return c.text('OK')
})

app.route('/metrics', metrics)

export default {
  port: +PORT,
  fetch: app.fetch,
}
