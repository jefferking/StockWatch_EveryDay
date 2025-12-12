// hooks/useSinoPacSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';

const WSS_URL = 'wss://mitakerainbowuat.mtkstock.com.tw:8633/';

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
  const requestHistoryRef = useRef(new Map());

  const [isConnected, setIsConnected] = useState(false);
  // marketData 結構: { "AAPL.US": { price: "200", change: "1.2", history: [200, 201, 202...] } }
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
        data: { time: getFormattedTime(), ...data }
      };

      if (api === 'auth') {
        delete payload.token;
        Object.assign(payload, {
          pid: "SNPK", app: "com.mtk", ver: "95", platform: "ANDROID",
          device: "PHONE", hid: "863818039530051", type: "HW",
          uid: "863818039530051", platform_os: "25", device_mode: "vivo X7"
        });
      }

      if (api !== 'hb') requestHistoryRef.current.set(currentSn, { api, data, extraFields });

      console.log(`[Send ${api}]`, payload);
      socketRef.current.send(JSON.stringify(payload));
      snRef.current += 1;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    socketRef.current = new WebSocket(WSS_URL);

    socketRef.current.onopen = () => {
      console.log('✅ WebSocket Connected');
      snRef.current = 1;
      requestHistoryRef.current.clear();
      sendPacket('auth', { auth_key: "", US: "r", HK: "d" });
    };

    socketRef.current.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        const { api, sn, data } = response;
        const rc = data?.rc;

        if (rc === '408') {
          const originalRequest = requestHistoryRef.current.get(sn);
          if (originalRequest) {
            setTimeout(() => sendPacket(originalRequest.api, originalRequest.data, originalRequest.extraFields), 1000);
          }
          return;
        }

        if (rc === '000' && sn) requestHistoryRef.current.delete(sn);

        if (api === 'auth' && rc === '000') {
          tokenRef.current = data.token;
          setIsConnected(true);
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => sendPacket('hb'), 10000);
        }

        // 處理 Quote (快照)
        if (api === 'quote' || api === 'sync') {
          const items = data.trendItems || [data];
          if (items) {
            setMarketData(prev => {
              const newData = { ...prev };
              items.forEach(item => {
                if (item.code) newData[item.code] = { ...newData[item.code], ...item };
              });
              return newData;
            });
          }
        }

        // 處理 Trend (走勢圖 - API 5)
        if (api === 'trend' && rc === '000') {
            const code = data.code;
            const trendItems = data.trendItems || [];
            // 只取收盤價 (closePrice) 來畫線
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

    socketRef.current.onclose = () => {
      setIsConnected(false);
      tokenRef.current = null;
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    socketRef.current.onerror = () => socketRef.current.close();

  }, [sendPacket]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  // [新功能] 初始股票監控流程：Quote -> Chart(Trend) -> Push
  const initStockWatch = (codes) => {
    if (isConnected && tokenRef.current) {
        codes.forEach(code => {
            // 1. 先抓 Quote (快照)
            sendPacket('quote', { qtype: "US", codes: [code] });

            // 2. 再抓 Trend (走勢圖 - 預設抓當日完整)
            sendPacket('trend', { qtype: "US", code: code, startTime: "0" });
        });

        // 3. 最後訂閱 Push
        sendPacket('push', { qtype: "US", reset: "n", codes: codes });
    }
  };

  return { isConnected, marketData, initStockWatch };
}
