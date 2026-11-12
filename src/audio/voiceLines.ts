import raw from './voice-lines.json';

export type VoiceLine = {text: string; file: string};

export const VOICE_LINES: Readonly<Record<string, VoiceLine>> = raw;

export function partVoiceKey(id: string): string {
  return `part-${id}`;
}
