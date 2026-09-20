import { describe, expect, it } from 'vitest'

import type { Chapter } from '../engine/story/types'
import { CHANNELS, incidentChannel, incidentChannelId } from './channels'
import { characters } from './characters'
import { ALLOWED_DOCS_HOSTS, DOCS } from './docsLinks'
import { findGlossaryEntry, GLOSSARY } from './glossary'
import { GENERAL_QUESTIONS, MENTOR_FAQ } from './mentorFaq'
import {
  collectStrings,
  findDenylistedTerm,
  hasGenderedPronoun,
  KUBERNETES_DENYLIST,
  stepsMissingWrongAnswers,
  unknownGlossaryTerms,
} from './styleChecks'
import {
  SERVICE_VERSIONS,
  SERVICES,
  STARTING_CLUSTER_SPEC,
  STARTING_DATABASE,
  STARTING_WISHES,
  VERSION_BEHAVIOUR,
} from './world'

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * planning.md → "Vocabulary": the in-game phrase, and the real term(s) it's a twin for. Kept in
 * sync with that table by hand — if a row here stops matching planning.md, update both.
 */
const VOCABULARY = [
  { game: 'box', real: ['node', 'cluster'] },
  { game: 'copy', real: ['pod'] },
  { game: 'wish', real: ['desired state'] },
  { game: 'say what you want, not how', real: ['declarative'] },
  { game: 'Make it so', real: ['apply'] },
  { game: 'Argh CD made it match GitNub', real: ['sync', 'gitops'] },
  { game: 'the robot that babysits the database', real: ['operator'] },
  { game: 'the robots check your work', real: ['ci pipeline'] },
  { game: 'a test that clicks through the site', real: ['end-to-end test'] },
  { game: 'golden signals', real: ['golden signals'] },
  { game: 'the number we promise', real: ['slo', 'sli'] },
  { game: 'allowed failures', real: ['error budget'] },
  { game: 'spending the budget too fast', real: ['burn rate'] },
  { game: 'page', real: ['page'] },
  { game: 'stop the bleeding', real: ['mitigate'] },
  { game: 'undo the deploy', real: ['rollback', 'revert'] },
  { game: 'write-up', real: ['postmortem', 'incident review'] },
]

/** The SRE terms issue #10 lists on top of the Vocabulary table. */
const SRE_TERMS = [
  'SLI',
  'SLO',
  'error budget',
  'burn rate',
  'page',
  'on-call',
  'incident',
  'incident commander',
  'mitigate',
  'rollback',
  'postmortem',
  'blameless',
  'MTTA',
  'MTTR',
  'golden signals',
  'CI',
  'e2e test',
  'GitOps',
]

describe('docs links', () => {
  it('are https and on an allowlisted host', () => {
    for (const [key, link] of Object.entries(DOCS)) {
      const url = new URL(link.href)
      expect(url.protocol, key).toBe('https:')
      expect(ALLOWED_DOCS_HOSTS, key).toContain(url.hostname)
      expect(link.label.trim(), key).not.toBe('')
    }
  })
})

describe('glossary', () => {
  it('definitions are 30 words or fewer', () => {
    for (const entry of GLOSSARY) {
      expect(wordCount(entry.definition), entry.term).toBeLessThanOrEqual(30)
    }
  })

  it('has unique ids, terms and aliases, all lower case', () => {
    const words = GLOSSARY.flatMap((entry) => [entry.term, ...(entry.aliases ?? [])])
    expect(new Set(words).size).toBe(words.length)
    expect(new Set(GLOSSARY.map((entry) => entry.id)).size).toBe(GLOSSARY.length)
    for (const word of words) expect(word).toBe(word.toLowerCase())
  })

  it('links only to known docs', () => {
    for (const entry of GLOSSARY) {
      if (entry.docs) expect(DOCS[entry.docs], entry.term).toBeDefined()
    }
  })

  it('agrees with the vocabulary table in planning.md', () => {
    for (const row of VOCABULARY) {
      for (const term of row.real)
        expect(findGlossaryEntry(term), `${row.game} → ${term}`).toBeDefined()
    }
  })

  it('covers every SRE term issue #10 asks for, on top of the vocabulary table', () => {
    for (const term of SRE_TERMS) expect(findGlossaryEntry(term), term).toBeDefined()
  })

  it('every glossary cross-reference (backtick term) resolves to a real entry', () => {
    expect(unknownGlossaryTerms(GLOSSARY)).toEqual([])
  })
})

describe('Flack channels (#12)', () => {
  it('has #platform, #deploys, #alerts, and DMs with Morgan and Kai', () => {
    expect(CHANNELS.map((channel) => channel.id).sort()).toEqual([
      'alerts',
      'deploys',
      'dm-kai',
      'dm-morgan',
      'platform',
    ])
    expect(
      CHANNELS.filter((channel) => channel.kind === 'dm')
        .map((c) => c.characterId)
        .sort()
    ).toEqual(['kai', 'morgan'])
  })

  it('has unique channel ids', () => {
    const ids = CHANNELS.map((channel) => channel.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('builds a dynamic incident channel in the #inc-<n>-<slug> shape, distinct from the static list', () => {
    expect(incidentChannelId(3, 'billing-outage')).toBe('inc-3-billing-outage')
    const channel = incidentChannel(3, 'billing-outage', 'Coupons are double-discounting.')
    expect(channel).toMatchObject({
      id: 'inc-3-billing-outage',
      name: 'inc-3-billing-outage',
      kind: 'channel',
    })
    expect(CHANNELS.some((c) => c.id === channel.id)).toBe(false)
  })
})

describe('Ask Kai (#12)', () => {
  it('answers are 120 words or fewer', () => {
    for (const [id, entry] of Object.entries(MENTOR_FAQ)) {
      expect(wordCount(entry.answer), id).toBeLessThanOrEqual(120)
    }
  })

  it('every question has a docs link on the allowlist', () => {
    for (const [id, entry] of Object.entries(MENTOR_FAQ)) {
      const url = new URL(entry.docs.href)
      expect(ALLOWED_DOCS_HOSTS, id).toContain(url.hostname)
    }
  })

  it('offers every FAQ entry as a general question, since no chapter has its own yet', () => {
    expect(new Set(GENERAL_QUESTIONS)).toEqual(new Set(Object.keys(MENTOR_FAQ)))
  })
})

describe('services and the starting cluster', () => {
  it('has the four Inkwell services', () => {
    expect(SERVICES.map((service) => service.id).sort()).toEqual([
      'billing',
      'database',
      'search',
      'web',
    ])
  })

  it('starts a wish for every app service, but not for the database', () => {
    expect(STARTING_WISHES.map((wish) => wish.app).sort()).toEqual(['billing', 'search', 'web'])
    for (const wish of STARTING_WISHES) {
      expect(
        SERVICES.some((service) => service.id === wish.app),
        wish.app
      ).toBe(true)
    }
    expect(STARTING_DATABASE.health).toBe('Healthy')
  })

  it('has boxes A through D', () => {
    expect(STARTING_CLUSTER_SPEC.boxes.map((box) => box.name).sort()).toEqual([
      'Box A',
      'Box B',
      'Box C',
      'Box D',
    ])
    expect(STARTING_CLUSTER_SPEC.boxes.every((box) => box.capacity > 0 && box.on)).toBe(true)
  })

  it('has enough room for the starting wishes', () => {
    const totalCapacity = STARTING_CLUSTER_SPEC.boxes.reduce((sum, box) => sum + box.capacity, 0)
    const totalWished = STARTING_WISHES.reduce((sum, wish) => sum + wish.copies, 0)
    expect(totalCapacity).toBeGreaterThan(totalWished)
  })

  it('starts every app at a version from its own version list', () => {
    for (const wish of STARTING_WISHES) {
      expect(SERVICE_VERSIONS[wish.app], wish.app).toContain(wish.version)
    }
  })

  it('has the web 1.9 sign-up dot bug and the billing 2.4.1 coupon double-discount', () => {
    expect(VERSION_BEHAVIOUR['web@1.9']).toEqual({ signupRejectsDotInEmail: true })
    expect(VERSION_BEHAVIOUR['billing@2.4.1']).toEqual({ couponDoubleDiscount: true })
  })

  it('only flags behaviour on versions that actually exist', () => {
    for (const key of Object.keys(VERSION_BEHAVIOUR)) {
      const [app, version] = key.split('@')
      expect(SERVICE_VERSIONS[app], key).toContain(version)
    }
  })
})

// ---------------------------------------------------------------- style checks

/** A minimal, otherwise-clean chapter, used as the "should pass" half of each fixture pair. */
function cleanChapter(): Chapter {
  return {
    id: 'fixture-clean',
    title: 'A clean chapter',
    milestone: 'm1',
    intro: 'Kai walks you through the Applications page.',
    setup: (state) => state,
    steps: [
      {
        id: 'look-around',
        title: 'Look around',
        body: 'Click a `copy` of search and read its drawer.',
        hints: ['Click any copy tile.'],
        thinking: "They're steady. Nothing to worry about yet.",
        goal: () => true,
      },
      {
        id: 'pick-one',
        title: 'Pick the safest option',
        body: 'How many copies of search should we run?',
        hints: [],
        solution: { type: 'chooseOption', stepId: 'pick-one', optionId: 'three' },
        goal: (_state, event) =>
          event.type === 'optionChosen' &&
          event.stepId === 'pick-one' &&
          event.optionId === 'three',
        wrongAnswers: {
          one: 'Kai explains why one copy leaves no room for a crash.',
          five: 'Kai explains that five is safe, but three is what today calls for.',
        },
      },
    ],
    summary: ['You looked around.'],
  }
}

describe('style checks (issue #10) — proven against fixtures', () => {
  it('finds no denylisted Kubernetes terms in clean chapter text', () => {
    const violations = collectStrings(cleanChapter()).map(findDenylistedTerm).filter(Boolean)
    expect(violations).toEqual([])
  })

  for (const term of ['StatefulSet', 'ConfigMap', 'a sidecar container', 'the ingress rules']) {
    it(`catches a denylisted term ("${term}") nested inside a step's Kai response`, () => {
      const dirty = cleanChapter()
      dirty.steps[1].wrongAnswers = {
        ...dirty.steps[1].wrongAnswers,
        one: `Actually, it's ${term}.`,
      }
      const violations = collectStrings(dirty).map(findDenylistedTerm).filter(Boolean)
      expect(violations).toContain(findDenylistedTerm(term))
    })
  }

  it('allows ordinary English words the denylist could have collided with', () => {
    // "deploy", "service" and "node" are core vocabulary — the denylist must never flag them.
    const text = 'The service deploys a copy to the node, and the box comes back healthy.'
    expect(findDenylistedTerm(text)).toBeUndefined()
  })

  it('finds no gendered pronouns in clean chapter text', () => {
    expect(collectStrings(cleanChapter()).some(hasGenderedPronoun)).toBe(false)
  })

  for (const pronounSentence of [
    "Kai said he'd look into it.",
    'Morgan wants her to try again.',
    'Ask Alex — this is his change.',
  ]) {
    it(`catches a gendered pronoun nested inside a step's "thinking" line ("${pronounSentence}")`, () => {
      const dirty = cleanChapter()
      dirty.steps[0].thinking = pronounSentence
      expect(collectStrings(dirty).some(hasGenderedPronoun)).toBe(true)
    })
  }

  it('allows "they/them" and character names', () => {
    const text = 'Kai says they already rolled it back. Morgan agrees with them.'
    expect(hasGenderedPronoun(text)).toBe(false)
  })

  it('finds no unknown backtick-quoted glossary references in clean chapter text', () => {
    expect(unknownGlossaryTerms(cleanChapter())).toEqual([])
  })

  it('catches a backtick-quoted term that has no glossary entry', () => {
    const dirty = cleanChapter()
    dirty.steps[0].body = 'Open the `flux reconciler` and check its status.'
    expect(unknownGlossaryTerms(dirty)).toContain('flux reconciler')
  })

  it('passes a chapter where every chooseOption step has a Kai response for every wrong answer', () => {
    expect(stepsMissingWrongAnswers([cleanChapter()])).toEqual([])
  })

  it('catches a chooseOption step with no wrong answers at all', () => {
    const dirty = cleanChapter()
    delete dirty.steps[1].wrongAnswers
    expect(stepsMissingWrongAnswers([dirty])).toEqual(['pick-one'])
  })

  it('catches a chooseOption step with a blank Kai response', () => {
    const dirty = cleanChapter()
    dirty.steps[1].wrongAnswers = { one: '  ', five: 'Kai explains this one.' }
    expect(stepsMissingWrongAnswers([dirty])).toEqual(['pick-one'])
  })

  it("doesn't flag steps that aren't chooseOption steps", () => {
    expect(stepsMissingWrongAnswers([cleanChapter()])).not.toContain('look-around')
  })
})

describe("today's content is clean (chapters don't exist yet, but this content does)", () => {
  // Everything #10 actually ships: no chapters yet, so this is the real, non-fixture assertion —
  // the same functions above will scan chapters too, the moment a chapter ticket adds one.
  const todaysContent = [characters, GLOSSARY, SERVICES, DOCS, CHANNELS, MENTOR_FAQ]

  it('has no denylisted Kubernetes terms', () => {
    const violations = collectStrings(todaysContent).map(findDenylistedTerm).filter(Boolean)
    expect(violations).toEqual([])
  })

  it('never assigns pronouns to characters', () => {
    expect(collectStrings(todaysContent).some(hasGenderedPronoun)).toBe(false)
  })

  it('has no unknown backtick-quoted glossary references', () => {
    expect(unknownGlossaryTerms(todaysContent)).toEqual([])
  })
})

describe('KUBERNETES_DENYLIST', () => {
  it('is non-empty and lists only the real k8s object/tool names, not our own vocabulary', () => {
    expect(KUBERNETES_DENYLIST.length).toBeGreaterThan(10)
    const ourVocabulary = ['node', 'pod', 'apply', 'sync', 'operator', 'page']
    for (const word of ourVocabulary) {
      expect(KUBERNETES_DENYLIST.map((term) => term.toLowerCase())).not.toContain(word)
    }
  })
})
