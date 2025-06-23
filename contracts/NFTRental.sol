// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC721 {
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function getApproved(uint256 tokenId) external view returns (address);
}

contract NftRentalMarketplace {
    enum ListingStatus { Available, Rented, Ended }

    struct Listing {
        address nftContract;
        uint256 tokenId;
        address payable lister;
        uint256 pricePerDay;
        uint256 maxDuration;
        ListingStatus status;
        address renter;
        uint256 rentStart;
        uint256 rentEnd;
    }

    uint256 public nextListingId;
    mapping(uint256 => Listing) public listings;

    event NFTListed(uint256 indexed listingId, address indexed nftContract, uint256 indexed tokenId, address lister, uint256 pricePerDay, uint256 maxDuration);
    event NFTRented(uint256 indexed listingId, address indexed renter, uint256 rentEnd, uint256 totalFee);
    event RentalEnded(uint256 indexed listingId, uint256 tokenId);
    event NFTDelisted(uint256 indexed listingId);

    modifier onlyLister(uint256 listingId) {
        require(msg.sender == listings[listingId].lister, "Not the lister");
        _;
    }

    function listNFT(address nftContract, uint256 tokenId, uint256 pricePerDay, uint256 maxDuration) external {
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(
            nft.getApproved(tokenId) == address(this) || nft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        listings[nextListingId] = Listing({
            nftContract: nftContract,
            tokenId: tokenId,
            lister: payable(msg.sender),
            pricePerDay: pricePerDay,
            maxDuration: maxDuration,
            status: ListingStatus.Available,
            renter: address(0),
            rentStart: 0,
            rentEnd: 0
        });

        emit NFTListed(nextListingId, nftContract, tokenId, msg.sender, pricePerDay, maxDuration);
        nextListingId++;
    }

    function rentNFT(uint256 listingId, uint256 rentDays) external payable {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Available, "Not available");
        require(rentDays <= listing.maxDuration, "Duration exceeds max allowed");

        uint256 totalFee = listing.pricePerDay * rentDays;
        require(msg.value == totalFee, "Incorrect ETH sent");

        listing.renter = msg.sender;
        listing.rentStart = block.timestamp;
        listing.rentEnd = block.timestamp + rentDays * 1 days;
        listing.status = ListingStatus.Rented;

        listing.lister.transfer(msg.value);

        emit NFTRented(listingId, msg.sender, listing.rentEnd, totalFee);
    }

    function endRental(uint256 listingId) external onlyLister(listingId) {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Rented, "Not currently rented");
        require(block.timestamp >= listing.rentEnd, "Rental period not over");

        IERC721(listing.nftContract).safeTransferFrom(address(this), listing.lister, listing.tokenId);
        listing.status = ListingStatus.Ended;

        emit RentalEnded(listingId, listing.tokenId);
    }

    function delistNFT(uint256 listingId) external onlyLister(listingId) {
        Listing storage listing = listings[listingId];
        require(listing.status == ListingStatus.Available || listing.status == ListingStatus.Ended, "Cannot delist while rented");

        IERC721(listing.nftContract).safeTransferFrom(address(this), listing.lister, listing.tokenId);
        listing.status = ListingStatus.Ended;

        emit NFTDelisted(listingId);
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
}
