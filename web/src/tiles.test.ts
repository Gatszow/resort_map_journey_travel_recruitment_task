import { describe, expect, it } from 'vitest'
import type { MapTile } from './api.ts'
import { poolArea, spriteFor } from './tiles.ts'

/** Builds a grid from map characters so the cases read like the .ascii file. */
function grid(...rows: string[]): MapTile[][] {
  const legend: Record<string, MapTile> = {
    '#': { type: 'path' },
    '.': { type: 'empty' },
    p: { type: 'pool' },
    c: { type: 'chalet' },
  }
  return rows.map((row) => [...row].map((char) => legend[char]!))
}

const sprite = (tiles: MapTile[][], x: number, y: number) => {
  const found = spriteFor(tiles, x, y)!
  return { name: found.src.replace('/assets/', '').replace('.png', ''), rotation: found.rotation }
}

describe('path sprites', () => {
  it('joins four neighbours with the crossing', () => {
    expect(sprite(grid('.#.', '###', '.#.'), 1, 1)).toEqual({ name: 'arrowCrossing', rotation: 0 })
  })

  it.each([
    ['west', ['.#.', '.##', '.#.'], 0],
    ['north', ['...', '###', '.#.'], 90],
    ['east', ['.#.', '##.', '.#.'], 180],
    ['south', ['.#.', '###', '...'], 270],
  ])('rotates the T-junction when %s is missing', (_label, rows, rotation) => {
    expect(sprite(grid(...rows), 1, 1)).toEqual({ name: 'arrowSplit', rotation })
  })

  it.each([
    ['vertically', ['.#.', '.#.', '.#.'], 0],
    ['horizontally', ['...', '###', '...'], 90],
  ])('lays the straight %s', (_label, rows, rotation) => {
    expect(sprite(grid(...rows), 1, 1)).toEqual({ name: 'arrowStraight', rotation })
  })

  it.each([
    ['north and east', ['.#.', '.##', '...'], 0],
    ['east and south', ['...', '.##', '.#.'], 90],
    ['south and west', ['...', '##.', '.#.'], 180],
    ['west and north', ['.#.', '##.', '...'], 270],
  ])('turns the corner towards %s', (_label, rows, rotation) => {
    expect(sprite(grid(...rows), 1, 1)).toEqual({ name: 'arrowCornerSquare', rotation })
  })

  it.each([
    ['south', ['...', '.#.', '.#.'], 0],
    ['west', ['...', '##.', '...'], 90],
    ['north', ['.#.', '.#.', '...'], 180],
    ['east', ['...', '.##', '...'], 270],
  ])('points the dead end %s', (_label, rows, rotation) => {
    expect(sprite(grid(...rows), 1, 1)).toEqual({ name: 'arrowEnd', rotation })
  })

  it('survives a path tile with no neighbours', () => {
    expect(() => sprite(grid('...', '.#.', '...'), 1, 1)).not.toThrow()
  })

  it('ignores non-path neighbours', () => {
    expect(sprite(grid('.c.', 'p#p', '.c.'), 1, 1)).toEqual({ name: 'arrowStraight', rotation: 0 })
  })
})

describe('other sprites', () => {
  it('draws chalets, and leaves empty space blank', () => {
    expect(sprite(grid('c'), 0, 0)).toEqual({ name: 'houseChimney', rotation: 0 })
    expect(spriteFor(grid('.'), 0, 0)).toBeNull()
  })

  it('leaves pool tiles to the water texture and the overlay', () => {
    expect(spriteFor(grid('p'), 0, 0)).toBeNull()
  })
})

describe('poolArea', () => {
  it('spans the rectangle the pool fills', () => {
    expect(poolArea(grid('....', '.pp.', '.pp.', '....'))).toEqual({ x: 1, y: 1, width: 2, height: 2 })
  })

  it('gives up on a map without a pool', () => {
    expect(poolArea(grid('...'))).toBeNull()
  })

  it('gives up when the pool is not one filled rectangle', () => {
    // Two separate pools would otherwise get one drawing stretched across both.
    expect(poolArea(grid('p.p'))).toBeNull()
    expect(poolArea(grid('pp', 'p.'))).toBeNull()
  })
})
