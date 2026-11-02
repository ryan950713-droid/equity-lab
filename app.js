const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// 靜態目錄託管
app.use(express.static(path.join(__dirname, 'public')));

// 明確指定首頁路由，防止找不到檔案
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const FINANCIAL_DB = {
  '2455': {
    name: '全新',
    industry: '通信網路業（光通訊/磊晶）',
    equity: 4980000000,
    otherEquity: -12500000,
    shares: 184910000,
    netIncomeTTM: 712000000,
    prevEquity: 4620000000,
    prevOtherEquity: -15000000,
    ttmEps: 3.85,
    reportDate: '最新公告'
  },
  '2317': {
    name: '鴻海',
    industry: '其他電子業（AI伺服器/電子代工）',
    equity: 1620000000000,
    otherEquity: -85000000000,
    shares: 13862990000,
    netIncomeTTM: 153000000000,
    prevEquity: 1510000000000,
    prevOtherEquity: -92000000000,
    ttmEps: 11.04,
    reportDate: '最新公告'
  },
  '2330': {
    name: '台積電',
    industry: '半導體業（晶圓代工）',
    equity: 3950000000000,
    otherEquity: -120000000000,
    shares: 25930380000,
    netIncomeTTM: 1080000000000,
    prevEquity: 3420000000000,
    prevOtherEquity: -145000000000,
    ttmEps: 41.65,
    reportDate: '最新公告'
  },
  '1216': {
    name: '統一',
    industry: '食品工業',
    equity: 128000000000,
    otherEquity: -14500000000,
    shares: 5682000000,
    netIncomeTTM: 20100000000,
    prevEquity: 122000000000,
    prevOtherEquity: -16000000000,
    ttmEps: 3.54,
    reportDate: '最新公告'
  },
  '3045': {
    name: '台灣大',
    industry: '通信網路業（電信服務）',
    equity: 86500000000,
    otherEquity: -5200000000,
    shares: 3020000000,
    netIncomeTTM: 13200000000,
    prevEquity: 84000000000,
    prevOtherEquity: -5800000000,
    ttmEps: 4.37,
    reportDate: '最新公告'
  }
};

async function fetchYahooQuote(symbol) {
  const suffixes = ['.TWO', '.TW'];
  for (const ext of suffixes) {
    const ticker = `${symbol}${ext}`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2mo`;
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (response.ok) {
        const data = await response.json();
        const result = data.chart?.result?.[0];
        if (result && result.indicators?.quote?.[0]) {
          return { result, ticker };
        }
      }
    } catch (e) {}
  }
  return null;
}

app.get('/api/quote', async (req, res) => {
  const symbol = req.query.symbol || '2455';
  const fin = FINANCIAL_DB[symbol] || {
    name: `個股 (${symbol})`,
    industry: '台股標的',
    equity: 10000000000,
    otherEquity: 0,
    shares: 500000000,
    netIncomeTTM: 1000000000,
    prevEquity: 9500000000,
    prevOtherEquity: 0,
    ttmEps: 2.0,
    reportDate: '最新公告'
  };

  try {
    const quoteData = await fetchYahooQuote(symbol);

    if (!quoteData) {
      return res.status(500).json({ error: `無法取得 ${symbol} 行情` });
    }

    const { result } = quoteData;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators.quote[0];
    const closes = quotes.close || [];
    const volumes = quotes.volume || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];

    const validPoints = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && volumes[i] !== null) {
        validPoints.push({
          date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
          close: Number(closes[i].toFixed(2)),
          volumeLots: Math.round(volumes[i] / 1000),
          high: Number((highs[i] || closes[i]).toFixed(2)),
          low: Number((lows[i] || closes[i]).toFixed(2))
        });
      }
    }

    if (validPoints.length === 0) {
      return res.status(500).json({ error: '無成交資料' });
    }

    const latest = validPoints[validPoints.length - 1];
    const prev = validPoints.length > 1 ? validPoints[validPoints.length - 2] : latest;
    const change = Number((latest.close - prev.close).toFixed(2));
    const changePercent = Number(((change / prev.close) * 100).toFixed(2));

    const last5 = validPoints.slice(-5);
    const last20 = validPoints.slice(-20);
    const ma5Volume = Math.round(last5.reduce((sum, p) => sum + p.volumeLots, 0) / last5.length);
    const ma20Volume = Math.round(last20.reduce((sum, p) => sum + p.volumeLots, 0) / last20.length);

    res.json({
      stock: {
        symbol,
        name: fin.name,
        industry: fin.industry
      },
      market: {
        currentPrice: latest.close,
        change,
        changePercent,
        high: latest.high,
        low: latest.low,
        volumeLots: latest.volumeLots,
        ma5Volume,
        ma20Volume,
        recent20Days: last20,
        quoteDate: latest.date
      },
      fundamentals: fin
    });
  } catch (err) {
    res.status(500).json({ error: '取得行情失敗: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`服務已在 port ${PORT} 啟動`);
});
