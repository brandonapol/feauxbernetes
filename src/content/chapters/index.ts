import type { Chapter } from '../../engine/story/types'
import { welcomeChapter } from './00-welcome'
import { boxesChapter } from './01-boxes'
import { orderFormChapter } from './02-order-form'
import { selfHealChapter } from './03-self-heal'
import { gitopsChapter } from './04-gitops'
import { ciChapter } from './05-ci'
import { wrapChapter } from './06-wrap'
import { seeingInsideChapter } from './07-seeing-inside'
import { sloChapter } from './ch7-slo'
import { alertsChapter } from './ch8-alerts'

export const CHAPTERS: Chapter[] = [
  welcomeChapter,
  boxesChapter,
  orderFormChapter,
  selfHealChapter,
  gitopsChapter,
  ciChapter,
  wrapChapter,
  seeingInsideChapter,
  sloChapter,
  alertsChapter,
]
