import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

export interface CliOption<T> {
  value: T
  fromDefault: boolean
}

export interface CliOptions {
  map: CliOption<string>
  bookings: CliOption<string>
  port: CliOption<number>
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      map: { type: 'string' },
      bookings: { type: 'string' },
      port: { type: 'string' },
    },
  })

  const port = Number(values.port ?? process.env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid --port "${values.port}". Expected an integer between 0 and 65535.`)
  }

  return {
    map: { value: resolve(values.map ?? 'map.ascii'), fromDefault: values.map === undefined },
    bookings: { value: resolve(values.bookings ?? 'bookings.json'), fromDefault: values.bookings === undefined },
    port: { value: port, fromDefault: values.port === undefined },
  }
}
