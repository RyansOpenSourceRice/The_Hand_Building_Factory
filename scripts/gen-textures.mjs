import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 256;
const OUT_DIR = resolve(ROOT, 'public', 'textures');

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

const SEAMLESS = 'Evenly lit, no cast shadows, no objects, flat orthographic ' +
  'view, seamless tileable texture that repeats on all four edges.';

const TEXTURES = {
  'pla-layer-256': 'Photorealistic grayscale FDM 3D-printer PLA surface. ' +
    'Fine horizontal extrusion layer lines with slight random wobble, a ' +
    'faint satin sheen, very subtle dust in the layer grooves, neutral ' +
    'mid-grey so it can be tinted. ' + SEAMLESS,
  'painted-steel-256': 'Photorealistic powder-coated industrial machine ' +
    'paint in neutral light slate grey. Fine orange-peel micrograin, sparse ' +
    'tiny chips, subtle tone variation and faint workshop dust. ' + SEAMLESS,
  'bare-steel-256': 'Photorealistic brushed stainless steel sheet. Fine ' +
    'horizontal brushing grain, light grey, soft sheen variation, a few ' +
    'faint smudges and micro-scratches. ' + SEAMLESS,
  'concrete-256': 'Photorealistic polished light-grey concrete warehouse ' +
    'floor. Subtle aggregate speckle, faint darker stains and scuffs, no ' +
    'large joint lines, neutral tone. ' + SEAMLESS,
  'galvanized-256': 'Photorealistic galvanized corrugated sheet metal. ' +
    'Crisp narrow parallel ribs, cool light grey zinc spangle, faint ' +
    'weathering and tiny rust freckles, ribs run horizontally. ' + SEAMLESS,
  'cardboard-256': 'Photorealistic plain brown corrugated cardboard. Fine ' +
    'paper fibre grain, subtle corrugation ridges, faint creases and small ' +
    'scuffs, blank with no labels or text. ' + SEAMLESS,
  'wood-256': 'Photorealistic unfinished pine pallet wood. Straight fine ' +
    'grain, pale warm timber, a few small knots and saw marks, subtle ' +
    'wear. ' + SEAMLESS,
  'rubber-256': 'Photorealistic black industrial rubber. Fine matte ' +
    'vulcanized grain, faint mould texture, subtle grey dust in the ' +
    'recesses, low sheen. ' + SEAMLESS,
  'hazard-256': 'Seamless tileable black and safety-yellow diagonal hazard ' +
    'stripe tape on painted steel. Slightly worn edges, scuffs and tiny ' +
    'scratches, low-contrast muted yellow, three broad stripes, crisp but ' +
    'not glowing. ' + SEAMLESS,
  'pegboard-256': 'Photorealistic dark slate-grey workshop pegboard. ' +
    'Regular grid of small round holes with subtle chamfers, faint dust ' +
    'and light scuffs. ' + SEAMLESS,
  'fabric-256': 'Photorealistic durable grey-blue woven upholstery fabric. ' +
    'Fine visible weave, subtle colour variation, faint wear and small ' +
    'pilling, matte. ' + SEAMLESS,
  'safety-mesh-256': 'Photorealistic galvanized steel safety mesh with a ' +
    'regular square diamond aperture, thin wire, faint zinc texture and ' +
    'small scuffs, transparent-looking gaps that read as dark holes. ' +
    SEAMLESS,
};

async function generate(name) {
  const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loadKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'bytedance-seed/seedream-5-0-flash',
          messages: [{role: 'user', content: TEXTURES[name]}],
        }),
      },
  );
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  const images = payload?.choices?.[0]?.message?.images;
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error(
        `no image in response: ${JSON.stringify(payload).slice(0, 600)}`);
  }
  const dataUrl = images[0].image_url.url;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  mkdirSync(OUT_DIR, {recursive: true});
  const outPath = resolve(OUT_DIR, `${name}.png`);
  writeFileSync(outPath, Buffer.from(base64, 'base64'));
  execFileSync('magick', [
    outPath,
    '-resize', `${SIZE}x${SIZE}!`,
    '-strip',
    '-define', 'png:compression-level=9',
    outPath,
  ]);
  console.log(`wrote ${outPath} (${SIZE}x${SIZE})`);
}

const args = process.argv.slice(2);
const names = args.includes('all') ? Object.keys(TEXTURES) :
    args.filter((arg) => !arg.startsWith('--'));
if (names.length === 0) {
  throw new Error(`usage: node scripts/gen-textures.mjs ` +
    `<${Object.keys(TEXTURES).join('|')}|all> [--force]`);
}
for (const name of names) {
  if (!(name in TEXTURES)) {
    throw new Error(`unknown texture ${name}`);
  }
  if (!args.includes('--force') &&
      existsSync(resolve(OUT_DIR, `${name}.png`))) {
    console.log(`skip ${name} (already exists)`);
    continue;
  }
  await generate(name);
}
