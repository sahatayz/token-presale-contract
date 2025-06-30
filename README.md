# Token Presale Contract - ERC20 Fixed-Price Sale

![Solidity](https://img.shields.io/badge/Solidity-0.8.30-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

Secure ERC20 token presale contract. Users buy tokens with USDC at a fixed price until presale cap is reached. Owner can withdraw collected funds.

## Features
- Fixed-price token sales with configurable cap
- Proper decimal handling (USDC 6 decimals → Tokens 18 decimals)
- Owner-only fund withdrawal
- Real-time tracking of remaining tokens
- Comprehensive event logging
- Reentrancy protection through state-first pattern

## Contract Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

event TokensPurchased(address indexed buyer, uint256 usdcAmount, uint256 tokenAmount);
event FundsWithdrawn(address indexed receiver, uint256 amount);

contract TokenPresale is Ownable {
    // Token being sold (your custom token)
    IERC20 public immutable saleToken;

    // Payment token (USDC)
    IERC20 public immutable paymentToken;

    // Price per token in USDC (in USDC's decimals)
    uint256 public immutable pricePerToken;

    // Maximum tokens to sell (in token's decimals)
    uint256 public immutable saleCap;

    // Track how many tokens have been sold
    uint256 public tokensSold;

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

        saleToken = IERC20(_saleToken);
        paymentToken = IERC20(_paymentToken);
        pricePerToken = _pricePerToken;
        saleCap = _saleCap;
    }

    function buy(uint256 usdcAmount) public {
        // Input validation
        require(usdcAmount > 0, "USDC amount must be > 0");

        // Decimal conversion: (USDC-6 * TOKEN-18) / PRICE-6
        uint256 tokenAmount = (usdcAmount * 1e18) / pricePerToken;

        // Prevent fractional token amounts
        require(tokenAmount > 0, "Token amount too small");

        // Cap check
        require(tokensSold + tokenAmount <= saleCap, "Exceeds sale cap");

        // Update state
        tokensSold += tokenAmount;

        // Transfer USDC from user
        require(
            paymentToken.transferFrom(msg.sender, address(this), usdcAmount),
            "USDC transfer failed"
        );

        // Transfer tokens to user
        require(
            saleToken.transfer(msg.sender, tokenAmount),
            "Token transfer failed"
        );

        emit TokensPurchased(msg.sender, usdcAmount, tokenAmount);
    }

    function withdrawFunds(address to) public onlyOwner {
        require(to != address(0), "Invalid address");
        uint256 balance = paymentToken.balanceOf(address(this));
        require(balance > 0, "No funds available");
        require(paymentToken.transfer(to, balance), "Withdraw failed");

        emit FundsWithdrawn(to, balance);
    }

    function remainingTokens() public view returns (uint256) {
        return saleCap - tokensSold;
    }
}
```
## Deployment
Set parameters in constructor:

```javascript
new TokenPresale(
    tokenAddress,  // Your ERC20 token address
    usdcAddress,   // USDC contract address
    1_000_000,     // Price: 1 USDC per token (in 6 decimals)
    100_000 * 1e18 // Cap: 100,000 tokens (in 18 decimals)
)
```
Fund contract with tokens before sale:

```javascript
// Send saleCap tokens to contract address
token.transfer(presaleAddress, 100_000 * 1e18);
```
## Usage
Buy Tokens
```javascript
// 1. Approve USDC spending
usdc.approve(presaleAddress, 10 * 1e6); // Approve 10 USDC

// 2. Purchase tokens
presale.buy(10 * 1e6); // Buy with 10 USDC (6 decimals)
```
Withdraw Funds (Owner)
```javascript
presale.withdrawFunds(treasuryAddress);
```
Check Remaining Tokens
```javascript
const remaining = await presale.remainingTokens();
```
## License
MIT License
