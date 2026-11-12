import {Sound} from '@babylonjs/core/Audio';
import type {Scene} from '@babylonjs/core/scene';
import {audioPath} from './audioPath';

const VOLUME = 0.3;
const DUCK_VOLUME = 0.1;

export class MusicLoop {
  private sound: Sound | null = null;
  private started = false;
  private muted = false;
  private ducked = false;

  constructor(scene: Scene) {
    try {
      this.sound = new Sound(
          'music',
          audioPath('music-loop.ogg'),
          scene,
          () => this.apply(),
          {loop: true, volume: VOLUME},
      );
    } catch {
      this.sound = null;
    }
  }

  start(): void {
    if (!this.sound || this.started) {
      return;
    }
    this.started = true;
    this.apply();
  }

  setMuted(value: boolean): void {
    this.muted = value;
    this.apply();
  }

  isReady(): boolean {
    return this.sound?.isReady() ?? false;
  }

  setDucked(value: boolean): void {
    if (this.ducked === value) {
      return;
    }
    this.ducked = value;
    this.apply();
  }

  private apply(): void {
    if (!this.sound || !this.started) {
      return;
    }
    try {
      if (this.muted) {
        this.sound.stop();
        return;
      }
      this.sound.setVolume(this.ducked ? DUCK_VOLUME : VOLUME);
      if (!this.sound.isPlaying) {
        this.sound.play();
      }
    } catch {
      return;
    }
  }
}
