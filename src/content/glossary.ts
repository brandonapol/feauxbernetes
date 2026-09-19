import type { DocsKey } from './docsLinks'

export interface GlossaryEntry {
  id: string
  term: string
  /** Other spellings and in-game phrasings that should link to this entry, lower case. */
  aliases?: string[]
  /** Plain words, 30 words at most. */
  definition: string
  docs?: DocsKey
}

/**
 * Exactly the terms in planning.md → "Vocabulary", plus the SRE terms named in issue #10. See
 * content.test.ts → "the vocabulary table in planning.md and the glossary agree".
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'node',
    term: 'node',
    aliases: ['box', 'boxes'],
    definition:
      "A machine that runs copies of an app. In Feauxbernetes you'll see this called a `box`. All the boxes together make up the `cluster`.",
    docs: 'kubernetesConcepts',
  },
  {
    id: 'cluster',
    term: 'cluster',
    definition:
      'All the `boxes` working together as one system. Ask for copies of an app, and the cluster finds room for them somewhere inside it.',
    docs: 'kubernetesConcepts',
  },
  {
    id: 'pod',
    term: 'pod',
    aliases: ['copy', 'copies'],
    definition:
      'One running instance of an app on a `node`. Feauxbernetes calls this a `copy` — if it dies, the cluster starts another to replace it.',
    docs: 'kubernetesConcepts',
  },
  {
    id: 'desired-state',
    term: 'desired state',
    aliases: ['wish'],
    definition:
      'What you want running: which app, which version, how many copies. Feauxbernetes calls it a `wish`; real engineers write it as YAML.',
    docs: 'kubernetesConcepts',
  },
  {
    id: 'declarative',
    term: 'declarative',
    aliases: ['say what you want, not how'],
    definition:
      'Describing the outcome you want, not the steps to get there — like setting a thermostat to 20°, rather than manually running the heater.',
    docs: 'kubernetesConcepts',
  },
  {
    id: 'apply',
    term: 'apply',
    aliases: ['make it so'],
    definition:
      'Telling the cluster to make reality match a `wish`. Say what you want once, and the cluster keeps it true from then on.',
    docs: 'kubernetesConcepts',
  },
  {
    id: 'sync',
    term: 'sync',
    aliases: ['argh cd made it match gitnub'],
    definition:
      "Argo CD's word for updating the running cluster to match what's committed in GitNub. Out of sync means the two currently disagree.",
    docs: 'argoCd',
  },
  {
    id: 'gitops',
    term: 'gitops',
    definition:
      "Running production from what's committed to a Git repository, not from manual changes. If it isn't in GitNub, it isn't real.",
    docs: 'argoCd',
  },
  {
    id: 'operator',
    term: 'operator',
    aliases: ['the robot that babysits the database'],
    definition:
      'Automation trusted to run something delicate, like a database, through backups and upgrades a person would otherwise have to do by hand.',
    docs: 'kubernetesConcepts',
  },
  {
    id: 'ci',
    term: 'ci',
    aliases: ['ci pipeline', 'continuous integration', 'the robots check your work'],
    definition:
      'Continuous integration: robots that automatically build and test every change before it can reach customers, catching broken code early.',
  },
  {
    id: 'e2e-test',
    term: 'end-to-end test',
    aliases: ['e2e test', 'e2e', 'a test that clicks through the site'],
    definition:
      'An automated test that clicks through the real site the way a customer would, checking a whole feature works, start to finish.',
  },
  {
    id: 'golden-signals',
    term: 'golden signals',
    definition:
      'The four numbers SREs watch for any service: latency (how slow), traffic (how busy), errors (how broken), and saturation (how full).',
    docs: 'sreBookSlos',
  },
  {
    id: 'slo',
    term: 'slo',
    aliases: ['service level objective', 'the number we promise'],
    definition:
      "The target reliability we promise ourselves for a service, such as '99.9% of checkouts succeed'. It's measured by the service's `SLI`.",
    docs: 'sreBookSlos',
  },
  {
    id: 'sli',
    term: 'sli',
    aliases: ['service level indicator'],
    definition:
      'The number that tells us whether a service is doing its job, such as the share of checkouts that succeed. An `SLO` is its target.',
    docs: 'sreBookSlos',
  },
  {
    id: 'error-budget',
    term: 'error budget',
    aliases: ['allowed failures'],
    definition:
      "How much failure an `SLO` allows before it's broken. Spend it on risky launches, or save it — once it's gone, ship carefully.",
    docs: 'sreBookSlos',
  },
  {
    id: 'burn-rate',
    term: 'burn rate',
    aliases: ['spending the budget too fast'],
    definition:
      "How many times faster than sustainable a service is spending its `error budget`. A rate of 14x empties a month's budget in about two days.",
    docs: 'sreBookAlerting',
  },
  {
    id: 'page',
    term: 'page',
    definition:
      "An urgent alert that wakes someone up, day or night, because something needs a human right now. Reserved for problems that can't wait.",
    docs: 'sreBookAlerting',
  },
  {
    id: 'on-call',
    term: 'on-call',
    aliases: ['oncall'],
    definition:
      'A rotating duty where one engineer is ready to respond if something breaks, whatever the hour, until the next person takes over.',
  },
  {
    id: 'incident',
    term: 'incident',
    definition:
      'An unplanned problem serious enough to need a coordinated response, not just one person quietly fixing it. Declaring one brings people together fast.',
    docs: 'pagerDutyIncidentResponse',
  },
  {
    id: 'incident-commander',
    term: 'incident commander',
    definition:
      "The person coordinating an `incident`: tracking what's known, assigning tasks and deciding next steps, so responders can focus on fixing the problem.",
    docs: 'pagerDutyIncidentResponse',
  },
  {
    id: 'mitigate',
    term: 'mitigate',
    aliases: ['stop the bleeding'],
    definition:
      'Making the damage stop or shrink right now, even before the cause is fully understood. Rolling back a bad deploy is a common way to do it.',
    docs: 'pagerDutyIncidentResponse',
  },
  {
    id: 'rollback',
    term: 'rollback',
    aliases: ['revert', 'undo the deploy'],
    definition:
      'Undoing a deploy by putting the previous, working version back. Often the fastest way to `mitigate` an incident caused by a recent change.',
    docs: 'argoCd',
  },
  {
    id: 'postmortem',
    term: 'postmortem',
    aliases: ['incident review', 'write-up'],
    definition:
      "A written review of what happened during an `incident`, why, and what will change so it's less likely to happen again. Always `blameless`.",
    docs: 'sreBookPostmortem',
  },
  {
    id: 'blameless',
    term: 'blameless',
    definition:
      'Focused on what in the system allowed a mistake to reach customers, never on blaming the person who made it. Systems fail; people fix them.',
    docs: 'sreBookPostmortem',
  },
  {
    id: 'mtta-mttr',
    term: 'mtta/mttr',
    aliases: ['mtta', 'mttr'],
    definition:
      'Two team-health numbers: mean time to acknowledge a `page`, and mean time to resolve an `incident`. Trends matter more than any single number.',
    docs: 'pagerDutyIncidentResponse',
  },
]

export function findGlossaryEntry(word: string): GlossaryEntry | undefined {
  const needle = word.toLowerCase()
  return GLOSSARY.find((entry) => entry.term === needle || entry.aliases?.includes(needle))
}
