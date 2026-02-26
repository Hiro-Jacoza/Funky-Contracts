# Feature Implementation Task Template

You are implementing a feature in the Funky.fan backend. Follow this process:

## Step 1: Read the issue
Understand:
- What does the user want?
- What's the acceptance criteria?
- Are there any referenced files or existing patterns to follow?

## Step 2: Explore the codebase
Before writing code:
- Find similar existing implementations (e.g., if adding an endpoint, find existing endpoints)
- Check the Prisma schema for relevant models
- Check existing routes in `src/routes/`
- Check existing controllers in `src/controllers/`
- Check types in `src/types/`

## Step 3: Plan before coding
Write a brief plan:
- What files need to be created/modified?
- What's the data flow? (request → validation → service → DB → response)
- What could go wrong?

## Step 4: Implement
- Follow existing patterns exactly
- Add validation with the existing middleware pattern
- Add error handling following the existing try/catch pattern
- Use Prisma for all DB operations (no raw SQL unless unavoidable)

## Step 5: Add/update tests
Add tests in `__tests__/` following existing test patterns.

## Step 6: Verify
```bash
npm run lint
npx tsc --noEmit -p tsconfig.build.json
npm test -- --passWithNoTests
npm run build
```

## Step 7: Create PR
```bash
git add -A
git commit -m "feat(scope): [describe the feature] [agent-impl]"
git push origin [branch-name]
gh pr create --fill
```

Use the template in `.agent/pr_prompt.md` for the PR body.
