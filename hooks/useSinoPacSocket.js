import { useEffect, useRef, useState, useCallback } from 'react';
import pako from 'pako'; // [新增] 引入解壓縮套件

const WSS_URL = 'wss://mitakerainbowuat.mtkstock.com.tw:8633/';

const getFormattedTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getHours()}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const getPacketTime = () => {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

export function useSinoPacSocket(onAuthSuccess) {
  const socketRef = useRef(null);
  const tokenRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const snRef = useRef(1);
  const requestHistoryRef = useRef(new Map());

  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [marketData, setMarketData] = useState({});

  const addLog = useCallback((msg, type = 'info') => {
    const time = getFormattedTime();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
    // console.log(`[${time}] ${msg}`); // 可註解掉以減少 console 雜訊
  }, []);

  const sendPacket = useCallback((api, data = {}, extraFields = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const currentSn = snRef.current;
      const payload = {
        api, apiver: "1.0", sn: currentSn, token: tokenRef.current, ...extraFields,
        data: { time: getPacketTime(), ...data }
      };

      // Auth 特殊參數 (模擬 Android)
      if (api === 'auth') {
        delete payload.token;
        Object.assign(payload, {
          pid: "SNPK", app: "com.mtk", ver: "95", platform: "ANDROID",
          device: "PHONE", hid: "863818039530051", type: "HW",
          uid: "863818039530051", platform_os: "25", device_mode: "vivo X7"
        });
      }

      if (api !== 'hb') requestHistoryRef.current.set(currentSn, { api, data, extraFields });

      addLog(`發送 -> ${api} (SN:${currentSn})`, 'send');
      socketRef.current.send(JSON.stringify(payload));
      snRef.current += 1;
    } else {
      addLog(`發送失敗: Socket 未連線 (${api})`, 'error');
    }
  }, [addLog]);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    addLog(`正在連線至 ${WSS_URL}...`, 'info');

    try {
        socketRef.current = new WebSocket(WSS_URL);
        // [關鍵] 設定接收格式為 ArrayBuffer 以便 pako 解壓縮
        socketRef.current.binaryType = 'arraybuffer';
    } catch (e) {
        addLog(`WebSocket 建構失敗: ${e.message}`, 'error');
        return;
    }

    socketRef.current.onopen = () => {
      addLog('✅ WebSocket 連線成功 (Connected)', 'success');
      setIsConnected(true);
      snRef.current = 1;
      requestHistoryRef.current.clear();

      addLog('準備發送 Auth...', 'info');
      sendPacket('auth', { auth_key: "", US: "r", HK: "d" });
    };

    socketRef.current.onmessage = (event) => {
      try {
        let textData = '';

        // [關鍵修正] 判斷是否為二進位資料並解壓縮
        if (event.data instanceof ArrayBuffer) {
            try {
                // 使用 pako 解壓縮 Gzip
                textData = pako.inflate(new Uint8Array(event.data), { to: 'string' });
                // addLog(`解壓縮成功 (${event.data.byteLength} -> ${textData.length} bytes)`, 'info');
            } catch (err) {
                addLog(`解壓縮失敗: ${err.message}`, 'error');
                return;
            }
        } else {
            textData = event.data;
        }

        const response = JSON.parse(textData);
        const { api, sn, data } = response;

        // Log 顯示
        if (api !== 'hb') {
            addLog(`收到 <- ${api} (RC:${data?.rc})`, data?.rc === '000' ? 'success' : 'error');
        }

        // 408 Retry
        if (data?.rc === '408') {
            addLog(`⚠️ 收到 408 Timeout, 1秒後重試...`, 'warning');
            const original = requestHistoryRef.current.get(sn);
            if (original) setTimeout(() => sendPacket(original.api, original.data, original.extraFields), 1000);
            return;
        }
        if (data?.rc === '000' && sn) requestHistoryRef.current.delete(sn);

        // 處理 Auth
        if (api === 'auth') {
             if (data?.rc === '000') {
                tokenRef.current = data.token;
                addLog(`🔑 Auth 成功! Token 取得`, 'success');

                if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = setInterval(() => sendPacket('hb'), 10000);

                if (onAuthSuccess) onAuthSuccess();
             } else {
                addLog(`❌ Auth 失敗: RC=${data?.rc}`, 'error');
             }
        }

        // 處理報價
        if (api === 'quote' || api === 'sync') {
          const items = data.trendItems || [data];
          if (items && items.length > 0) {
             setMarketData(prev => {
                const newData = { ...prev };
                items.forEach(item => {
                    if (item.code) newData[item.code] = { ...newData[item.code], ...item };
                });
                return newData;
             });
          }
        }

      } catch (e) {
        addLog(`解析錯誤: ${e.message}`, 'error');
      }
    };

    socketRef.current.onclose = (event) => {
      setIsConnected(false);
      tokenRef.current = null;
      addLog(`❌ 連線中斷 (Code: ${event.code})`, 'error');

      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      addLog('🔄 3秒後嘗試重連...', 'warning');
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    socketRef.current.onerror = () => {
      addLog('⚠️ WebSocket 發生錯誤', 'error');
    };

  }, [sendPacket, addLog, onAuthSuccess]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const subscribeStocks = useCallback((codes) => {
    if (tokenRef.current) {
      sendPacket('push', { qtype: "US", reset: "n", codes });
    } else {
      addLog('訂閱失敗: 無 Token (請等待 Auth 成功)', 'error');
    }
  }, [sendPacket, addLog]);

  return { isConnected, marketData, subscribeStocks, logs };
}
