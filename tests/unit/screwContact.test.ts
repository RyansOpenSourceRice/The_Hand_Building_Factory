import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AssemblyStage, DRIVE_RADIUS} from '../../src/game/assembly';
import type {PartDef} from '../../src/game/handParts';

const boxProvider = (def: PartDef, scene: Scene) =>
  MeshBuilder.CreateBox(`part:${def.id}`, {size: 0.1}, scene);

describe('screwdriver contact', () => {
  let engine: NullEngine;
  let scene: Scene;
  let stage: AssemblyStage;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    scene.activeCamera = new FreeCamera('cam', Vector3.Zero(), scene);
    stage = new AssemblyStage(scene, boxProvider);
    const ghost = scene.getMeshByName('ghost:palm');
    if (!ghost) {
      throw new Error('missing palm ghost');
    }
    stage.startGrab('xr');
    stage.moveGrabbed(ghost.position);
    stage.endGrab('xr');
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('uses a 12 mm head-top contact radius', () => {
    expect(DRIVE_RADIUS).toBeCloseTo(0.012, 4);
  });

  it('does nothing five centimetres away', () => {
    const site = stage.screwSites()[0];
    if (!site) {
      throw new Error('missing screw site');
    }
    const tip = site.add(new Vector3(0, 0.05, 0));
    stage.driveTick(5, tip, true, 'xr');
    expect(stage.screwSites()).toHaveLength(4);
    expect(stage.driveState().contact).toBe(false);
  });

  it('drives exactly one screw when touching its head', () => {
    const site = stage.screwSites()[1];
    if (!site) {
      throw new Error('missing screw site');
    }
    stage.driveTick(5, site, true, 'xr');
    expect(stage.screwSites()).toHaveLength(3);
    expect(stage.driveState().contact).toBe(false);
  });

  it('only drives the nearest touched screw', () => {
    const sites = stage.screwSites();
    const second = sites[1];
    if (!second) {
      throw new Error('missing second screw');
    }
    stage.driveTick(5, second, true, 'xr');
    const remaining = stage.screwSites();
    expect(remaining).toHaveLength(3);
    expect(remaining.some((site) =>
      Vector3.Distance(site, second) < 1e-5)).toBe(false);
    for (const other of [sites[0], sites[2], sites[3]]) {
      if (other) {
        expect(remaining.some((site) =>
          Vector3.Distance(site, other) < 1e-5)).toBe(true);
      }
    }
  });
});
