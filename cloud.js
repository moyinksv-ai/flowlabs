const cfg = window.FLOWLAB_CONFIG || {};
const url = String(cfg.SUPABASE_URL || '').trim().replace(/\/$/, '');
const publishableKey = String(cfg.SUPABASE_PUBLISHABLE_KEY || '').trim();
const placeholder = value => !value || value.startsWith('PASTE_YOUR_') || value.includes('YOUR_');

const supabaseConfigured = !placeholder(url) && !placeholder(publishableKey) && /^https:\/\/[^\s/]+\.supabase\.co$/i.test(url);
const supabase = supabaseConfigured ? { auth: { configured: true } } : null;

const SESSION_KEY = 'flowlab.supabase.session.v1';
let session = readSession();
let refreshPromise = null;

function readSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function writeSession(next){
  session = next || null;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
}
function authHeaders(accessToken=session?.access_token){
  const headers = { apikey: publishableKey, Accept: 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}
async function readJson(response){
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || `Request failed (${response.status})`;
    const error = new Error(message); error.status = response.status; error.payload = data; throw error;
  }
  return data;
}
async function authRequest(path, options={}){
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const response = await fetch(`${url}/auth/v1/${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  return readJson(response);
}
async function refreshSession(){
  if (!session?.refresh_token) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const data = await authRequest('token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      writeSession(data);
      return data;
    } catch {
      writeSession(null);
      return null;
    } finally { refreshPromise = null; }
  })();
  return refreshPromise;
}
function tokenExpiredSoon(){
  return !session?.expires_at || (Date.now()/1000) >= (Number(session.expires_at) - 45);
}
async function accessToken(){
  if (!session?.access_token) return '';
  if (!tokenExpiredSoon()) return session.access_token;
  const refreshed = await refreshSession();
  return refreshed?.access_token || '';
}

async function getCurrentUser(){
  if (!supabaseConfigured) return null;
  const token = await accessToken();
  if (!token) return null;
  try {
    const response = await fetch(`${url}/auth/v1/user`, { headers: authHeaders(token) });
    if (response.ok) return await response.json();
    writeSession(null);
  } catch {}
  return null;
}

async function signIn(email, password){
  const data = await authRequest('token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  writeSession(data);
  return data.user || await getCurrentUser();
}

async function signUp(email, password, displayName=''){
  const data = await authRequest('signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, data: { display_name: displayName } })
  });
  if (data.access_token) writeSession(data);
  return data.user || null;
}

async function signOut(){
  const token = await accessToken();
  if (supabaseConfigured && token) {
    await fetch(`${url}/auth/v1/logout`, { method: 'POST', headers: authHeaders(token) }).catch(() => {});
  }
  writeSession(null);
}

async function rest(path, options={}){
  const token = await accessToken();
  if (!token) throw new Error('Sign in to sync with Supabase.');
  let response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: { ...authHeaders(token), 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal', ...(options.headers || {}) }
  });
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new Error('Your Supabase session expired. Please sign in again.');
    response = await fetch(`${url}/rest/v1/${path}`, {
      ...options,
      headers: { ...authHeaders(refreshed.access_token), 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal', ...(options.headers || {}) }
    });
  }
  return readJson(response);
}

function toRows(state, userId){
  const ideas = state.ideas.map(idea => ({ id:idea.id, owner_id:userId, song_id:idea.songId, type:idea.type, title:idea.title, content:idea.content, notes:idea.notes, tags:idea.tags, pinned:idea.pinned, archived:idea.archived, created_at:idea.createdAt, updated_at:idea.updatedAt }));
  const songs = state.songs.map(song => ({ id:song.id, owner_id:userId, title:song.title, artist_name:song.artist, bpm:song.bpm, musical_key:song.key, mood:song.mood, notes:song.notes, sections:song.sections, current_version_id:null, archived:song.archived, created_at:song.createdAt, updated_at:song.updatedAt }));
  const versions = state.versions.map(version => ({ id:version.id, owner_id:userId, song_id:version.songId, parent_version_id:version.parentVersionId, version_number:version.number, title:version.title, body:version.body, section_map:version.sectionMap, change_note:version.changeNote, archived:version.archived, created_at:version.createdAt }));
  const ideaIds = new Set(state.ideas.map(i=>i.id));
  const songIds = new Set(state.songs.map(s=>s.id));
  const links = state.links.map(link => ({ id:link.id, owner_id:userId, from_idea_id:ideaIds.has(link.fromId)?link.fromId:null, to_idea_id:ideaIds.has(link.toId)?link.toId:null, song_id:songIds.has(link.fromId)?link.fromId:(songIds.has(link.toId)?link.toId:null), relation:link.relation, created_at:link.createdAt }));
  return { ideas, songs, versions, links };
}

async function pushState(state, userId){
  if (!supabaseConfigured || !userId) return;
  const rows = toRows(state,userId);
  for (const [table, data] of Object.entries(rows)) {
    if (!data.length) continue;
    await rest(table, { method:'POST', body:JSON.stringify(data) });
  }
  for (const song of state.songs.filter(s=>s.currentVersionId)) {
    await rest(`songs?id=eq.${encodeURIComponent(song.id)}`, { method:'PATCH', body:JSON.stringify({current_version_id:song.currentVersionId}) });
  }
}

async function pullState(){
  if (!supabaseConfigured) return null;
  const requests = ['ideas?select=*&order=updated_at.desc','songs?select=*&order=updated_at.desc','song_versions?select=*&order=created_at.desc','idea_links?select=*&order=created_at.desc'].map(path => rest(path, { method:'GET', headers:{ Prefer:'' }}));
  const [ideas,songs,versions,links] = await Promise.all(requests);
  return {
    ideas:(ideas||[]).map(r=>({id:r.id,type:r.type,title:r.title,content:r.content,notes:r.notes,tags:r.tags||[],color:'default',archived:r.archived,pinned:r.pinned,songId:r.song_id,createdAt:r.created_at,updatedAt:r.updated_at})),
    songs:(songs||[]).map(r=>({id:r.id,title:r.title,artist:r.artist_name||'',bpm:r.bpm,key:r.musical_key||'',mood:r.mood||'',notes:r.notes||'',sections:r.sections||['verse','chorus'],currentVersionId:r.current_version_id||null,archived:r.archived,createdAt:r.created_at,updatedAt:r.updated_at})),
    versions:(versions||[]).map(r=>({id:r.id,songId:r.song_id,number:r.version_number,title:r.title,body:r.body,sectionMap:r.section_map||{},parentVersionId:r.parent_version_id||null,createdAt:r.created_at,archived:r.archived,changeNote:r.change_note||''})),
    links:(links||[]).map(r=>({id:r.id,fromId:r.from_idea_id||r.song_id,toId:r.to_idea_id||r.song_id,relation:r.relation,createdAt:r.created_at})),
  };
}

function mergeState(local, cloud){
  if (!cloud) return local;
  const mergeById=(a=[],b=[])=>{const map=new Map(a.map(item=>[item.id,item]));for(const item of b){const old=map.get(item.id);if(!old||String(item.updatedAt||item.createdAt)>String(old.updatedAt||old.createdAt))map.set(item.id,item)}return [...map.values()]};
  return { ...local, ideas:mergeById(local.ideas,cloud.ideas), songs:mergeById(local.songs,cloud.songs), versions:mergeById(local.versions,cloud.versions), links:mergeById(local.links,cloud.links) };
}

async function uploadAudio(userId, ideaId, blob, kind='voice_note'){
  if (!supabaseConfigured || !userId) throw new Error('Supabase is not configured.');
  const token = await accessToken();
  if (!token) throw new Error('Sign in to upload audio.');
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
  const path = `${userId}/ideas/${ideaId}/${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${url}/storage/v1/object/flowlab-audio/${path}`, {
    method:'POST', headers:{...authHeaders(token), 'Content-Type':blob.type || 'audio/webm', 'x-upsert':'false'}, body:blob
  });
  await readJson(response);
  await rest('audio_assets', {method:'POST', body:JSON.stringify({owner_id:userId,idea_id:ideaId,kind,storage_path:path,mime_type:blob.type||'audio/webm'})});
  return path;
}

async function requestAI(task, context){
  const token = await accessToken();
  if (!token) throw new Error('Sign in to use AI.');
  const response = await fetch('/api/ai', {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({task,context})});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || 'AI request failed.');
  return data.text;
}
