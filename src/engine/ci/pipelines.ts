/**
 * A pipeline's lifecycle: schedule it (Build and Unit tests run immediately, deterministically,
 * from `behaviour`), run its manual end-to-end job when the learner clicks ▶, and let the learner
 * mark a test "skip for now." Borrows gitops's `pullRequests.ts` shape: small functions over a
 * state object, ids from a counter, a no-op instead of an error for a call the UI should never be
 * able to make (see `runJob`).
 */
import { makeId } from './ids'
import { jobStatusFor, runTestSuite, sumDurations } from './testSuite'
import type { CiState, Job, JobStatus, Pipeline, Stage, TestSuite } from './types'

export interface SchedulePipelineInput {
  prId: string
  /** The app this pipeline is testing, e.g. `web` — named in the e2e report's header. */
  service: string
  /** The end-to-end suite this PR's service ships (content). */
  suite: TestSuite
  /** This PR's version's resolved behaviour flags (from cluster's `versionBehaviour`). */
  behaviour: Record<string, unknown>
  buildDurationMs: number
  unitTestDurationMs: number
}

const REQUIRED_STAGES = 3 // Build, Unit tests, End-to-end tests — everything but Ready to merge.

/**
 * Opens a pipeline for a PR. Build and Unit tests are `'auto'` and resolve immediately (this
 * engine has no notion of a job "running" for a while on its own — see `startJob` for the manual
 * job's own two-phase flow): each fails only if `behaviour` sets its matching flag, so most
 * pipelines show both green before the learner ever looks at the Checks tab, exactly as Ch 5
 * expects. End-to-end tests stays `'waiting'` until `runJob`.
 */
export function schedulePipeline(
  ci: CiState,
  input: SchedulePipelineInput,
  now: number
): { ci: CiState; pipeline: Pipeline } {
  const id = makeId('pipeline', ci.nextId)
  const buildFails = Boolean(input.behaviour['buildFails'])
  const unitTestsFail = Boolean(input.behaviour['unitTestsFail'])

  const stages: Stage[] = [
    {
      name: 'Build',
      jobs: [
        {
          id: `${id}-build`,
          name: 'Build',
          kind: 'auto',
          status: buildFails ? 'failed' : 'passed',
          durationMs: input.buildDurationMs,
        },
      ],
    },
    {
      name: 'Unit tests',
      jobs: [
        {
          id: `${id}-unit`,
          name: 'Unit tests',
          kind: 'auto',
          status: unitTestsFail ? 'failed' : 'passed',
          durationMs: input.unitTestDurationMs,
        },
      ],
    },
    {
      name: 'End-to-end tests',
      jobs: [
        {
          id: `${id}-e2e`,
          name: 'Run end-to-end tests',
          kind: 'manual',
          status: 'waiting',
          durationMs: 0,
        },
      ],
    },
    {
      name: 'Ready to merge',
      jobs: [
        {
          id: `${id}-merge`,
          name: 'Ready to merge',
          kind: 'auto',
          status: 'waiting',
          durationMs: 0,
        },
      ],
    },
  ]

  const pipeline: Pipeline = {
    id,
    prId: input.prId,
    service: input.service,
    stages: withReadyToMerge(stages),
    startedAt: now,
    suite: input.suite,
    behaviour: input.behaviour,
    skippedTests: [],
  }

  return {
    ci: { pipelines: { ...ci.pipelines, [id]: pipeline }, nextId: ci.nextId + 1 },
    pipeline,
  }
}

/**
 * Marks the manual end-to-end job `'running'` — the UI's cue to animate "watching four tests
 * tick" before calling `runJob` to land the (already-determined) outcome. A no-op off a
 * `'waiting'` job, the same convention `gitops.approvePR` uses for a button the UI shouldn't be
 * able to show in the first place.
 */
export function startJob(ci: CiState, pipelineId: string, jobId: string): CiState {
  return updateJob(ci, pipelineId, jobId, (job) =>
    job.status === 'waiting' ? { ...job, status: 'running' } : job
  )
}

/**
 * Runs a manual job: for the end-to-end job, that means `runTestSuite` against the pipeline's own
 * `suite`/`behaviour`/`skippedTests`, then rolling those results up into the job's status and
 * duration (`jobStatusFor`/`sumDurations`). A no-op unless the job is `'waiting'` or `'running'` —
 * calling it twice, or on an `'auto'` job, changes nothing.
 */
export function runJob(ci: CiState, pipelineId: string, jobId: string): CiState {
  const pipeline = ci.pipelines[pipelineId]
  if (!pipeline) return ci

  return updateJob(ci, pipelineId, jobId, (job) => {
    if (job.kind !== 'manual' || (job.status !== 'waiting' && job.status !== 'running')) return job
    const results = runTestSuite(pipeline.suite, pipeline.behaviour, pipeline.skippedTests)
    return {
      ...job,
      status: jobStatusFor(results),
      durationMs: sumDurations(results),
      result: results,
    }
  })
}

/**
 * The engine's side of Ch 5's "mark the test as 'skip for now'" distractor: adds `testName` to the
 * pipeline's skip list. Doesn't touch any job by itself — the learner has to `runJob` again to see
 * the test come back yellow instead of red.
 */
export function skipTest(ci: CiState, pipelineId: string, testName: string): CiState {
  const pipeline = ci.pipelines[pipelineId]
  if (!pipeline || pipeline.skippedTests.includes(testName)) return ci
  return {
    ...ci,
    pipelines: {
      ...ci.pipelines,
      [pipelineId]: { ...pipeline, skippedTests: [...pipeline.skippedTests, testName] },
    },
  }
}

/** Build, Unit tests and End-to-end tests, rolled up: `'failed'` if any of them failed, `'running'`
 * while any of them hasn't finished, else `'passed'` (a `'skipped'` job doesn't block). */
export function pipelineStatus(pipeline: Pipeline): 'running' | 'passed' | 'failed' {
  const required = pipeline.stages.slice(0, REQUIRED_STAGES).flatMap((stage) => stage.jobs)
  if (required.some((job) => job.status === 'failed')) return 'failed'
  if (required.some((job) => job.status === 'waiting' || job.status === 'running')) return 'running'
  return 'passed'
}

/**
 * CI's only seam back into gitops: maps a pipeline's status to what `setPRChecks` expects.
 * `'open'` (not some "checks passed" status of its own) is deliberate — see `setPRChecks`'s own
 * doc comment: passing hands the PR back to `'open'` so Approve/Merge show up again.
 */
export function prCheckStatus(pipeline: Pipeline): 'checks-running' | 'checks-failed' | 'open' {
  const status = pipelineStatus(pipeline)
  if (status === 'failed') return 'checks-failed'
  if (status === 'running') return 'checks-running'
  return 'open'
}

function withReadyToMerge(stages: Stage[]): Stage[] {
  const required = stages.slice(0, REQUIRED_STAGES).flatMap((stage) => stage.jobs)
  const status: JobStatus = required.some((job) => job.status === 'failed')
    ? 'failed'
    : required.some((job) => job.status === 'waiting' || job.status === 'running')
      ? 'waiting'
      : 'passed'
  return stages.map((stage) =>
    stage.name === 'Ready to merge'
      ? { ...stage, jobs: stage.jobs.map((job) => ({ ...job, status })) }
      : stage
  )
}

function updateJob(
  ci: CiState,
  pipelineId: string,
  jobId: string,
  update: (job: Job) => Job
): CiState {
  const pipeline = ci.pipelines[pipelineId]
  if (!pipeline) return ci
  const stages = pipeline.stages.map((stage) => ({
    ...stage,
    jobs: stage.jobs.map((job) => (job.id === jobId ? update(job) : job)),
  }))
  return {
    ...ci,
    pipelines: { ...ci.pipelines, [pipelineId]: { ...pipeline, stages: withReadyToMerge(stages) } },
  }
}
