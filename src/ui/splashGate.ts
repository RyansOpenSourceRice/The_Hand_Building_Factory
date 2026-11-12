const GATE_MS = 4000;

export class SplashGate {
  private shownAt = 0;
  private eligible = false;

  reset(now: number): void {
    this.shownAt = now;
    this.eligible = false;
  }

  tick(now: number): boolean {
    if (this.eligible) {
      return false;
    }
    if (now - this.shownAt >= GATE_MS) {
      this.eligible = true;
      return true;
    }
    return false;
  }

  remainingSeconds(now: number): number | null {
    if (this.eligible) {
      return null;
    }
    const remaining = GATE_MS - (now - this.shownAt);
    if (remaining <= 0) {
      return null;
    }
    return Math.ceil(remaining / 1000);
  }

  elapsed(): boolean {
    return this.eligible;
  }
}

export const SPLASH_GATE_MS = GATE_MS;
