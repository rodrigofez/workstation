@AGENTS.md

## Fork policy

This repo is a personal fork of pingdotgg/t3code (`upstream`). `origin` is rodrigofez/workstation.

- Keep `AGENTS.md` and other upstream docs byte-identical. Fork-only agent rules go in this file.
- New fork code goes in new files (e.g. `apps/web/src/spaces/`). Edits to upstream files stay small integration hooks: no reformatting, renames, or drive-by refactors.
- Sync by merging an upstream release tag (the one the VPS server runs) into `main`. Never rebase `main` and never use GitHub's "Sync fork".
- `git diff <upstream-tag>...main --stat` is the list of fork touch points. Keep it short.
- Fork features are client-only for the Mac desktop app unless a ticket says otherwise. Don't change the server or `packages/contracts`, because the VPS runs stock upstream.

## Agent skills

### Issue tracker

GitHub Issues on rodrigofez/workstation, never upstream. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`, on top of upstream's `docs/internals/glossary.md`. See `docs/agents/domain.md`.
