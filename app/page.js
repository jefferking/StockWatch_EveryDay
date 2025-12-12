"use client";
import { useState, useEffect } from 'react';
import { useSinoPacSocket } from '../hooks/useSinoPacSocket';
import { Search, Zap, TrendingUp, Key, ArrowUp, ArrowDown, LayoutGrid } from 'lucide-react';

// 簡單的字串轉數字雜湊函式，確保同一關鍵字產生同一張圖
const stringToSeed = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [keyword, setKeyword] = useState('美股市場');
  const [newsAnalysis, setNewsAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const { isConnected, marketData, subscribeStocks } = useSinoPacSocket();

  // 七巨頭預設列表 (讓頂部有東西顯示)
  const mag7 = [
    { symbol: 'AAPL.US', name: 'Apple' },
    { symbol: 'MSFT.US', name: 'Microsoft' },
    { symbol: 'GOOGL.US', name: 'Alphabet' },
    { symbol: 'AMZN.US', name: 'Amazon' },
    { symbol: 'NVDA.US', name: 'Nvidia' },
    { symbol: 'TSLA.US', name: 'Tesla' },
    { symbol: 'META.US', name: 'Meta' },
  ];

  // 一開始就訂閱七巨頭，讓頂部有報價
  useEffect(() => {
    if (isConnected) {
      subscribeStocks(mag7.map(s => s.symbol));
    }
  }, [isConnected]);

  // 觸發 Gemini 分析
  const analyzeMarket = async () => {
    if (!apiKey) return alert('請先在左側 AI 區塊輸入 Gemini API Key');
    setLoading(true);
    setNewsAnalysis(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, promptContext: keyword })
      });

      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || `Server Error: ${res.status}`);
      if (!data.hot_sector || !data.summary || !data.stocks) throw new Error('AI 回傳格式不正確');

      setNewsAnalysis(data);

      if (data.stocks) {
        // 訂閱 AI 推薦的股票 + 維持七巨頭訂閱
        const newCodes = data.stocks.map(s => s.symbol);
        const allCodes = [...new Set([...mag7.map(s => s.symbol), ...newCodes])];
        subscribeStocks(allCodes);
      }

    } catch (e) {
      console.error(e);
      alert(`分析失敗：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getPriceColor = (val) => {
    const num = parseFloat(val);
    if (num > 0) return 'text-red-500';
    if (num < 0) return 'text-green-500';
    return 'text-gray-500';
  };

  const getBgColor = (val) => {
    const num = parseFloat(val);
    if (num > 0) return 'bg-red-50';
    if (num < 0) return 'bg-green-50';
    return 'bg-gray-50';
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* 頂部導覽列 (模仿 FinGuider 深色風格) */}
      <nav className="bg-slate-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <LayoutGrid className="text-blue-400" />
            <h1 className="text-xl font-bold tracking-wider">STOCK<span className="text-blue-400">AI</span> 戰情室</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <span className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              {isConnected ? '即時連線' : '斷線重連中'}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* 1. 七巨頭橫向儀表板 (Magnificent 7) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
              <TrendingUp size={20}/> 市場指標 (Magnificent 7)
            </h2>
            <span className="text-xs text-gray-400">即時報價來源: 永豐金證券</span>
          </div>

          {/* 橫向捲動容器 */}
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {mag7.map((stock) => {
              const data = marketData[stock.symbol] || {};
              const price = data.price || data.closePrice || '---';
              const change = data.limitUpDown || '0';
              const changeVal = parseFloat(change);

              return (
                <div key={stock.symbol} className="min-w-[160px] h-[160px] bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group">
                  <div>
                    <div className="text-gray-500 text-xs font-bold mb-1">{stock.name}</div>
                    <div className="text-xl font-black text-gray-800 tracking-tight">{stock.symbol.split('.')[0]}</div>
                  </div>

                  {/* 簡易走勢圖模擬 (SVG 線條) */}
                  <div className="h-12 w-full flex items-end opacity-20 group-hover:opacity-40 transition-opacity">
                     <svg viewBox="0 0 100 40" className={`w-full h-full fill-current ${changeVal >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                        <path d="M0 40 L10 35 L20 38 L30 30 L40 32 L50 20 L60 25 L70 15 L80 18 L90 5 L100 10 V40 H0 Z" />
                     </svg>
                  </div>

                  <div className="text-right">
                    <div className={`text-lg font-bold ${getPriceColor(change)}`}>{price}</div>
                    <div className={`text-xs flex justify-end items-center gap-0.5 ${getPriceColor(change)}`}>
                      {changeVal > 0 ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
                      {change}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. 主內容區：左側 AI 控制面板 + 右側新聞分析 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* 左側：AI 預警控制台 (模仿 FinGuider 左下角區塊) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                  <Zap className="text-yellow-300"/> AI 大盤預警訊號
                </h3>
                <p className="text-indigo-100 text-sm opacity-90">
                  解鎖 Gemini Pro 模型，獲得即時市場情緒分析與板塊輪動預測。
                </p>
              </div>

              <div className="p-6 space-y-4">
                {/* API Key 輸入區 (整合在這裡) */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                    輸入 Gemini API Key 啟動
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* 關鍵字搜尋 */}
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                    關注主題
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={analyzeMarket}
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? '分析中...' : '探索'}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-xs text-center block text-gray-400">
                    由 Google Gemini 1.5 Flash 提供算力
                  </span>
                </div>
              </div>
            </div>

            {/* AI 推薦個股列表 */}
            {newsAnalysis?.stocks && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center justify-between">
                  AI 關注清單
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">Strong Buy</span>
                </h3>
                <div className="space-y-3">
                  {newsAnalysis.stocks.map((stock) => {
                    const data = marketData[stock.symbol] || {};
                    const price = data.price || '---';
                    const change = data.limitUpDown || '0';
                    return (
                      <div key={stock.symbol} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200 group">
                        <div>
                          <div className="font-bold text-gray-800">{stock.symbol}</div>
                          <div className="text-xs text-gray-500">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-medium">{price}</div>
                          <div className={`text-xs ${getPriceColor(change)}`}>{change}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 右側：新聞分析與熱點 (模仿 FinGuider 右側) */}
          <div className="lg:col-span-8 space-y-6">
            {!newsAnalysis ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="text-indigo-300" size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-2">等待 AI 指令...</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  請在左側輸入您的 API Key 並設定關注主題，Gemini 將為您掃描全球市場新聞並提取關鍵交易機會。
                </p>
              </div>
            ) : (
              <>
                {/* 頭條新聞卡片 */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-all">
                  <div className="relative h-64 overflow-hidden">
                    <img
                      src={`https://picsum.photos/seed/${stringToSeed(newsAnalysis.hot_sector)}/800/400`}
                      alt="Market News"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
                      <div>
                        <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
                          {newsAnalysis.hot_sector}
                        </span>
                        <h2 className="text-2xl font-bold text-white leading-tight mb-2">
                          市場熱點：{newsAnalysis.hot_sector} 板塊強勢領漲，AI 解析背後動能
                        </h2>
                        <p className="text-gray-200 text-sm line-clamp-2">
                          {newsAnalysis.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 產業表現 (模擬區塊) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                      <h4 className="font-bold text-gray-700 mb-4">AI 觀點解析</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {newsAnalysis.summary}
                      </p>
                      <div className="mt-4 flex gap-2 flex-wrap">
                        {newsAnalysis.stocks.map(s => (
                          <span key={s.symbol} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            #{s.name}
                          </span>
                        ))}
                      </div>
                   </div>

                   {/* 這裡可以放一些靜態的裝飾性數據，讓畫面更像 FinGuider */}
                   <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden">
                      <div className="relative z-10">
                        <h4 className="font-bold text-indigo-200 mb-1">市場情緒</h4>
                        <div className="text-3xl font-bold mb-4">Greed (貪婪)</div>
                        <div className="w-full bg-indigo-800 h-2 rounded-full overflow-hidden">
                          <div className="w-3/4 h-full bg-green-400 rounded-full"></div>
                        </div>
                        <div className="flex justify-between text-xs text-indigo-300 mt-2">
                          <span>恐懼</span>
                          <span>75/100</span>
                        </div>
                      </div>
                      {/* 裝飾背景 */}
                      <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-indigo-600 rounded-full opacity-20 blur-2xl"></div>
                   </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
