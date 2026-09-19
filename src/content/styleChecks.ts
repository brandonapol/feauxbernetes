import type { Chapter } from '../engine/story/types'
import { findGlossaryEntry } from './glossary'

/**
 * Content style guide checks (planning.md → "Content style guide", issue #10). These walk *any*
 * data shape — a `Chapter[]`, or today, the characters/glossary/world content that already
 * exists — so the same functions keep working once chapter tickets (#18 onward) add real
 * chapters. `content.test.ts` proves that with inline fixtures, since no chapters exist yet.
 */

/**
 * Real Kubernetes terms that never appear in learner-facing copy (planning.md → "How much
 * Kubernetes?"). Adding a k8s term to the game needs a change to the Vocabulary table first, and
 * a matching glossary entry — not an addition here.
 */
export const KUBERNETES_DENYLIST = [
  'StatefulSet',
  'StatefulSets',
  'ReplicaSet',
  'ReplicaSets',
  'ConfigMap',
  'ConfigMaps',
  'namespace',
  'namespaces',
  'ingress',
  'kubelet',
  'kubectl',
  'CRD',
  'CRDs',
  'Helm',
  'sidecar',
  'sidecars',
  'DaemonSet',
  'DaemonSets',
  'PersistentVolume',
  'PersistentVolumes',
  'PersistentVolumeClaim',
  'PVC',
  'probe',
  'probes',
  'taint',
  'taints',
  'toleration',
  'tolerations',
  'RBAC',
] as const

/** Gendered pronouns that would mean we've guessed a character's pronouns. */
export const GENDERED_PRONOUNS = /\b(he|she|him|his|her|hers|himself|herself)\b/i

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Every string leaf inside `value`, walking arrays and plain objects and skipping functions,
 * numbers and everything else that isn't learner-facing text. Works on a `Chapter[]` just as well
 * as on `characters`, `GLOSSARY` or any other content export.
 */
export function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
  return []
}

/** The first denylisted Kubernetes term found in `text`, if any. */
export function findDenylistedTerm(text: string): string | undefined {
  return KUBERNETES_DENYLIST.find((term) =>
    new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text)
  )
}

/** Whether `text` guesses a character's pronouns instead of using they/them or a name. */
export function hasGenderedPronoun(text: string): boolean {
  return GENDERED_PRONOUNS.test(text)
}

/** Every backtick-quoted span in `text`, trimmed — the game's markup for "this is jargon". */
export function extractBacktickedTerms(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map(([, term]) => term.trim())
}

/**
 * Backtick-quoted terms in `value` that don't resolve to a glossary entry (by term or alias).
 * Content style guide: every jargon word gets its English twin, and the glossary is the one place
 * that pairing lives — a backtick reference to an unknown term is almost always a typo.
 */
export function unknownGlossaryTerms(value: unknown): string[] {
  const found = collectStrings(value).flatMap(extractBacktickedTerms)
  return [...new Set(found.filter((term) => !findGlossaryEntry(term)))]
}

/**
 * Ids of `chooseOption` steps (steps whose `solution` picks an option) that don't give every
 * wrong answer a Kai response. Content style guide: "wrong answers teach" — no bare "Incorrect."
 */
export function stepsMissingWrongAnswers(chapters: Chapter[]): string[] {
  const missing: string[] = []
  for (const chapter of chapters) {
    for (const step of chapter.steps) {
      if (step.solution?.type !== 'chooseOption') continue
      const answers = step.wrongAnswers
      const incomplete =
        !answers ||
        Object.keys(answers).length === 0 ||
        Object.values(answers).some((response) => !response.trim())
      if (incomplete) missing.push(step.id)
    }
  }
  return missing
}
