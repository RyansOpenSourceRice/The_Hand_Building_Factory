type Ctor = {new (): AudioContext};

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (ctx) {
    return ctx;
  }
  const AudioCtor =
      (globalThis as {AudioContext?: Ctor}).AudioContext ?? null;
  if (!AudioCtor) {
    return null;
  }
  try {
    ctx = new AudioCtor();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, seconds: number, gain: number): void {
  const context = audio();
  if (!context) {
    return;
  }
  try {
    if (context.state === 'suspended') {
      void context.resume();
    }
    const osc = context.createOscillator();
    const env = context.createGain();
    const now = context.currentTime;
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(env);
    env.connect(context.destination);
    osc.start(now);
    osc.stop(now + seconds);
  } catch {
    return;
  }
}

export function ratchet(): void {
  blip(1800, 0.025, 0.1);
}

export function screwClick(): void {
  blip(950, 0.06, 0.22);
}

export function snap(): void {
  blip(660, 0.05, 0.16);
  const context = audio();
  if (!context) {
    return;
  }
  try {
    const osc = context.createOscillator();
    const env = context.createGain();
    const now = context.currentTime + 0.06;
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    env.gain.setValueAtTime(0.16, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(env);
    env.connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    return;
  }
}
