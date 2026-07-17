import { cabanaId, listCabanaIds, type ResortGrid, type TileType } from './map.ts'

export interface Guest {
  room: string
  guestName: string
}

export interface Booking {
  cabanaId: string
  room: string
  guestName: string
}

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type MapTile = { type: Exclude<TileType, 'cabana'> } | { type: 'cabana'; id: string; booked: boolean }

export interface MapView {
  width: number
  height: number
  tiles: MapTile[][]
}

export function parseGuests(text: string): Guest[] {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    throw new Error(`Bookings file is not valid JSON: ${(error as Error).message}`)
  }
  if (!Array.isArray(raw)) throw new Error('Bookings file must contain a JSON array of guests.')

  const guests = raw.map((entry, index) => {
    const guest = entry as Partial<Guest>
    if (typeof guest?.room !== 'string' || guest.room.trim() === '') {
      throw new Error(`Guest at index ${index} is missing a non-empty "room".`)
    }
    if (typeof guest?.guestName !== 'string' || guest.guestName.trim() === '') {
      throw new Error(`Guest at index ${index} is missing a non-empty "guestName".`)
    }
    return { room: guest.room.trim(), guestName: guest.guestName.trim() }
  })

  const rooms = new Set<string>()
  for (const guest of guests) {
    const key = normalize(guest.room)
    if (rooms.has(key)) throw new Error(`Bookings file lists room ${guest.room} more than once.`)
    rooms.add(key)
  }
  return guests
}

/** Guests type their own name, so compare case- and whitespace-insensitively. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export class Resort {
  private readonly cabanas: Set<string>
  private readonly bookingsByCabana = new Map<string, Booking>()

  constructor(
    private readonly grid: ResortGrid,
    private readonly guests: Guest[],
  ) {
    this.cabanas = new Set(listCabanaIds(grid))
  }

  getMap(): MapView {
    const tiles = this.grid.tiles.map((row, y) =>
      row.map((type, x): MapTile => {
        if (type !== 'cabana') return { type }
        const id = cabanaId(x, y)
        return { type, id, booked: this.bookingsByCabana.has(id) }
      }),
    )
    return { width: this.grid.width, height: this.grid.height, tiles }
  }

  getBookings(): Booking[] {
    return [...this.bookingsByCabana.values()]
  }

  book(input: { cabanaId?: unknown; room?: unknown; guestName?: unknown }): Booking {
    const id = requireText(input.cabanaId, 'a cabana')
    const room = requireText(input.room, 'a room number')
    const guestName = requireText(input.guestName, 'a guest name')

    if (!this.cabanas.has(id)) throw new BookingError('That cabana does not exist on this map.', 404)

    const guest = this.guests.find((g) => normalize(g.room) === normalize(room) && normalize(g.guestName) === normalize(guestName))
    if (!guest) throw new BookingError('We could not find a guest with that room number and name.', 400)

    const onThisCabana = this.bookingsByCabana.get(id)
    if (onThisCabana) {
      const message =
        normalize(onThisCabana.room) === normalize(guest.room)
          ? 'You have already booked this cabana.'
          : 'Sorry, that cabana has just been taken.'
      throw new BookingError(message, 409)
    }

    const elsewhere = this.getBookings().find((b) => normalize(b.room) === normalize(guest.room))
    if (elsewhere) {
      throw new BookingError(`Room ${guest.room} already has a cabana booked for today.`, 409)
    }

    const booking: Booking = { cabanaId: id, room: guest.room, guestName: guest.guestName }
    this.bookingsByCabana.set(id, booking)
    return booking
  }
}

/** Room numbers are strings in the bookings file, but accept a JSON number too. */
function requireText(value: unknown, label: string): string {
  const text = typeof value === 'number' ? String(value) : value
  if (typeof text !== 'string' || text.trim() === '') {
    throw new BookingError(`Please provide ${label}.`, 400)
  }
  return text
}
