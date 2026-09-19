/**
 * CI: pipelines, jobs, and the plain-English test report. See planning.md → "CI".
 *
 * Pure and deterministic like every other engine here: no `Math.random`, no `Date.now` — every
 * function that cares about time takes `now` (fake-clock ms) as an argument. This package doesn't
 * import `src/engine/gitops` or `src/engine/cluster` at all, the same way `telemetry` stays
 * standalone (see its `VersionLookup`): a PR's version `behaviour` flags are resolved by the
 * caller (via cluster's `versionBehaviour`) and handed in already-resolved, and CI's only seam
 * back into gitops is the return value of `prCheckStatus`, which the caller feeds to
 * `setPRChecks`. CI has no idea what a pull request even is.
 */

export type JobKind = 'auto' | 'manual'
export type JobStatus = 'waiting' | 'running' | 'passed' | 'failed' | 'skipped'

/**
 * One job in a stage. `result` is only set for a job that ran a test suite — so far, that's just
 * the end-to-end job. A `'skipped'` job status means it finished with at least one skipped test
 * inside it (see `jobStatusFor`): it doesn't block merging, but it's shown yellow rather than
 * green, so the debt doesn't disappear from view.
 */
export interface Job {
  id: string
  name: string
  kind: JobKind
  status: JobStatus
  durationMs: number
  result?: TestResult[]
}

export interface Stage {
  name: string
  jobs: Job[]
}

/**
 * One pipeline run for one PR. `suite` and `behaviour` are resolved once, when the pipeline is
 * scheduled (see `schedulePipeline`), so every later `runJob` call is a pure function of state
 * already sitting on the pipeline — nothing more has to be threaded through by the caller.
 */
export interface Pipeline {
  id: string
  prId: string
  /** The app this pipeline is testing, e.g. `web` — what the report header names it. */
  service: string
  stages: Stage[]
  /** Fake-clock ms this pipeline was scheduled — the e2e report's "started HH:MM". */
  startedAt: number
  /** The end-to-end suite this PR's service ships, resolved once at schedule time. */
  suite: TestSuite
  /** The PR's version's behaviour flags (from cluster's `versionBehaviour`), resolved once too. */
  behaviour: Record<string, unknown>
  /** Test names the learner has marked "skip for now" (Ch 5's Suggest-a-fix distractor). */
  skippedTests: string[]
}

export interface CiState {
  pipelines: Record<string, Pipeline>
  /** Monotonic counter behind deterministic ids (see `ids.ts`). */
  nextId: number
}

/* ---- The test suite (content) and what running it produces (the engine's output) ---- */

/**
 * One test as content authors it: its steps, how long a clean run takes, and — if it can fail at
 * all — which behaviour flag trips it and what the failure looks like. `runTestSuite` is the only
 * thing that turns one of these into a `TestResult`; content never builds a `TestResult` by hand.
 */
export interface TestCase {
  name: string
  durationMs: number
  /** The steps a passing run walks through, in order. Only shown when the test fails. */
  steps: string[]
  /** Omit for a test that always passes. */
  failure?: TestFailure
}

export interface TestFailure {
  /** The test fails whenever `behaviour[flag]` is truthy. */
  flag: string
  /** What the page showed instead, on the step that gave up. */
  observed: string
  /** A one-sentence, plain-English best guess at the cause: a file, a line, and why. */
  likelyCause: string
  /** What that step expected there, when it's worth spelling out next to `observed` (e.g. a
   * wrong number, as in the Ch 10 coupon test). Omit when "the page said instead" says enough. */
  expected?: string
}

export type TestSuite = TestCase[]

export type TestStatus = 'passed' | 'failed' | 'skipped'

/**
 * One step of a test result. `status` is the literal word the report prints after the dots
 * (`'ok'`, `'gave up'`, …) rather than a fixed enum, so a caller other than a pipeline — the Test
 * Builder engine (#30), running steps against its own fake app model — can phrase a verdict
 * however reads best. `formatReport` never interprets this string, only prints it.
 */
export interface TestStep {
  text: string
  status: string
  /** An extra aside shown after the status, e.g. why a step was skipped. Rare. */
  note?: string
}

/**
 * The structured outcome of one test. A pipeline's end-to-end job produces these (`runTestSuite`),
 * and so, eventually, will the Test Builder (#30) — that's why this type has no idea a pipeline
 * exists: no job id, no pipeline id, nothing but the test itself and what happened.
 */
export interface TestResult {
  name: string
  status: TestStatus
  durationMs: number
  steps: TestStep[]
  /** What the page showed instead of what the failing step expected. Only set when `failed`. */
  observed?: string
  /** What the failing step expected there, when it's worth spelling out. Only set when `failed`. */
  expected?: string
  /** A one-sentence, plain-English best guess at the cause. Only set when `failed`. */
  likelyCause?: string
}

/* ---- The report ---- */

export type LineTone = 'pass' | 'fail' | 'muted' | 'heading' | 'detail'

/** One line of a rendered report, paired with how it should read (colour, weight). */
export interface Line {
  text: string
  tone: LineTone
}

/** What `formatReport`/`formatRealLog` render: which service, when it started, and the results. */
export interface TestReport {
  service: string
  startedAt: number
  tests: TestResult[]
}
