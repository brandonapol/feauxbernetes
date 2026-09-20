import { Link } from 'react-router'

import styles from './FieldGuide.module.css'

/** Printable SRE Field Guide v1 (#24). Keep this short enough to fit on one page. */
export function FieldGuide() {
  return (
    <article className={styles.page}>
      <Link to="/" className={styles.back}>
        ← Back to Feauxbernetes
      </Link>
      <h1>SRE Field Guide v1</h1>
      <p>What you learned in week one at Inkwell. Print this. Pin it.</p>

      <h2>The loop</h2>
      <ul>
        <li>Say what you want (a wish), not how to do it.</li>
        <li>GitNub is the source of truth. Argh CD makes the cluster match.</li>
        <li>A change in the Ops Console is temporary.</li>
      </ul>

      <h2>Copies and boxes</h2>
      <ul>
        <li>Apps run as copies, spread across boxes.</li>
        <li>If a copy dies, another one appears. The wish didn’t change.</li>
        <li>If a box dies, its copies show up on other boxes.</li>
      </ul>

      <h2>The robots</h2>
      <ul>
        <li>End-to-end tests click through the site the way a customer would.</li>
        <li>They fail in English. A failing test is a gift.</li>
        <li>The robots catch bugs before customers do. That’s CI.</li>
      </ul>

      <h2>The dragon</h2>
      <p>
        The database remembers things. We don’t treat it like a disposable copy. More next week.
      </p>

      <h2>In real life</h2>
      <p>
        A copy is a pod. A box is a node. All the boxes together are a cluster. YAML is a wish in a
        stricter format. You’ll never need to write one to do this job — but you’ll see it.
      </p>
    </article>
  )
}
