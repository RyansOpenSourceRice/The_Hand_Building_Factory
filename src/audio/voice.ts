import {Sound} from '@babylonjs/core/Audio';
import type {Scene} from '@babylonjs/core/scene';
import {audioPath} from './audioPath';
import {VOICE_LINES} from './voiceLines';

const VOLUME = 0.9;

export class VoicePlayer {
  private readonly sounds = new Map<string, Sound>();
  private readonly ready = new Set<string>();
  private current: Sound | null = null;
  private currentKey = '';
  private queued: string | null = null;
  private muted = false;
  private readonly onSpeaking: (speaking: boolean) => void;

  constructor(scene: Scene, onSpeaking: (speaking: boolean) => void) {
    this.onSpeaking = onSpeaking;
    for (const [key, line] of Object.entries(VOICE_LINES)) {
      try {
        const sound = new Sound(
            `voice:${key}`,
            audioPath(`voice/${line.file}`),
            scene,
            () => {
              this.ready.add(key);
              if (this.queued === key) {
                this.queued = null;
                this.start(key);
              }
            },
            {volume: VOLUME},
        );
        sound.onEndedObservable.add(() => {
          if (this.current === sound) {
            this.finish();
          }
        });
        this.sounds.set(key, sound);
      } catch {
        continue;
      }
    }
  }

  say(key: string): void {
    if (this.muted || !this.sounds.has(key)) {
      return;
    }
    if (this.current && this.currentKey === key && this.current.isPlaying) {
      return;
    }
    if (this.current) {
      this.queued = key;
      return;
    }
    this.start(key);
  }

  setMuted(value: boolean): void {
    if (this.muted === value) {
      return;
    }
    this.muted = value;
    if (value) {
      this.queued = null;
      this.current?.stop();
      if (this.current) {
        this.current = null;
        this.currentKey = '';
        this.onSpeaking(false);
      }
    }
  }

  private start(key: string): void {
    const sound = this.sounds.get(key);
    if (!sound) {
      return;
    }
    if (!this.ready.has(key)) {
      this.queued = key;
      return;
    }
    this.current = sound;
    this.currentKey = key;
    this.onSpeaking(true);
    try {
      sound.play();
    } catch {
      this.finish();
    }
  }

  private finish(): void {
    this.current = null;
    this.currentKey = '';
    this.onSpeaking(false);
    const next = this.queued;
    this.queued = null;
    if (next) {
      this.start(next);
    }
  }
}
