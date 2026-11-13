import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

type FakeInstance = {
  name: string;
  url: string;
  ready: () => void;
  ended: Array<() => void>;
  playing: boolean;
  loop: boolean;
  playCalls: number;
  play: () => void;
  stop: () => void;
  onEndedObservable: {add: (cb: () => void) => void};
};

const fake = vi.hoisted(() => {
  const instances: FakeInstance[] = [];
  class FakeSound {
    name: string;
    url: string;
    ready: () => void;
    ended: Array<() => void> = [];
    playing = false;
    loop = false;
    playCalls = 0;
    onEndedObservable = {
      add: (cb: () => void) => {
        this.ended.push(cb);
      },
    };

    constructor(name: string, url: string, _scene: unknown, ready: () => void) {
      this.name = name;
      this.url = url;
      this.ready = ready;
      instances.push(this as unknown as FakeInstance);
    }

    get isPlaying(): boolean {
      return this.playing;
    }

    play(): void {
      this.playing = true;
      this.playCalls++;
    }

    stop(): void {
      this.playing = false;
    }
  }
  return {instances, FakeSound};
});

vi.mock('@babylonjs/core/Audio', () => ({Sound: fake.FakeSound}));

import {VoicePlayer} from '../../src/audio/voice';

describe('VoicePlayer', () => {
  let engine: NullEngine;
  let scene: Scene;
  let speaking: boolean;
  let player: VoicePlayer;

  beforeEach(() => {
    fake.instances.length = 0;
    engine = new NullEngine();
    scene = new Scene(engine);
    speaking = false;
    player = new VoicePlayer(scene, (value) => {
      speaking = value;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    scene.dispose();
    engine.dispose();
  });

  const readyAll = async (): Promise<void> => {
    for (const instance of fake.instances) {
      instance.ready();
    }
    await Promise.resolve();
  };

  const sound = (key: string): FakeInstance => {
    const found = fake.instances.find(
        (instance) => instance.name === `voice:${key}`);
    if (!found) {
      throw new Error(`missing fake sound ${key}`);
    }
    return found;
  };

  it('interrupts the current line instead of queueing it', async () => {
    await readyAll();
    player.say('intro');
    expect(sound('intro').playing).toBe(true);
    player.say('phase-palm');
    expect(sound('intro').playing).toBe(false);
    expect(sound('phase-palm').playing).toBe(true);
    expect(player.state().current).toBe('phase-palm');
  });

  it('does not restart a line that is already playing', async () => {
    await readyAll();
    player.say('intro');
    player.say('intro');
    expect(sound('intro').playCalls).toBe(1);
    expect(player.state().plays['intro']).toBe(1);
  });

  it('plays a line once its clip becomes ready', async () => {
    player.say('phase-motors');
    expect(sound('phase-motors').playing).toBe(false);
    await readyAll();
    expect(sound('phase-motors').playing).toBe(true);
  });

  it('does not start a stale line after another request arrives', async () => {
    player.say('phase-motors');
    sound('phase-motors').ready();
    player.say('phase-fingers');
    await Promise.resolve();
    expect(sound('phase-motors').playing).toBe(false);
    expect(player.state().active).toHaveLength(0);
    sound('phase-fingers').ready();
    await Promise.resolve();
    await Promise.resolve();
    expect(sound('phase-fingers').playing).toBe(true);
    expect(player.state().active).toEqual(['phase-fingers']);
  });

  it('clears a stuck line with the watchdog', async () => {
    vi.useFakeTimers();
    await readyAll();
    player.say('intro');
    expect(speaking).toBe(true);
    vi.advanceTimersByTime(12_000);
    expect(speaking).toBe(false);
    expect(player.state().current).toBe('');
  });

  it('stops playback and clears the pending line on mute', async () => {
    await readyAll();
    player.say('intro');
    player.setMuted(true);
    expect(sound('intro').playing).toBe(false);
    expect(speaking).toBe(false);
    player.say('phase-palm');
    expect(sound('phase-palm').playing).toBe(false);
  });
});
