# Feauxbernetes

Feauxbernetes is a free, zero-setup, in-browser game that shows people who don't write code for a
living what Site Reliability Engineers actually do. You spend a first week on the platform team at
Inkwell (the made-up company from [Flack](https://github.com/brandonapol/flack)). You watch a
merged change deploy itself through a fake Argo CD, see a fake Kubernetes turn crashed things
back on, run end-to-end tests whose failures read like English, learn what an SLO and an error
budget are, and end the week holding the pager during an outage.

You never type code, YAML or a `kubectl` command. Everything is a click, a multiple-choice pick
or a drag.

Nothing is installed, nothing is real, and nothing you do can break anything.

**Play it:** https://brandonapol.github.io/feauxbernetes/

## Running it

```sh
npm ci
npm run dev
```

Node 24 (see `.nvmrc`). The first time you run `npm run e2e`, install its browser with
`npx playwright install chromium`. Add `?fast=1` to the URL to shrink every scripted delay a
hundredfold (the E2E tests do).

Every push to `main` publishes the built site to the `github-pages` branch, which GitHub Pages
serves (`.github/workflows/pages-branch.yml`). Builds use the base path `/feauxbernetes/`; set
`BASE_PATH` to host it somewhere else (`BASE_PATH=/ npm run build`). Routes live in the hash
(`/#/argh-cd/…`), so deep links work on any static host.

| Script               | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run dev`        | Vite dev server                           |
| `npm run build`      | Typecheck and build to `dist/`            |
| `npm run preview`    | Serve the built site                      |
| `npm run lint`       | ESLint                                    |
| `npm run typecheck`  | TypeScript, no emit                       |
| `npm test`           | Vitest once (engine in Node, UI in jsdom) |
| `npm run test:watch` | Vitest in watch mode                      |
| `npm run format`     | Prettier                                  |
| `npm run e2e`        | Playwright playthrough against the build  |

## How the code is laid out

```
src/engine/{cluster,gitops,ci,telemetry,incident,story,testlab}
                               the simulation — pure TypeScript, no React, no DOM
src/content                    the world: chapters, characters, glossary, docs links
src/store                      Zustand store, clock, persistence
src/features/*                 the UI panels (Flack, GitNub, Argh CD, Ops Console, …)
e2e/                           Playwright specs
```

`src/engine/**` and `src/content/**` may not import React or reach into `src/features` or
`src/store` — a lint rule enforces it. The simulation has to be testable without a browser.

## Plan

[`planning.md`](./planning.md) is the source of truth for what this is and what's left to build.
Work is tracked in [issues](https://github.com/brandonapol/feauxbernetes/issues), with
[#41](https://github.com/brandonapol/feauxbernetes/issues/41) as the roadmap.
