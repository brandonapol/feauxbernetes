import {
  attainment,
  errorBudget,
  burnRate,
  describeAllowedOutage,
  humanDuration,
} from '../../engine/telemetry'
import { CH8_SLO } from '../../engine/telemetry/__fixtures__/billingWeek'
import styles from './Grafauxna.module.css'

/** Placeholder live counts until Ch 7 wires real traffic. Quiet day: almost all checkouts succeed. */
const VALID = 10_000
const GOOD = 9_992

export function SloPanel() {
  const slo = CH8_SLO
  const attained = attainment(GOOD, VALID)
  const budget = errorBudget(slo.target, slo.windowDays, VALID, GOOD)
  const burn = burnRate(slo.target, GOOD, VALID)
  const remainingPct = Math.max(
    0,
    Math.min(100, (budget.remainingEvents / budget.allowedEvents) * 100)
  )

  return (
    <div>
      <h1>SLOs</h1>
      <section className={styles.slo}>
        <h2>billing checkout</h2>
        <p>
          Target {(slo.target * 100).toFixed(1)}% of {slo.sli.valid} succeed. Currently{' '}
          {(attained * 100).toFixed(2)}%.
        </p>
        <p>
          Error budget remaining: {humanDuration(budget.remainingMinutes)}.{' '}
          {describeAllowedOutage(budget)}.
        </p>
        <div className={styles.gauge} aria-hidden="true">
          <span style={{ width: `${remainingPct}%` }} />
        </div>
        <p className={styles.summary}>Burn rate {burn.toFixed(2)}× (1 is “on pace”).</p>
      </section>
    </div>
  )
}
