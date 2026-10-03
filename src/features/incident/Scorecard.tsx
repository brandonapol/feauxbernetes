import { formatDuration, scorecard, type Incident, type ScoreRow } from '../../engine/incident'
import { useGame } from '../../store'
import styles from './Incident.module.css'

const BAND_LABEL = {
  below: 'Below typical',
  within: 'Typical',
  above: 'Above typical',
} as const

function format(row: ScoreRow, value: number): string {
  return row.metric === 'customersAffected' ? value.toLocaleString('en-US') : formatDuration(value)
}

/**
 * How the incident went, next to "a typical team." No pass or fail: each row says what moved the
 * number, so the learner sees which choices mattered.
 */
export function Scorecard({ incident }: { incident: Incident }) {
  const typical = useGame((s) => s.config.incident?.typical)
  if (!typical) return null
  const rows = scorecard(incident, typical)
  return (
    <section className={styles.scorecard} aria-label="Scorecard">
      <h3 className={styles.scorecardTitle}>Scorecard</h3>
      <table className={styles.scoreTable}>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">You</th>
            <th scope="col">A typical team</th>
            <th scope="col">What moved it</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.metric}>
              <th scope="row">{row.label}</th>
              <td>
                {row.value === undefined ? '—' : format(row, row.value)}
                {row.band && <span className={styles.band}>{BAND_LABEL[row.band]}</span>}
              </td>
              <td>
                {format(row, row.typical.low)}–{format(row, row.typical.high)}
              </td>
              <td>{row.note ?? 'Not reached in this incident.'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
