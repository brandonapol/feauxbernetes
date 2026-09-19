import { hash01, noise } from './rng'
import type {
  Scenario,
  ScenarioEvent,
  ScenarioEventKind,
  Signal,
  SeriesPoint,
  VersionLookup,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000

interface SignalBase {
  mean: number
  rhythm: number
  noiseAmp: number
}

/** Baseline shape for the three signals that get a smooth daily wobble. `errorRate` is deliberately
 * not here — see `backgroundErrorBlips` below. */
const RHYTHMIC_BASE: Record<'traffic' | 'latencyP50' | 'latencyP95' | 'saturation', SignalBase> = {
  traffic: { mean: 800, rhythm: 500, noiseAmp: 40 },
  latencyP50: { mean: 120, rhythm: 15, noiseAmp: 8 },
  latencyP95: { mean: 240, rhythm: 30, noiseAmp: 18 },
  saturation: { mean: 45, rhythm: 12, noiseAmp: 5 },
}

/**
 * How likely any given sample is to be a small background error blip, independent of scenario
 * events. Real services aren't perfectly calm even on an ordinary day — a stray timeout, a client
 * that retried badly — and that's the whole point of Ch 8: "page on any error" pages on this
 * noise, not just on real incidents. This value and the Ch 8 fixture's seed were tuned together;
 * see `__fixtures__/billingWeek.ts`.
 */
export const ERROR_BLIP_PROBABILITY = 0.024
const ERROR_BLIP_MIN = 0.5
const ERROR_BLIP_RANGE = 1.5

/** Which golden signal(s) a scenario event kind bumps. */
const KIND_SIGNALS: Record<ScenarioEventKind, Signal[]> = {
  errorSpike: ['errorRate'],
  trafficSpike: ['traffic'],
  latencySpike: ['latencyP50', 'latencyP95'],
  saturationSpike: ['saturation'],
}

/**
 * A service's own baseline scale, so two services don't look identical: a hash of the service
 * name and signal picks a multiplier in `[0.7, 1.3)`, stable for the lifetime of a seed.
 */
function serviceScale(seed: number, service: string, signal: Signal): number {
  return 0.7 + hash01(`${seed}:${service}:scale:${signal}`) * 0.6
}

/** A smooth day/night wobble, peaking in the afternoon and troughing overnight. Purely cosmetic —
 * only `errorRate`'s lack of one matters for the acceptance criteria. */
function dailyRhythm(t: number): number {
  const fraction = (((t % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS
  const peakFraction = 0.6 // ~14:24
  return Math.cos(2 * Math.PI * (fraction - peakFraction))
}

/** How much a scenario contributes to `signal` for `service` at time `t`, honouring
 * `behaviourFlag` gating via `versions` — this is where a rollback shortens a spike. */
function scenarioBump(
  scenario: Scenario,
  versions: VersionLookup,
  service: string,
  signal: Signal,
  t: number
): number {
  let total = 0
  for (const event of scenario.events) {
    if (event.service !== service) continue
    if (!KIND_SIGNALS[event.kind].includes(signal)) continue
    if (t < event.at || t >= event.at + event.durationMs) continue
    if (!eventIsActive(event, versions, t)) continue
    total += event.magnitude
  }
  return total
}

/** An event with no `behaviourFlag` is active for its whole `durationMs`. One with a flag is only
 * active while the version running for `event.app` (default: `event.service`) has that flag set —
 * so the moment a rollback changes the running version, the event stops contributing. */
function eventIsActive(event: ScenarioEvent, versions: VersionLookup, t: number): boolean {
  if (!event.behaviourFlag) return true
  const app = event.app ?? event.service
  const version = versions.versionAt(app, t)
  if (version === undefined) return false
  return Boolean(versions.behaviour(app, version)[event.behaviourFlag])
}

function rhythmicPoint(
  seed: number,
  service: string,
  signal: 'traffic' | 'latencyP50' | 'latencyP95' | 'saturation',
  scenario: Scenario,
  versions: VersionLookup,
  t: number
): number {
  const base = RHYTHMIC_BASE[signal]
  const scale = serviceScale(seed, service, signal)
  const value =
    base.mean * scale +
    base.rhythm * dailyRhythm(t) +
    noise(`${seed}:${service}:${signal}:${t}`) * base.noiseAmp +
    scenarioBump(scenario, versions, service, signal, t)
  return Math.max(0, value)
}

export interface ErrorBlip {
  t: number
  magnitude: number
}

/**
 * The background error noise for `service` over `[from, to]` at `step` resolution: a short list of
 * small, isolated blips (never two in a row, so each one reads as its own event rather than a
 * plateau). Exported so `logs()` can point to the exact same blips the metrics show — "the one line
 * explaining last night's blip" from planning.md's Ch 6.
 */
export function backgroundErrorBlips(
  seed: number,
  service: string,
  from: number,
  to: number,
  step: number
): ErrorBlip[] {
  const blips: ErrorBlip[] = []
  let previousWasBlip = false
  let sampleIndex = 0
  for (let t = from; t <= to; t += step) {
    const roll = hash01(`${seed}:${service}:errorRateBlip:${sampleIndex}`)
    if (roll < ERROR_BLIP_PROBABILITY && !previousWasBlip) {
      const magnitudeRoll = hash01(`${seed}:${service}:errorRateBlipMag:${sampleIndex}`)
      blips.push({ t, magnitude: ERROR_BLIP_MIN + magnitudeRoll * ERROR_BLIP_RANGE })
      previousWasBlip = true
    } else {
      previousWasBlip = false
    }
    sampleIndex++
  }
  return blips
}

/**
 * A pure golden-signal time series: `(seed, scenario, versions, service, signal, t)` in, samples
 * out. Calling this twice with identical arguments always gives identical results — the whole
 * point of a seeded simulation the learner can rewind and replay. `sampleIndex` (used for the
 * background error noise) counts steps from `from`, so it's stable for one call but not
 * necessarily across calls with a different `from` — every caller in this codebase queries from a
 * fixed start (usually `0`), which keeps it consistent in practice.
 */
export function series(
  seed: number,
  scenario: Scenario,
  versions: VersionLookup,
  service: string,
  signal: Signal,
  from: number,
  to: number,
  step: number
): SeriesPoint[] {
  if (signal === 'errorRate') {
    const blipByTime = new Map(
      backgroundErrorBlips(seed, service, from, to, step).map((b) => [b.t, b.magnitude])
    )
    const points: SeriesPoint[] = []
    for (let t = from; t <= to; t += step) {
      const value =
        (blipByTime.get(t) ?? 0) + scenarioBump(scenario, versions, service, 'errorRate', t)
      points.push({ t, value: Math.max(0, value) })
    }
    return points
  }

  const points: SeriesPoint[] = []
  for (let t = from; t <= to; t += step) {
    points.push({ t, value: rhythmicPoint(seed, service, signal, scenario, versions, t) })
  }
  return points
}
