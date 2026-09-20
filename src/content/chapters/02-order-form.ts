import { createCluster } from '../../engine/cluster'
import type { Chapter } from '../../engine/story/types'
import { createGitOps } from '../../engine/gitops'
import { STARTING_CLUSTER_SPEC, STARTING_GITOPS_SPEC, STARTING_WISHES } from '../world'

export const orderFormChapter: Chapter = {
  id: '02-order-form',
  title: 'Say what you want, not how',
  milestone: 'm1',
  intro:
    'Kai is about to show you the difference between doing the work yourself and writing down what you want. You’ll hear engineers call that **declarative**.',
  setup: (state) => {
    const wishes = STARTING_WISHES.map((wish) =>
      wish.app === 'search' ? { ...wish, copies: 1 } : wish
    )
    return {
      ...state,
      cluster: createCluster({ ...STARTING_CLUSTER_SPEC, wishes }),
      gitops: createGitOps(STARTING_GITOPS_SPEC),
      ui: {
        ...state.ui,
        activeTab: 'arghcd',
        unlockedTabs: ['flack', 'inkwell', 'arghcd'],
        overlay: 'order-form',
      },
      flack: { ...state.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'recipe-one',
      title: 'Try the recipe',
      body: 'Kai’s eight-step recipe for starting a copy by hand is in the overlay. Click the first step. It’s tedious on purpose.',
      hints: ['The overlay is over the browser column. Click “Find a box with room”.'],
      solution: { type: 'clickTarget', targetId: 'recipe:0' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'recipe:0',
    },
    {
      id: 'recipe-two',
      title: 'Do one more by hand',
      body: 'Click the next step. You’ll get the idea.',
      hints: ['The next highlighted step in the overlay.'],
      solution: { type: 'clickTarget', targetId: 'recipe:1' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'recipe:1',
      afterNote: 'Or… you tell Feauxbernetes what you want, and it does all that, forever.',
    },
    {
      id: 'make-it-so',
      title: 'Make it so',
      body: 'The form built a wish card: **Keep 3 copies of search 1.4 running**. Click **Make it so**, then watch Argh CD go from wants 3 · has 1 to has 3.',
      hints: ['Make it so is the blue button on the wish card.'],
      solution: { type: 'chooseWish', app: 'search', version: '1.4', copies: 3 },
      goal: (_state, event) =>
        event.type === 'wishChosen' && event.app === 'search' && event.copies === 3,
      afterNote:
        'That’s declarative: you said what you wanted. The cluster keeps making it true. Engineers write the same wish as YAML.',
    },
    {
      id: 'watch-has',
      title: 'Watch wants · has',
      body: 'Look at Argh CD behind the overlay: **wants 3 · has 1** becomes **has 3** as copies start. Click the **search** tile if you want a closer look, then continue.',
      hints: [
        'The search tile is on the Applications page, under the overlay if you close it — or peek around it.',
      ],
      solution: { type: 'clickTarget', targetId: 'app:search' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'app:search',
    },
    {
      id: 'view-yaml',
      title: 'View as YAML',
      body: 'Open the overlay again if it closed, tick **View as YAML**, and hover or focus a line. Each YAML line is just the English sentence in a stricter format. You’ll never need to write one.',
      hints: ['Re-open the order form from the story, or use the checkbox labelled View as YAML.'],
      solution: { type: 'clickTarget', targetId: 'view-as-yaml' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'view-as-yaml',
      onEnter: [{ type: 'openOverlay', overlay: 'order-form' }],
    },
    {
      id: 'thermostat',
      title: 'The thermostat',
      body: 'You set 20°. You don’t tell the heater when to turn on. Click **Set 20°**. That’s declarative too.',
      hints: ['The thermostat control is at the bottom of the overlay.'],
      solution: { type: 'clickTarget', targetId: 'thermostat' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'thermostat',
    },
  ],
  mentorQuestions: ['what-is-a-pod'],
  summary: [
    'A wish is what you want: which app, which version, how many copies.',
    'Declarative means you say that, and something keeps it true — like a thermostat.',
    'YAML is the same wish in a stricter format. You’ll never need to write one.',
  ],
}
