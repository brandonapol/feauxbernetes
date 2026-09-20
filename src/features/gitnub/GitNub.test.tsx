import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SIGNUP_BUG_BEHAVIOUR } from '../../engine/ci/__fixtures__/webE2eSuite'
import { renderGitNub } from './__fixtures__/renderGitNub'

describe('GitNub', () => {
  it('shows the inkwell org with deploy, web and billing repos', () => {
    renderGitNub('#/gitnub')
    expect(screen.getByRole('heading', { name: 'Inkwell' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'deploy' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'web' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'billing' })).toBeInTheDocument()
  })

  it('wish editor: changing a version, proposing, and opening a PR with passing checks', async () => {
    const user = userEvent.setup()
    const store = renderGitNub('#/gitnub/inkwell/deploy')

    expect(screen.getByRole('heading', { name: 'Wish editor' })).toBeInTheDocument()
    expect(screen.getByText(/Keep 3 copies of web 1.8 running/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Version'), '2.0')
    expect(screen.getByText(/Keep 3 copies of web 2.0 running/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Propose change' })).toHaveAttribute(
      'data-target',
      'propose-change'
    )

    await user.click(screen.getByRole('button', { name: 'Propose change' }))

    const pr = store.getState().game.gitops.pullRequests[0]
    expect(pr.title).toBe('Bump web to 2.0')
    expect(['open', 'approved']).toContain(pr.status)
    expect(store.getState().game.ciNotices.length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /Bump web to 2.0/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Checks')).toBeInTheDocument()
    // Wish PRs auto-run e2e, so merge is blocked on review (until Kai's delayed approve lands).
    if (pr.status === 'open') {
      expect(screen.getByText('Waiting for a review.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled()
    }
  })

  it('Merge is blocked with a clear reason on failed checks, and the English report expands', async () => {
    const user = userEvent.setup()
    const store = renderGitNub('#/gitnub/inkwell/web')

    act(() => {
      store.getState().dispatch({
        type: 'openPR',
        repo: 'inkwell/web',
        title: 'Stricter sign-up email check',
        author: 'alex',
        change: {
          kind: 'version',
          app: 'web',
          version: {
            version: '1.9',
            author: 'alex',
            summary: 'Reject bad emails',
            behaviour: SIGNUP_BUG_BEHAVIOUR,
          },
        },
      })
    })

    const prLink = await screen.findByRole('link', { name: /Stricter sign-up email check/ })
    await user.click(prLink)

    expect(screen.getByText('Waiting for checks to finish.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Merge' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Run end-to-end tests/ }))
    expect(store.getState().game.gitops.pullRequests[0].status).toBe('checks-failed')
    expect(screen.getByText(/can't be merged until they pass/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show report' }))
    const report = screen.getByLabelText('Plain-English report')
    expect(report.textContent).toMatch(/A new visitor can sign up/)
    expect(report.textContent).toMatch(/Most likely cause/)

    await user.click(screen.getByLabelText('Show the real log'))
    expect(screen.getByLabelText('Real log').textContent).toMatch(/locator/i)
  })

  it('View as YAML pairs each line with English on focus', async () => {
    const user = userEvent.setup()
    renderGitNub('#/gitnub/inkwell/deploy')
    await user.click(screen.getByLabelText('View as YAML'))
    const line = screen.getByRole('button', { name: /app: web/i })
    line.focus()
    expect(within(line).getByText(/This is the web app/)).toBeInTheDocument()
  })
})
