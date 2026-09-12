import type {Clip, Parameters, Take, Track} from './audio';
export type Session = {tracks:Track[];params:Parameters;heads:boolean[];takes:Take[];name:string;speed:number;loop:boolean;enabled:boolean;selected:number;preset:string;bpm?:number;sync?:boolean;division?:string};
type StoredSession = Omit<Session,'tracks'|'takes'> & {schema:2;tracks:(Omit<Track,'clip'>&{clipId:string|null})[];takeIds:string[]};
let dbPromise:Promise<IDBDatabase>|null=null;
const clipIds=new WeakMap<Clip,string>();
function db(){return dbPromise??=new Promise((resolve,reject)=>{const req=indexedDB.open('magnetic-studio',2);req.onupgradeneeded=()=>{for(const store of ['session','clips','takes'])if(!req.result.objectStoreNames.contains(store))req.result.createObjectStore(store);};req.onsuccess=()=>{req.result.onversionchange=()=>{req.result.close();dbPromise=null;};resolve(req.result);};req.onerror=()=>{dbPromise=null;reject(req.error);};});}
function read<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function restoreSession():Promise<Session|null>{
  const database=await db();
  const stored=await read(database.transaction('session').objectStore('session').get('current')) as Session|StoredSession|undefined;
  if(!stored)return null;
  // Original sessions migrate on the next successful save, preserving existing recordings.
  if(!('schema' in stored)||stored.schema!==2)return stored as Session;
  const tx=database.transaction(['clips','takes']);
  const [tracks,takes]=await Promise.all([
    Promise.all(stored.tracks.map(async({clipId,...track})=>{const clip=clipId?await read(tx.objectStore('clips').get(clipId)) as Clip|undefined:undefined;if(clip&&clipId)clipIds.set(clip,clipId);return {...track,clip:clip||null};})),
    Promise.all(stored.takeIds.map(id=>read(tx.objectStore('takes').get(id)) as Promise<Take|undefined>))
  ]);
  const {schema,takeIds,...session}=stored;
  return {...session,tracks,takes:takes.filter((take):take is Take=>!!take)};
}
export async function saveSession(session:Session){
  // Capture controls immediately; unchanged sample arrays never need to be copied again.
  const clips=new Map<string,Clip>();
  const tracks=session.tracks.map(({clip,...track})=>{let clipId:string|null=null;if(clip){clipId=clipIds.get(clip)||crypto.randomUUID();clipIds.set(clip,clipId);clips.set(clipId,clip);}return {...track,clipId};});
  const {takes,tracks:originalTracks,...values}=session;
  const savedTakes=[...takes];
  const stored:StoredSession={...values,params:{...session.params},heads:[...session.heads],tracks,schema:2,takeIds:savedTakes.map(t=>t.id)};
  const database=await db();
  await new Promise<void>((resolve,reject)=>{
    const tx=database.transaction(['session','clips','takes'],'readwrite');
    const clipStore=tx.objectStore('clips'),takeStore=tx.objectStore('takes');
    const clipKeys=clipStore.getAllKeys();
    clipKeys.onsuccess=()=>{const existing=new Set(clipKeys.result);for(const [id,clip] of clips)if(!existing.has(id))clipStore.put(clip,id);for(const id of existing)if(!clips.has(String(id)))clipStore.delete(id);};
    const takeKeys=takeStore.getAllKeys();
    takeKeys.onsuccess=()=>{const keep=new Set(stored.takeIds);for(const id of takeKeys.result)if(!keep.has(String(id)))takeStore.delete(id);};
    // Blob cloning is inexpensive; large PCM arrays live in the separate clips store.
    for(const take of savedTakes)takeStore.put(take,take.id);
    tx.objectStore('session').put(stored,'current');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
