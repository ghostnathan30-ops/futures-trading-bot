const WS = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

type Handler = (data: any) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Handler[]> = new Map();
  private reconnectTimer: any;

  connect() {
    const token = localStorage.getItem("token") ?? "";
    this.ws = new WebSocket(`${WS}/ws?token=${token}`);
    this.ws.onmessage = (e) => {
      const { event, data } = JSON.parse(e.data);
      this.handlers.get(event)?.forEach(fn => fn(data));
    };
    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
  }

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}

export const wsClient = new WSClient();
