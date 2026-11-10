import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {SnapService} from '../../src/game/snap';

describe('SnapService', () => {
  let engine: NullEngine;
  let scene: Scene;
  let target: TransformNode;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    target = new TransformNode('target', scene);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('snaps when the part is inside the radius', () => {
    const snap = new SnapService(target, 0.2);
    expect(snap.trySnap(new Vector3(0.1, 0, 0))).toBe(true);
    expect(snap.isComplete).toBe(true);
  });

  it('rejects when the part is outside the radius', () => {
    const snap = new SnapService(target, 0.2);
    expect(snap.trySnap(new Vector3(0.4, 0, 0))).toBe(false);
    expect(snap.isComplete).toBe(false);
    expect(snap.trySnap(new Vector3(0.1, 0, 0))).toBe(true);
  });

  it('locks after a successful snap', () => {
    const snap = new SnapService(target, 0.2);
    expect(snap.trySnap(new Vector3(0.05, 0, 0))).toBe(true);
    expect(snap.trySnap(new Vector3(0.05, 0, 0))).toBe(false);
    expect(snap.isComplete).toBe(true);
  });

  it('allows re-snapping after reset', () => {
    const snap = new SnapService(target, 0.2);
    snap.trySnap(new Vector3(0.05, 0, 0));
    snap.reset();
    expect(snap.isComplete).toBe(false);
    expect(snap.trySnap(new Vector3(0.05, 0, 0))).toBe(true);
  });

  it('measures distance from the target node', () => {
    target.position.set(1, 2, 3);
    const snap = new SnapService(target, 0.2);
    expect(snap.distanceTo(new Vector3(1, 2, 5))).toBeCloseTo(2);
    expect(snap.distanceTo(new Vector3(1, 2, 3))).toBeCloseTo(0);
  });
});
