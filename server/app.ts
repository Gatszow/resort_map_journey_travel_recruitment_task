import express, { type ErrorRequestHandler } from 'express'
import type { Resort } from './resort.ts'

export function createApp(resort: Resort, staticDir?: string) {
  const app = express()
  app.use(express.json())

  app.get('/api/map', (_req, res) => {
    res.json(resort.getMap())
  })

  app.post('/api/bookings', (req, res) => {
    // Express 5 leaves req.body undefined when no JSON body was parsed.
    res.status(201).json(resort.book(req.body ?? {}))
  })

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'No such endpoint.' })
  })

  if (staticDir) app.use(express.static(staticDir))

  const handleErrors: ErrorRequestHandler = (error, _req, res, _next) => {
    const { status, statusCode, type, message } = error as {
      status?: number
      statusCode?: number
      type?: string
      message?: string
    }
    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body is not valid JSON.' })
      return
    }

    // Only client errors carry a message worth repeating; a 5xx message is ours, not theirs.
    const code = status ?? statusCode
    if (typeof code === 'number' && Number.isInteger(code) && code >= 400 && code < 500) {
      res.status(code).json({ error: message ?? 'We could not handle that request.' })
      return
    }

    console.error(error)
    res.status(500).json({ error: 'Something went wrong on our side.' })
  }
  app.use(handleErrors)

  return app
}
