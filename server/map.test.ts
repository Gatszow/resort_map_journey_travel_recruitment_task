import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { listCabanaIds, parseMap } from './map.ts'

const realMap = await readFile('map.ascii', 'utf8')

describe('parseMap', () => {
  it('reads the resort map shipped with the task', () => {
    const grid = parseMap(realMap)
    expect(grid.width).toBe(20)
    expect(grid.height).toBe(19)

    const counts = grid.tiles.flat().reduce<Record<string, number>>((acc, type) => {
      acc[type] = (acc[type] ?? 0) + 1
      return acc
    }, {})
    expect(counts).toEqual({ empty: 194, path: 97, cabana: 47, pool: 24, chalet: 18 })
  })

  it('parses CRLF exactly like LF', () => {
    // Git on Windows can hand us CRLF; a stray \r must not become an unknown tile.
    expect(parseMap(realMap.replace(/\n/g, '\r\n'))).toEqual(parseMap(realMap))
  })

  it('ignores a byte order mark', () => {
    expect(parseMap(`\uFEFF${realMap}`)).toEqual(parseMap(realMap))
  })

  it('pads short rows and drops trailing blank lines', () => {
    const grid = parseMap('###\n#\n\n\n')
    expect(grid).toEqual({
      width: 3,
      height: 2,
      tiles: [
        ['path', 'path', 'path'],
        ['path', 'empty', 'empty'],
      ],
    })
  })

  it('treats spaces as empty space', () => {
    expect(parseMap('# #').tiles[0]).toEqual(['path', 'empty', 'path'])
  })

  it('rejects an unknown character, naming the 1-based position', () => {
    expect(() => parseMap('###\n#X#')).toThrow(/"X" at row 2, column 2/)
  })

  it('rejects an empty map', () => {
    expect(() => parseMap('\n\n')).toThrow(/empty/i)
  })
})

describe('listCabanaIds', () => {
  it('returns one id per W tile, in reading order', () => {
    expect(listCabanaIds(parseMap('.W\nW.'))).toEqual(['1,0', '0,1'])
  })

  it('finds every cabana on the real map', () => {
    expect(listCabanaIds(parseMap(realMap))).toHaveLength(47)
  })
})
