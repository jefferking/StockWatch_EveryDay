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
  const [isConnected, setIsConnected] = useState(false);
  const [marketData, setMarketData] = useState({}); // 儲存股票報價

  const sendPacket = useCallback((api, data = {}, extraFields = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const payload = {
        api: api,
        apiver: "1.0",
        sn: Date.now() % 32767, // 簡單的序號生成
        token: tokenRef.current, // 自動帶入 token (如果有)
        ...extraFields,
        data: {
          time: getFormattedTime(),
          ...data
        }
      };

      // auth 特殊處理：不需要 token 在外層，且有額外 header 欄位
      if (api === 'auth') {
        delete payload.token;
        Object.assign(payload, {
          pid: "SNPW",
          app: "com.snp.web",
          ver: "1.0.0",
          platform: "WEB",
          device: "BROWSER",
          hid: "user-agent-browser", // 實際應用可用瀏覽器指紋
          type: "SEC",
          uid: "GUEST_USER", // 這裡在正式環境應為真實帳號
          platform_os: "WebOS",
          device_mode: "Browser"
        });
      }

      console.log(`[Send ${api}]`, payload);
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const connect = useCallback(() => {
    socketRef.current = new WebSocket(WSS_URL);

    socketRef.current.onopen = () => {
      console.log('WebSocket Connected');
      // 1. 連線成功後，發送 Auth (參照文件 1.0.25 第1點)
      sendPacket('auth', {
        auth_key: "",
        US: "r", // 美股即時
        HK: "n",
        TW: "n"
      });
    };

    socketRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      console.log('[Received]', response);

      // 處理 Auth 回應
      if (response.api === 'auth' && response.data?.rc === '000') {
        tokenRef.current = response.data.token;
        setIsConnected(true);
        console.log('Auth Success, Token:', tokenRef.current);

        // 2. Auth 成功後，啟動心跳 (參照文件 第2點 hb)
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          sendPacket('hb');
        }, 10000); // 10秒一次
      }

      // 處理即時報價 (sync 或 quote 回應)
      if (response.api === 'quote' || response.api === 'sync') {
        const items = response.data.trendItems || [response.data]; // sync 有時是單筆
        if (items) {
          setMarketData(prev => {
            const newData = { ...prev };
            items.forEach(item => {
              // 根據文件更新價格、漲跌幅
              if (item.code) {
                newData[item.code] = { ...newData[item.code], ...item };
              }
            });
            return newData;
          });
        }
      }
    };

    socketRef.current.onclose = () => {
      console.log('Disconnected');
      setIsConnected(false);
      clearInterval(heartbeatIntervalRef.current);
    };

  }, [sendPacket]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      clearInterval(heartbeatIntervalRef.current);
    };
  }, [connect]);

  // 暴露訂閱功能 (參照文件 第8點 push)
  const subscribeStocks = (codes) => {
    if (isConnected && tokenRef.current) {
      sendPacket('push', {
        qtype: "US",
        reset: "n",
        codes: codes // e.g. ["AAPL.US", "NVDA.US"]
      });
    }
  };

  return { isConnected, marketData, subscribeStocks };
}
