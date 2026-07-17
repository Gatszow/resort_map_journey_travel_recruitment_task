import { useState, type FormEvent } from 'react'

interface Props {
  cabanaId: string
  error: string | null
  pending: boolean
  onSubmit: (room: string, guestName: string) => void
  onCancel: () => void
}

export function BookingForm({ cabanaId, error, pending, onSubmit, onCancel }: Props) {
  const [room, setRoom] = useState('')
  const [guestName, setGuestName] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onSubmit(room, guestName)
  }

  return (
    <div className="panel" data-testid="booking-form">
      <h2>Book cabana {cabanaId}</h2>
      <p className="panel__hint">Confirm your room number and name as they appear on your reservation.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="room">Room number</label>
        {/* Rooms are strings in the bookings file; type=number would submit 101, not "101". */}
        <input
          id="room"
          name="room"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          required
        />

        <label htmlFor="guestName">Guest name</label>
        <input
          id="guestName"
          name="guestName"
          type="text"
          autoComplete="off"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
          required
        />

        {error && (
          <p className="message message--error" role="alert" data-testid="booking-error">
            {error}
          </p>
        )}

        <div className="actions">
          <button type="submit" className="button" disabled={pending}>
            {pending ? 'Booking…' : 'Book cabana'}
          </button>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
