import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

type Fake = {
  playing: boolean;
  playCalls: number;
  stopCalls: number;
  ready: () => void;
  play: () => void;
  stop: () => void;
  isPlaying: boolean;
  isReady: () => boolean;
  setVolume: (value: number) => void;
};

const fake = vi.hoisted(() => {
  const instances: Fake[] = [];
  class FakeSound {
    playing = false;
    playCalls = 0;
    stopCalls = 0;
    ready = () => {};
    onReady?: () => void;

    constructor(
        _name: string,
        _url: string,
        _scene: unknown,
        onReady: () => void,
    ) {
      this.ready = onReady;
      this.onReady = onReady;
      instances.push(this as unknown as Fake);
    }

    get isPlaying(): boolean {
      return this.playing;
    }

    isReady(): boolean {
      return true;
    }

    play(): void {
      this.playing = true;
      this.playCalls++;
    }

    stop(): void {
      this.playing = false;
      this.stopCalls++;
    }

    setVolume(): void {}
  }
  return {instances, FakeSound};
});

vi.mock('@babylonjs/core/Audio', () => ({Sound: fake.FakeSound}));

import {MusicLoop} from '../../src/audio/music';

describe('MusicLoop', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    fake.instances.length = 0;
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('starts once and never layers another copy on duck changes', () => {
    const music = new MusicLoop(scene);
    music.start();
    expect(fake.instances[0]?.playCalls).toBe(1);
    fake.instances[0]?.ready();
    music.setDucked(true);
    music.setDucked(false);
    music.setDucked(true);
    music.start();
    expect(fake.instances[0]?.playCalls).toBe(1);
  });
});
