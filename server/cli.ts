import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

export type OptionSource = 'default' | 'flag' | 'env'

export interface CliOption<T> {
  value: T
  source: OptionSource
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

  return {
    map: file(values.map, 'map.ascii'),
    bookings: file(values.bookings, 'bookings.json'),
    port: port(values.port),
  }
}

function file(flag: string | undefined, fallback: string): CliOption<string> {
  return { value: resolve(flag ?? fallback), source: flag === undefined ? 'default' : 'flag' }
}

function port(flag: string | undefined): CliOption<number> {
  const source: OptionSource = flag !== undefined ? 'flag' : process.env.PORT !== undefined ? 'env' : 'default'
  const raw = (flag ?? process.env.PORT ?? '3000').trim()

  // Number() would happily take "0x50" as 80 and "" as 0, neither of which the guest meant.
  if (!/^\d+$/.test(raw) || Number(raw) > 65535) {
    const label = source === 'env' ? 'PORT' : '--port'
    throw new Error(`Invalid ${label} "${raw}". Expected an integer between 0 and 65535.`)
  }
  return { value: Number(raw), source }
}
