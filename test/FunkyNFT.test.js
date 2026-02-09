const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");

describe("FunkyNFT", function () {
  // Mock price feed: $500 per BNB (Chainlink uses 8 decimals)
  const MOCK_BNB_PRICE = 500n * 10n ** 8n; // $500 with 8 decimals
  const MINT_USD_PRICE = 500n * 10n ** 8n; // $500 per NFT

  // Calculate required BNB: mintUsdPrice / bnbPrice = 1 BNB (at $500/BNB for $500 NFT)
  // Add small buffer for rounding
  const MINT_PRICE_BNB = ethers.parseEther("1.001");
  const BATCH_2_PRICE_BNB = ethers.parseEther("2.002");
  const BATCH_3_PRICE_BNB = ethers.parseEther("3.003");

  async function deployFunkyNFTFixture() {
    const [owner, user1, user2, royaltyRecipient] = await ethers.getSigners();

    // Deploy mock Chainlink price feed
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    const priceFeed = await MockPriceFeed.deploy(8, MOCK_BNB_PRICE);

    // Deploy FunkyNFT with 5% royalty (500 basis points)
    const FunkyNFT = await ethers.getContractFactory("FunkyNFT");
    const nft = await FunkyNFT.deploy(
      await priceFeed.getAddress(),
      royaltyRecipient.address,
      500 // 5% royalty
    );

    return { nft, priceFeed, owner, user1, user2, royaltyRecipient };
  }

  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      const { nft } = await loadFixture(deployFunkyNFTFixture);
      expect(await nft.name()).to.equal("FUNKY NFT");
      expect(await nft.symbol()).to.equal("FUNKY");
    });

    it("Should set owner as deployer", async function () {
      const { nft, owner } = await loadFixture(deployFunkyNFTFixture);
      expect(await nft.owner()).to.equal(owner.address);
    });

    it("Should set mint price to $500", async function () {
      const { nft } = await loadFixture(deployFunkyNFTFixture);
      expect(await nft.mintUsdPrice()).to.equal(MINT_USD_PRICE);
    });

    it("Should start with nextTokenId at 0", async function () {
      const { nft } = await loadFixture(deployFunkyNFTFixture);
      expect(await nft.nextTokenId()).to.equal(0);
    });
  });

  describe("Single Mint", function () {
    it("Should mint a single NFT with correct tokenURI", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);
      const tokenURI = "ipfs://QmTestMetadata1";

      await nft.connect(user1).mint(user1.address, tokenURI, { value: MINT_PRICE_BNB });

      expect(await nft.ownerOf(0)).to.equal(user1.address);
      expect(await nft.tokenURI(0)).to.equal(tokenURI);
      expect(await nft.nextTokenId()).to.equal(1);
    });

    it("Should increment token IDs sequentially", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);

      await nft.connect(user1).mint(user1.address, "ipfs://uri1", { value: MINT_PRICE_BNB });
      await nft.connect(user1).mint(user1.address, "ipfs://uri2", { value: MINT_PRICE_BNB });
      await nft.connect(user1).mint(user1.address, "ipfs://uri3", { value: MINT_PRICE_BNB });

      expect(await nft.ownerOf(0)).to.equal(user1.address);
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.ownerOf(2)).to.equal(user1.address);
      expect(await nft.nextTokenId()).to.equal(3);
    });

    it("Should revert if not enough BNB sent", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);
      const tooLow = ethers.parseEther("0.5"); // Only $250 worth

      await expect(
        nft.connect(user1).mint(user1.address, "ipfs://uri", { value: tooLow })
      ).to.be.revertedWith("Must send at least minimum price in BNB");
    });

    it("Should allow minting to a different address", async function () {
      const { nft, user1, user2 } = await loadFixture(deployFunkyNFTFixture);

      await nft.connect(user1).mint(user2.address, "ipfs://uri", { value: MINT_PRICE_BNB });
      expect(await nft.ownerOf(0)).to.equal(user2.address);
    });

    it("Should emit Transfer event", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);

      await expect(nft.connect(user1).mint(user1.address, "ipfs://uri", { value: MINT_PRICE_BNB }))
        .to.emit(nft, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, 0);
    });
  });

  describe("Batch Mint", function () {
    it("Should batch mint 2 NFTs in a single transaction", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);
      const uris = ["ipfs://QmBatch1", "ipfs://QmBatch2"];

      await nft.connect(user1).batchMint(user1.address, uris, { value: BATCH_2_PRICE_BNB });

      expect(await nft.ownerOf(0)).to.equal(user1.address);
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.tokenURI(0)).to.equal("ipfs://QmBatch1");
      expect(await nft.tokenURI(1)).to.equal("ipfs://QmBatch2");
      expect(await nft.nextTokenId()).to.equal(2);
    });

    it("Should batch mint 3 NFTs in a single transaction", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);
      const uris = ["ipfs://QmBatch1", "ipfs://QmBatch2", "ipfs://QmBatch3"];

      await nft.connect(user1).batchMint(user1.address, uris, { value: BATCH_3_PRICE_BNB });

      expect(await nft.ownerOf(0)).to.equal(user1.address);
      expect(await nft.ownerOf(1)).to.equal(user1.address);
      expect(await nft.ownerOf(2)).to.equal(user1.address);
      expect(await nft.tokenURI(0)).to.equal("ipfs://QmBatch1");
      expect(await nft.tokenURI(1)).to.equal("ipfs://QmBatch2");
      expect(await nft.tokenURI(2)).to.equal("ipfs://QmBatch3");
      expect(await nft.nextTokenId()).to.equal(3);
    });

    it("Should emit Transfer event for each NFT in batch", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);
      const uris = ["ipfs://QmBatch1", "ipfs://QmBatch2"];

      const tx = await nft.connect(user1).batchMint(user1.address, uris, { value: BATCH_2_PRICE_BNB });
      const receipt = await tx.wait();

      // Filter Transfer events
      const transferEvents = receipt.logs.filter(
        (log) => log.topics.length >= 4
      );
      expect(transferEvents.length).to.equal(2);
    });

    it("Should revert if empty URI array", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);

      await expect(
        nft.connect(user1).batchMint(user1.address, [], { value: MINT_PRICE_BNB })
      ).to.be.revertedWith("Must mint at least 1 NFT");
    });

    it("Should revert if not enough BNB for batch", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);
      const uris = ["ipfs://QmBatch1", "ipfs://QmBatch2", "ipfs://QmBatch3"];

      // Only send enough for 1 NFT
      await expect(
        nft.connect(user1).batchMint(user1.address, uris, { value: MINT_PRICE_BNB })
      ).to.be.revertedWith("Must send enough BNB for all NFTs");
    });

    it("Should work with mixed single and batch mints", async function () {
      const { nft, user1, user2 } = await loadFixture(deployFunkyNFTFixture);

      // User1 mints 1 NFT (token #0)
      await nft.connect(user1).mint(user1.address, "ipfs://single1", { value: MINT_PRICE_BNB });

      // User2 batch mints 2 NFTs (tokens #1, #2)
      await nft.connect(user2).batchMint(user2.address, ["ipfs://batch1", "ipfs://batch2"], { value: BATCH_2_PRICE_BNB });

      // User1 mints 1 more (token #3)
      await nft.connect(user1).mint(user1.address, "ipfs://single2", { value: MINT_PRICE_BNB });

      expect(await nft.ownerOf(0)).to.equal(user1.address);
      expect(await nft.ownerOf(1)).to.equal(user2.address);
      expect(await nft.ownerOf(2)).to.equal(user2.address);
      expect(await nft.ownerOf(3)).to.equal(user1.address);
      expect(await nft.nextTokenId()).to.equal(4);
    });

    it("Should allow batch minting to a different address", async function () {
      const { nft, user1, user2 } = await loadFixture(deployFunkyNFTFixture);
      const uris = ["ipfs://QmBatch1", "ipfs://QmBatch2"];

      // User1 pays but mints to user2
      await nft.connect(user1).batchMint(user2.address, uris, { value: BATCH_2_PRICE_BNB });

      expect(await nft.ownerOf(0)).to.equal(user2.address);
      expect(await nft.ownerOf(1)).to.equal(user2.address);
    });
  });

  describe("Price Management", function () {
    it("Should return correct BNB/USD price", async function () {
      const { nft } = await loadFixture(deployFunkyNFTFixture);
      expect(await nft.getPrice()).to.equal(MOCK_BNB_PRICE);
    });

    it("Should convert BNB to USD correctly", async function () {
      const { nft } = await loadFixture(deployFunkyNFTFixture);
      const oneBNB = ethers.parseEther("1");
      // 1 BNB * $500 = $500 (in 8 decimal format)
      expect(await nft.getConversionRate(oneBNB)).to.equal(MINT_USD_PRICE);
    });

    it("Owner can update mint price", async function () {
      const { nft, owner } = await loadFixture(deployFunkyNFTFixture);
      const newPrice = 1000n * 10n ** 8n; // $1000

      await nft.connect(owner).setMintUsdPrice(newPrice);
      expect(await nft.mintUsdPrice()).to.equal(newPrice);
    });

    it("Non-owner cannot update mint price", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);

      await expect(
        nft.connect(user1).setMintUsdPrice(1000n * 10n ** 8n)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("Cannot set mint price to 0", async function () {
      const { nft, owner } = await loadFixture(deployFunkyNFTFixture);

      await expect(
        nft.connect(owner).setMintUsdPrice(0)
      ).to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("Royalty (ERC-2981)", function () {
    it("Should report correct royalty info", async function () {
      const { nft, user1, royaltyRecipient } = await loadFixture(deployFunkyNFTFixture);

      // Mint an NFT first
      await nft.connect(user1).mint(user1.address, "ipfs://uri", { value: MINT_PRICE_BNB });

      // Check royalty: 5% of 1 ETH sale = 0.05 ETH
      const salePrice = ethers.parseEther("1");
      const [receiver, amount] = await nft.royaltyInfo(0, salePrice);
      expect(receiver).to.equal(royaltyRecipient.address);
      expect(amount).to.equal(salePrice * 500n / 10000n); // 5%
    });

    it("Owner can update royalty", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFunkyNFTFixture);

      await nft.connect(owner).setDefaultRoyalty(user1.address, 1000); // 10%

      // Mint an NFT to test
      await nft.connect(user1).mint(user1.address, "ipfs://uri", { value: MINT_PRICE_BNB });
      const salePrice = ethers.parseEther("1");
      const [receiver, amount] = await nft.royaltyInfo(0, salePrice);
      expect(receiver).to.equal(user1.address);
      expect(amount).to.equal(salePrice * 1000n / 10000n); // 10%
    });
  });

  describe("Withdraw", function () {
    it("Owner can withdraw collected BNB", async function () {
      const { nft, owner, user1 } = await loadFixture(deployFunkyNFTFixture);

      // Mint 2 NFTs to accumulate BNB in contract
      await nft.connect(user1).mint(user1.address, "ipfs://uri1", { value: MINT_PRICE_BNB });
      await nft.connect(user1).mint(user1.address, "ipfs://uri2", { value: MINT_PRICE_BNB });

      const contractBalance = await ethers.provider.getBalance(await nft.getAddress());
      expect(contractBalance).to.be.greaterThan(0);

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await nft.connect(owner).withdraw();
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      // Owner balance should increase (minus gas)
      expect(ownerBalanceAfter).to.be.greaterThan(ownerBalanceBefore);

      // Contract balance should be 0
      const contractBalanceAfter = await ethers.provider.getBalance(await nft.getAddress());
      expect(contractBalanceAfter).to.equal(0);
    });

    it("Non-owner cannot withdraw", async function () {
      const { nft, user1 } = await loadFixture(deployFunkyNFTFixture);

      await expect(
        nft.connect(user1).withdraw()
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });
});
