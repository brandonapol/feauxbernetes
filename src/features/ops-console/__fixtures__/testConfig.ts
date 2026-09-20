import type { Chapter, GameConfig, WishOption } from '../../../engine/story/types'

/** A normal wish: bumping `search` from 3 to 5 copies. */
export const SCALE_SEARCH: WishOption = {
  id: 'scale-search',
  label: 'Keep `5` copies of `search` running',
  preview: { label: 'copies', from: '3', to: '5' },
  kubectl: [
    {
      code: 'kubectl scale deployment search --replicas=5',
      note: 'Asks the cluster for 5 copies of search.',
    },
  ],
  action: { type: 'chooseWish', app: 'search', version: '1.4', copies: 5 },
}

/** Unplug a specific copy — "Show me" should land on `copy:<copyId>` (#57). */
export const UNPLUG_SEARCH: WishOption = {
  id: 'unplug-search',
  label: 'Unplug one copy of `search` (pretend it crashed)',
  kubectl: [
    {
      code: 'kubectl delete pod search-1 --force',
      note: 'Pretends this copy crashed. A replacement will appear on its own.',
    },
  ],
  action: { type: 'unplugCopy', copyId: 'search-1' },
}

/** Turn a box off — "Show me" should land on `box:<boxId>` (#57). */
export const TURN_OFF_BOX_B: WishOption = {
  id: 'turn-off-box-b',
  label: 'Turn off box B (pretend the machine died)',
  kubectl: [
    {
      code: 'kubectl drain box-b --ignore-daemonsets',
      note: 'Takes the box out of service. Copies on it move to other boxes.',
    },
  ],
  action: { type: 'setBox', boxId: 'box-b', on: false },
}

/** A deliberately wrong wish: picking it never dispatches anything to the cluster. */
export const DELETE_EVERYTHING: WishOption = {
  id: 'delete-everything',
  label: 'Delete everything and start over',
  kubectl: [{ code: 'kubectl delete deployment --all', note: 'Removes every copy of every app.' }],
  veto: "Let's not — that takes down the whole site, not just search. If something's actually broken, tell me what you're seeing first.",
}

/**
 * A minimal `GameConfig` for the Ops Console's component tests: one chapter, one step, whose
 * `wishOptions` and `ui.gitOpsEnforced` a test can control directly instead of needing real
 * chapter content (none exists yet — see `src/content/chapters`).
 */
export function testConfig(
  options: { wishOptions?: WishOption[]; gitOpsEnforced?: boolean } = {}
): GameConfig {
  const chapter: Chapter = {
    id: 'test-chapter',
    title: 'Test chapter',
    milestone: 'm1',
    intro: 'Testing.',
    setup: (state) => ({
      ...state,
      ui: {
        ...state.ui,
        unlockedTabs: ['flack', 'gitnub'],
        gitOpsEnforced: options.gitOpsEnforced ?? false,
      },
    }),
    steps: [
      {
        id: 'test-step',
        title: 'Test step',
        body: 'Test.',
        hints: [],
        goal: () => false,
        wishOptions: options.wishOptions,
      },
    ],
    summary: [],
  }
  return {
    chapters: [chapter],
    characters: {
      kai: {
        id: 'kai',
        name: 'Kai Nakamura',
        initials: 'KN',
        role: 'Senior SRE',
        color: '#9c36b5',
      },
    },
    channels: [{ id: 'platform', name: 'platform', kind: 'channel' }],
    defaultChannel: 'platform',
    startTime: 0,
  }
}
