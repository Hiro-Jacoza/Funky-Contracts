// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {
    ERC721,
    ERC721URIStorage
} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

contract FunkyNFT is ERC721URIStorage, ERC2981, Ownable {
    uint256 private _nextTokenId;
    AggregatorV3Interface internal priceFeed;

    // Minimum USD price per NFT (default: $500, Chainlink feed has 8 decimals)
    uint256 public mintUsdPrice = 500 * 10 ** 8;

    constructor(
        address priceFeedAddress,
        address royaltyRecipient,
        uint16 royaltyPercent
    ) ERC721("FUNKY NFT", "FUNKY") Ownable(msg.sender) {
        priceFeed = AggregatorV3Interface(priceFeedAddress);
        _setDefaultRoyalty(royaltyRecipient, royaltyPercent);
    }

    // The following functions are required to resolve inheritance conflicts
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Mint a single NFT (must send >= mintUsdPrice in BNB)
    function mint(
        address to,
        string memory tokenURI
    ) public payable returns (uint256) {
        require(
            getConversionRate(msg.value) >= mintUsdPrice,
            "Must send at least minimum price in BNB"
        );

        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        return tokenId;
    }

    /// @notice Mint multiple NFTs in a single transaction
    /// @param to The address to mint NFTs to
    /// @param tokenURIs Array of metadata URIs for each NFT
    /// @return tokenIds Array of minted token IDs
    function batchMint(
        address to,
        string[] memory tokenURIs
    ) public payable returns (uint256[] memory) {
        uint256 quantity = tokenURIs.length;
        require(quantity > 0, "Must mint at least 1 NFT");
        require(
            getConversionRate(msg.value) >= mintUsdPrice * quantity,
            "Must send enough BNB for all NFTs"
        );

        uint256[] memory tokenIds = new uint256[](quantity);
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _nextTokenId++;
            _mint(to, tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            tokenIds[i] = tokenId;
        }

        return tokenIds;
    }

     // Optional: allow updating default royalty later
    function setDefaultRoyalty(address royaltyRecipient, uint16 royaltyPercent) external onlyOwner {
        _setDefaultRoyalty(royaltyRecipient, royaltyPercent);
    }

    /// @notice Fetch latest BNB/USD price (8 decimals)
    function getPrice() public view returns (int256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return price;
    }

    /// @notice Convert BNB (wei) to USD (8 decimals)
    function getConversionRate(
        uint256 bnbAmount
    ) public view returns (uint256) {
        int256 price = getPrice();
        require(price > 0, "Invalid price feed");
        uint256 bnbPrice = uint256(price);

        // (BNB in wei * price) / 1e18
        return (bnbAmount * bnbPrice) / 1e18;
    }

    /// @notice Update minimum price per NFT in USD (only owner)
    function setMintUsdPrice(uint256 newMintUsd) external onlyOwner {
        require(newMintUsd > 0, "Price must be greater than 0");
        mintUsdPrice = newMintUsd;
    }

    /// @notice Withdraw collected BNB (only owner)
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
