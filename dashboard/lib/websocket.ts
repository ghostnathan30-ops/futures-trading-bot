const WS = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

type Handler = (data: any) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Handler[]> = new Map();
  private reconnectTimer: any;
  private _connected = false;
  private _statusListeners: ((c: boolean) => void)[] = [];

  get connected() {
    return this._connected;
  }

  connect() {
    if (typeof window === "undefined") return; // SSR guard
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    )
      return; // no duplicate sockets

    const token = localStorage.getItem("token") ?? "";
    this.ws = new WebSocket(`${WS}/ws?token=${token}`);

    this.ws.onopen = () => {
      this._connected = true;
      this._notify(true);
    };

    this.ws.onmessage = (e) => {
      try {
        const { event, data } = JSON.parse(e.data);
        this.handlers.get(event)?.forEach((fn) => fn(data));
      } catch {
        // malformed message — ignore
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this._notify(false);
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = () => {
      this._connected = false;
      this._notify(false);
      // onclose always fires after onerror — it handles reconnect
    };
  }

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: Handler) {
    const list = this.handlers.get(event);
    if (list) this.handlers.set(event, list.filter((fn) => fn !== handler));
  }

  onStatusChange(fn: (c: boolean) => void): () => void {
    this._statusListeners.push(fn);
    return () => {
      this._statusListeners = this._statusListeners.filter((f) => f !== fn);
    };
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private _notify(c: boolean) {
    this._statusListeners.forEach((fn) => fn(c));
  }
}

export const wsClient = new WSClient();
