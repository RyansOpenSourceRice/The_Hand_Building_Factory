import {randomUUID} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync, statSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public', 'audio');

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

const SOUNDS = {
  'music-loop': {
    service: 'runware',
    duration: 45,
    prompt: 'Instrumental ambient factory soundscape, calm and peaceful, ' +
        'warm soft synth pads, gentle mechanical hum, distant soft echoes, ' +
        'steady and continuous, no rhythm changes, no melody spikes, no ' +
        'intro or ending, seamless loop, quiet enough to talk over, no ' +
        'vocals',
  },
  'screw-ratchet': {
    service: 'replicate',
    duration: 2,
    prompt: 'Short mechanical ratchet clicks, a hand screwdriver rapidly ' +
        'clicking a ratchet mechanism driving a metal screw, precise ' +
        'metallic ticking, dry close-up foley, no reverb, no music',
  },
  'screw-driven': {
    service: 'replicate',
    duration: 2,
    prompt: 'A single metallic click as a screw seats tight into a socket, ' +
        'short satisfying metal snap tick, dry foley, close-up, no music',
  },
  'part-snap': {
    service: 'replicate',
    duration: 2,
    prompt: 'A satisfying plastic-on-plastic click as a machine part snaps ' +
        'into place, short firm connection click with a slight metallic ' +
        'ring, dry foley, no music',
  },
  'part-drop': {
    service: 'replicate',
    duration: 2,
    prompt: 'A soft heavy plastic part landing flat on a wooden workbench, ' +
        'single muffled thud with a slight settle, dry close foley, no music',
  },
  'crowd-cheer': {
    service: 'replicate',
    duration: 6,
    prompt: 'A short distant crowd cheering inside a large factory hall, ' +
        'warm applause and a few happy whoos, medium distance, gentle, ' +
        'fades naturally at the end, no music',
  },
};

const RUNWARE_MODEL = 'minimax:music@2.6';
const REPLICATE_MODEL = 'stability-ai/stable-audio-2.5';

function authHeaders() {
  return {
    'Authorization': `Bearer ${loadKey('RUNWARE_API_KEY')}`,
    'Content-Type': 'application/json',
  };
}

async function pollRunware(taskUUID) {
  const deadline = Date.now() + 480000;
  while (Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 3000));
    const response = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify([{
        taskType: 'getResponse',
        taskUUID: taskUUID,
      }]),
    });
    const payload = await response.json();
    const task = (Array.isArray(payload) ? payload : payload.data ?? [])[0];
    if (!task) {
      continue;
    }
    if (task.status === 'success' && task.audioURL) {
      return task.audioURL;
    }
    if (task.status === 'error' || task.error) {
      throw new Error(`runware task error: ${JSON.stringify(task)}`);
    }
  }
  throw new Error('runware poll timed out');
}

async function genRunware(prompt) {
  const taskUUID = randomUUID();
  const response = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify([{
      taskType: 'audioInference',
      taskUUID: taskUUID,
      model: RUNWARE_MODEL,
      positivePrompt: prompt,
      settings: {instrumental: true},
      outputFormat: 'WAV',
    }]),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`runware ${response.status}: ${JSON.stringify(payload)}`);
  }
  const data = payload.data?.[0];
  if (data?.error) {
    throw new Error(`runware task error: ${JSON.stringify(data)}`);
  }
  let url = data?.audioURL;
  if (!url && data?.audioBase64Data) {
    url = `data:audio/wav;base64,${data.audioBase64Data}`;
  }
  if (!url) {
    if (data?.status && data.status !== 'processing') {
      throw new Error('runware status ' +
          `${data.status}: ${JSON.stringify(data).slice(0, 400)}`);
    }
    url = await pollRunware(taskUUID);
  }
  const audio = await fetch(url);
  if (!audio.ok) {
    throw new Error(`runware audio fetch ${audio.status}`);
  }
  return Buffer.from(await audio.arrayBuffer());
}

async function genReplicate(prompt, duration) {
  let create;
  for (let attempt = 0; attempt < 4; attempt++) {
    create = await fetch(
        'https://api.replicate.com/v1/models/' +
        `${REPLICATE_MODEL}/predictions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loadKey('REPLICATE_API_TOKEN')}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait=60',
          },
          body: JSON.stringify({
            input: {prompt, duration, steps: 8},
          }),
        });
    if (create.status !== 429) {
      break;
    }
    const wait = Number(create.headers.get('retry-after') ?? '10') + 2;
    console.log(`throttled, waiting ${wait}s`);
    await new Promise((done) => setTimeout(done, wait * 1000));
    create = null;
  }
  if (!create) {
    throw new Error('replicate kept throttling the request');
  }
  let prediction = await create.json();
  if (!create.ok && create.status !== 201) {
    throw new Error(
        `replicate ${create.status}: ${JSON.stringify(prediction)}`);
  }
  const deadline = Date.now() + 300000;
  while (prediction.status === 'starting' ||
      prediction.status === 'processing') {
    if (Date.now() > deadline) {
      throw new Error('replicate prediction timed out');
    }
    await new Promise((done) => setTimeout(done, 3000));
    const poll = await fetch(prediction.urls.get, {
      headers: {
        'Authorization': `Bearer ${loadKey('REPLICATE_API_TOKEN')}`,
      },
    });
    prediction = await poll.json();
  }
  if (prediction.status !== 'succeeded') {
    throw new Error(
        `replicate ${prediction.status}: ${prediction.error ?? ''}`);
  }
  const audio = await fetch(prediction.output);
  if (!audio.ok) {
    throw new Error(`replicate audio fetch ${audio.status}`);
  }
  return Buffer.from(await audio.arrayBuffer());
}

function probeSeconds(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ]).toString().trim();
  return Number.parseFloat(out);
}

function compress(name, rawFile, loop) {
  const out = resolve(OUT_DIR, `${name}.ogg`);
  mkdirSync(OUT_DIR, {recursive: true});
  if (loop) {
    const total = probeSeconds(rawFile);
    const cross = Math.min(2, total / 4);
    const length = Math.max(total - 0.05, cross * 3);
    execFileSync('ffmpeg', [
      '-y', '-i', rawFile, '-filter_complex',
      '[0:a]asplit=2[a][b];' +
      `[a]atrim=end=${length.toFixed(3)},asetpts=PTS-STARTPTS[main];` +
      `[b]atrim=start=${(length - cross).toFixed(3)},` +
      'asetpts=PTS-STARTPTS[tail];' +
      '[main][tail]amix=inputs=2:duration=first:normalize=0,' +
      'alimiter=limit=0.95[out]',
      '-map', '[out]', '-ac', '1', '-ar', '44100',
      '-codec:a', 'libvorbis', '-q:a', '4', out,
    ]);
  } else {
    execFileSync('ffmpeg', [
      '-y', '-i', rawFile, '-af', 'silenceremove=' +
      'start_periods=1:start_threshold=-45dB:start_silence=0.02,' +
      'areverse,silenceremove=' +
      'start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse',
      '-ac', '1', '-ar', '44100',
      '-codec:a', 'libvorbis', '-q:a', '3', out,
    ]);
  }
  return statSync(out).size;
}

const name = process.argv[2];
if (!name || !(name in SOUNDS)) {
  const choices = Object.keys(SOUNDS).join('|');
  throw new Error(`usage: node scripts/gen-audio.mjs <${choices}>`);
}

const sound = SOUNDS[name];
console.log(`generating ${name}: ${sound.service} ` +
    `(${sound.service === 'runware' ? RUNWARE_MODEL : REPLICATE_MODEL})`);
const raw = resolve(tmpdir(), `gen-audio-${name}.wav`);
let buffer;
if (sound.service === 'runware') {
  buffer = await genRunware(sound.prompt);
} else {
  buffer = await genReplicate(sound.prompt, sound.duration);
}
writeFileSync(raw, buffer);
const bytes = compress(name, raw, sound.service === 'runware');
console.log(`wrote ${name}.ogg (${(bytes / 1024).toFixed(0)} KiB) ` +
    `from ${(buffer.length / 1024).toFixed(0)} KiB source`);
