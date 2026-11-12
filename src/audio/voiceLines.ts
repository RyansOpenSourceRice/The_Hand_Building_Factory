import raw from './voice-lines.json';

export type VoiceLine = {text: string; file: string};

export const VOICE_LINES: Readonly<Record<string, VoiceLine>> = raw;

export function phaseVoiceKey(phase: string): string {
  return `phase-${phase}`;
}

export function screwVoiceKey(phase: string): string {
  return `screw-${phase}`;
}
