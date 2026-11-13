import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {TILE_FILES, TILE_SIZE} from '../../src/scene/textures';

const ROOT = resolve(import.meta.dirname, '..', '..');

describe('256 pixel texture tiles', () => {
  it('ships every tile at 256x256', () => {
    for (const [name, file] of Object.entries(TILE_FILES)) {
      const bytes = readFileSync(resolve(ROOT, 'public', file));
      expect(bytes.subarray(1, 4).toString('ascii'), name).toBe('PNG');
      const width = bytes.readUInt32BE(16);
      const height = bytes.readUInt32BE(20);
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
