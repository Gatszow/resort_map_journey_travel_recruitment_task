const ITEMS = [
  { src: '/assets/cabana.png', label: 'Cabana — click a free one to book' },
  { src: '/assets/pool.png', label: 'Pool' },
  { src: '/assets/houseChimney.png', label: 'Chalet' },
  { src: '/assets/arrowStraight.png', label: 'Path' },
]

export function Legend() {
  return (
    <div className="panel" data-testid="legend">
      <h2>Legend</h2>
      <ul className="legend">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <img src={item.src} alt="" />
            <span>{item.label}</span>
          </li>
        ))}
        <li>
          <span className="legend__swatch" aria-hidden="true" />
          <span>Booked cabana — no longer available</span>
        </li>
      </ul>
    </div>
  )
}
