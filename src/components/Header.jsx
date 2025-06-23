import { Link, useLocation } from "react-router-dom";
import { useContext, useEffect, useState } from "react";
import { WalletContext } from "../context/WalletContext";
import { Wallet, Menu, Home, ListPlus, LayoutGrid, Package, History } from "lucide-react";
import Logo from "../assets/logo.png";

const Header = () => {
  const { walletAddress, connectWallet, network, switchNetwork } =
    useContext(WalletContext);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const truncateAddress = (address) => {
    if (!address) return "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  useEffect(() => {
    if (network === "XPhere-Testnet") {
      setIsCorrectNetwork(true);
    } else {
      setIsCorrectNetwork(false);
    }
  }, [network]);

  return (
    <nav className="px-4 md:px-24 h-20 md:h-24 flex items-center justify-between bg-white/5 backdrop-blur-lg border-b border-white/10">
      <Link to="/" className="flex items-center gap-2 group">
        <div className="relative w-8 h-8 md:w-14 md:h-14 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-md md:rounded-xl md:p-2 transition-all duration-300 group-hover:scale-105">
          <img
            src={Logo}
            alt="Vibe Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-xl md:text-3xl font-bold">
          <span className="text-white">NFT Rental</span>
        </h1>
      </Link>

      {walletAddress && isCorrectNetwork && (
        <div className="hidden md:flex items-center gap-8">
          <Link 
            to="/" 
            className={`flex items-center gap-2 transition-colors ${location.pathname === '/' ? 'text-pink-500 font-medium' : 'text-white hover:text-pink-500'}`}
          >
            <Home size={18} />
            Home
          </Link>
          <Link 
            to="/explore" 
            className={`flex items-center gap-2 transition-colors ${location.pathname === '/explore' ? 'text-pink-500 font-medium' : 'text-white hover:text-pink-500'}`}
          >
            <Package size={18} />
            Explore Rentals
          </Link>
          <Link 
            to="/list-nft" 
            className={`flex items-center gap-2 transition-colors ${location.pathname === '/list-nft' ? 'text-pink-500 font-medium' : 'text-white hover:text-pink-500'}`}
          >
            <ListPlus size={18} />
            List NFT
          </Link>
          <Link 
            to="/manage-nft" 
            className={`flex items-center gap-2 transition-colors ${location.pathname === '/manage-nft' ? 'text-pink-500 font-medium' : 'text-white hover:text-pink-500'}`}
          >
            <LayoutGrid size={18} />
            My Rentals
          </Link>
          <Link 
            to="/history" 
            className={`flex items-center gap-2 transition-colors ${location.pathname === '/history' ? 'text-pink-500 font-medium' : 'text-white hover:text-pink-500'}`}
          >
            <History size={18} />
            History
          </Link>
        </div>
      )}

      <div className="flex items-center gap-4">
        {!walletAddress ? (
          <button
            onClick={connectWallet}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl text-white font-medium hover:opacity-90 transition-all duration-300"
          >
            <Wallet size={20} />
            Connect Wallet
          </button>
        ) : !isCorrectNetwork ? (
          <button
            onClick={switchNetwork}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white font-medium hover:opacity-90 transition-all duration-300"
          >
            Switch Network
          </button>
        ) : (
          <div className="px-4 py-2 bg-white/10 rounded-xl text-white">
            {truncateAddress(walletAddress)}
          </div>
        )}

        <button
          className="md:hidden text-white"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && walletAddress && isCorrectNetwork && (
        <div className="md:hidden absolute top-20 right-4 w-56 py-2 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 z-50">
          <Link
            to="/"
            className={`flex items-center gap-2 px-4 py-2 hover:bg-white/10 ${location.pathname === '/' ? 'text-pink-500' : 'text-white'}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <Home size={18} />
            Home
          </Link>
          <Link
            to="/explore"
            className={`flex items-center gap-2 px-4 py-2 hover:bg-white/10 ${location.pathname === '/explore' ? 'text-pink-500' : 'text-white'}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <Package size={18} />
            Explore Rentals
          </Link>
          <Link
            to="/list-nft"
            className={`flex items-center gap-2 px-4 py-2 hover:bg-white/10 ${location.pathname === '/list-nft' ? 'text-pink-500' : 'text-white'}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <ListPlus size={18} />
            List NFT
          </Link>
          <Link
            to="/manage-nft"
            className={`flex items-center gap-2 px-4 py-2 hover:bg-white/10 ${location.pathname === '/manage-nft' ? 'text-pink-500' : 'text-white'}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <LayoutGrid size={18} />
            My Rentals
          </Link>
          <Link
            to="/history"
            className={`flex items-center gap-2 px-4 py-2 hover:bg-white/10 ${location.pathname === '/history' ? 'text-pink-500' : 'text-white'}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <History size={18} />
            History
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Header;
