import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createDebugHand, digitAudit} from '../../src/input/handRep';

describe('controller box hand', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('has exactly four fingers and one thumb', () => {
    const root = createDebugHand(scene, 0, false);
    const audit = digitAudit(root);
    expect(audit.fingers).toBe(4);
    expect(audit.thumbs).toBe(1);
    expect(audit.digits).toBe(5);
    expect(scene.getMeshByName('handRep-knuckle')).toBeNull();
  });

  it('keeps the palm at 45-55 percent of the hand length', () => {
    const root = createDebugHand(scene, 0, false);
    const palm = scene.getMeshByName('handRep-palm');
    const proximal = scene.getMeshByName('handRep-finger0-proximal');
    const tip = scene.getMeshByName('handRep-finger0-tip');
    if (!palm || !proximal || !tip) {
      throw new Error('hand geometry missing');
    }
    const palmLength = palm.getBoundingInfo().boundingBox.extendSize.z * 2;
    const fingerLength =
      proximal.getBoundingInfo().boundingBox.extendSize.z * 2 +
      tip.getBoundingInfo().boundingBox.extendSize.z * 2;
    const ratio = palmLength / (palmLength + fingerLength);
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.56);
    expect(digitAudit(root).meshes).toBeGreaterThanOrEqual(11);
  });
});
