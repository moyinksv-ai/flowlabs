import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'index.html','config.js','package.json','vercel.json','.env.example',
  'src/app.js','src/cloud.js','src/domain.js','src/store.js','src/media-store.js','src/styles.css',
  'api/ai.js','api/health.js','supabase/migrations/001_initial.sql',
  'icon-192.png','icon-512.png','manifest.json','sw.js'
];
const missing = required.filter(file => !fs.existsSync(path.join(root,file)));
if (missing.length) throw new Error(`Missing required files:\n${missing.join('\n')}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if (pkg.type !== 'module') throw new Error('package.json must use ESM');
for (const script of ['test','check','preflight','serve']) if (!pkg.scripts?.[script]) throw new Error(`Missing npm script: ${script}`);

const index = fs.readFileSync(path.join(root,'index.html'),'utf8');
if (!index.includes('config.js') || !index.includes('src/app.js')) throw new Error('index.html missing config.js or src/app.js');
const cloud = fs.readFileSync(path.join(root,'src/cloud.js'),'utf8');
const browserFiles = [index, fs.readFileSync(path.join(root,'config.js'),'utf8'), fs.readFileSync(path.join(root,'src/app.js'),'utf8'), cloud];
if (browserFiles.some(text => /GEMINI_API_KEY|SUPABASE_SECRET_KEY|SUPABASE_SECRET_KEYS/.test(text))) throw new Error('A server secret name was found in browser source');

const config = fs.readFileSync(path.join(root,'config.js'),'utf8');
if (!config.includes('SUPABASE_URL') || !config.includes('SUPABASE_PUBLISHABLE_KEY')) throw new Error('config.js missing public Supabase placeholders');
const env = fs.readFileSync(path.join(root,'.env.example'),'utf8');
for (const name of ['GEMINI_API_KEY','GEMINI_MODEL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY']) if (!env.includes(name)) throw new Error(`Missing env placeholder: ${name}`);

const api = fs.readFileSync(path.join(root,'api/ai.js'),'utf8');
if (!api.includes('/auth/v1/user')) throw new Error('AI endpoint does not verify the Supabase user session');
if (!api.includes('generativelanguage.googleapis.com')) throw new Error('AI endpoint is not wired to Gemini');

console.log('FlowLab Acode/Vercel preflight: PASS');
console.log(`Files verified: ${required.length}`);
console.log('Browser configuration: public Supabase placeholders only');
console.log('Server configuration: Gemini secret + Supabase server variables');
console.log('No build toolchain required for local Acode preview or Vercel static hosting');
