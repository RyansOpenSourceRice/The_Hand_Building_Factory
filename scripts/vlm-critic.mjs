// Vision critic: reads the captures `npm run qa:critic` already produced and
// asks a vision model whether each claim from docs/SPECIFICATION.md holds.
// The deterministic gates (qa:geometry, qa:critic, the E2E playthrough) stay
// authoritative; this only reports what pixels show that they cannot see.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_MODEL = 'qwen/qwen3-vl-30b-a3b-instruct';
const DEFAULT_VOTES = 3;
const REQUIRED_AGREEMENT = 2;

// Each check is phrased as something a capture can actually show. A check the
// shot cannot answer must come back "unverifiable" rather than pass.
const CHECKS = [
  ['hand-complete',
    'All 25 parts are assembled into one connected hand: palm on the stand, ' +
    'four fingers and one thumb, upper cover on the back.'],
  ['hand-upright',
    'The hand stands on the pedestal with the palm facing the viewer and the ' +
    'fingers pointing up. No part floats detached from the assembly.'],
  ['screws-seated',
    'Every visible screw head sits flush on a part surface. No screw floats ' +
    'in the air, intersects the stand or its table, or points out of its ' +
    'hole.'],
  ['cover-hides-servos',
    'The upper cover is on, so the five servos are not visible on the ' +
    'back of the palm.'],
  ['no-interpenetration',
    'No two printed parts pass through each other, and no part passes ' +
    'through the pedestal, conveyor or barrier.'],
  ['filament-look',
    'The printed parts read as tinted filament with a visible surface grain, ' +
    'not flat untextured colour and not a blown-out white.'],
  ['scene-lit',
    'The scene is evenly lit and legible: no black frame, no blown-out ' +
    'highlights over the hand, no missing geometry holes.'],
  ['hud-clear',
    'No HUD or status overlay covers the hand itself, and any visible ' +
    'text is upright and readable.'],
  ['audience',
    'Behind the barrier there are two rows of six seated audience figures in ' +
    'blue hard hats facing the player, when the view includes that area.'],
  ['arrows-cleared',
    'With the build finished, no yellow guide arrow still hovers over a part ' +
    'or a screw.'],
];

function loadKey() {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }
  const raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  const line = raw.split('\n').find((entry) =>
    entry.startsWith('OPENROUTER_API_KEY='));
  if (!line) {
    throw new Error('OPENROUTER_API_KEY not set and .env.local has no entry');
  }
  return line.slice('OPENROUTER_API_KEY='.length).trim();
}

function args() {
  const argv = process.argv.slice(2);
  const get = (flag, fallback) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : argv[index + 1];
  };
  const out = get('--out', resolve(ROOT, 'qa-out'));
  return {
    model: get('--model', DEFAULT_MODEL),
    votes: Number(get('--votes', DEFAULT_VOTES)),
    out,
    manifest: resolve(out, 'critic.json'),
  };
}

function instruction() {
  const list = CHECKS.map(([id, text]) => `- ${id}: ${text}`).join('\n');
  return [
    'You are a QA reviewer for a VR assembly game called HANDS ON!.',
    'You see screenshots of the finished build plus a state manifest from a',
    'deterministic simulator audit that already passed.',
    '',
    'Judge only what the images show. For each check answer one of:',
    '- "satisfied": the images clearly show it.',
    '- "violated": the images clearly contradict it. Say where.',
    '- "unverifiable": this view cannot show it. Never guess.',
    '',
    'A false alarm costs more than a miss: report "violated" only when you can',
    'point at the pixels that prove it, and name the shot in "shot".',
    '',
    'Checks:',
    list,
    '',
    'Reply with JSON only, no prose and no code fence:',
    '{"checks":[{"id":"<check id>",' +
      '"verdict":"satisfied|violated|unverifiable",' +
      '"shot":"<file name>","evidence":"<what you see, one sentence>",' +
      '"severity":"low|medium|high",' +
      '"fix":"<one line, only when violated>"}]}',
  ].join('\n');
}

function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`no JSON object in reply: ${text.slice(0, 300)}`);
  }
  return JSON.parse(body.slice(start, end + 1));
}

function dataUrl(file) {
  // The critic captures are already 960x540 and about 400 KB, which is the
  // right size for a vision model request.
  return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
}

async function ask(model, manifest, shots) {
  const content = [{type: 'text', text: instruction()}];
  for (const shot of shots) {
    content.push({type: 'text', text: `Shot: ${shot.view} (${shot.file})`});
    content.push({type: 'image_url', image_url: {url: dataUrl(shot.file)}});
  }
  content.push({
    type: 'text',
    text: 'State manifest: ' + JSON.stringify({
      parts: manifest.parts,
      audit: manifest.audit,
      pageErrors: manifest.pageErrors,
      failures: manifest.failures,
    }),
  });
  const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loadKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [{role: 'user', content}],
        }),
      });
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    throw new Error(`no reply: ${JSON.stringify(payload).slice(0, 400)}`);
  }
  return {reply: parseJson(text), cost: payload.usage?.cost ?? 0};
}

function tally(votes, id) {
  const verdicts = votes
      .map((vote) => vote.reply.checks?.find((check) => check.id === id))
      .filter(Boolean);
  if (!verdicts.length) {
    return {verdict: 'unverifiable', sample: null, agrees: 0};
  }
  const counts = new Map();
  for (const vote of verdicts) {
    counts.set(vote.verdict, (counts.get(vote.verdict) ?? 0) + 1);
  }
  const [verdict, agrees] =
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const sample = verdicts.find((vote) => vote.verdict === verdict) ?? null;
  return {verdict, sample, agrees};
}

async function main() {
  const opts = args();
  if (!existsSync(opts.manifest)) {
    throw new Error(`missing ${opts.manifest}; run: npm run qa:critic`);
  }
  const manifest = JSON.parse(readFileSync(opts.manifest, 'utf8'));
  const shots = (manifest.shots ?? []).filter((shot) => !shot.blank);
  if (!shots.length) {
    throw new Error('no usable captures in the manifest');
  }

  const votes = [];
  for (let round = 0; round < opts.votes; round++) {
    votes.push(await ask(opts.model, manifest, shots));
  }

  const results = CHECKS.map(([id]) => {
    const {verdict, sample, agrees} = tally(votes, id);
    return {
      id,
      verdict,
      agrees,
      of: votes.length,
      shot: sample?.shot ?? null,
      evidence: sample?.evidence ?? null,
      severity: sample?.severity ?? 'low',
      fix: sample?.fix ?? null,
    };
  });

  const failures = results.filter((result) =>
    result.verdict === 'violated' &&
    (result.agrees >= REQUIRED_AGREEMENT || votes.length === 1));
  const severe = failures.filter((result) => result.severity === 'high');
  const unverifiable = results.filter((result) =>
    result.verdict === 'unverifiable');
  const cost = votes.reduce((sum, vote) => sum + vote.cost, 0);

  mkdirSync(opts.out, {recursive: true});
  writeFileSync(resolve(opts.out, 'vlm-critic.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: opts.model,
    votes: votes.length,
    shots: shots.map((shot) => shot.view),
    results,
    cost,
  }, null, 2));

  for (const result of results) {
    const mark = result.verdict === 'violated' ? 'FAIL' :
      result.verdict === 'unverifiable' ? 'skip' : 'ok  ';
    const detail = result.verdict === 'violated' ?
      ` (${result.shot}) ${result.evidence}` : '';
    console.log(`${mark} ${result.id.padEnd(18)} ` +
      `${result.agrees}/${result.of}${detail}`);
  }
  console.log(`vlm      ${results.length - failures.length} satisfied, ` +
    `${failures.length} violated, ${unverifiable.length} unverifiable, ` +
    `${shots.length} shots, $${cost.toFixed(4)}`);

  const pageErrors = manifest.pageErrors ?? [];
  if (pageErrors.length) {
    console.error(`page errors: ${JSON.stringify(pageErrors)}`);
  }
  if (severe.length || pageErrors.length) {
    process.exitCode = 1;
  }
}

await main();
