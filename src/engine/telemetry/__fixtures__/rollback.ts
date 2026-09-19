import type { Scenario, VersionLookup } from '../types'

/**
 * A minimal scenario for the "rollback shortens the spike" acceptance criterion: `billing` runs a
 * bad version from the start, with an `errorSpike` gated on its `bad` behaviour flag and nominally
 * lasting a full hour. Pair with `fakeVersions(rollbackAt)`, which reports the bad version running
 * until `rollbackAt` and a good one after — so the spike's effect should end right at `rollbackAt`
 * instead of running the full hour, with no history-scanning required.
 */
export function rollbackScenario(): Scenario {
  return {
    id: 'rollback-demo',
    events: [
      {
        at: 0,
        service: 'billing',
        kind: 'errorSpike',
        magnitude: 12,
        durationMs: 60 * 60_000,
        behaviourFlag: 'doubleDiscount',
      },
    ],
  }
}

/** `rollbackAt: undefined` means "never rolled back" — the bad version runs forever. */
export function fakeVersions(rollbackAt: number | undefined): VersionLookup {
  return {
    versionAt: (_app: string, t: number) =>
      rollbackAt !== undefined && t >= rollbackAt ? 'good' : 'bad',
    behaviour: (_app: string, version: string) =>
      version === 'bad' ? { doubleDiscount: true } : {},
  }
}
