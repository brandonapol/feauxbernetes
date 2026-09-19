import type { CiState, Pipeline } from './types'

/** An empty CI world: no pipelines have run yet. */
export function createCiState(): CiState {
  return { pipelines: {}, nextId: 0 }
}

export function findPipeline(ci: CiState, id: string): Pipeline | undefined {
  return ci.pipelines[id]
}

/** The pipeline scheduled for a PR, if any — what the Checks tab looks up by `pr.pipelineId`. */
export function pipelineForPR(ci: CiState, prId: string): Pipeline | undefined {
  return Object.values(ci.pipelines).find((pipeline) => pipeline.prId === prId)
}
