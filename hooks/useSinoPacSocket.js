// hooks/useSinoPacSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';

const WSS_URL = 'wss://mitakerainbowuat.mtkstock.com.tw:8633/';

// 產生 YYYYMMDDHHMMSS 格式時間
const getFormattedTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

export function useSinoPacSocket() {
  const socketRef = useRef(null);
  const tokenRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const snRef = useRef(1);

  // 記錄發送過的請求，用於 408 錯誤時重試
  const requestHistoryRef = useRef(new Map());

  const [isConnected, setIsConnected] = useState(false);
  // marketData 結構: { "AAPL.US": { price: "200", change: "1.2", history: [...] } }
  const [marketData, setMarketData] = useState({});

  const sendPacket = useCallback((api, data = {}, extraFields = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const currentSn = snRef.current;

      const payload = {
        api: api,
        apiver: "1.0",
        sn: currentSn,
        token: tokenRef.current,
        ...extraFields,
        data: {
          time: getFormattedTime(),
          ...data
        }
      };

      // [關鍵修改] 根據 WebSocketTest.py，完全模擬 Android 裝置的 Auth 參數
      if (api === 'auth') {
        delete payload.token; // Auth 不需要 token
        Object.assign(payload, {
          pid: "SNPK",              // 修改: 改為 SNPK (Android)
          app: "com.mtk",           // 修改: 改為 com.mtk
          ver: "95",                // 修改: 版本號 95
          platform: "ANDROID",      // 修改: 平台 ANDROID
          device: "PHONE",
          hid: "863818039530051",   // 複製腳本中的 ID
          type: "HW",
          uid: "863818039530051",   // 複製腳本中的 UID
          platform_os: "25",
          device_mode: "vivo X7"    // 模擬機型
        });
      }

      // 記錄請求以便重試 (排除心跳 hb)
      if (api !== 'hb') {
        requestHistoryRef.current.set(currentSn, { api, data, extraFields });
      }

      console.log(`[Send ${api} SN:${currentSn}]`, payload);
      socketRef.current.send(JSON.stringify(payload));

      snRef.current += 1;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    console.log('連線中...');
    socketRef.current = new WebSocket(WSS_URL);

    socketRef.current.onopen = () => {
      console.log('✅ WebSocket Connected');
      snRef.current = 1;
      requestHistoryRef.current.clear();

      // 1. 連線成功，發送 Auth (包含 TW, US, HK 權限)
      sendPacket('auth', {
        auth_key: "",
        US: "r",
        HK: "d"
      });
    };

    socketRef.current.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        const { api, sn, data } = response;
        const rc = data?.rc;

        // console.log(`[Recv ${api}]`, response); // 除錯用，訊息太多可註解掉

        // --- 處理 408 Timeout 重試機制 ---
        if (rc === '408') {
          console.warn(`⚠️ 收到 408 Timeout (SN: ${sn})，1秒後重試...`);
          const originalRequest = requestHistoryRef.current.get(sn);
          if (originalRequest) {
            setTimeout(() => {
              console.log(`🔄 重試請求...`);
              sendPacket(originalRequest.api, originalRequest.data, originalRequest.extraFields);
              requestHistoryRef.current.delete(sn); // 移除舊紀錄
            }, 1000);
          }
          return;
        }

        // 成功則移除歷史紀錄
        if (rc === '000' && sn) {
          requestHistoryRef.current.delete(sn);
        }

        // --- 業務邏輯 ---

        // 1. Auth 成功
        if (api === 'auth' && rc === '000') {
          tokenRef.current = data.token;
          setIsConnected(true);
          console.log('🔑 Auth 成功, Token:', tokenRef.current);

          // 啟動心跳 (10秒一次，參考腳本)
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => {
            sendPacket('hb');
          }, 10000);
        }

        // 2. 處理報價 (Quote / Sync)
        if (api === 'quote' || api === 'sync') {
          const items = data.trendItems || [data];
          if (items) {
            setMarketData(prev => {
              const newData = { ...prev };
              items.forEach(item => {
                if (item.code) {
                  // 合併新舊資料
                  newData[item.code] = { ...newData[item.code], ...item };
                }
              });
              return newData;
            });
          }
        }

        // 3. 處理走勢圖 (Trend)
        if (api === 'trend' && rc === '000') {
            const code = data.code;
            const trendItems = data.trendItems || [];
            // 只取收盤價畫圖
            const history = trendItems.map(t => parseFloat(t.closePrice));

            setMarketData(prev => ({
                ...prev,
                [code]: { ...prev[code], history: history }
            }));
        }

      } catch (e) {
        console.error("Parse Error:", e);
      }
    };

    socketRef.current.onclose = (event) => {
      console.log('❌ Disconnected', event.reason);
      setIsConnected(false);
      tokenRef.current = null;

      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      // 斷線 3 秒後重連
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('🔄 嘗試重新連線...');
        connect();
      }, 3000);
    };

    socketRef.current.onerror = (err) => {
      console.error('WebSocket Error:', err);
      socketRef.current.close();
    };

  }, [sendPacket]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  // 初始化股票監控流程：Quote -> Chart -> Push
  const initStockWatch = useCallback((codes) => {
    if (isConnected && tokenRef.current) {
        // 避免重複發送過多請求，這裡可以做個簡單的檢查或直接發送
        codes.forEach(code => {
            // 1. 抓 Quote
            sendPacket('quote', { qtype: "US", codes: [code] });

            // 2. 抓 Trend (走勢)
            sendPacket('trend', { qtype: "US", code: code, startTime: "0" });
        });

        // 3. 訂閱 Push (reset: "y" 代表重置之前的訂閱，只聽這些)
        sendPacket('push', { qtype: "US", reset: "y", codes: codes });
    }
  }, [isConnected, sendPacket]); // 加入依賴

  return { isConnected, marketData, initStockWatch };
}
