import type { Incident } from '../../engine/incident'
import styles from './Incident.module.css'
import { useImpactModel } from './useIncident'

/** "132 failed coupon checkouts", plus "(stopped)" once the incident is mitigated. */
export function ImpactCounter({ incident }: { incident: Incident }) {
  const model = useImpactModel(incident.service)
  const count = Math.floor(incident.impact.customers)
  const stopped = incident.marks.mitigated !== undefined
  return (
    <span className={styles.impact} data-stopped={stopped || undefined}>
      <strong className={styles.impactCount}>{count.toLocaleString('en-US')}</strong>{' '}
      {model?.label ?? 'customers affected'}
      {stopped && <span className={styles.impactStopped}> · stopped</span>}
    </span>
  )
}
