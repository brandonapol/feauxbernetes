import type { MentorEntry } from '../engine/story/types'
import { DOCS } from './docsLinks'

/**
 * Ask Kai (planning.md → "Flack (#12)"): Ask Robin's FAQ dropdown, ported, with Kai answering
 * instead. Story engine ticket #3 dropped the mentor wiring when it ported the engine without
 * content to hang it on; `engine/story/types.ts` (`MentorEntry`, `GameConfig.mentor`) and
 * `engine/game.ts` (`askMentor`) bring it back, and this is the content that fills it in.
 *
 * Each answer is Kai's own words only — content.test.ts checks every one is 120 words or fewer, in
 * keeping with the content style guide. The docs link isn't part of the word count: `askMentor`
 * appends it to the posted Flack message itself (see `engine/game.ts`).
 */
export const MENTOR_FAQ: Record<string, MentorEntry> = {
  'what-is-a-pod': {
    question: "What's a pod, really?",
    answer:
      "In real Kubernetes it's called a pod. Feauxbernetes calls it a `copy`: one running instance " +
      "of an app on a box. A copy isn't precious — if it crashes, the cluster starts another to " +
      "replace it, using the same wish it always had. That's the whole trick: you never keep one " +
      'copy alive by hand, you keep *enough copies running*. Copies come and go constantly, and ' +
      "that's expected, not alarming. What matters is whether the wish — how many copies, which " +
      'version — is being met, not whether any single copy survives the day.',
    docs: DOCS.kubernetesConcepts,
  },
  'why-not-restart': {
    question: 'Why not just restart the server?',
    answer:
      'Because "the server" isn\'t one thing here — it\'s however many copies your wish asks for, ' +
      "spread across boxes. Restarting one copy by hand doesn't fix anything the cluster wasn't " +
      'already doing on its own: if a copy dies, a replacement starts automatically, usually ' +
      "before anyone notices. If something's actually broken, restarting a copy just restarts the " +
      'same buggy version. The real question during an incident is always "what changed", not ' +
      '"did we restart it" — a bad deploy needs a rollback, not a reboot.',
    docs: DOCS.kubernetesConcepts,
  },
  'slo-vs-sla': {
    question: "What's the difference between an SLO and an SLA?",
    answer:
      'An SLO is the reliability target we set for ourselves, like "99.9% of checkouts succeed" — ' +
      "it's internal, and missing it just means we should slow down and fix things before it gets " +
      'worse. An SLA is a promise made *to customers*, usually written into a contract, with real ' +
      'consequences — refunds, credits — if we miss it. A healthy team sets its SLO stricter than ' +
      'any SLA it has, so it notices trouble and reacts long before it ever breaches what it ' +
      'promised externally.',
    docs: DOCS.sreBookSlos,
  },
  'rollback-vs-fix-forward': {
    question: 'Why roll back instead of fixing forward?',
    answer:
      'During an incident, the fastest way to stop customers from hurting is usually to put back ' +
      'the last version that worked — a rollback. Writing, testing and shipping an actual fix ' +
      "takes time you don't have while things are actively broken. Rolling back doesn't waste " +
      'that work either: the broken change just waits safely in GitNub until someone fixes it ' +
      'properly, without a ticking clock. Stop the bleeding first, understand and fix the cause ' +
      'second — that order is the whole idea behind mitigating before you diagnose.',
    docs: DOCS.pagerDutyIncidentResponse,
  },
  'why-databases-are-hard': {
    question: 'Why are databases so hard?',
    answer:
      "Most copies are disposable: stop one, start a new one, nobody notices. A database can't " +
      'work that way — it remembers things. Restart it the wrong way and you can lose data or ' +
      "corrupt it; move it carelessly and you risk the same. That's why the database gets a " +
      'specialised, extra-careful robot (an `operator`) to handle its backups and upgrades, ' +
      "instead of the ordinary reconcile loop every other copy uses. It's also why SREs treat the " +
      'database tile as "here be dragons": respected, not casually touched.',
    docs: DOCS.kubernetesConcepts,
  },
}

/** Always-on Ask Kai prompts. Chapter `mentorQuestions` are listed first and should be the
 * chapter-relevant ones; these two are the fallback everyone might still ask. */
export const GENERAL_QUESTIONS: string[] = ['what-is-a-pod', 'why-not-restart']
