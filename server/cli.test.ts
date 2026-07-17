import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseCliArgs } from './cli.ts'

const originalPort = process.env.PORT

afterEach(() => {
  if (originalPort === undefined) delete process.env.PORT
  else process.env.PORT = originalPort
})

describe('parseCliArgs', () => {
  it('falls back to the files in the working directory', () => {
    delete process.env.PORT
    const options = parseCliArgs([])

    expect(options.map).toEqual({ value: resolve('map.ascii'), source: 'default' })
    expect(options.bookings).toEqual({ value: resolve('bookings.json'), source: 'default' })
    expect(options.port).toEqual({ value: 3000, source: 'default' })
  })

  it('resolves the paths it is given to absolute ones', () => {
    const options = parseCliArgs(['--map', 'maps/other.ascii', '--bookings', 'data/guests.json', '--port', '4000'])

    expect(options.map).toEqual({ value: resolve('maps/other.ascii'), source: 'flag' })
    expect(options.bookings).toEqual({ value: resolve('data/guests.json'), source: 'flag' })
    expect(options.port).toEqual({ value: 4000, source: 'flag' })
  })

  it('takes the port from the environment, and says so', () => {
    process.env.PORT = '8080'
    expect(parseCliArgs([]).port).toEqual({ value: 8080, source: 'env' })
  })

  it('lets --port win over the environment', () => {
    process.env.PORT = '8080'
    expect(parseCliArgs(['--port', '4000']).port).toEqual({ value: 4000, source: 'flag' })
  })

  it.each([
    ['abc', 'not a number'],
    ['70000', 'out of range'],
    ['3000.5', 'not an integer'],
    ['-1', 'negative'],
    ['0x50', 'radix notation would silently mean port 80'],
    ['1e3', 'exponent notation would silently mean port 1000'],
    ['', 'empty would silently mean a random port'],
  ])('rejects a --port of "%s" (%s)', (value) => {
    expect(() => parseCliArgs([`--port=${value}`])).toThrow(/invalid --port/i)
  })

  it('blames PORT, not --port, when the environment holds the bad value', () => {
    process.env.PORT = 'abc'
    expect(() => parseCliArgs([])).toThrow(/invalid PORT "abc"/i)
  })

  it('rejects a flag it does not know, rather than ignoring it', () => {
    expect(() => parseCliArgs(['--maps', 'typo.ascii'])).toThrow()
  })
})
