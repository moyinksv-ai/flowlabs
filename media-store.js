const DB_NAME='flowlab-media-v1';
const STORE='audio';
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE,{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveAudio({ideaId,blob,mimeType,durationMs}){const db=await openDB();const record={id:crypto.randomUUID(),ideaId,blob,mimeType,durationMs:durationMs||null,createdAt:new Date().toISOString()};return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);tx.oncomplete=()=>resolve(record);tx.onerror=()=>reject(tx.error)})}
async function getAudioForIdea(ideaId){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result.filter(x=>x.ideaId===ideaId));req.onerror=()=>reject(req.error)})}
