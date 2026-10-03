import type { Incident, ImpactModel } from '../../engine/incident'
import { useGame } from '../../store'

/** The current (or most recently resolved) incident, if there's ever been one. */
export function useIncident(): Incident | undefined {
  return useGame((s) => s.game.incident.current)
}

/** How the current incident's impact is counted, from content. */
export function useImpactModel(service: string | undefined): ImpactModel | undefined {
  return useGame((s) => (service ? s.config.incident?.impact[service] : undefined))
}
