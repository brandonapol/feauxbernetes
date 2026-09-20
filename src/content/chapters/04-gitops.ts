import { DEPLOY_REPO } from '../../engine/gitops'
import type { Chapter } from '../../engine/story/types'
import { DOCS } from '../docsLinks'
import { startingWorld } from './helpers'

export const gitopsChapter: Chapter = {
  id: '04-gitops',
  title: 'Merge to deploy',
  milestone: 'm1',
  intro:
    'From this chapter on, a wish made in the Ops Console is temporary. GitNub is the source of truth. Argh CD makes the cluster match GitNub.',
  setup: (state) => {
    const world = startingWorld(state)
    return {
      ...world,
      ui: {
        ...world.ui,
        activeTab: 'gitnub',
        unlockedTabs: ['flack', 'inkwell', 'arghcd', 'gitnub'],
        gitOpsEnforced: true,
      },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'open-gitnub',
      title: 'Open GitNub',
      body: 'Open the **GitNub** tab, then **inkwell/deploy**. That’s the wish book Argh CD reads.',
      hints: ['GitNub is now unlocked in the fake browser’s tab strip.'],
      solution: { type: 'openTab', tab: 'gitnub' },
      goal: (state, event) =>
        (event.type === 'tabOpened' && event.tab === 'gitnub') || state.ui.activeTab === 'gitnub',
      onEnter: [{ type: 'unlockTab', tab: 'gitnub' }],
      docs: [DOCS.argoCd],
    },
    {
      id: 'propose-web',
      title: 'Bump web to 2.0',
      body: 'In the wish editor, set **web** to version **2.0** and **Propose change**. Pick any of the titles.',
      hints: ['The wish editor is the Code tab of inkwell/deploy.'],
      solution: {
        type: 'openPR',
        repo: DEPLOY_REPO,
        title: 'Bump web to 2.0',
        change: { kind: 'wish', app: 'web', wish: { app: 'web', version: '2.0', copies: 3 } },
        reviewers: ['kai'],
      },
      goal: (_state, event) => event.type === 'prOpened',
      afterNote: 'Checks run on their own for a wish change. Kai will approve in a moment.',
    },
    {
      id: 'merge-it',
      title: 'Merge the pull request',
      body: 'When checks are green and Kai has approved, click **Merge**. Watch the “Where is my change?” strip: PR opened → checks → merged → Argh CD → running.',
      hints: ['Merge is the green button at the bottom of the pull request. It stays disabled until review lands.'],
      solution: { type: 'mergePR', prId: 'latest' },
      goal: (_state, event) => event.type === 'prMerged',
      afterNote: 'Argh CD will make the cluster match GitNub. That’s GitOps.',
    },
    {
      id: 'watch-deploy',
      title: 'Watch the deploy',
      body: 'Open **Argh CD** and the **web** app. Copies of 2.0 appear one at a time; the old ones shut down. The caption will say “2 of 3 swapped.”',
      hints: ['Argh CD → web. Give it a second if copies are still starting.'],
      solution: { type: 'openTab', tab: 'arghcd' },
      goal: (_state, event) => event.type === 'tabOpened' && event.tab === 'arghcd',
    },
    {
      id: 'drift',
      title: 'Change it by hand — watch it bounce back',
      body: 'In the Ops Console, ask for **6 copies of web**. Argh CD will put it back, because GitNub still says 3. The banner is the lesson: changes here are temporary.',
      hints: ['The wish is in the Ops Console. Pick 6 copies of web.'],
      wishOptions: [
        {
          id: 'scale-web-6',
          label: 'Keep 6 copies of web running',
          preview: { label: 'copies', from: '3', to: '6' },
          kubectl: [{ code: 'scale web --replicas=6', note: 'A hand change. Argh CD will undo it.' }],
          action: { type: 'chooseWish', app: 'web', version: '2.0', copies: 6 },
        },
      ],
      solution: { type: 'chooseWish', app: 'web', version: '2.0', copies: 6 },
      goal: (_state, event) =>
        event.type === 'wishChosen' && event.app === 'web' && event.copies === 6,
      afterNote:
        'GitNub is the source of truth. A console change is a sticky note that Argh CD peels off.',
    },
    {
      id: 'dragons',
      title: 'Here be dragons',
      body: 'Click the 🐉 **database** tile. Why can’t we treat it like web?',
      hints: ['Argh CD Applications, the tile with the dragon.'],
      options: [
        {
          id: 'slow',
          label: 'The database is just slower to start, so we leave it alone.',
        },
        {
          id: 'remembers',
          label: 'It remembers things. Restarting it carelessly can lose or scramble data.',
        },
        {
          id: 'one-box',
          label: 'It only runs on one box, so we must never turn that box off.',
        },
      ],
      solution: { type: 'chooseOption', stepId: 'dragons', optionId: 'remembers' },
      goal: (_state, event) =>
        event.type === 'optionChosen' &&
        event.stepId === 'dragons' &&
        event.optionId === 'remembers',
      wrongAnswers: {
        slow:
          'Kai: "Start time isn’t the point. The database stores accounts and documents. A disposable copy of web can vanish; this can’t."',
        'one-box':
          'Kai: "It isn’t about one box. It’s that the data is unique. Copies of web are identical and replaceable. The database isn’t."',
      },
    },
  ],
  mentorQuestions: ['what-is-a-pod'],
  summary: [
    'A merged wish in GitNub is what Argh CD makes true. That’s GitOps.',
    'A change in the Ops Console is temporary — Argh CD puts it back.',
    'The database is the dragon: it remembers things, so we don’t treat it like a disposable copy.',
  ],
}
