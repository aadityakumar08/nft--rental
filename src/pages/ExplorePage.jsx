import { useEffect, useState, useContext } from "react";
import { ethers } from "ethers";
import { WalletContext } from '../context/WalletContext';
import RentalABI from "../utils/marketplace.json";
import NFTABI from "../utils/abi.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_RENTAL_ADDRESS;
const NFT_CONTRACT = import.meta.env.VITE_NAME_CONTRACT;

const ExploreListing = () => {
  const { walletAddress } = useContext(WalletContext);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rentDuration, setRentDuration] = useState({});
  const [isRenting, setIsRenting] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [status, setStatus] = useState("");

  const fetchListings = async () => {
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const rentalContract = new ethers.Contract(CONTRACT_ADDRESS, RentalABI.abi, provider);
      const nftContract = new ethers.Contract(NFT_CONTRACT, NFTABI.abi, provider);

      // Get listing counter to know how many listings to check
      const listingCount = await rentalContract.listingCounter();
      const listingData = [];
      
      console.log(`Found ${listingCount} total listings`);
      
      // Iterate through all listings and filter active ones
      for (let i = 0; i < listingCount.toNumber(); i++) {
        try {
          const listing = await rentalContract.getListing(i);
          
          // Check if listing is available (status 0 = Active)
          // The status is at index 5 in the listing struct and is a uint8 enum
          if (listing[5] === 0) { // 0 = Active (Available), 1 = Rented, 2 = Inactive
            // Try to get additional NFT data
            let tokenURI = "";
            let tokenName = `NFT #${listing[1].toString()}`;
            
            try {
              tokenURI = await nftContract.tokenURI(listing[1]);
              // If we could load the URI, we can also try to load metadata
              // In a production app, you'd fetch the actual metadata from tokenURI
            } catch (uriError) {
              console.log(`Could not get token URI for NFT ${listing[1]}:`, uriError);
            }
            
            // For display in the UI, we'll get a placeholder image
            const imageUrl = `https://picsum.photos/seed/${i}/400/300`;
            
            // Check if it's already rented via isRented method
            const [isCurrentlyRented, rentalId] = await rentalContract.isRented(listing[0], listing[1]);
            
            listingData.push({
              id: i,
              nftContract: listing[0],
              tokenId: listing[1].toString(),
              rentalPrice: ethers.utils.formatEther(listing[3]),  // pricePerDay is at index 3
              owner: listing[2],                                  // owner is at index 2
              maxDuration: Math.floor(listing[4].toNumber()),    // maxDuration is at index 4 (already in days)
              status: listing[5],                                // Status enum (0=Available, 1=Rented, 2=Inactive)
              isRented: isCurrentlyRented,
              rentalId: rentalId.toNumber() > 0 ? rentalId.toNumber() : null,
              image: imageUrl,
              name: tokenName,
              tokenURI,
              description: `This is a unique NFT token available for rental.`
            });
          }
        } catch (err) {
          console.error(`Error fetching listing ${i}:`, err);
          continue;
        }
      }

      setListings(listingData);
      console.log('Available listings:', listingData);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch listings:", err);
      setStatus("Error: " + (err.reason || err.message));
      setLoading(false);
    }
  };
  
  const handleRentNFT = async (listingId) => {
    if (!walletAddress) {
      setStatus("Please connect your wallet first");
      return;
    }
    
    if (!rentDuration[listingId] || rentDuration[listingId] <= 0) {
      setStatus("Please select a valid rental duration");
      return;
    }
    
    const listing = listings.find(item => item.id === listingId);
    if (!listing) {
      setStatus("Listing not found");
      return;
    }
    
    if (parseInt(rentDuration[listingId]) > listing.maxDuration) {
      setStatus(`Maximum rental duration is ${listing.maxDuration} days`);
      return;
    }
    
    try {
      setIsRenting(true);
      setCurrentTransaction(listingId);
      setStatus("Initiating rental transaction...");
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const rentalContract = new ethers.Contract(CONTRACT_ADDRESS, RentalABI.abi, signer);
      
      // Calculate rental price in wei
      const durationInDays = parseInt(rentDuration[listingId]);
      const pricePerDay = ethers.utils.parseEther(listing.rentalPrice);
      const totalPrice = pricePerDay.mul(durationInDays);
      
      console.log('Renting NFT:', {
        listingId,
        durationInDays,
        pricePerDay: pricePerDay.toString(),
        totalPrice: totalPrice.toString()
      });
      
      // Call the rent function with the required payment
      // In the new contract it's rentNFT(_listingId, _durationInDays)
      const tx = await rentalContract.rentNFT(listingId, durationInDays, { 
        value: totalPrice,
        gasLimit: 500000 // Adding explicit gas limit to avoid estimation errors
      });
      
      setStatus("Confirming transaction...");
      await tx.wait();
      
      // Clear the rent duration for this listing
      const newRentDuration = { ...rentDuration };
      delete newRentDuration[listingId];
      setRentDuration(newRentDuration);
      
      setStatus("NFT rented successfully! 🎉");
      
      // Refresh listings
      fetchListings();
    } catch (err) {
      console.error("Failed to rent NFT:", err);
      setStatus("Error: " + (err.reason || err.message));
    } finally {
      setIsRenting(false);
      setCurrentTransaction(null);
    }
  };
  
  const handleDurationChange = (listingId, value) => {
    setRentDuration(prev => ({
      ...prev,
      [listingId]: value
    }));
  };

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    // Clear status message after 5 seconds
    if (status) {
      const timer = setTimeout(() => {
        setStatus("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (loading) {
    return <div className="text-white text-center mt-20">Loading listings...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">📦 Explore NFT Rentals</h1>
      
      {status && (
        <div className={`${status.includes('Error') ? 'bg-red-500/20 border-red-500/50' : 'bg-green-500/20 border-green-500/50'} border text-white p-4 rounded-lg mb-6 text-center`}>
          {status}
        </div>
      )}
      
      {listings.length === 0 ? (
        <p className="text-white/70 text-center">No active listings found.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20"
            >
              <img
                src={listing.image}
                alt={listing.name}
                className="rounded-lg w-full h-56 object-cover mb-4"
              />
              <h2 className="text-xl font-semibold text-white">{listing.name}</h2>
              <p className="text-white/70 text-sm mb-2">{listing.description}</p>
              <div className="flex justify-between items-center mb-2">
                <p className="text-white/80">💰 {listing.rentalPrice} XPT/day</p>
                <p className="text-white/60 text-sm">⏱ Max: {Math.floor(listing.maxDuration / 86400)} Days</p>
              </div>
              
              {listing.isRented ? (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-2 text-center text-white mb-2">
                  Currently Rented
                  {listing.rentalId && (
                    <div className="text-xs mt-1">Rental ID: {listing.rentalId}</div>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input 
                      type="number" 
                      min="1" 
                      max={listing.maxDuration}
                      value={rentDuration[listing.id] || ""}
                      onChange={(e) => handleDurationChange(listing.id, e.target.value)}
                      placeholder="Days to rent"
                      className="flex-1 px-3 py-2 bg-white/10 rounded-lg text-white"
                    />
                    <span className="text-white/60">days</span>
                  </div>
                  
                  <button 
                    onClick={() => handleRentNFT(listing.id)}
                    disabled={isRenting || !rentDuration[listing.id]}
                    className="w-full py-2 bg-gradient-to-r from-pink-500 to-red-500 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRenting && currentTransaction === listing.id ? "Processing..." : "Rent Now"}
                  </button>
                </div>
              )}
              
              <div className="mt-2 text-white/50 text-xs">
                <p>Owner: {`${listing.owner.substring(0, 6)}...${listing.owner.substring(38)}`}</p>
                <p>Token ID: {listing.tokenId}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExploreListing;
