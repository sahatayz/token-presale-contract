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
    // Token being sold (your custom token)
    IMintableToken public immutable saleToken;

    // Payment token (USDC)
    IERC20Metadata public immutable paymentToken;

    // Price per token in USDC (in USDC's decimals)
    uint256 public immutable pricePerToken;

    // Maximum tokens to sell (in token's decimals)
    uint256 public immutable saleCap;

    // Track how many tokens have been sold
    uint256 public tokensSold;

    uint8 public immutable saleTokenDecimals;
    uint8 public immutable paymentTokenDecimals;

    event TokensPurchased(
        address indexed buyer,
        uint256 usdcAmount,
        uint256 tokenAmount
    );
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
        // Input validation
        require(usdcAmount > 0, "USDC amount must be > 0");

        // Decimal conversion: (USDC-6 * TOKEN-18) / PRICE-6

        uint256 tokenAmount = (usdcAmount * (10 ** saleTokenDecimals)) /
            (pricePerToken * (10 ** paymentTokenDecimals));

        // Prevent fractional token amounts
        require(tokenAmount > 0, "Token amount too small");

        // Cap check
        require(tokensSold + tokenAmount <= saleCap, "Exceeds sale cap");

        // Update state
        tokensSold += tokenAmount;

        // Transfer USDC from user
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
