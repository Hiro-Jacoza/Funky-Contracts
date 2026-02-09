const { ethers, network } = require("hardhat");

async function main() {
  const signers = await ethers.getSigners();

  if (signers.length === 0) {
    console.error("❌ No wallet account found!");
    console.error("");
    console.error("You must set the PRIVATE_KEY environment variable before deploying.");
    console.error("");
    console.error("On Windows (PowerShell):");
    console.error('  $env:PRIVATE_KEY="0xYOUR_PRIVATE_KEY_HERE"');
    console.error('  npm run deploy:nft:mainnet');
    console.error("");
    console.error("On Windows (CMD):");
    console.error('  set PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE');
    console.error('  npm run deploy:nft:mainnet');
    console.error("");
    console.error("On Linux/Mac:");
    console.error('  PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE npm run deploy:nft:mainnet');
    console.error("");
    console.error("⚠️  NEVER commit your private key to git!");
    process.exit(1);
  }

  const deployer = signers[0];
  console.log("Deploying FunkyNFT with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
  console.log("Network:", network.name);

  // ==========================================
  // Configuration - UPDATE THESE BEFORE DEPLOY
  // ==========================================

  // Chainlink BNB/USD Price Feed addresses
  const PRICE_FEED_ADDRESSES = {
    bscMainnet: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", // BSC Mainnet BNB/USD
    bscTestnet: "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526", // BSC Testnet BNB/USD
    hardhat: "", // Will deploy mock for local testing
  };

  // Royalty configuration
  const ROYALTY_RECIPIENT = deployer.address; // Change to your royalty wallet
  const ROYALTY_PERCENT = 500; // 5% (in basis points: 500 = 5%)

  // ==========================================
  // Deploy
  // ==========================================

  let priceFeedAddress = PRICE_FEED_ADDRESSES[network.name];

  // For local testing, deploy a mock price feed
  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("\n📦 Deploying MockV3Aggregator for local testing...");
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    const mockPriceFeed = await MockPriceFeed.deploy(
      8,                        // decimals
      500n * 10n ** 8n          // $500 BNB price
    );
    await mockPriceFeed.waitForDeployment();
    priceFeedAddress = await mockPriceFeed.getAddress();
    console.log("✅ MockV3Aggregator deployed to:", priceFeedAddress);
  }

  if (!priceFeedAddress) {
    throw new Error(`No price feed address configured for network: ${network.name}`);
  }

  console.log("\n📦 Deploying FunkyNFT...");
  console.log("  Price Feed:", priceFeedAddress);
  console.log("  Royalty Recipient:", ROYALTY_RECIPIENT);
  console.log("  Royalty Percent:", ROYALTY_PERCENT / 100, "%");

  const FunkyNFT = await ethers.getContractFactory("FunkyNFT");
  const nft = await FunkyNFT.deploy(
    priceFeedAddress,
    ROYALTY_RECIPIENT,
    ROYALTY_PERCENT
  );
  await nft.waitForDeployment();

  const nftAddress = await nft.getAddress();
  console.log("\n✅ FunkyNFT deployed to:", nftAddress);

  // Verify deployment
  console.log("\n📋 Verifying deployment...");
  console.log("  Name:", await nft.name());
  console.log("  Symbol:", await nft.symbol());
  console.log("  Mint Price (USD):", ethers.formatUnits(await nft.mintUsdPrice(), 8), "USD");
  console.log("  Next Token ID:", (await nft.nextTokenId()).toString());
  console.log("  Owner:", await nft.owner());

  // ==========================================
  // Post-deploy instructions
  // ==========================================
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log(`\nContract Address: ${nftAddress}`);
  console.log(`Network: ${network.name}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Update NEXT_PUBLIC_NFT_ADDRESS in your frontend .env:`);
  console.log(`     NEXT_PUBLIC_NFT_ADDRESS=${nftAddress}`);
  console.log(`  2. If deploying to BSC testnet/mainnet, verify the contract:`);
  console.log(`     npx hardhat verify --config hardhat.config.nft.js --network ${network.name} ${nftAddress} "${priceFeedAddress}" "${ROYALTY_RECIPIENT}" ${ROYALTY_PERCENT}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
