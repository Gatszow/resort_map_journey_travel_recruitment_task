import { useEffect, useState } from 'react'
import { ApiError, createBooking, fetchMap, type Booking, type MapTile, type MapView } from './api.ts'
import { BookingDialog } from './BookingDialog.tsx'
import { Legend } from './Legend.tsx'
import { ResortMap } from './ResortMap.tsx'

type Cabana = Extract<MapTile, { type: 'cabana' }>

export function App() {
  const [map, setMap] = useState<MapView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Cabana | null>(null)
  const [confirmation, setConfirmation] = useState<Booking | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    fetchMap().then(setMap, (error: Error) => setLoadError(error.message))
  }, [])

  function selectCabana(cabana: Cabana) {
    setConfirmation(null)
    setFormError(null)
    setSelected(cabana)
  }

  function backToMap() {
    setSelected(null)
    setConfirmation(null)
    setFormError(null)
  }

  async function submitBooking(room: string, guestName: string) {
    if (!selected) return
    setPending(true)
    try {
      const booking = await createBooking({ cabanaId: selected.id, room, guestName })
      setMap(await fetchMap())
      setSelected(null)
      setConfirmation(booking)
    } catch (error) {
      // A conflict means our map is stale, so refresh it before explaining.
      if (error instanceof ApiError && error.status === 409) setMap(await fetchMap().catch(() => map))
      setFormError((error as Error).message)
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

        <aside className="sidebar">
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
            <BookingDialog
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
