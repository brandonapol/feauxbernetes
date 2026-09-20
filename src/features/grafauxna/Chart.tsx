import { useState } from 'react'

import type { SeriesPoint } from '../../engine/telemetry'
import styles from './Grafauxna.module.css'

export function Chart({
  title,
  points,
  unit,
}: {
  title: string
  points: SeriesPoint[]
  unit: string
}) {
  const [table, setTable] = useState(false)
  const values = points.map((point) => point.value)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const span = max - min || 1
  const last = values.at(-1) ?? 0
  const path = points
    .map((point, index) => {
      const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * 100
      const y = 40 - ((point.value - min) / span) * 36
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <section className={styles.chart}>
      <h3>{title}</h3>
      <p className={styles.summary}>
        Now {last.toFixed(1)} {unit}. Range {min.toFixed(1)}–{max.toFixed(1)} {unit}.
      </p>
      <svg viewBox="0 0 100 40" role="img" aria-label={`${title} chart`}>
        {path && <path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" />}
      </svg>
      <button
        type="button"
        className={styles.tableToggle}
        aria-expanded={table}
        onClick={() => setTable((value) => !value)}
      >
        {table ? 'Hide table' : 'Show as a table'}
      </button>
      {table && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sample</th>
              <th>{unit}</th>
            </tr>
          </thead>
          <tbody>
            {points.slice(-8).map((point, index) => (
              <tr key={point.t}>
                <td>{index + 1}</td>
                <td>{point.value.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
