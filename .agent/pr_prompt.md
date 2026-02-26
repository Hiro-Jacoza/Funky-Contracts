# PR Body Template for Agent-Created PRs

When creating a PR, use this format for the body:

```markdown
## Purpose
[1-2 sentences: what problem does this PR solve?]

## Changes
- [bullet: specific change 1]
- [bullet: specific change 2]

## Root Cause
[For CI fixes: what caused the failure?]
[For feature PRs: what was missing?]

## Fix Applied
[Describe exactly what was changed and why this fixes the issue]

## Prevention
[What would prevent this class of issue in future? E.g., "add test for X", "update CI to check Y"]

## Test Plan
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Manually verified: [describe what you tested]

## Decision Reference
[Issue number or CI run URL that triggered this PR]

## Commands Executed
<details>
<summary>Agent execution log</summary>

```
[paste the commands run and their output]
```

</details>

---
*Created by Claude Code agent — review before merging*
```
