import { CH8_RULES } from '../../engine/telemetry/__fixtures__/billingWeek'
import styles from './Grafauxna.module.css'

function describe(rule: (typeof CH8_RULES)[number]): string {
  const expr = rule.expr
  if (expr === 'anyError') return 'Fires on any error at all.'
  if ('forMinutes' in expr)
    return `Fires if errors stay above ${expr.threshold}% for ${expr.forMinutes} minutes.`
  return `Fires when the budget is burning ${expr.burnRate}× too fast (${expr.longWindowMinutes}m and ${expr.shortWindowMinutes}m).`
}

export function Alerts() {
  return (
    <div>
      <h1>Alert rules</h1>
      <p className={styles.summary}>Read-only for now. You’ll tune these in a later chapter.</p>
      <ul className={styles.rules}>
        {CH8_RULES.map((rule) => (
          <li key={rule.id}>
            <strong>{rule.name}</strong>
            <div className={styles.summary}>
              {rule.severity === 'page' ? 'Page' : 'Ticket'} · {describe(rule)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
