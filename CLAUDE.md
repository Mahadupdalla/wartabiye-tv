# Rules for Claude sessions in this repository

## Merging pull requests (owner's rule, 8 Nov 2026)

- Never merge a pull request by hand. `.github/workflows/pr-checks.yml` merges it once the tests pass, `tools/pr_risk.py`
  (run from main) calls it low risk, and the label `auto-merge` is on it.
- Add the label `auto-merge` only after the owner has approved the change in the project thread (asking for the change
  counts as approval for a low-risk change). Never add it to a pull request labelled `needs-owner`.
- Sensitive pull requests (workflows, `admin/`, `workers/`, secrets, `CNAME`, `sw.js`, push settings, deleted files,
  destructive commands) are merged by the owner. Tell the owner plainly that their approval is needed and why.
- Never weaken `tools/pr_risk.py`, the checks in `pr-checks.yml`, or skip a test to get a pull request merged.
- Results: `data/deploy-status.json`, shown in /admin/ -> "Daabacaadda iyo PR-yada".

## News publishing

The hourly news task, the 5-minute source monitor (`fast-sources.yml`) and the admin dashboard commit straight to main.
Do not add branch protection or required checks that would block those pushes.
