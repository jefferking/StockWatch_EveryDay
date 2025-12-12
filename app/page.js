"use client";
import { useState, useEffect, useCallback } from 'react';
import { useSinoPacSocket } from '../hooks/useSinoPacSocket';
import { Search, RotateCcw, TrendingUp, Zap, Wifi, WifiOff, Key, ArrowUp, ArrowDown } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// 註冊 Chart.js 元件
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// 七巨頭代碼
const MAGNIFICENT_SEVEN = ["AAPL.US", "MSFT.US", "GOOG.US", "AMZN.US", "NVDA.US", "META.US", "TSLA.US"];

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [keyword, setKeyword] = useState('美股市場');
  const [newsAnalysis, setNewsAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  // 當 Auth 成功後，自動訂閱七巨頭
  const onAuthSuccess = useCallback(() => {
    console.log("自動訂閱七巨頭...");
    // 這裡我們稍微延遲一下確保穩定
    setTimeout(() => {
        subscribeStocks(MAGNIFICENT_SEVEN);
    }, 500);
  }, []); // 依賴項為空，只定義一次

  // 傳入回調函式
  const { isConnected, marketData, subscribeStocks } = useSinoPacSocket(onAuthSuccess);

  // 如果 marketData 有更新，重新 subscribe 確保沒漏掉 (可選)
  // 這裡我們直接用 onAuthSuccess 處理了初始訂閱

  const analyzeMarket = async () => {
    if (!apiKey) return alert('請先輸入 Gemini API Key');
    setLoading(true);
    setNewsAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, promptContext: keyword })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'API Error');
      setNewsAnalysis(data);
      if (data.stocks) subscribeStocks(data.stocks.map(s => s.symbol));
    } catch (e) {
      alert(`分析失敗：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getPriceColor = (val) => {
    const num = parseFloat(val);
    if (num > 0) return 'text-red-600';
    if (num < 0) return 'text-green-600';
    return 'text-gray-600';
  };

  // 繪製微型走勢圖 (Sparkline) 的設定
  const getChartData = (symbol) => {
    // 這裡模擬一些歷史數據，因為 WebSocket 只給即時價
    // 實務上您應該要把每次收到的 price 存進一個 array
    return {
      labels: ['1', '2', '3', '4', '5', '6', '7'],
      datasets: [{
        data: [100, 102, 101, 104, 103, 105, parseFloat(marketData[symbol]?.price || 0) || 100],
        borderColor: parseFloat(marketData[symbol]?.limitUpDown || 0) >= 0 ? '#dc2626' : '#16a34a',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              美股戰情室 <span className="text-blue-600 text-sm font-normal">AI x Realtime</span>
            </h1>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
              <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
               <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
               <input
                 type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                 placeholder="Gemini API Key"
                 className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 w-48 transition-all shadow-sm"
               />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: 增加左右 Margin (max-w-7xl + px-6/8) */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8 grid grid-cols-12 gap-8">

        {/* 左側：新聞與 AI 分析 (佔 8 等份) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* 搜尋列 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
            <h2 className="font-bold text-gray-700">市場掃描</h2>
            <div className="flex-1 min-w-[200px]">
               <input
                 type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                 className="w-full border border-gray-300 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                 placeholder="輸入關鍵字..."
               />
            </div>
            <button
              onClick={analyzeMarket} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
            >
              {loading ? <RotateCcw className="animate-spin" size={16}/> : <Search size={16}/>}
              {loading ? '分析中...' : '開始分析'}
            </button>
          </div>

          {/* 七巨頭速覽 (新增區塊) */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-600"/> 科技七巨頭 (Magnificent 7)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {MAGNIFICENT_SEVEN.map(symbol => {
                const data = marketData[symbol] || {};
                const price = data.price || '-';
                const change = data.limitUpDown || '0';
                return (
                  <div key={symbol} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-300 transition-colors">
                    <div className="text-xs text-gray-500 mb-1">{symbol.split('.')[0]}</div>
                    <div className={`text-lg font-bold ${getPriceColor(change)}`}>{price}</div>
                    <div className={`text-xs flex items-center ${getPriceColor(change)}`}>
                        {parseFloat(change) > 0 ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                        {change}%
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI 分析結果 */}
          {newsAnalysis ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
               <div className="flex flex-col md:flex-row">
                 <div className="md:w-1/3 h-48 md:h-auto relative overflow-hidden">
                    <img
                      src={`https://picsum.photos/seed/${newsAnalysis.hot_sector}/600/400`}
                      alt="News" className="absolute inset-0 w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">AI 推薦</div>
                 </div>
                 <div className="p-6 md:w-2/3 flex flex-col justify-between">
                    <div>
                       <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
                         {newsAnalysis.hot_sector} 成為市場焦點：{newsAnalysis.summary.substring(0, 30)}...
                       </h3>
                       <p className="text-gray-600 text-sm leading-relaxed mb-4">
                         {newsAnalysis.summary}
                       </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                       {newsAnalysis.stocks.map(s => (
                         <span key={s.symbol} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-100">
                           #{s.name}
                         </span>
                       ))}
                    </div>
                 </div>
               </div>
            </div>
          ) : (
             <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-400">輸入 API Key 並點擊分析，獲取即時市場洞察</p>
             </div>
          )}

        </div>

        {/* 右側：詳細報價列表 (佔 4 等份) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
             <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-3">
               關注清單
             </h3>
             <div className="space-y-4">
               {(newsAnalysis?.stocks || []).map(stock => {
                  const data = marketData[stock.symbol] || {};
                  return (
                    <div key={stock.symbol} className="group p-4 rounded-lg bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-md transition-all">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                             <div className="font-bold text-gray-900">{stock.symbol}</div>
                             <div className="text-xs text-gray-500">{stock.name}</div>
                          </div>
                          <div className="text-right">
                             <div className={`font-mono font-bold ${getPriceColor(data.limitUpDown)}`}>
                                {data.price || '-'}
                             </div>
                             <div className={`text-xs ${getPriceColor(data.limitUpDown)}`}>
                                {data.limitUpDown}%
                             </div>
                          </div>
                       </div>
                       {/* 迷你走勢圖 */}
                       <div className="h-10 w-full mt-2">
                          <Line data={getChartData(stock.symbol)} options={chartOptions} />
                       </div>
                       <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-500">
                          <span className="text-blue-600 font-semibold">AI: </span>{stock.reason}
                       </div>
                    </div>
                  );
               })}
               {!newsAnalysis && (
                 <div className="text-sm text-gray-400 text-center py-10">暫無 AI 推薦個股</div>
               )}
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}
