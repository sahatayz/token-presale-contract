const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🔍 Token Presale Basic Tests", function () {
  let owner, buyer;
  let presale, saleToken, paymentToken;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    saleToken = await MyToken.deploy();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    paymentToken = await MockUSDC.deploy();

    const TokenPresale = await ethers.getContractFactory("TokenPresale");
    presale = await TokenPresale.deploy(
      await saleToken.getAddress(),
      await paymentToken.getAddress(),
      500000, // 0.50 USDC per token (500000 = 0.50 * 10^6)
      ethers.parseEther("1000") // Cap: 1000 tokens
    );

    await saleToken.grantMinterRole(await presale.getAddress());
    await paymentToken.mint(buyer.address, 100 * 10 ** 6);
  });

  it("1. Buyer purchases tokens correctly", async function () {
    await paymentToken
      .connect(buyer)
      .approve(await presale.getAddress(), 10 * 10 ** 6);

    await presale.connect(buyer).buy(10 * 10 ** 6);

    const balance = await saleToken.balanceOf(buyer.address);
    expect(balance).to.equal(ethers.parseEther("20"));
  });

  it("2. Prevents over-cap purchases", async function () {
    // Mint more USDC to buyer
    await paymentToken.mint(buyer.address, 500 * 10 ** 6);

    await paymentToken
      .connect(buyer)
      .approve(await presale.getAddress(), 500 * 10 ** 6);

    // This should be allowed (exactly at cap)
    await presale.connect(buyer).buy(500 * 10 ** 6);

    // Now try to buy 1 more USDC (which would exceed cap)
    await paymentToken.mint(buyer.address, 1 * 10 ** 6);
    await paymentToken
      .connect(buyer)
      .approve(await presale.getAddress(), 1 * 10 ** 6);

    await expect(presale.connect(buyer).buy(1 * 10 ** 6)).to.be.revertedWith(
      "Exceeds sale cap"
    );
  });

  it("3. Only owner can withdraw funds", async function () {
    await paymentToken
      .connect(buyer)
      .approve(await presale.getAddress(), 10 * 10 ** 6);
    await presale.connect(buyer).buy(10 * 10 ** 6);

    // Use updated error message format
    await expect(
      presale.connect(buyer).withdrawFunds(buyer.address)
    ).to.be.revertedWith(/OwnableUnauthorizedAccount/);

    // Owner withdraws successfully
    await expect(presale.connect(owner).withdrawFunds(owner.address))
      .to.emit(presale, "FundsWithdrawn")
      .withArgs(owner.address, 10 * 10 ** 6);
  });
});
