import { useState } from 'react'

import { SERVICE_VERSIONS } from '../../content'
import { YamlView } from '../gitnub/YamlView'
import { useDispatch, useGame } from '../../store'
import styles from './OrderForm.module.css'

const RECIPE = [
  'Find a box with room',
  'Put the app there',
  'Start it',
  'Wait until it is running',
  'Tell the website it exists',
  'Watch it',
  'If it dies, do all of that again',
  'Forever',
]

/**
 * The declarative sandbox (Ch 2 / #20): a short tedious recipe, then three questions that build
 * an English wish card, Make it so, View as YAML, and a thermostat analogy.
 */
export function OrderForm() {
  const dispatch = useDispatch()
  const searchCopies = useGame((s) => s.game.cluster.wishes.search?.copies ?? 1)
  const [recipeDone, setRecipeDone] = useState(searchCopies >= 3 ? 2 : 0)
  const [app, setApp] = useState('search')
  const [version, setVersion] = useState('1.4')
  const [copies, setCopies] = useState(3)
  const [showYaml, setShowYaml] = useState(false)
  const [temp, setTemp] = useState(20)
  const interrupted = recipeDone >= 2
  const versions = SERVICE_VERSIONS[app] ?? ['1.4']
  const wish = { app, version, copies }
  const card = `Keep ${copies} cop${copies === 1 ? 'y' : 'ies'} of ${app} ${version} running`

  const makeItSo = () => {
    dispatch({ type: 'chooseWish', app, version, copies })
    dispatch({ type: 'closeOverlay' })
  }

  return (
    <div className={styles.form}>
      {!interrupted ? (
        <>
          <p className={styles.muted}>Kai’s recipe for starting another copy of search by hand:</p>
          <ol className={styles.recipe}>
            {RECIPE.map((step, index) => (
              <li key={step}>
                {index === recipeDone ? (
                  <button
                    type="button"
                    data-target={`recipe:${index}`}
                    onClick={() => {
                      dispatch({ type: 'clickTarget', targetId: `recipe:${index}` })
                      setRecipeDone(index + 1)
                    }}
                  >
                    {step}
                  </button>
                ) : (
                  step
                )}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className={styles.muted}>
            Or… tell Feauxbernetes what you want, and it does all that, forever.
          </p>
          <div className={styles.fields}>
            <label className={styles.field}>
              App
              <select
                value={app}
                onChange={(event) => {
                  setApp(event.target.value)
                  setVersion(SERVICE_VERSIONS[event.target.value]?.[0] ?? version)
                }}
              >
                {Object.keys(SERVICE_VERSIONS).map((id) => (
                  <option key={id} value={id}>
                    {id}
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
              <select value={copies} onChange={(event) => setCopies(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className={styles.wishCard} role="status">
            {card}
          </p>
          <button
            type="button"
            className={styles.makeItSo}
            data-target={`wish:${app}`}
            onClick={makeItSo}
          >
            Make it so
          </button>
          <label className={styles.muted} data-target="view-as-yaml">
            <input
              type="checkbox"
              checked={showYaml}
              onChange={(event) => {
                setShowYaml(event.target.checked)
                if (!event.target.checked) return
                dispatch({ type: 'clickTarget', targetId: 'view-as-yaml' })
              }}
            />{' '}
            View as YAML
          </label>
          {showYaml && (
            <>
              <YamlView wish={wish} />
              <p className={styles.muted}>You’ll never need to write one.</p>
            </>
          )}
          <p className={styles.muted}>
            A thermostat: you set 20°, you don’t tell the heater when to turn on.
          </p>
          <div className={styles.thermostat}>
            <button
              type="button"
              data-target="thermostat"
              onClick={() => {
                setTemp(20)
                dispatch({ type: 'clickTarget', targetId: 'thermostat' })
              }}
            >
              Set 20°
            </button>
            <span>Heater is {temp >= 20 ? 'holding' : 'on'}.</span>
          </div>
        </>
      )}
    </div>
  )
}
