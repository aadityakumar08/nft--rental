import { useContext, useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { WalletContext } from "../context/WalletContext";
import abi from "../utils/abi.json";
import { Loader2, Wallet2, CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp } from "lucide-react";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const contractAddress = import.meta.env.VITE_SMARTCARD_CONTRACT;

const Dashboard = () => {
  const { walletAddress, connectWallet, network } = useContext(WalletContext);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalCards: 0,
    totalBalance: 0,
    totalSpent: 0,
    activeCards: 0,
    totalTransactions: 0,
    spendingLimit: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [cards, setCards] = useState([]);
  const [cardActivity, setCardActivity] = useState([]);

  const processCardActivity = (transactions) => {
    const cardUsage = {};
    const cardSpent = {};
    
    for (const event of transactions) {
      const cardId = event.args.cardId?.toString();
      if (cardId) {
        // Track transaction count
        cardUsage[cardId] = (cardUsage[cardId] || 0) + 1;
        
        // Track spent amounts
        if (event.event === 'CardSpent') {
          const amount = event.args.amount || ethers.BigNumber.from(0);
          if (!cardSpent[cardId]) {
            cardSpent[cardId] = ethers.BigNumber.from(0);
          }
          cardSpent[cardId] = cardSpent[cardId].add(amount);
        }
      }
    }
  
    // Convert to array and sort by usage
    return Object.entries(cardUsage)
      .map(([cardId, count]) => ({
        cardId,
        transactions: count,
        spent: cardSpent[cardId] ? 
          parseFloat(ethers.utils.formatEther(cardSpent[cardId])) : 0
      }))
      .sort((a, b) => b.transactions - a.transactions);
  };

  const fetchData = useCallback(async () => {
    if (!walletAddress) return;
    
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, abi.abi, provider);

      // Fetch cards
      const fetchedCards = [];
      let i = 0;
      let totalBalance = ethers.BigNumber.from(0);
      let totalSpent = ethers.BigNumber.from(0);
      let totalLimit = ethers.BigNumber.from(0);
      let activeCards = 0;

      while (true) {
        try {
          const card = await contract.getCardInfo(i);
          if (card.owner.toLowerCase() === walletAddress.toLowerCase()) {
            fetchedCards.push({
              id: i,
              balance: card.balance,
              spendingLimit: card.limit,
              amountSpent: card.spent,
              isActive: card.active,
            });

            totalBalance = totalBalance.add(card.balance);
            totalSpent = totalSpent.add(card.spent);
            totalLimit = totalLimit.add(card.limit);
            if (card.active) activeCards++;
          }
          i++;
          if (i > 1000) break;
        } catch (err) {
          break;
        }
      }

      // Fetch recent transactions
      const filter = {
        fromBlock: 0,
        toBlock: "latest",
        address: contractAddress,
      };

      const events = await Promise.all([
        contract.queryFilter(contract.filters.CardCreated(), filter.fromBlock, filter.toBlock),
        contract.queryFilter(contract.filters.CardDeposited(), filter.fromBlock, filter.toBlock),
        contract.queryFilter(contract.filters.CardWithdrawn(), filter.fromBlock, filter.toBlock),
        contract.queryFilter(contract.filters.CardSpent(), filter.fromBlock, filter.toBlock)
      ]);

      const allEvents = events.flat();
      
      // Get timestamps and filter user's transactions
      const userTransactions = [];
      for (const event of allEvents) {
        const block = await provider.getBlock(event.blockNumber);
        const owner = event.args.owner || event.args.from;
        if (owner && owner.toLowerCase() === walletAddress.toLowerCase()) {
          userTransactions.push({
            ...event,
            timestamp: block.timestamp * 1000,
          });
        }
      }

      // Sort by timestamp
      userTransactions.sort((a, b) => b.timestamp - a.timestamp);

      // Calculate card activity with both transaction history and card info
      const activity = processCardActivity(userTransactions);
      
      // Update activity with current card spent amounts
      const updatedActivity = activity.map(card => {
        const matchingCard = fetchedCards.find(fc => fc.id.toString() === card.cardId);
        if (matchingCard) {
          const currentSpent = parseFloat(ethers.utils.formatEther(matchingCard.amountSpent));
          return {
            ...card,
            spent: currentSpent
          };
        }
        return card;
      });

      setCardActivity(updatedActivity);
      setCards(fetchedCards);
      setTransactions(userTransactions);
      setStats({
        totalCards: fetchedCards.length,
        totalBalance: parseFloat(ethers.utils.formatEther(totalBalance)),
        totalSpent: parseFloat(ethers.utils.formatEther(totalSpent)),
        activeCards,
        totalTransactions: userTransactions.length,
        spendingLimit: parseFloat(ethers.utils.formatEther(totalLimit)),
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getChartData = () => {
    // Group transactions by date
    const dailyVolume = {};
    transactions.forEach(tx => {
      const date = new Date(tx.timestamp).toLocaleDateString();
      const amount = tx.args.amount ? parseFloat(ethers.utils.formatEther(tx.args.amount)) : 0;
      dailyVolume[date] = (dailyVolume[date] || 0) + amount;
    });

    const dates = Object.keys(dailyVolume).slice(-7); // Last 7 days
    const values = dates.map(date => dailyVolume[date]);

    return {
      labels: dates,
      datasets: [
        {
          label: "Transaction Volume (XPT)",
          data: values,
          borderColor: "rgb(219, 39, 119)",
          backgroundColor: "rgba(219, 39, 119, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };

  const getDistributionData = () => {
    return {
      labels: ["Active Balance", "Amount Spent"],
      datasets: [
        {
          data: [stats.totalBalance, stats.totalSpent],
          backgroundColor: [
            "rgba(34, 197, 94, 0.8)",
            "rgba(219, 39, 119, 0.8)",
          ],
          borderColor: [
            "rgb(34, 197, 94)",
            "rgb(219, 39, 119)",
          ],
          borderWidth: 1,
        },
      ],
    };
  };

  if (!walletAddress) {
    return (
      <div className="container mx-auto px-4 py-10 md:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">
            Smart Card Dashboard
          </h1>
          <button
            onClick={connectWallet}
            className="flex items-center gap-2 px-6 py-3 mx-auto bg-gradient-to-r from-red-500 to-pink-500 rounded-xl text-white font-medium hover:opacity-90 transition-all duration-300"
          >
            <Wallet2 size={20} />
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (network !== "XPhere-Testnet") {
    return (
      <div className="container mx-auto px-4 py-10 md:py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Wrong Network
          </h1>
          <p className="text-white mb-8">
            Please switch to the XPhere-Testnet network to view dashboard
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 md:py-16">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Smart Card Dashboard
          </h1>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-white hover:bg-white/20 transition-colors"
          >
            <Loader2 className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
            <p className="text-white mt-4">Loading dashboard data...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-red-200 text-sm">Total Cards</p>
                    <h3 className="text-2xl font-bold text-white">{stats.totalCards}</h3>
                  </div>
                  <div className="bg-pink-500/20 p-3 rounded-xl">
                    <CreditCard className="w-6 h-6 text-pink-500" />
                  </div>
                </div>
                <p className="text-white/70 text-sm">
                  {stats.activeCards} active cards
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-red-200 text-sm">Total Balance</p>
                    <h3 className="text-2xl font-bold text-white">{stats.totalBalance.toFixed(2)} XPT</h3>
                  </div>
                  <div className="bg-green-500/20 p-3 rounded-xl">
                    <Wallet2 className="w-6 h-6 text-green-500" />
                  </div>
                </div>
                <p className="text-white/70 text-sm">
                  Across all cards
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-red-200 text-sm">Total Transactions</p>
                    <h3 className="text-2xl font-bold text-white">{stats.totalTransactions}</h3>
                  </div>
                  <div className="bg-purple-500/20 p-3 rounded-xl">
                    <TrendingUp className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
                <p className="text-white/70 text-sm">
                  Last 24 hours
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-red-200 text-sm">Total Amount Spent</p>
                    <h3 className="text-2xl font-bold text-white">{stats.totalSpent.toFixed(2)} XPT</h3>
                  </div>
                  <div className="bg-red-500/20 p-3 rounded-xl">
                    <ArrowUpRight className="w-6 h-6 text-red-500" />
                  </div>
                </div>
                <p className="text-white/70 text-sm">
                  {((stats.totalSpent / (stats.totalSpent + stats.totalBalance)) * 100).toFixed(1)}% of total funds
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-3 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">Transaction Volume</h3>
                {transactions.length > 0 ? (
                  <Line
                    data={getChartData()}
                    options={{
                      responsive: true,
                      scales: {
                        y: {
                          ticks: { color: "rgba(255, 255, 255, 0.7)" },
                          grid: { color: "rgba(255, 255, 255, 0.1)" },
                        },
                        x: {
                          ticks: { color: "rgba(255, 255, 255, 0.7)" },
                          grid: { color: "rgba(255, 255, 255, 0.1)" },
                        },
                      },
                      plugins: {
                        legend: {
                          labels: { color: "rgba(255, 255, 255, 0.7)" },
                        },
                      },
                    }}
                  />
                ) : (
                  <p className="text-white/70 text-center py-12">No transaction data available</p>
                )}
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">Most Active Cards</h3>
                <div className="space-y-4">
                  {cardActivity.slice(0, 5).map((card) => (
                    <div 
                      key={card.cardId}
                      className="bg-white/5 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-medium">Card #{card.cardId}</h4>
                        <span className="text-sm text-white/70">{card.transactions} transactions</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-red-500 to-pink-500 h-2 rounded-full"
                          style={{
                            width: `${(card.transactions / cardActivity[0]?.transactions * 100) || 0}%`
                          }}
                        />
                      </div>
                      <p className="text-sm text-white/70 mt-2">
                        {card.spent.toFixed(2)} XPT spent
                      </p>
                    </div>
                  ))}
                  {cardActivity.length === 0 && (
                    <p className="text-white/70 text-center py-8">
                      No card activity yet
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4">Balance Distribution</h3>
                <div className="aspect-square relative">
                  <Doughnut
                    data={getDistributionData()}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "bottom",
                          labels: { color: "rgba(255, 255, 255, 0.7)" },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
              <div className="space-y-4">
                {transactions.slice(0, 5).map((tx) => {
                  const amount = tx.args.amount ? 
                    parseFloat(ethers.utils.formatEther(tx.args.amount)).toFixed(2) : "0";
                  const isDeposit = tx.event === "CardDeposited";
                  
                  return (
                    <div 
                      key={`${tx.blockNumber}-${tx.logIndex}`}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          isDeposit ? "bg-green-500/20" : "bg-pink-500/20"
                        }`}>
                          {isDeposit ? (
                            <ArrowDownLeft className={`w-5 h-5 ${
                              isDeposit ? "text-green-500" : "text-pink-500"
                            }`} />
                          ) : (
                            <ArrowUpRight className={`w-5 h-5 ${
                              isDeposit ? "text-green-500" : "text-pink-500"
                            }`} />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-medium">{tx.event}</p>
                          <p className="text-sm text-white/70">
                            Card #{tx.args.cardId?.toString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium ${
                          isDeposit ? "text-green-400" : "text-pink-400"
                        }`}>
                          {isDeposit ? "+" : "-"}{amount} XPT
                        </p>
                        <p className="text-sm text-white/70">
                          {new Date(tx.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
