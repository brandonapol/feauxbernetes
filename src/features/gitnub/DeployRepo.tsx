import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { SERVICE_VERSIONS } from '../../content'
import type { Wish } from '../../engine/cluster'
import { DEPLOY_REPO } from '../../engine/gitops'
import { useDispatch, useGame, useGameStore } from '../../store'
import { prPath, titleOptions, wishCardText } from './data'
import styles from './GitNub.module.css'
import { RepoHeader } from './RepoHeader'
import { YamlView } from './YamlView'

export function DeployRepo() {
  const gitops = useGame((s) => s.game.gitops)
  const dispatch = useDispatch()
  const store = useGameStore()
  const navigate = useNavigate()
  const wishes = gitops.deployRepo.wishes
  const apps = Object.keys(wishes)
  const [selectedApp, setSelectedApp] = useState(apps[0] ?? 'web')
  const current = wishes[selectedApp]
  const versions = SERVICE_VERSIONS[selectedApp] ?? (current ? [current.version] : ['1.0'])
  const [version, setVersion] = useState(current?.version ?? versions[0])
  const [copies, setCopies] = useState(current?.copies ?? 3)
  const [showYaml, setShowYaml] = useState(false)
  const [title, setTitle] = useState<string>()

  const draft: Wish | undefined = current ? { app: selectedApp, version, copies } : undefined

  const dirty = Boolean(current) && (current.version !== version || current.copies !== copies)

  const titles = useMemo(
    () => (current && draft ? titleOptions(selectedApp, current, draft) : []),
    [current, draft, selectedApp]
  )

  const pickApp = (app: string) => {
    const wish = wishes[app]
    setSelectedApp(app)
    setVersion(wish?.version ?? SERVICE_VERSIONS[app]?.[0] ?? '1.0')
    setCopies(wish?.copies ?? 3)
    setTitle(undefined)
  }

  const propose = () => {
    if (!draft || !dirty) return
    const chosen = title ?? titles[0]
    if (!chosen) return
    dispatch({
      type: 'openPR',
      repo: DEPLOY_REPO,
      title: chosen,
      change: { kind: 'wish', app: draft.app, wish: draft },
      reviewers: ['kai'],
    })
    const opened = store.getState().game.gitops.pullRequests.at(-1)
    if (opened) navigate(prPath(opened))
  }

  return (
    <div>
      <RepoHeader org="inkwell" repo="deploy" active="code" />
      <h2 className={styles.sectionTitle}>Wish editor</h2>
      <p className={styles.muted}>
        Tell GitNub what you want. Argh CD will make the cluster match. You never type YAML.
      </p>

      {apps.length === 0 ? (
        <p className={styles.muted}>No wishes in this repo yet.</p>
      ) : (
        <>
          <div className={styles.wishForm}>
            <label className={styles.field}>
              App
              <select value={selectedApp} onChange={(event) => pickApp(event.target.value)}>
                {apps.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Version
              <select value={version} onChange={(event) => setVersion(event.target.value)}>
                {versions.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Copies
              <span className={styles.stepper}>
                <button
                  type="button"
                  aria-label="Fewer copies"
                  disabled={copies <= 1}
                  onClick={() => setCopies((n) => Math.max(1, n - 1))}
                >
                  −
                </button>
                <span aria-live="polite">{copies}</span>
                <button
                  type="button"
                  aria-label="More copies"
                  disabled={copies >= 10}
                  onClick={() => setCopies((n) => Math.min(10, n + 1))}
                >
                  +
                </button>
              </span>
            </label>
          </div>

          {draft && (
            <p className={styles.wishCard} role="status">
              {wishCardText(draft)}
            </p>
          )}

          <label className={styles.yamlToggle}>
            <input
              type="checkbox"
              checked={showYaml}
              onChange={(event) => setShowYaml(event.target.checked)}
            />
            View as YAML
          </label>
          {showYaml && draft && (
            <>
              <YamlView wish={draft} />
              <p className={styles.muted}>You'll never need to write one.</p>
            </>
          )}

          {dirty && titles.length > 0 && (
            <fieldset className={styles.titlePicker}>
              <legend>Propose change — pick a title</legend>
              {titles.map((option) => (
                <label key={option} className={styles.cardLabel}>
                  <input
                    type="radio"
                    name="pr-title"
                    checked={(title ?? titles[0]) === option}
                    onChange={() => setTitle(option)}
                  />
                  {option}
                </label>
              ))}
              <button
                type="button"
                className={styles.codeButton}
                data-target="propose-change"
                onClick={propose}
              >
                Propose change
              </button>
            </fieldset>
          )}
        </>
      )}
    </div>
  )
}
