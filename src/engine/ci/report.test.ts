import { describe, expect, it } from 'vitest'

import { SIGNUP_BUG_BEHAVIOUR, WEB_E2E_SUITE } from './__fixtures__/webE2eSuite'
import { formatClock, formatRealLog, formatReport } from './report'
import { runTestSuite } from './testSuite'

/** 10:42, as fake-clock seconds since the epoch. */
const STARTED_AT = 10 * 3600 + 42 * 60

describe('formatReport', () => {
  it('matches the Ch 5 sign-up failure sample in planning.md, line for line', () => {
    const tests = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR)
    const lines = formatReport({ service: 'web', startedAt: STARTED_AT, tests })
    expect(lines.map((line) => line.text).join('\n')).toMatchInlineSnapshot(`
      "▶ End-to-end tests for web · 4 checks · started 10:42

        ✓ A visitor can open the home page                           0.8s
        ✓ A visitor can search for "novel templates"                 1.2s
        ✗ A new visitor can sign up                                 10.4s
            1. Opened inkwell.example/signup ............................ ok
            2. Typed "sam@example.com" into Email ....................... ok
            3. Clicked the "Create account" button ...................... ok
            4. Waited for the page to say "Welcome!" .............. gave up
               The page said instead:  "Something went wrong (500)"
               Most likely cause:      web/signup.ts, line 42 — the new
                                       email check turns away any address
                                       with a dot in it.
        ✓ A member can log in                                        0.9s

      Result: 3 passed · 1 failed · This change can't be merged until every check passes."
    `)
  })

  it('reads like a sentence: a passing run has no failure detail at all', () => {
    const tests = runTestSuite(WEB_E2E_SUITE, {})
    const lines = formatReport({ service: 'web', startedAt: STARTED_AT, tests })
    expect(lines.every((line) => !line.text.includes('.....'))).toBe(true)
    expect(lines.at(-1)?.text).toBe('Result: 4 passed · This change is ready to merge.')
    expect(lines.at(-1)?.tone).toBe('pass')
  })

  it('flags a skipped test without failing the report', () => {
    const tests = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR, ['A new visitor can sign up'])
    const lines = formatReport({ service: 'web', startedAt: STARTED_AT, tests })
    expect(lines.at(-1)?.text).toBe('Result: 3 passed · 1 skipped · This change is ready to merge.')
    const skippedLine = lines.find((line) => line.text.includes('A new visitor can sign up'))
    expect(skippedLine?.text).toContain('skipped')
    expect(skippedLine?.tone).toBe('muted')
  })

  it('appends a step note after its verdict, when one is given', () => {
    const tests = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR)
    const failing = tests.find((test) => test.status === 'failed')
    if (!failing) throw new Error('expected a failing test')
    failing.steps[0] = { ...failing.steps[0], note: 'cached from an earlier run' }
    const lines = formatReport({ service: 'web', startedAt: STARTED_AT, tests: [failing] })
    expect(lines.some((line) => line.text.includes('ok  — cached from an earlier run'))).toBe(true)
  })
})

describe('formatClock', () => {
  it('renders fake-clock seconds as 24-hour HH:MM', () => {
    expect(formatClock(10 * 3600 + 42 * 60)).toBe('10:42')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(23 * 3600 + 59 * 60 + 59)).toBe('23:59')
  })

  it('wraps past a day, since the fake clock never stops', () => {
    expect(formatClock(24 * 3600 + 5 * 60)).toBe('00:05')
  })
})

describe('formatRealLog', () => {
  it('looks like a real Playwright failure, not an English sentence', () => {
    const tests = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR)
    const log = formatRealLog({ service: 'web', startedAt: STARTED_AT, tests })

    expect(log).toContain('Running 4 tests using 1 worker')
    expect(log).toContain('TimeoutError: locator.waitFor: Timeout 10400ms exceeded')
    expect(log).toContain('a-new-visitor-can-sign-up.spec.ts')
    expect(log).toContain('1 failed')
    expect(log).toContain('3 passed')
    expect(log).not.toContain('Most likely cause')
  })

  it('is deterministic for the same results', () => {
    const tests = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR)
    const report = { service: 'web', startedAt: STARTED_AT, tests }
    expect(formatRealLog(report)).toBe(formatRealLog(report))
  })
})
