# FUNKY RAVE Smart Contract

## Test with Hardhat

From the `smart-contract` directory:

```bash
# Install dependencies (once)
npm install

# Compile contracts
npm run compile
# or: npx hardhat compile

# Run all tests
npm test
# or: npx hardhat test

# Run tests with gas report
npm run test:gas
# or: REPORT_GAS=true npx hardhat test
```

## Test coverage

- **Deployment**: name/symbol, initial supply, admin, fee recipient, all 8 fee tiers (0, 31, 91, 181, 271, 361, 541, 721)
- **Admin**: add/remove admin, onlyAdmin modifier
- **Fee config**: update_fee_percentage, update_holding_date, update_fee_recipient
- **DEX**: add_dex, remove_dex
- **Transfers**: no fee for non-DEX; fee on sell (to DEX) by holding tier; 0% tier

## Fee tiers (on-chain)

| Tier key | Days    | Phase        | Fee  |
|----------|---------|-------------|------|
| 0        | 0–30    | Ignition    | 25%  |
| 31       | 31–90   | Stabilization | 23% |
| 91       | 91–180  | Conviction  | 20%  |
| 181      | 181–270 | Commitment  | 16%  |
| 271      | 271–360 | Core        | 12%  |
| 361      | 361–540 | Veteran     | 8%   |
| 541      | 541–720 | Ascended    | 5%   |
| 721      | 721+    | Matured     | 3%   |
