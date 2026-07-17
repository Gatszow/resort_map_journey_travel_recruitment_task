import { useEffect, useRef, useState } from 'react'
import { ApiError, createBooking, fetchMap, type Booking, type MapView } from './api.ts'
import { BookingForm } from './BookingForm.tsx'
import { Legend } from './Legend.tsx'
import { ResortMap } from './ResortMap.tsx'
import { findCabana } from './tiles.ts'

export function App() {
  const [map, setMap] = useState<MapView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Booking | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    fetchMap().then(setMap, (error: Error) => setLoadError(error.message))
  }, [])

  // Read the cabana off the current map rather than remembering the tile we clicked,
  // so a refreshed map can turn the form into the "already booked" notice.
  const selected = map && selectedId ? findCabana(map.tiles, selectedId) : null

  useEffect(() => {
    if (selectedId || confirmation) panel.current?.focus()
  }, [selectedId, confirmation])

  async function refreshMap() {
    try {
      setMap(await fetchMap())
    } catch {
      // Keep the map we have; it is only out of date, and the booking still stands.
    }
  }

  function selectCabana(id: string) {
    setConfirmation(null)
    setFormError(null)
    setSelectedId(id)
  }

  function backToMap() {
    setSelectedId(null)
    setConfirmation(null)
    setFormError(null)
  }

  async function submitBooking(room: string, guestName: string) {
    if (!selectedId) return
    setPending(true)
    setFormError(null)
    try {
      const booking = await createBooking({ cabanaId: selectedId, room, guestName })
      // Confirm from the 201 before refreshing, so a failed refresh cannot hide a booking.
      setSelectedId(null)
      setConfirmation(booking)
      await refreshMap()
    } catch (error) {
      setFormError((error as Error).message)
      if (error instanceof ApiError && error.status === 409) await refreshMap()
    } finally {
      setPending(false)
    }
  }

  if (loadError) {
    return (
      <main className="layout">
        <p className="message message--error" role="alert">
          {loadError}
        </p>
      </main>
    )
  }

  return (
    <div className="layout">
      <header className="header">
        <h1>Poolside cabanas</h1>
        <p>Pick a free cabana on the map and book it with your room number.</p>
      </header>

      <main className="content">
        {map ? <ResortMap map={map} onCabanaClick={selectCabana} /> : <p className="loading">Rolling out the map…</p>}

        <aside className="sidebar" ref={panel} tabIndex={-1}>
          {confirmation && (
            <div className="panel" data-testid="booking-confirmation">
              <h2>Cabana booked</h2>
              <p className="message message--success" role="status">
                Enjoy cabana {confirmation.cabanaId}, {confirmation.guestName}. It is now reserved for room{' '}
                {confirmation.room}.
              </p>
              <button type="button" className="button" onClick={backToMap}>
                Back to the map
              </button>
            </div>
          )}

          {selected?.booked && (
            <div className="panel" data-testid="cabana-unavailable">
              <h2>Cabana {selected.id}</h2>
              <p className="message message--warning" role="alert">
                This cabana is already booked. Please choose another one.
              </p>
              <button type="button" className="button" onClick={backToMap}>
                Back to the map
              </button>
            </div>
          )}

          {selected && !selected.booked && (
            <BookingForm
              cabanaId={selected.id}
              error={formError}
              pending={pending}
              onSubmit={submitBooking}
              onCancel={backToMap}
            />
          )}

          {!selected && !confirmation && <Legend />}
        </aside>
      </main>
    </div>
  )
}
