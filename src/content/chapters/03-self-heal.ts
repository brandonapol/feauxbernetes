import { reduce } from '../../engine/game'
import type { Chapter, WishOption } from '../../engine/story/types'
import { startingWorld } from './helpers'

/** Advance the cluster until starting copies are Running, so unplug/box-off have something to do. */
function settled(state: ReturnType<typeof startingWorld>, config: Parameters<typeof reduce>[0]) {
  let current = state
  for (let i = 0; i < 40; i++) {
    current = reduce(config, current, { type: 'tick', deltaMs: 250 }).state
  }
  return current
}

const UNPLUG: WishOption = {
  id: 'unplug-search',
  label: 'Unplug one copy of search (pretend it crashed)',
  kubectl: [
    {
      code: 'delete this copy --force',
      note: 'Pretends this copy crashed. A replacement will appear on its own.',
    },
  ],
  action: { type: 'unplugCopy', copyId: 'any:search' },
}

const BOX_OFF: WishOption = {
  id: 'box-b-off',
  label: 'Turn off box B (pretend the machine died)',
  kubectl: [
    {
      code: 'drain box-b',
      note: 'Takes the box out of service. Copies on it move to other boxes.',
    },
  ],
  action: { type: 'setBox', boxId: 'box-b', on: false },
}

const SCALE_FIVE: WishOption = {
  id: 'scale-search-5',
  label: 'Keep 5 copies of search running',
  preview: { label: 'copies', from: '3', to: '5' },
  kubectl: [
    {
      code: 'scale search --replicas=5',
      note: 'Asks the cluster for 5 copies of search.',
    },
  ],
  action: { type: 'chooseWish', app: 'search', version: '1.4', copies: 5 },
}

const DELETE_ALL: WishOption = {
  id: 'delete-everything',
  label: 'Delete everything and start over',
  kubectl: [{ code: 'delete --all', note: 'Removes every copy of every app.' }],
  veto: "Let's not — that takes down the whole site, not just search. If a copy crashed, unplug that one and watch the replacement. If a box died, turn that box off.",
}

export const selfHealChapter: Chapter = {
  id: '03-self-heal',
  title: 'It turns itself back on',
  milestone: 'm1',
  intro:
    'This is why one crashed copy at 3am doesn’t wake anybody up. You’ll pretend things fail, and watch the cluster put them back.',
  setup: (state, config) => {
    const world = settled(startingWorld(state), config)
    return {
      ...world,
      ui: {
        ...world.ui,
        activeTab: 'arghcd',
        unlockedTabs: ['flack', 'inkwell', 'arghcd'],
        canUnplugCopies: true,
      },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'unplug',
      title: 'Unplug a copy of search',
      body: 'In the Ops Console, pick **Unplug one copy of search** and **Make it so**. Watch Argh CD go wants 3 · has 2, then a replacement appear.',
      hints: ['The wishes are in the right-hand Ops Console.'],
      thinking: 'This is why one crashed copy at 3am doesn’t wake anybody up.',
      wishOptions: [UNPLUG, DELETE_ALL],
      solution: { type: 'unplugCopy', copyId: 'any:search' },
      goal: (_state, event) => event.type === 'copyUnplugged',
      afterNote: 'The wish didn’t change. The cluster still wanted 3, so it started another copy.',
      onEnter: [{ type: 'unlockUnplugCopy' }],
    },
    {
      id: 'box-off',
      title: 'Turn off Box B',
      body: 'Now pick **Turn off box B**. Every copy on it will reappear on other boxes. Watch the Boxes view if you like.',
      hints: ['Same Ops Console. The wish about turning the box off.'],
      wishOptions: [BOX_OFF, DELETE_ALL],
      solution: { type: 'setBox', boxId: 'box-b', on: false },
      goal: (_state, event) => event.type === 'boxToggled' && event.boxId === 'box-b' && !event.on,
      afterNote:
        'One box dying doesn’t take the app down, because copies already lived on more than one box.',
    },
    {
      id: 'scale-up',
      title: 'Ask for five copies',
      body: 'Ask for **5 copies of search**. Watch them appear one by one. The Ops Console feed narrates it in English.',
      hints: ['The wish card that says Keep 5 copies of search running.'],
      wishOptions: [SCALE_FIVE, DELETE_ALL],
      solution: { type: 'chooseWish', app: 'search', version: '1.4', copies: 5 },
      goal: (_state, event) =>
        event.type === 'wishChosen' && event.app === 'search' && event.copies === 5,
      afterNote: 'You said five. It became five. Same trick as the thermostat, with copies.',
    },
  ],
  mentorQuestions: ['why-not-restart'],
  summary: [
    'If a copy dies, another one appears. The wish didn’t change.',
    'If a box dies, its copies show up on other boxes.',
    'If you ask for more, you get more. That’s the whole self-healing lesson.',
  ],
}
