import {randomUUID} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LINES_FILE = resolve(ROOT, 'src', 'audio', 'voice-lines.json');
const OUT_DIR = resolve(ROOT, 'public', 'audio', 'voice');
const MODEL = 'speechify/simba-3.5';
const VOICE = 'geffen_32';
const FORCE = process.argv.includes('--force');

function loadKey(name) {
  if (process.env[name]) {
    return process.env[name];
  }
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  const line = raw.split('\n').find((entry) => entry.startsWith(`${name}=`));
  if (!line) {
    throw new Error(`${name} not set and .env.local has no entry`);
  }
  return line.slice(`${name}=`.length).trim();
}

async function synthesize(text) {
  let lastError = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(
        'https://openrouter.ai/api/v1/audio/speech',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loadKey('OPENROUTER_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MODEL,
            voice: VOICE,
            input: text,
            response_format: 'mp3',
          }),
        },
    );
    if (response.ok) {
      const type = response.headers.get('content-type') ?? '';
      if (!type.startsWith('audio/')) {
        throw new Error(`unexpected content type ${type}`);
      }
      return Buffer.from(await response.arrayBuffer());
    }
    lastError = `${response.status}: ${await response.text()}`;
    if (response.status !== 429 && response.status < 500) {
      break;
    }
    await new Promise((done) => setTimeout(done, 3000 * (attempt + 1)));
  }
  throw new Error(`speech request failed ${lastError}`);
}

function compress(rawFile, outFile) {
  execFileSync('ffmpeg', [
    '-y', '-i', rawFile, '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,' +
    'areverse,silenceremove=start_periods=1:start_threshold=-50dB:' +
    'start_silence=0.08,areverse,loudnorm=I=-18:TP=-2:LRA=7',
    '-ac', '1', '-ar', '24000',
    '-codec:a', 'libvorbis', '-q:a', '2', outFile,
  ]);
}

const lines = JSON.parse(readFileSync(LINES_FILE, 'utf8'));
mkdirSync(OUT_DIR, {recursive: true});
const keys = Object.keys(lines);
let made = 0;
let skipped = 0;
let pendingChars = 0;

for (const key of keys) {
  const line = lines[key];
  const outFile = resolve(OUT_DIR, line.file);
  if (!FORCE && existsSync(outFile) && statSync(outFile).size > 1024) {
    skipped++;
    continue;
  }
  const rawFile = resolve(tmpdir(), `voice-${randomUUID()}.mp3`);
  try {
    const audio = await synthesize(line.text);
    writeFileSync(rawFile, audio);
    compress(rawFile, outFile);
    pendingChars += line.text.length;
    made++;
    console.log(`${key} -> ${line.file} (${line.text.length} chars)`);
  } finally {
    rmSync(rawFile, {force: true});
  }
}

console.log(`done: ${made} generated, ${skipped} kept, ` +
    `${pendingChars} new characters`);
