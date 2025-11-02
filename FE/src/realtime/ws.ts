import type { IncomingRealtimeEvent, OutgoingRealtimeEvent } from './stt.types';

type MessageListener = (message: IncomingRealtimeEvent) => void;
type EventListener = (payload: IncomingRealtimeEvent['data']) => void;
type StatusListener = (state: RealtimeConnectionState) => void;

const DEFAULT_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;

export type RealtimeConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

export class RealtimeClient {
  private readonly url: string;

  private socket: WebSocket | null = null;

  private shouldReconnect = true;

  private reconnectAttempts = 0;

  private reconnectTimer: number | undefined;

  private status: RealtimeConnectionState = 'idle';

  private readonly listeners = new Set<MessageListener>();

  private readonly eventListeners = new Map<string, Set<EventListener>>();

  private readonly statusListeners = new Set<StatusListener>();

  private readonly queue: OutgoingRealtimeEvent[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (!this.url) {
      throw new Error('VITE_SIGNALING_URL이 설정되지 않았습니다.');
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.clearReconnectTimer();

    try {
      this.updateStatus('connecting');
      this.socket = new WebSocket(this.url);
      this.attachSocketHandlers(this.socket);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('WebSocket 연결 실패', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close();
    }
    this.updateStatus('closed');
  }

  send(event: OutgoingRealtimeEvent): void {
    if (!event?.event) {
      throw new Error('이벤트 이름이 필요합니다.');
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(event));
      return;
    }

    this.queue.push(event);
    this.connect();
  }

  onMessage(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribe(eventName: string, listener: EventListener): () => void {
    const listeners = this.eventListeners.get(eventName) ?? new Set<EventListener>();
    listeners.add(listener);
    this.eventListeners.set(eventName, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        this.eventListeners.delete(eventName);
      }
    };
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getStatus(): RealtimeConnectionState {
    return this.status;
  }

  private attachSocketHandlers(socket: WebSocket): void {
    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateStatus('open');
      this.flushQueue();
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as IncomingRealtimeEvent;
        if (!parsed?.event) {
          return;
        }
        this.listeners.forEach((listener) => listener(parsed));
        const eventSpecificListeners = this.eventListeners.get(parsed.event);
        if (eventSpecificListeners?.size) {
          eventSpecificListeners.forEach((listener) => listener(parsed.data));
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('WebSocket 메시지 파싱 실패', error);
      }
    };

    socket.onerror = (event) => {
      // eslint-disable-next-line no-console
      console.warn('WebSocket 오류 발생', event);
    };

    socket.onclose = () => {
      this.updateStatus('closed');
      this.socket = null;
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private flushQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.queue.length) {
      const message = this.queue.shift();
      if (message) {
        this.socket.send(JSON.stringify(message));
      }
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    const delay = Math.min(DEFAULT_BACKOFF_MS * 2 ** (this.reconnectAttempts - 1), MAX_BACKOFF_MS);
    this.updateStatus('connecting');
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private updateStatus(state: RealtimeConnectionState): void {
    this.status = state;
    this.statusListeners.forEach((listener) => listener(state));
  }
}

let sharedClient: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!sharedClient) {
    const url = import.meta.env.VITE_SIGNALING_URL;
    if (!url) {
      // eslint-disable-next-line no-console
      console.warn('VITE_SIGNALING_URL is not configured.');
    }
    sharedClient = new RealtimeClient(url ?? '');
  }
  return sharedClient;
}
