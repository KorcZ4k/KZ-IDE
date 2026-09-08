import { WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';

const port = Number(process.env.PORT || 8787);
const maxClients = Number(process.env.MAX_CLIENTS || 1000);
const maxPerSecond = Number(process.env.MAX_MESSAGES_PER_SECOND || 40);
const rooms = new Map();
const tlsKey = process.env.TLS_KEY;
const tlsCert = process.env.TLS_CERT;
const server = tlsKey && tlsCert
  ? https.createServer({ key: fs.readFileSync(tlsKey), cert: fs.readFileSync(tlsCert) })
  : null;
const wss = server ? new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 }) : new WebSocketServer({ port, maxPayload: 2 * 1024 * 1024 });

const send = (ws, value) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(value)); };
const roster = room => [...room.peers].map(p => ({ id:p.id, nickname:p.nickname, role:p.role, color:p.color, connectedAt:p.connectedAt }));
const broadcast = (room, value, except) => { for (const peer of room.peers) if (peer.ws !== except) send(peer.ws, value); };
const remove = peer => { if (!peer.room) return; const room=peer.room; room.peers.delete(peer); peer.room=null; broadcast(room,{type:'presence',payload:roster(room)}); if(!room.peers.size)rooms.delete(room.id); };
const validRoom = value => typeof value === 'string' && /^[A-Za-z0-9_-]{4,128}$/.test(value);

wss.on('connection',(ws,request)=>{
  const total=[...rooms.values()].reduce((n,r)=>n+r.peers.size,0); if(total>=maxClients){ws.close(1013,'Relay full');return;}
  const url=new URL(request.url||'/','http://relay'); const roomId=url.searchParams.get('room') || url.searchParams.get('token'); const roomToken=url.searchParams.get('token'); const name=(url.searchParams.get('name')||'Guest').slice(0,64);
  if(!validRoom(roomId)||!roomToken||!validRoom(roomToken)){ws.close(1008,'Invalid room or token');return;}
  let room=rooms.get(roomId); if(!room){room={id:roomId,token:roomToken,peers:new Set()};rooms.set(roomId,room);}
  if(room.token!==roomToken||room.peers.size>=16){ws.close(1008,'Invalid token or room full');return;}
  const peer={ws,id:crypto.randomUUID(),nickname:name,role:room.peers.size?'editor':'owner',color:['#9ec5d8','#c7a8e8','#9ed0ad','#e4b58b','#d89cae','#b8c8a0'][room.peers.size%6],room,windowStart:Date.now(),windowCount:0,isAlive:true}; room.peers.add(peer);
  ws.isAlive=true; send(ws,{type:'hello',clientId:peer.id,role:peer.role,peers:roster(room)}); broadcast(room,{type:'presence',payload:roster(room)});
  ws.on('pong',()=>{peer.isAlive=true;});
  ws.on('message',raw=>{try{
    if(raw.length>2*1024*1024)return;
    const now=Date.now(); if(now-peer.windowStart>=1000){peer.windowStart=now;peer.windowCount=0;} if(++peer.windowCount>maxPerSecond){send(ws,{type:'error',message:'Rate limit exceeded'});return;}
    const message=JSON.parse(raw.toString()); if(!message||typeof message.type!=='string')return;
    if(message.type==='kick'||message.type==='role'){if(peer.role!=='owner')return;const target=[...room.peers].find(p=>p.id===message.peerId);if(!target||target===peer)return;if(message.type==='kick'){target.ws.close(4000,'Removed by host');remove(target);}else if(message.role==='editor'||message.role==='viewer'){target.role=message.role;send(target.ws,{type:'role',role:target.role});broadcast(room,{type:'presence',payload:roster(room)});}return;}
    if(message.type==='edit'&&peer.role==='viewer')return;
    broadcast(room,message,ws);
  }catch{send(ws,{type:'error',message:'Malformed relay payload'});}});
  ws.on('close',()=>remove(peer)); ws.on('error',()=>remove(peer));
});

const heartbeat=setInterval(()=>{for(const room of rooms.values())for(const peer of room.peers){if(!peer.isAlive){peer.ws.terminate();remove(peer);continue;}peer.isAlive=false;peer.ws.ping();}},30000);
if(typeof heartbeat.unref==='function')heartbeat.unref();
const listenServer=()=>{if(server)server.listen(port,'0.0.0.0',()=>console.log(`Aurora collaboration relay listening on wss://0.0.0.0:${port}`));else console.log(`Aurora collaboration relay listening on ws://0.0.0.0:${port}`);};
listenServer();
