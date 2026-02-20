const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");

describe("FunkyRave", function () {
  const INITIAL_SUPPLY = 30_000_000_000n * 10n ** 18n;
  const REASON_REGULAR_SYNC = ethers.id("REGULAR_SYNC");
  const REASON_FIFO_DOWNGRADE = ethers.id("FIFO_DOWNGRADE");
  const REASON_TREASURY_OP = ethers.id("TREASURY_OP");
  const BATCH_MAIN = ethers.id("BATCH_MAIN");
  const BATCH_ALT = ethers.id("BATCH_ALT");
  const EXEMPT_CAT_TREASURY_LP = ethers.id("TREASURY_LP_BOOTSTRAP");
  const REQUEST_EXEMPT_1 = ethers.id("REQUEST_EXEMPT_1");

  // Fee tiers: tier key => basis points (e.g. 250 = 25%)
  const FEE_TIERS = {
    0: 250,    // Ignition 0-30 days: 25%
    31: 230,   // Stabilization 31-90: 23%
    91: 200,   // Conviction 91-180: 20%
    181: 160,  // Commitment 181-270: 16%
    271: 120,  // Core 271-360: 12%
    361: 80,   // Veteran 361-540: 8%
    541: 50,   // Ascended 541-720: 5%
    721: 30,   // Matured 721+: 3%
  };

  async function deployFunkyRaveFixture() {
    const [admin, feeRecipient, dex, user1, user2] = await ethers.getSigners();
    const FunkyRave = await ethers.getContractFactory("FunkyRave");
    const token = await FunkyRave.deploy(admin.address, feeRecipient.address);
    const MockTierUpdater = await ethers.getContractFactory("MockTierUpdater");
    const tierUpdater = await MockTierUpdater.deploy();
    await token.connect(admin).add_tier_updater(tierUpdater.target);
    const MockDexFactory = await ethers.getContractFactory("MockDexFactory");
    const factory = await MockDexFactory.deploy();
    const MockDexPair = await ethers.getContractFactory("MockDexPair");
    const pair = await MockDexPair.deploy(token.target, dex.address, factory.target);
    return { token, admin, feeRecipient, dex, user1, user2, factory, pair, tierUpdater };
  }

  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      const { token } = await loadFixture(deployFunkyRaveFixture);
      expect(await token.name()).to.equal("FUNKY");
      expect(await token.symbol()).to.equal("FUNKY RAVE");
    });

    it("Should mint initial supply to admin", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);
      expect(await token.balanceOf(admin.address)).to.equal(INITIAL_SUPPLY);
      expect(await token.totalSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("Should set admin and fee recipient", async function () {
      const { token, admin, feeRecipient } = await loadFixture(deployFunkyRaveFixture);
      expect(await token.isAdmin(admin.address)).to.be.true;
      expect(await token.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("Should not auto-grant tier updater role to deployer EOA", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);
      expect(await token.isTierUpdater(admin.address)).to.be.false;
    });

    it("Should revert if initialAdmin or initialFeeRecipient is zero", async function () {
      const [admin, feeRecipient] = await ethers.getSigners();
      const FunkyRave = await ethers.getContractFactory("FunkyRave");
      await expect(FunkyRave.deploy(ethers.ZeroAddress, feeRecipient.address))
        .to.be.revertedWithCustomError(FunkyRave, "InvalidAddress");
      await expect(FunkyRave.deploy(admin.address, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(FunkyRave, "InvalidAddress");
    });

    it("Should set all 8 fee tiers correctly", async function () {
      const { token } = await loadFixture(deployFunkyRaveFixture);
      for (const [tierKey, feeBps] of Object.entries(FEE_TIERS)) {
        expect(await token.feePercent(tierKey)).to.equal(feeBps);
      }
    });
  });

  describe("Admin management", function () {
    it("Admin can add another admin", async function () {
      const { token, admin, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_admin(user1.address);
      expect(await token.isAdmin(user1.address)).to.be.true;
    });

    it("Non-admin cannot add admin", async function () {
      const { token, user1, user2 } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(user1).add_admin(user2.address))
        .to.be.revertedWithCustomError(token, "NotAdmin");
    });

    it("Admin can remove another admin (not last)", async function () {
      const { token, admin, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_admin(user1.address);
      await token.connect(admin).remove_admin(user1.address);
      expect(await token.isAdmin(user1.address)).to.be.false;
    });

    it("Cannot remove last admin", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(admin).remove_admin(admin.address))
        .to.be.revertedWithCustomError(token, "CannotRemoveLastAdmin");
    });

    it("Rejects EOA for tier updater role", async function () {
      const { token, admin, user1 } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(admin).add_tier_updater(user1.address))
        .to.be.revertedWithCustomError(token, "TierUpdaterMustBeContract");
    });
  });

  describe("Fee configuration", function () {
    it("Admin can update fee percentage for a tier", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).update_fee_percentage(31, 200);
      expect(await token.feePercent(31)).to.equal(200);
    });

    it("Reverts if fee > 1000", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(admin).update_fee_percentage(0, 1001))
        .to.be.revertedWithCustomError(token, "FeeTooHigh");
    });

    it("Tier updater contract can update user holding date (tier)", async function () {
      const { token, tierUpdater, user1 } = await loadFixture(deployFunkyRaveFixture);
      await tierUpdater.updateHoldingDate(token.target, user1.address, 181, REASON_REGULAR_SYNC, BATCH_MAIN);
      expect(await token.holdingDate(user1.address)).to.equal(181);
    });

    it("Non-tier-updater cannot update user holding date", async function () {
      const { token, user1, user2 } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(user1).update_holding_date(user2.address, 181, REASON_REGULAR_SYNC, BATCH_MAIN))
        .to.be.revertedWithCustomError(token, "NotTierUpdater");
    });

    it("Downgrade with regular sync reason is rejected", async function () {
      const { token, tierUpdater, user1 } = await loadFixture(deployFunkyRaveFixture);
      await tierUpdater.updateHoldingDate(token.target, user1.address, 181, REASON_REGULAR_SYNC, BATCH_MAIN);
      await expect(tierUpdater.updateHoldingDate(token.target, user1.address, 31, REASON_REGULAR_SYNC, BATCH_ALT))
        .to.be.revertedWithCustomError(token, "TierDowngradeNotAllowed");
    });

    it("Downgrade is allowed with explicit downgrade reason", async function () {
      const { token, tierUpdater, user1 } = await loadFixture(deployFunkyRaveFixture);
      await tierUpdater.updateHoldingDate(token.target, user1.address, 181, REASON_REGULAR_SYNC, BATCH_MAIN);
      await tierUpdater.updateHoldingDate(token.target, user1.address, 31, REASON_FIFO_DOWNGRADE, BATCH_ALT);
      expect(await token.holdingDate(user1.address)).to.equal(31);
    });

    it("Admin can update fee recipient", async function () {
      const { token, admin, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).update_fee_recipient(user1.address);
      expect(await token.feeRecipient()).to.equal(user1.address);
    });

    it("Admin can set and unset fee exemption with category", async function () {
      const { token, admin, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).set_fee_exempt(
        user1.address,
        true,
        REASON_TREASURY_OP,
        EXEMPT_CAT_TREASURY_LP,
        REQUEST_EXEMPT_1,
        admin.address,
        admin.address
      );
      expect(await token.isFeeExempt(user1.address)).to.equal(true);

      await token.connect(admin).set_fee_exempt(
        user1.address,
        false,
        REASON_TREASURY_OP,
        EXEMPT_CAT_TREASURY_LP,
        ethers.id("REQUEST_EXEMPT_2"),
        admin.address,
        admin.address
      );
      expect(await token.isFeeExempt(user1.address)).to.equal(false);
    });

    it("Reverts fee exemption when cap is exceeded", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);

      for (let i = 1; i <= 20; i++) {
        const targetAddress = ethers.Wallet.createRandom().address;
        await token.connect(admin).set_fee_exempt(
          targetAddress,
          true,
          REASON_TREASURY_OP,
          EXEMPT_CAT_TREASURY_LP,
          ethers.id(`REQUEST_CAP_${i}`),
          admin.address,
          admin.address
        );
      }

      await expect(
        token.connect(admin).set_fee_exempt(
          ethers.Wallet.createRandom().address,
          true,
          REASON_TREASURY_OP,
          EXEMPT_CAT_TREASURY_LP,
          ethers.id("REQUEST_CAP_21"),
          admin.address,
          admin.address
        )
      ).to.be.revertedWithCustomError(token, "ExemptAddressCapReached");
    });
  });

  describe("DEX list", function () {
    it("Admin can add and remove DEX", async function () {
      const { token, admin, pair, factory } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_factory(factory.target);
      await token.connect(admin).add_dex(pair.target);
      expect(await token.isDex(pair.target)).to.be.true;
      await token.connect(admin).remove_dex(pair.target);
      expect(await token.isDex(pair.target)).to.be.false;
    });

    it("Cannot add zero address as DEX", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(admin).add_dex(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(token, "InvalidAddress");
    });

    it("Cannot add pair if factory is not allowlisted", async function () {
      const { token, admin, pair } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(admin).add_dex(pair.target))
        .to.be.revertedWithCustomError(token, "FactoryNotRegistered");
    });
  });

  describe("Transfers and fees", function () {
    it("Transfer to non-DEX: no fee", async function () {
      const { token, admin, user1, user2 } = await loadFixture(deployFunkyRaveFixture);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);
      await token.connect(user1).transfer(user2.address, amount);
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("Transfer to DEX (sell): fee applied based on sender holding tier", async function () {
      const { token, admin, feeRecipient, pair, factory, user1, tierUpdater } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_factory(factory.target);
      await token.connect(admin).add_dex(pair.target);
      // User1 tier 0 (Ignition) => 25% fee
      await tierUpdater.updateHoldingDate(token.target, user1.address, 0, REASON_REGULAR_SYNC, BATCH_MAIN);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);

      const feeRecipientBefore = await token.balanceOf(feeRecipient.address);
      await token.connect(user1).transfer(pair.target, amount);

      const expectedFee = (amount * 250n) / 1000n; // 25%
      const expectedNet = amount - expectedFee;
      expect(await token.balanceOf(pair.target)).to.equal(expectedNet);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(feeRecipientBefore + expectedFee);
    });

    it("Transfer to DEX: different tiers have different fee %", async function () {
      const { token, admin, feeRecipient, pair, factory, user1, tierUpdater } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_factory(factory.target);
      await token.connect(admin).add_dex(pair.target);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);

      // Tier 721 (Matured) = 3%
      await tierUpdater.updateHoldingDate(token.target, user1.address, 721, REASON_REGULAR_SYNC, BATCH_MAIN);
      await token.connect(user1).transfer(pair.target, amount);
      const expectedFee721 = (amount * 30n) / 1000n;
      expect(await token.balanceOf(feeRecipient.address)).to.equal(expectedFee721);
      expect(await token.balanceOf(pair.target)).to.equal(amount - expectedFee721);
    });

    it("Transfer to DEX when user tier has 0 fee: no fee taken", async function () {
      const { token, admin, feeRecipient, pair, factory, user1, tierUpdater } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_factory(factory.target);
      await token.connect(admin).add_dex(pair.target);
      await token.connect(admin).update_fee_percentage(0, 0); // set tier 0 to 0%
      await tierUpdater.updateHoldingDate(token.target, user1.address, 0, REASON_REGULAR_SYNC, BATCH_MAIN);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);
      const feeRecipientBefore = await token.balanceOf(feeRecipient.address);
      await token.connect(user1).transfer(pair.target, amount);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(feeRecipientBefore);
      expect(await token.balanceOf(pair.target)).to.equal(amount);
    });

    it("transferFrom to DEX uses token owner's tier, not spender tier", async function () {
      const { token, admin, feeRecipient, pair, factory, user1, user2, tierUpdater } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_factory(factory.target);
      await token.connect(admin).add_dex(pair.target);

      // Owner (user1) should be charged as Matured (3%), while spender (user2) stays default tier 0 (25%)
      await tierUpdater.updateHoldingDate(token.target, user1.address, 721, REASON_REGULAR_SYNC, BATCH_MAIN);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);

      await token.connect(user1).approve(user2.address, amount);

      const feeRecipientBefore = await token.balanceOf(feeRecipient.address);
      await token.connect(user2).transferFrom(user1.address, pair.target, amount);

      const expectedFee = (amount * 30n) / 1000n; // user1 tier 721 => 3%
      const expectedNet = amount - expectedFee;

      expect(await token.balanceOf(pair.target)).to.equal(expectedNet);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(feeRecipientBefore + expectedFee);
    });

    it("Fee-exempt sender is not charged when transferring to DEX pair", async function () {
      const { token, admin, feeRecipient, pair, factory, user1, tierUpdater } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_factory(factory.target);
      await token.connect(admin).add_dex(pair.target);
      await tierUpdater.updateHoldingDate(token.target, user1.address, 0, REASON_REGULAR_SYNC, BATCH_MAIN);
      await token.connect(admin).set_fee_exempt(
        user1.address,
        true,
        REASON_TREASURY_OP,
        EXEMPT_CAT_TREASURY_LP,
        ethers.id("REQUEST_EXEMPT_SELL"),
        admin.address,
        admin.address
      );

      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);
      const feeRecipientBefore = await token.balanceOf(feeRecipient.address);
      await token.connect(user1).transfer(pair.target, amount);

      expect(await token.balanceOf(feeRecipient.address)).to.equal(feeRecipientBefore);
      expect(await token.balanceOf(pair.target)).to.equal(amount);
    });
  });
});
