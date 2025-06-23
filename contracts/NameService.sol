// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract RentalNFT is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    
    // Base URI for metadata
    string private _baseTokenURI;
    
    // Optional: maximum supply
    uint256 public constant MAX_SUPPLY = 10000;
    
    // Optional: mint price
    uint256 public mintPrice = 0.01 ether;
    
    // Optional: Keep track of token URIs
    mapping(uint256 => string) private _tokenURIs;
    
    constructor(string memory name, string memory symbol, string memory baseURI) 
        ERC721(name, symbol)
        Ownable(msg.sender)
    {
        _baseTokenURI = baseURI;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }
    
    // Mint function for users
    function mint(string memory tokenURI) external payable returns (uint256) {
        require(_tokenIds.current() < MAX_SUPPLY, "Max supply reached");
        if (msg.sender != owner()) {
            require(msg.value >= mintPrice, "Insufficient payment");
        }
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _mint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        return newTokenId;
    }
    
    // Mint function for the owner (no payment required)
    function mintForAddress(address recipient, string memory tokenURI) external onlyOwner returns (uint256) {
        require(_tokenIds.current() < MAX_SUPPLY, "Max supply reached");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _mint(recipient, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
        
        return newTokenId;
    }
    
    // Batch mint for the owner (mints multiple NFTs at once)
    function batchMint(address recipient, uint256 amount, string memory baseTokenURI) external onlyOwner {
        require(_tokenIds.current() + amount <= MAX_SUPPLY, "Would exceed max supply");
        
        for (uint256 i = 0; i < amount; i++) {
            _tokenIds.increment();
            uint256 newTokenId = _tokenIds.current();
            
            _mint(recipient, newTokenId);
            // Create unique token URI for each NFT
            string memory tokenURI = string(abi.encodePacked(baseTokenURI, "/", _toString(newTokenId), ".json"));
            _setTokenURI(newTokenId, tokenURI);
        }
    }
    
    // Helper function to convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
        // This is just an example implementation
        if (value == 0) {
            return "0";
        }
        
        uint256 temp = value;
        uint256 digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    // Withdraw funds from contract
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    // The following functions are already implemented by the imported OpenZeppelin contracts:
    // - ownerOf(uint256 tokenId)
    // - safeTransferFrom(address from, address to, uint256 tokenId)
    // - isApprovedForAll(address owner, address operator)
    // - getApproved(uint256 tokenId)
}