import { describe, expect, it } from 'vitest'

import { SIGNUP_BUG_BEHAVIOUR, WEB_E2E_SUITE } from './__fixtures__/webE2eSuite'
import { createCiState, findPipeline, pipelineForPR } from './ci'
import {
  prCheckStatus,
  pipelineStatus,
  runJob,
  schedulePipeline,
  skipTest,
  startJob,
  type SchedulePipelineInput,
} from './pipelines'

const BASE_INPUT: SchedulePipelineInput = {
  prId: 'pr-0001',
  service: 'web',
  suite: WEB_E2E_SUITE,
  behaviour: {},
  buildDurationMs: 4000,
  unitTestDurationMs: 6000,
}

function e2eJobId(pipelineId: string): string {
  return `${pipelineId}-e2e`
}

describe('schedulePipeline', () => {
  it('resolves Build and Unit tests immediately and leaves the manual e2e job waiting', () => {
    const { pipeline } = schedulePipeline(createCiState(), BASE_INPUT, 1000)
    expect(pipeline.stages.map((stage) => stage.name)).toEqual([
      'Build',
      'Unit tests',
      'End-to-end tests',
      'Ready to merge',
    ])
    expect(pipeline.stages[0].jobs[0].status).toBe('passed')
    expect(pipeline.stages[1].jobs[0].status).toBe('passed')
    expect(pipeline.stages[2].jobs[0]).toMatchObject({ kind: 'manual', status: 'waiting' })
    expect(pipeline.stages[3].jobs[0].status).toBe('waiting')
    expect(pipeline.startedAt).toBe(1000)
  })

  it('fails Build or Unit tests outright when behaviour says so, and blocks Ready to merge', () => {
    const { pipeline } = schedulePipeline(
      createCiState(),
      { ...BASE_INPUT, behaviour: { buildFails: true } },
      0
    )
    expect(pipeline.stages[0].jobs[0].status).toBe('failed')
    expect(pipeline.stages[3].jobs[0].status).toBe('failed')
  })

  it('is findable by pipeline id and by PR id', () => {
    const { ci, pipeline } = schedulePipeline(createCiState(), BASE_INPUT, 0)
    expect(findPipeline(ci, pipeline.id)).toEqual(pipeline)
    expect(pipelineForPR(ci, BASE_INPUT.prId)).toEqual(pipeline)
    expect(pipelineForPR(ci, 'no-such-pr')).toBeUndefined()
  })

  it('gives each scheduled pipeline a fresh id', () => {
    let ci = createCiState()
    const first = schedulePipeline(ci, BASE_INPUT, 0)
    ci = first.ci
    const second = schedulePipeline(ci, { ...BASE_INPUT, prId: 'pr-0002' }, 0)
    expect(first.pipeline.id).not.toBe(second.pipeline.id)
  })
})

describe('startJob / runJob', () => {
  it('a manual job stays waiting until runJob — starting it only shows "running"', () => {
    const { ci, pipeline } = schedulePipeline(createCiState(), BASE_INPUT, 0)
    const jobId = e2eJobId(pipeline.id)

    const running = startJob(ci, pipeline.id, jobId)
    const runningJob = findPipeline(running, pipeline.id)?.stages[2].jobs[0]
    expect(runningJob?.status).toBe('running')
    expect(runningJob?.result).toBeUndefined()
  })

  it('runJob computes the e2e job’s outcome from the suite and behaviour, deterministically', () => {
    const { ci } = schedulePipeline(
      createCiState(),
      { ...BASE_INPUT, behaviour: SIGNUP_BUG_BEHAVIOUR },
      0
    )
    const pipeline = pipelineForPR(ci, BASE_INPUT.prId)
    if (!pipeline) throw new Error('expected a scheduled pipeline')

    const ran = runJob(ci, pipeline.id, e2eJobId(pipeline.id))
    const job = findPipeline(ran, pipeline.id)?.stages[2].jobs[0]
    expect(job?.status).toBe('failed')
    expect(job?.result).toHaveLength(4)
    expect(job?.durationMs).toBe(800 + 1200 + 10_400 + 900)
  })

  it('is a no-op on an already-resolved job (calling it twice changes nothing further)', () => {
    const { ci, pipeline } = schedulePipeline(createCiState(), BASE_INPUT, 0)
    const jobId = e2eJobId(pipeline.id)
    const once = runJob(ci, pipeline.id, jobId)
    const twice = runJob(once, pipeline.id, jobId)
    expect(twice).toEqual(once)
  })

  it('a failed required job blocks Ready to merge and reports checks-failed', () => {
    const { ci, pipeline } = schedulePipeline(
      createCiState(),
      { ...BASE_INPUT, behaviour: SIGNUP_BUG_BEHAVIOUR },
      0
    )
    const ran = runJob(ci, pipeline.id, e2eJobId(pipeline.id))
    const failedPipeline = findPipeline(ran, pipeline.id)
    if (!failedPipeline) throw new Error('expected the pipeline still to exist')

    expect(pipelineStatus(failedPipeline)).toBe('failed')
    expect(prCheckStatus(failedPipeline)).toBe('checks-failed')
    expect(failedPipeline.stages[3].jobs[0].status).toBe('failed')
  })

  it('all green reports open (hands the PR back for approve/merge)', () => {
    const { ci, pipeline } = schedulePipeline(createCiState(), BASE_INPUT, 0)
    const ran = runJob(ci, pipeline.id, e2eJobId(pipeline.id))
    const greenPipeline = findPipeline(ran, pipeline.id)
    if (!greenPipeline) throw new Error('expected the pipeline still to exist')

    expect(pipelineStatus(greenPipeline)).toBe('passed')
    expect(prCheckStatus(greenPipeline)).toBe('open')
    expect(greenPipeline.stages[3].jobs[0].status).toBe('passed')
  })

  it('still on the manual stage reports checks-running', () => {
    const { ci, pipeline } = schedulePipeline(createCiState(), BASE_INPUT, 0)
    expect(prCheckStatus(pipeline)).toBe('checks-running')
    expect(pipelineForPR(ci, BASE_INPUT.prId)).toEqual(pipeline)
  })
})

describe('skipTest', () => {
  it('marks a test skipped without blocking, and flags it rather than hiding it', () => {
    const scheduled = schedulePipeline(
      createCiState(),
      { ...BASE_INPUT, behaviour: SIGNUP_BUG_BEHAVIOUR },
      0
    )
    const pipeline = scheduled.pipeline
    let ci = skipTest(scheduled.ci, pipeline.id, 'A new visitor can sign up')
    ci = runJob(ci, pipeline.id, e2eJobId(pipeline.id))
    const skippedPipeline = findPipeline(ci, pipeline.id)
    if (!skippedPipeline) throw new Error('expected the pipeline still to exist')

    const e2eJob = skippedPipeline.stages[2].jobs[0]
    expect(e2eJob.status).toBe('skipped')
    expect(e2eJob.result?.find((r) => r.name === 'A new visitor can sign up')?.status).toBe(
      'skipped'
    )
    // Doesn't block merging, but Ready to merge still needs to know it happened.
    expect(pipelineStatus(skippedPipeline)).toBe('passed')
    expect(prCheckStatus(skippedPipeline)).toBe('open')
  })

  it('is idempotent — skipping the same test twice only records it once', () => {
    const { ci, pipeline } = schedulePipeline(createCiState(), BASE_INPUT, 0)
    const once = skipTest(ci, pipeline.id, 'A member can log in')
    const twice = skipTest(once, pipeline.id, 'A member can log in')
    expect(findPipeline(twice, pipeline.id)?.skippedTests).toEqual(['A member can log in'])
  })
})
