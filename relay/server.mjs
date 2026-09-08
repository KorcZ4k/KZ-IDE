import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';

const port = Number(process.env.PORT || 8787);
const maxClients = Number(process.env.MAX_CLIENTS || 1000);
const rooms = new Map();
const server = new WebSocketServer({ port, maxPayload: 2 * 1024 * 1024 });

const send = (ws, value) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(value)); };
const roster = room => [...room.peers].map(p => ({ id:p.id, nickname:p.nickname, role:p.role }));
const broadcast = (room, value, except) => { for (const peer of room.peers) if (peer.ws !== except) send(peer.ws, value); };
const remove = peer => { if (!peer.room) return; const room = peer.room; room.peers.delete(peer); peer.room = null; broadcast(room, { type:'presence', payload:roster(room) }); if (!room.peers.size) rooms.delete(room.id); };

server.on('connection', (ws, request) => {
  if ([...rooms.values()].reduce((n, r) => n + r.peers.size, 0) >= maxClients) return ws.close(1013, 'Relay full');
  const url = new URL(request.url || '/', 'http://relay');
  const roomId = url.searchParams.get('room'); const roomToken = url.searchParams.get('token'); const name = (url.searchParams.get('name') || 'Guest').slice(0, 64);
  if (!roomId || !roomToken || !/^[A-Za-z0-9_-]{4,128}$/.test(roomId)) return ws.close(1008, 'Invalid room');
  let room = rooms.get(roomId); if (!room) { room = { id:roomId, token:roomToken, peers:new Set() }; rooms.set(roomId, room); }
  if (room.token !== roomToken || room.peers.size >= 16) return ws.close(1008, 'Invalid token or room full');
  const peer = { ws, id:crypto.randomUUID(), nickname:name, role:room.peers.size ? 'editor' : 'owner', room }; room.peers.add(peer);
  send(ws, { type:'hello', clientId:peer.id, role:peer.role, peers:roster(room) }); broadcast(room, { type:'presence', payload:roster(room) });
  ws.on('message', raw => {
    try {
      if (raw.length > 2 * 1024 * 1024) return;
      const message = JSON.parse(raw.toString()); if (!message || typeof message.type !== 'string') return;
      if (message.type === 'kick' || message.type === 'role') {
        if (peer.role !== 'owner') return; const target = [...room.peers].find(p => p.id === message.peerId); if (!target || target === peer) return;
        if (message.type === 'kick') { target.ws.close(4000, 'Removed by host'); remove(target); }
        else if (message.role === 'editor' || message.role === 'viewer') { target.role = message.role; send(target.ws, {type:'role', role:target.role}); broadcast(room, {type:'presence', payload:roster(room)}); }
        return;
      }
      broadcast(room, message, ws);
    } catch { send(ws, {type:'error', message:'Malformed relay payload'}); }
  });
  ws.on('close', () => remove(peer)); ws.on('error', () => remove(peer));
});
console.log(`Aurora collaboration relay listening on ws://0.0.0.0:${port}`);
