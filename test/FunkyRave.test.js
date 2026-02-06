const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");

describe("FunkyRave", function () {
  const INITIAL_SUPPLY = 30_000_000_000n * 10n ** 18n;

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
    return { token, admin, feeRecipient, dex, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set correct name and symbol", async function () {
      const { token } = await loadFixture(deployFunkyRaveFixture);
      expect(await token.name()).to.equal("FUNKY RAVE");
      expect(await token.symbol()).to.equal("FUNKY");
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

    it("Admin can update user holding date (tier)", async function () {
      const { token, admin, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).update_holding_date(user1.address, 181);
      expect(await token.holdingDate(user1.address)).to.equal(181);
    });

    it("Admin can update fee recipient", async function () {
      const { token, admin, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).update_fee_recipient(user1.address);
      expect(await token.feeRecipient()).to.equal(user1.address);
    });
  });

  describe("DEX list", function () {
    it("Admin can add and remove DEX", async function () {
      const { token, admin, dex } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_dex(dex.address);
      expect(await token.isDex(dex.address)).to.be.true;
      await token.connect(admin).remove_dex(dex.address);
      expect(await token.isDex(dex.address)).to.be.false;
    });

    it("Cannot add zero address as DEX", async function () {
      const { token, admin } = await loadFixture(deployFunkyRaveFixture);
      await expect(token.connect(admin).add_dex(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(token, "InvalidAddress");
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
      const { token, admin, feeRecipient, dex, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_dex(dex.address);
      // User1 tier 0 (Ignition) => 25% fee
      await token.connect(admin).update_holding_date(user1.address, 0);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);

      const feeRecipientBefore = await token.balanceOf(feeRecipient.address);
      await token.connect(user1).transfer(dex.address, amount);

      const expectedFee = (amount * 250n) / 1000n; // 25%
      const expectedNet = amount - expectedFee;
      expect(await token.balanceOf(dex.address)).to.equal(expectedNet);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(feeRecipientBefore + expectedFee);
    });

    it("Transfer to DEX: different tiers have different fee %", async function () {
      const { token, admin, feeRecipient, dex, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_dex(dex.address);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);

      // Tier 721 (Matured) = 3%
      await token.connect(admin).update_holding_date(user1.address, 721);
      await token.connect(user1).transfer(dex.address, amount);
      const expectedFee721 = (amount * 30n) / 1000n;
      expect(await token.balanceOf(feeRecipient.address)).to.equal(expectedFee721);
      expect(await token.balanceOf(dex.address)).to.equal(amount - expectedFee721);
    });

    it("Transfer to DEX when user tier has 0 fee: no fee taken", async function () {
      const { token, admin, feeRecipient, dex, user1 } = await loadFixture(deployFunkyRaveFixture);
      await token.connect(admin).add_dex(dex.address);
      await token.connect(admin).update_fee_percentage(0, 0); // set tier 0 to 0%
      await token.connect(admin).update_holding_date(user1.address, 0);
      const amount = 1000n * 10n ** 18n;
      await token.connect(admin).transfer(user1.address, amount);
      const feeRecipientBefore = await token.balanceOf(feeRecipient.address);
      await token.connect(user1).transfer(dex.address, amount);
      expect(await token.balanceOf(feeRecipient.address)).to.equal(feeRecipientBefore);
      expect(await token.balanceOf(dex.address)).to.equal(amount);
    });
  });
});
