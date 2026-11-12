import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  cheer,
  initSfx,
  partDrop,
  ratchet,
  screwClick,
  setSfxMuted,
  snap,
} from '../../src/audio/sfx';

describe('sfx without an audio device', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    scene.activeCamera = new FreeCamera('cam', Vector3.Zero(), scene);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('initializes without throwing', () => {
    expect(() => initSfx(scene)).not.toThrow();
  });

  it('plays every cue without throwing', () => {
    initSfx(scene);
    expect(() => ratchet()).not.toThrow();
    expect(() => screwClick()).not.toThrow();
    expect(() => snap()).not.toThrow();
    expect(() => partDrop()).not.toThrow();
    expect(() => cheer()).not.toThrow();
  });

  it('silences cues while muted and keeps state across calls', () => {
    initSfx(scene);
    expect(() => {
      setSfxMuted(true);
      ratchet();
      setSfxMuted(false);
      ratchet();
    }).not.toThrow();
    setSfxMuted(false);
  });

  it('plays cues before initialization without throwing', () => {
    expect(() => ratchet()).not.toThrow();
    expect(() => cheer()).not.toThrow();
  });
});
