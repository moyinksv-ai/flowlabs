
const KEY = 'flowlab.state.v3';
const timestamp = () => new Date().toISOString();

class LocalStore {
  constructor(storage=globalThis.localStorage) {
    this.storage = storage;
    this.state = this.load();
    this.listeners = new Set();
  }
  load() {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return createInitialState();
      const value = JSON.parse(raw);
      return {
        ...createInitialState(), ...value,
        ideas: (value.ideas || []).map(normalizeIdea),
        songs: (value.songs || []).map(normalizeSong),
        versions: (value.versions || []).map(normalizeVersion),
        links: value.links || [],
      };
    } catch { return createInitialState(); }
  }
  replaceState(next) {
    this.state = {
      ...createInitialState(), ...next,
      ideas: (next.ideas || []).map(normalizeIdea),
      songs: (next.songs || []).map(normalizeSong),
      versions: (next.versions || []).map(normalizeVersion),
      links: next.links || [],
    };
    this.persist();
    return this.state;
  }
  persist() {
    this.storage?.setItem(KEY, JSON.stringify(this.state));
    for (const listener of this.listeners) listener(this.state);
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  addIdea(input) { const idea=normalizeIdea(input); this.state.ideas.unshift(idea); this.persist(); return idea; }
  updateIdea(id, patch) {
    const index=this.state.ideas.findIndex(x=>x.id===id); if(index<0) throw new Error('Idea not found');
    this.state.ideas[index]=normalizeIdea({...this.state.ideas[index],...patch,updatedAt:timestamp()}); this.persist(); return this.state.ideas[index];
  }
  archiveIdea(id, archived=true) { return this.updateIdea(id,{archived}); }
  addSong(input) {
    const song=normalizeSong(input); this.state.songs.unshift(song);
    if (input.body) this.addVersion(song.id, input.body, 'Initial draft'); else this.persist();
    return this.state.songs.find(x=>x.id===song.id);
  }
  updateSong(id, patch) {
    const index=this.state.songs.findIndex(x=>x.id===id); if(index<0) throw new Error('Song not found');
    this.state.songs[index]=normalizeSong({...this.state.songs[index],...patch,updatedAt:timestamp()}); this.persist(); return this.state.songs[index];
  }
  addVersion(songId, body, changeNote='') {
    const parent=this.state.versions.filter(v=>v.songId===songId).sort((a,b)=>b.number-a.number)[0]||null;
    const version=normalizeVersion({songId,body,changeNote,parentVersionId:parent?.id||null,number:nextVersionNumber(this.state.versions,songId)});
    this.state.versions.push(version);
    const idx=this.state.songs.findIndex(s=>s.id===songId);
    if(idx>=0) this.state.songs[idx]=normalizeSong({...this.state.songs[idx],currentVersionId:version.id,updatedAt:timestamp()});
    this.persist(); return version;
  }
  addLink(fromId,toId,relation='related') {
    if(fromId===toId) throw new Error('Cannot link an item to itself');
    const exists=this.state.links.some(l=>l.fromId===fromId&&l.toId===toId&&l.relation===relation);
    if(!exists) this.state.links.push({id:crypto.randomUUID(),fromId,toId,relation,createdAt:timestamp()});
    this.persist();
  }
  removeLink(id) { this.state.links=this.state.links.filter(x=>x.id!==id); this.persist(); }
  exportJSON() { return JSON.stringify(this.state,null,2); }
}
