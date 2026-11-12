import {Sound} from '@babylonjs/core/Audio';
import type {Scene} from '@babylonjs/core/scene';

const VOLUME = 0.3;

export class MusicLoop {
  private sound: Sound | null = null;
  private started = false;
  private muted = false;

  constructor(scene: Scene) {
    try {
      this.sound = new Sound(
          'music',
          '/audio/music-loop.ogg',
          scene,
          undefined,
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

  private apply(): void {
    if (!this.sound || !this.started) {
      return;
    }
    try {
      if (this.muted) {
        this.sound.stop();
        return;
      }
      this.sound.play();
    } catch {
      return;
    }
  }
}
