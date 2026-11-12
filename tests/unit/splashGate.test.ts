import {describe, expect, it} from 'vitest';
import {SplashGate} from '../../src/ui/splashGate';

describe('SplashGate', () => {
  it('stays locked until four seconds pass', () => {
    const gate = new SplashGate();
    gate.reset(0);
    expect(gate.elapsed()).toBe(false);
    expect(gate.tick(1999)).toBe(false);
    expect(gate.elapsed()).toBe(false);
    expect(gate.tick(4000)).toBe(true);
    expect(gate.elapsed()).toBe(true);
  });

  it('reports a countdown while locked and none after', () => {
    const gate = new SplashGate();
    gate.reset(1000);
    expect(gate.remainingSeconds(1000)).toBe(4);
    expect(gate.remainingSeconds(2500)).toBe(3);
    expect(gate.remainingSeconds(3500)).toBe(2);
    expect(gate.remainingSeconds(4999)).toBe(1);
    gate.tick(5000);
    expect(gate.remainingSeconds(5000)).toBe(null);
  });

  it('reports null countdown once time runs past the gate', () => {
    const gate = new SplashGate();
    gate.reset(0);
    expect(gate.remainingSeconds(4500)).toBe(null);
    expect(gate.tick(4500)).toBe(true);
  });

  it('ticks fire only once at the boundary', () => {
    const gate = new SplashGate();
    gate.reset(0);
    expect(gate.tick(4000)).toBe(true);
    expect(gate.tick(4001)).toBe(false);
    expect(gate.tick(9000)).toBe(false);
  });

  it('reset relocks a spent gate', () => {
    const gate = new SplashGate();
    gate.reset(0);
    gate.tick(4000);
    gate.reset(10000);
    expect(gate.elapsed()).toBe(false);
    expect(gate.remainingSeconds(10000)).toBe(4);
    expect(gate.tick(12000)).toBe(false);
    expect(gate.tick(14000)).toBe(true);
  });
});
