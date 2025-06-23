import { useState, useContext, useEffect } from 'react';
import { ethers } from 'ethers';
import { WalletContext } from '../context/WalletContext';
import RentalABI from "../utils/marketplace.json";
import NFTABI from "../utils/abi.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_RENTAL_ADDRESS;
const NFT_CONTRACT = import.meta.env.VITE_NAME_CONTRACT;

export default function ListNFTPage() {
  const { walletAddress } = useContext(WalletContext);
  const [nftAddress, setNftAddress] = useState(NFT_CONTRACT);
  const [tokenId, setTokenId] = useState('');
  const [price, setPrice] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [mintTokenURI, setMintTokenURI] = useState('https://example.com/metadata/1.json');

  useEffect(() => {
    if (walletAddress) {
      fetchOwnedNFTs();
    }
  }, [walletAddress]);

  const fetchOwnedNFTs = async () => {
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const nftContract = new ethers.Contract(NFT_CONTRACT, NFTABI.abi, provider);
      
      // This is a simplified approach. In a real app, you'd need to query for NFT ownership
      // based on the specific contract's implementation
      const ownedTokens = [];
      
      // For demonstration, let's check tokens 1-20
      for (let i = 1; i <= 20; i++) {
        try {
          const owner = await nftContract.ownerOf(i);
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            // Try to get token URI if available
            let tokenURI = '';
            try {
              tokenURI = await nftContract.tokenURI(i);
            } catch (uriError) {
              console.log('Could not fetch token URI for token', i);
            }
            
            ownedTokens.push({
              id: i,
              name: `NFT #${i}`,
              image: `https://picsum.photos/seed/${i}/200/200`, // Placeholder image
              tokenURI
            });
          }
        } catch (err) {
          // Token might not exist, continue to next one
          continue;
        }
      }
      
      setOwnedNFTs(ownedTokens);
      console.log('Found owned NFTs:', ownedTokens);
    } catch (err) {
      console.error("Error fetching owned NFTs:", err);
      setStatus('Error fetching NFTs: ' + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  const mintTestNFT = async () => {
    if (!window.ethereum) return alert('MetaMask not found');
    if (!mintTokenURI) {
      setStatus('Please provide a token URI');
      return;
    }

    try {
      setLoading(true);
      setStatus('Initiating NFT minting...');
      
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const nftContract = new ethers.Contract(NFT_CONTRACT, NFTABI.abi, signer);
      
      // Get mint price
      const mintPrice = await nftContract.mintPrice();
      console.log('Mint price:', ethers.utils.formatEther(mintPrice), 'ETH');
      
      // Mint the NFT
      setStatus('Minting your NFT...');
      const mintTx = await nftContract.mint(mintTokenURI, {
        value: mintPrice
      });
      
      setStatus('Confirming transaction...');
      const receipt = await mintTx.wait();
      
      // Try to extract token ID from the event logs
      let tokenId = null;
      if (receipt && receipt.events) {
        const transferEvent = receipt.events.find(e => e.event === 'Transfer');
        if (transferEvent && transferEvent.args) {
          tokenId = transferEvent.args.tokenId?.toString() || null;
        }
      }
      
      setStatus(`NFT minted successfully${tokenId ? ` with Token ID: ${tokenId}` : ''}!`);
      
      // Refresh the list of owned NFTs
      await fetchOwnedNFTs();
      
    } catch (err) {
      console.error('Error minting NFT:', err);
      setStatus('Error minting NFT: ' + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectNFT = (nft) => {
    setSelectedNFT(nft);
    setTokenId(nft.id.toString());
  };

  const handleListNFT = async () => {
    if (!window.ethereum) return alert('MetaMask not found');
    if (!nftAddress || !tokenId || !price || !maxDuration) {
      setStatus('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      
      setStatus('Checking NFT ownership...');
      // Check if token exists and user owns it
      try {
        const nftContract = new ethers.Contract(nftAddress, NFTABI.abi, signer);
        
        // First check if token exists by trying to get its URI
        try {
          await nftContract.tokenURI(tokenId);
        } catch (tokenError) {
          setStatus('Error: This token does not exist. You may need to mint it first.');
          console.error("Token doesn't exist:", tokenError);
          setLoading(false);
          return;
        }
        
        // Check ownership
        const owner = await nftContract.ownerOf(tokenId);
        
        // Verify ownership
        if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
          setStatus('Error: You do not own this NFT');
          setLoading(false);
          return;
        }
        
        // Now check and set approval
        setStatus('Checking approval status...');
        const isApproved = await nftContract.isApprovedForAll(walletAddress, CONTRACT_ADDRESS);
        const individualApproval = await nftContract.getApproved(tokenId);
        
        console.log('Approval status:', {
          isApprovedForAll: isApproved,
          individualApproval,
          marketplaceAddress: CONTRACT_ADDRESS
        });
        
        if (!isApproved && individualApproval.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) {
          setStatus('Approving marketplace to transfer NFTs...');
          try {
            // Try individual token approval first
            const approveTx = await nftContract.approve(CONTRACT_ADDRESS, tokenId);
            setStatus('Confirming approval transaction...');
            await approveTx.wait();
            setStatus('Approval confirmed. Proceeding with listing...');
          } catch (approvalError) {
            console.error('Individual approval error:', approvalError);
            
            // If individual approval fails, try setApprovalForAll
            try {
              setStatus('Trying global approval for all NFTs...');
              const approveAllTx = await nftContract.setApprovalForAll(CONTRACT_ADDRESS, true);
              await approveAllTx.wait();
              setStatus('Global approval successful. Proceeding with listing...');
            } catch (globalApprovalError) {
              console.error('Global approval error:', globalApprovalError);
              setStatus('Error during approval: ' + (globalApprovalError.reason || globalApprovalError.message));
              setLoading(false);
              return;
            }
          }
        }
      } catch (nftError) {
        console.error('NFT contract error:', nftError);
        setStatus('Error with NFT contract: ' + (nftError.reason || nftError.message));
        setLoading(false);
        return;
      }

      // Now list the NFT for rental
      try {
        setStatus('Listing NFT for rental...');
        const marketplace = new ethers.Contract(CONTRACT_ADDRESS, RentalABI.abi, signer);
        
        console.log('Listing parameters:', {
          nftAddress,
          tokenId: tokenId.toString(),
          price,
          priceInWei: ethers.utils.parseEther(price).toString(),
          maxDuration,
          durationInSeconds: parseInt(maxDuration) * 24 * 60 * 60,
          contractAddress: CONTRACT_ADDRESS
        });
        
        const priceInWei = ethers.utils.parseEther(price);
        const durationInSeconds = parseInt(maxDuration) * 24 * 60 * 60; // Convert days to seconds
        
        // Set gas limit explicitly to avoid estimation errors
        const gasLimit = 500000; // Adjust this value as needed
        
        const tx = await marketplace.listNFT(
          nftAddress, 
          tokenId, 
          priceInWei, 
          durationInSeconds,
          { gasLimit }
        );
        
        setStatus('Confirming transaction...');
        await tx.wait();
        setSelectedNFT(null);
        setTokenId('');
        setPrice('');
        setMaxDuration('');
        setStatus('NFT listed successfully!');
      } catch (marketplaceError) {
        console.error('Marketplace error:', marketplaceError);
        // Check for more detailed error information
        if (marketplaceError.error && marketplaceError.error.message) {
          setStatus('Error: ' + marketplaceError.error.message);
        } else {
          setStatus('Error listing NFT: ' + (marketplaceError.reason || marketplaceError.message));
        }
      }
    } catch (err) {
      console.error('General error:', err);
      setStatus('Error: ' + (err.reason || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!walletAddress) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-white mb-8">🎭 List Your NFT for Rental</h1>
        <p className="text-white/70">Please connect your wallet to list NFTs for rental.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">🎭 List Your NFT for Rental</h1>
      
      {status && (
        <div className={`${status.includes('Error') ? 'bg-red-500/20 border-red-500/50' : 'bg-green-500/20 border-green-500/50'} border text-white p-4 rounded-lg mb-6`}>
          {status}
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-8">
        {/* NFT Selection */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">1. Select Your NFT</h2>
          
          {loading && !ownedNFTs.length && <p className="text-white/70">Loading your NFTs...</p>}
          
          {!loading && ownedNFTs.length === 0 && (
            <div>
              <p className="text-white/70 mb-4">You don't own any NFTs that can be listed.</p>
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-medium text-white">Mint a Test NFT</h3>
                <div className="mb-4">
                  <label className="block text-white/80 mb-2">Token URI (Metadata URL)</label>
                  <input 
                    type="text" 
                    value={mintTokenURI}
                    onChange={(e) => setMintTokenURI(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 rounded-lg text-white"
                    placeholder="https://example.com/metadata/1.json"
                  />
                </div>
                <button 
                  onClick={mintTestNFT}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Mint Test NFT"}
                </button>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            {ownedNFTs.map((nft) => (
              <div 
                key={nft.id}
                className={`p-3 rounded-lg cursor-pointer transition-all ${selectedNFT?.id === nft.id ? 
                  'bg-gradient-to-r from-pink-500/30 to-red-500/30 border-2 border-pink-500' : 
                  'bg-white/10 border border-white/20 hover:bg-white/20'}`}
                onClick={() => handleSelectNFT(nft)}
              >
                <img 
                  src={nft.image} 
                  alt={nft.name} 
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
                <p className="text-white font-medium">{nft.name}</p>
                <p className="text-white/60 text-sm">Token ID: {nft.id}</p>
              </div>
            ))}
          </div>
          
          {ownedNFTs.length > 0 && (
            <div className="mt-6">
              <button 
                onClick={mintTestNFT}
                disabled={loading}
                className="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Mint Another NFT"}
              </button>
            </div>
          )}
        </div>
        
        {/* Rental Form */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">2. Set Rental Terms</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-white/80 mb-2">NFT Contract Address</label>
              <input 
                type="text" 
                value={nftAddress}
                onChange={(e) => setNftAddress(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 rounded-lg text-white"
                placeholder="0x..."
                disabled
              />
            </div>
            
            <div>
              <label className="block text-white/80 mb-2">Token ID</label>
              <input 
                type="text" 
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 rounded-lg text-white"
                placeholder="1"
                disabled={selectedNFT !== null}
              />
            </div>
            
            <div>
              <label className="block text-white/80 mb-2">Rental Price (XPT per day)</label>
              <input 
                type="text" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 rounded-lg text-white"
                placeholder="0.1"
              />
            </div>
            
            <div>
              <label className="block text-white/80 mb-2">Maximum Rental Duration (days)</label>
              <input 
                type="number" 
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                className="w-full px-4 py-2 bg-white/10 rounded-lg text-white"
                placeholder="7"
                min="1"
              />
            </div>
            
            <button 
              onClick={handleListNFT}
              disabled={loading || (!selectedNFT && !tokenId)}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-red-500 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? "Processing..." : "List NFT for Rental"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
