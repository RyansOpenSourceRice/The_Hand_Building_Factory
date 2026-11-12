import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Scene} from '@babylonjs/core/scene';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createScrew} from '../../src/scene/screwMeshes';

describe('screw meshes', () => {
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

  it('merges head and shaft into one low-poly mesh', () => {
    const screw = createScrew('palm-0', scene);
    expect(screw.getChildMeshes()).toHaveLength(0);
    expect(screw.getTotalVertices()).toBeLessThan(120);
    expect(screw.getTotalIndices()).toBeLessThan(240);
  });

  it('shares a single material across every screw', () => {
    const first = createScrew('palm-0', scene);
    const second = createScrew('finger-index-0', scene);
    expect(first.material).toBe(second.material);
    expect(scene.materials).toHaveLength(1);
  });
});
