import {
  billingWeekScenario,
  billingWeekVersions,
  CH8_RULES,
  SEED,
  SERVICE,
  STEP_MS,
  WEEK_END,
  WEEK_START,
} from '../../engine/telemetry/__fixtures__/billingWeek'
import { replay, series } from '../../engine/telemetry'
import styles from './Grafauxna.module.css'

export function Replay() {
  const points = series(
    SEED,
    billingWeekScenario(),
    billingWeekVersions(),
    SERVICE,
    'errorRate',
    WEEK_START,
    WEEK_END,
    STEP_MS
  )
  const firings = replay(CH8_RULES, points)
  const counts = CH8_RULES.map((rule) => ({
    rule,
    count: firings.filter((firing) => firing.ruleId === rule.id).length,
  }))

  return (
    <div>
      <h1>Replay last week</h1>
      <p className={styles.summary}>
        A week of billing errors, replayed through three rules. One real incident, three harmless
        blips, and background noise.
      </p>
      <ul className={styles.rules}>
        {counts.map(({ rule, count }) => (
          <li key={rule.id} data-target={`rule:${rule.id}`}>
            <strong>{rule.name}</strong>
            <div className={styles.summary}>
              {count} page{count === 1 ? '' : 's'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
