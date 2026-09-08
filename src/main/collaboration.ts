import { createServer, type Server as HttpServer } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { readTree } from './filesystem';

export type CollabStatus = { state: 'idle' | 'hosting' | 'connected' | 'error'; url?: string; token?: string; peers: number; nickname?: string; message?: string };
export type CollabEvent = { type: 'status' | 'chat' | 'file'; payload: unknown };

type Client = { ws: WebSocket; nickname: string };
let server: HttpServer | null = null;
let wss: WebSocketServer | null = null;
let socket: WebSocket | null = null;
let token = '';
let root = '';
let nickname = 'Aurora User';
let mode: 'host' | 'client' | null = null;
const clients = new Set<Client>();
const listeners = new Set<(event: CollabEvent) => void>();
let status: CollabStatus = { state: 'idle', peers: 0 };

const emit = (event: CollabEvent) => listeners.forEach(listener => listener(event));
const setStatus = (next: CollabStatus) => { status = next; emit({ type: 'status', payload: next }); };
const safeFiles = async (dir: string, base = dir, out: Array<{ path: string; content: string }> = []) => {
  if (out.length >= 200) return out;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'release') continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await safeFiles(absolute, base, out);
    else if (entry.isFile()) {
      const stat = await fs.stat(absolute);
      if (stat.size <= 1024 * 1024) {
        try { out.push({ path: path.relative(base, absolute).replaceAll(path.sep, '/'), content: await fs.readFile(absolute, 'utf8') }); } catch { /* binary/locked file */ }
      }
    }
    if (out.length >= 200) break;
  }
  return out;
};
const snapshot = async () => ({ files: await safeFiles(root), generatedAt: Date.now() });
const broadcast = (message: unknown, except?: WebSocket) => { const data = JSON.stringify(message); for (const client of clients) if (client.ws !== except && client.ws.readyState === WebSocket.OPEN) client.ws.send(data); };

export function onCollabEvent(listener: (event: CollabEvent) => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function getCollabStatus() { return status; }

export async function hostCollaboration(workspace: string, name = 'Aurora User', port = 0) {
  await stopCollaboration(); root = workspace; nickname = name.trim() || 'Aurora User'; token = crypto.randomBytes(18).toString('hex'); mode = 'host';
  server = createServer(); wss = new WebSocketServer({ server });
  wss.on('connection', (ws, request) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    if (requestUrl.searchParams.get('token') !== token) { ws.close(1008, 'Invalid collaboration token'); return; }
    const client: Client = { ws, nickname: requestUrl.searchParams.get('name') || 'Guest' }; clients.add(client); setStatus({ state: 'hosting', url: status.url, token, peers: clients.size, nickname });
    ws.send(JSON.stringify({ type: 'hello', nickname, workspace: path.basename(root) }));
    ws.on('message', async raw => {
      try {
        const message = JSON.parse(raw.toString()) as { type: string; text?: string };
        if (message.type === 'chat' && message.text?.trim()) { const payload = { nickname: client.nickname, text: message.text.trim(), at: Date.now() }; emit({ type: 'chat', payload }); broadcast({ type: 'chat', payload }); }
        if (message.type === 'sync') ws.send(JSON.stringify({ type: 'snapshot', payload: await snapshot() }));
      } catch { /* ignore malformed peer messages */ }
    });
    ws.on('close', () => { clients.delete(client); setStatus({ state: 'hosting', url: status.url, token, peers: clients.size, nickname }); });
  });
  await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(port, '0.0.0.0', () => resolve()); });
  const address = server.address(); const actualPort = typeof address === 'object' && address ? address.port : port;
  const localUrl = `ws://127.0.0.1:${actualPort}`;
  setStatus({ state: 'hosting', url: localUrl, token, peers: 0, nickname, message: 'Sessão criada. Para colaboração externa, encaminhe a porta ou use um relay WebSocket.' });
  return status;
}

export async function joinCollaboration(workspace: string, url: string, sessionToken: string, name = 'Aurora User') {
  await stopCollaboration(); root = workspace; nickname = name.trim() || 'Aurora User'; token = sessionToken.trim(); mode = 'client';
  if (!/^wss?:\/\//.test(url)) throw new Error('URL de colaboração inválida. Use ws:// ou wss://.');
  const endpoint = `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}&name=${encodeURIComponent(nickname)}`;
  socket = new WebSocket(endpoint);
  await new Promise<void>((resolve, reject) => {
    socket!.once('open', () => { setStatus({ state: 'connected', url, peers: 1, nickname }); resolve(); });
    socket!.once('error', () => reject(new Error('Não foi possível conectar à sessão.')));
  });
  socket.on('message', async raw => {
    try {
      const message = JSON.parse(raw.toString()) as { type: string; payload?: { nickname: string; text: string; at: number }; snapshot?: { files: Array<{ path: string; content: string }> } };
      if (message.type === 'chat' && message.payload) emit({ type: 'chat', payload: message.payload });
      if (message.type === 'snapshot' && message.snapshot) {
        for (const file of message.snapshot.files) {
          const target = path.resolve(root, file.path);
          if (!target.startsWith(path.resolve(root) + path.sep)) continue;
          await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, file.content, 'utf8');
        }
        emit({ type: 'file', payload: { count: message.snapshot.files.length } });
      }
    } catch { /* ignore malformed data */ }
  });
  socket.on('close', () => { if (mode === 'client') setStatus({ state: 'idle', peers: 0, message: 'Sessão encerrada pelo host.' }); });
  return status;
}

export async function syncCollaboration() {
  if (mode === 'host') { const data = await snapshot(); broadcast({ type: 'snapshot', payload: data }); emit({ type: 'file', payload: { count: data.files.length, sent: true } }); return data.files.length; }
  if (socket?.readyState === WebSocket.OPEN) { socket.send(JSON.stringify({ type: 'sync' })); return 1; }
  throw new Error('Nenhuma sessão de colaboração ativa.');
}
export function sendCollabChat(text: string) { if (!socket || socket.readyState !== WebSocket.OPEN) { if (mode === 'host') { const payload = { nickname, text: text.trim(), at: Date.now() }; emit({ type: 'chat', payload }); broadcast({ type: 'chat', payload }); return; } throw new Error('Nenhuma sessão conectada.'); } socket.send(JSON.stringify({ type: 'chat', text })); }
export async function stopCollaboration() { socket?.close(); socket = null; for (const client of clients) client.ws.close(); clients.clear(); await new Promise<void>(resolve => { if (!server) return resolve(); server.close(() => resolve()); }); wss?.close(); wss = null; server = null; mode = null; token = ''; root = ''; setStatus({ state: 'idle', peers: 0 }); }
export const collaborationTree = async (workspace: string) => readTree(workspace);
