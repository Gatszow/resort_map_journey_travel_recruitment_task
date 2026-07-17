import type { MapTile, TileType } from './api.ts'

export interface TileSprite {
  src: string
  rotation: number
}

const asset = (name: string) => `/assets/${name}.png`

/**
 * Path sprites are drawn in one fixed orientation each (measured from the source
 * artwork): straight connects N-S, corner N-E, split N-S-E, end S, crossing all four.
 * We rotate clockwise to match the neighbours a tile actually has.
 */
function pathSprite(connections: Set<string>): TileSprite {
  const clockwise = ['N', 'E', 'S', 'W']
  const has = (d: string) => connections.has(d)
  const size = connections.size

  if (size === 4) return { src: asset('arrowCrossing'), rotation: 0 }

  if (size === 3) {
    const missing = clockwise.find((d) => !has(d))!
    const rotation = { W: 0, N: 90, E: 180, S: 270 }[missing]!
    return { src: asset('arrowSplit'), rotation }
  }

  if (size === 2) {
    if (has('N') && has('S')) return { src: asset('arrowStraight'), rotation: 0 }
    if (has('E') && has('W')) return { src: asset('arrowStraight'), rotation: 90 }
    const corners: Record<string, number> = { NE: 0, ES: 90, SW: 180, NW: 270 }
    const key = clockwise.filter(has).join('')
    return { src: asset('arrowCornerSquare'), rotation: corners[key] ?? 0 }
  }

  if (size === 1) {
    const only = clockwise.find(has)!
    const rotation = { S: 0, W: 90, N: 180, E: 270 }[only]!
    return { src: asset('arrowEnd'), rotation }
  }

  return { src: asset('arrowStraight'), rotation: 0 }
}

function pathConnections(tiles: MapTile[][], x: number, y: number): Set<string> {
  const isPath = (nx: number, ny: number) => tiles[ny]?.[nx]?.type === 'path'
  const found = new Set<string>()
  if (isPath(x, y - 1)) found.add('N')
  if (isPath(x + 1, y)) found.add('E')
  if (isPath(x, y + 1)) found.add('S')
  if (isPath(x - 1, y)) found.add('W')
  return found
}

const STATIC_SPRITES: Partial<Record<TileType, string>> = {
  cabana: 'cabana',
  chalet: 'houseChimney',
}

export function spriteFor(tiles: MapTile[][], x: number, y: number): TileSprite | null {
  const tile = tiles[y][x]
  if (tile.type === 'path') return pathSprite(pathConnections(tiles, x, y))

  const name = STATIC_SPRITES[tile.type]
  return name ? { src: asset(name), rotation: 0 } : null
}

export interface PoolArea {
  x: number
  y: number
  width: number
  height: number
}

export const poolImage = asset('pool')

/**
 * The pool drawing is one picture, not a tile, so it is laid over the water once.
 * A map whose pool tiles are not a single filled rectangle (two pools, an L shape)
 * gets plain water instead of one stretched drawing spanning the lot.
 */
export function poolArea(tiles: MapTile[][]): PoolArea | null {
  const cells = tiles.flatMap((row, y) => row.flatMap((tile, x) => (tile.type === 'pool' ? [{ x, y }] : [])))
  if (cells.length === 0) return null

  const xs = cells.map((c) => c.x)
  const ys = cells.map((c) => c.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const width = Math.max(...xs) - x + 1
  const height = Math.max(...ys) - y + 1

  return width * height === cells.length ? { x, y, width, height } : null
}
