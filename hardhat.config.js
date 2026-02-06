require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  // Contract sources are in the funky directory (FUNKY token)
  paths: {
    sources: path.join(__dirname, "funky"),
    tests: path.join(__dirname, "test"),
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
