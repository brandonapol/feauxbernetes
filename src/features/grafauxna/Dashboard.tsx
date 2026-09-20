import { useMemo, useState } from 'react'

import type { Signal } from '../../engine/telemetry'
import { SERVICES } from '../../content'
import { useGame } from '../../store'
import { Chart } from './Chart'
import styles from './Grafauxna.module.css'
import { useTelemetry } from './useTelemetry'

const RANGES: Array<{ id: string; label: string; ms: number }> = [
  { id: '15m', label: 'Last 15m', ms: 15 * 60_000 },
  { id: '1h', label: 'Last 1h', ms: 60 * 60_000 },
  { id: '24h', label: 'Last 24h', ms: 24 * 60 * 60_000 },
  { id: '7d', label: 'Last 7d', ms: 7 * 24 * 60 * 60_000 },
]

const SIGNALS: Array<{ id: Signal; title: string; unit: string }> = [
  { id: 'latencyP95', title: 'Latency (p95)', unit: 'ms' },
  { id: 'traffic', title: 'Traffic', unit: 'req/min' },
  { id: 'errorRate', title: 'Errors', unit: '%' },
  { id: 'saturation', title: 'Saturation', unit: '%' },
]

export function Dashboard() {
  const telemetry = useTelemetry()
  const now = useGame((s) => s.game.clock.now)
  const apps = SERVICES.filter((service) => service.id !== 'database').map((service) => service.id)
  const [service, setService] = useState(apps[0] ?? 'web')
  const [range, setRange] = useState(RANGES[0])
  const from = Math.max(0, now - range.ms)
  const step = Math.max(5_000, Math.round(range.ms / 40))

  const charts = useMemo(
    () =>
      SIGNALS.map((signal) => ({
        ...signal,
        points: telemetry.series(service, signal.id, from, now, step),
      })),
    [telemetry, service, from, now, step]
  )

  return (
    <div>
      <h1>Dashboards</h1>
      <div className={styles.toolbar}>
        <label>
          Service{' '}
          <select value={service} onChange={(event) => setService(event.target.value)}>
            {apps.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        {RANGES.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={styles.chip}
            aria-pressed={range.id === candidate.id}
            onClick={() => setRange(candidate)}
          >
            {candidate.label}
          </button>
        ))}
      </div>
      <div className={styles.charts}>
        {charts.map((chart) => (
          <Chart key={chart.id} title={chart.title} points={chart.points} unit={chart.unit} />
        ))}
      </div>
    </div>
  )
}
