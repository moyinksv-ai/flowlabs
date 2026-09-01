const IDEA_TYPES = Object.freeze({
  hook: 'Hook',
  concept: 'Concept',
  phrase: 'Phrase',
  melody: 'Melody',
  unfinished_line: 'Unfinished line',
  theme: 'Theme',
  reference: 'Reference',
  snippet: 'Snippet',
  voice_note: 'Voice note',
  discarded_version: 'Discarded version',
  other: 'Other'
});

const SONG_SECTIONS = Object.freeze(['intro','verse','pre_chorus','chorus','post_chorus','bridge','outro']);

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const clean = value => String(value ?? '').trim();

function normalizeIdea(input={}) {
  const type = IDEA_TYPES[input.type] ? input.type : 'other';
  const timestamp = input.createdAt || now();
  return {
    id: input.id || id(),
    type,
    title: clean(input.title) || IDEA_TYPES[type],
    content: clean(input.content),
    notes: clean(input.notes),
    tags: Array.from(new Set((input.tags || []).map(clean).filter(Boolean))).slice(0, 20),
    color: input.color || 'default',
    archived: Boolean(input.archived),
    pinned: Boolean(input.pinned),
    songId: input.songId || null,
    createdAt: timestamp,
    updatedAt: input.updatedAt || timestamp
  };
}

function normalizeSong(input={}) {
  const timestamp = input.createdAt || now();
  const sections = Array.isArray(input.sections) && input.sections.length ? input.sections : ['verse','chorus'];
  return {
    id: input.id || id(),
    title: clean(input.title) || 'Untitled song',
    artist: clean(input.artist),
    bpm: Number.isFinite(Number(input.bpm)) ? Number(input.bpm) : null,
    key: clean(input.key),
    mood: clean(input.mood),
    notes: clean(input.notes),
    sections: sections.filter(s => SONG_SECTIONS.includes(s)),
    currentVersionId: input.currentVersionId || null,
    archived: Boolean(input.archived),
    createdAt: timestamp,
    updatedAt: input.updatedAt || timestamp
  };
}

function normalizeVersion(input={}) {
  const timestamp = input.createdAt || now();
  return {
    id: input.id || id(),
    songId: input.songId,
    number: Number.isInteger(input.number) ? input.number : 1,
    title: clean(input.title) || `Version ${input.number || 1}`,
    body: clean(input.body),
    sectionMap: input.sectionMap && typeof input.sectionMap === 'object' ? input.sectionMap : {},
    parentVersionId: input.parentVersionId || null,
    createdAt: timestamp,
    archived: Boolean(input.archived),
    changeNote: clean(input.changeNote)
  };
}

function createIdea(input) { return normalizeIdea(input); }
function createSong(input) { return normalizeSong(input); }
function createVersion({ songId, body='', parentVersionId=null, number=1, changeNote='' }) {
  return normalizeVersion({ songId, body, parentVersionId, number, changeNote });
}

function tokenizeSearch(text) {
  return clean(text).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 30);
}

function matchesIdea(idea, query) {
  const tokens = tokenizeSearch(query);
  if (!tokens.length) return true;
  const haystack = [idea.title, idea.content, idea.notes, idea.type, ...(idea.tags || [])].join(' ').toLowerCase();
  return tokens.every(token => haystack.includes(token));
}

function groupIdeas(ideas) {
  return ideas.reduce((groups, idea) => {
    (groups[idea.type] ||= []).push(idea);
    return groups;
  }, {});
}

function nextVersionNumber(versions, songId) {
  const current = versions.filter(v => v.songId === songId).reduce((max, v) => Math.max(max, v.number), 0);
  return current + 1;
}

function createInitialState() {
  return {
    schemaVersion: 2,
    ideas: [],
    songs: [],
    versions: [],
    links: [],
    settings: { demoSeeded: false }
  };
}
