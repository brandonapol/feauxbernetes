import type { Chapter } from '../../engine/story/types'
import { welcomeChapter } from './00-welcome'
import { boxesChapter } from './01-boxes'
import { orderFormChapter } from './02-order-form'

export const CHAPTERS: Chapter[] = [welcomeChapter, boxesChapter, orderFormChapter]
