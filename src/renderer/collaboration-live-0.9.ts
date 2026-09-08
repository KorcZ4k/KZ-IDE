import * as monaco from 'monaco-editor';

type PeerCursor = { clientId: string; nickname: string; color: string; cursor?: { path?: string; position?: monaco.Position; selection?: monaco.Selection | null } };
type FilePayload = { path: string; content: string; version?: number; clientId?: string; requestId?: string };
type ConflictPayload = { path: string; content: string; version: number; requestId?: string };

const versions = new Map<string, number>();
const bases = new Map<string, string>();
const pending = new Map<string, { path: string; base: string; local: string }>();
const subscriptions = new Map<string, monaco.IDisposable>();
const cursorDecorations = new Map<string, string[]>();
let workspaceRoot = '';
let suppress = 0;

const notice = (message: string) => window.dispatchEvent(new CustomEvent('aurora:notice', { detail: message }));
const normalize = (value: string) => value.replaceAll('\\', '/');
const modelPath = (model: monaco.editor.ITextModel) => normalize(model.uri.fsPath);
const relativePath = (absolute: string) => { const root=normalize(workspaceRoot).replace(/\/$/,''); const value=normalize(absolute); return value.startsWith(`${root}/`) ? value.slice(root.length+1) : value; };
const absolutePath = (relative: string) => { const root=normalize(workspaceRoot).replace(/\/$/,''); const value=normalize(relative); return value.startsWith(`${root}/`) ? value : `${root}/${value}`; };
const getModel = (path: string) => { const wanted=absolutePath(path); return monaco.editor.getModels().find(model => modelPath(model) === wanted) ?? null; };
void window.kz.workspace.last().then(state => { workspaceRoot=state.workspace ?? ''; });

const attachModel = (model: monaco.editor.ITextModel) => {
  const path=relativePath(modelPath(model)); if(!path||subscriptions.has(model.uri.toString()))return; bases.set(path,model.getValue());
  const subscription=model.onDidChangeContent(()=>{if(suppress)return;const content=model.getValue(),base=versions.get(path)??0;pending.set(path,{path,base: bases.get(path)??content,local:content});void window.kz.collab.edit(path,content,base).catch(error=>notice(error instanceof Error?error.message:'Falha ao sincronizar edição.'));});
  subscriptions.set(model.uri.toString(),subscription);model.onWillDispose(()=>{subscription.dispose();subscriptions.delete(model.uri.toString());bases.delete(path);pending.delete(path);});
};
const threeWayMerge=(base:string,local:string,remote:string)=>{if(local===base)return remote;if(remote===base)return local;if(local===remote)return local;const b=base.split('\n'),l=local.split('\n'),r=remote.split('\n'),max=Math.max(b.length,l.length,r.length),out:string[]=[];for(let i=0;i<max;i++){const bv=b[i]??'',lv=l[i]??'',rv=r[i]??'';if(lv===rv)out.push(lv);else if(lv===bv)out.push(rv);else if(rv===bv)out.push(lv);else out.push('<<<<<<< LOCAL',lv,'=======',rv,'>>>>>>> REMOTE');}return out.join('\n');};

const applyRemote=(payload:FilePayload)=>{
  if(!payload?.path||typeof payload.content!=='string')return;const model=getModel(payload.path);const pendingEdit=pending.get(payload.path);versions.set(payload.path,Number(payload.version)||0);
  if(!model){bases.set(payload.path,payload.content);return;}
  if(pendingEdit&&model.getValue()!==payload.content){const merged=threeWayMerge(pendingEdit.base,pendingEdit.local,payload.content);suppress++;try{model.setValue(merged);bases.set(payload.path,payload.content);pending.delete(payload.path);}finally{suppress--;}if(!merged.includes('<<<<<<< LOCAL'))void window.kz.collab.edit(payload.path,merged,Number(payload.version)||0).catch(()=>undefined);else notice(`Conflito em ${payload.path}: marcadores de merge foram inseridos.`);return;}
  if(model.getValue()===payload.content){bases.set(payload.path,payload.content);pending.delete(payload.path);return;}
  suppress++;try{model.setValue(payload.content);bases.set(payload.path,payload.content);pending.delete(payload.path);}finally{suppress--;}
};
const applyConflict=(payload:ConflictPayload)=>{if(!payload?.path||typeof payload.content!=='string')return;const model=getModel(payload.path),pendingEdit=pending.get(payload.path);versions.set(payload.path,Number(payload.version)||0);if(!model||!pendingEdit){bases.set(payload.path,payload.content);notice(`Conflito em ${payload.path}. Workspace atualizado.`);return;}const merged=threeWayMerge(pendingEdit.base,pendingEdit.local,payload.content);suppress++;try{model.setValue(merged);bases.set(payload.path,payload.content);pending.delete(payload.path);}finally{suppress--;}if(merged.includes('<<<<<<< LOCAL'))notice(`Conflito em ${payload.path}: marcadores de merge foram inseridos.`);else{void window.kz.collab.edit(payload.path,merged,Number(payload.version)||0).catch(()=>undefined);notice(`Conflito em ${payload.path} reconciliado automaticamente.`);}};
const applyAck=(payload:FilePayload)=>{if(!payload?.path)return;versions.set(payload.path,Number(payload.version)||0);const model=getModel(payload.path);if(model)bases.set(payload.path,model.getValue());pending.delete(payload.path);};
const updateCursor=(payload:PeerCursor)=>{const cursor=payload.cursor,path=cursor?.path,position=cursor?.position;if(!path||!position||!payload.clientId)return;const model=getModel(path);if(!model)return;const old=cursorDecorations.get(`${payload.clientId}:${path}`)??[];const range=new monaco.Range(position.lineNumber,position.column,position.lineNumber,position.column);const ids=model.deltaDecorations(old,[{range,options:{className:'aurora-remote-cursor',hoverMessage:{value:`**${payload.nickname}**`},afterContentClassName:'aurora-remote-cursor-label'}}]);cursorDecorations.set(`${payload.clientId}:${path}`,ids);};
const wireEditor=(editor:monaco.editor.ICodeEditor)=>{const sendCursor=()=>{const model=editor.getModel(),position=editor.getPosition();if(!model||!position)return;void window.kz.collab.cursor({path:relativePath(modelPath(model)),position,selection:editor.getSelection()});};editor.onDidChangeCursorPosition(sendCursor);editor.onDidChangeCursorSelection(sendCursor);sendCursor();};
const scan=()=>{monaco.editor.getModels().forEach(attachModel);monaco.editor.getEditors().forEach(editor=>{const dom=editor.getDomNode();if(dom&&dom.dataset.auroraCollabWired!=='true'){dom.dataset.auroraCollabWired='true';wireEditor(editor);}});};
window.kz.collab.onEvent(event=>{if(event.type==='file'){const payload=event.payload as FilePayload;if(payload?.path)applyRemote(payload);}else if(event.type==='conflict')applyConflict(event.payload as ConflictPayload);else if(event.type==='cursor')updateCursor(event.payload as PeerCursor);else if(event.type==='status')void window.kz.workspace.last().then(state=>{workspaceRoot=state.workspace??'';scan();});});
monaco.editor.onDidCreateModel(attachModel);setInterval(scan,500);window.addEventListener('aurora:collab-ack',event=>applyAck((event as CustomEvent<FilePayload>).detail));window.addEventListener('aurora:collab-scan',scan);scan();
