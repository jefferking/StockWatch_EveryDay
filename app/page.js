"use client";
import { useState, useEffect, useCallback } from 'react';
import { useSinoPacSocket } from '../hooks/useSinoPacSocket';
import { Search, RotateCcw, TrendingUp, Wifi, WifiOff, Key, ArrowUp, ArrowDown } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// 註冊 Chart.js 元件
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// 七巨頭代碼
const MAGNIFICENT_SEVEN = ["AAPL.US", "MSFT.US", "GOOG.US", "AMZN.US", "NVDA.US", "META.US", "TSLA.US"];

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

  // 當 Auth 成功後，自動訂閱七巨頭
  const onAuthSuccess = useCallback(() => {
    // 這裡我們稍微延遲一下確保穩定，並呼叫 subscribeStocks
    // 注意：subscribeStocks 在下面才定義，所以我們在 useEffect 處理初始訂閱，
    // 或者我們只在這裡標記 "已準備好"，讓依賴 isConnected 的副作用去處理。
    // 但為了簡單，我們稍後會把 subscribeStocks 傳出來直接用。
  }, []);

  // 1. 從 hook 接收 logs 和方法
  const { isConnected, marketData, subscribeStocks, logs } = useSinoPacSocket(onAuthSuccess);

  // 監聽連線狀態，一旦連上且 Auth 成功 (isConnected=true)，就自動訂閱
  useEffect(() => {
    if (isConnected) {
        console.log("連線就緒，自動訂閱七巨頭...");
        setTimeout(() => {
            subscribeStocks(MAGNIFICENT_SEVEN);
        }, 1000);
    }
  }, [isConnected, subscribeStocks]);

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
    const currentPrice = parseFloat(marketData[symbol]?.price || 0);
    // 產生一點隨機波動讓圖看起來像真的
    const mockHistory = Array(6).fill(0).map(() => currentPrice * (1 + (Math.random() - 0.5) * 0.01));

    return {
      labels: ['1', '2', '3', '4', '5', '6', '7'],
      datasets: [{
        data: [...mockHistory, currentPrice || 100],
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
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-48">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <TrendingUp className="text-blue-600"/> 美股戰情室 <span className="text-blue-600 text-sm font-normal hidden sm:inline">AI x Realtime</span>
            </h1>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
              <span>{isConnected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group">
               <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors" size={14} />
               <input
                 type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                 placeholder="Gemini API Key"
                 className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 w-32 sm:w-48 transition-all shadow-sm focus:w-64"
               />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8 grid grid-cols-12 gap-8">

        {/* 左側：新聞與 AI 分析 (佔 8 等份) */}
        <div className="col-span-12 lg:col-span-8 space-y-8">

          {/* 搜尋列 */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
            <h2 className="font-bold text-gray-700 hidden sm:block">市場掃描</h2>
            <div className="flex-1 min-w-[200px]">
               <input
                 type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                 className="w-full border border-gray-300 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                 placeholder="輸入關鍵字 (如: AI產業, 降息影響)..."
               />
            </div>
            <button
              onClick={analyzeMarket} disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <RotateCcw className="animate-spin" size={16}/> : <Search size={16}/>}
              {loading ? '分析中...' : '開始分析'}
            </button>
          </div>

          {/* 七巨頭速覽 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-600 p-1 rounded">M7</span> 科技七巨頭
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {MAGNIFICENT_SEVEN.map(symbol => {
                const data = marketData[symbol] || {};
                const price = data.price || '-';
                const change = data.limitUpDown || '0';
                return (
                  <div key={symbol} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-default group">
                    <div className="flex justify-between items-start">
                        <div className="text-xs text-gray-500 font-semibold mb-1 group-hover:text-blue-600">{symbol.split('.')[0]}</div>
                        {/* 迷你 Sparkline */}
                        <div className="w-12 h-6 opacity-50">
                            <Line data={getChartData(symbol)} options={{...chartOptions, elements:{point:{radius:0}}}} />
                        </div>
                    </div>
                    <div className={`text-lg font-bold ${getPriceColor(change)}`}>{price}</div>
                    <div className={`text-xs flex items-center ${getPriceColor(change)} font-medium`}>
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
                 <div className="md:w-5/12 h-56 md:h-auto relative overflow-hidden bg-gray-100 group">
                    <img
                      src={`https://picsum.photos/seed/${stringToSeed(newsAnalysis.hot_sector)}/400/250`}
                      alt="News" className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/60 to-transparent md:hidden"></div>
                    <div className="absolute top-3 left-3 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shadow">AI 熱點</div>
                 </div>
                 <div className="p-6 md:w-7/12 flex flex-col justify-between">
                    <div>
                       <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{newsAnalysis.hot_sector}</span>
                          <span>•</span>
                          <span>{new Date().toLocaleTimeString()} 更新</span>
                       </div>
                       <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug hover:text-blue-600 transition-colors cursor-pointer">
                         {newsAnalysis.summary.substring(0, 40)}...
                       </h3>
                       <p className="text-gray-600 text-sm leading-relaxed mb-4 text-justify">
                         {newsAnalysis.summary}
                       </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-gray-100">
                       <span className="text-xs font-bold text-gray-400 flex items-center mr-2">相關個股:</span>
                       {newsAnalysis.stocks.map(s => (
                         <span key={s.symbol} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-100 hover:bg-blue-100 cursor-pointer transition-colors">
                           {s.name}
                         </span>
                       ))}
                    </div>
                 </div>
               </div>
            </div>
          ) : (
             <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <div className="inline-flex bg-gray-100 p-4 rounded-full mb-4">
                    <Search className="text-gray-400" size={32} />
                </div>
                <h3 className="text-lg font-medium text-gray-900">準備好掃描市場了嗎？</h3>
                <p className="text-gray-500 mt-1">輸入您的 Gemini API Key 並點擊上方「開始分析」</p>
             </div>
          )}

        </div>

        {/* 右側：詳細報價列表 (佔 4 等份) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
             <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                 <h3 className="font-bold text-gray-800 flex items-center gap-2 border-l-4 border-blue-600 pl-3">
                   AI 關注清單
                 </h3>
                 <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">即時</span>
             </div>

             <div className="space-y-4">
               {(newsAnalysis?.stocks || []).map(stock => {
                  const data = marketData[stock.symbol] || {};
                  const price = data.price || '-';
                  const change = data.limitUpDown || '0';

                  return (
                    <div key={stock.symbol} className="group p-4 rounded-lg bg-gray-50 border border-gray-100 hover:bg-white hover:shadow-md transition-all hover:border-blue-200">
                       <div className="flex justify-between items-start mb-2">
                          <div>
                             <div className="font-bold text-gray-900 text-lg">{stock.symbol}</div>
                             <div className="text-xs text-gray-500 font-medium">{stock.name}</div>
                          </div>
                          <div className="text-right">
                             <div className={`font-mono font-bold text-xl ${getPriceColor(change)}`}>
                                {price}
                             </div>
                             <div className={`text-xs ${getPriceColor(change)} bg-white px-1 rounded shadow-sm inline-block`}>
                                {parseFloat(change) > 0 ? '+' : ''}{change}%
                             </div>
                          </div>
                       </div>
                       {/* 走勢圖 */}
                       <div className="h-12 w-full mt-2 opacity-80">
                          <Line data={getChartData(stock.symbol)} options={chartOptions} />
                       </div>
                       <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500 flex gap-2">
                          <span className="text-blue-600 font-bold shrink-0">觀點:</span>
                          <span className="line-clamp-2">{stock.reason}</span>
                       </div>
                    </div>
                  );
               })}
               {!newsAnalysis && (
                 <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <TrendingUp size={48} className="opacity-20 mb-2"/>
                    <div className="text-sm">暫無 AI 推薦個股</div>
                 </div>
               )}
             </div>
          </div>
        </div>

      </main>

      {/* --- 除錯控制台 (固定底部) --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-gray-300 h-48 overflow-y-auto border-t border-gray-700 shadow-2xl font-mono text-xs z-50 opacity-95 transition-all duration-300 hover:h-64">
        <div className="sticky top-0 bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700 shadow-md">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="font-bold text-white tracking-wide">📡 連線除錯日誌 (Debug Console)</span>
            </div>
            <span className="text-gray-400 bg-gray-900 px-2 py-0.5 rounded text-[10px]">{logs.length} 條訊息</span>
        </div>
        <div className="p-4 space-y-1.5 font-sans">
            {logs.length === 0 && <div className="text-gray-500 italic pl-2">等待系統連線中...</div>}
            {logs.map((log, index) => (
                <div key={index} className={`border-b border-gray-800/50 pb-1 pl-2 ${
                    log.includes('❌') || log.includes('⚠️') ? 'text-red-400 font-bold bg-red-900/10' :
                    log.includes('✅') || log.includes('🔑') ? 'text-green-400 font-bold' :
                    log.includes('發送') ? 'text-blue-300' : 'text-gray-300'
                }`}>
                    {log}
                </div>
            ))}
        </div>
      </div>

    </div>
  );
}
