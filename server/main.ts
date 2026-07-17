import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createApp } from './app.ts'
import { parseCliArgs, type CliOption } from './cli.ts'
import { parseMap } from './map.ts'
import { parseGuests, Resort } from './resort.ts'

const webDir = resolve(import.meta.dirname, '../dist/web')

async function readOrFail(option: CliOption<string>, flag: string): Promise<string> {
  try {
    return await readFile(option.value, 'utf8')
  } catch (error) {
    const reason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'file not found' : (error as Error).message
    throw new Error(`Could not read the ${flag} file: ${reason}\n  ${option.value}`)
  }
}

const source = (option: CliOption<unknown>, flag: string) => (option.fromDefault ? '(default)' : `(${flag})`)

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const grid = parseMap(await readOrFail(options.map, '--map'))
  const guests = parseGuests(await readOrFail(options.bookings, '--bookings'))

  const resort = new Resort(grid, guests)
  createApp(resort, webDir).listen(options.port.value, () => {
    console.log(`\nResort map: http://localhost:${options.port.value} ${source(options.port, '--port')}`)
    console.log(`  map:      ${options.map.value} ${source(options.map, '--map')} — ${grid.width}x${grid.height}`)
    console.log(`  bookings: ${options.bookings.value} ${source(options.bookings, '--bookings')} — ${guests.length} guests\n`)
  })
}

main().catch((error: Error) => {
  console.error(`\n${error.message}\n`)
  process.exit(1)
})
