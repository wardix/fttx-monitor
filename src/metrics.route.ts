import { Hono } from 'hono'
import { getMetrics } from './metrics'

const app = new Hono()

app.get('/', async (c) => {
  const metrics = await getMetrics()
  return c.text(metrics)
})

export default app
