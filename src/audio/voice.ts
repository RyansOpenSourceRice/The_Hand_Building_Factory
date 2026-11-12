import {Sound} from '@babylonjs/core/Audio';
import {AbstractEngine} from '@babylonjs/core/Engines/abstractEngine';
import type {Scene} from '@babylonjs/core/scene';
import {audioPath} from './audioPath';
import {VOICE_LINES} from './voiceLines';

const VOLUME = 0.9;
const WATCHDOG_MS = 12_000;

export type VoiceState = {
  current: string;
  lastKey: string;
  lastText: string;
  speaking: boolean;
  muted: boolean;
  plays: Record<string, number>;
};

export class VoicePlayer {
  private readonly sounds = new Map<string, Sound>();
  private readonly ready = new Set<string>();
  private current: Sound | null = null;
  private currentKey = '';
  private pending: string | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private muted = false;
  private lastKey = '';
  private lastText = '';
  private readonly plays: Record<string, number> = {};
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
              if (this.pending === key) {
                this.pending = null;
                queueMicrotask(() => this.start(key));
              }
            },
            {volume: VOLUME},
        );
        sound.loop = false;
        sound.onEndedObservable.add(() => this.finish(sound));
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
    this.stopCurrent();
    if (this.ready.has(key)) {
      this.start(key);
    } else {
      this.pending = key;
    }
  }

  unlock(): void {
    try {
      AbstractEngine.audioEngine?.unlock();
    } catch {
      return;
    }
  }

  setMuted(value: boolean): void {
    if (this.muted === value) {
      return;
    }
    this.muted = value;
    if (value) {
      this.stopCurrent();
    }
  }

  isSpeaking(): boolean {
    return this.current !== null;
  }

  state(): VoiceState {
    return {
      current: this.currentKey,
      lastKey: this.lastKey,
      lastText: this.lastText,
      speaking: this.current !== null,
      muted: this.muted,
      plays: {...this.plays},
    };
  }

  private start(key: string): void {
    const sound = this.sounds.get(key);
    if (!sound || this.muted) {
      return;
    }
    this.current = sound;
    this.currentKey = key;
    this.lastKey = key;
    this.lastText = VOICE_LINES[key]?.text ?? '';
    this.plays[key] = (this.plays[key] ?? 0) + 1;
    this.onSpeaking(true);
    if (this.watchdog) {
      clearTimeout(this.watchdog);
    }
    this.watchdog = setTimeout(() => this.finish(sound), WATCHDOG_MS);
    try {
      sound.play();
    } catch {
      this.finish(sound);
    }
  }

  private stopCurrent(): void {
    this.pending = null;
    if (this.current) {
      try {
        this.current.stop();
      } catch {
        this.current = null;
      }
    }
    this.clearCurrent();
  }

  private finish(sound: Sound): void {
    if (this.current !== sound) {
      return;
    }
    this.clearCurrent();
  }

  private clearCurrent(): void {
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    this.current = null;
    this.currentKey = '';
    this.onSpeaking(false);
  }
}
