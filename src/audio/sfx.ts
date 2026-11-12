import {Sound} from '@babylonjs/core/Audio';
import type {Scene} from '@babylonjs/core/scene';
import {audioPath} from './audioPath';

const GAIN = 0.8;
const FILE_BY_KEY = {
  ratchet: 'screw-ratchet',
  driven: 'screw-driven',
  snap: 'part-snap',
  drop: 'part-drop',
  cheer: 'crowd-cheer',
} as const;

type SfxKey = keyof typeof FILE_BY_KEY;

const bank: Partial<Record<SfxKey, Sound>> = {};
let muted = false;

function make(scene: Scene, key: SfxKey): Sound | null {
  try {
    return new Sound(
        `sfx:${key}`,
        audioPath(`${FILE_BY_KEY[key]}.ogg`),
        scene,
        undefined,
        {volume: GAIN},
    );
  } catch {
    return null;
  }
}

export function initSfx(scene: Scene): void {
  if (Object.keys(bank).length > 0) {
    return;
  }
  (Object.keys(FILE_BY_KEY) as SfxKey[]).forEach((key) => {
    const sound = make(scene, key);
    if (sound) {
      bank[key] = sound;
    }
  });
}

export function setSfxMuted(value: boolean): void {
  muted = value;
}

function play(key: SfxKey): void {
  const sound = bank[key];
  if (muted || !sound) {
    return;
  }
  try {
    sound.play();
  } catch {
    return;
  }
}

export function ratchet(): void {
  play('ratchet');
}

export function screwClick(): void {
  play('driven');
}

export function snap(): void {
  play('snap');
}

export function partDrop(): void {
  play('drop');
}

export function cheer(): void {
  play('cheer');
}
