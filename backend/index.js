const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

// 로컬 환경(Vercel 외부)에서만 SSL 인증서 검증 무시
if (!process.env.VERCEL) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();

// CORS 설정: 모든 도메인 허용 (Vercel 배포 초기 단계 편의성)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 전역 캐시
let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;

const COINS_LIST = ['bitcoin', 'ethereum', 'ripple', 'solana', 'dogecoin'];
const COINS_IDS = COINS_LIST.join(',');

// 기술적 지표 계산 유틸리티
const getMA = (prices, period) => {
  if (!prices || prices.length === 0) return 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
};

const getSD = (prices, period) => {
  if (!prices || prices.length < 2) return 0;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  return Math.sqrt(slice.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / slice.length);
};

const calculateRSI = (prices, periods = 14) => {
  if (!prices || prices.length < periods + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - periods; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  return losses === 0 ? 100 : 100 - (100 / (1 + (gains / losses)));
};

// 퀀트 분석 엔진
const analyzeRecommendation = (coin) => {
  const prices = coin.sparkline_in_7d?.price || coin.sparkline || [];
  const current = coin.current_price || 0;
  
  // 데이터 부족 시 기본값 반환 (목록 표시 보장)
  if (prices.length < 10) {
    return { action: "HOLD", label: "관망", reason: "데이터 수집 중", color: "#9E9E9E" };
  }

  const rsi = calculateRSI(prices);
  const ma7 = getMA(prices, 7);
  const ma20 = getMA(prices, 20);
  const ma60 = getMA(prices, 60);
  const sd20 = getSD(prices, 20);
  const bbUpper = ma20 + (sd20 * 2);
  const bbLower = ma20 - (sd20 * 2);

  let score = 0;
  let insights = [];

  if (current <= bbLower && bbLower !== 0) { score += 2; insights.push("BB하단"); }
  else if (current >= bbUpper && bbUpper !== 0) { score -= 2; insights.push("BB상단"); }

  if (rsi < 30) { score += 2; insights.push(`RSI과매도`); }
  else if (rsi > 70) { score -= 2; insights.push(`RSI과매수`); }

  if (ma7 > ma20) score += 1; else score -= 1;
  if (current > ma60 && ma60 !== 0) score += 1;

  if (score >= 3) return { action: "STRONG_BUY", label: "강한 매수", reason: `강력 반등 시그널 (${insights.join('/')})`, color: "#1B5E20" };
  if (score >= 1) return { action: "BUY", label: "약 매수", reason: "추세 우상향 진행 중", color: "#4CAF50" };
  if (score <= -3) return { action: "STRONG_SELL", label: "강한 매도", reason: `차익 실현 시점 (${insights.join('/')})`, color: "#B71C1C" };
  if (score <= -1) return { action: "SELL", label: "약 매도", reason: "단기 조정 가능성", color: "#F44336" };

  return { action: "HOLD", label: "관망", reason: "추세 확인 필요", color: "#9E9E9E" };
};

// [API 1] 코인 목록
app.get('/api/prices', async (req, res) => {
  const now = Date.now();
  if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
    return res.json(cachedData);
  }

  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        ids: COINS_IDS,
        order: 'market_cap_desc',
        per_page: 10,
        page: 1,
        sparkline: true,
        price_change_percentage: '24h'
      },
      timeout: 8000
    });

    const analyzedData = response.data.map(coin => ({
      ...coin,
      analysis: analyzeRecommendation(coin)
    }));

    cachedData = analyzedData;
    lastFetchTime = now;
    res.json(analyzedData);
  } catch (error) {
    console.error('Fetch error:', error.message);
    if (cachedData) return res.json(cachedData);
    res.status(500).json({ error: '데이터를 가져오지 못했습니다.' });
  }
});

// [API 2] 히스토리
app.get('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
      params: { vs_currency: 'usd', days: '30', interval: 'daily' }
    });
    const formatted = response.data.prices.map(([ts, price]) => ({
      date: new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// [API 3] 주식 데이터
app.get('/api/indices', (req, res) => {
  const stocks = [
    { id: 'nvda', name: 'NVIDIA Corp.', symbol: 'NVDA', currency: 'USD', current_price: 135.50 + Math.random() * 5, change_percent: 3.45, sparkline: Array.from({length: 100}, () => 110 + Math.random() * 30) },
    { id: 'tsla', name: 'Tesla, Inc.', symbol: 'TSLA', currency: 'USD', current_price: 258.10 + Math.random() * 10, change_percent: -2.10, sparkline: Array.from({length: 100}, () => 230 + Math.random() * 40) },
    { id: 'aapl', name: 'Apple Inc.', symbol: 'AAPL', currency: 'USD', current_price: 228.30 + Math.random() * 3, change_percent: 0.85, sparkline: Array.from({length: 100}, () => 215 + Math.random() * 20) },
    { id: 'samsung', name: 'Samsung Electronics', symbol: '005930.KS', currency: 'KRW', current_price: 74500 + Math.random() * 500, change_percent: 1.20, sparkline: Array.from({length: 100}, () => 70000 + Math.random() * 6000) },
    { id: 'hynix', name: 'SK hynix Inc.', symbol: '000660.KS', currency: 'KRW', current_price: 185000 + Math.random() * 2000, change_percent: -0.95, sparkline: Array.from({length: 100}, () => 160000 + Math.random() * 30000) }
  ];

  const analyzed = stocks.map(s => ({
    ...s,
    analysis: analyzeRecommendation(s)
  }));
  res.json(analyzed);
});

// Vercel 서버리스 익스포트
module.exports = app;

// 로컬 환경 직접 실행 시 서버 가동 (node index.js)
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`🚀 로컬 서버가 실행되었습니다: http://localhost:${PORT}`);
  });
}
