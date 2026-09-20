import {
  health,
  type Box,
  type ClusterState,
  type Copy,
  type DatabaseHealth,
} from '../../engine/cluster'

/** "A", "A and B", or "A, B and D" — the join every summary sentence below uses for a list of
 * box names. */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Strips the "Box " prefix content puts on every box name, e.g. "Box A" → "A", so a sentence can
 * say "boxes A, B and D" without repeating the word "Box" for every one. */
function shortBoxName(name: string): string {
  return name.replace(/^Box\s+/i, '')
}

/** The one-sentence text alternative for the Applications page. */
export function applicationsSummarySentence(cluster: ClusterState, apps: string[]): string {
  const unhealthy = apps.filter((app) => health(cluster, app) !== 'Healthy')
  const dbHealthy = cluster.database.health === 'Healthy'
  if (unhealthy.length === 0 && dbHealthy) {
    return `All ${apps.length} apps and the database are healthy.`
  }
  const names = [...unhealthy, ...(dbHealthy ? [] : ['the database'])]
  return `${apps.length} apps and a database are running; ${joinWithAnd(names)} ${
    names.length === 1 ? 'needs' : 'need'
  } a look.`
}

/** The one-sentence text alternative for one app's view, e.g. "search: 3 copies running on boxes
 * A, B and D." */
export function appSummarySentence(app: string, copies: Copy[], boxes: Box[]): string {
  const running = copies.filter((copy) => copy.state === 'Running')
  if (running.length === 0) return `${app}: no copies running right now.`
  const boxNames = [...new Set(running.map((copy) => copy.boxId))].map(
    (boxId) => boxes.find((box) => box.id === boxId)?.name ?? boxId
  )
  const shortNames = boxNames.map(shortBoxName)
  const boxWord = shortNames.length === 1 ? 'box' : 'boxes'
  const copyWord = running.length === 1 ? 'copy' : 'copies'
  return `${app}: ${running.length} ${copyWord} running on ${boxWord} ${joinWithAnd(shortNames)}.`
}

/** The one-sentence text alternative for the Boxes view. */
export function boxesSummarySentence(cluster: ClusterState): string {
  const runningCount = cluster.copies.filter((copy) => copy.state === 'Running').length
  const onBoxes = cluster.boxes.filter((box) => box.on)
  const offBoxes = cluster.boxes.filter((box) => !box.on)
  let sentence = `${runningCount} ${runningCount === 1 ? 'copy is' : 'copies are'} running across ${
    onBoxes.length
  } ${onBoxes.length === 1 ? 'box' : 'boxes'}.`
  if (offBoxes.length > 0) {
    sentence += ` ${joinWithAnd(offBoxes.map((box) => box.name))} ${
      offBoxes.length === 1 ? 'is' : 'are'
    } off.`
  }
  return sentence
}

/** The one-sentence text alternative for the database view. */
export function databaseSummarySentence(dbHealth: DatabaseHealth, version: string): string {
  return `The database is ${dbHealth === 'Healthy' ? 'healthy' : 'degraded'}, running version ${version}.`
}
