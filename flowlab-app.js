
const store = new LocalStore();
const app = document.querySelector('#app');
let route = location.hash.slice(1) || 'home';
let selectedSongId = null;
let ideaQuery = '';
let ideaFilter = 'all';
let user = null;
let syncTimer = null;
let syncing = false;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeLabel = type => IDEA_TYPES[type] || 'Other';
const fmt = iso => new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));
function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2200)}
function navigate(next){route=next;history.replaceState({},'',`#${next}`);render()}
window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'home';render()});

function scheduleSync(){
  if(!user || syncing || !supabaseConfigured) return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(async()=>{try{syncing=true;await pushState(store.state,user.id);setSyncStatus('Synced');}catch(error){console.error(error);setSyncStatus('Offline / retrying');}finally{syncing=false;}},700);
}
store.subscribe(()=>scheduleSync());

function setSyncStatus(text){const el=document.querySelector('#sync-status');if(el)el.textContent=text}
function shell(content){
  app.innerHTML=`<div class="app">
    <header class="topbar">
      <div class="brand">Flow<span>Lab</span></div>
      <nav class="nav"><button data-route="home" class="${route==='home'?'active':''}">Workspace</button><button data-route="ideas" class="${route==='ideas'?'active':''}">Idea Bank</button><button data-route="songs" class="${route==='songs'||route==='song'?'active':''}">Songs</button></nav>
      <div class="row"><span id="sync-status" class="status">${user?'Cloud':'Local'}</span><button class="btn" id="account-btn">${user?'Account':'Sign in'}</button><button class="btn primary" id="quick-capture">＋ Capture</button></div>
    </header>
    ${content}
    <div class="footer-note">${supabaseConfigured?'Cloud-backed with local-first fallback.':'Local mode — add Supabase environment variables for cloud sync.'} · ${user?'Signed in':'Not signed in'}</div>
    <nav class="bottom">${[['home','⌂','Home'],['ideas','✦','Ideas'],['songs','♫','Songs']].map(([r,i,l])=>`<button data-route="${r}" class="${route===r||route==='song'&&r==='songs'?'active':''}">${i} ${l}</button>`).join('')}</nav>
  </div>`;
  app.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>navigate(b.dataset.route));
  app.querySelector('#quick-capture')?.addEventListener('click',()=>openIdeaModal());
  app.querySelector('#account-btn')?.addEventListener('click',()=>openAccountModal());
}

function home(){
  const ideas=store.state.ideas.filter(i=>!i.archived);const songs=store.state.songs.filter(s=>!s.archived);
  const recent=[...ideas].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,6);
  return `<section class="hero card"><div class="eyebrow">Creative memory</div><h1 class="title">Don't let the good<br>idea disappear.</h1><p class="sub">FlowLab keeps hooks, fragments, melodies, references and unfinished thoughts alive until they become songs.</p><div class="row hero-actions"><button class="btn primary" id="hero-capture">Capture an idea</button><button class="btn" id="hero-song">Start a song</button></div></section>
  <section class="section grid grid-3"><div class="card mini"><strong>${ideas.length}</strong><span>active ideas</span></div><div class="card mini"><strong>${songs.length}</strong><span>songs</span></div><div class="card mini"><strong>${store.state.versions.length}</strong><span>saved versions</span></div></section>
  <section class="section"><div class="section-head"><div><div class="eyebrow">Your creative memory</div><h2>Pick up where you left off</h2></div><button class="btn ghost" id="see-all-ideas">View all</button></div><div class="idea-grid">${recent.length?recent.map(ideaCard).join(''):`<div class="empty" style="grid-column:1/-1"><strong>No fragments yet.</strong><br>Capture the next line, hook or melody before it gets away.</div>`}</div></section>
  <section class="section card value-panel"><div class="eyebrow">The workflow</div><div class="value-grid"><div><strong>Capture</strong><p>Keep the raw thought intact. It does not need to be a song yet.</p></div><div><strong>Connect</strong><p>Bring fragments together and see what belongs to the same song.</p></div><div><strong>Develop</strong><p>Make new versions without destroying the one that came before it.</p></div></div></section>`;
}
function ideaCard(i){return `<article class="card idea" data-idea="${esc(i.id)}"><div class="row space"><span class="idea-type">${esc(typeLabel(i.type))}</span>${i.pinned?'<span title="Pinned">★</span>':''}</div><h3>${esc(i.title)}</h3><p>${esc(i.content.slice(0,250))}${i.content.length>250?'…':''}</p><div class="row">${(i.tags||[]).slice(0,3).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="idea-foot"><span class="muted">${fmt(i.updatedAt)}</span><button class="btn icon-btn" data-open-idea="${esc(i.id)}">→</button></div></article>`}

function ideas(){
  let list=store.state.ideas.filter(i=>ideaFilter==='archived'?i.archived:!i.archived);
  if(ideaFilter!=='all'&&ideaFilter!=='archived')list=list.filter(i=>i.type===ideaFilter);
  list=list.filter(i=>matchesIdea(i,ideaQuery));
  const typeButtons=Object.keys(IDEA_TYPES).map(k=>`<button class="filter-chip ${ideaFilter===k?'active':''}" data-filter="${k}">${esc(typeLabel(k))}</button>`).join('');
  return `<section class="section-head"><div><div class="eyebrow">Creative memory</div><h1>Idea Bank</h1></div><button class="btn primary" id="new-idea">＋ New idea</button></section>
    <div class="card capture"><div class="filters"><input id="idea-search" value="${esc(ideaQuery)}" placeholder="Search titles, phrases, tags…"><button class="filter-chip ${ideaFilter==='all'?'active':''}" data-filter="all">All</button>${typeButtons}<button class="filter-chip ${ideaFilter==='archived'?'active':''}" data-filter="archived">Archived</button></div></div>
    <div class="idea-grid">${list.length?list.map(ideaCard).join(''):`<div class="empty" style="grid-column:1/-1">No ideas match this view.</div>`}</div>`;
}

function songs(){const items=store.state.songs.filter(s=>!s.archived);return `<section class="section-head"><div><div class="eyebrow">Songbook</div><h1>Songs</h1></div><button class="btn primary" id="new-song">＋ New song</button></section><div class="grid grid-2">${items.length?items.map(s=>`<article class="card song-card"><div class="row space"><div><div class="idea-type">${esc(s.artist||'Unassigned artist')}</div><h2>${esc(s.title)}</h2></div><button class="btn" data-open-song="${esc(s.id)}">Open</button></div><div class="row">${s.bpm?`<span class="tag">${s.bpm} BPM</span>`:''}${s.key?`<span class="tag">${esc(s.key)}</span>`:''}${s.mood?`<span class="tag">${esc(s.mood)}</span>`:''}</div><p class="muted">Updated ${fmt(s.updatedAt)}</p></article>`).join(''):`<div class="empty" style="grid-column:1/-1">No songs yet. A song can start with one fragment.</div>`}</div>`}

function song(id){
  const s=store.state.songs.find(x=>x.id===id);if(!s){navigate('songs');return ''}
  const versions=store.state.versions.filter(v=>v.songId===id).sort((a,b)=>b.number-a.number);const current=versions.find(v=>v.id===s.currentVersionId)||versions[0];
  const linked=store.state.ideas.filter(i=>i.songId===id||store.state.links.some(l=>(l.fromId===i.id&&l.toId===id)||(l.toId===i.id&&l.fromId===id)));
  return `<section class="section-head"><div><button class="btn ghost" id="back-songs">← Songs</button><div class="eyebrow page-kicker">Song workspace</div><h1>${esc(s.title)}</h1></div><button class="btn" id="archive-song">Archive</button></section>
  <div class="song-layout"><section class="writer card"><div class="row space"><div class="row"><span class="tag">${esc(s.artist||'No artist')}</span>${s.bpm?`<span class="tag">${s.bpm} BPM</span>`:''}</div><span class="muted">${current?`v${current.number}`:'No draft'}</span></div><textarea id="song-body" placeholder="Write the song here…">${esc(current?.body||'')}</textarea><div class="row space form-actions"><span class="muted">Saving creates a new version.</span><button class="btn primary" id="save-version">Save new version</button></div><div class="ai-panel"><div><div class="idea-type">AI assist</div><strong>Develop what you already wrote.</strong><p class="muted">The AI sees this draft, not your entire private archive.</p></div><button class="btn" id="develop-song">Develop with AI</button></div></section>
  <aside class="side card"><div class="section-head"><h2>Song info</h2></div><div class="meta-grid"><div class="mini"><strong>${s.sections.length}</strong><span>sections</span></div><div class="mini"><strong>${versions.length}</strong><span>versions</span></div></div><div class="form meta-form"><div><label>Artist</label><input id="song-artist" value="${esc(s.artist)}"></div><div class="grid grid-2"><div><label>BPM</label><input id="song-bpm" type="number" min="1" max="400" value="${s.bpm??''}></div><div><label>Key</label><input id="song-key" value="${esc(s.key)}" placeholder="Am"></div></div><div><label>Mood</label><input id="song-mood" value="${esc(s.mood)}"></div><div><label>Notes</label><textarea id="song-notes">${esc(s.notes)}</textarea></div><button class="btn" id="save-song-meta">Save details</button></div>
  <div class="section"><div class="section-head"><h2>Linked ideas</h2><button class="btn icon-btn" id="link-idea">＋</button></div>${linked.length?linked.map(i=>`<div class="version"><div class="idea-type">${esc(typeLabel(i.type))}</div><strong>${esc(i.title)}</strong><div class="muted">${esc(i.content.slice(0,110))}</div></div>`).join(''):`<div class="empty">Nothing linked yet.</div>`}</div>
  <div class="section"><div class="section-head"><h2>Versions</h2></div>${versions.length?versions.map(v=>`<button class="version ${v.id===current?.id?'current':''}" data-version="${esc(v.id)}"><div class="row space"><strong>v${v.number}</strong><span class="muted">${fmt(v.createdAt)}</span></div><div class="muted">${esc(v.changeNote||'No change note')}</div></button>`).join(''):`<div class="empty">No saved versions.</div>`}</div></aside></div>`;
}

function openAccountModal(){
  const b=document.createElement('div');b.className='modal-backdrop';
  if(user){b.innerHTML=`<div class="modal card"><div class="section-head"><div><div class="eyebrow">Account</div><h2>${esc(user.email||'Signed in')}</h2></div><button class="btn icon-btn" id="x">×</button></div><p class="muted">Your cloud archive is protected by Supabase Row Level Security.</p><div class="form-actions"><button class="btn" id="sync-now">Sync now</button><button class="btn danger" id="logout">Sign out</button></div></div>`;document.body.appendChild(b);b.querySelector('#x').onclick=()=>b.remove();b.querySelector('#logout').onclick=async()=>{await signOut();user=null;b.remove();render();toast('Signed out')};b.querySelector('#sync-now').onclick=async()=>{try{await syncWithCloud(true);b.remove();toast('Cloud synced')}catch(e){toast(e.message)}};return;}
  b.innerHTML=`<div class="modal card"><div class="section-head"><div><div class="eyebrow">Your archive</div><h2>Sign in to sync</h2></div><button class="btn icon-btn" id="x">×</button></div><form class="form" id="auth-form"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" minlength="6" autocomplete="current-password" required></label><label>Display name <span class="muted">(sign-up only)</span><input name="displayName" autocomplete="name"></label><div class="form-actions"><button type="button" class="btn" id="signup">Create account</button><button class="btn primary">Sign in</button></div><p class="muted" id="auth-message">${supabaseConfigured?'Your ideas stay local until you connect your account.':'Add your Supabase project URL and publishable key in config.js to enable cloud auth.'}</p></form></div>`;document.body.appendChild(b);
  b.querySelector('#x').onclick=()=>b.remove();
  b.querySelector('#signup').onclick=async()=>{if(!supabaseConfigured)return toast('Supabase is not configured');const f=new FormData(b.querySelector('form'));try{await signUp(f.get('email'),f.get('password'),f.get('displayName'));b.remove();await bootUser();toast('Account created');}catch(e){b.querySelector('#auth-message').textContent=e.message}};
  b.querySelector('form').onsubmit=async e=>{e.preventDefault();if(!supabaseConfigured)return toast('Supabase is not configured');const f=new FormData(e.currentTarget);try{await signIn(f.get('email'),f.get('password'));b.remove();await bootUser();toast('Signed in');}catch(err){b.querySelector('#auth-message').textContent=err.message}};
}

function openIdeaModal(existingId=null){
  const existing=existingId?store.state.ideas.find(i=>i.id===existingId):null;let selectedType=existing?.type||'hook';let recordedBlob=null;let recorder=null;let startedAt=0;
  const b=document.createElement('div');b.className='modal-backdrop';
  b.innerHTML=`<div class="modal card"><div class="section-head"><div><div class="eyebrow">Idea Bank</div><h2>${existing?'Edit idea':'Capture an idea'}</h2></div><button class="btn icon-btn" id="x">×</button></div><div class="capture-grid"><div class="type-list">${Object.keys(IDEA_TYPES).map(k=>`<button data-type="${k}" class="${selectedType===k?'active':''}">${esc(typeLabel(k))}</button>`).join('')}</div><form class="form" id="idea-form"><label>Title<input name="title" value="${esc(existing?.title||'')}" placeholder="A name you can recognize later" required></label><label>The idea<textarea name="content" required placeholder="Write or paste it exactly as it came to you…">${esc(existing?.content||'')}</textarea></label><div id="audio-tools"></div><div class="grid grid-2"><label>Tags<input name="tags" value="${esc(existing?.tags?.join(', ')||'')}" placeholder="chorus, late-night"></label><label>Notes<input name="notes" value="${esc(existing?.notes||'')}" placeholder="Come back to this later"></label></div><div class="ai-panel compact"><div><div class="idea-type">AI assist</div><strong>Develop this fragment</strong></div><button type="button" class="btn" id="develop-idea">Ask FlowLab</button></div><div class="form-actions"><button type="button" class="btn" id="cancel">Cancel</button><button class="btn primary">${existing?'Save idea':'Capture idea'}</button></div></form></div></div>`;
  document.body.appendChild(b);
  const renderAudio=()=>{const el=b.querySelector('#audio-tools');if(!['melody','voice_note'].includes(selectedType)){el.innerHTML='';return;}el.innerHTML=`<div class="row"><button type="button" class="btn" id="record">● Record ${selectedType==='melody'?'melody':'voice note'}</button><span id="record-status" class="muted"></span></div>`;b.querySelector('#record').onclick=async()=>{const button=b.querySelector('#record');if(recorder?.state==='recording'){recorder.stop();return;}try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const chunks=[];recorder=new MediaRecorder(stream);startedAt=Date.now();recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());recordedBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});b.querySelector('#record-status').textContent=`Recorded ${Math.max(1,Math.round((Date.now()-startedAt)/1000))}s`;button.textContent='● Re-record';};recorder.start();button.textContent='■ Stop recording';b.querySelector('#record-status').textContent='Recording…';}catch{toast('Microphone access was not available.')}}};
  b.querySelectorAll('[data-type]').forEach(btn=>btn.onclick=()=>{selectedType=btn.dataset.type;b.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('active',x===btn));renderAudio();});renderAudio();
  const close=()=>b.remove();b.querySelector('#x').onclick=close;b.querySelector('#cancel').onclick=close;
  if(existing)getAudioForIdea(existing.id).then(records=>{if(!records.length)return;const el=b.querySelector('#audio-tools');el.insertAdjacentHTML('beforeend',records.map(r=>`<audio controls preload="metadata" src="${URL.createObjectURL(r.blob)}"></audio>`).join(''))});
  b.querySelector('#develop-idea').onclick=async()=>{try{const f=new FormData(b.querySelector('form'));const result=await requestAI('Develop this fragment into three distinct options. Preserve its intent and voice. Keep the original fragment untouched.',`Type: ${selectedType}\nTitle: ${f.get('title')}\nFragment: ${f.get('content')}\nNotes: ${f.get('notes')}`);openAIResult(result,'AI suggestions');}catch(e){toast(e.message)}};
  b.querySelector('#idea-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const idea=existing?store.updateIdea(existing.id,{type:selectedType,title:f.get('title'),content:f.get('content'),notes:f.get('notes'),tags:String(f.get('tags')).split(',').map(x=>x.trim()).filter(Boolean)}):store.addIdea({type:selectedType,title:f.get('title'),content:f.get('content'),notes:f.get('notes'),tags:String(f.get('tags')).split(',').map(x=>x.trim()).filter(Boolean)});if(recordedBlob){try{await saveAudio({ideaId:idea.id,blob:recordedBlob,mimeType:recordedBlob.type});if(user)await uploadAudio(user.id,idea.id,recordedBlob,selectedType)}catch(err){console.error(err);toast('Idea saved, but the recording stayed local')}}close();toast(existing?'Idea saved':'Idea captured');render()};
}

function openAIResult(text,title='AI result'){const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<div class="modal card"><div class="section-head"><div><div class="eyebrow">FlowLab AI</div><h2>${esc(title)}</h2></div><button class="btn icon-btn" id="x">×</button></div><textarea readonly class="ai-result">${esc(text)}</textarea><div class="form-actions"><button class="btn" id="copy">Copy</button><button class="btn primary" id="x2">Done</button></div></div>`;document.body.appendChild(b);b.querySelector('#x').onclick=()=>b.remove();b.querySelector('#x2').onclick=()=>b.remove();b.querySelector('#copy').onclick=async()=>{await navigator.clipboard?.writeText(text);toast('Copied')}}

function openNewSongModal(){const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<div class="modal card"><div class="section-head"><h2>Start a song</h2><button class="btn icon-btn" id="x">×</button></div><form class="form"><label>Song title<input name="title" required placeholder="Untitled song"></label><div class="grid grid-2"><label>Artist<input name="artist" placeholder="Artist name"></label><label>BPM<input name="bpm" type="number" min="1" max="400" placeholder="104"></label></div><label>First draft<textarea name="body" placeholder="Start with whatever you already have…"></textarea></label><div class="form-actions"><button type="button" class="btn" id="cancel">Cancel</button><button class="btn primary">Create song</button></div></form></div>`;document.body.appendChild(b);b.querySelector('#x').onclick=b.querySelector('#cancel').onclick=()=>b.remove();b.querySelector('form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const song=store.addSong({title:f.get('title'),artist:f.get('artist'),bpm:f.get('bpm'),body:f.get('body')});b.remove();selectedSongId=song.id;navigate('song');toast('Song created')}}

function openLinkModal(available){const b=document.createElement('div');b.className='modal-backdrop';b.innerHTML=`<div class="modal card"><div class="section-head"><h2>Link an idea</h2><button class="btn icon-btn" id="x">×</button></div><div class="form">${available.map(i=>`<button class="version" data-link="${esc(i.id)}"><div class="idea-type">${esc(typeLabel(i.type))}</div><strong>${esc(i.title)}</strong><div class="muted">${esc(i.content.slice(0,120))}</div></button>`).join('')}</div></div>`;document.body.appendChild(b);b.querySelector('#x').onclick=()=>b.remove();b.querySelectorAll('[data-link]').forEach(x=>x.onclick=()=>{store.addLink(x.dataset.link,selectedSongId,'source');b.remove();toast('Idea linked');render()})}

function bindPage(){
  app.querySelectorAll('[data-open-idea]').forEach(b=>b.onclick=()=>openIdeaModal(b.dataset.openIdea));app.querySelectorAll('[data-idea]').forEach(card=>card.onclick=e=>{if(e.target.closest('button'))return;openIdeaModal(card.dataset.idea)});app.querySelectorAll('[data-open-song]').forEach(b=>b.onclick=()=>{selectedSongId=b.dataset.openSong;navigate('song')});
  app.querySelector('#hero-capture')?.addEventListener('click',()=>openIdeaModal());app.querySelector('#hero-song')?.addEventListener('click',openNewSongModal);app.querySelector('#see-all-ideas')?.addEventListener('click',()=>navigate('ideas'));app.querySelector('#new-idea')?.addEventListener('click',()=>openIdeaModal());app.querySelector('#new-song')?.addEventListener('click',openNewSongModal);
  const q=app.querySelector('#idea-search');if(q)q.oninput=e=>{ideaQuery=e.target.value;render()};app.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{ideaFilter=b.dataset.filter;render()});
  app.querySelector('#back-songs')?.addEventListener('click',()=>navigate('songs'));app.querySelector('#archive-song')?.addEventListener('click',()=>{store.updateSong(selectedSongId,{archived:true});toast('Song archived');navigate('songs')});app.querySelector('#save-version')?.addEventListener('click',()=>{store.addVersion(selectedSongId,app.querySelector('#song-body').value,'Manual edit');toast('New version saved');render()});
  app.querySelector('#save-song-meta')?.addEventListener('click',()=>{store.updateSong(selectedSongId,{artist:app.querySelector('#song-artist').value,bpm:app.querySelector('#song-bpm').value,key:app.querySelector('#song-key').value,mood:app.querySelector('#song-mood').value,notes:app.querySelector('#song-notes').value});toast('Song details saved');render()});
  app.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{store.updateSong(selectedSongId,{currentVersionId:b.dataset.version});render()});
  app.querySelector('#link-idea')?.addEventListener('click',()=>{const available=store.state.ideas.filter(i=>!i.archived&&!i.songId&&!store.state.links.some(l=>(l.fromId===i.id&&l.toId===selectedSongId)||(l.toId===i.id&&l.fromId===selectedSongId)));if(!available.length)return toast('No unlinked ideas available');openLinkModal(available)});
  app.querySelector('#develop-song')?.addEventListener('click',async()=>{try{const s=store.state.songs.find(x=>x.id===selectedSongId);const v=store.state.versions.find(x=>x.id===s.currentVersionId);const result=await requestAI('Develop this song draft. Identify the strongest idea, then propose practical changes and a small alternative passage. Do not rewrite the entire song unless needed.',`Song: ${s.title}\nArtist: ${s.artist}\nMood: ${s.mood}\nDraft:\n${v?.body||''}`);openAIResult(result,'Song development') }catch(e){toast(e.message)}});
}

async function syncWithCloud(force=false){if(!user||!supabaseConfigured)return;setSyncStatus('Syncing…');const cloud=await pullState(user.id);const merged=mergeState(store.state,cloud);const cloudEmpty=!cloud.ideas.length&&!cloud.songs.length&&!cloud.versions.length;const localEmpty=!store.state.ideas.length&&!store.state.songs.length&&!store.state.versions.length;if(force||!cloudEmpty){store.replaceState(merged)} if(cloudEmpty&&!localEmpty)await pushState(store.state,user.id);else await pushState(store.state,user.id);setSyncStatus('Synced')}
async function bootUser(){user=await getCurrentUser();render();if(user)try{await syncWithCloud();}catch(error){console.error(error);setSyncStatus('Offline / retrying');toast('Signed in, but cloud sync could not complete')}}

async function init(){
  if(supabaseConfigured){await bootUser();}
  else render();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

function render(){let content=route==='home'?home():route==='ideas'?ideas():route==='songs'?songs():route==='song'?song(selectedSongId):home();shell(content);bindPage()}
init();
