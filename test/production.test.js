import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);

test('production package keeps server secrets out of the browser source', () => {
  const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const cloud = fs.readFileSync(path.join(root, 'src/cloud.js'), 'utf8');
  assert.equal(app.includes('GEMINI_API_KEY'), false);
  assert.equal(app.includes('SUPABASE_SECRET_KEY'), false);
  assert.equal(cloud.includes('SUPABASE_SECRET_KEY'), false);
});

test('deployment contract files exist', () => {
  for (const file of ['vercel.json', 'config.js', 'api/ai.js', 'api/health.js', 'supabase/migrations/001_initial.sql']) {
    assert.equal(fs.existsSync(path.join(root, file)), true, file);
  }
});

test('service worker never caches API responses', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  assert.match(sw, /startsWith\('\/api\/'\)/);
});
