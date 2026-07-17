import { readFile } from 'node:fs/promises'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { parseMap } from './map.ts'
import { parseGuests, Resort } from './resort.ts'

const grid = parseMap(await readFile('map.ascii', 'utf8'))
const guests = parseGuests(await readFile('bookings.json', 'utf8'))

const FREE_CABANA = '3,11'
const OTHER_CABANA = '4,11'
const ALICE = { room: '101', guestName: 'Alice Smith' }
const BOB = { room: '102', guestName: 'Bob Jones' }

type Tile = { type: string; id?: string; booked?: boolean }

const cabanasOf = (body: { tiles: Tile[][] }) => body.tiles.flat().filter((tile) => tile.type === 'cabana')

let app: ReturnType<typeof createApp>

beforeEach(() => {
  app = createApp(new Resort(grid, guests))
})

describe('GET /api/map', () => {
  it('serves the whole grid with cabana availability', async () => {
    const { body } = await request(app).get('/api/map').expect(200)

    expect(body.width).toBe(20)
    expect(body.height).toBe(19)
    expect(body.tiles).toHaveLength(19)

    const cabanas = cabanasOf(body)
    expect(cabanas).toHaveLength(47)
    expect(cabanas.every((c) => c.booked === false)).toBe(true)
    expect(cabanas.every((c) => /^\d+,\d+$/.test(c.id!))).toBe(true)
  })

  it('does not put ids on tiles that cannot be booked', async () => {
    const { body } = await request(app).get('/api/map').expect(200)
    const others = body.tiles.flat().filter((tile: Tile) => tile.type !== 'cabana')

    expect(others.some((tile: Tile) => tile.id !== undefined)).toBe(false)
  })

  it('reports a cabana as booked once it is taken', async () => {
    await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...ALICE }).expect(201)

    const { body } = await request(app).get('/api/map').expect(200)
    const cabanas = cabanasOf(body)

    expect(cabanas.filter((c) => c.booked)).toHaveLength(1)
    expect(cabanas.find((c) => c.id === FREE_CABANA)!.booked).toBe(true)
  })
})

describe('POST /api/bookings', () => {
  it('books a free cabana for a real guest', async () => {
    const { body } = await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...ALICE }).expect(201)
    expect(body).toEqual({ cabanaId: FREE_CABANA, ...ALICE })
  })

  it('accepts a sloppily typed name and room', async () => {
    await request(app)
      .post('/api/bookings')
      .send({ cabanaId: FREE_CABANA, room: ' 101 ', guestName: '  alice   SMITH ' })
      .expect(201)
  })

  it('accepts a room sent as a JSON number', async () => {
    await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, room: 101, guestName: 'Alice Smith' }).expect(201)
  })

  it('rejects a guest whose name does not match the room', async () => {
    const { body } = await request(app)
      .post('/api/bookings')
      .send({ cabanaId: FREE_CABANA, room: '101', guestName: 'Bob Jones' })
      .expect(400)
    expect(body.error).toMatch(/could not find a guest/i)
  })

  it('rejects a room that is not staying with us', async () => {
    await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, room: '999', guestName: 'Alice Smith' }).expect(400)
  })

  it.each([
    ['a missing cabanaId', { ...ALICE }],
    ['a blank room', { cabanaId: FREE_CABANA, room: '  ', guestName: 'Alice Smith' }],
    ['a blank guest name', { cabanaId: FREE_CABANA, room: '101', guestName: '' }],
  ])('rejects %s', async (_label, payload) => {
    const { body } = await request(app).post('/api/bookings').send(payload).expect(400)
    expect(body.error).toBeTruthy()
  })

  it('rejects a cabana that is not on the map', async () => {
    await request(app).post('/api/bookings').send({ cabanaId: '99,99', ...ALICE }).expect(404)
  })

  it('rejects a tile that exists but is not a cabana', async () => {
    // "6,12" is in the middle of the pool.
    await request(app).post('/api/bookings').send({ cabanaId: '6,12', ...ALICE }).expect(404)
  })

  it('refuses a cabana another guest already took', async () => {
    await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...ALICE }).expect(201)

    const { body } = await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...BOB }).expect(409)
    expect(body.error).toMatch(/just been taken/i)
  })

  it('tells a guest when they re-book their own cabana', async () => {
    await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...ALICE }).expect(201)

    const { body } = await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...ALICE }).expect(409)
    expect(body.error).toMatch(/already booked this cabana/i)
  })

  it('allows only one cabana per room', async () => {
    await request(app).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...ALICE }).expect(201)

    const { body } = await request(app).post('/api/bookings').send({ cabanaId: OTHER_CABANA, ...ALICE }).expect(409)
    expect(body.error).toMatch(/room 101/i)
  })

  it('answers 400 rather than 500 when the body is not JSON', async () => {
    const { body } = await request(app)
      .post('/api/bookings')
      .set('Content-Type', 'application/json')
      .send('{ "cabanaId": ')
      .expect(400)
    expect(body.error).toMatch(/not valid json/i)
  })

  it('answers 400 rather than 500 when there is no body at all', async () => {
    await request(app).post('/api/bookings').expect(400)
  })
})

describe('unknown API endpoints', () => {
  it('answer with JSON, not with the frontend', async () => {
    const { body } = await request(app).get('/api/nope').expect(404)
    expect(body.error).toBeTruthy()
  })
})

describe('a resort started with different files', () => {
  it('only knows the guests it was given', async () => {
    const other = createApp(new Resort(grid, [{ room: '1', guestName: 'Solo Guest' }]))

    await request(other).post('/api/bookings').send({ cabanaId: FREE_CABANA, room: '1', guestName: 'Solo Guest' }).expect(201)
    await request(other).post('/api/bookings').send({ cabanaId: OTHER_CABANA, ...ALICE }).expect(400)
  })

  it('only knows the cabanas its map has', async () => {
    const other = createApp(new Resort(parseMap('.W\n..'), guests))

    const { body } = await request(other).get('/api/map').expect(200)
    expect(cabanasOf(body)).toHaveLength(1)

    await request(other).post('/api/bookings').send({ cabanaId: '1,0', ...ALICE }).expect(201)
    await request(other).post('/api/bookings').send({ cabanaId: FREE_CABANA, ...BOB }).expect(404)
  })
})
