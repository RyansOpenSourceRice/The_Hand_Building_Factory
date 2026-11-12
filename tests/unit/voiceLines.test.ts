import {readFileSync, statSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';
import {PART_DEFS} from '../../src/game/handParts';
import {
  phaseVoiceKey,
  screwVoiceKey,
  VOICE_LINES,
} from '../../src/audio/voiceLines';

const ROOT = resolve(import.meta.dirname, '..', '..');

const PHASES = [...new Set(PART_DEFS.map((def) => def.phase))];

describe('voice line registry', () => {
  it('has a phase and screw line for every part phase', () => {
    for (const phase of PHASES) {
      expect(VOICE_LINES[phaseVoiceKey(phase)], phase).toBeDefined();
      expect(VOICE_LINES[screwVoiceKey(phase)], phase).toBeDefined();
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

  it('names the host for every screw line', () => {
    for (const phase of PHASES) {
      const line = VOICE_LINES[screwVoiceKey(phase)];
      expect(line?.text.toLowerCase()).toMatch(/into|drive/);
    }
  });

  it('keeps only grouped part narration', () => {
    expect(Object.keys(VOICE_LINES).some((key) => key.startsWith('part-')))
        .toBe(false);
    expect(VOICE_LINES['mount-one']).toBeUndefined();
    expect(VOICE_LINES['arrows']).toBeUndefined();
  });

  it('keeps the intro clip readable', () => {
    const intro = VOICE_LINES['intro'];
    expect(intro).toBeDefined();
    expect(readFileSync(
        resolve(ROOT, 'public', 'audio', 'voice', intro?.file ?? '')).length)
        .toBeGreaterThan(4096);
  });
});
