// hooks/useSinoPacSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';

const WSS_URL = 'wss://mitakerainbowuat.mtkstock.com.tw:8633/';

const getFormattedTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

export function useSinoPacSocket(onAuthSuccess) { // [新增] 接收一個回調函式
  const socketRef = useRef(null);
  const tokenRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const snRef = useRef(1);
  const requestHistoryRef = useRef(new Map());

  const [isConnected, setIsConnected] = useState(false);
  const [marketData, setMarketData] = useState({});

  const sendPacket = useCallback((api, data = {}, extraFields = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const currentSn = snRef.current;
      const payload = {
        api, apiver: "1.0", sn: currentSn, token: tokenRef.current, ...extraFields,
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

      // console.log(`[Send ${api}]`, payload); // 減少 log
      socketRef.current.send(JSON.stringify(payload));
      snRef.current += 1;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    socketRef.current = new WebSocket(WSS_URL);

    socketRef.current.onopen = () => {
      console.log('✅ WebSocket Connected');
      snRef.current = 1;
      requestHistoryRef.current.clear();
      // 連線後馬上 Auth
      sendPacket('auth', { auth_key: "", US: "r", HK: "d" });
    };

    socketRef.current.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        const { api, sn, data } = response;

        // 408 重試邏輯
        if (data?.rc === '408') {
            const original = requestHistoryRef.current.get(sn);
            if (original) setTimeout(() => sendPacket(original.api, original.data, original.extraFields), 1000);
            return;
        }
        if (data?.rc === '000' && sn) requestHistoryRef.current.delete(sn);

        // Auth 成功
        if (api === 'auth' && data?.rc === '000') {
          tokenRef.current = data.token;
          setIsConnected(true);
          console.log('🔑 Auth Success');

          // 啟動心跳
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => sendPacket('hb'), 10000);

          // [關鍵] 通知外部組件：連線好了，可以訂閱了！
          if (onAuthSuccess) onAuthSuccess();
        }

        // 處理報價與走勢
        if (api === 'quote' || api === 'sync' || api === 'tick') {
          const items = data.trendItems || [data];
          if (items) {
            setMarketData(prev => {
              const newData = { ...prev };
              items.forEach(item => {
                if (item.code) {
                  // 簡單合併邏輯
                  newData[item.code] = { ...newData[item.code], ...item };
                }
              });
              return newData;
            });
          }
        }
      } catch (e) { console.error(e); }
    };

    socketRef.current.onclose = () => {
      console.log('❌ Disconnected, retrying in 3s...');
      setIsConnected(false);
      tokenRef.current = null;
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

  }, [sendPacket, onAuthSuccess]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const subscribeStocks = useCallback((codes) => {
    if (tokenRef.current) {
      // 使用疊加模式 (reset: "n") 避免覆蓋
      sendPacket('push', { qtype: "US", reset: "n", codes });
    }
  }, [sendPacket]);

  return { isConnected, marketData, subscribeStocks };
}
