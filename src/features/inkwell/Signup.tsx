import { useState, type FormEvent } from 'react'

import { useGame } from '../../store'
import styles from './Signup.module.css'
import { signupRejectsEmail } from './site'

/**
 * inkwell.example/signup. Whether this succeeds depends entirely on `web`'s running version — see
 * `signupRejectsEmail` — so the same form tells two very different stories depending on what's
 * deployed, with no story-engine involvement at all.
 */
export function Signup() {
  const cluster = useGame((s) => s.game.cluster)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [outcome, setOutcome] = useState<'idle' | 'rejected' | 'created'>('idle')

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setOutcome(signupRejectsEmail(cluster, email) ? 'rejected' : 'created')
  }

  if (outcome === 'created') {
    return (
      <div className={styles.card}>
        <div className={styles.success}>
          <h1>Welcome!</h1>
          <p>Your account is ready. Time to write something.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <h1>Create your account</h1>
      <p>Free while you draft. Upgrade whenever you're ready to publish.</p>
      {outcome === 'rejected' && (
        <p className={styles.error} role="alert">
          Something went wrong (500). Please try again.
        </p>
      )}
      <form onSubmit={onSubmit}>
        <div className={styles.field}>
          <label htmlFor="signup-name">Name</label>
          <input
            id="signup-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" className={styles.submit}>
          Create account
        </button>
      </form>
    </div>
  )
}
