// hooks/useSinoPacSocket.js
import { useEffect, useRef, useState, useCallback } from 'react';
import pako from 'pako'; // 確保 pako 套件已安裝

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

      // 維持 Android 身份偽裝
      if (api === 'auth') {
        delete payload.token;
        Object.assign(payload, {
          pid: "SNPK",
          app: "com.mtk",
          ver: "95",
          platform: "ANDROID",
          device: "PHONE",
          hid: "863818039530051",
          type: "HW",
          uid: "863818039530051",
          platform_os: "25",
          device_mode: "vivo X7"
        });
      }

      if (api !== 'hb') requestHistoryRef.current.set(currentSn, { api, data, extraFields });

      socketRef.current.send(JSON.stringify(payload));
      snRef.current += 1;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    console.log('連線中...');
    socketRef.current = new WebSocket(WSS_URL);

    // 保持 BinaryType 為 arraybuffer 以處理 GZIP
    socketRef.current.binaryType = 'arraybuffer';

    socketRef.current.onopen = () => {
      console.log('✅ WebSocket Connected');
      snRef.current = 1;
      requestHistoryRef.current.clear();

      // [修改] Auth 只請求 US (美股) 和 HK (港股)，移除 TW
      sendPacket('auth', {
        auth_key: "",
        US: "r",
        HK: "d"
      });
    };

    socketRef.current.onmessage = (event) => {
      try {
        let textData = '';

        // GZIP 解壓縮處理
        if (event.data instanceof ArrayBuffer) {
            try {
                const uint8Array = new Uint8Array(event.data);
                textData = pako.ungzip(uint8Array, { to: 'string' });
            } catch (err) {
                console.error('GZIP 解壓失敗', err);
                return;
            }
        } else {
            textData = event.data;
        }

        const response = JSON.parse(textData);
        const { api, sn, data } = response;
        const rc = data?.rc;

        if (rc === '408') {
          console.warn(`⚠️ 408 Timeout (SN: ${sn}), Retrying...`);
          const req = requestHistoryRef.current.get(sn);
          if (req) setTimeout(() => {
             sendPacket(req.api, req.data, req.extraFields);
             requestHistoryRef.current.delete(sn);
          }, 1000);
          return;
        }

        if (rc === '000' && sn) requestHistoryRef.current.delete(sn);

        if (api === 'auth' && rc === '000') {
          tokenRef.current = data.token;
          setIsConnected(true);
          console.log('🔑 Auth Success');
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => sendPacket('hb'), 10000);
        }

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

        if (api === 'trend' && rc === '000') {
            const code = data.code;
            const trendItems = data.trendItems || [];
            const history = trendItems.map(t => parseFloat(t.closePrice));
            setMarketData(prev => ({
                ...prev,
                [code]: { ...prev[code], history: history }
            }));
        }

      } catch (e) {
        console.error("Data Parse Error:", e);
      }
    };

    socketRef.current.onclose = () => {
      setIsConnected(false);
      tokenRef.current = null;
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    socketRef.current.onerror = (err) => {
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

  const initStockWatch = useCallback((codes) => {
    if (isConnected && tokenRef.current) {
        codes.forEach(code => {
            // 自動判斷：如果是 .HK 結尾就查港股，否則查美股
            const qtype = code.includes('.HK') ? 'HK' : 'US';
            sendPacket('quote', { qtype: qtype, codes: [code] });
            sendPacket('trend', { qtype: qtype, code: code, startTime: "0" });
        });

        // 分開訂閱美股和港股 (這裡做簡單處理，假設 codes 混雜)
        const usCodes = codes.filter(c => !c.includes('.HK'));
        const hkCodes = codes.filter(c => c.includes('.HK'));

        if (usCodes.length > 0) sendPacket('push', { qtype: "US", reset: "n", codes: usCodes });
        if (hkCodes.length > 0) sendPacket('push', { qtype: "HK", reset: "n", codes: hkCodes });
    }
  }, [isConnected, sendPacket]);

  return { isConnected, marketData, initStockWatch };
}
