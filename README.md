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

## Plan

[`planning.md`](./planning.md) is the source of truth for what this is and what's left to build.
Work is tracked in [issues](https://github.com/brandonapol/feauxbernetes/issues), with #41 as the
roadmap.
