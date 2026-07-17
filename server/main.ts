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

function shows(option: CliOption<unknown>, flag: string): string {
  return { default: '(default)', env: '(PORT)', flag: `(${flag})` }[option.source]
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  const grid = parseMap(await readOrFail(options.map, '--map'))
  const guests = parseGuests(await readOrFail(options.bookings, '--bookings'))

  const resort = new Resort(grid, guests)
  const server = createApp(resort, webDir).listen(options.port.value, () => {
    console.log(`\nResort map: http://localhost:${options.port.value} ${shows(options.port, '--port')}`)
    console.log(`  map:      ${options.map.value} ${shows(options.map, '--map')} — ${grid.width}x${grid.height}`)
    console.log(`  bookings: ${options.bookings.value} ${shows(options.bookings, '--bookings')} — ${guests.length} guests\n`)
  })

  // listen() reports failure by event, so this never reaches main()'s catch on its own.
  server.on('error', (error: NodeJS.ErrnoException) => {
    const reason =
      error.code === 'EADDRINUSE'
        ? `port ${options.port.value} is already in use. Pass a free one with --port.`
        : error.message
    console.error(`\nCould not start the server: ${reason}\n`)
    process.exit(1)
  })
}

main().catch((error: Error) => {
  console.error(`\n${error.message}\n`)
  process.exit(1)
})
