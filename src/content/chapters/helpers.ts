import { createCluster } from '../../engine/cluster'
import type { GameState } from '../../engine/game'
import { createGitOps } from '../../engine/gitops'
import { STARTING_CLUSTER_SPEC, STARTING_GITOPS_SPEC } from '../world'

/** The production cluster and deploy repo as the learner finds them on day one. */
export function startingWorld(state: GameState): GameState {
  return {
    ...state,
    cluster: createCluster(STARTING_CLUSTER_SPEC),
    gitops: createGitOps(STARTING_GITOPS_SPEC),
  }
}

export const M1_TABS = ['flack', 'inkwell', 'arghcd'] as const
export const GITOPS_TABS = ['flack', 'inkwell', 'arghcd', 'gitnub'] as const
