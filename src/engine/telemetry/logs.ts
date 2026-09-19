import { backgroundErrorBlips } from './series'
import { hash01 } from './rng'
import type { LogLevel, LogLine, Scenario } from './types'

/** How often, on average, a routine log line is worth generating. Logs are sparser than metric
 * samples — nobody wants a line every 5 minutes for a service quietly doing nothing wrong. */
const ROUTINE_STEP_MS = 5 * 60_000
const ROUTINE_PROBABILITY = 0.4

/** The metrics granularity used to line log lines up with `backgroundErrorBlips` — must match
 * what a scenario's dashboards use for `series(..., 'errorRate', ...)` for the two to agree on
 * which moments are "the blip." */
const ERROR_CHECK_STEP_MS = 5 * 60_000

type Template = { raw: (service: string) => string; english: (service: string) => string }

const ROUTINE_LINES: Record<'debug' | 'info' | 'warn', Template[]> = {
  debug: [
    {
      raw: (s) => `DEBUG ${s}: cache hit ratio 0.91`,
      english: (s) => `${s} is running normally; its cache is doing its job.`,
    },
  ],
  info: [
    {
      raw: (s) => `INFO ${s}: request completed 200 OK`,
      english: (s) => `${s} served a request successfully.`,
    },
    {
      raw: (s) => `INFO ${s}: healthcheck ok`,
      english: (s) => `${s}'s healthcheck passed.`,
    },
  ],
  warn: [
    {
      raw: (s) => `WARN ${s}: request took 850ms`,
      english: (s) => `${s} answered a request more slowly than usual.`,
    },
  ],
}

const ROUTINE_LEVELS: { level: 'debug' | 'info' | 'warn'; weight: number }[] = [
  { level: 'debug', weight: 0.15 },
  { level: 'info', weight: 0.75 },
  { level: 'warn', weight: 0.1 },
]

function pickWeighted<T extends { weight: number }>(options: T[], roll: number): T {
  let acc = 0
  for (const option of options) {
    acc += option.weight
    if (roll < acc) return option
  }
  return options[options.length - 1]
}

function routineLine(seed: number, service: string, t: number): LogLine | undefined {
  const presenceRoll = hash01(`${seed}:${service}:logPresence:${t}`)
  if (presenceRoll >= ROUTINE_PROBABILITY) return undefined

  const levelRoll = hash01(`${seed}:${service}:logLevel:${t}`)
  const { level } = pickWeighted(ROUTINE_LEVELS, levelRoll)
  const lines = ROUTINE_LINES[level]
  const templateRoll = hash01(`${seed}:${service}:logTemplate:${t}`)
  const template = lines[Math.floor(templateRoll * lines.length)]
  return { at: t, service, level, raw: template.raw(service), english: template.english(service) }
}

function backgroundBlipLine(service: string, t: number, magnitude: number): LogLine {
  return {
    at: t,
    service,
    level: 'error',
    raw: `ERROR ${service}: elevated error rate ${magnitude.toFixed(1)}%`,
    english: `${service} saw a brief bump in errors (about ${magnitude.toFixed(1)}%). It cleared on its own.`,
  }
}

function scenarioEventLines(
  scenario: Scenario,
  service: string,
  from: number,
  to: number
): LogLine[] {
  const lines: LogLine[] = []
  for (const event of scenario.events) {
    if (event.service !== service || !event.logEnglish) continue
    if (event.at < from || event.at > to) continue
    const level: LogLevel = event.kind === 'errorSpike' ? 'error' : 'warn'
    lines.push({
      at: event.at,
      service,
      level,
      raw: `${level.toUpperCase()} ${service}: ${event.logEnglish}`,
      english: event.logEnglish,
    })
  }
  return lines
}

function matchesQuery(line: LogLine, query: string | undefined): boolean {
  if (!query) return true
  const needle = query.toLowerCase()
  return line.english.toLowerCase().includes(needle) || line.raw.toLowerCase().includes(needle)
}

/**
 * Generated log lines for `service`, deterministic per seed: routine chatter at `info`/`debug`/
 * `warn`, an `error` line for every background error blip (matching what `series()` shows on the
 * errorRate graph), and one line per scenario event that supplies `logEnglish`. Filterable by
 * `level` and a plain substring `query` over the English text (and the raw line, so a learner who
 * pastes the raw form still finds it).
 */
export function logs(
  seed: number,
  scenario: Scenario,
  service: string,
  level: LogLevel | undefined,
  query: string | undefined,
  from: number,
  to: number
): LogLine[] {
  const lines: LogLine[] = []

  for (let t = from; t <= to; t += ROUTINE_STEP_MS) {
    const line = routineLine(seed, service, t)
    if (line) lines.push(line)
  }

  for (const blip of backgroundErrorBlips(seed, service, from, to, ERROR_CHECK_STEP_MS)) {
    lines.push(backgroundBlipLine(service, blip.t, blip.magnitude))
  }

  lines.push(...scenarioEventLines(scenario, service, from, to))

  return lines
    .filter((line) => (level ? line.level === level : true))
    .filter((line) => matchesQuery(line, query))
    .sort((a, b) => a.at - b.at)
}
