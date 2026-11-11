import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

const TEXTURES = {
  'concrete-floor': 'Seamless tileable albedo texture of a polished light ' +
      'grey concrete warehouse floor. Photorealistic, subtle aggregate ' +
      'speckle, faint darker stains and scuffs, shallow saw-cut joint ' +
      'lines forming a sparse square grid, evenly lit, no shadows, no ' +
      'objects, flat orthographic top-down view, repeats seamlessly on ' +
      'all edges.',
  'metal-roof': 'Seamless tileable albedo texture of light grey ' +
      'galvanized corrugated sheet metal roofing. Photorealistic, crisp ' +
      'parallel corrugation ribs, subtle weathering and faint rust ' +
      'flecks at panel seams, evenly lit, no shadows, no objects, flat ' +
      'orthographic view, ribs run horizontally, repeats seamlessly on ' +
      'all edges.',
};

const name = process.argv[2];
if (!(name in TEXTURES)) {
  const choices = Object.keys(TEXTURES).join('|');
  throw new Error(`usage: node scripts/gen-textures.mjs <${choices}>`);
}

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
const outDir = resolve(ROOT, 'public', 'textures');
mkdirSync(outDir, {recursive: true});
const outPath = resolve(outDir, `${name}.png`);
writeFileSync(outPath, Buffer.from(base64, 'base64'));
console.log(`wrote ${outPath} (${Buffer.from(base64, 'base64').length} bytes)`);
