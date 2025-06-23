import React, { useEffect, useState, useContext } from "react";
import { ethers } from "ethers";
import { WalletContext } from '../context/WalletContext';
import marketplaceAbi from "../utils/marketplace.json";
import nftAbi from "../utils/abi.json";

const ManageNFT = () => {
  const { walletAddress } = useContext(WalletContext);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [myListings, setMyListings] = useState([]);
  const [myRentals, setMyRentals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState('listings'); // 'listings' or 'rentals'
  
  const RENTAL_ADDRESS = import.meta.env.VITE_RENTAL_ADDRESS;
  const NFT_CONTRACT_ADDRESS = import.meta.env.VITE_NAME_CONTRACT;

  useEffect(() => {
    if (walletAddress) {
      initializeProviderAndContracts();
    }
  }, [walletAddress]);
  
  const initializeProviderAndContracts = async () => {
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(RENTAL_ADDRESS, marketplaceAbi.abi, signer);
      
      setProvider(provider);
      setSigner(signer);
      setContract(contract);
      
      // Load listings and rentals
      fetchMyListings(contract);
      fetchMyRentals(contract);
    } catch (err) {
      console.error("Failed to initialize:", err);
      setStatus("Error: " + (err.reason || err.message));
    }
  };

  const fetchMyListings = async (marketplaceContract) => {
    try {
      setLoading(true);
      setStatus("");
      
      // In the new contract, we can use getUserListings to get all listings for a user
      const userListingIds = await marketplaceContract.getUserListings(walletAddress);
      console.log('User listing IDs:', userListingIds);
      
      const myListingsData = [];
      
      // Iterate through the user's listings
      for (let i = 0; i < userListingIds.length; i++) {
        try {
          const listingId = userListingIds[i].toNumber();
          const listing = await marketplaceContract.getListing(listingId);
          
          // Check the rental status
          const [isRented, rentalId] = await marketplaceContract.isRented(listing[0], listing[1]);
          
          // Get any active rental details if this NFT is rented
          let rentalDetails = null;
          if (isRented && rentalId.toNumber() > 0) {
            try {
              rentalDetails = await marketplaceContract.getRental(rentalId);
            } catch (rentErr) {
              console.error('Error fetching rental details:', rentErr);
            }
          }
          
          // Add to our listings array
          myListingsData.push({
            id: listingId,
            nftContract: listing[0],
            tokenId: listing[1].toString(),
            owner: listing[2],
            rentalPrice: ethers.utils.formatEther(listing[3]),
            maxDuration: listing[4].toString(),
            status: listing[5], // 0=Available, 1=Rented, 2=Inactive
            statusText: listing[5] === 0 ? 'Available' : listing[5] === 1 ? 'Rented' : 'Inactive',
            isActive: listing[5] === 0, // Only status 0 (Available) is considered active
            isRented,
            rentalId: rentalId.toNumber() > 0 ? rentalId.toNumber() : null,
            renter: rentalDetails ? rentalDetails[1] : null,
            rentStart: rentalDetails ? new Date(rentalDetails[2].toNumber() * 1000).toLocaleDateString() : null,
            rentEnd: rentalDetails ? new Date(rentalDetails[3].toNumber() * 1000).toLocaleDateString() : null,
            image: `https://picsum.photos/seed/${listingId}/200/200` // Placeholder image
          });
        } catch (err) {
          console.error(`Error fetching listing ${userListingIds[i]}:`, err);
          continue;
        }
      }
      
      console.log('My listings:', myListingsData);
      setMyListings(myListingsData);
    } catch (err) {
      console.error("Failed to fetch listings:", err);
      setStatus("Error: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMyRentals = async (marketplaceContract) => {
    try {
      // In the new contract, we can use getUserRentals to get all rentals for a user
      const userRentalIds = await marketplaceContract.getUserRentals(walletAddress);
      console.log('User rental IDs:', userRentalIds);
      
      const myRentalsData = [];
      
      // Iterate through the user's rentals
      for (let i = 0; i < userRentalIds.length; i++) {
        try {
          const rentalId = userRentalIds[i].toNumber();
          const rental = await marketplaceContract.getRental(rentalId);
          
          // Get the associated listing
          const listingId = rental[0].toNumber();
          const listing = await marketplaceContract.getListing(listingId);
          
          const now = Math.floor(Date.now() / 1000);
          const isActive = rental[3].toNumber() > now; // Check if rental end time is in the future
          
          myRentalsData.push({
            id: rentalId,
            listingId,
            nftContract: listing[0],
            tokenId: listing[1].toString(),
            owner: listing[2],
            rentalPrice: ethers.utils.formatEther(listing[3]),
            maxDuration: listing[4].toString(),
            status: listing[5],
            renter: rental[1],
            rentStart: new Date(rental[2].toNumber() * 1000).toLocaleDateString(),
            rentEnd: new Date(rental[3].toNumber() * 1000).toLocaleDateString(),
            remainingDays: Math.max(0, Math.floor((rental[3].toNumber() - now) / (24 * 60 * 60))),
            isActive,
            image: `https://picsum.photos/seed/${listingId}/200/200` // Placeholder image
          });
        } catch (err) {
          console.error(`Error fetching rental ${userRentalIds[i]}:`, err);
          continue;
        }
      }
      
      console.log('My rentals:', myRentalsData);
      setMyRentals(myRentalsData);
    } catch (err) {
      console.error("Failed to fetch rentals:", err);
      setStatus("Error: " + (err.reason || err.message));
    }
  };



  const handleCancelListing = async (listingId) => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setStatus("Canceling NFT listing...");
      
      // In the new contract, it's cancelListing instead of delistNFT
      const tx = await contract.cancelListing(listingId, {
        gasLimit: 500000 // Adding explicit gas limit to avoid estimation errors
      });
      
      setStatus("Confirming transaction...");
      await tx.wait();
      
      // Update listings
      fetchMyListings(contract);
      setStatus("NFT listing canceled successfully!");
    } catch (err) {
      console.error("Failed to cancel NFT listing:", err);
      setStatus("Error: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const handleEndRental = async (rentalId) => {
    if (!contract) return;
    
    try {
      setLoading(true);
      setStatus("Ending rental...");
      
      // In the new contract, endRental takes the rental ID, not the listing ID
      const tx = await contract.endRental(rentalId, {
        gasLimit: 500000 // Adding explicit gas limit to avoid estimation errors
      });
      
      setStatus("Confirming transaction...");
      await tx.wait();
      
      // Update listings and rentals
      fetchMyListings(contract);
      fetchMyRentals(contract);
      setStatus("Rental ended successfully!");
    } catch (err) {
      console.error("Failed to end rental:", err);
      setStatus("Error: " + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-white mb-8">🧰 Manage Your NFTs</h1>
        <p className="text-white/70">Please connect your wallet to manage your NFTs.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">🧰 Manage Your NFTs</h1>
      
      {status && (
        <div className={`${status.includes('Error') ? 'bg-red-500/20 border-red-500/50' : 'bg-green-500/20 border-green-500/50'} border text-white p-4 rounded-lg mb-6`}>
          {status}
        </div>
      )}
      
      {/* Tab navigation */}
      <div className="flex border-b border-white/10 mb-6">
        <button 
          className={`px-4 py-2 font-medium ${activeTab === 'listings' ? 'text-white border-b-2 border-pink-500' : 'text-white/60 hover:text-white'}`}
          onClick={() => setActiveTab('listings')}
        >
          My Listings
        </button>
        <button 
          className={`px-4 py-2 font-medium ${activeTab === 'rentals' ? 'text-white border-b-2 border-pink-500' : 'text-white/60 hover:text-white'}`}
          onClick={() => setActiveTab('rentals')}
        >
          My Rentals
        </button>
      </div>
      
      {loading && <p className="text-white/70 text-center py-10">Loading...</p>}
      
      {/* My Listings Tab */}
      {activeTab === 'listings' && !loading && (
        <div>
          {myListings.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/70">You haven't listed any NFTs for rental yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myListings.map((listing) => (
                <div 
                  key={listing.id}
                  className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10"
                >
                  <img 
                    src={listing.image} 
                    alt={`NFT #${listing.tokenId}`} 
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                  <h3 className="text-xl font-semibold text-white mb-1">{`NFT #${listing.tokenId}`}</h3>
                  <p className="text-white/60 mb-3">Listing ID: {listing.id}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-white/70">Price:</span>
                      <span className="text-white">{listing.rentalPrice} XPT/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Max Duration:</span>
                      <span className="text-white">{listing.maxDuration} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Status:</span>
                      <span className={
                        listing.status === 0 ? 'text-green-400' : 
                        listing.status === 1 ? 'text-yellow-400' : 
                        'text-red-400'
                      }>
                        {listing.statusText}
                      </span>
                    </div>
                    
                    {listing.renter && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-white/70">Renter:</span>
                          <span className="text-white">{`${listing.renter.substring(0, 6)}...${listing.renter.substring(38)}`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Start Date:</span>
                          <span className="text-white">{listing.rentStart}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">End Date:</span>
                          <span className="text-white">{listing.rentEnd}</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    {listing.status === 0 && (
                      <button 
                        onClick={() => handleCancelListing(listing.id)}
                        disabled={loading}
                        className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-white font-medium transition disabled:opacity-50"
                      >
                        Cancel Listing
                      </button>
                    )}
                    
                    {listing.status === 1 && listing.rentalId && (
                      <button 
                        onClick={() => handleEndRental(listing.rentalId)}
                        disabled={loading}
                        className="flex-1 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-lg text-white font-medium transition disabled:opacity-50"
                      >
                        End Rental
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* My Rentals Tab */}
      {activeTab === 'rentals' && !loading && (
        <div>
          {myRentals.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white/70">You haven't rented any NFTs yet.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myRentals.map((rental) => (
                <div 
                  key={rental.id}
                  className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10"
                >
                  <img 
                    src={rental.image} 
                    alt={`NFT #${rental.tokenId}`} 
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                  <h3 className="text-xl font-semibold text-white mb-1">{`NFT #${rental.tokenId}`}</h3>
                  <p className="text-white/60 mb-3">Rental ID: {rental.id}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-white/70">Price:</span>
                      <span className="text-white">{rental.rentalPrice} XPT/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Owner:</span>
                      <span className="text-white">{`${rental.owner.substring(0, 6)}...${rental.owner.substring(38)}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Start Date:</span>
                      <span className="text-white">{rental.rentStart}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">End Date:</span>
                      <span className="text-white">{rental.rentEnd}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/70">Status:</span>
                      <span className={`${rental.isActive ? 'text-green-400' : 'text-red-400'}`}>
                        {rental.isActive ? 'Active' : 'Expired'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManageNFT;
