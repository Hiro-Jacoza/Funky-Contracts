# Bug Fix Task Template

You are fixing a bug in the Funky.fan backend. Follow this process:

## Step 1: Understand the error
Read the error output carefully. Identify:
- Which file(s) contain the error?
- What is the exact error message?
- Is it a lint error, type error, test failure, or build error?

## Step 2: Read the relevant files
Before changing anything:
- Read the file with the error
- Read adjacent files to understand the pattern
- Check if there's an existing test for this code

## Step 3: Apply the minimal fix
- Fix only what is broken
- Do not refactor unrelated code
- Do not add unnecessary comments
- Follow the existing code style

## Step 4: Verify
Run the same commands that were failing:
```bash
npm run lint
npx tsc --noEmit -p tsconfig.build.json
npm test -- --passWithNoTests
npm run build
```

## Step 5: Create PR
If all checks pass:
```bash
git add -A
git commit -m "fix(scope): [describe the fix] [agent-fix]"
git push origin [branch-name]
gh pr create --fill
```

Use the template in `.agent/pr_prompt.md` for the PR body.
