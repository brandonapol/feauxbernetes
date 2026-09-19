import { describe, expect, it } from 'vitest'

import { SIGNUP_BUG_BEHAVIOUR, WEB_E2E_SUITE } from './__fixtures__/webE2eSuite'
import { jobStatusFor, runTestSuite, sumDurations } from './testSuite'

describe('runTestSuite', () => {
  it('passes every test, every step "ok", when no behaviour flag trips a failure', () => {
    const results = runTestSuite(WEB_E2E_SUITE, {})
    expect(results.every((result) => result.status === 'passed')).toBe(true)
    for (const result of results) {
      expect(result.steps.every((step) => step.status === 'ok')).toBe(true)
      expect(result.observed).toBeUndefined()
      expect(result.likelyCause).toBeUndefined()
    }
  })

  it('fails only the test whose flag is set, and only on its last step', () => {
    const results = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR)
    const failing = results.find((result) => result.name === 'A new visitor can sign up')
    if (!failing) throw new Error('expected the sign-up test in the fixture')
    expect(failing.status).toBe('failed')
    expect(failing.steps.slice(0, -1).every((step) => step.status === 'ok')).toBe(true)
    expect(failing.steps.at(-1)?.status).toBe('gave up')
    expect(failing.observed).toBe('Something went wrong (500)')
    expect(failing.likelyCause).toContain('web/signup.ts, line 42')

    const others = results.filter((result) => result.name !== 'A new visitor can sign up')
    expect(others.every((result) => result.status === 'passed')).toBe(true)
  })

  it('is deterministic: the same suite and behaviour always produce the same results', () => {
    const a = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR)
    const b = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR)
    expect(a).toEqual(b)
  })

  it('skips a named test regardless of behaviour, with no steps and no verdict', () => {
    const results = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR, ['A new visitor can sign up'])
    const skipped = results.find((result) => result.name === 'A new visitor can sign up')
    expect(skipped?.status).toBe('skipped')
    expect(skipped?.steps).toEqual([])
    expect(skipped?.observed).toBeUndefined()
  })
})

describe('jobStatusFor', () => {
  it('fails on any failure, even alongside a skip', () => {
    const results = runTestSuite(WEB_E2E_SUITE, SIGNUP_BUG_BEHAVIOUR, ['A member can log in'])
    expect(jobStatusFor(results)).toBe('failed')
  })

  it('is the yellow "skipped" when nothing failed but something was skipped', () => {
    const results = runTestSuite(WEB_E2E_SUITE, {}, ['A member can log in'])
    expect(jobStatusFor(results)).toBe('skipped')
  })

  it('is a clean "passed" when every test passed outright', () => {
    expect(jobStatusFor(runTestSuite(WEB_E2E_SUITE, {}))).toBe('passed')
  })
})

describe('sumDurations', () => {
  it('adds every result’s durationMs, including 0 for a skipped test', () => {
    const results = runTestSuite(WEB_E2E_SUITE, {}, ['A member can log in'])
    expect(sumDurations(results)).toBe(800 + 1200 + 10_400 + 0)
  })
})
