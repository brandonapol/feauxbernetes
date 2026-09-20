import { createCluster } from '../../engine/cluster'
import { createGitOps } from '../../engine/gitops'
import type { Chapter } from '../../engine/story/types'
import { STARTING_CLUSTER_SPEC, STARTING_GITOPS_SPEC } from '../world'

/**
 * No chapters exist yet — they start with #18 ("Welcome to the platform team"). This placeholder
 * gives the engine a valid `GameConfig` to run against in the meantime: a real starting cluster,
 * and Flack/inkwell.example/Argh CD unlocked, matching planning.md's Ch 0 framing, behind one step
 * that's already satisfied. It exists only so the app shell (#5) has something real to render and
 * route to; the first chapter ticket replaces this array wholesale.
 */
export const CHAPTERS: Chapter[] = [
  {
    id: 'placeholder',
    title: 'Placeholder',
    milestone: 'm1',
    intro: 'Real chapters begin with #18.',
    setup: (state) => ({
      ...state,
      cluster: createCluster(STARTING_CLUSTER_SPEC),
      gitops: createGitOps(STARTING_GITOPS_SPEC),
      ui: { ...state.ui, unlockedTabs: ['flack', 'inkwell', 'arghcd'] },
    }),
    steps: [
      {
        id: 'placeholder-step',
        title: 'Look around',
        body: 'Real steps land with the first chapter ticket (#18).',
        hints: [],
        goal: () => true,
      },
    ],
    summary: ['Chapters begin with #18.'],
  },
]
