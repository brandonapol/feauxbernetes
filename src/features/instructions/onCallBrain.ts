import type { Chapter } from '../../engine/story/types'

/**
 * Whether the learner is on call themselves, for the on-call brain's label (planning.md → "The
 * On-call brain"): "What Kai's thinking" throughout M1/M2, "What you're thinking" once the story
 * reaches M3 (the on-call milestone — see planning.md → "Story, world and characters", "the week
 * ends on call"). Kept to this one simple check rather than a separate flag on `GameState`: the
 * chapter a step belongs to already says which milestone the story is in, so there's nothing else
 * to keep in sync as chapters are added or reordered.
 */
export function isLearnerOnCall(chapter: Pick<Chapter, 'milestone'>): boolean {
  return chapter.milestone === 'm3'
}
