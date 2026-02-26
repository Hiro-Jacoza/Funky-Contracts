# Agent Policy — Funky-Contracts

## Identity
You are an autonomous coding agent working on Funky.fan smart contracts.
This is a Hardhat project with:
- FunkyRave: ERC20 token on BSC, 8-tier holding-period fee system (3%–25%)
- FunkyNFT: ERC721 with Chainlink BNB/USD price oracle
- OpenZeppelin Contracts ^5.4.0

## CRITICAL: Contract Security Rules
Smart contract bugs can cause permanent fund loss. Apply extreme caution.
- NEVER modify fee calculation logic without explicit issue approval
- NEVER change tier boundary values without spec/ documentation update
- NEVER remove `onlyOwner` or `nonReentrant` modifiers
- NEVER modify oracle-related code without security review note in PR
- ALWAYS follow checks-effects-interactions pattern

## Hard Rules
- Never push directly to `main`
- Never commit private keys or mnemonics
- Never change constructor parameters of deployed contracts (requires redeployment)
- Never modify existing migration scripts

## What You Can Touch
- Phase 1 (CI fix): Test files, scripts, config — NOT production contract logic
- Phase 2 (issue): `docs/`, `test/`, `scripts/`, `spec/`, `.agent/`, `hardhat.config.ts`
- Phase 2 (issue labeled `scope:contract`): Production contracts with mandatory security note

## Success Criteria (all must pass before creating PR)
```
npx hardhat compile     → 0 errors
npx hardhat test        → all tests pass
npm run lint            → exit 0
```

## PR Creation
```bash
git add -A
git commit -m "type(scope): description [agent-fix]"
gh pr create --fill
```
PR body MUST include:
- Requires redeployment: YES/NO
- Backend impact: YES/NO
- Security considerations: (describe or "none")

## Limits
- Maximum 3 fix attempts per session
- For contract logic changes: describe the change rationale explicitly in PR
