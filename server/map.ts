export type TileType = 'cabana' | 'pool' | 'path' | 'chalet' | 'empty'

const LEGEND: Record<string, TileType> = {
  W: 'cabana',
  p: 'pool',
  '#': 'path',
  c: 'chalet',
  '.': 'empty',
  ' ': 'empty',
}

export interface ResortGrid {
  width: number
  height: number
  tiles: TileType[][]
}

export function cabanaId(x: number, y: number): string {
  return `${x},${y}`
}

export function parseMap(text: string): ResortGrid {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
  if (lines.length === 0) throw new Error('Map file is empty.')

  const width = Math.max(...lines.map((line) => line.length))
  if (width === 0) throw new Error('Map file has no columns.')

  // Short rows are padded rather than rejected: a map is a drawing, and trailing
  // empty space is routinely lost by editors.
  const tiles = lines.map((line, y) =>
    [...line.padEnd(width, '.')].map((char, x) => {
      const type = LEGEND[char]
      if (!type) {
        throw new Error(
          `Unknown map character ${JSON.stringify(char)} at row ${y + 1}, column ${x + 1}. ` +
            `Expected one of: ${Object.keys(LEGEND).join(' ')}`,
        )
      }
      return type
    }),
  )

  return { width, height: lines.length, tiles }
}

export function listCabanaIds(grid: ResortGrid): string[] {
  const ids: string[] = []
  grid.tiles.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type === 'cabana') ids.push(cabanaId(x, y))
    })
  })
  return ids
}
