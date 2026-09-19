/**
 * The plain-English test report — the headline feature (#8). It looks like a log (monospace,
 * ✓/✗, timings, dotted leaders) but reads like a sentence: a passed test is one line, and a
 * failed one walks through every step in order until it says exactly where it gave up and why.
 * `formatRealLog` renders the same results as a real Playwright run would print them, for the
 * "Show the real log" toggle — a contrast, not something a learner is meant to parse.
 *
 * Column widths below are chosen to match the sample in planning.md → "CI" exactly (locked by
 * `report.test.ts`'s snapshot), not derived from any deeper rule.
 */
import type { Line, LineTone, TestReport, TestResult, TestStep } from './types'

/** Total width of a top-level test line (icon, name, padding, duration) and of a wrapped detail
 * line under a failing step (indent, label, wrapped text). */
const LINE_WIDTH = 67
/** Total width of a numbered step's dotted leader. One column tighter for any verdict other than
 * `'ok'` — those are always followed by an explanation, so the row doesn't need to reach as far. */
const STEP_WIDTH_OK = 70
const STEP_WIDTH_OTHER = 69
const STEP_INDENT = '      ' // 6 spaces, before "1. …"
const DETAIL_INDENT = '         ' // 9 spaces — lines up with a step's text, after "1. "
/** `"The page said instead:"`, the longest label, padded 2 spaces further. */
const LABEL_WIDTH = 24

export function formatReport(report: TestReport): Line[] {
  const lines: Line[] = []
  lines.push(heading(report))
  lines.push(blank())

  for (const test of report.tests) {
    lines.push(testLine(test))
    if (test.status === 'failed') lines.push(...failureDetail(test))
  }

  lines.push(blank())
  lines.push(resultLine(report.tests))
  return lines
}

function heading(report: TestReport): Line {
  const time = formatClock(report.startedAt)
  return {
    text: `▶ End-to-end tests for ${report.service} · ${report.tests.length} checks · started ${time}`,
    tone: 'heading',
  }
}

function blank(): Line {
  return { text: '', tone: 'muted' }
}

function testLine(test: TestResult): Line {
  const icon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○'
  const label = test.status === 'skipped' ? 'skipped' : formatDuration(test.durationMs)
  const prefix = `  ${icon} ${test.name}`
  const gap = Math.max(1, LINE_WIDTH - prefix.length - label.length)
  const tone: LineTone =
    test.status === 'passed' ? 'pass' : test.status === 'failed' ? 'fail' : 'muted'
  return { text: `${prefix}${' '.repeat(gap)}${label}`, tone }
}

function failureDetail(test: TestResult): Line[] {
  const lines: Line[] = []
  test.steps.forEach((step, index) => {
    lines.push(stepLine(step, index))
    if (step.status !== 'ok') lines.push(...verdict(test))
  })
  return lines
}

function stepLine(step: TestStep, index: number): Line {
  const failed = step.status !== 'ok'
  const prefix = `${STEP_INDENT}${index + 1}. ${step.text}`
  const width = failed ? STEP_WIDTH_OTHER : STEP_WIDTH_OK
  const dots = Math.max(1, width - prefix.length - 2 - step.status.length)
  const suffix = step.note ? `${step.status}  — ${step.note}` : step.status
  return { text: `${prefix} ${'.'.repeat(dots)} ${suffix}`, tone: failed ? 'fail' : 'detail' }
}

/** The one, two or three explanatory lines under a failing step: what was expected there (rare),
 * what the page said instead, and the best guess at why — each word-wrapped and aligned under a
 * shared label column (`LABEL_WIDTH`), the same way a real annotated diff lines up its comments. */
function verdict(test: TestResult): Line[] {
  const lines: Line[] = []
  if (test.expected !== undefined) lines.push(...detailLines('Expected:', test.expected))
  if (test.observed !== undefined) {
    lines.push(...detailLines('The page said instead:', `"${test.observed}"`))
  }
  if (test.likelyCause !== undefined)
    lines.push(...detailLines('Most likely cause:', test.likelyCause))
  return lines
}

function detailLines(label: string, value: string): Line[] {
  const width = LINE_WIDTH - DETAIL_INDENT.length - LABEL_WIDTH
  return wrap(value, width).map((text, index) => ({
    text: `${DETAIL_INDENT}${index === 0 ? label.padEnd(LABEL_WIDTH) : ' '.repeat(LABEL_WIDTH)}${text}`,
    tone: 'muted',
  }))
}

/** Greedy word-wrap: as many whole words as fit within `width` per line. */
function wrap(text: string, width: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > width && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function resultLine(tests: TestResult[]): Line {
  const passed = tests.filter((test) => test.status === 'passed').length
  const failed = tests.filter((test) => test.status === 'failed').length
  const skipped = tests.filter((test) => test.status === 'skipped').length

  const parts = [`${passed} passed`]
  if (failed > 0) parts.push(`${failed} failed`)
  if (skipped > 0) parts.push(`${skipped} skipped`)
  const closing =
    failed > 0
      ? "This change can't be merged until every check passes."
      : 'This change is ready to merge.'

  return { text: `Result: ${parts.join(' · ')} · ${closing}`, tone: failed > 0 ? 'fail' : 'pass' }
}

/** `800 -> "0.8s"`, `10400 -> "10.4s"`. */
function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/** Fake-clock seconds since the epoch to `"HH:MM"`, 24-hour, no timezone (arithmetic only — no
 * `Date`, so it can never depend on the machine running it). */
export function formatClock(now: number): string {
  const minutesInDay = 24 * 60
  const totalMinutes = ((Math.floor(now / 60) % minutesInDay) + minutesInDay) % minutesInDay
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * What a real Playwright run would print for the same results: a locator-timeout error and a
 * stack trace, not an English sentence. Shown behind "Show the real log," so a learner can see the
 * contrast for themselves rather than being told about it.
 */
export function formatRealLog(report: TestReport): string {
  const lines: string[] = []
  lines.push(`Running ${report.tests.length} tests using 1 worker`)
  lines.push('')

  report.tests.forEach((test, index) => {
    const icon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✘' : '-'
    const timing = test.status === 'skipped' ? '' : ` (${test.durationMs}ms)`
    lines.push(`  ${icon}  ${index + 1} ${specLocator(test)} › ${test.name}${timing}`)
  })
  lines.push('')

  const failures = report.tests.filter((test) => test.status === 'failed')
  failures.forEach((test, index) => lines.push(...failureBlock(report, test, index)))

  lines.push(`  ${failures.length} failed`)
  for (const test of failures) lines.push(`    ${specLocator(test)} › ${test.name}`)
  const passed = report.tests.length - failures.length
  const totalSeconds = (
    report.tests.reduce((sum, test) => sum + test.durationMs, 0) / 1000
  ).toFixed(1)
  lines.push(`  ${passed} passed (${totalSeconds}s)`)

  return lines.join('\n')
}

function failureBlock(report: TestReport, test: TestResult, index: number): string[] {
  const locator = specLocator(test)
  const line = lineNumberFor(test)
  const gaveUpIndex = test.steps.findIndex((step) => step.status !== 'ok')
  const target = test.steps[gaveUpIndex]?.text ?? test.name
  const previous = gaveUpIndex > 0 ? test.steps[gaveUpIndex - 1]?.text : undefined
  return [
    `  ${index + 1}) ${locator} › ${test.name} ${'─'.repeat(10)}`,
    '',
    `    TimeoutError: locator.waitFor: Timeout ${test.durationMs}ms exceeded.`,
    '    =========================== logs ===========================',
    `    waiting for locator(${JSON.stringify(target)}) to be visible`,
    '    ============================================================',
    '',
    `      ${line - 2} |   // ${previous ?? 'setup'}`,
    `      ${line - 1} |`,
    `    > ${line} |   await page.locator(${JSON.stringify(target)}).waitFor({ state: 'visible' });`,
    '        |                                        ^',
    `      ${line + 1} | });`,
    '',
    `        at Object.<anonymous> (/repo/${report.service}/e2e/${specFile(test)}:${line}:40)`,
    '',
  ]
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function specFile(test: TestResult): string {
  return `${slug(test.name)}.spec.ts`
}

function specLocator(test: TestResult): string {
  return `${specFile(test)}:${lineNumberFor(test)}:1`
}

/** A deterministic, plausible-looking line number for a test's stack trace — hashed from its
 * name, not `Math.random`, so the same test always "lives" on the same line. */
function lineNumberFor(test: TestResult): number {
  let hash = 0
  for (let i = 0; i < test.name.length; i++) hash = (hash * 31 + test.name.charCodeAt(i)) | 0
  return 8 + ((hash >>> 0) % 40)
}
