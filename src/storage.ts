import type {Parameters, Take, Track} from './audio';
export type Session = {tracks:Track[];params:Parameters;heads:boolean[];takes:Take[];name:string;speed:number;loop:boolean;enabled:boolean;selected:number;preset:string};
let dbPromise:Promise<IDBDatabase>|null=null;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const req=indexedDB.open('magnetic-studio',1);req.onupgradeneeded=()=>req.result.createObjectStore('session');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function restoreSession():Promise<Session|null>{const database=await db();return new Promise((resolve,reject)=>{const req=database.transaction('session').objectStore('session').get('current');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
export async function saveSession(session:Session){const database=await db();return new Promise<void>((resolve,reject)=>{const tx=database.transaction('session','readwrite');tx.objectStore('session').put(session,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
