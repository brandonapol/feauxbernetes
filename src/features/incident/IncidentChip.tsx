import { Link } from 'react-router'

import { ImpactCounter } from './ImpactCounter'
import styles from './Incident.module.css'
import { useIncident } from './useIncident'

/**
 * A small persistent chip while an incident is open: severity, service and the customer impact
 * counter. Links to the incident channel once there is one.
 */
export function IncidentChip() {
  const incident = useIncident()
  if (!incident || incident.phase !== 'open') return null
  const declaration = incident.declaration
  const label = declaration
    ? `${declaration.severity} · ${incident.service}`
    : `Paged · ${incident.service}`
  const body = (
    <>
      <span className={styles.chipLabel}>{label}</span>
      <ImpactCounter incident={incident} />
    </>
  )
  return (
    <div className={styles.chip} role="status" aria-label="Open incident">
      {declaration ? (
        <Link className={styles.chipLink} to={`/flack/${declaration.channelId}`}>
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  )
}
