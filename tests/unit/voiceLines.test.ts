import {readFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {PART_DEFS} from '../../src/game/handParts';
import {partVoiceKey, VOICE_LINES} from '../../src/audio/voiceLines';

const ROOT = resolve(import.meta.dirname, '..', '..');

describe('voice line registry', () => {
  it('has one announcement for every part', () => {
    for (const def of PART_DEFS) {
      expect(VOICE_LINES[partVoiceKey(def.id)]).toBeDefined();
    }
  });

  it('points at a committed OGG clip for each line', () => {
    for (const [key, line] of Object.entries(VOICE_LINES)) {
      expect(key).toMatch(/^[a-z0-9-]+$/);
      expect(line.file).toMatch(/^[a-z0-9-]+\.ogg$/);
      expect(line.text.length).toBeGreaterThan(12);
      const file = resolve(ROOT, 'public', 'audio', 'voice', line.file);
      expect(statSync(file).size, `${key} ${line.file}`).toBeGreaterThan(1024);
    }
  });

  it('names the destination for every part line', () => {
    for (const def of PART_DEFS) {
      const line = VOICE_LINES[partVoiceKey(def.id)];
      expect(line?.text.toLowerCase()).toMatch(
          /goes|place|over the|behind|beside|above|on the/,
      );
    }
  });

  it('keeps the intro clip readable', () => {
    const intro = VOICE_LINES['intro'];
    expect(intro).toBeDefined();
    expect(readFileSync(
        resolve(ROOT, 'public', 'audio', 'voice', intro?.file ?? '')).length)
        .toBeGreaterThan(4096);
  });
});
