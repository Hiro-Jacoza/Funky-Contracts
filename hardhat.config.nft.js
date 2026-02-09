require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  // Contract sources are in the funky-nft directory (FunkyNFT)
  paths: {
    sources: path.join(__dirname, "funky-nft"),
    tests: path.join(__dirname, "test"),
    cache: path.join(__dirname, "cache-nft"),
    artifacts: path.join(__dirname, "artifacts-nft"),
  },
  networks: {
    hardhat: {
      // Fork BSC mainnet for testing with real Chainlink price feed
      // Uncomment below to test with real price feed data:
      // forking: {
      //   url: "https://bsc-dataseed1.binance.org",
      // },
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    bscMainnet: {
      url: "https://bsc-dataseed1.binance.org",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
