# Agent Issue Tracker Context

Use this file when the `review` skill or a branch/spec review needs an issue, PR, or source-of-truth spec for Dynasty Degens.

## Primary Repository

- GitHub repo: `Billex87/dynasty-degenerate`
- Default remote: `origin`
- Default comparison for branch work: merge-base with `origin/main`
- For uncommitted worktree reviews, state that the review is based on local changes instead of a pushed branch.

## Spec Source Order

When a user asks for a review, final readiness check, or "did we build the requested thing?", look for the originating spec in this order:

1. Explicit issue, PR, doc, or prompt named by the user.
2. Issue or PR numbers in commit messages, branch names, or task text.
3. Repo-local docs that match the feature area:
   - `docs/launch-audit/`
   - `docs/report-ui-qa-checklist.md`
   - `docs/manual-qa-checklist.md`
   - `docs/projection-sos-production-readiness.md`
   - `docs/projection-source-readiness-gates.md`
   - `docs/projections-sos-source-policy.md`
   - `docs/fantasypros-endpoint-feature-audit.md`
   - `docs/vercel-function-cpu-runbook.md`
4. `AGENTS.md` for repo standards and default workflows.
5. The user's current prompt and any accepted plan in the active conversation.

If no spec exists, say so and run a standards-only review instead of inventing requirements.

## GitHub CLI Workflow

Use `gh` when authenticated:

```bash
gh issue view <number> --repo Billex87/dynasty-degenerate --json number,title,body,labels,state,url
gh pr view <number> --repo Billex87/dynasty-degenerate --json number,title,body,headRefName,baseRefName,commits,files,labels,state,url
gh issue list --repo Billex87/dynasty-degenerate --search "<branch-or-keywords>" --json number,title,labels,state,url
```

If `gh` is missing, unauthenticated, or blocked, do not stop the whole review. Use local docs and git history, then report that remote issue lookup was not verified.

## Review Standards Sources

Use these as standards inputs:

- `AGENTS.md`
- `package.json` scripts and Node engine
- `components.json` and shadcn/Radix conventions when UI components are touched
- `docs/report-ui-qa-checklist.md`
- `docs/manual-qa-checklist.md`
- relevant launch-audit docs under `docs/launch-audit/`
- relevant provider/source policy docs under `docs/`

## Safety Rules

- Never print secret values.
- Do not assume protected Vercel preview `401` means the deployment is broken; use authenticated browser evidence when needed.
- Keep code completion, preview QA, production smoke, and manual QA as separate statuses.
- In a dirty worktree, stage and review only the explicit task files or hunks.
