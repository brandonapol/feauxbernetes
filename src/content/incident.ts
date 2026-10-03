import type { IncidentContent } from '../engine/incident/types'

const MINUTE = 60_000

/**
 * Incident content (#31): who plays which role, the declaration template, how telemetry turns into
 * the customer impact counter, the pre-written status page updates, and what "a typical team"
 * looks like on the scorecard. Ch 9 drives it; Ch 10's postmortem reads the timeline it leaves.
 * See planning.md → "Incident".
 */
export const INCIDENT_CONTENT: IncidentContent = {
  roles: { commander: 'morgan', ops: 'player', comms: 'taylor' },

  declaredMessage: [
    "**{severity} declared: {service}.** I'm incident commander. Here's who does what:",
    '',
    '- **Incident commander:** {commander}. Keeps us on track and makes the calls.',
    '- **Ops:** {ops}. Hands on the keyboard: look, test a hypothesis, fix.',
    '- **Comms:** {comms}. Keeps customers and the status page up to date.',
    '',
    'Everything goes in this channel, so the timeline writes itself. No blame, just facts.',
  ].join('\n'),

  slugs: { billing: 'checkout', web: 'website', search: 'search' },

  statusComponents: { billing: 'checkout', web: 'website', search: 'search' },

  impact: {
    // Alex's billing@2.4.1 applies coupons twice, so a checkout with a coupon fails. The scenario
    // is gated on that version's `couponDoubleDiscount` flag (see `content/world.ts`), so the
    // counter stops climbing the moment a rollback takes 2.4.1 out of service.
    billing: {
      seed: 6,
      share: 0.6,
      label: 'failed coupon checkouts',
      scenario: {
        id: 'incident-coupon-checkout',
        events: [
          {
            at: 0,
            service: 'billing',
            kind: 'errorSpike',
            magnitude: 12,
            durationMs: Number.MAX_SAFE_INTEGER,
            behaviourFlag: 'couponDoubleDiscount',
            logEnglish: 'Checkouts with a coupon fail: the discount is applied twice.',
          },
        ],
      },
    },
  },

  statusUpdates: {
    investigating: [
      {
        id: 'investigating-clear',
        componentState: 'degraded',
        message:
          "Some customers can't complete checkout when using a coupon. We're investigating and will update within 30 minutes.",
        note: "Says who is affected, what we're doing, and when the next update is. That's the whole job.",
      },
      {
        id: 'investigating-vague',
        componentState: 'degraded',
        message: 'We are aware of an issue.',
        note: "True, but a customer reading it can't tell if it's their problem, or when to check back.",
      },
      {
        id: 'investigating-blame',
        componentState: 'outage',
        message: 'A bad deploy by one of our engineers broke checkout. They are fixing it now.',
        note: "Blames a person, and calls it a full outage when checkout without a coupon still works. Customers don't need either.",
      },
    ],
    identified: [
      {
        id: 'identified-clear',
        componentState: 'degraded',
        message:
          "We've found the cause: a recent change to coupon handling. We're rolling it back now. Checkout without a coupon still works.",
        note: 'Cause, action and a workaround, in plain words.',
      },
      {
        id: 'identified-jargon',
        componentState: 'degraded',
        message: 'Root cause: billing@2.4.1 double-applies applyCoupon(). Reverting via GitOps.',
        note: 'Accurate, but written for us, not for customers.',
      },
      {
        id: 'identified-promise',
        componentState: 'degraded',
        message: 'Found it! Everything will be fixed in 2 minutes, guaranteed.',
        note: "Never promise a time you don't control. If it takes 3 minutes, you've broken a promise mid-incident.",
      },
    ],
    monitoring: [
      {
        id: 'monitoring-clear',
        componentState: 'degraded',
        message:
          "We've rolled back the change and checkouts with coupons are working again. We're watching closely to make sure it stays that way.",
        note: "Says it's working, and that we're not declaring victory just yet.",
      },
      {
        id: 'monitoring-early',
        componentState: 'operational',
        message: 'All fixed! Sorry for the trouble.',
        note: "Too early. We've only just rolled back; give it a few minutes before calling it.",
      },
      {
        id: 'monitoring-silent',
        componentState: 'degraded',
        message: 'Update: still working on it.',
        note: 'Hides good news. Customers waiting to retry would want to know it works now.',
      },
    ],
    resolved: [
      {
        id: 'resolved-clear',
        componentState: 'operational',
        message:
          'This incident is resolved. Coupon checkouts have worked normally for 15 minutes. If a coupon checkout failed for you, please try again. We will publish a summary of what happened.',
        note: 'Closes the loop: done, what to do now, and what comes next.',
      },
      {
        id: 'resolved-terse',
        componentState: 'operational',
        message: 'Resolved.',
        note: "Customers who hit the bug don't know they can retry.",
      },
      {
        id: 'resolved-excuse',
        componentState: 'operational',
        message:
          'Resolved. This was caused by an unusual edge case that no reasonable test would have caught.',
        note: "Defensive, and we don't know that yet. That's what the postmortem is for.",
      },
    ],
  },

  typical: {
    mtta: {
      label: 'Time to acknowledge',
      low: 1 * MINUTE,
      high: 5 * MINUTE,
      notes: {
        below: 'You acknowledged fast. Ack first, then think: it tells everyone someone is on it.',
        within: 'Right where a typical on-call lands. Acking is the cheapest thing you can do.',
        above:
          'Slower than most. The page kept ringing while nobody had said "mine". Ack first, even before you understand it.',
      },
    },
    timeToMitigate: {
      label: 'Time to mitigate',
      low: 10 * MINUTE,
      high: 30 * MINUTE,
      notes: {
        below:
          'Faster than a typical team. Rolling back before finding the root cause is what bought this.',
        within:
          'A typical team. Rolling back sooner, before debugging, is the usual way to shrink it.',
        above:
          'Longer than most. Time spent proving the cause before rolling back is time customers were failing.',
      },
    },
    timeToResolve: {
      label: 'Time to resolve',
      low: 30 * MINUTE,
      high: 90 * MINUTE,
      notes: {
        below: 'Quick. Make sure you watched long enough after the fix before calling it resolved.',
        within: 'A typical team: mitigate, watch for a while, then call it.',
        above:
          'Longer than most. Watching after the fix is good; leaving it open for hours is not.',
      },
    },
    customersAffected: {
      label: 'Customers affected',
      low: 200,
      high: 1500,
      notes: {
        below: 'Fewer than a typical team. Every minute you shaved off mitigation shows up here.',
        within: 'About what a typical team would see for a bug like this.',
        above:
          'More than most. This number only stops when the bad version is out of service, so roll back early.',
      },
    },
  },
}
