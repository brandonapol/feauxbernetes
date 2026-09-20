import type { AppHealth, AppSummary, CopyState, DatabaseHealth } from '../../engine/cluster'
import type { SyncStatus } from '../../engine/gitops'

/**
 * Icon-plus-text for every health and copy state Argh CD shows. Nothing here is colour-coded —
 * the icon and the label are the whole story, so a colourblind (or greyscale-printed) learner
 * loses nothing. Keep this the one place that picks the glyphs; every view imports from here.
 */
export interface Display {
  icon: string
  label: string
}

export const HEALTH_DISPLAY: Record<AppHealth | DatabaseHealth, Display> = {
  Healthy: { icon: '✓', label: 'Healthy' },
  Progressing: { icon: '↻', label: 'Progressing' },
  Degraded: { icon: '!', label: 'Degraded' },
}

export const SYNC_DISPLAY: Record<SyncStatus, Display> = {
  Synced: { icon: '✓', label: 'Synced' },
  OutOfSync: { icon: '≠', label: 'Out of sync' },
  Syncing: { icon: '↻', label: 'Syncing' },
}

export const COPY_STATE_DISPLAY: Record<CopyState, Display> = {
  Starting: { icon: '↻', label: 'Starting' },
  Running: { icon: '●', label: 'Running' },
  Stopping: { icon: '◌', label: 'Stopping' },
  Crashed: { icon: '✕', label: 'Crashed' },
}

/** The "wants 3 · has 3" line shown on every Argh CD view, with starting/stopping counts folded
 * in only when there's actually something in flight. */
export function wantsHasText(s: AppSummary): string {
  const parts = [`wants ${s.wants}`, `has ${s.has}`]
  if (s.starting > 0) parts.push(`${s.starting} starting`)
  if (s.stopping > 0) parts.push(`${s.stopping} stopping`)
  return parts.join(' · ')
}
