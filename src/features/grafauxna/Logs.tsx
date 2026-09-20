import { useState } from 'react'

import type { LogLevel } from '../../engine/telemetry'
import { SERVICES } from '../../content'
import { useGame } from '../../store'
import styles from './Grafauxna.module.css'
import { useTelemetry } from './useTelemetry'

const LEVELS: Array<LogLevel | 'all'> = ['all', 'error', 'warn', 'info', 'debug']

export function Logs() {
  const telemetry = useTelemetry()
  const now = useGame((s) => s.game.clock.now)
  const apps = SERVICES.filter((service) => service.id !== 'database').map((service) => service.id)
  const [service, setService] = useState(apps[0] ?? 'web')
  const [level, setLevel] = useState<LogLevel | 'all'>('all')
  const [query, setQuery] = useState('')
  const from = Math.max(0, now - 60 * 60_000)
  const lines = telemetry.logs(
    service,
    level === 'all' ? undefined : level,
    query || undefined,
    from,
    now
  )

  return (
    <div>
      <h1>Logs</h1>
      <div className={styles.chips}>
        {apps.map((id) => (
          <button
            key={id}
            type="button"
            className={styles.chip}
            aria-pressed={service === id}
            onClick={() => setService(id)}
          >
            {id}
          </button>
        ))}
        {LEVELS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={styles.chip}
            aria-pressed={level === candidate}
            onClick={() => setLevel(candidate)}
          >
            {candidate}
          </button>
        ))}
        <input
          className={styles.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search logs"
          aria-label="Search logs"
        />
      </div>
      {lines.length === 0 ? (
        <p className={styles.summary}>Nothing in this window.</p>
      ) : (
        <ul className={styles.log}>
          {lines.map((line, index) => (
            <li key={`${line.at}-${index}`}>
              [{line.level}] {line.english}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
