import type { DocsLink } from '../engine/story/types'

/**
 * Every "in real life" link in the game lives here, so there's one place to fix a moved page.
 * See planning.md → "Story, world and characters" and "Vocabulary".
 */
export const DOCS = {
  argoCd: {
    label: 'Argo CD docs (the real GitOps tool Argh CD is based on)',
    href: 'https://argo-cd.readthedocs.io/en/stable/',
  },
  kubernetesConcepts: {
    label: 'Kubernetes concepts overview',
    href: 'https://kubernetes.io/docs/concepts/overview/',
  },
  sreBookSlos: {
    label: 'Google SRE book: Service Level Objectives',
    href: 'https://sre.google/sre-book/service-level-objectives/',
  },
  sreBookAlerting: {
    label: 'Google SRE book: Practical Alerting from Time-Series Data',
    href: 'https://sre.google/sre-book/practical-alerting/',
  },
  sreBookPostmortem: {
    label: 'Google SRE book: Postmortem Culture',
    href: 'https://sre.google/sre-book/postmortem-culture/',
  },
  pagerDutyIncidentResponse: {
    label: 'PagerDuty incident response docs',
    href: 'https://response.pagerduty.com/',
  },
} satisfies Record<string, DocsLink>

export type DocsKey = keyof typeof DOCS

export const ALLOWED_DOCS_HOSTS = [
  'argo-cd.readthedocs.io',
  'kubernetes.io',
  'sre.google',
  'response.pagerduty.com',
]
