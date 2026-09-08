import { createServer, type Server as HttpServer } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';

export type CollabRole = 'owner' | 'editor' | 'viewer';
export type CollabPeer = { id: string; nickname: string; role: CollabRole; color: string; connectedAt: number };
export type CollabStatus = { state: 'idle' | 'hosting' | 'connected' | 'error'; url?: string; token?: string; peers: number; nickname?: string; peerList?: CollabPeer[]; message?: string };
export type CollabEvent = { type: 'status' | 'chat' | 'file' | 'presence' | 'cursor' | 'conflict'; payload: unknown };
type FileEntry = { path: string; content: string; version?: number };
type Client = { ws: WebSocket; id: string; nickname: string; role: CollabRole; color: string; connectedAt: number };
let server: HttpServer | null = null; let wss: WebSocketServer | null = null; let socket: WebSocket | null = null;
let token = ''; let root = ''; let nickname = 'Aurora User'; let mode: 'host' | 'client' | null = null; let clientId: string = crypto.randomUUID(); let reconnectTimer: NodeJS.Timeout | null = null;
const clients = new Map<string, Client>(); const listeners = new Set<(event: CollabEvent) => void>(); const versions = new Map<string, number>();
const peerColors = ['#9ec5d8', '#c7a8e8', '#9ed0ad', '#e4b58b', '#d89cae', '#b8c8a0'];
let status: CollabStatus = { state: 'idle', peers: 0, peerList: [] };
const emit = (event: CollabEvent) => listeners.forEach(listener => listener(event));
const peers = (): CollabPeer[] => [...clients.values()].map(c => ({ id: c.id, nickname: c.nickname, role: c.role, color: c.color, connectedAt: c.connectedAt }));
const updateStatus = (state: CollabStatus['state'], message?: string) => { status = { ...status, state, peers: clients.size, peerList: peers(), message }; emit({ type: 'status', payload: status }); emit({ type: 'presence', payload: status.peerList }); };
const send = (ws: WebSocket, message: unknown) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
const broadcast = (message: unknown, except?: WebSocket) => { for (const c of clients.values()) if (c.ws !== except) send(c.ws, message); };
const relativeFilePath = (filePath: string) => { const normalized = filePath.replaceAll('\\', '/'); const base = path.resolve(root).replaceAll(path.sep, '/').replace(/\/$/, ''); if (path.isAbsolute(filePath) || normalized.startsWith(`${base}/`)) return path.relative(root, filePath).replaceAll(path.sep, '/'); return normalized.replace(/^\.\//, ''); };
const safePath = (filePath: string) => { if (!filePath || path.isAbsolute(filePath)) return null; const target = path.resolve(root, filePath); return target.startsWith(path.resolve(root) + path.sep) ? target : null; };
const safeFiles = async (dir: string, base = dir, out: FileEntry[] = []): Promise<FileEntry[]> => {
  if (out.length >= 200) return out; let entries; try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) { if (['node_modules', '.git', 'dist', 'release'].includes(entry.name)) continue; const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await safeFiles(absolute, base, out); else if (entry.isFile()) { try { const stat = await fs.stat(absolute); const relative = path.relative(base, absolute).replaceAll(path.sep, '/'); if (stat.size <= 1024 * 1024) out.push({ path: relative, content: await fs.readFile(absolute, 'utf8'), version: versions.get(relative) ?? 0 }); } catch {} }
    if (out.length >= 200) break;
  } return out;
};
const snapshot = async () => ({ files: await safeFiles(root), generatedAt: Date.now() });
async function applyEdit(rawPath: string, content: string, baseVersion: number, source?: WebSocket, requestId: string = crypto.randomUUID(), sourceId: string = clientId) {
  const filePath = relativeFilePath(rawPath); const target = safePath(filePath); if (!target) throw new Error('Caminho de arquivo inválido.'); if (content.length > 1024 * 1024) throw new Error('Arquivo colaborativo excede 1 MB.');
  const current = versions.get(filePath) ?? 0;
  if (baseVersion !== current) { const payload = { path: filePath, content: await fs.readFile(target, 'utf8').catch(() => ''), version: current, requestId }; emit({ type: 'conflict', payload }); if (source) send(source, { type: 'conflict', payload }); return false; }
  await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, 'utf8'); const version = current + 1; versions.set(filePath, version);
  const payload = { path: filePath, content, version, clientId: sourceId, requestId }; broadcast({ type: 'edit', payload }, source); if (source) send(source, { type: 'edit-ack', payload }); emit({ type: 'file', payload }); return true;
}
export function onCollabEvent(listener: (event: CollabEvent) => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function getCollabStatus() { return status; }
export async function hostCollaboration(workspace: string, name = 'Aurora User', port = 0) {
  await stopCollaboration(); root = workspace; nickname = name.trim().slice(0, 64) || 'Aurora User'; token = crypto.randomBytes(24).toString('hex'); mode = 'host'; clientId = crypto.randomUUID();
  server = createServer(); wss = new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 });
  wss.on('connection', (ws, request) => { try { const requestUrl = new URL(request.url ?? '/', 'http://localhost'); if (requestUrl.searchParams.get('token') !== token) { ws.close(1008, 'Invalid collaboration token'); return; } if (clients.size >= 16) { ws.close(1013, 'Collaboration session full'); return; }
      const id = crypto.randomUUID(); const client: Client = { ws, id, nickname: (requestUrl.searchParams.get('name') || 'Guest').slice(0, 64), role: 'editor', color: peerColors[clients.size % peerColors.length], connectedAt: Date.now() }; clients.set(id, client); updateStatus('hosting'); send(ws, { type:'hello', clientId:id, nickname, workspace:path.basename(root), role:client.role, peers:peers() }); broadcast({type:'presence',payload:peers()});
      ws.on('message', async (raw: any) => { try { if (raw.length > 2 * 1024 * 1024) return; const message: any = JSON.parse(raw.toString());
          if (message.type === 'chat' && typeof message.text === 'string' && message.text.trim().length <= 2000) { const payload={nickname:client.nickname,text:message.text.trim(),at:Date.now()}; emit({type:'chat',payload}); broadcast({type:'chat',payload}); }
          else if (message.type === 'sync') send(ws,{type:'snapshot',payload:await snapshot()});
          else if (message.type === 'edit' && client.role === 'editor' && typeof message.path === 'string' && typeof message.content === 'string' && Number.isInteger(message.baseVersion)) await applyEdit(message.path,message.content,message.baseVersion,ws,String(message.requestId||crypto.randomUUID()),id);
          else if (message.type === 'cursor') { const payload={clientId:id,nickname:client.nickname,color:client.color,cursor:message.cursor}; broadcast({type:'cursor',payload},ws); emit({type:'cursor',payload}); }
        } catch { send(ws,{type:'error',message:'Mensagem colaborativa inválida.'}); } });
      ws.on('close',()=>{clients.delete(id);updateStatus('hosting');broadcast({type:'presence',payload:peers()});});
    } catch { ws.close(1011,'Collaboration error'); } });
  await new Promise<void>((resolve,reject)=>{server!.once('error',reject);server!.listen(port,'0.0.0.0',()=>resolve());}); const address=server.address(); const actualPort=typeof address==='object'&&address?address.port:port;
  status={state:'hosting',url:`ws://127.0.0.1:${actualPort}`,token,peers:0,peerList:[{id:clientId,nickname,role:'owner',color:peerColors[0],connectedAt:Date.now()}],nickname,message:'Sessão criada. Para internet, publique um relay WebSocket com TLS (wss://).'}; emit({type:'status',payload:status});emit({type:'presence',payload:status.peerList});return status;
}
export async function joinCollaboration(workspace:string,url:string,sessionToken:string,name='Aurora User') {
  await stopCollaboration();root=workspace;nickname=name.trim().slice(0,64)||'Aurora User';token=sessionToken.trim();mode='client';clientId=crypto.randomUUID();if(!/^wss?:\/\//.test(url))throw new Error('URL de colaboração inválida. Use ws:// ou wss://.');
  const connect=()=>{const endpoint=`${url}${url.includes('?')?'&':'?'}token=${encodeURIComponent(token)}&name=${encodeURIComponent(nickname)}`;socket=new WebSocket(endpoint);
    socket.once('open',()=>{if(reconnectTimer)clearTimeout(reconnectTimer);reconnectTimer=null;updateStatus('connected','Conectado em tempo real.');socket!.send(JSON.stringify({type:'sync'}));});
    socket.on('message',async(raw:any)=>{try{const message:any=JSON.parse(raw.toString());if(message.type==='hello'){clientId=String(message.clientId||clientId);emit({type:'presence',payload:message.peers||[]});}else if(message.type==='chat')emit({type:'chat',payload:message.payload});else if(message.type==='presence'){status={...status,peerList:message.payload||[],peers:Array.isArray(message.payload)?message.payload.length:0};emit({type:'presence',payload:message.payload});}else if(message.type==='role')emit({type:'status',payload:{...status,message:`Permissão: ${message.role}`}});else if(message.type==='cursor')emit({type:'cursor',payload:message.payload});else if(message.type==='edit-ack')emit({type:'file',payload:message.payload});else if(message.type==='edit'){const p=message.payload;const target=safePath(p.path);if(target&&typeof p.content==='string'&&p.content.length<=1024*1024){await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,p.content,'utf8');versions.set(p.path,Number(p.version)||0);emit({type:'file',payload:p});}}else if(message.type==='snapshot'&&message.payload?.files){for(const file of message.payload.files as FileEntry[]){const target=safePath(file.path);if(!target||file.content.length>1024*1024)continue;await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,file.content,'utf8');versions.set(file.path,file.version||0);emit({type:'file',payload:file});}emit({type:'file',payload:{count:message.payload.files.length,snapshot:true}});}else if(message.type==='conflict')emit({type:'conflict',payload:message.payload});}catch{emit({type:'status',payload:{...status,message:'Mensagem colaborativa ignorada.'}});}});
    socket.once('error',()=>{if(!reconnectTimer&&mode==='client')reconnectTimer=setTimeout(connect,2500);});socket.once('close',()=>{if(mode==='client'){updateStatus('idle','Conexão perdida. Tentando reconectar…');if(!reconnectTimer)reconnectTimer=setTimeout(connect,2500);}});
  };connect();await new Promise<void>(resolve=>{const timer=setTimeout(resolve,4000);const check=()=>{if(status.state==='connected'){clearTimeout(timer);resolve();}else setTimeout(check,100);};check();});return status;
}
export async function syncCollaboration(){if(mode==='host'){const data=await snapshot();broadcast({type:'snapshot',payload:data});emit({type:'file',payload:{count:data.files.length,sent:true}});return data.files.length;}if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'sync'}));return 1;}throw new Error('Nenhuma sessão de colaboração ativa.');}
export async function sendCollabEdit(filePath:string,content:string,baseVersion=versions.get(relativeFilePath(filePath))??0){if(mode==='host'){await applyEdit(filePath,content,baseVersion);return;}if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'edit',path:relativeFilePath(filePath),content,baseVersion,requestId:crypto.randomUUID()}));return;}throw new Error('Nenhuma sessão conectada.');}
export function sendCollabCursor(cursor:unknown){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'cursor',cursor}));else if(mode==='host'){const payload={clientId,nickname,color:peerColors[0],cursor};broadcast({type:'cursor',payload});emit({type:'cursor',payload});}}
export function setCollabRole(peerId:string,role:'editor'|'viewer'){if(mode==='host'){const target=clients.get(peerId);if(target){target.role=role;send(target.ws,{type:'role',role});broadcast({type:'presence',payload:peers()});}}}
export function kickCollabPeer(peerId:string){if(mode==='host'){const target=clients.get(peerId);if(target){target.ws.close(4000,'Removed by host');clients.delete(peerId);broadcast({type:'presence',payload:peers()});updateStatus('hosting');}}}
export function sendCollabChat(text:string){const clean=text.trim().slice(0,2000);if(!clean)return;if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'chat',text:clean}));return;}if(mode==='host'){const payload={nickname,text:clean,at:Date.now()};emit({type:'chat',payload});broadcast({type:'chat',payload});return;}throw new Error('Nenhuma sessão conectada.');}
export async function stopCollaboration(){if(reconnectTimer)clearTimeout(reconnectTimer);reconnectTimer=null;socket?.close();socket=null;for(const client of clients.values())client.ws.close();clients.clear();await new Promise<void>(resolve=>{if(!server)return resolve();server.close(()=>resolve());});wss?.close();wss=null;server=null;mode=null;token='';root='';versions.clear();status={state:'idle',peers:0,peerList:[]};emit({type:'status',payload:status});}
