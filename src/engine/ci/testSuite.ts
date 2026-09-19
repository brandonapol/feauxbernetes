/**
 * Turns content's `TestSuite` into structured `TestResult`s. This is the "outcomes are a
 * deterministic function of the version's behaviour flags plus the test suite" half of the
 * ticket — the report formatting in `report.ts` doesn't know any of this happened.
 */
import type { JobStatus, TestResult, TestStep, TestSuite } from './types'

/**
 * Runs every test in `suite` against `behaviour`. A test in `skippedTests` (by name) comes back
 * `'skipped'` regardless of `behaviour` — that's the engine's side of Ch 5's "mark the test as
 * 'skip for now'" distractor. Otherwise a test with a `failure` whose `flag` is truthy in
 * `behaviour` fails on its last step; every other test passes with every step `'ok'`.
 */
export function runTestSuite(
  suite: TestSuite,
  behaviour: Record<string, unknown>,
  skippedTests: readonly string[] = []
): TestResult[] {
  const skipped = new Set(skippedTests)
  return suite.map((test): TestResult => {
    if (skipped.has(test.name)) {
      return { name: test.name, status: 'skipped', durationMs: 0, steps: [] }
    }

    const fails = test.failure !== undefined && Boolean(behaviour[test.failure.flag])
    if (!fails) {
      return {
        name: test.name,
        status: 'passed',
        durationMs: test.durationMs,
        steps: test.steps.map((text): TestStep => ({ text, status: 'ok' })),
      }
    }

    const lastIndex = test.steps.length - 1
    const steps = test.steps.map((text, index): TestStep => ({
      text,
      status: index === lastIndex ? 'gave up' : 'ok',
    }))
    return {
      name: test.name,
      status: 'failed',
      durationMs: test.durationMs,
      steps,
      observed: test.failure?.observed,
      expected: test.failure?.expected,
      likelyCause: test.failure?.likelyCause,
    }
  })
}

/**
 * Rolls a job's individual test outcomes up into one `JobStatus`: any failure fails the whole job
 * (it blocks merging — see `pipelineStatus`); no failures but at least one skipped test is the
 * yellow, non-blocking `'skipped'`; anything else is a clean `'passed'`.
 */
export function jobStatusFor(results: TestResult[]): JobStatus {
  if (results.some((result) => result.status === 'failed')) return 'failed'
  if (results.some((result) => result.status === 'skipped')) return 'skipped'
  return 'passed'
}

/** A job's displayed duration: the sum of however long each of its tests took. */
export function sumDurations(results: TestResult[]): number {
  return results.reduce((total, result) => total + result.durationMs, 0)
}
