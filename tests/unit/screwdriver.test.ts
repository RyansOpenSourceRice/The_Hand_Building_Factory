import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {Screwdriver} from '../../src/game/screwdriver';

describe('Screwdriver', () => {
  let engine: NullEngine;
  let scene: Scene;
  let driver: Screwdriver;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    driver = new Screwdriver(scene);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('starts stowed', () => {
    expect(driver.isVisible()).toBe(false);
    expect(driver.isEquipped()).toBe(false);
  });

  it('equips into a hand and moves with it', () => {
    const hand = new TransformNode('hand', scene);
    hand.position.set(0.2, 1.2, 0.3);

    expect(driver.equip(hand)).toBe(true);
    expect(driver.isEquipped()).toBe(true);
    expect(driver.isVisible()).toBe(true);
    expect(driver.mesh.parent).toBe(hand);

    const tip = driver.tipWorld(new Vector3());
    hand.position.y += 0.2;
    hand.computeWorldMatrix(true);
    const movedTip = driver.tipWorld(new Vector3());
    expect(movedTip.y - tip.y).toBeGreaterThan(0.19);
  });

  it('holsters and never creates a second screwdriver', () => {
    const hand = new TransformNode('hand', scene);
    driver.equip(hand);
    driver.holster();
    expect(driver.isVisible()).toBe(false);
    expect(driver.isEquipped()).toBe(false);

    driver.equip(hand);
    driver.holster();
    driver.equip(hand);

    const bodies = scene.meshes.filter(
        (mesh) => mesh.name === 'tool:screwdriver');
    expect(bodies).toHaveLength(1);
  });

  it('returns to the dock instead of falling on a release', () => {
    driver.show();
    expect(driver.startGrab('desktop')).toBe(true);
    driver.moveGrabbed(new Vector3(1, 1.4, 1));
    driver.endGrab('desktop');

    expect(driver.isEquipped()).toBe(false);
    expect(driver.isVisible()).toBe(true);
    expect(driver.mesh.parent).toBe(null);
    expect(driver.mesh.position.y).toBeCloseTo(1.08);
  });
});
