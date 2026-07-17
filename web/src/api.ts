// The API contract is defined where it is produced. These are type-only imports,
// so no server code reaches the bundle.
export type { TileType } from '../../server/map.ts'
export type { Booking, MapTile, MapView } from '../../server/resort.ts'

import type { Booking, MapView } from '../../server/resort.ts'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const UNREACHABLE = 'The resort is not responding. Please try again.'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    // Offline or server down: a raw "Failed to fetch" is not for a guest to read.
    throw new ApiError(UNREACHABLE, 0)
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error
    throw new ApiError(message ?? UNREACHABLE, response.status)
  }
  return body as T
}

export const fetchMap = () => request<MapView>('/api/map')

export const createBooking = (booking: { cabanaId: string; room: string; guestName: string }) =>
  request<Booking>('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  })
