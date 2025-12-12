"use client";
import { useState, useEffect, useMemo } from 'react';
import { useSinoPacSocket } from '../hooks/useSinoPacSocket';
import { Search, Zap, TrendingUp, Key, ArrowUp, ArrowDown, LayoutGrid, Activity } from 'lucide-react';

// 字串轉數字雜湊 (用於圖片種子)
const stringToSeed = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// [新元件] 迷你走勢圖
const SparkLine = ({ data, color }) => {
  if (!data || data.length < 2) return null;

  const width = 120;
  const height = 40;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // 避免除以 0

  // 將價格轉為 SVG 座標
  const points = data.map((price, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [keyword, setKeyword] = useState('美股市場');
  const [newsAnalysis, setNewsAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const { isConnected, marketData, initStockWatch } = useSinoPacSocket();

  // 七巨頭列表
  const mag7 = useMemo(() => [
    { symbol: 'AAPL.US', name: 'Apple' },
    { symbol: 'MSFT.US', name: 'Microsoft' },
    { symbol: 'GOOGL.US', name: 'Alphabet' },
    { symbol: 'AMZN.US', name: 'Amazon' },
    { symbol: 'NVDA.US', name: 'Nvidia' },
    { symbol: 'TSLA.US', name: 'Tesla' },
    { symbol: 'META.US', name: 'Meta' },
  ], []);

  // 連線成功後，執行 Quote -> Chart -> Push 流程
  useEffect(() => {
    if (isConnected) {
      initStockWatch(mag7.map(s => s.symbol));
    }
  }, [isConnected, initStockWatch, mag7]);

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
      if (!res.ok || data.error) throw new Error(data.error || 'Server Error');
      setNewsAnalysis(data);

      if (data.stocks) {
        initStockWatch(data.stocks.map(s => s.symbol));
      }
    } catch (e) {
      alert(`分析失敗：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getPriceColor = (val) => parseFloat(val) >= 0 ? 'text-red-500' : 'text-green-500';
  const getLineColor = (val) => parseFloat(val) >= 0 ? '#ef4444' : '#22c55e'; // red-500 : green-500

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

      {/* 導覽列 */}
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <LayoutGrid className="text-blue-400" />
            <h1 className="text-lg font-bold tracking-wider">STOCK<span className="text-blue-400">AI</span></h1>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className={`flex items-center gap-1 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              <Activity size={14} className={isConnected ? "animate-pulse" : ""}/>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* 1. 七巨頭橫向儀表板 (修正版：高度縮小，Sparkline 真實資料) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp size={16}/> Market Leaders
            </h2>
          </div>

          {/* 橫向捲動容器 */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
            {mag7.map((stock) => {
              const data = marketData[stock.symbol] || {};
              const price = data.price || data.closePrice || '---';
              const change = data.limitUpDown || '0';
              const changeVal = parseFloat(change);
              const history = data.history || []; // 取得走勢圖資料

              return (
                <div key={stock.symbol} className="snap-start min-w-[200px] bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex flex-col justify-between hover:border-blue-300 transition-all cursor-pointer">

                  {/* 頭部：名稱與價格 */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-gray-800">{stock.symbol.split('.')[0]}</div>
                      <div className="text-xs text-gray-400">{stock.name}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getPriceColor(change)}`}>{price}</div>
                      <div className={`text-xs ${getPriceColor(change)} flex items-center justify-end`}>
                        {changeVal > 0 ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
                        {change}%
                      </div>
                    </div>
                  </div>

                  {/* 底部：真實 Sparkline 走勢圖 */}
                  <div className="h-10 w-full mt-1">
                     {history.length > 0 ? (
                        <SparkLine data={history} color={getLineColor(changeVal)} />
                     ) : (
                        // 載入中動畫
                        <div className="h-full w-full bg-gray-50 animate-pulse rounded"></div>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. 主內容區 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* 左側：AI 控制台 */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                <h3 className="font-bold flex items-center gap-2 text-sm">
                  <Zap size={16} className="text-yellow-300"/> AI 訊號中樞
                </h3>
              </div>

              <div className="p-5 space-y-4">
                {/* API Key 輸入框 (放在這裡) */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">
                    Gemini API Key
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 text-gray-400" size={14}/>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="請輸入 API Key"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">
                    關注主題
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={analyzeMarket}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {loading ? '...' : '掃描'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* AI 推薦列表 */}
            {newsAnalysis?.stocks && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-bold text-gray-700 mb-3 text-sm">AI 關注個股</h3>
                <div className="divide-y divide-gray-100">
                  {newsAnalysis.stocks.map((stock) => {
                    const data = marketData[stock.symbol] || {};
                    const price = data.price || '---';
                    const change = data.limitUpDown || '0';
                    return (
                      <div key={stock.symbol} className="flex justify-between items-center py-3 hover:bg-gray-50 cursor-pointer">
                        <div>
                          <div className="font-bold text-gray-800 text-sm">{stock.symbol}</div>
                          <div className="text-xs text-gray-500">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-medium text-sm">{price}</div>
                          <div className={`text-xs ${getPriceColor(change)}`}>{change}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 右側：新聞分析 */}
          <div className="lg:col-span-8">
            {!newsAnalysis ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center h-full flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <Search className="text-gray-300" size={24} />
                </div>
                <h3 className="text-gray-700 font-bold mb-2">等待指令</h3>
                <p className="text-gray-400 text-sm">在左側輸入 API Key 以啟動 AI 分析</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 新聞大圖卡 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="relative h-56">
                    <img
                      src={`https://picsum.photos/seed/${stringToSeed(newsAnalysis.hot_sector)}/800/400`}
                      alt="News"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6">
                      <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded w-fit mb-2">
                        {newsAnalysis.hot_sector}
                      </span>
                      <h2 className="text-xl font-bold text-white leading-snug">
                        {newsAnalysis.summary}
                      </h2>
                    </div>
                  </div>
                  <div className="p-6">
                     <div className="flex gap-2 mb-4">
                        {newsAnalysis.stocks.map(s => (
                          <span key={s.symbol} className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            #{s.name}
                          </span>
                        ))}
                     </div>
                     <p className="text-gray-600 text-sm leading-relaxed">
                       AI 觀點：該板塊目前呈現強勢資金流入，建議關注基本面良好的龍頭股。市場情緒指標顯示目前處於樂觀區間。
                     </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
