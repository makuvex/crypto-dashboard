import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, RefreshCcw, Search, Coins, X, ExternalLink, Globe } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';
import './App.css';

interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  sparkline_in_7d: {
    price: number[];
  };
  analysis?: {
    action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    label: string;
    reason: string;
    color: string;
  };
}

interface IndexData {
  id: string;
  name: string;
  symbol: string;
  currency: string;
  current_price: number;
  change_percent: number;
  sparkline: number[];
  analysis?: {
    action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    label: string;
    reason: string;
    color: string;
  };
}

interface HistoryData {
  date: string;
  price: number;
}

function App() {
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCoin, setSelectedCoin] = useState<CoinData | null>(null);
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pricesRes, indicesRes] = await Promise.all([
        axios.get(`${API_URL}/api/prices`),
        axios.get(`${API_URL}/api/indices`)
      ]);
      setCoins(pricesRes.data);
      setIndices(indicesRes.data);
      setError('');
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (id: string) => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/history/${id}`);
      setHistory(response.data);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCoinClick = (coin: CoinData) => {
    setSelectedCoin(coin);
    fetchHistory(coin.id);
  };

  const filteredCoins = useMemo(() => {
    return coins.filter(coin => 
      coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [coins, searchTerm]);

  const formatCurrency = (val: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: val < 1 ? 4 : 0,
    }).format(val);
  };

  const IndexCard = ({ data }: { data: IndexData }) => {
    const isUp = data.change_percent >= 0;
    const chartData = data.sparkline.map((p, i) => ({ i, p }));
    return (
      <div className="index-card">
        <div className="index-header">
          <span className="index-name">{data.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {data.analysis && (
              <span className="stock-analysis-badge" style={{ backgroundColor: data.analysis.color }}>
                {data.analysis.label}
              </span>
            )}
            <span className={`index-change ${isUp ? 'up' : 'down'}`}>
              {isUp ? '+' : ''}{data.change_percent}%
            </span>
          </div>
        </div>
        <div className="index-price">{formatCurrency(data.current_price, data.currency)}</div>
        <div className="index-mini-chart">
          <ResponsiveContainer width="100%" height={40}>
            <AreaChart data={chartData}>
              <YAxis domain={['auto', 'auto']} hide />
              <Area type="monotone" dataKey="p" stroke={isUp ? '#22c55e' : '#ef4444'} fill="transparent" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="title-section">
          <h1>Market Pulse</h1>
          <p className="subtitle">Crypto & Global Indices</p>
        </div>
        
        <div className="header-actions">
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Search coins..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button className="refresh-btn" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={loading ? 'spinning' : ''} size={18} />
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="main-layout">
        <main className="coins-section">
          <div className="section-header">
            <Coins size={20} /> <h2>Cryptocurrencies</h2>
          </div>
          <div className="cards-container">
            {loading && coins.length === 0 ? (
              <div className="loading-state"><div className="loader"></div></div>
            ) : (
              filteredCoins.map(coin => (
                <div key={coin.id} className="coin-card" onClick={() => handleCoinClick(coin)}>
                  <div className="card-header">
                    <div className="coin-info">
                      <img src={coin.image} alt={coin.name} className="coin-logo" />
                      <div><h3>{coin.name}</h3><span className="symbol">{coin.symbol.toUpperCase()}</span></div>
                    </div>
                    <div className={`change ${coin.price_change_percentage_24h >= 0 ? 'up' : 'down'}`}>
                      <span>{(coin.price_change_percentage_24h || 0).toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="price-container">
                    <span className="price-value">{formatCurrency(coin.current_price)}</span>
                    {coin.analysis && (
                      <span className="recommendation-badge" style={{ backgroundColor: coin.analysis.color }}>
                        {coin.analysis.label}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        <aside className="indices-section">
          <div className="section-header">
            <Globe size={20} /> <h2>Global Stocks</h2>
          </div>
          <div className="indices-container">
            {indices.map(index => <IndexCard key={index.id} data={index} />)}
          </div>
        </aside>
      </div>

      {selectedCoin && (
        <div className="modal-overlay" onClick={() => setSelectedCoin(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="coin-detail-info">
                <img src={selectedCoin.image} alt={selectedCoin.name} className="detail-logo" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2>{selectedCoin.name} ({selectedCoin.symbol.toUpperCase()})</h2>
                    {selectedCoin.analysis && (
                      <span className="analysis-badge" style={{ borderColor: selectedCoin.analysis.color, color: selectedCoin.analysis.color }}>
                        {selectedCoin.analysis.label}
                      </span>
                    )}
                  </div>
                  <span className="current-detail-price">{formatCurrency(selectedCoin.current_price)}</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedCoin(null)}><X size={24} /></button>
            </header>
            
            {selectedCoin.analysis && (
              <div className="analysis-reason-box" style={{ borderLeft: `4px solid ${selectedCoin.analysis.color}` }}>
                <strong>Market Analysis:</strong> {selectedCoin.analysis.reason}
              </div>
            )}
            <div className="detail-chart-container">
              <h3>30-Day Price Trend</h3>
              {historyLoading ? <div className="chart-loading">Loading chart data...</div> : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                    <YAxis domain={['auto', 'auto']} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
