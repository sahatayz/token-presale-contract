const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🔍 Token Presale Basic Tests", function () {
  let owner, buyer;
  let presale, saleToken, paymentToken;

  // Setup runs before each test
  beforeEach(async function () {
    // 1. GET ACCOUNTS: Always get 2 signers
    [owner, buyer] = await ethers.getSigners();

    // 2. DEPLOY SALE TOKEN (Your custom token)
    const MyToken = await ethers.getContractFactory("MyToken");
    saleToken = await MyToken.deploy();

    // 3. DEPLOY PAYMENT TOKEN (Mock USDC)
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    paymentToken = await MockUSDC.deploy();

    // 4. DEPLOY PRESALE CONTRACT
    const TokenPresale = await ethers.getContractFactory("TokenPresale");
    presale = await TokenPresale.deploy(
      saleToken.address, // myToken address
      paymentToken.address, // Mock USDC address
      500000, // 0.50 USDC per token (500000 = 0.50 * 10^6)
      ethers.utils.parseEther("1000") // Cap: 1000 tokens (10^18 decimals)
    );

    // 5. GRANT MINTER ROLE TO PRESALE
    await saleToken.grantMinterRole(presale.address);

    // 6. FUND BUYER WITH USDC - THIS IS THE CRITICAL FIX
    // Mint 100 USDC to buyer (100 * 10^6 units)
    await paymentToken.mint(buyer.address, 100 * 10 ** 6);
  });

  it("1. Buyer purchases tokens correctly", async function () {
    // A. Buyer approves 10 USDC spending
    await paymentToken.connect(buyer).approve(
      presale.address,
      10 * 10 ** 6 // 10 USDC (6 decimals)
    );

    // B. Buyer executes purchase
    await presale.connect(buyer).buy(10 * 10 ** 6);

    // C. Verify buyer received 20 tokens
    // (10 USDC / 0.50 USDC/token = 20 tokens)
    const balance = await saleToken.balanceOf(buyer.address);
    expect(balance).to.equal(ethers.utils.parseEther("20"));
  });

  it("2. Prevents over-cap purchases", async function () {
    // A. Buyer approves 500 USDC
    await paymentToken.connect(buyer).approve(presale.address, 500 * 10 ** 6);

    // B. Attempt purchase (500 USDC would buy 1000 tokens at 0.50)
    // But cap is 1000 tokens - should fail
    await expect(presale.connect(buyer).buy(500 * 10 ** 6)).to.be.revertedWith(
      "Exceeds sale cap"
    );
  });

  it("3. Only owner can withdraw funds", async function () {
    // A. First make a purchase
    await paymentToken.connect(buyer).approve(presale.address, 10 * 10 ** 6);
    await presale.connect(buyer).buy(10 * 10 ** 6);

    // B. Non-owner (buyer) tries to withdraw - should fail
    await expect(
      presale.connect(buyer).withdrawFunds(buyer.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    // C. Owner withdraws successfully
    await presale.connect(owner).withdrawFunds(owner.address);
  });
});
