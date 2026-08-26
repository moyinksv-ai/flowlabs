import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdea, createSong, createVersion, matchesIdea, nextVersionNumber, IDEA_TYPES } from '../src/domain.js';

test('idea normalization is deterministic for supplied fields', () => {
  const idea = createIdea({id:'idea_1',type:'hook',title:'  Hook  ',content:'  line  ',tags:['hook','hook','']});
  assert.deepEqual({id:idea.id,type:idea.type,title:idea.title,content:idea.content,tags:idea.tags},{id:'idea_1',type:'hook',title:'Hook',content:'line',tags:['hook']});
});

test('unknown idea types become other', () => {
  const idea=createIdea({id:'x',type:'made_up',content:'x'});
  assert.equal(idea.type,'other');
  assert.equal(IDEA_TYPES[idea.type],'Other');
});

test('search matches every query token', () => {
  const idea=createIdea({id:'x',type:'phrase',title:'Midnight phrase',content:'dont tell nobody',tags:['late-night','hook']});
  assert.equal(matchesIdea(idea,'midnight hook'),true);
  assert.equal(matchesIdea(idea,'midnight morning'),false);
});

test('version numbers increment per song only', () => {
  const versions=[createVersion({songId:'a',number:1}),createVersion({songId:'a',number:4}),createVersion({songId:'b',number:9})];
  assert.equal(nextVersionNumber(versions,'a'),5);
  assert.equal(nextVersionNumber(versions,'b'),10);
});

test('song accepts only known sections', () => {
  const song=createSong({id:'s',title:'Test',sections:['verse','chorus','nonsense']});
  assert.deepEqual(song.sections,['verse','chorus']);
});
