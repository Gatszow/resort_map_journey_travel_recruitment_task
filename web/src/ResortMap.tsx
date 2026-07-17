import type { MapView } from './api.ts'
import { poolArea, poolImage, spriteFor } from './tiles.ts'

interface Props {
  map: MapView
  onCabanaClick: (cabanaId: string) => void
}

export function ResortMap({ map, onCabanaClick }: Props) {
  const pool = poolArea(map.tiles)

  return (
    <div
      className="map"
      data-testid="resort-map"
      style={{
        gridTemplateColumns: `repeat(${map.width}, var(--tile))`,
        gridTemplateRows: `repeat(${map.height}, var(--tile))`,
      }}
    >
      {map.tiles.flatMap((row, y) =>
        row.map((tile, x) => {
          const sprite = spriteFor(map.tiles, x, y)
          const image = sprite && <img src={sprite.src} alt="" style={{ rotate: `${sprite.rotation}deg` }} />
          // Every tile is placed explicitly: the pool overlay below spans cells, and
          // auto-placement would flow the remaining tiles around it.
          const cell = { gridRow: y + 1, gridColumn: x + 1 }

          if (tile.type !== 'cabana') {
            return (
              <div key={`${x},${y}`} className={`tile tile--${tile.type}`} style={cell}>
                {image}
              </div>
            )
          }

          return (
            <button
              key={tile.id}
              type="button"
              className={`tile tile--cabana ${tile.booked ? 'is-booked' : 'is-free'}`}
              style={cell}
              data-testid={`cabana-${tile.id}`}
              data-booked={tile.booked}
              aria-label={`Cabana ${tile.id}, ${tile.booked ? 'booked' : 'available'}`}
              onClick={() => onCabanaClick(tile.id)}
            >
              {image}
            </button>
          )
        }),
      )}

      {pool && (
        <div
          className="pool-overlay"
          data-testid="pool-overlay"
          style={{
            gridArea: `${pool.y + 1} / ${pool.x + 1} / ${pool.y + pool.height + 1} / ${pool.x + pool.width + 1}`,
          }}
        >
          <img src={poolImage} alt="Swimming pool" />
        </div>
      )}
    </div>
  )
}
