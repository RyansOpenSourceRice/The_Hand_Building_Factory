import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Scene} from '@babylonjs/core/scene';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {HostGlow} from '../../src/scene/hostGlow';

describe('HostGlow', () => {
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

  it('tints the host mesh and restores its material', () => {
    const material = new StandardMaterial('host', scene);
    const mesh = MeshBuilder.CreateBox('hostMesh', {size: 0.2}, scene);
    mesh.material = material;
    const glow = new HostGlow();

    glow.set('palm', [mesh]);
    expect(mesh.material).not.toBe(material);
    expect(glow.active()).toBe('palm');
    expect(glow.count()).toBe(1);
    glow.tick(0.5);
    const tinted = mesh.material as StandardMaterial;
    expect(tinted.emissiveColor.r).toBeGreaterThan(0);

    glow.clear();
    expect(mesh.material).toBe(material);
    expect(glow.active()).toBe('');
  });

  it('can glow several stand meshes at once', () => {
    const material = new StandardMaterial('bench', scene);
    const slab = MeshBuilder.CreateBox('slab', {size: 0.2}, scene);
    const column = MeshBuilder.CreateBox('column', {size: 0.2}, scene);
    slab.material = material;
    column.material = material;
    const glow = new HostGlow();
    glow.set('stand', [slab, column]);
    expect(glow.count()).toBe(2);
    glow.set('stand', [slab, column]);
    expect(glow.count()).toBe(2);
    glow.set('', null);
    expect(slab.material).toBe(material);
    expect(column.material).toBe(material);
  });
});
