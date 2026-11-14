import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 256;
const TEXTURE_MODEL = 'bytedance-seed/seedream-5-5';
const PANORAMA_MODEL = 'tencent/hy-world-2.1-panorama';
const PANORAMA_PROMPT_LIMIT = 600;
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
  // Detail map for the printed hand parts, which carry real unwrapped UVs
  // and take their colour from the filament palette.
  'filament-512': 'Photorealistic macro photograph of a neutral grey FDM ' +
    '3D-printer PLA surface straight off the bed. Fine, evenly spaced ' +
    'horizontal extrusion layer lines with a slight random wobble, faint ' +
    'satin sheen along each ridge, tiny dust in the grooves, mid-grey and ' +
    'colourless so it can be tinted. ' + SEAMLESS,
};

// The hand detail map is the one photo texture in the build, so it gets a
// bigger square than the shared hall tiles.
const SIZES = {'filament-512': 512};

async function postProcess(path, name) {
  const size = SIZES[name] ?? SIZE;
  const args = [path, '-alpha', 'off', '-resize', `${size}x${size}!`];
  if (name === 'filament-512') {
    // Gray, then squeeze the tone into the same narrow band the painted
    // tiles use (111-144) so the filament palette tints it and no baked
    // lighting shows through a colour change. Polynomial coefficients are
    // in normalised units: gain 0.1294, offset 0.4353.
    args.push(
        '-colorspace', 'Gray',
        '-auto-level',
        '-function', 'polynomial', '0.1294,0.4353',
        '-type', 'TrueColor',
    );
  }
  args.push('-strip', '-define', 'png:compression-level=9', path);
  execFileSync('magick', args);
  console.log(`wrote ${path} (${size}x${size})`);
}

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
          model: TEXTURE_MODEL,
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
  await postProcess(outPath, name);
}

// HY-World 2.1 Panorama answers one text prompt with a single 360 degree
// equirectangular image and caps the prompt at 600 characters, so this is
// one request per run and no tile set.
const PANORAMA = {
  'hall-vista': 'A vast dim industrial factory hall seen from the stage ' +
    'end, steel columns and roof trusses overhead, rows of idle machines, ' +
    'pallet stacks and cable trays receding into cool grey-blue haze, high ' +
    'bay lights glowing faintly, empty concrete floor, no people, no text, ' +
    'muted desaturated palette, calm photographic realism.',
};

async function generatePanorama(name) {
  const prompt = PANORAMA[name];
  if (prompt.length > PANORAMA_PROMPT_LIMIT) {
    throw new Error(
        `panorama prompt is ${prompt.length} characters, limit is ` +
        `${PANORAMA_PROMPT_LIMIT}`);
  }
  // Panorama models are image models, so they answer the images endpoint
  // rather than chat completions.
  const response = await fetch(
      'https://openrouter.ai/api/v1/images',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${loadKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({model: PANORAMA_MODEL, prompt}),
      },
  );
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  }
  const payload = await response.json();
  const image = payload?.data?.[0];
  if (!image) {
    throw new Error(
        `no panorama in response: ${JSON.stringify(payload).slice(0, 600)}`);
  }
  const bytes = image.b64_json ?
    Buffer.from(image.b64_json, 'base64') :
    Buffer.from(await (await fetch(image.url)).arrayBuffer());
  mkdirSync(OUT_DIR, {recursive: true});
  const outPath = resolve(OUT_DIR, `${name}.png`);
  writeFileSync(outPath, bytes);
  // Keep the equirectangular 2:1 shape and the texture budget small: the
  // backdrop is 25 m away and sits in fog.
  execFileSync('magick', [
    outPath,
    '-alpha', 'off',
    '-resize', '512x256!',
    '-strip',
    '-define', 'png:compression-level=9',
    outPath,
  ]);
  console.log(`wrote ${outPath} (512x256 panorama)`);
}

const args = process.argv.slice(2);
if (args.includes('--panorama')) {
  const names = args.filter((arg) => !arg.startsWith('--'));
  const targets = names.length ? names : Object.keys(PANORAMA);
  for (const name of targets) {
    if (!(name in PANORAMA)) {
      throw new Error(`unknown panorama ${name}`);
    }
    await generatePanorama(name);
  }
} else {
  const names = args.includes('all') ? Object.keys(TEXTURES) :
      args.filter((arg) => !arg.startsWith('--'));
  if (names.length === 0) {
    throw new Error(`usage: node scripts/gen-textures.mjs ` +
      `<${Object.keys(TEXTURES).join('|')}|all> [--force] | ` +
      `--panorama <${Object.keys(PANORAMA).join('|')}>`);
  }
  for (const name of names) {
    if (!(name in TEXTURES)) {
      throw new Error(`unknown texture ${name}`);
    }
    const outPath = resolve(OUT_DIR, `${name}.png`);
    if (!args.includes('--force') && existsSync(outPath)) {
      console.log(`skip ${name} (already exists)`);
      continue;
    }
    await generate(name);
  }
}
