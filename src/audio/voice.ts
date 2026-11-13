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
  active: string[];
};

export class VoicePlayer {
  private readonly sounds = new Map<string, Sound>();
  private readonly ready = new Set<string>();
  private current: Sound | null = null;
  private currentKey = '';
  private pending: string | null = null;
  private armed = !AbstractEngine.audioEngine;
  private pumpTimer: ReturnType<typeof setTimeout> | null = null;
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
                this.pump();
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
    this.stopAll();
    this.pending = key;
    this.pump();
  }

  unlock(): void {
    this.armed = true;
    try {
      AbstractEngine.audioEngine?.unlock();
    } catch {
      this.pump();
      return;
    }
    this.pump();
  }

  setMuted(value: boolean): void {
    if (this.muted === value) {
      return;
    }
    this.muted = value;
    if (value) {
      this.stopAll();
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
      active: [...this.sounds.entries()]
          .filter(([, sound]) => sound.isPlaying)
          .map(([key]) => key),
    };
  }

  private canPlay(): boolean {
    const engine = AbstractEngine.audioEngine;
    return !engine || engine.unlocked;
  }

  private pump(): void {
    if (!this.armed || this.muted || !this.pending) {
      return;
    }
    const key = this.pending;
    if (!this.ready.has(key)) {
      return;
    }
    if (!this.canPlay()) {
      this.schedulePump();
      return;
    }
    this.pending = null;
    this.start(key);
  }

  private schedulePump(): void {
    if (this.pumpTimer) {
      return;
    }
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = null;
      this.pump();
    }, 100);
  }

  private start(key: string): void {
    const sound = this.sounds.get(key);
    if (!sound || this.muted || !this.canPlay()) {
      this.pending = key;
      this.schedulePump();
      return;
    }
    this.stopAll();
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

  private stopAll(): void {
    this.pending = null;
    if (this.pumpTimer) {
      clearTimeout(this.pumpTimer);
      this.pumpTimer = null;
    }
    for (const sound of this.sounds.values()) {
      try {
        sound.stop();
      } catch {
        continue;
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
