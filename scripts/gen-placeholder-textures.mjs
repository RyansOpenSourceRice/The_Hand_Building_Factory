import {writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

function makeNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function concreteTile(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const noise = makeNoise(0xc0ffee);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const speckle = (noise() - 0.5) * 14;
      const stain =
        Math.sin(u * Math.PI * 2 + 1.3) * Math.cos(v * Math.PI * 2 - 0.7) * 6;
      const joint = u < 0.012 || v < 0.012 ? -26 : 0;
      const halo = u < 0.03 || v < 0.03 ? -6 : 0;
      const value = 168 + speckle + stain + joint + halo;
      const offset = (y * size + x) * 3;
      pixels[offset] = clamp(value + 2);
      pixels[offset + 1] = clamp(value);
      pixels[offset + 2] = clamp(value - 3);
    }
  }
  return pixels;
}

function metalTile(size) {
  const pixels = Buffer.alloc(size * size * 3);
  const noise = makeNoise(0xbeef01);
  const ribPeriod = size / 8;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rib = Math.abs(Math.sin((x / ribPeriod) * Math.PI * 2));
      const shape = 178 + (rib - 0.5) * 26;
      const grain = (noise() - 0.5) * 8;
      const seam = x % ribPeriod < 2 ? -18 : 0;
      const value = shape + grain + seam;
      const offset = (y * size + x) * 3;
      pixels[offset] = clamp(value - 1);
      pixels[offset + 1] = clamp(value + 1);
      pixels[offset + 2] = clamp(value + 3);
    }
  }
  return pixels;
}

const outDir = resolve(ROOT, 'public', 'textures');
mkdirSync(outDir, {recursive: true});

const targets = [
  ['concrete-floor.png', concreteTile],
  ['metal-roof.png', metalTile],
];
for (const [name, tile] of targets) {
  const path = resolve(outDir, name);
  if (!existsSync(path)) {
    writePng(path, 512, 512, tile(512));
    console.log(`wrote procedural ${name}`);
  } else {
    console.log(`kept existing ${name}`);
  }
}
