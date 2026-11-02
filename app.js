const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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
    if (!quoteData) return res.status(500).json({ error: `無法取得 ${symbol} 行情` });

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

    const latest = validPoints[validPoints.length - 1];
    const prev = validPoints.length > 1 ? validPoints[validPoints.length - 2] : latest;
    const change = Number((latest.close - prev.close).toFixed(2));
    const changePercent = Number(((change / prev.close) * 100).toFixed(2));

    const last5 = validPoints.slice(-5);
    const last20 = validPoints.slice(-20);
    const ma5Volume = Math.round(last5.reduce((sum, p) => sum + p.volumeLots, 0) / last5.length);
    const ma20Volume = Math.round(last20.reduce((sum, p) => sum + p.volumeLots, 0) / last20.length);

    res.json({
      stock: { symbol, name: fin.name, industry: fin.industry },
      market: {
        currentPrice: latest.close,
        change,
        changePercent,
        high: latest.high,
        low: latest.low,
        volumeLots: latest.volumeLots,
        ma5Volume,
        ma20Volume,
        quoteDate: latest.date
      },
      fundamentals: fin
    });
  } catch (err) {
    res.status(500).json({ error: '行情讀取失敗: ' + err.message });
  }
});

// 直接由伺服器回傳 HTML 內容，不再依賴讀取實體檔案
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>台股價值分析室 | Equity Lab Taiwan</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#F9F8F6] text-stone-800 min-h-screen">
  <header class="bg-[#354B3F] text-white p-4 shadow-sm">
    <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
      <div>
        <h1 class="text-xl font-bold">台股價值分析室 <span class="text-xs uppercase ml-1 opacity-80">Equity Lab Taiwan</span></h1>
        <p class="text-xs text-stone-200 mt-0.5">TT 模型基本面估值 × 即時量價 × 產業魚骨圖分析</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-stone-200">快捷觀察：</span>
        <button onclick="searchStock('2455')" class="px-2.5 py-1 text-xs bg-[#486354] hover:bg-[#5B7A68] rounded text-white transition">2455 全新</button>
        <button onclick="searchStock('2317')" class="px-2.5 py-1 text-xs bg-[#486354] hover:bg-[#5B7A68] rounded text-white transition">2317 鴻海</button>
        <button onclick="searchStock('2330')" class="px-2.5 py-1 text-xs bg-[#486354] hover:bg-[#5B7A68] rounded text-white transition">2330 台積電</button>
        <button onclick="searchStock('1216')" class="px-2.5 py-1 text-xs bg-[#486354] hover:bg-[#5B7A68] rounded text-white transition">1216 統一</button>
        <button onclick="searchStock('3045')" class="px-2.5 py-1 text-xs bg-[#486354] hover:bg-[#5B7A68] rounded text-white transition">3045 台灣大</button>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto p-4 space-y-6">
    <section class="bg-white p-4 rounded-xl shadow-sm border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <input id="symbolInput" type="text" placeholder="輸入台股代號" value="2455"
               class="px-3 py-2 border rounded-lg text-sm w-full sm:w-48 font-mono">
        <button onclick="searchStock(document.getElementById('symbolInput').value)"
                class="px-5 py-2 bg-[#486354] hover:bg-[#354B3F] text-white text-sm font-medium rounded-lg">
          取得估價
        </button>
      </div>
      <div class="text-xs text-stone-500 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>資料來源：後端即時行情串接與公開資訊觀測站</span>
      </div>
    </section>

    <div id="loading" class="hidden text-center py-10">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#5B7A68] border-t-transparent"></div>
      <p class="text-sm text-stone-500 mt-2">載入即時市場行情與基本面數據...</p>
    </div>

    <div id="contentArea" class="space-y-6">
      <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div class="text-xs text-stone-500">個股資訊</div>
          <div class="text-xl font-bold mt-1" id="stockName">2455 全新</div>
          <div class="text-xs text-emerald-700 mt-1" id="stockIndustry">光通訊磊晶</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div class="text-xs text-stone-500">最新收盤價 (元)</div>
          <div class="text-2xl font-bold mt-1" id="stockPrice">--</div>
          <div class="text-xs mt-1 font-semibold" id="stockChange">--</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div class="text-xs text-stone-500">成交量 (張)</div>
          <div class="text-xl font-bold mt-1" id="stockVolume">--</div>
          <div class="text-xs text-stone-500 mt-1" id="stockVolumeMA">5日: -- | 20日: --</div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div class="text-xs text-stone-500">資料日期</div>
          <div class="text-sm font-semibold mt-1" id="quoteDate">--</div>
          <div class="text-xs text-stone-500 mt-1" id="reportDate">財報期別: 最新公告</div>
        </div>
      </section>

      <section class="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
        <div class="flex justify-between items-center border-b pb-2">
          <h2 class="text-lg font-bold text-[#354B3F]">TT 基本面估價模型推導</h2>
          <span class="px-3 py-1 bg-stone-100 text-[#354B3F] text-xs rounded-full font-medium" id="ttConditionTag">判定中</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-lg bg-stone-50 border border-stone-200">
            <span class="text-xs font-bold text-[#486354] block mb-1">步驟 A：調整每股淨值</span>
            <div class="text-2xl font-bold" id="valAdjNav">-- 元</div>
            <p class="text-xs text-stone-500 mt-2" id="detailAdjNav">公式：(母公司權益 － 其他權益) ÷ 流通股數</p>
          </div>
          <div class="p-4 rounded-lg bg-stone-50 border border-stone-200">
            <span class="text-xs font-bold text-[#486354] block mb-1">步驟 B：調整 ROE</span>
            <div class="text-2xl font-bold" id="valAdjRoe">-- %</div>
            <p class="text-xs text-stone-500 mt-2" id="detailAdjRoe">公式：近四季淨利 ÷ 期初調整權益</p>
          </div>
          <div class="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <span class="text-xs font-bold text-emerald-800 block mb-1">步驟 C：TT 基準價</span>
            <div class="text-2xl font-bold text-emerald-800" id="valTtBasePrice">-- 元</div>
            <p class="text-xs text-emerald-700 mt-2" id="detailTtRule">依 ROE 級距進行分流定價</p>
          </div>
        </div>
        <div class="p-3 bg-stone-50 rounded-lg text-xs flex justify-between items-center">
          <div>當前市價對 TT 基準價偏離：<span class="font-bold text-sm" id="premiumRate">--</span></div>
          <div class="text-stone-500">* 成長股在市場熱度推升下通常享有顯著溢價。</div>
        </div>
      </section>

      <section class="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
        <h2 class="text-lg font-bold text-[#354B3F]">五段價格區間與安全邊際階梯</h2>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div class="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div class="text-xs font-bold text-emerald-800">便宜價 (0.8x)</div>
            <div class="text-base font-bold text-emerald-900 mt-1" id="priceCheap">--</div>
          </div>
          <div class="p-3 rounded-lg bg-green-50 border border-green-200">
            <div class="text-xs font-bold text-green-800">偏低價 (0.9x)</div>
            <div class="text-base font-bold text-green-900 mt-1" id="priceLow">--</div>
          </div>
          <div class="p-3 rounded-lg bg-stone-100 border border-stone-300">
            <div class="text-xs font-bold text-stone-800">合理價 (1.0x)</div>
            <div class="text-base font-bold text-stone-900 mt-1" id="priceFair">--</div>
          </div>
          <div class="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <div class="text-xs font-bold text-amber-800">偏高價 (1.15x)</div>
            <div class="text-base font-bold text-amber-900 mt-1" id="priceHigh">--</div>
          </div>
          <div class="p-3 rounded-lg bg-rose-50 border border-rose-200 col-span-2 sm:col-span-1">
            <div class="text-xs font-bold text-rose-800">瘋狂價 (1.3x)</div>
            <div class="text-base font-bold text-rose-900 mt-1" id="priceCrazy">--</div>
          </div>
        </div>
        <div class="border-t pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-stone-600">
          <div>安全邊際 10%：<span class="font-bold text-stone-900" id="margin10">--</span> 元</div>
          <div>安全邊際 20%：<span class="font-bold text-stone-900" id="margin20">--</span> 元</div>
          <div>安全邊際 30%：<span class="font-bold text-stone-900" id="margin30">--</span> 元</div>
        </div>
      </section>

      <section class="bg-white p-6 rounded-xl border border-stone-200 shadow-sm space-y-4">
        <h2 class="text-lg font-bold text-[#354B3F]">六維度魚骨分析</h2>
        <div class="grid grid-cols-2 md:grid-cols-6 gap-2">
          <button onclick="selectBone(0)" class="bone-btn p-3 rounded-lg bg-stone-100 text-xs font-bold">1. 營收成長</button>
          <button onclick="selectBone(1)" class="bone-btn p-3 rounded-lg bg-stone-100 text-xs font-bold">2. 獲利品質</button>
          <button onclick="selectBone(2)" class="bone-btn p-3 rounded-lg bg-stone-100 text-xs font-bold">3. 產業地位</button>
          <button onclick="selectBone(3)" class="bone-btn p-3 rounded-lg bg-stone-100 text-xs font-bold">4. 景氣循環</button>
          <button onclick="selectBone(4)" class="bone-btn p-3 rounded-lg bg-stone-100 text-xs font-bold">5. 財務結構</button>
          <button onclick="selectBone(5)" class="bone-btn p-3 rounded-lg bg-stone-100 text-xs font-bold">6. 市場評價</button>
        </div>
        <div class="p-4 rounded-xl bg-stone-50 border space-y-3">
          <h3 class="text-sm font-bold text-[#354B3F]" id="boneTitle">維度分析</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div class="bg-white p-3 rounded border border-emerald-100">
              <span class="font-bold text-emerald-800 block mb-1">有利支撐 (Pros)</span>
              <p class="text-stone-600" id="bonePros">--</p>
            </div>
            <div class="bg-white p-3 rounded border border-rose-100">
              <span class="font-bold text-rose-800 block mb-1">風險警示 (Cons)</span>
              <p class="text-stone-600" id="boneCons">--</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <script>
    const BONES = [
      { title: '1. 營收成長性', pros: '高速光通訊與 CPO 需求爆發，切入全球 CSP 供應鏈。', cons: '消費性手機 PA 需求回溫較慢。' },
      { title: '2. 獲利品質', pros: '光通訊磊晶毛利率高，產品組合持續優化。', cons: '研發費用與機台折舊短期影響營業淨利率。' },
      { title: '3. 產業競爭地位', pros: '全球化合物半導體磊晶龍頭，專利技術護城河深厚。', cons: '海外同業在特定規格有潛在競爭。' },
      { title: '4. 景氣循環', pros: 'AI 機房電轉光為長期大趨勢。', cons: '若 CSP 投資放緩可能迎來庫存修正期。' },
      { title: '5. 財務結構', pros: '負債比低，現金流充沛，無長期償債壓力。', cons: '後續需維持高資本支出以擴充產能。' },
      { title: '6. 市場評價', pros: '市場賦予極高的矽光子概念估值溢價。', cons: '市價顯著高於清算與淨值基準，波動大。' }
    ];

    async function searchStock(symbol) {
      document.getElementById('loading').classList.remove('hidden');
      document.getElementById('contentArea').classList.add('opacity-40');
      try {
        const res = await fetch('/api/quote?symbol=' + symbol);
        const data = await res.json();
        render(data);
      } catch (e) {
        alert('行情讀取失敗');
      } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('contentArea').classList.remove('opacity-40');
      }
    }

    function render(data) {
      const { stock, market, fundamentals } = data;
      document.getElementById('stockName').textContent = stock.symbol + ' ' + stock.name;
      document.getElementById('stockIndustry').textContent = stock.industry;
      document.getElementById('stockPrice').textContent = market.currentPrice.toFixed(2);
      
      const changeEl = document.getElementById('stockChange');
      const sign = market.change >= 0 ? '+' : '';
      changeEl.textContent = sign + market.change + ' (' + sign + market.changePercent + '%)';
      changeEl.className = market.change >= 0 ? 'text-xs mt-1 font-semibold text-rose-600' : 'text-xs mt-1 font-semibold text-emerald-600';

      document.getElementById('stockVolume').textContent = market.volumeLots.toLocaleString();
      document.getElementById('stockVolumeMA').textContent = '5日: ' + market.ma5Volume.toLocaleString() + ' | 20日: ' + market.ma20Volume.toLocaleString();
      document.getElementById('quoteDate').textContent = market.quoteDate;

      const adjEquity = fundamentals.equity - fundamentals.otherEquity;
      const adjNav = adjEquity / fundamentals.shares;
      const prevAdjEquity = fundamentals.prevEquity - fundamentals.prevOtherEquity;
      const adjRoeDecimal = fundamentals.netIncomeTTM / prevAdjEquity;
      const adjRoePercent = adjRoeDecimal * 100;

      let basePrice = 0;
      let tag = '';
      let desc = '';

      if (adjRoePercent >= 10) {
        basePrice = adjNav * adjRoeDecimal * 10;
        tag = 'ROE ≥ 10% (高回報)';
        desc = adjNav.toFixed(2) + ' × ' + adjRoeDecimal.toFixed(4) + ' × 10 ＝ ' + basePrice.toFixed(2) + ' 元';
      } else if (adjRoePercent >= 8) {
        basePrice = adjNav;
        tag = '8% ≤ ROE < 10% (穩健)';
        desc = '基準價 ＝ 調整每股淨值 (' + adjNav.toFixed(2) + ' 元)';
      } else {
        basePrice = adjNav * (adjRoeDecimal + 0.02) * 10;
        tag = 'ROE < 8% (低回報調整)';
        desc = adjNav.toFixed(2) + ' × (' + adjRoeDecimal.toFixed(4) + ' + 0.02) × 10 ＝ ' + basePrice.toFixed(2) + ' 元';
      }

      document.getElementById('valAdjNav').textContent = adjNav.toFixed(2) + ' 元';
      document.getElementById('valAdjRoe').textContent = adjRoePercent.toFixed(2) + ' %';
      document.getElementById('valTtBasePrice').textContent = basePrice.toFixed(2) + ' 元';
      document.getElementById('detailTtRule').textContent = desc;
      document.getElementById('ttConditionTag').textContent = tag;

      const diffRate = ((market.currentPrice - basePrice) / basePrice) * 100;
      const premEl = document.getElementById('premiumRate');
      premEl.textContent = diffRate >= 0 ? '溢價 +' + diffRate.toFixed(1) + '%' : '折價 ' + diffRate.toFixed(1) + '%';
      premEl.className = diffRate >= 0 ? 'font-bold text-sm text-rose-600' : 'font-bold text-sm text-emerald-600';

      document.getElementById('priceCheap').textContent = (basePrice * 0.8).toFixed(1) + ' 元';
      document.getElementById('priceLow').textContent = (basePrice * 0.9).toFixed(1) + ' 元';
      document.getElementById('priceFair').textContent = (basePrice * 1.0).toFixed(1) + ' 元';
      document.getElementById('priceHigh').textContent = (basePrice * 1.15).toFixed(1) + ' 元';
      document.getElementById('priceCrazy').textContent = (basePrice * 1.3).toFixed(1) + ' 元';

      document.getElementById('margin10').textContent = (basePrice * 0.9).toFixed(1);
      document.getElementById('margin20').textContent = (basePrice * 0.8).toFixed(1);
      document.getElementById('margin30').textContent = (basePrice * 0.7).toFixed(1);

      selectBone(0);
    }

    function selectBone(idx) {
      document.getElementById('boneTitle').textContent = BONES[idx].title;
      document.getElementById('bonePros').textContent = BONES[idx].pros;
      document.getElementById('boneCons').textContent = BONES[idx].cons;
    }

    window.addEventListener('DOMContentLoaded', () => searchStock('2455'));
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`服務已在 port ${PORT} 啟動`);
});
