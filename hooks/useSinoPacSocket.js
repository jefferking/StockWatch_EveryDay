import { useEffect, useRef, useState, useCallback } from 'react';

const WSS_URL = 'wss://mitakerainbowuat.mtkstock.com.tw:8633/';

const getFormattedTime = () => {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  return `${now.getHours()}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`; // 簡化時間顯示
};

// 產生完整 YYYYMMDDHHMMSS 給封包用
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

  // [新增] 除錯日誌 State
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [marketData, setMarketData] = useState({});

  // [新增] 寫入日誌的輔助函式
  const addLog = useCallback((msg, type = 'info') => {
    const time = getFormattedTime();
    setLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50)); // 只保留最近 50 筆
    console.log(`[${time}] ${msg}`);
  }, []);

  const sendPacket = useCallback((api, data = {}, extraFields = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const currentSn = snRef.current;
      const payload = {
        api, apiver: "1.0", sn: currentSn, token: tokenRef.current, ...extraFields,
        data: { time: getPacketTime(), ...data }
      };

      if (api === 'auth') {
        delete payload.token;
        Object.assign(payload, {
          pid: "SNPK", app: "com.mtk", ver: "95", platform: "ANDROID",
          device: "PHONE", hid: "863818039530051", type: "HW",
          uid: "863818039530051", platform_os: "25", device_mode: "vivo X7"
        });
      }

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
    } catch (e) {
        addLog(`WebSocket 建構失敗: ${e.message}`, 'error');
        return;
    }

    socketRef.current.onopen = () => {
      addLog('✅ WebSocket 連線成功 (Connected)', 'success');
      setIsConnected(true);
      snRef.current = 1;

      // 連線後馬上發送 Auth
      addLog('準備發送 Auth...', 'info');
      sendPacket('auth', { auth_key: "", US: "r", HK: "d" });
    };

    socketRef.current.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        const { api, sn, data } = response;

        // 只記錄非心跳的 Log，避免洗版
        if (api !== 'hb') {
            addLog(`收到 <- ${api} (RC:${data?.rc})`, data?.rc === '000' ? 'success' : 'error');
        }

        if (api === 'auth') {
             if (data?.rc === '000') {
                tokenRef.current = data.token;
                addLog(`🔑 Auth 成功! Token 取得`, 'success');

                // 啟動心跳
                if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = setInterval(() => sendPacket('hb'), 10000);

                if (onAuthSuccess) onAuthSuccess();
             } else {
                addLog(`❌ Auth 失敗: RC=${data?.rc}`, 'error');
             }
        }

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
      // 顯示斷線原因代碼 (重要！)
      addLog(`❌ 連線中斷 (Code: ${event.code}, Reason: ${event.reason || '無'})`, 'error');

      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      addLog('🔄 3秒後嘗試重連...', 'warning');
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    socketRef.current.onerror = (err) => {
      // 瀏覽器基於安全原因，onerror 通常不給詳細資訊，只能知道有錯
      addLog('⚠️ WebSocket 發生錯誤 (請檢查瀏覽器 Console Network 標籤)', 'error');
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
      addLog('訂閱失敗: 無 Token', 'error');
    }
  }, [sendPacket, addLog]);

  // 回傳 logs 供外部顯示
  return { isConnected, marketData, subscribeStocks, logs };
}
