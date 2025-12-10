"use client";
import { useState, useEffect } from 'react';
import { useSinoPacSocket } from '../hooks/useSinoPacSocket';
import { ArrowUp, ArrowDown, RefreshCw, Cpu, TrendingUp } from 'lucide-react';

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [newsAnalysis, setNewsAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const { isConnected, marketData, subscribeStocks } = useSinoPacSocket();

  // 觸發 Gemini 分析
  const analyzeMarket = async () => {
    if (!apiKey) return alert('請輸入 Gemini API Key');
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      const data = await res.json();
      setNewsAnalysis(data);

      // 分析完成後，自動訂閱提到的股票
      if (data.stocks) {
        const codes = data.stocks.map(s => s.symbol);
        console.log('訂閱股票:', codes);
        subscribeStocks(codes);
      }
    } catch (e) {
      console.error(e);
      alert('分析失敗');
    } finally {
      setLoading(false);
    }
  };

  // 顏色輔助函式
  const getPriceColor = (change) => {
    const val = parseFloat(change);
    if (val > 0) return 'text-red-500'; // 台股/美股習慣 紅漲
    if (val < 0) return 'text-green-500'; // 綠跌
    return 'text-gray-500';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI 美股戰情室
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Gemini 解析新聞 x 永豐金 WebSocket 即時報價
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-400">{isConnected ? '報價連線中' : '連線中斷'}</span>
        </div>
      </header>

      {/* 設定區 */}
      <div className="mb-8 bg-gray-800 p-4 rounded-lg flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Gemini API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="請輸入 API Key..."
          />
        </div>
        <button
          onClick={analyzeMarket}
          disabled={loading || !isConnected}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? <RefreshCw className="animate-spin w-4 h-4"/> : <Cpu className="w-4 h-4"/>}
          {loading ? 'AI 分析中...' : '掃描市場'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左側：AI 新聞分析結果 */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="text-yellow-400 w-5 h-5"/> 市場熱點解析
          </h2>

          {newsAnalysis ? (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
              <div>
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Hot Sector</span>
                <p className="text-lg font-bold text-white">{newsAnalysis.hot_sector}</p>
              </div>
              <div className="border-t border-gray-700 pt-4">
                <span className="text-xs font-bold text-gray-400 uppercase">Summary</span>
                <p className="text-gray-300 mt-1 leading-relaxed text-sm">
                  {newsAnalysis.summary}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-10 bg-gray-800/50 rounded-xl border border-dashed border-gray-700">
              等待 AI 分析...
            </div>
          )}
        </div>

        {/* 右側：即時報價卡片 */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-6">重點觀察股 (Real-time)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newsAnalysis?.stocks?.map((stock) => {
              const liveData = marketData[stock.symbol] || {};
              const price = liveData.price || liveData.closePrice || '---';
              const change = liveData.limitUpDown || '0';
              const volume = liveData.volume || '---';

              return (
                <div key={stock.symbol} className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition-colors relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">{stock.symbol}</h3>
                      <p className="text-sm text-gray-400">{stock.name}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-mono font-bold ${getPriceColor(change)}`}>
                        {price}
                      </div>
                      <div className={`flex items-center justify-end gap-1 text-sm ${getPriceColor(change)}`}>
                        {parseFloat(change) > 0 ? <ArrowUp size={14}/> : <ArrowDown size={14}/>}
                        {change}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">成交量</span>
                      <span className="text-gray-300 font-mono">{volume}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">AI 觀點</span>
                      <span className="text-blue-300 text-xs max-w-[60%] text-right">{stock.reason}</span>
                    </div>
                  </div>

                  {/* 裝飾用的背景效果 */}
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                </div>
              );
            })}
          </div>

          {!newsAnalysis && (
             <div className="text-gray-500 text-center py-20">
               請輸入 Key 並點擊「掃描市場」以獲取即時列表
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
