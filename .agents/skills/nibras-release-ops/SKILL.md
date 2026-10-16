---
name: nibras-release-ops
description: Prepare safe, reproducible Nibras releases with static checks, browser tests, deployment verification, and clear release notes.
---
# Nibras Release & Operations Skill

## Before a change
- Identify the current deployment target and whether GitHub Pages or another host is actually configured.
- Inspect existing workflows and scripts before adding dependencies or duplicate checks.
- Keep changes focused and avoid adding paid services unless explicitly approved.
- Never put API keys, tokens, database secrets, or personal data into repository files or logs.

## Verification sequence
1. Run `python scripts/check_site.py`.
2. Validate every internal navigation link and every page listed in the README.
3. Test critical flows: homepage → course → practice, MCQ create/edit/export/import, study-plan persistence, and auth/backend states that are genuinely configured.
4. If browser automation is available, test mobile/tablet/desktop and keyboard paths.
5. Check console errors, missing assets, malformed HTML, and failed network requests.
6. Confirm workflow status and deployment URL after a push; do not claim success based only on a commit.
7. Record what was tested, what failed, and what remains manual.

## Release notes
- Summarize user-visible changes, security/data changes, migrations, setup steps, and known limitations.
- Mark AI, auth, upload, and cross-device sync as unavailable until actually integrated and tested.
- Prefer a pull request and review before merging high-impact changes.
