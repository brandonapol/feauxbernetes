# Feauxbernetes — a week on the SRE team, in your browser

A free, zero-setup, in-browser game that shows people who don't write code for
a living what Site Reliability Engineers actually do all day. You join the
platform team at **Inkwell** (the same made-up company as
[Flack](https://github.com/brandonapol/flack)) for your first week. You learn
how code gets from a merged change to running in front of customers, how the
team decides whether things are "fine," and it all ends the way every SRE's
first week eventually ends: you're holding the pager when something breaks.

Tracking issue: #41. Full issue breakdown: #1–#41. This document is the
source of truth those issues point back to. When it and an issue disagree,
this document wins and the issue should be updated to match.

## Who it's for, and the one rule

The audience is smart people who aren't engineers: PMs, writers, support,
sales engineers, managers, new hires. They can follow a system diagram and
reason about cause and effect. What they haven't got is years of muscle
memory for CLI syntax or YAML indentation, and they shouldn't need it to
understand the job.

**The one rule: the learner never types code, YAML, or a `kubectl` command.**
Every action is a click, a multiple-choice pick, or a drag. Real syntax
appears only as optional, read-only "In real life, this looks like…"
reveals, for the curious. If a chapter design needs the learner to type
something other than their name, the design is wrong.

What they should walk away able to say, in their own words:

1. Code reaches production through an automatic pipeline: merge → checks →
   deploy. Nobody "FTPs files to a server."
2. There are **boxes that run stuff**, and there's **stuff that turns the
   boxes back on** when they fall over. You tell it what you want ("3 copies
   of billing, version 2.4"), and it keeps making reality match. That's what
   **declarative** means, and that's all the Kubernetes they need.
3. Tests in CI are a safety net that runs before customers see a change, and
   they only catch what they check.
4. "Is it working?" is a number the team agreed on (an **SLO**), not a vibe.
   Some failure is budgeted for.
5. Good alerts wake a human only when customers are hurting.
6. In an outage, you stop the bleeding first (roll back), then find the
   cause, then write it up without blame so it doesn't happen again.

### How much Kubernetes? As little as possible.

This is a game about **the job**, not about Kubernetes. The whole k8s
curriculum is three ideas:

1. **Boxes run copies of our apps.** (Real words, shown once: *nodes* and
   *pods*.)
2. **You write down what you want, and something keeps it true.** If a copy
   dies, another one appears. If you ask for 5, you get 5. (Real words, shown
   once: *declarative*, *desired state*.)
3. **Some things are much harder to keep running than others.** A website
   copy can be thrown away and replaced. A **database** remembers things, so
   restarting, moving or upgrading one is delicate, and teams rely on special,
   complicated automation (*operators*) to do it. SREs spend a lot of time
   there. The game shows this as a "here be dragons" tile, not a lesson.

**Argh CD** (fake Argo CD) is the main window onto all of it: learners
*see* copies start, die, come back, and get swapped for new versions there,
rather than learning it from diagrams.

Deliberately **never mentioned**: StatefulSets vs Deployments, ReplicaSets,
Services/Ingress, namespaces, ConfigMaps/Secrets, probes, resource limits,
Helm, CRDs, RBAC, networking. If an engineer playtester says "well,
actually, that's a ReplicaSet," the answer is "yes, and our audience doesn't
need to know."

## Tech stack

Same as Flack, copied in and then allowed to diverge (decision in #40): Vite +
React 19 + TypeScript (`strict: true`), Zustand for state, Vitest for
unit/component tests, Playwright (+ axe) for E2E. There's no backend and no
real Kubernetes. Everything runs client-side and deploys as a static site to
GitHub Pages. Charts are hand-rolled SVG (small, themeable, accessible), not a
charting library, because we control every data point anyway.

## Architecture

```
src/engine/story       story engine — ported from Flack (steps, goals, effects, hints, harness)
src/engine/cluster     the fake Kubernetes: desired state, actual state, reconcile loop
src/engine/gitops      config repo, pull requests, Argh CD sync / health / history / rollback
src/engine/ci          pipelines, jobs, and the plain-English test report format
src/engine/telemetry   seeded metrics, logs, SLIs, SLOs, error budgets, alert evaluation
src/engine/testlab     the drag-and-drop e2e test model and the fake app it runs against
src/engine/incident    incident timeline, roles, impact meter, scorecard
src/content            the world: chapters, characters, services, glossary, FAQ, scenarios
src/store              Zustand wrapper, effect scheduler, fake clock, persistence
src/features/*         UI: shell, instructions, ops-console, browser, and one folder per fake app
e2e/                   Playwright specs
```

As in Flack, `src/engine/**` and `src/content/**` may not import React or
reach into `src/features`/`src/store` (ESLint rule). The simulation has to be
testable without a DOM.

Data flow is Flack's: an action (`chooseWish`, `mergePullRequest`,
`syncApp`, `runPipeline`, `ackPage`, `dropTestStep`, …) goes through
`reduce(config, state, action) → { state, effects }`. Effects are plain data.
Delayed ones (a pod finishing startup, a coworker's message, an alert firing)
are scheduled by the store and survive a reload.

### One clock to rule them all

The whole world runs on a **fake game clock** owned by the store. The cluster's
reconcile loop, Argh CD's sync poll, CI job durations, metric generation and
alert evaluation all advance on its ticks. That gives us:

- Determinism: same actions → same world, so tests and golden paths are exact.
- `?fast=1` (from Flack) shrinks every delay a hundredfold for E2E.
- A **Pause** button during the incident. Learning under a ticking clock is
  fine; learning under a clock you can't stop isn't.
- Time compression: a "week of metrics" in Ch 8 is generated, not waited for.

## The experience — layout

Three columns, like Flack, but the right one is lighter:

| Column | Width | What it is |
| --- | --- | --- |
| **Instructions** | ~24% | Chapter checklist, step text, hints, "Show me," glossary tooltips, and the **On-call brain** (below) |
| **Fake browser** | ~52% | Browser chrome (tabs, address bar, back/forward) holding the fake apps. Tabs unlock as the story goes. |
| **Ops Console** | ~24% | Plain-English multiple-choice "wishes" plus a live feed of what the cluster is doing, in English |

Below ~1100px wide, show a full-screen "works best on a laptop" notice (from
Flack). Overlays (the Test Builder, the declarative Order Form, the page
notification) open over the browser column, not as extra tabs. Like Flack's
Commit Lab, they're side-quests you're sent into and returned from.

### The fake browser's tabs

| Tab | Parody of | What it teaches | Issue |
| --- | --- | --- | --- |
| **Flack** | Slack | The team, the story, `#deploys`, `#alerts`, incident channels, **Ask Kai** | #12 |
| **GitNub** | GitHub | Where the "wishes" live; pull requests; CI checks on a PR | #15 |
| **Argh CD** | Argo CD | The window onto the cluster: boxes, copies, and watching GitNub's wishes get made real | #14, #16 |
| **Grafauxna** | Grafana | Dashboards, logs, SLOs, alert rules | #25 |
| **PagerDoody** | PagerDuty | Who's on call, pages, acknowledge / escalate | #26 |
| **inkwell.example** | Inkwell's real product | What customers see, including the status page | #17 |

Names are parodies, as in Flack (GitNub). No real logos, colours or brand
marks. We show a **handful of real terms** (pod, declarative, GitOps, CI,
SLO, error budget, rollback) once each, next to the plain-English word the
game uses, because learners will hear them from engineers. We never make
them type any of them, and we don't go deeper than the list in the
Vocabulary section.

### The Ops Console (right column)

Flack's terminal, reimagined for people who shouldn't need a terminal. Two
stacked parts:

1. **"What do you want?"** A short, chapter-specific list of plain-English
   wishes as radio cards, e.g.:
   - "Keep **3** copies of `search` running"
   - "Run `search` version **1.4**"
   - "Unplug one copy of `search` (pretend it crashed)"
   - "Turn off box B (pretend the machine died)"

   Picking one shows a before/after of the wish ("copies: 3 → 5") and a
   **Make it so** button. Each card has a collapsed **In real life** section
   showing the equivalent `kubectl …` line or YAML snippet, read-only and
   annotated. It's never required reading.
   Some wishes are deliberately wrong or risky for the moment (e.g., "Delete
   everything and start over"), and picking them makes Kai explain why in
   Flack instead of executing them. That's how the console teaches judgment,
   not just buttons.

2. **What's happening.** A scrolling feed of cluster and pipeline events,
   translated into English:
   - `Scheduled billing-7d4f on node-b` → "Found room on box B for a new
     copy of billing."
   - `Killing search-9c2a` → "One copy of search stopped. Starting a
     replacement."
   - `Sync operation succeeded` → "Argh CD made the cluster match GitNub."

   Each line can expand to show the raw event text, so learners can match
   English to jargon when they want to.

From Ch 4 onward the console makes a point of its own: wishes made directly
in the console get **undone by Argh CD**, because GitNub is the source of
truth. After that the console shows a banner, "Changes here are temporary.
Propose them in GitNub to make them stick," which links to the GitNub wish
editor.

### The On-call brain

The brief asks us to show **what an on-call engineer is thinking**. Steps can
carry a `thinking` field, rendered in the Instructions panel as a distinct
thought-bubble callout above the step text. It's the internal monologue of
an experienced SRE, written casually:

> 💭 *Okay. A page at 14:03. Before I touch anything: is this real, how bad is
> it, and what changed in the last hour? Dashboard first, code last.*

It's used heavily in M3 (the incident) and sparingly before that. It's the
emotional core of the game, the part that says "this is what the job feels
like," so it gets its own content-style rules (below).

## Story, world and characters

**Inkwell** sells a subscription writing app. Its production stack, as the
learner sees it, is three apps and one database on a handful of boxes:

| Service | Does | Cast in |
| --- | --- | --- |
| `web` | The website and editor customers use | Ch 4 rollout, Ch 5 CI catch |
| `search` | Finds your documents | Ch 1–3 sandbox, the basics |
| `billing` | Checkout, subscriptions, coupons | The M3 outage |
| `database` | Remembers everything: accounts, documents, orders | "Here be dragons" (Ch 4 aside, bonus #39) |

**Characters** (they/them or names, as in Flack):

- **Morgan Diaz**: SRE team lead, your manager. Welcomes you and sets the
  week's goals. Plays incident commander in Ch 9 until handing the role to you.
- **Kai Nakamura**: the senior SRE you shadow. Patient, dry. **Ask Kai** is the
  FAQ helper (Flack's Ask Robin, ported).
- **Alex Chen**: software engineer (from Flack). Ships the coupon change that
  causes the outage. The postmortem is explicitly **blameless** toward Alex,
  and that's a teaching point, not a coincidence.
- **Robin Okafor**: docs (from Flack). A cameo who asks the questions a
  non-engineer would ask, which gives the learner someone to explain things to.
- **Taylor Brooks**: support lead. Relays "customers are saying…" during the
  incident. The human face of an SLO.

## The simulation engines

All pure TypeScript, deterministic and seeded, with no wall-clock time.

### Cluster (`src/engine/cluster`) — #6

The fake Kubernetes, and deliberately a small one. It's here to make the
three ideas in **How much Kubernetes?** visible, not to simulate k8s. It
stores **what you want** and **what's actually running** side by side,
because the gap between them is the whole lesson:

- `Wish` (desired state): `{ app, version, copies }`. That's all.
- `Box` (a node): name, room for N copies, on or off.
- `Copy` (a pod): id, app, version, box, and state `Starting` → `Running` →
  `Stopping`, plus `Crashed` (it gets restarted). No other states.
- `reconcile(cluster, tick) → { cluster, events }`: one pass of the "keep it
  true" loop. Too few copies means start one, too many means stop one, and a
  new version means swapping copies one at a time so the app never goes to
  zero. When a box turns off, its copies reappear on other boxes.
- The **database** is a special, mostly opaque entry: it's shown and it has a
  health state, but the learner can't unplug or resize it. Its detail view
  explains why ("it remembers things, so we let a specialised robot, an
  *operator*, handle it"). Bonus #39 shows that robot's careful upgrade dance
  at a high level.
- Version behaviours come from `src/content` (e.g., `billing@2.4.1` has the
  coupon bug), so the cluster engine never hardcodes a story.
- Events are emitted in both raw form (`Scheduled`, `Killing`,
  `SuccessfulCreate`) and the English translation used by the Ops Console.

Explicitly **out**: everything in the "never mentioned" list above. There's
no memory, CPU, networking or scheduling logic beyond "does this box have
room?"

### GitOps (`src/engine/gitops`) — #7

- A **config repo** (`inkwell/deploy` on GitNub) holding the wishes as
  structured data (not YAML text). YAML is only ever *rendered* from it, for
  the "In real life" reveals.
- Commits, pull requests (open / checks running / checks failed / approved /
  merged), and merge. This is much simpler than Flack's git model: no working
  tree, staging, branches-as-a-graph or conflicts. It borrows Flack's PR types
  and page shape only.
- An **app repo** (`inkwell/billing`, `inkwell/web`) whose merges produce new
  versions. Code isn't modelled. A version is a label plus the behaviour flags
  that content attaches to it.
- **Argh CD application model**: for each service, compare GitNub's wish to the
  cluster's wish and report `Synced` / `OutOfSync`, and read cluster health
  as `Healthy` / `Progressing` / `Degraded`. **Auto-sync** runs after a
  delay. **Self-heal** reverts manual drift. **History** records every sync,
  and **Rollback** re-applies an earlier one.

### CI (`src/engine/ci`) — #8

- A `Pipeline` has ordered stages (`Build` → `Unit tests` → `End-to-end
  tests` → `Deploy`). Each job has a duration on the fake clock and an outcome
  determined by the version's behaviour flags.
- Jobs can be **manual** ("Run end-to-end tests ▶"), so the learner kicks
  them off and watches.
- **The plain-English test report** is the headline feature. It looks like
  a log (monospace, ✓/✗, timings, indentation) but reads like a sentence. The
  engine emits structured results, and a formatter produces lines with tones.
  Target output:

```
▶ End-to-end tests for web · 4 checks · started 10:42

  ✓ A visitor can open the home page                           0.8s
  ✓ A visitor can search for "novel templates"                 1.2s
  ✗ A new visitor can sign up                                 10.4s
      1. Opened inkwell.example/signup ............................ ok
      2. Typed "sam@example.com" into Email ....................... ok
      3. Clicked the "Create account" button ...................... ok
      4. Waited for the page to say "Welcome!" .............. gave up
         The page said instead:  "Something went wrong (500)"
         Most likely cause:      web/signup.ts, line 42 — the new
                                 email check turns away any address
                                 with a dot in it.
  ✓ A member can log in                                        0.9s

Result: 3 passed · 1 failed · This change can't be merged until every check passes.
```

  A **Show the real log** toggle reveals what a real Playwright failure would
  look like (stack trace, locator timeout), to make the contrast clear, not
  to be read.

### Telemetry (`src/engine/telemetry`) — #9

- **Seeded time series** per service for the four golden signals: latency
  (p50/p95), traffic (requests/min), errors (%) and saturation (CPU/memory
  %). The baseline has daily rhythm and noise, and **scenarios** layer events
  on top (a deploy at T, an error spike from T+30s, a slow recovery after a
  rollback). Scenarios are content, and the engine just evaluates them.
- Series are a function of `(seed, scenario, cluster history, t)`, so the
  graphs react to what the learner actually did (rolled back early → shorter
  spike). They're not pre-rendered images.
- **Logs**: generated structured log lines per service with level, message and
  fields, filterable by service and level. As with CI, messages read like
  English with a raw toggle.
- **SLI / SLO / error budget**: SLI = good events ÷ valid events over a window.
  The SLO is a target plus a window. Error budget = allowed bad events.
  **Burn rate** = how many times faster than "exactly on budget" we're
  spending it.
- **Alert rules** as data (`{ signal, condition, window, severity: 'page' |
  'ticket' }`) and an evaluator that replays a series and returns when each
  rule would have fired. That drives the Ch 8 tuning simulator and the
  real page in Ch 9.

### Test lab (`src/engine/testlab`) — #30

The model behind "implement an e2e test without writing code." It uses
**Steps** from a small fixed vocabulary (`visit(page)`, `type(field, text)`,
`click(button)`, `expectText(region, text)`, `expectTotal(amount)`) and a
**fake app model** per service version that answers "if you do these steps
against `billing@2.4.1`, what does the page show at each step?" Running a
test produces the same plain-English report as CI (#8).

### Incident (`src/engine/incident`) — #31

A **timeline** that auto-records every meaningful learner action with a
fake-clock timestamp (paged, acknowledged, declared, first hypothesis,
rollback started, recovered, all-clear). It also covers roles (incident
commander, communications, ops), a **customer impact** counter driven by
telemetry, and a **scorecard** (time to acknowledge / mitigate / resolve,
i.e. MTTA / MTTM / MTTR) compared with "a typical team." The postmortem is
generated from the timeline.

## UI panels

### Instructions (#11)

Flack's panel, ported: chapter progress, step checklist, hints, **Show me**
(highlights the element to click), glossary tooltips on first use, docs
links. New: the **On-call brain** callout, plus a small persistent
**"Where is my change?"** strip, the successor to Flack's "Where are my
changes?" diagram: `GitNub PR → CI checks → merged → Argh CD → running on the
cluster`. The learner's current change lights up as it moves along.

### Flack (#12)

Ported from Flack: channels, DMs, scripted messages, typing indicator, quick
replies and notifications. It adds the channels `#platform`, `#deploys`
(Argh CD posts sync results here), `#alerts` (PagerDoody posts here) and a
dynamic `#inc-<n>-<slug>` channel created when an incident is declared.
**Ask Kai** replaces Ask Robin.

### Argh CD, part 1: apps and boxes (#14)

Argh CD is where the learner *watches* the cluster. It unlocks in Ch 1 in a
read-mostly mode, before GitOps has been explained:

- **Applications** page: one tile per app (`web`, `search`, `billing`, plus
  the `database` tile with a 🐉 badge), each showing a health state and
  "wants 3 · has 3" copies. That "wants / has" pair is the whole declarative
  idea in one line, and it's shown everywhere.
- **App view**: the app's copies as small labelled circles, grouped by the
  box they're on. State is shown with an icon and text, not colour alone.
  Copies animate in and out as they start, crash and get replaced.
- **Boxes view**: the same copies grouped by box, so "box B turned off, and
  its copies moved" is visible.
- Clicking a copy opens a small drawer with the app, version, box, how long
  it's been up, how many times it's been restarted, the last few English
  log lines, and **Unplug this copy** where the chapter allows it.

### GitNub (#15)

A slimmed-down version of Flack's GitNub: org page, the `inkwell/deploy`
config repo shown as a **Wish editor** (a form: dropdowns and steppers, never
a text box for YAML, with a "View as YAML" read-only toggle), and pull
requests with a **Checks** panel wired to CI (#8), where manual jobs show a
▶ button. Plus the app repos, shown only as PRs and versions.

### Argh CD, part 2: GitOps (#16)

In Ch 4 Argh CD gets its real job: making the cluster match GitNub.

- Tiles gain **sync status** (`Synced` / `OutOfSync` / `Syncing`), the
  version GitNub asks for vs the version running, and the last sync time.
- The app view gains a **"GitNub says / cluster has"** header and a
  **Diff** that explains drift in English ("GitNub says 3 copies. The cluster
  has 6. Someone changed it by hand.").
- **Watching a deploy** is the showcase: new-version copies appear one at a
  time and old ones fade out, with a caption narrating each swap. This is the
  place the learner *sees* the machinery play out.
- Buttons: **Sync**, **History & Rollback**.
- Auto-sync announces itself in the Ops Console feed and in `#deploys`.

### Grafauxna (#25)

- **Dashboards**: one per service, with the four golden signals, deploy
  markers as vertical lines (hover shows "billing 2.4.1 deployed by Argh CD"),
  and time range pickers (last 15m / 1h / 24h / 7d).
- **Logs**: filter chips by service and level, plus a search box (the only
  text input besides the name capture, and it's search, not code).
- **SLOs**: each SLO's target, current attainment, a remaining error-budget
  gauge and the burn rate.
- **Alert rules**: the rules list, used as a read-only reference in Ch 9
  and edited in Ch 8.

All charts have text alternatives (a summary sentence plus a table toggle).

### PagerDoody (#26)

An on-call schedule (you're on it from Ch 9), an incident list, and
**Acknowledge** / **Escalate** / **Resolve**. The page itself arrives as an
overlay ("phone buzzes") that interrupts whatever tab you're on, with a
subtle animation and **no sound by default**.

### inkwell.example (#17)

Inkwell's customer-facing product: a landing page, a pricing/checkout page
and a **status page** (`status.inkwell.example`). It renders from cluster and
telemetry state. During the outage, checkout with a coupon shows an error, and
the learner can see it from the customer's side before and after the fix.
The status page is where the learner posts customer updates (#31).

### Overlays

- **Order Form** (#20): the declarative sandbox. See Ch 2.
- **Test Builder** (#30): drag-and-drop e2e test composer. See Ch 10.
- **Page** (#26): the pager interruption.

## Chapters

Each chapter follows Flack's shape: intro → steps with goals, hints, Show me
and after-notes → a short summary card → continue.

### M1 — Week one: how code gets to production

- **Ch 0 — Welcome to the platform team** (#18). Morgan welcomes you in
  Flack. Name capture. A guided tour of the browser tabs (only Flack,
  inkwell.example and Argh CD are unlocked). The framing line: *"Engineers
  build Inkwell. We make sure it stays up. Your job this week is to learn how
  we know it's up, and what we do when it isn't."*
- **Ch 1 — Boxes that run stuff** (#19). In Argh CD, Kai shows the
  Applications page: `web`, `search`, `billing`, each running as a few
  **copies** spread over a few **boxes** (so one box dying doesn't take an app
  down). Click a copy of `search` and read its drawer, flip to the Boxes view
  and count what's on box B, and click the 🐉 `database` tile for the "this
  one's special" teaser. Real words shown once: *pod*, *node*, *cluster*.
  That's the whole chapter, kept short on purpose.
- **Ch 2 — Say what you want, not how** (#20). The declarative chapter.
  1. Kai sends a **recipe** (imperative): 8 manual steps to start another copy
     of `search` by hand ("find a box with room, put the app there, start it,
     tell the website it exists…"). The learner clicks through a couple of
     them, and it's tedious on purpose.
  2. Kai: "Or… you tell Feauxbernetes what you want, and it does all that,
     forever." The **Order Form** opens with three multiple-choice questions:
     which app, which version, how many copies. The form builds an English
     **wish card** ("Keep 3 copies of search 1.4 running").
  3. **Make it so**, then watch in Argh CD as "wants 3 · has 1" becomes
     "has 3", with the copies appearing one by one.
  4. **View as YAML** shows the same wish in YAML, read-only, with each line
     linked to its English sentence on hover. The takeaway: *engineers write
     this file, and it's just the wish card in a stricter format. You'll never
     need to write one.*
  5. Analogy card: a **thermostat**. You set 20°, you don't tell the heater
     when to turn on. That's declarative.
- **Ch 3 — It turns itself back on** (#21). In the Ops Console, the learner
  picks "Unplug one copy of search" and watches Argh CD go "wants 3 · has 2"
  and then a replacement appear. Then they pick "Turn off box B" and watch
  every copy on it reappear on other boxes. Then they ask for 5 copies. The
  Ops Console feed narrates it all. The On-call brain appears for the first
  time: *"This is why one crashed copy at 3am doesn't wake anybody up."*
- **Ch 4 — Merge to deploy** (#22). GitOps, and Argh CD's real job. Morgan
  asks the learner to ship `web` 2.0. They change the version in GitNub's
  wish form, open a PR, CI checks run, Kai approves, and they merge. Argh CD
  goes OutOfSync → Syncing, and the learner **watches the deploy happen**:
  new copies appear one at a time and old ones fade out, while
  inkwell.example stays up the whole time. `#deploys` announces it. Then
  **drift**: Alex bumps `web` to 6 copies by hand in the Ops Console "just for
  a minute." Argh CD flags OutOfSync, explains the difference in English, and
  puts it back to 3. Kai: *"If it isn't in GitNub, it isn't real."* The "Where
  is my change?" strip is completed end to end.

  **Aside: here be dragons.** Robin asks in Flack, "So can you just do that to
  the database too?" Kai's answer, as a short illustrated card: a website
  copy is disposable, but the database *remembers things*. Upgrading it means
  backups, moving data and doing it in a careful order, so teams use special,
  complicated automation for it, and it's some of the hardest work SREs do.
  No interaction, no quiz. Just the learner knowing the dragon exists.
- **Ch 5 — The robots check your work** (#23). CI. Alex has a PR for `web`
  (a new email check on sign-up). The learner opens the PR's Checks tab. Build
  and unit tests pass, and the learner clicks ▶ **Run end-to-end tests**,
  watches four tests tick, and one fails. They read the **plain-English
  report** (#8) and answer a multiple-choice question about what went wrong.
  They then click **Suggest a fix**, which offers three options:
  - "Delete the failing test": Kai explains why that's the worst option.
  - "Mark the test as 'skip for now'": the check goes yellow, and Kai explains
    that's a debt that will come due.
  - "Fix the email check": a small diff with plain-English annotations. ✓

  The learner re-runs the tests, gets all green, merges, and it deploys.
  Takeaway: *this bug never reached a customer, and nobody had to be woken up.*
- **Week-one wrap** (#24): completion card, plus **SRE Field Guide v1**
  (printable cheat sheet): the path of a change, the words (boxes/nodes,
  copies/pods, declarative, GitOps, CI), and "what to ask your engineers."

### M2 — Measuring "good"

- **Ch 6 — Seeing inside** (#27). Observability. Grafauxna unlocks. The four
  golden signals as a doctor's checkup (pulse, temperature, blood pressure,
  "how tired are you"). The learner answers matching questions: "Customers say
  it's slow: which graph?" (latency), "We ran a sale: which graph moved?"
  (traffic), and so on. In Logs, they filter to `search` errors and find the
  one line explaining last night's blip. Glossary: metric, log, trace (a
  mention only), dashboard.
- **Ch 7 — How good is good enough?** (#28). SLOs.
  1. **Choose an SLI**: which number best tells us whether checkout is
     working? Options: CPU usage / number of copies running / **% of
     checkouts that succeed within 2 seconds** / number of support tickets.
     Kai explains each wrong answer ("customers don't feel CPU").
  2. **Choose a target**: a slider offering 100%, 99.99%, 99.9%, 99.5% or
     99%. At 100%, Kai explains why it's impossible and why chasing it
     freezes the whole company. Each notch shows its **error budget** in human
     units ("≈1,400 failed checkouts out of 280,000 per 28 days" / "≈3.4 hours
     of full outage per month").
  3. The **error budget** as a fuel gauge: past incidents drain it, and the
     team's policy is to *pause risky launches when the tank is low*. The
     learner picks what the team should do in three budget scenarios.
- **Ch 8 — Wake me only if it matters** (#29). Alerting. A replayed week of
  `billing` metrics with three harmless blips and one real incident. The
  learner picks alert rules from a menu and sees the result on the replay:
  "Page on any error" → 41 pages, 9 of them at 3am, and Kai is grumpy.
  "Page if errors > 5% for 30 min" → misses the real incident for 25 minutes.
  "Page when we're burning the budget 14× too fast (1h and 5m)" → one page,
  on the real incident. Then a drag-sort exercise with three buckets,
  **Page a human now** / **Make a ticket** / **Just a dashboard**, and eight
  situations to sort. Glossary: alert fatigue, burn rate, page vs ticket.

### M3 — On call

- **Ch 9 — The page** (#32). The outage. The learner is primary on-call
  (PagerDoody shows it). They're doing something mundane when the page
  overlay interrupts: *"billing — checkout error budget burning 14.4× —
  SEV-2"*. The On-call brain narrates throughout, and the steps are:
  1. **Acknowledge** (the impact counter starts, and Pause is always there).
  2. **Is it real?** Open the linked Grafauxna dashboard: errors on checkout
     jumped from 0.1% to 12% at 14:02.
  3. **How bad?** The SLO page shows the budget draining fast. Taylor posts in
     Flack: "Customers with coupons can't pay." The learner checks
     inkwell.example and sees the error themselves.
  4. **Declare an incident** in Flack with one click (from PagerDoody), which
     creates `#inc-1-billing-checkout`. Morgan joins as incident commander and
     asks the learner to lead ops.
  5. **What changed?** Multiple-choice hypotheses (traffic spike? a box
     died? a deploy? the payment provider?). The learner confirms or rules out
     each one with evidence: traffic is flat on the dashboard, all boxes are
     healthy in Argh CD, and the deploy marker at 14:01 in
     Grafauxna matches Argh CD's history (`billing` 2.4.0 → 2.4.1, Alex's
     coupon change).
  6. **Stop the bleeding.** Options: debug the code live / scale billing to
     10 copies / **roll back to 2.4.0** / wait and see. Every wrong pick gets
     a gentle Kai explanation and costs visible customer impact but never
     fails the chapter. Rollback runs as a revert PR in GitNub (one click,
     pre-approved "emergency" path), and Argh CD syncs. The learner watches
     the copies swap back to the old version.
  7. **Verify**: errors fall on the dashboard, the burn rate drops, and
     checkout works on inkwell.example.
  8. **Communicate**: pick the best of three status-page updates (one is
     jargon-heavy, one blames a person, one is clear and customer-focused),
     post it, then post the all-clear later.
  9. **Resolve** in PagerDoody. **Scorecard**: time to acknowledge, time to
     mitigate and customers affected, with no pass/fail, just "here's how you
     compare to a typical team, and here's what moved the numbers."
- **Ch 10 — Never again** (#33). Postmortem and prevention.
  1. **Blameless postmortem**: the timeline is pre-filled from Ch 9. For
     "what happened," the learner picks the best-worded sentences ("Alex broke
     checkout" ✗ vs "A change that applied coupon discounts twice reached
     customers because no automated test covered coupons" ✓). Kai explains
     why blame makes future outages *worse*. The learner then picks action
     items from a list, and the key one is "Add an end-to-end test for
     checkout with a coupon."
  2. **Build the test** in the Test Builder (#30). The learner drags step
     blocks into order: *Open the checkout page → Type "SAVE10" into Coupon →
     Click "Apply" → Expect the total to be $9.00 → Click "Pay" → Expect the
     page to say "Thanks!"*. Distractor blocks sit in the palette.
  3. **Run it against Alex's 2.4.1**: it fails, with the plain-English
     report showing "Expected $9.00, the page said -$1.00". Kai: *"Good! A
     test that fails on the broken version is a test that works."*
  4. **Fix the code**: choose among three annotated diffs, as in Ch 5.
  5. Open the PR (fix + new test), CI runs with the new test included, it
     goes green, it merges, Argh CD deploys 2.4.2, and the SLO budget gauge
     stops draining. The "Where is my change?" strip lights up end to end one
     last time.
- **Graduation** (#34): **SRE Field Guide v2** with the incident checklist
  ("Is it real → how bad → what changed → stop the bleeding → verify →
  communicate → write it up"), SLO/error-budget one-pager and glossary.
  Closing card: *"That was a week in SRE. Most weeks are quieter. The quiet
  is the job working."*

### Later (bonus chapters)

- **Traffic spike** (#38): a marketing email doubles traffic, latency climbs,
  and the learner scales `web` via a GitNub PR (then meets autoscaling as
  "a wish about wishes: keep CPU near 60% by adding copies").
- **Database upgrade day** (#39): the dragon from Ch 4, up close. The
  learner watches (doesn't drive) the database robot upgrade `database` in
  Argh CD: take a backup, upgrade the standby copy, check it caught up, switch
  over, upgrade the old primary. Each stage is narrated in English, with a
  side-by-side of how `web` did the same thing in one step in Ch 4. The only
  learner choice is "When should we do this?" (Tuesday 10am vs Friday 5pm vs
  during the big sale). The point is respect for the hard parts, not how
  they work.

## Content style guide (#10)

Inherits Flack's: they/them or names for characters, glossary definitions of
30 words or fewer, one canonical docs-links map, and no real brand marks.
Additions:

- **Every jargon word gets an English twin on first use**, and the Ops
  Console / CI / logs always show English first with jargon one click away.
- **The On-call brain** is written in first person, present tense, short
  sentences, allowed to be a little anxious and a little funny, and never
  condescending. It models *process under stress*, not heroics.
- **Wrong answers teach.** Every distractor in a multiple-choice question has
  a specific Kai response explaining why a reasonable person might pick it and
  why it's not the best choice. No bare "Incorrect."
- **Blameless everywhere.** No copy (including jokes) blames a person for an
  outage. Systems fail, and people are the ones who fix them.
- **Nothing is ever failed.** Customer impact can go up, and the scorecard
  can show slower times, but every chapter is completable and every mistake
  is recoverable.

## Vocabulary

What the learner sees, and what real engineers call it. The UI uses the
left column and shows the right one once, as a "you'll hear engineers call
this…" note. **This table is the complete list.** Adding a Kubernetes term
needs a change to this document first, and the bar is "the learner will hear
it in a meeting next week."

| In the game | Real term | Where it's introduced |
| --- | --- | --- |
| box | node (and all the boxes together: cluster) | Ch 1 |
| copy | pod | Ch 1 |
| wish | desired state (engineers write it as YAML) | Ch 2 |
| say what you want, not how | declarative | Ch 2 |
| Make it so | apply | Ch 2 |
| Argh CD made it match GitNub | sync / GitOps | Ch 4 |
| the robot that babysits the database | operator | Ch 4 aside |
| the robots check your work | CI pipeline | Ch 5 |
| a test that clicks through the site | end-to-end (e2e) test | Ch 5 |
| golden signals | latency, traffic, errors, saturation | Ch 6 |
| the number we promise | SLO (and SLI) | Ch 7 |
| allowed failures | error budget | Ch 7 |
| spending the budget too fast | burn rate | Ch 8 |
| page | page | Ch 8–9 |
| stop the bleeding | mitigate | Ch 9 |
| undo the deploy | rollback / revert | Ch 9 |
| write-up | postmortem / incident review | Ch 10 |

## State, persistence and reset

From Flack (#4): the `localStorage` key `feauxbernetes:v1`, debounced writes,
a schema version with reset-on-mismatch, `?chapter=NN` to jump (each chapter's
`setup` builds a plausible world for a direct jump), `?fast=1`, restart
chapter, and reset everything. The fake clock, the scheduled effects and the
engine states all serialise as plain data.

## Testing strategy

- **Engine unit tests** for each of `cluster`, `gitops`, `ci`, `telemetry`,
  `testlab` and `incident`: determinism (same seed and actions → same output),
  reconcile invariants (a rolling update never drops below N−1 Running), sync
  and self-heal, burn-rate maths against hand-computed examples, alert replay
  timing, and plain-English report snapshots.
- **Golden-path harness** (ported from Flack) for every chapter, plus the
  "every wrong answer is recoverable" path for each multiple-choice step.
- **Component tests** per feature, including the Test Builder's drag
  interactions and their keyboard equivalents.
- **Playwright E2E** covering a full playthrough at `?fast=1`, every chapter
  jump, reset, no-storage mode, and axe checks.
- **Playtest** with 3–5 non-engineers (#37). The primary success measure:
  afterward, can they explain in their own words what an SLO is and why the
  team rolled back before debugging?

## Accessibility (#35)

Flack's bar, plus:

- Every drag (Test Builder, alert sorting) has a keyboard path: select a
  block, then pick "Move to position N" / "Put in bucket X" from a menu.
- Every chart has a one-sentence summary and a data-table toggle. Status is
  never shown by colour alone (phase icons on pods, ✓/✗ in reports).
- The page overlay is announced via an `alertdialog`, respects
  `prefers-reduced-motion`, and makes no sound unless the player opts in.
- A Pause button during the incident and no hard timers anywhere.

## Hosting and deployment (#2)

GitHub Pages at `/feauxbernetes/`, `HashRouter`, and deploy on push to `main`
via a `github-pages` branch, as in Flack.

## Decisions and open questions (#40)

- [x] **Code reuse:** copy Flack's story engine, store, shell, Flack tab and
      Instructions panel in, then diverge. Don't extract a shared package.
- [x] **Fiction:** Inkwell, the learner is a new SRE hire, and the week ends
      on call.
- [x] **Right column:** a small Ops Console of plain-English multiple-choice
      wishes plus an English event feed. No typing.
- [x] **Tickets:** GitHub issues on this repo, Flack-style.
- [x] **No code, YAML or kubectl typed by the learner**, ever.
- [x] **Kubernetes depth:** three ideas only (boxes run copies, something
      keeps them running, databases are the hard part). Argh CD is the window
      onto the cluster, and there's no separate cluster-map tab. See **How
      much Kubernetes?**
- [ ] Tool parody names. Proposed: Argh CD, Grafauxna, PagerDoody. OK?
- [ ] Should the incident have an optional **timed "hard mode"** (no pause,
      a visible clock) for people who want the adrenaline? Default: no.
- [ ] Completion tracking or a shareable certificate? Default: none, the same
      as Flack.
- [ ] Should Flack-the-game and Feauxbernetes link to each other ("Played
      Flack? Robin says hi.")? Default: a light cameo only, and no shared
      save.
- [ ] Is a third milestone of bonus chapters (#38, #39) wanted before
      launch, or after playtest? Default: after.

## Issue map and build order

| Milestone | Issues |
| --- | --- |
| **M0: Foundation** | #1 scaffold · #2 CI + deploy · #3 story engine port · #4 store, clock, persistence · #5 app shell + browser chrome · #6 cluster engine · #7 GitOps engine · #8 CI engine + plain-English report · #9 telemetry engine · #10 world content |
| **M1: Week one** | #11 Instructions + On-call brain · #12 Flack + Ask Kai · #13 Ops Console · #14 Argh CD: apps & boxes · #15 GitNub · #16 Argh CD: GitOps · #17 inkwell.example · #18 Ch 0 · #19 Ch 1 · #20 Ch 2 + Order Form · #21 Ch 3 · #22 Ch 4 · #23 Ch 5 · #24 week-one wrap |
| **M2: Measuring good** | #25 Grafauxna · #26 PagerDoody · #27 Ch 6 · #28 Ch 7 · #29 Ch 8 |
| **M3: On call** | #30 Test Builder + test lab engine · #31 incident mechanics · #32 Ch 9 · #33 Ch 10 · #34 graduation |
| **M4: Polish & launch** | #35 accessibility · #36 full E2E · #37 playtest |
| **Later** | #38 traffic spike · #39 database upgrade day |
| **Meta** | #40 decisions · #41 roadmap |

Build order: M0 engines are independent of each other once #3/#4 land, so
they can run in parallel. Each fake app (#12–#17, #25, #26) should land
before the first chapter that needs it, and the chapters go in order, since
each one's `setup` depends on the previous one's end state.

## Working on this across sessions

Definition of done for any PR against this plan: lint, typecheck, unit tests
and build all pass in CI (#2). Chapter and engine issues link back to the
section of this document they implement. When a design decision changes,
update this document first and then the issues it touches, as Flack's
revision notes did.
