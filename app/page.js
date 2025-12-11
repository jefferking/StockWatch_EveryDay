"use client";
import { useState, useEffect } from 'react';
import { useSinoPacSocket } from '../hooks/useSinoPacSocket';
import { Search, RotateCcw, TrendingUp, Zap, Wifi, WifiOff, Key } from 'lucide-react';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [keyword, setKeyword] = useState('美股市場'); // 預設搜尋關鍵字
  const [newsAnalysis, setNewsAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  // 取得 WebSocket 狀態與資料
  const { isConnected, marketData, subscribeStocks } = useSinoPacSocket();

  // 觸發 Gemini 分析
  const analyzeMarket = async () => {
    if (!apiKey) return alert('請先輸入 Gemini API Key 以獲取新聞分析');
    setLoading(true);
    setNewsAnalysis(null); // 清空舊資料，避免混淆

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, promptContext: keyword })
      });

      const data = await res.json();

      // [新增] 檢查後端是否回傳錯誤
      if (!res.ok || data.error) {
        throw new Error(data.error || `Server Error: ${res.status}`);
      }

      // [新增] 檢查資料格式是否正確 (避免讀取 undefined 導致崩潰)
      if (!data.hot_sector || !data.summary || !data.stocks) {
        throw new Error('AI 回傳格式不如預期，請重試');
      }

      setNewsAnalysis(data);

      if (data.stocks) {
        const codes = data.stocks.map(s => s.symbol);
        subscribeStocks(codes);
      }

    } catch (e) {
      console.error(e);
      // 這裡會把具體錯誤秀給你看，方便除錯
      alert(`分析失敗：${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 輔助函式：取得漲跌顏色
  const getPriceColor = (val) => {
    const num = parseFloat(val);
    if (num > 0) return 'text-red-600'; // 台股習慣紅漲
    if (num < 0) return 'text-green-600'; // 綠跌
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans">

      {/* 頂部導覽列 (模擬新聞網站 Header) */}
      <div className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              美股新聞 <span className="text-blue-600 text-sm font-normal ml-2">AI 戰情室</span>
            </h1>
            {/* 狀態燈號 */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isConnected ? <Wifi size={14}/> : <WifiOff size={14}/>}
              <span>{isConnected ? '報價連線中' : '報價中斷'}</span>
            </div>
          </div>

          {/* API Key 輸入區 (放在右上角比較不佔位) */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Key className="absolute left-2 top-2 text-gray-400" size={14} />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="輸入 Gemini API Key..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 w-48 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 導覽頁籤 */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <ul className="flex space-x-8 text-sm font-medium text-gray-600">
            <li className="py-3 border-b-2 border-blue-600 text-blue-600 cursor-pointer">重點新聞</li>
            <li className="py-3 hover:text-gray-900 cursor-pointer">熱門焦點</li>
            <li className="py-3 hover:text-gray-900 cursor-pointer">個股動態</li>
            <li className="py-3 hover:text-gray-900 cursor-pointer">經濟數據</li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-12 gap-8">

        {/* 左側主要內容 (新聞列表) - 佔 8 等份 */}
        <div className="col-span-12 lg:col-span-8">

          {/* 篩選工具列 (模仿截圖中的篩選區) */}
          <div className="bg-gray-50 p-4 rounded mb-6 flex flex-wrap gap-4 items-center border border-gray-100">
            <span className="font-bold text-gray-700">篩選新聞</span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="border border-gray-300 px-3 py-1.5 rounded text-sm w-48 focus:outline-none focus:border-blue-500"
              placeholder="關鍵字 (例: 台積電)"
            />
            <button
              onClick={analyzeMarket}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-1.5 rounded text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <RotateCcw className="animate-spin" size={14}/> : <Search size={14}/>}
              {loading ? 'AI 分析中...' : '搜尋'}
            </button>
            <button className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-1.5 rounded text-sm transition-colors">
              重設
            </button>
          </div>

          {/* 新聞列表呈現 */}
          <div className="space-y-6">
            {!newsAnalysis ? (
              <div className="text-center py-20 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <TrendingUp className="mx-auto mb-2 opacity-20" size={48} />
                <p>請輸入 API Key 並點擊搜尋，Gemini 將為您解析最新市場動態</p>
              </div>
            ) : (
              // 這裡顯示 Gemini 分析出的結果，模擬成新聞列表
              <div className="bg-white border-b border-gray-100 pb-6 flex gap-6 group">
                {/* 假圖 (因為 API 只有文字，我們用 Unsplash 隨機圖模擬新聞圖) */}
                <div className="w-1/3 overflow-hidden rounded bg-gray-100 hidden sm:block">
                   {/* 使用關鍵字當作圖片種子 */}
                   <img
                     src={`https://picsum.photos/seed/${newsAnalysis.hot_sector}/400/250`}
                     alt="News Thumbnail"
                     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                   />
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors cursor-pointer">
                    {/* 這裡組合一個像新聞的標題 */}
                    【市場焦點】{newsAnalysis.hot_sector} 領漲！AI 分析：{newsAnalysis.summary.substring(0, 20)}...
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">鉅亨網新聞</span>
                    <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                    <span className="flex items-center gap-1 text-red-500"><Zap size={12}/> 利多</span>
                  </div>

                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {newsAnalysis.summary}
                  </p>

                  {/* 關聯個股標籤 */}
                  <div className="flex gap-2">
                    {newsAnalysis.stocks.map(stock => (
                      <span key={stock.symbol} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200 cursor-pointer">
                        #{stock.name} ({stock.symbol})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右側側邊欄 (即時報價) - 佔 4 等份 */}
        <div className="col-span-12 lg:col-span-4 pl-0 lg:pl-4">
          <div className="sticky top-6">
            <h3 className="font-bold text-gray-800 text-lg mb-4 flex items-center gap-2 border-l-4 border-blue-600 pl-3">
              即時報價
            </h3>

            <div className="space-y-3">
              {newsAnalysis?.stocks?.map((stock) => {
                const liveData = marketData[stock.symbol] || {};
                const price = liveData.price || liveData.closePrice || '---';
                const change = liveData.limitUpDown || '0';

                return (
                  <div key={stock.symbol} className="bg-white p-4 rounded shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-gray-900 text-lg">{stock.symbol}</span>
                      <span className={`font-mono font-bold text-lg ${getPriceColor(change)}`}>
                        {price}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{stock.name}</span>
                      <span className={`${getPriceColor(change)} bg-gray-50 px-2 py-0.5 rounded`}>
                        {change}%
                      </span>
                    </div>
                    {/* Gemini 的簡短評語 */}
                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                      <span className="font-semibold text-blue-600">AI 觀點：</span>
                      {stock.reason}
                    </div>
                  </div>
                );
              })}

              {!newsAnalysis && (
                <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded">
                  尚未有觀察清單
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
