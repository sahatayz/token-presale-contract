# Token Presale System - ERC20 Minting-Based Sale

## Overview
This Solidity smart contract system facilitates a fixed-price ERC20 token presale using USDC as payment. The solution features:
1. **TokenPresale**: Main sale contract with minting capability
2. **MyToken**: Mintable ERC20 token with role-based access control
3. **MockUSDC**: Test USDC implementation (6 decimals)

## Key features:
- **Direct token minting** during purchases
- **Dynamic decimal handling** for different token standards
- **Secure fund management** with SafeERC20 transfers
- **Role-based access control** for minting operations
- **Hard cap enforcement** with real-time tracking

## Technical Specifications
- **Solidity Version**: 0.8.30 (Presale), ^0.8.0 (Tokens)
- **License**: MIT
- **Dependencies**:
  - OpenZeppelin Contracts 5.x
  - AccessControl
  - Ownable
  - SafeERC20
  - ERC20

## Contracts

### 1. TokenPresale Contract
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMintableToken is IERC20Metadata {
    function mint(address to, uint256 amount) external;
}

contract TokenPresale is Ownable {
    using SafeERC20 for IERC20Metadata;
    
    // Immutable contract parameters
    IMintableToken public immutable saleToken;
    IERC20Metadata public immutable paymentToken;
    uint256 public immutable pricePerToken;
    uint256 public immutable saleCap;
    
    // State variables
    uint256 public tokensSold;
    uint8 public immutable saleTokenDecimals;
    uint8 public immutable paymentTokenDecimals;

    event TokensPurchased(address indexed buyer, uint256 usdcAmount, uint256 tokenAmount);
    event FundsWithdrawn(address indexed receiver, uint256 amount);

    constructor(
        address _saleToken,
        address _paymentToken,
        uint256 _pricePerToken,
        uint256 _saleCap
    ) Ownable(msg.sender) {
        require(_saleToken != address(0), "Invalid token address");
        require(_paymentToken != address(0), "Invalid payment token");
        require(_pricePerToken > 0, "Price must be > 0");
        require(_saleCap > 0, "Cap must be > 0");

        saleToken = IMintableToken(_saleToken);
        paymentToken = IERC20Metadata(_paymentToken);
        pricePerToken = _pricePerToken;
        saleCap = _saleCap;
        saleTokenDecimals = saleToken.decimals();
        paymentTokenDecimals = paymentToken.decimals();
    }

    function buy(uint256 usdcAmount) public {
        require(usdcAmount > 0, "USDC amount must be > 0");

        // Calculate token amount with decimal conversion
        uint256 tokenAmount = (usdcAmount * (10 ** saleTokenDecimals)) / 
                             (pricePerToken * (10 ** paymentTokenDecimals));
        
        require(tokenAmount > 0, "Token amount too small");
        require(tokensSold + tokenAmount <= saleCap, "Exceeds sale cap");

        tokensSold += tokenAmount;
        paymentToken.safeTransferFrom(msg.sender, address(this), usdcAmount);
        saleToken.mint(msg.sender, tokenAmount);

        emit TokensPurchased(msg.sender, usdcAmount, tokenAmount);
    }

    function withdrawFunds(address to) public onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = paymentToken.balanceOf(address(this));
        require(balance > 0, "No funds available");
        paymentToken.safeTransfer(to, balance);
        emit FundsWithdrawn(to, balance);
    }

    function remainingTokens() public view returns (uint256) {
        return saleCap - tokensSold;
    }
}
```
### Features:
- **Dynamic Decimal Handling:** Supports tokens with any decimals

- **Mint-on-Purchase:** Tokens created directly during purchase

- **Cap Enforcement:** Strict limit on total tokens sold

- **Secure Withdrawals:** Owner-only USDC fund collection

- **Real-time Tracking:** remainingTokens() view function


 | Parameter         | Description                           | Example Value        |
|-------------------|---------------------------------------|----------------------|
| `_saleToken`      | Mintable ERC20 token address          | `0xYourTokenAddress` |
| `_paymentToken`   | USDC contract address (6 decimals)    | `0xA0b869...06eB48`  |
| `_pricePerToken`  | Price in USDC (6 decimals)            | `500000` (0.50 USDC) |
| `_saleCap`        | Max tokens to sell (token decimals)   | `1000 * 10¹⁸`        |

### 2. MyToken (Mintable ERC20)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MyToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    constructor() ERC20("PresaleToken", "PST") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }
    
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    function grantMinterRole(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(MINTER_ROLE, account);
    }
}
```
### Features:
- **Role-based Minting:** MINTER_ROLE required to create tokens

- **Custom Symbol:** Deploy with any name/symbol

- **Admin Controls:** Grant/revoke minter privileges

### 3. MockUSDC (Test Token)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {
        _mint(msg.sender, 1_000_000 * (10 ** decimals()));
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 wholeTokens) public {
        _mint(to, wholeTokens * (10 ** decimals()));
    }
}
```
### Features:
- **Fixed 6 Decimals:** Matches real USDC behavior

- **Initial Supply:** Automatically mints 1M tokens to deployer

- **Simple Minting:** Additional tokens can be minted for testing

## Deployment Workflow
### 1. Deploy Contracts
```javascript
// Deploy token
const MyToken = await ethers.getContractFactory("MyToken");
const saleToken = await MyToken.deploy();

// Deploy mock USDC
const MockUSDC = await ethers.getContractFactory("MockUSDC");
const paymentToken = await MockUSDC.deploy();

// Deploy presale
const TokenPresale = await ethers.getContractFactory("TokenPresale");
const presale = await TokenPresale.deploy(
  saleToken.address,
  paymentToken.address,
  500000,       // 0.50 USDC per token
  ethers.parseEther("1000") // 1000 tokens max
);
```

### 2. Configure Permissions
```javascript
// Grant minter role to presale contract
await saleToken.grantMinterRole(presale.address);
```
### 3. Prepare Buyers
```javascript
// Distribute USDC to buyers (6 decimals)
await paymentToken.mint(buyer.address, 100_000_000); // 100 USDC
```
### Usage Examples
#### Buy Tokens (Buyer)

```javascript
// Approve USDC spending (6 decimals)
await paymentToken.approve(presale.address, 10_000_000); // 10 USDC
// Execute purchase
await presale.buy(10_000_000);
```
#### Withdraw Funds (Owner)
```javascript
await presale.withdrawFunds(ownerAddress);
```
#### Check Remaining Supply
```javascript
const remaining = await presale.remainingTokens();
```
## Testing
The test suite verifies all critical functionality:

```javascript
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("🔍 Token Presale Tests", function () {
  let owner, buyer;
  let presale, saleToken, paymentToken;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();
    
    // Deploy contracts
    const MyToken = await ethers.getContractFactory("MyToken");
    saleToken = await MyToken.deploy();
    
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    paymentToken = await MockUSDC.deploy();
    
    const TokenPresale = await ethers.getContractFactory("TokenPresale");
    presale = await TokenPresale.deploy(
      saleToken.address,
      paymentToken.address,
      500000,
      ethers.parseEther("1000")
    );
    
    // Setup permissions
    await saleToken.grantMinterRole(presale.address);
    await paymentToken.mint(buyer.address, 100 * 10 ** 6);
  });

  it("Completes successful token purchase", async function () {
    await paymentToken.connect(buyer).approve(presale.address, 10 * 10 ** 6);
    await presale.connect(buyer).buy(10 * 10 ** 6);
    expect(await saleToken.balanceOf(buyer.address)).to.equal(ethers.parseEther("20"));
  });

  it("Prevents purchases exceeding cap", async function () {
    await paymentToken.connect(buyer).approve(presale.address, 500 * 10 ** 6);
    await expect(presale.connect(buyer).buy(500 * 10 ** 6)).to.be.revertedWith("Exceeds sale cap");
  });

  it("Enforces owner-only withdrawals", async function () {
    await paymentToken.connect(buyer).approve(presale.address, 10 * 10 ** 6);
    await presale.connect(buyer).buy(10 * 10 ** 6);
    await expect(presale.connect(buyer).withdrawFunds(buyer.address)).to.be.reverted;
  });
});
```
Run tests with:

```bash
npx hardhat test
```
## Security Considerations
**1. Minter Role:** Revoke minter role from presale after sale concludes

**2. Ownership:** Transfer ownership to multisig for production use

**3. Token Decimals:** Verify token decimal configurations before deployment

**4. Price Calculation:** Test price calculations with different decimal tokens

**5. Cap Management:** Monitor remaining tokens during active sale

## License
All contracts are MIT Licensed
