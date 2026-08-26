import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalStore } from '../src/store.js';

class MemoryStorage { constructor(){this.map=new Map()} getItem(k){return this.map.get(k)??null} setItem(k,v){this.map.set(k,String(v))} removeItem(k){this.map.delete(k)} }

test('store can create an idea and recover it from persistence', () => {
  const storage=new MemoryStorage(); const store=new LocalStore(storage);
  const idea=store.addIdea({type:'hook',title:'My hook',content:'one line'});
  const recovered=new LocalStore(storage);
  assert.equal(recovered.state.ideas[0].id,idea.id);
  assert.equal(recovered.state.ideas[0].content,'one line');
});

test('saving a version changes the song currentVersionId', () => {
  const store=new LocalStore(new MemoryStorage());
  const song=store.addSong({title:'Song'});
  const version=store.addVersion(song.id,'hello','first draft');
  const saved=store.state.songs.find(s=>s.id===song.id);
  assert.equal(saved.currentVersionId,version.id);
  assert.equal(store.state.versions.length,1);
});

test('a song can retain multiple immutable versions', () => {
  const store=new LocalStore(new MemoryStorage());
  const song=store.addSong({title:'Song'});
  const v1=store.addVersion(song.id,'first','v1');
  const v2=store.addVersion(song.id,'second','v2');
  assert.equal(v1.body,'first');
  assert.equal(v2.body,'second');
  assert.equal(v2.parentVersionId,v1.id);
  assert.equal(v1.number,1);
  assert.equal(v2.number,2);
});

test('archiving does not delete an idea', () => {
  const store=new LocalStore(new MemoryStorage());
  const idea=store.addIdea({type:'snippet',title:'Keep this',content:'maybe later'});
  store.archiveIdea(idea.id,true);
  assert.equal(store.state.ideas.length,1);
  assert.equal(store.state.ideas[0].archived,true);
});
