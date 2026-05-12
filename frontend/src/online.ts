// WebSocket client helper for online 1x1 matches
import { Platform } from 'react-native';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://shinobi-arena-api.onrender.com';

export function wsUrl(code: string): string {
  // Replace http(s)://host with ws(s)://host
  const u = BASE.replace(/^http/, 'ws');
  return `${u}/api/ws/${encodeURIComponent(code)}`;
}

export async function apiCreateRoom(turnMinutes: number): Promise<{ code: string }> {
  const r = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnMinutes }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(t || 'Falha ao criar sala');
  }
  return r.json();
}

export async function apiCheckRoom(code: string): Promise<{ code: string; full: boolean; config: { turnMinutes: number } }> {
  const r = await fetch(`${BASE}/api/rooms/${encodeURIComponent(code)}`);
  if (r.status === 404) throw new Error('Sala não encontrada.');
  if (!r.ok) throw new Error('Erro de conexão.');
  return r.json();
}

export type WSEvent =
  | { type: 'ready'; you: 'host' | 'guest'; code: string; config: { turnMinutes: number }; opponent: any | null }
  | { type: 'opponent_joined'; opponent: any; config: { turnMinutes: number } }
  | { type: 'opponent_disconnected' }
  | { type: 'relay'; from: 'host' | 'guest'; payload: any }
  | { type: 'error'; code?: string; message: string }
  | { type: 'pong' };

export class RoomClient {
  ws: WebSocket | null = null;
  closedByUser = false;
  onEvent?: (e: WSEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;

  connect(code: string, role: 'host' | 'guest', player: { name: string; village: string; image?: string }) {
    const url = wsUrl(code);
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: 'hello', role, player }));
      } catch {}
      this.onOpen?.();
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
        this.onEvent?.(data);
      } catch {}
    };
    ws.onerror = () => {
      this.onEvent?.({ type: 'error', message: 'Erro de conexão.' });
    };
    ws.onclose = () => {
      this.onClose?.();
    };
  }

  sendRelay(payload: any) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify({ type: 'relay', payload })); } catch {}
    }
  }

  close() {
    this.closedByUser = true;
    try { this.ws?.close(); } catch {}
    this.ws = null;
  }
}
