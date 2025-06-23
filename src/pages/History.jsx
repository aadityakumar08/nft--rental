import { useState, useEffect, useContext, useCallback } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../context/WalletContext';
import RentalABI from "../utils/marketplace.json";
import NFTABI from "../utils/abi.json";
import { Clock, Package, ListPlus, Ban, Check } from 'lucide-react';

const CONTRACT_ADDRESS = import.meta.env.VITE_RENTAL_ADDRESS;
const NFT_CONTRACT = import.meta.env.VITE_NAME_CONTRACT;

const History = () => {
  const { walletAddress } = useContext(WalletContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, listings, rentals, etc.

  const fetchTransactionHistory = useCallback(async () => {
    if (!walletAddress) return;
    
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const rentalContract = new ethers.Contract(CONTRACT_ADDRESS, RentalABI.abi, provider);
      const nftContract = new ethers.Contract(NFT_CONTRACT, NFTABI.abi, provider);
      
      // Set the block range - last 10000 blocks should be enough for most scenarios
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last 10000 blocks
      
      // Array to store all transactions
      let allTransactions = [];

      try {
        // NFT Transfers TO the user (Receives)
        if (filter === 'all' || filter === 'mints') {
          const transferToEvents = await nftContract.queryFilter(
            nftContract.filters.Transfer(null, walletAddress, null), 
            fromBlock
          );
          
          for (const event of transferToEvents) {
            const block = await event.getBlock();
            allTransactions.push({
              id: `${event.transactionHash}-${event.logIndex}`,
              type: 'mint',
              title: 'NFT Received',
              tokenId: event.args.tokenId.toString(),
              from: event.args.from,
              to: event.args.to,
              timestamp: new Date(block.timestamp * 1000),
              transactionHash: event.transactionHash,
              status: 'completed'
            });
          }
        }
        
        // NFT Transfers FROM the user (Sends)
        if (filter === 'all' || filter === 'transfers') {
          const transferFromEvents = await nftContract.queryFilter(
            nftContract.filters.Transfer(walletAddress, null, null), 
            fromBlock
          );
          
          for (const event of transferFromEvents) {
            const block = await event.getBlock();
            allTransactions.push({
              id: `${event.transactionHash}-${event.logIndex}`,
              type: 'transfer',
              title: 'NFT Sent',
              tokenId: event.args.tokenId.toString(),
              from: event.args.from,
              to: event.args.to,
              timestamp: new Date(block.timestamp * 1000),
              transactionHash: event.transactionHash,
              status: 'completed'
            });
          }
        }
      } catch (err) {
        console.error('Error fetching NFT transfer events:', err);
      }
      
      try {
        // All listings events - we'll filter based on owner address
        if (filter === 'all' || filter === 'listings') {
          const allListingEvents = await rentalContract.queryFilter('NFTListed', fromBlock);
          
          for (const event of allListingEvents) {
            try {
              // Check if the user is the owner of this listing
              const lister = event.args.owner || event.args[3]; // Depending on how the event is structured
              
              if (lister && lister.toLowerCase() === walletAddress.toLowerCase()) {
                const block = await event.getBlock();
                allTransactions.push({
                  id: `${event.transactionHash}-${event.logIndex}`,
                  type: 'listing',
                  title: 'NFT Listed for Rental',
                  listingId: event.args.listingId.toString(),
                  nftContract: event.args.nftContract || event.args[0],
                  tokenId: event.args.tokenId.toString() || event.args[1].toString(),
                  pricePerDay: event.args.pricePerDay ? ethers.utils.formatEther(event.args.pricePerDay) : '0',
                  timestamp: new Date(block.timestamp * 1000),
                  transactionHash: event.transactionHash,
                  status: 'completed'
                });
              }
            } catch (err) {
              console.error('Error processing listing event:', err);
            }
          }
        }
        
        // All rental events - we'll filter based on renter address
        if (filter === 'all' || filter === 'rentals') {
          const allRentalEvents = await rentalContract.queryFilter('NFTRented', fromBlock);
          
          for (const event of allRentalEvents) {
            try {
              // Check if the user is the renter
              const renter = event.args.renter || event.args[2]; // Depending on how the event is structured
              
              if (renter && renter.toLowerCase() === walletAddress.toLowerCase()) {
                const block = await event.getBlock();
                
                let startTime, endTime, duration;
                try {
                  startTime = new Date(parseInt(event.args.startTime || event.args[3]) * 1000);
                  endTime = new Date(parseInt(event.args.endTime || event.args[4]) * 1000);
                  duration = Math.floor((endTime - startTime) / (1000 * 60 * 60 * 24)); // in days
                } catch (err) {
                  console.error('Error parsing rental dates:', err);
                  startTime = new Date();
                  endTime = new Date();
                  duration = 0;
                }
                
                allTransactions.push({
                  id: `${event.transactionHash}-${event.logIndex}`,
                  type: 'rental',
                  title: 'NFT Rented',
                  listingId: (event.args.listingId || event.args[0]).toString(),
                  rentalId: (event.args.rentalId || event.args[1]).toString(),
                  duration: duration,
                  totalPrice: event.args.totalPrice ? ethers.utils.formatEther(event.args.totalPrice) : '0',
                  startTime,
                  endTime,
                  timestamp: new Date(block.timestamp * 1000),
                  transactionHash: event.transactionHash,
                  status: 'completed'
                });
              }
            } catch (err) {
              console.error('Error processing rental event:', err);
            }
          }
        }
        
        // All listing cancellation events
        if (filter === 'all' || filter === 'cancellations') {
          const cancelEvents = await rentalContract.queryFilter('ListingCancelled', fromBlock);
          
          for (const event of cancelEvents) {
            try {
              const listingId = (event.args.listingId || event.args[0]).toString();
              
              // We need to verify this listing belonged to the user
              // First, try to get listing details directly from the event if possible
              let isUsersListing = false;
              
              try {
                // Try different ways to get the listing owner - depends on contract structure
                // 1. Check if the contract stores historical listings
                const listing = await rentalContract.functions.getListing(listingId).catch(() => null);
                if (listing && listing.length > 2) {
                  const ownerFromListing = listing[2].toLowerCase();
                  isUsersListing = ownerFromListing === walletAddress.toLowerCase();
                }
                
                // 2. If that fails, check if the cancellation event includes the owner
                if (!isUsersListing && event.args.owner) {
                  isUsersListing = event.args.owner.toLowerCase() === walletAddress.toLowerCase();
                }
                
                // 3. Otherwise, try to query past events to find the original listing
                if (!isUsersListing) {
                  const originalListingEvents = await rentalContract.queryFilter(
                    rentalContract.filters.NFTListed(null, null, null),
                    Math.max(0, fromBlock - 50000),
                    currentBlock
                  );
                  
                  const matchingListing = originalListingEvents.find(e => {
                    const eventListingId = (e.args.listingId || e.args[2]).toString();
                    return eventListingId === listingId;
                  });
                  
                  if (matchingListing) {
                    const lister = matchingListing.args.owner || matchingListing.args[3];
                    isUsersListing = lister.toLowerCase() === walletAddress.toLowerCase();
                  }
                }
              } catch (err) {
                console.error('Error verifying listing ownership:', err);
              }
              
              if (isUsersListing) {
                const block = await event.getBlock();
                allTransactions.push({
                  id: `${event.transactionHash}-${event.logIndex}`,
                  type: 'cancellation',
                  title: 'Listing Cancelled',
                  listingId,
                  timestamp: new Date(block.timestamp * 1000),
                  transactionHash: event.transactionHash,
                  status: 'completed'
                });
              }
            } catch (err) {
              console.error('Error processing cancellation event:', err);
            }
          }
        }
        
        // All rental ending events
        if (filter === 'all' || filter === 'endings') {
          const endEvents = await rentalContract.queryFilter('RentalEnded', fromBlock);
          
          for (const event of endEvents) {
            try {
              // We need to check if this rental was either:
              // 1. Rented by the user
              // 2. Listed by the user
              const rentalId = (event.args.rentalId || event.args[0]).toString();
              let isUserInvolved = false;
              let userRole = '';
              
              try {
                // Try to get rental details to check the renter
                const rental = await rentalContract.functions.getRental(rentalId).catch(() => null);
                
                if (rental && rental.length > 1) {
                  // Check if user is the renter
                  if (rental[1].toLowerCase() === walletAddress.toLowerCase()) {
                    isUserInvolved = true;
                    userRole = 'renter';
                  }
                  
                  // If not renter, check if user is the listing owner
                  if (!isUserInvolved) {
                    const listingId = rental[0].toString();
                    const listing = await rentalContract.functions.getListing(listingId).catch(() => null);
                    
                    if (listing && listing.length > 2 && listing[2].toLowerCase() === walletAddress.toLowerCase()) {
                      isUserInvolved = true;
                      userRole = 'owner';
                    }
                  }
                }
              } catch (err) {
                console.error('Error checking rental involvement:', err);
              }
              
              if (isUserInvolved) {
                const block = await event.getBlock();
                allTransactions.push({
                  id: `${event.transactionHash}-${event.logIndex}`,
                  type: 'rental-ended',
                  title: 'Rental Ended',
                  rentalId,
                  tokenId: event.args.tokenId ? event.args.tokenId.toString() : 'Unknown',
                  userRole,
                  timestamp: new Date(block.timestamp * 1000),
                  transactionHash: event.transactionHash,
                  status: 'completed'
                });
              }
            } catch (err) {
              console.error('Error processing rental ended event:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching marketplace events:', err);
      }
      
      // Sort transactions by timestamp (newest first)
      allTransactions.sort((a, b) => b.timestamp - a.timestamp);
      
      setTransactions(allTransactions);
    } catch (err) {
      console.error('Error fetching transaction history:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, filter]);

  useEffect(() => {
    if (walletAddress) {
      fetchTransactionHistory();
    }
  }, [walletAddress, filter, fetchTransactionHistory]);

  const formatDate = (date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(38)}`;
  };
  
  const getEventIcon = (type) => {
    switch (type) {
      case 'mint':
        return <Package className="text-green-400" size={20} />;
      case 'transfer':
        return <Package className="text-blue-400" size={20} />;
      case 'listing':
        return <ListPlus className="text-pink-400" size={20} />;
      case 'rental':
        return <Clock className="text-yellow-400" size={20} />;
      case 'cancellation':
        return <Ban className="text-red-400" size={20} />;
      case 'rental-ended':
        return <Check className="text-purple-400" size={20} />;
      default:
        return <Clock className="text-white" size={20} />;
    }
  };

  if (!walletAddress) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-white mb-8">📜 Transaction History</h1>
        <p className="text-white/70">Please connect your wallet to view your transaction history.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">📜 Transaction History</h1>
      
      {/* Filter controls */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10 mb-6">
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'all' ? 'bg-pink-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('mints')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'mints' ? 'bg-green-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            Mints/Receives
          </button>
          <button 
            onClick={() => setFilter('transfers')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'transfers' ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            Transfers
          </button>
          <button 
            onClick={() => setFilter('listings')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'listings' ? 'bg-pink-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            Listings
          </button>
          <button 
            onClick={() => setFilter('rentals')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'rentals' ? 'bg-yellow-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            Rentals
          </button>
          <button 
            onClick={() => setFilter('cancellations')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'cancellations' ? 'bg-red-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            Cancellations
          </button>
          <button 
            onClick={() => setFilter('endings')}
            className={`px-4 py-2 rounded-lg transition ${filter === 'endings' ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
          >
            Rental Endings
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-4"></div>
          <p className="text-white/70">Loading your transaction history...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-20 bg-white/5 backdrop-blur-lg rounded-xl border border-white/10">
          <p className="text-white/70">No transactions found for this filter.</p>
          <p className="text-white/50 text-sm mt-2">Try a different filter or make some transactions first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10 hover:bg-white/10 transition">
              <div className="flex items-start gap-4">
                <div className="bg-white/10 rounded-lg p-3">
                  {getEventIcon(tx.type)}
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-white">{tx.title}</h3>
                    <span className="text-white/60 text-sm">{formatDate(tx.timestamp)}</span>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    {tx.tokenId && (
                      <p className="text-white/80">Token ID: {tx.tokenId}</p>
                    )}
                    
                    {tx.listingId && (
                      <p className="text-white/80">Listing ID: {tx.listingId}</p>
                    )}
                    
                    {tx.rentalId && (
                      <p className="text-white/80">Rental ID: {tx.rentalId}</p>
                    )}
                    
                    {tx.from && (
                      <p className="text-white/80">From: {truncateAddress(tx.from)}</p>
                    )}
                    
                    {tx.to && (
                      <p className="text-white/80">To: {truncateAddress(tx.to)}</p>
                    )}
                    
                    {tx.pricePerDay && (
                      <p className="text-white/80">Price: {tx.pricePerDay} XPT/day</p>
                    )}
                    
                    {tx.totalPrice && (
                      <p className="text-white/80">Total Price: {tx.totalPrice} XPT</p>
                    )}
                    
                    {tx.duration && (
                      <p className="text-white/80">Duration: {tx.duration} days</p>
                    )}
                    
                    {tx.startTime && tx.endTime && (
                      <p className="text-white/80">
                        Period: {formatDate(tx.startTime)} to {formatDate(tx.endTime)}
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-3 flex justify-between items-center">
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${tx.transactionHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 text-sm"
                    >
                      View on Etherscan
                    </a>
                    
                    <span className={`px-2 py-1 rounded text-xs ${
                      tx.status === 'completed' ? 'bg-green-500/20 text-green-300' : 
                      tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
