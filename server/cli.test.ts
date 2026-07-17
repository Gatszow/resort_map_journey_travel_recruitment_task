import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCliArgs } from './cli.ts'

describe('parseCliArgs', () => {
  it('falls back to the files in the working directory', () => {
    const options = parseCliArgs([])

    expect(options.map).toEqual({ value: resolve('map.ascii'), fromDefault: true })
    expect(options.bookings).toEqual({ value: resolve('bookings.json'), fromDefault: true })
    expect(options.port.value).toBe(3000)
  })

  it('resolves the paths it is given to absolute ones', () => {
    const options = parseCliArgs(['--map', 'maps/other.ascii', '--bookings', 'data/guests.json', '--port', '4000'])

    expect(options.map).toEqual({ value: resolve('maps/other.ascii'), fromDefault: false })
    expect(options.bookings).toEqual({ value: resolve('data/guests.json'), fromDefault: false })
    expect(options.port).toEqual({ value: 4000, fromDefault: false })
  })

  it.each([['--port', 'abc'], ['--port', '70000'], ['--port=-1'], ['--port', '3000.5']])(
    'rejects a port of %s %s',
    (...argv) => {
      expect(() => parseCliArgs(argv)).toThrow(/invalid --port/i)
    },
  )

  it('rejects a flag it does not know, rather than ignoring it', () => {
    expect(() => parseCliArgs(['--maps', 'typo.ascii'])).toThrow()
  })
})
