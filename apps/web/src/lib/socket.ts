import { io, type Socket } from "socket.io-client";

const STORAGE_KEY = "bot-wpp-auth";

function getSocketUrl(): string {
  const ws = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (ws) {
    return ws.replace(/\/$/, "");
  }
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
  return apiUrl.replace(/\/api\/?$/, "");
}

function readToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

let socket: Socket | null = null;

export function getSocket(token?: string | null): Socket {
  const authToken = token ?? readToken();
  if (!authToken) {
    throw new Error("Token de autenticação não encontrado");
  }

  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  socket = io(getSocketUrl(), {
    auth: { token: authToken },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
