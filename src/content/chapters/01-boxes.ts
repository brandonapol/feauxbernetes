import type { Chapter } from '../../engine/story/types'
import { DOCS } from '../docsLinks'
import { startingWorld } from './helpers'

export const boxesChapter: Chapter = {
  id: '01-boxes',
  title: 'Boxes that run stuff',
  milestone: 'm1',
  intro:
    'Three pictures, then the jargon. A **box** is a machine. A **copy** is one running instance of an app on a box. The screen has three columns: Instructions (this panel), the fake browser in the middle, and the Ops Console on the right (a live feed — you don’t have to click it). Kai is going to show you Argh CD.',
  setup: (state) => {
    const world = startingWorld(state)
    return {
      ...world,
      ui: { ...world.ui, activeTab: 'arghcd', unlockedTabs: ['flack', 'inkwell', 'arghcd'] },
      flack: { ...world.flack, activeChannel: 'platform' },
    }
  },
  steps: [
    {
      id: 'open-search',
      title: 'Open search',
      body: 'Click the **search** tile. That’s the app that finds a customer’s documents.',
      hints: ['The search tile is on the Applications page.'],
      solution: { type: 'clickTarget', targetId: 'app:search' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'app:search',
      afterNote: 'Those circles are copies of search, grouped by the box they’re sitting on.',
      onEnter: [
        {
          type: 'flackMessage',
          id: 'kai-boxes',
          channel: 'platform',
          from: 'kai',
          text: "Each tile is an app. The line that says **wants 3 · has 3** is the whole idea: we asked for three copies, and three are running. You'll hear engineers call a copy a `pod`, a box a `node`, and all the boxes together a `cluster`. You don't need those words to do the job — but you'll hear them.",
        },
      ],
      docs: [DOCS.kubernetesConcepts],
    },
    {
      id: 'open-a-copy',
      title: 'Click a copy',
      body: 'Click any copy of search and read the drawer. Note the version, the box, and how many times it’s been restarted.',
      hints: ['Any of the labelled circles on the search page opens the drawer.'],
      solution: { type: 'clickTarget', targetId: 'app-copy:search' },
      goal: (_state, event) =>
        event.type === 'targetClicked' && event.targetId === 'app-copy:search',
      afterNote:
        'A copy isn’t precious. If this one vanished, the cluster would start another to replace it.',
    },
    {
      id: 'boxes-view',
      title: 'Flip to Boxes',
      body: 'Open the **Boxes** view. Same copies, grouped by the machine they’re on.',
      hints: ['Boxes is the other link in Argh CD’s own nav, next to Applications.'],
      solution: { type: 'clickTarget', targetId: 'arghcd-boxes' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'arghcd-boxes',
    },
    {
      id: 'count-box-b',
      title: 'How many copies on Box B?',
      body: 'Once the cluster has settled, Box A fills first (room for 4). The rest land on Box B. How many copies are on **Box B**?',
      hints: ['Count every circle sitting under Box B — any app, not just search.'],
      options: [
        { id: 'zero', label: 'None. Everything is on Box A.' },
        { id: 'one', label: 'One.' },
        { id: 'four', label: 'Four.' },
        { id: 'eight', label: 'Eight — all of them.' },
      ],
      solution: { type: 'chooseOption', stepId: 'count-box-b', optionId: 'four' },
      goal: (_state, event) =>
        event.type === 'optionChosen' &&
        event.stepId === 'count-box-b' &&
        event.optionId === 'four',
      wrongAnswers: {
        zero: 'Kai: "Box A fills first, but it only has room for four. The rest spill onto Box B. Have another look."',
        one: 'Kai: "One would mean almost nothing overflowed. Count every circle under Box B."',
        eight:
          'Kai: "Eight is the whole cluster. Box A is holding four of them. The other four are on B."',
      },
    },
    {
      id: 'database-tile',
      title: 'Meet the dragon',
      body: 'Go back to Applications and click the 🐉 **database** tile. Read why you can’t unplug it.',
      hints: ['Applications, then the tile with the dragon.'],
      solution: { type: 'clickTarget', targetId: 'database' },
      goal: (_state, event) => event.type === 'targetClicked' && event.targetId === 'database',
      afterNote:
        'A website copy is disposable. The database remembers things, so restarting it is delicate. That’s the whole “here be dragons” — we’ll come back to it, we won’t make you operate one.',
      onComplete: [
        {
          type: 'flackMessage',
          id: 'robin-cameo',
          channel: 'platform',
          from: 'robin',
          text: 'So it’s like… several copies of the same shop, in different buildings?',
          quickReplies: [
            { id: 'yes', text: 'Pretty much — and if one building floods, the others stay open.' },
            { id: 'sort-of', text: 'Sort of. The shops are identical on purpose.' },
            { id: 'more', text: 'Yes, and something keeps the number of shops constant.' },
          ],
        },
      ],
    },
    {
      id: 'reply-robin',
      title: 'Reply to Robin',
      body: 'Robin’s asking the question a non-engineer would ask. Any reply is fine — Kai will add nuance.',
      hints: ['The reply buttons are under Robin’s message in #platform.'],
      solution: { type: 'flackReply', messageId: 'robin-cameo', replyId: 'yes' },
      goal: (_state, event) => event.type === 'flackReply' && event.messageId === 'robin-cameo',
      onComplete: [
        {
          type: 'flackMessage',
          id: 'kai-nuance',
          channel: 'platform',
          from: 'kai',
          text: "That's the picture. Identical copies, several buildings, and a wish that says how many. If a copy dies, another one appears. You don't keep a copy alive — you keep the wish true.",
          delayMs: 800,
        },
      ],
    },
  ],
  mentorQuestions: ['what-is-a-pod'],
  summary: [
    'Apps run as copies, spread across boxes, so one box dying doesn’t take the app down.',
    'Engineers call a copy a pod, a box a node, and all the boxes a cluster. You only needed to hear those once.',
    'The database is the dragon: it remembers things, so we don’t treat it like a disposable copy.',
  ],
}
