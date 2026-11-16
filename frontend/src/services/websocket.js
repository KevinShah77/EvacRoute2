// Real-time WebSocket Client for EvacRoute

class EmergencyWebSocket {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.isConnected = false;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/emergency`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        console.log('[EvacRoute WS] Connected to emergency broadcast channel');
        this.emit('connection_change', { connected: true });
        
        // Heartbeat
        this.pingTimer = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          }
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;
          console.log(`[EvacRoute WS Event] ${type}`, data);
          this.emit(type, data);
          this.emit('*', message);
        } catch (e) {
          console.warn('[EvacRoute WS] Invalid message format', event.data);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        clearInterval(this.pingTimer);
        this.emit('connection_change', { connected: false });
        console.log('[EvacRoute WS] Disconnected. Reconnecting in 3s...');
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[EvacRoute WS] Error occurred:', err);
      };
    } catch (e) {
      console.warn('[EvacRoute WS] Connection attempt failed:', e);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EvacRoute WS Callback Error] on ${event}:`, err);
        }
      }
    }
  }
}

export const emergencyWS = new EmergencyWebSocket();
