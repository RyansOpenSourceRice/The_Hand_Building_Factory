import {describe, expect, it} from 'vitest';
import {audioPath} from '../../src/audio/audioPath';

describe('audioPath', () => {
  it('keeps the build base for Pages subpaths', () => {
    expect(audioPath('music-loop.ogg', './')).toBe('./audio/music-loop.ogg');
    expect(audioPath('music-loop.ogg', '/repo/')).toBe(
        '/repo/audio/music-loop.ogg',
    );
    expect(audioPath('music-loop.ogg', '/repo')).toBe(
        '/repo/audio/music-loop.ogg',
    );
    expect(audioPath('music-loop.ogg', '/')).toBe('/audio/music-loop.ogg');
  });

  it('never hard-codes a root-absolute path for the default base', () => {
    expect(audioPath('screw-ratchet.ogg')).toMatch(
        /audio\/screw-ratchet\.ogg$/,
    );
    expect(audioPath('screw-ratchet.ogg').startsWith('/audio')).toBe(
        import.meta.env.BASE_URL === '/',
    );
  });
});
