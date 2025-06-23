import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import WalletProvider from "./context/WalletContext";

const Layout = lazy(() => import("./components/Layout"));
const Home = lazy(() => import("./pages/Home"));
import LoadingSpinner from "./components/LoadingSpinner";

// Import all pages needed for the application
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ListNFTPage = lazy(() => import("./pages/ListNFTPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const ManageNFT = lazy(() => import("./pages/ManageNFT"));
const History = lazy(() => import("./pages/History"));

const App = () => {
  return (
    <WalletProvider>
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route element={<Layout />}>
              {/* Home page */}
              <Route path="/" element={<Home />} />
              
              {/* Main navigation from header */}
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/list-nft" element={<ListNFTPage />} />
              <Route path="/manage-nft" element={<ManageNFT />} />
              <Route path="/history" element={<History />} />
              
              {/* Legacy routes - redirect or keep as needed */}
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </WalletProvider>
  );
};

export default App;
