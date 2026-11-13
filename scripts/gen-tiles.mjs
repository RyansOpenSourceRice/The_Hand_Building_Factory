import {writeFileSync, mkdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 256;

const CRC_TABLE = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function writePng(path, width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * width * 3, (y + 1) * width * 3);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

function noise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function set(pixels, x, y, r, g, b) {
  const offset = (y * SIZE + x) * 3;
  pixels[offset] = clamp(r);
  pixels[offset + 1] = clamp(g);
  pixels[offset + 2] = clamp(b);
}

function tile(fn) {
  const pixels = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = fn(x, y);
      set(pixels, x, y, r, g, b);
    }
  }
  return pixels;
}

const TAU = Math.PI * 2;

const generators = {
  'pla-layer-256': () => {
    const n = noise(0x9a1e);
    return tile((x, y) => {
      const wobble = Math.sin((x / SIZE) * TAU * 3) * 0.9 +
        Math.sin((x / SIZE) * TAU * 7 + 1.2) * 0.35;
      const line = 0.5 + 0.5 * Math.sin(((y + wobble) / SIZE) * TAU * 30);
      const micro = (n() - 0.5) * 9;
      const value = 127 + (line - 0.5) * 34 + micro;
      return [value, value, value * 1.01];
    });
  },
  'painted-steel-256': () => {
    const n = noise(0x51ee);
    return tile((x, y) => {
      const peel = Math.sin((x / SIZE) * TAU * 17) *
        Math.cos((y / SIZE) * TAU * 19) * 2.5;
      const grain = (n() - 0.5) * 8;
      const chip = n() > 0.997 ? -32 : 0;
      const value = 112 + peel + grain + chip;
      return [value - 1, value, value + 3];
    });
  },
  'bare-steel-256': () => {
    const n = noise(0x22bb);
    return tile((x, y) => {
      const brush = Math.sin((y + Math.sin(x * 0.09) * 2) * 1.7) * 5;
      const grain = (n() - 0.5) * 12;
      const streak = Math.sin((y / SIZE) * TAU * 41) * 3;
      const value = 186 + brush + grain + streak;
      return [value, value + 1, value + 3];
    });
  },
  'concrete-256': () => {
    const n = noise(0xc0ff);
    return tile((x, y) => {
      const u = x / SIZE;
      const v = y / SIZE;
      const speckle = (n() - 0.5) * 17;
      const stain = Math.sin(u * TAU + 1.3) *
        Math.cos(v * TAU - 0.7) * 7;
      const pores = n() > 0.986 ? -20 : 0;
      const value = 166 + speckle + stain + pores;
      return [value + 2, value, value - 4];
    });
  },
  'galvanized-256': () => {
    const n = noise(0x6a1c);
    return tile((x, y) => {
      const rib = Math.abs(Math.sin((x / SIZE) * TAU * 10));
      const spangle = Math.sin((x + y) * 0.16) *
        Math.sin((x - y) * 0.11) * 5;
      const grain = (n() - 0.5) * 7;
      const value = 158 + (rib - 0.5) * 34 + spangle + grain;
      return [value - 1, value + 1, value + 4];
    });
  },
  'cardboard-256': () => {
    const n = noise(0x7a11);
    return tile((x, y) => {
      const fibre = (n() - 0.5) * 13;
      const flute = Math.sin((x / SIZE) * TAU * 20) * 2.5;
      const crease = Math.sin((y / SIZE) * TAU * 3 + 0.7) * 4;
      return [142 + fibre + flute + crease, 97 + fibre * 0.6 + flute,
        55 + fibre * 0.3 + flute];
    });
  },
  'wood-256': () => {
    const n = noise(0x4d0d);
    return tile((x, y) => {
      const warp = Math.sin((x / SIZE) * TAU * 2.5) * 4;
      const grain = Math.sin(((y + warp) / SIZE) * TAU * 23) *
        Math.sin(((y - warp) / SIZE) * TAU * 7) * 7;
      const fibre = (n() - 0.5) * 8;
      const knot = Math.hypot(x - 66, y - 182) < 7 ? -22 : 0;
      return [167 + grain + fibre + knot, 122 + grain * 0.72 + fibre + knot,
        78 + grain * 0.45 + fibre + knot];
    });
  },
  'rubber-256': () => {
    const n = noise(0x1a55);
    return tile((x, y) => {
      const grain = (n() - 0.5) * 12;
      const mould = Math.sin((x / SIZE) * TAU * 31) *
        Math.cos((y / SIZE) * TAU * 29) * 2;
      const dust = n() > 0.994 ? 18 : 0;
      const value = 39 + grain + mould + dust;
      return [value, value + 1, value + 1];
    });
  },
  'hazard-256': () => {
    const n = noise(0x6f00);
    return tile((x, y) => {
      const phase = (x + y) % 64;
      const yellow = phase < 32;
      const scuff = (n() - 0.5) * 18;
      const wear = n() > 0.99 ? -20 : 0;
      if (yellow) {
        return [196 + scuff + wear, 154 + scuff + wear, 40 + scuff * 0.4];
      }
      return [28 + scuff * 0.4, 30 + scuff * 0.4, 34 + scuff * 0.4];
    });
  },
  'pegboard-256': () => {
    const n = noise(0x0f0f);
    return tile((x, y) => {
      const dx = (x % 32) - 16;
      const dy = (y % 32) - 16;
      const hole = Math.hypot(dx, dy) < 6.5;
      const grain = (n() - 0.5) * 10;
      if (hole) {
        const rim = Math.hypot(dx, dy) < 7.8 ? -18 : 0;
        return [22 + grain + rim, 26 + grain + rim, 31 + grain + rim];
      }
      const value = 74 + grain;
      return [value, value + 3, value + 7];
    });
  },
  'fabric-256': () => {
    const n = noise(0xa5a5);
    return tile((x, y) => {
      const weave = Math.sin((x / SIZE) * TAU * 64) *
        Math.sin((y / SIZE) * TAU * 64) * 8;
      const slub = (n() - 0.5) * 9;
      return [86 + weave + slub, 99 + weave + slub, 112 + weave + slub];
    });
  },
  'safety-mesh-256': () => {
    const n = noise(0x3c3c);
    return tile((x, y) => {
      const ax = Math.abs(((x + y) % 32) - 16);
      const ay = Math.abs(((x - y + SIZE) % 32) - 16);
      const wireA = ax < 1.5;
      const wireB = ay < 1.5;
      const grain = (n() - 0.5) * 10;
      if (wireA || wireB) {
        const value = 150 + grain;
        return [value, value + 2, value + 4];
      }
      const value = 28 + grain * 0.4;
      return [value, value + 2, value + 4];
    });
  },
};

const outDir = resolve(ROOT, 'public', 'textures');
mkdirSync(outDir, {recursive: true});
for (const [name, generate] of Object.entries(generators)) {
  const path = resolve(outDir, `${name}.png`);
  writePng(path, SIZE, SIZE, generate());
  console.log(`wrote ${path}`);
}
