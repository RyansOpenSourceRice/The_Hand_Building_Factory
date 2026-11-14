import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  HAND_TEXTURE_FILE,
  HAND_TEXTURE_SIZE,
  PANORAMA_FILE,
  TILE_FILES,
  TILE_SIZE,
} from '../../src/scene/textures';

const ROOT = resolve(import.meta.dirname, '..', '..');

function pngSize(file: string): {width: number; height: number} {
  const bytes = readFileSync(resolve(ROOT, 'public', file));
  expect(bytes.subarray(1, 4).toString('ascii'), file).toBe('PNG');
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

describe('256 pixel texture tiles', () => {
  it('ships every tile at 256x256', () => {
    for (const [name, file] of Object.entries(TILE_FILES)) {
      const {width, height} = pngSize(file);
      expect(width, name).toBe(TILE_SIZE);
      expect(height, name).toBe(TILE_SIZE);
    }
  });

  it('uses seamless tiles, not one packed atlas', () => {
    const files = Object.values(TILE_FILES);
    expect(files).toHaveLength(12);
    expect(new Set(files).size).toBe(files.length);
    expect(files.every((file) => file.endsWith('-256.png'))).toBe(true);
  });
});

describe('photo textures', () => {
  it('ships one square detail map for the printed parts', () => {
    const {width, height} = pngSize(HAND_TEXTURE_FILE);
    expect(width).toBe(HAND_TEXTURE_SIZE);
    expect(height).toBe(HAND_TEXTURE_SIZE);
  });

  it('ships the hall vista at the 2:1 equirectangular aspect', () => {
    const {width, height} = pngSize(PANORAMA_FILE);
    expect(width / height).toBe(2);
  });
});
